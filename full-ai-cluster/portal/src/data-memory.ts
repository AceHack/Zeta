// full-ai-cluster/portal/src/data-memory.ts
//
// An in-memory PlatformData — for local dev and tests, and the seam the real
// k8s/git-event-store backend slots into. Holds Deployables, Blueprints, and
// Rooms; grant() appends a human authorization-grant event to a Room (the only
// write the portal performs). Deterministic: event seq derives from length.

import type { PlatformData } from "./api.ts";
import type { MemoryUsage, ResourceOps } from "./ops.ts";
import { DemoOps } from "./ops-demo.ts";
import { roomBytes } from "./memory-usage.ts";
import type { BlueprintCR, DeployableCR, RoomData, RoomEventVM } from "./viewmodel.ts";

export class InMemoryPlatform implements PlatformData {
  readonly ops: ResourceOps = new DemoOps();
  private deployables: DeployableCR[];
  private blueprints: BlueprintCR[];
  private rooms: RoomData[];
  constructor(deployables: DeployableCR[] = [], blueprints: BlueprintCR[] = [], rooms: RoomData[] = []) {
    this.deployables = deployables;
    this.blueprints = blueprints;
    this.rooms = rooms;
  }

  async memoryUsage(): Promise<MemoryUsage> {
    const rooms = this.rooms.map((r) => ({ resource: r.resource, events: r.events.length, bytes: roomBytes(r) }));
    return { rooms, totalEvents: rooms.reduce((n, r) => n + r.events, 0), totalBytes: rooms.reduce((n, r) => n + r.bytes, 0) };
  }

  /** Save a Blueprint into the catalog (the builder). Upserts by name. */
  async createBlueprint(bp: { name: string; namespace?: string; spec: { category?: string; image: string; storage?: { size: string }; defaultExpose?: string; variables?: Array<{ name: string; default?: string; description?: string }>; stateful?: boolean } }): Promise<{ ok: boolean; message: string }> {
    const cr: BlueprintCR = {
      metadata: { name: bp.name, namespace: bp.namespace ?? "zeta-platform" },
      spec: { ...(bp.spec.category ? { category: bp.spec.category } : {}), image: bp.spec.image, stateful: bp.spec.stateful ?? !!bp.spec.storage, ...(bp.spec.defaultExpose ? { defaultExpose: bp.spec.defaultExpose } : {}), ...(bp.spec.variables ? { variables: bp.spec.variables } : {}) },
    };
    this.blueprints = [...this.blueprints.filter((b) => b.metadata.name !== bp.name), cr];
    return { ok: true, message: `Blueprint "${bp.name}" saved — it's now in the catalog and ready to deploy.` };
  }

  async listDeployables(): Promise<DeployableCR[]> {
    return this.deployables;
  }
  async listBlueprints(): Promise<BlueprintCR[]> {
    return this.blueprints;
  }
  async listRooms(): Promise<RoomData[]> {
    return this.rooms;
  }
  async getRoom(resource: string): Promise<RoomData | undefined> {
    return this.rooms.find((r) => r.resource === resource);
  }

  async grant(resource: string, requestId: string, by: string, granted: boolean, note?: string): Promise<boolean> {
    const room = this.rooms.find((r) => r.resource === resource);
    if (!room) return false;
    const req = room.events.find((e) => e.id === requestId && e.body.type === "authorization-request");
    if (!req) return false;
    const seq = room.events.length;
    const grant: RoomEventVM = {
      id: `evt-${seq}`,
      seq,
      weight: 1,
      proposedBy: { id: by, kind: "human" },
      authorizedBy: { id: by, kind: "human" }, // only a human authorizes (no-directives)
      body: { type: "authorization-grant", requestId, granted, ...(note ? { note } : {}) },
    };
    room.events.push(grant);
    return true;
  }

  async append(resource: string, by: { id: string; kind?: "human" | "persona" }, body: RoomEventVM["body"]): Promise<RoomEventVM> {
    let room = this.rooms.find((r) => r.resource === resource);
    if (!room) {
      room = { resource, events: [] };
      this.rooms.push(room);
    }
    const seq = room.events.length;
    const ev: RoomEventVM = { id: `evt-${seq}`, seq, weight: body.type === "retraction" ? -1 : 1, proposedBy: { id: by.id, kind: by.kind ?? "persona" }, body };
    room.events.push(ev);
    return ev;
  }

  async appendEvent(resource: string, by: { id: string; kind?: "human" | "persona" }, body: RoomEventVM["body"]): Promise<string | null> {
    return (await this.append(resource, by, body)).id;
  }
}
