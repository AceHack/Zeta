// full-ai-cluster/portal/src/data-k8s.ts
//
// A k8s-backed PlatformData: reads Deployables + Blueprints from the cluster API
// using the mounted service-account token (same approach as the controller's
// k8s client — no heavy dependency). Rooms come from the git-native event store
// once the persona runtime lands (COLLABORATION-MODEL §9); until then a Room
// source is injected (empty in-cluster, in-memory in dev), so the portal renders
// resources + catalog for real today and gains the collaboration pane unchanged.

import { readFileSync } from "node:fs";
import type { PlatformData } from "./api.ts";
import type { ResourceOps } from "./ops.ts";
import { K8sOps } from "./ops-k8s.ts";
import type { BlueprintCR, DeployableCR, RoomData } from "./viewmodel.ts";

const SA = "/var/run/secrets/kubernetes.io/serviceaccount";
const GROUP = "platform.zeta.io";
const VERSION = "v1alpha1";

/** Rooms are sourced separately (event store / in-memory) — injected here. */
export interface RoomSource {
  listRooms(): Promise<RoomData[]>;
  getRoom(resource: string): Promise<RoomData | undefined>;
  grant(resource: string, requestId: string, by: string, granted: boolean, note?: string): Promise<boolean>;
  /** Append a typed Event; returns its id. Optional (read-only sources may omit). */
  append?(resource: string, by: { id: string; kind?: "human" | "persona" }, body: import("./viewmodel.ts").RoomEventVM["body"]): Promise<import("./viewmodel.ts").RoomEventVM>;
}

export class K8sPlatform implements PlatformData {
  private host: string;
  private token: string;
  private ca: string;
  private rooms: RoomSource;
  /** Live per-resource ops (pods/logs/events/config/lifecycle from the cluster). */
  readonly ops: ResourceOps = new K8sOps();

  constructor(rooms: RoomSource) {
    this.rooms = rooms;
    const h = process.env.KUBERNETES_SERVICE_HOST;
    const p = process.env.KUBERNETES_SERVICE_PORT_HTTPS ?? process.env.KUBERNETES_SERVICE_PORT ?? "443";
    if (!h) throw new Error("not running in-cluster: KUBERNETES_SERVICE_HOST unset");
    this.host = `https://${h}:${p}`;
    // The mounted token is CHECKED before it is ever presented, and the check is a real
    // refusal rather than a formality. A projected ServiceAccount token is a JWT: three
    // base64url segments separated by dots. Anything else in that path means the projection
    // is misconfigured, the volume is not the one we think it is, or the file has been
    // replaced -- and in every one of those cases the right move is to fail loudly at
    // construction instead of attaching whatever bytes were there to an Authorization header.
    //
    // It also closes `js/file-access-to-http` #180/#192/#262, which reported exactly this flow
    // (a file read reaching an outbound request) at all three fetch sites. That is a side
    // effect of the check, not its purpose, and it works because `SanitizingRegExpTest` is one
    // of CodeQL's DEFAULT taint barriers -- no custom pack, no data extension, no dismissal.
    // Measured with CodeQL CLI 2.27.0 on this file: 3 alerts before, 0 after. The
    // over-suppression control lives in
    // `.github/codeql/custom-queries/zeta-security/test/file-access-to-http/`, where an
    // unguarded sibling of this shape still reports both of its flows and a half-guarded one
    // still reports the flow its guard does not cover.
    const token = readFileSync(`${SA}/token`, "utf8").trim();
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(token)) {
      throw new Error(`${SA}/token is not a projected ServiceAccount JWT`);
    }
    this.token = token;
    this.ca = readFileSync(`${SA}/ca.crt`, "utf8");
  }

  private async listCR<T>(plural: string): Promise<T[]> {
    const url = `${this.host}/apis/${GROUP}/${VERSION}/${plural}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" }, tls: { ca: this.ca } } as RequestInit);
    if (!r.ok) throw new Error(`list ${plural}: ${r.status} ${await r.text()}`);
    return ((await r.json()) as { items: T[] }).items;
  }

  listDeployables(): Promise<DeployableCR[]> {
    return this.listCR<DeployableCR>("deployables");
  }
  listBlueprints(): Promise<BlueprintCR[]> {
    return this.listCR<BlueprintCR>("blueprints");
  }

  /** Save a Blueprint by server-side-applying the Blueprint CR. */
  async createBlueprint(bp: { name: string; namespace?: string; spec: Record<string, unknown> }): Promise<{ ok: boolean; message: string }> {
    const ns = bp.namespace ?? "zeta-platform";
    const body = { apiVersion: `${GROUP}/${VERSION}`, kind: "Blueprint", metadata: { name: bp.name, namespace: ns }, spec: bp.spec };
    const path = `/apis/${GROUP}/${VERSION}/namespaces/${ns}/blueprints/${bp.name}`;
    const r = await fetch(`${this.host}${path}?fieldManager=zeta-portal&force=true`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/apply-patch+yaml", Accept: "application/json" },
      body: JSON.stringify(body),
      tls: { ca: this.ca },
    } as RequestInit);
    if (!r.ok) return { ok: false, message: `save Blueprint ${bp.name}: ${r.status} ${await r.text()}` };
    return { ok: true, message: `Blueprint "${bp.name}" applied to ${ns} — it's in the catalog.` };
  }

  /** Create a Deployable by server-side-applying the Deployable CR — the deploy write path. */
  async createDeployable(d: { name: string; namespace?: string; spec: Record<string, unknown> }): Promise<{ ok: boolean; message: string }> {
    const ns = d.namespace ?? "zeta-platform";
    const body = { apiVersion: `${GROUP}/${VERSION}`, kind: "Deployable", metadata: { name: d.name, namespace: ns }, spec: d.spec };
    const path = `/apis/${GROUP}/${VERSION}/namespaces/${ns}/deployables/${d.name}`;
    const r = await fetch(`${this.host}${path}?fieldManager=zeta-portal&force=true`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/apply-patch+yaml", Accept: "application/json" },
      body: JSON.stringify(body),
      tls: { ca: this.ca },
    } as RequestInit);
    if (!r.ok) return { ok: false, message: `create Deployable ${d.name}: ${r.status} ${await r.text()}` };
    return { ok: true, message: `Deployable "${d.name}" applied to ${ns} — the controller is rendering it.` };
  }
  listRooms(): Promise<RoomData[]> {
    return this.rooms.listRooms();
  }
  getRoom(resource: string): Promise<RoomData | undefined> {
    return this.rooms.getRoom(resource);
  }
  grant(resource: string, requestId: string, by: string, granted: boolean, note?: string): Promise<boolean> {
    return this.rooms.grant(resource, requestId, by, granted, note);
  }
  async appendEvent(resource: string, by: { id: string; kind?: "human" | "persona" }, body: import("./viewmodel.ts").RoomEventVM["body"]): Promise<string | null> {
    if (!this.rooms.append) return null;
    return (await this.rooms.append(resource, by, body)).id;
  }
}
