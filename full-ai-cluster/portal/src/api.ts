// full-ai-cluster/portal/src/api.ts
//
// The BFF (backend-for-frontend) — pure request routing over an injected data
// source, so the whole API is unit-tested without a live cluster. The server
// (server.ts) wires a real K8s/Room-backed PlatformData into `handle`; tests
// wire an in-memory one. Read endpoints render view models; the single write
// endpoint is the human authorization grant (no-directives: only a human grants).

import {
  type BlueprintCR,
  catalog,
  type DeployableCR,
  needsMe,
  resourceGroups,
  type RoomData,
  toRoomVM,
} from "./viewmodel.ts";
import type { LifecycleAction, MemoryUsage, ResourceConfig, ResourceOps } from "./ops.ts";
import { type ChatOp, DEFAULT_POLICY, decide, respond } from "./room-agent.ts";

const LIFECYCLE_ACTIONS = new Set(["restart", "stop", "start", "scale", "delete"]);

/** Execute a sandboxed chat op against THIS resource's ops only. */
async function runChatOp(ops: ResourceOps, resource: string, op: ChatOp): Promise<string> {
  switch (op.kind) {
    case "restart": return (await ops.lifecycle(resource, "restart")).message;
    case "stop": return (await ops.lifecycle(resource, "stop")).message;
    case "scale": return (await ops.lifecycle(resource, "scale", op.replicas)).message;
    case "config": return (await ops.applyConfig(resource, op.patch)).message;
  }
}

/** What the portal needs from the platform. The server provides a k8s-backed impl. */
export interface PlatformData {
  listDeployables(): Promise<DeployableCR[]>;
  listBlueprints(): Promise<BlueprintCR[]>;
  listRooms(): Promise<RoomData[]>;
  getRoom(resource: string): Promise<RoomData | undefined>;
  /** Append a human authorization grant to a Room. Returns false if the request is unknown. */
  grant(resource: string, requestId: string, by: string, granted: boolean, note?: string): Promise<boolean>;
  /**
   * Append a typed Event to a Room (the room-service write path the controller +
   * persona runtime use). Optional: not every backend supports writes. Returns the
   * appended Event's id, or null if appends aren't supported / failed.
   */
  appendEvent?(resource: string, by: { id: string; kind?: "human" | "persona" }, body: RoomEventBody): Promise<string | null>;
  /** The management-plane operations (info/metrics/logs/files/config/lifecycle). Optional. */
  ops?: ResourceOps;
  /** Aggregate memory usage (durable Room logs + agent-memory). Optional. */
  memoryUsage?(): Promise<MemoryUsage>;
}

/** The typed Event bodies the write endpoint accepts (mirrors the Room substrate). */
export type RoomEventBody =
  | { type: "message"; text: string }
  | { type: "state-change"; phase: string; detail?: string }
  | { type: "action"; action: Record<string, unknown>; result?: string }
  | { type: "authorization-request"; action: Record<string, unknown>; gated?: string }
  | { type: "retraction"; retracts: string; note?: string };

const EVENT_TYPES = new Set(["message", "state-change", "action", "authorization-request", "retraction"]);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Route + handle one API request. Returns null for non-/api paths (server serves static). */
export async function handle(req: Request, data: PlatformData): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith("/api/")) return null;

  try {
    // GET /api/resources — the top-down, category-grouped resource view
    if (path === "/api/resources" && req.method === "GET") {
      const [deps, bps] = await Promise.all([data.listDeployables(), data.listBlueprints()]);
      return json({ groups: resourceGroups(deps, bps) });
    }

    // GET /api/catalog — the deploy catalog (blueprints + their form variables)
    if (path === "/api/catalog" && req.method === "GET") {
      return json({ catalog: catalog(await data.listBlueprints()) });
    }

    // GET /api/needs-me — pending authorizations across all rooms (the human queue)
    if (path === "/api/needs-me" && req.method === "GET") {
      return json({ items: needsMe(await data.listRooms()) });
    }

    // GET /api/memory — aggregate durable Room-log / agent-memory usage
    if (path === "/api/memory" && req.method === "GET") {
      if (!data.memoryUsage) return json({ rooms: [], totalEvents: 0, totalBytes: 0 });
      return json(await data.memoryUsage());
    }

    // ── management plane: /api/resources/:resource/* ───────────────────
    const mgmt = path.match(/^\/api\/resources\/([^/]+)\/(info|dashboard|metrics|logs|traces|events|files|access|config|lifecycle|exec|query)$/);
    if (mgmt) {
      if (!data.ops) return json({ error: "management ops not available on this backend" }, 405);
      const resource = decodeResource(mgmt[1]!);
      const op = mgmt[2]!;
      if (req.method === "GET") {
        switch (op) {
          case "info": return json(await data.ops.info(resource));
          case "dashboard": return json(await data.ops.dashboard(resource));
          case "metrics": return json(await data.ops.metrics(resource));
          case "logs": return json({ lines: await data.ops.logs(resource, { tail: Number(url.searchParams.get("tail")) || 200 }) });
          case "traces": return json({ traces: await data.ops.traces(resource) });
          case "events": return json({ events: await data.ops.events(resource) });
          case "access": return json(await data.ops.access(resource));
          case "config": return json(await data.ops.config(resource));
          case "files": return json(await data.ops.files(resource, url.searchParams.get("path") ?? ""));
        }
      }
      if (req.method === "POST") {
        const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        if (op === "config") return json(await data.ops.applyConfig(resource, b as Partial<ResourceConfig>));
        if (op === "exec") return json(await data.ops.exec(resource, String(b.cmd ?? "")));
      if (op === "query") return json(await data.ops.query(resource, String(b.sql ?? "")));
        if (op === "files") {
          const file = b.file as { name?: string; size?: number } | undefined;
          if (!file?.name || typeof file.size !== "number") return json({ error: "file{name,size} required" }, 400);
          return json(await data.ops.upload(resource, String(b.dir ?? "/"), { name: file.name, size: file.size }));
        }
        if (op === "lifecycle") {
          const action = String(b.action ?? "");
          if (!LIFECYCLE_ACTIONS.has(action)) return json({ error: "action must be restart|stop|start|scale|delete" }, 400);
          return json(await data.ops.lifecycle(resource, action as LifecycleAction, typeof b.replicas === "number" ? b.replicas : undefined));
        }
      }
      if (req.method === "DELETE" && op === "files") {
        const target = url.searchParams.get("path");
        if (!target) return json({ error: "path required" }, 400);
        return json(await data.ops.deleteFile(resource, target));
      }
      return json({ error: "method not allowed" }, 405);
    }

    // GET /api/rooms/:resource — one Room's collaboration view (resource is ns~name)
    const roomMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
    if (roomMatch && req.method === "GET") {
      const resource = decodeResource(roomMatch[1]!);
      const room = await data.getRoom(resource);
      if (!room) return json({ error: `no room for ${resource}` }, 404);
      return json({ room: toRoomVM(room) });
    }

    // POST /api/rooms/:resource/events — append a typed Event (controller / personas)
    const eventsMatch = path.match(/^\/api\/rooms\/([^/]+)\/events$/);
    if (eventsMatch && req.method === "POST") {
      if (!data.appendEvent) return json({ error: "append not supported by this backend" }, 405);
      const resource = decodeResource(eventsMatch[1]!);
      const b = (await req.json().catch(() => ({}))) as { by?: string; kind?: "human" | "persona"; body?: RoomEventBody };
      if (!b.by || !b.body || !EVENT_TYPES.has(b.body.type)) return json({ error: "by + a valid body{type,…} required" }, 400);
      const id = await data.appendEvent(resource, { id: b.by, ...(b.kind ? { kind: b.kind } : {}) }, b.body);
      return id ? json({ ok: true, id }) : json({ error: "append failed" }, 500);
    }

    // POST /api/rooms/:resource/grant — a human authorizes (or denies) a request
    const grantMatch = path.match(/^\/api\/rooms\/([^/]+)\/grant$/);
    if (grantMatch && req.method === "POST") {
      const resource = decodeResource(grantMatch[1]!);
      const b = (await req.json().catch(() => ({}))) as { requestId?: string; by?: string; granted?: boolean; note?: string };
      if (!b.requestId || !b.by || typeof b.granted !== "boolean") return json({ error: "requestId, by, granted required" }, 400);
      const ok = await data.grant(resource, b.requestId, b.by, b.granted, b.note);
      return ok ? json({ ok: true }) : json({ error: "unknown room or request" }, 404);
    }

    // POST /api/rooms/:resource/chat — talk to the resource's persona. SANDBOXED:
    // the agent only ever sees + acts on THIS resource; actions run through Policy.
    const chatMatch = path.match(/^\/api\/rooms\/([^/]+)\/chat$/);
    if (chatMatch && req.method === "POST") {
      if (!data.ops || !data.appendEvent) return json({ error: "chat not available on this backend" }, 405);
      const resource = decodeResource(chatMatch[1]!);
      const b = (await req.json().catch(() => ({}))) as { text?: string; by?: string };
      if (!b.text || !b.by) return json({ error: "text + by required" }, 400);

      // the persona that operates this resource (resource-scoped lookup)
      const dep = (await data.listDeployables()).find((d) => `${d.metadata.namespace}/${d.metadata.name}` === resource);
      const admin = dep?.spec.ai?.admin ?? "otto";

      // 1) record the human's message
      await data.appendEvent(resource, { id: b.by, kind: "human" }, { type: "message", text: b.text });

      // 2) the persona responds — context is THIS resource only, incl. its logs/traces
      const [cfg, info, logs, traces] = await Promise.all([
        data.ops.config(resource),
        data.ops.info(resource),
        data.ops.logs(resource, { tail: 50 }),
        data.ops.traces(resource),
      ]);
      const r = respond(resource, b.text, {
        game: !!cfg.values.MAP || /sandbox|gmod|game/.test(resource),
        memory: cfg.memory,
        replicas: info.pods.length,
        phase: info.pods[0]?.phase ?? "Unknown",
        recentErrors: logs.filter((l) => l.level === "error" || l.level === "warn").map((l) => l.text),
        slowTraces: traces.map((tr) => ({ name: tr.rootName, ms: tr.totalMs, status: tr.status })),
      });
      await data.appendEvent(resource, { id: admin, kind: "persona" }, { type: "message", text: r.reply });

      // 3) if it proposed an op, run it through Policy — act (auto) or request (propose)
      if (r.op) {
        const d = decide(DEFAULT_POLICY, r.op.action);
        if (d.level === "auto") {
          const result = await runChatOp(data.ops, resource, r.op);
          await data.appendEvent(resource, { id: admin, kind: "persona" }, { type: "action", action: { summary: r.op.action.summary }, result });
        } else if (d.level === "propose") {
          await data.appendEvent(resource, { id: admin, kind: "persona" }, { type: "authorization-request", action: { summary: r.op.action.summary }, ...(d.gated ? { gated: d.gated } : {}) });
        }
      }
      const room = await data.getRoom(resource);
      return json({ room: room ? toRoomVM(room) : null });
    }

    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}

/** Resources are addressed as `namespace~name` in URLs (slash-free). */
export function encodeResource(namespace: string, name: string): string {
  return `${namespace}~${name}`;
}
function decodeResource(seg: string): string {
  const [ns, name] = seg.split("~");
  return name ? `${ns}/${name}` : seg;
}
