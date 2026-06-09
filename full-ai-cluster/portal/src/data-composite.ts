// full-ai-cluster/portal/src/data-composite.ts
//
// CompositePlatform — resources from one source, Rooms from another. Lets the
// durable FileRoomStore pair with EITHER live k8s resources (in-cluster) or
// seeded demo resources (local dev), without each room backend re-implementing
// resource reads. The room write-path (grant/append) is delegated to the
// RoomSource, so durability is decided purely by which RoomSource is injected.

import type { PlatformData } from "./api.ts";
import type { RoomSource } from "./data-k8s.ts";
import type { BlueprintCR, DeployableCR, RoomData, RoomEventVM } from "./viewmodel.ts";

export interface ResourceSource {
  listDeployables(): Promise<DeployableCR[]>;
  listBlueprints(): Promise<BlueprintCR[]>;
}

export class CompositePlatform implements PlatformData {
  constructor(private resources: ResourceSource, private rooms: RoomSource) {}

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
