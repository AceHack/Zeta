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

  constructor(private rooms: RoomSource) {
    const h = process.env.KUBERNETES_SERVICE_HOST;
    const p = process.env.KUBERNETES_SERVICE_PORT_HTTPS ?? process.env.KUBERNETES_SERVICE_PORT ?? "443";
    if (!h) throw new Error("not running in-cluster: KUBERNETES_SERVICE_HOST unset");
    this.host = `https://${h}:${p}`;
    this.token = readFileSync(`${SA}/token`, "utf8").trim();
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
