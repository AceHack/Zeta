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

/** What the portal needs from the platform. The server provides a k8s-backed impl. */
export interface PlatformData {
  listDeployables(): Promise<DeployableCR[]>;
  listBlueprints(): Promise<BlueprintCR[]>;
  listRooms(): Promise<RoomData[]>;
  getRoom(resource: string): Promise<RoomData | undefined>;
  /** Append a human authorization grant to a Room. Returns false if the request is unknown. */
  grant(resource: string, requestId: string, by: string, granted: boolean, note?: string): Promise<boolean>;
}

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

    // GET /api/rooms/:resource — one Room's collaboration view (resource is ns~name)
    const roomMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
    if (roomMatch && req.method === "GET") {
      const resource = decodeResource(roomMatch[1]!);
      const room = await data.getRoom(resource);
      if (!room) return json({ error: `no room for ${resource}` }, 404);
      return json({ room: toRoomVM(room) });
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
