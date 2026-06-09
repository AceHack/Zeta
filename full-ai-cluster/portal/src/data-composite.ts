// full-ai-cluster/portal/src/data-composite.ts
//
// CompositePlatform — resources from one source, Rooms from another. Lets the
// durable FileRoomStore pair with EITHER live k8s resources (in-cluster) or
// seeded demo resources (local dev), without each room backend re-implementing
// resource reads. The room write-path (grant/append) is delegated to the
// RoomSource, so durability is decided purely by which RoomSource is injected.

import type { PlatformData } from "./api.ts";
import type { RoomSource } from "./data-k8s.ts";
import type { MemoryUsage, ResourceOps } from "./ops.ts";
import { roomBytes } from "./memory-usage.ts";
import type { BlueprintCR, DeployableCR, RoomData, RoomEventVM } from "./viewmodel.ts";

export interface ResourceSource {
  listDeployables(): Promise<DeployableCR[]>;
  listBlueprints(): Promise<BlueprintCR[]>;
}

export class CompositePlatform implements PlatformData {
  private resources: ResourceSource;
  private rooms: RoomSource;
  readonly ops?: ResourceOps;
  constructor(resources: ResourceSource, rooms: RoomSource, ops?: ResourceOps) {
    this.resources = resources;
    this.rooms = rooms;
    if (ops !== undefined) this.ops = ops;
  }

  async memoryUsage(): Promise<MemoryUsage> {
    const all = await this.rooms.listRooms();
    const rooms = all.map((r) => ({ resource: r.resource, events: r.events.length, bytes: roomBytes(r) }));
    return { rooms, totalEvents: rooms.reduce((n, r) => n + r.events, 0), totalBytes: rooms.reduce((n, r) => n + r.bytes, 0) };
  }

  listDeployables(): Promise<DeployableCR[]> {
    return this.resources.listDeployables();
  }
  listBlueprints(): Promise<BlueprintCR[]> {
    return this.resources.listBlueprints();
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
  async appendEvent(resource: string, by: { id: string; kind?: "human" | "persona" }, body: RoomEventVM["body"]): Promise<string | null> {
    if (!this.rooms.append) return null;
    return (await this.rooms.append(resource, by, body)).id;
  }
}
