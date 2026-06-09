// full-ai-cluster/portal/src/data-memory.ts
//
// An in-memory PlatformData — for local dev and tests, and the seam the real
// k8s/git-event-store backend slots into. Holds Deployables, Blueprints, and
// Rooms; grant() appends a human authorization-grant event to a Room (the only
// write the portal performs). Deterministic: event seq derives from length.

import type { PlatformData } from "./api.ts";
import type { BlueprintCR, DeployableCR, RoomData, RoomEventVM } from "./viewmodel.ts";

export class InMemoryPlatform implements PlatformData {
  constructor(
    private deployables: DeployableCR[] = [],
    private blueprints: BlueprintCR[] = [],
    private rooms: RoomData[] = [],
  ) {}

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
}
