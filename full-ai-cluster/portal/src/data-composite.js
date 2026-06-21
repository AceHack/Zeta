// full-ai-cluster/portal/src/data-composite.ts
//
// CompositePlatform — resources from one source, Rooms from another. Lets the
// durable FileRoomStore pair with EITHER live k8s resources (in-cluster) or
// seeded demo resources (local dev), without each room backend re-implementing
// resource reads. The room write-path (grant/append) is delegated to the
// RoomSource, so durability is decided purely by which RoomSource is injected.
import { roomBytes } from "./memory-usage.js";
export class CompositePlatform {
    resources;
    rooms;
    ops;
    constructor(resources, rooms, ops) {
        this.resources = resources;
        this.rooms = rooms;
        if (ops !== undefined)
            this.ops = ops;
    }
    async memoryUsage() {
        const all = await this.rooms.listRooms();
        const rooms = all.map((r) => ({ resource: r.resource, events: r.events.length, bytes: roomBytes(r) }));
        return { rooms, totalEvents: rooms.reduce((n, r) => n + r.events, 0), totalBytes: rooms.reduce((n, r) => n + r.bytes, 0) };
    }
    listDeployables() {
        return this.resources.listDeployables();
    }
    listBlueprints() {
        return this.resources.listBlueprints();
    }
    listRooms() {
        return this.rooms.listRooms();
    }
    getRoom(resource) {
        return this.rooms.getRoom(resource);
    }
    grant(resource, requestId, by, granted, note) {
        return this.rooms.grant(resource, requestId, by, granted, note);
    }
    async appendEvent(resource, by, body) {
        if (!this.rooms.append)
            return null;
        return (await this.rooms.append(resource, by, body)).id;
    }
}
