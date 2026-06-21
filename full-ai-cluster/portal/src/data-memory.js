// full-ai-cluster/portal/src/data-memory.ts
//
// An in-memory PlatformData — for local dev and tests, and the seam the real
// k8s/git-event-store backend slots into. Holds Deployables, Blueprints, and
// Rooms; grant() appends a human authorization-grant event to a Room (the only
// write the portal performs). Deterministic: event seq derives from length.
import { DemoOps } from "./ops-demo.js";
import { roomBytes } from "./memory-usage.js";
export class InMemoryPlatform {
    ops = new DemoOps();
    deployables;
    blueprints;
    rooms;
    constructor(deployables = [], blueprints = [], rooms = []) {
        this.deployables = deployables;
        this.blueprints = blueprints;
        this.rooms = rooms;
    }
    async memoryUsage() {
        const rooms = this.rooms.map((r) => ({ resource: r.resource, events: r.events.length, bytes: roomBytes(r) }));
        return { rooms, totalEvents: rooms.reduce((n, r) => n + r.events, 0), totalBytes: rooms.reduce((n, r) => n + r.bytes, 0) };
    }
    /** Save a Blueprint into the catalog (the builder). Upserts by name. */
    async createBlueprint(bp) {
        const cr = {
            metadata: { name: bp.name, namespace: bp.namespace ?? "zeta-platform" },
            spec: { ...(bp.spec.category ? { category: bp.spec.category } : {}), image: bp.spec.image, stateful: bp.spec.stateful ?? !!bp.spec.storage, ...(bp.spec.defaultExpose ? { defaultExpose: bp.spec.defaultExpose } : {}), ...(bp.spec.variables ? { variables: bp.spec.variables } : {}) },
        };
        this.blueprints = [...this.blueprints.filter((b) => b.metadata.name !== bp.name), cr];
        return { ok: true, message: `Blueprint "${bp.name}" saved — it's now in the catalog and ready to deploy.` };
    }
    /**
     * Create a Deployable instance (the deploy write path). Upserts by ns/name and
     * lands it Running so the wizard's resource poll sees it become ready at once —
     * the demo stand-in for the controller rendering + reconciling the CR.
     */
    async createDeployable(d) {
        const ns = d.namespace ?? "zeta-platform";
        const s = d.spec;
        const cr = {
            metadata: { name: d.name, namespace: ns },
            spec: { blueprint: String(s.blueprint ?? ""), ...(s.expose ? { expose: s.expose } : {}), ...(s.host ? { host: s.host } : {}), ...(s.ai ? { ai: s.ai } : {}) },
            status: { phase: "Running" },
        };
        this.deployables = [...this.deployables.filter((x) => !(x.metadata.name === d.name && x.metadata.namespace === ns)), cr];
        return { ok: true, message: `Deployable "${d.name}" created in ${ns} — it's running and an agent is operating it.` };
    }
    async listDeployables() {
        return this.deployables;
    }
    async listBlueprints() {
        return this.blueprints;
    }
    async listRooms() {
        return this.rooms;
    }
    async getRoom(resource) {
        return this.rooms.find((r) => r.resource === resource);
    }
    async grant(resource, requestId, by, granted, note) {
        const room = this.rooms.find((r) => r.resource === resource);
        if (!room)
            return false;
        const req = room.events.find((e) => e.id === requestId && e.body.type === "authorization-request");
        if (!req)
            return false;
        const seq = room.events.length;
        const grant = {
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
    async append(resource, by, body) {
        let room = this.rooms.find((r) => r.resource === resource);
        if (!room) {
            room = { resource, events: [] };
            this.rooms.push(room);
        }
        const seq = room.events.length;
        const ev = { id: `evt-${seq}`, seq, weight: body.type === "retraction" ? -1 : 1, proposedBy: { id: by.id, kind: by.kind ?? "persona" }, body };
        room.events.push(ev);
        return ev;
    }
    async appendEvent(resource, by, body) {
        return (await this.append(resource, by, body)).id;
    }
}
