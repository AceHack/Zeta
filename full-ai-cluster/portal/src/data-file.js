// full-ai-cluster/portal/src/data-file.ts
//
// FileRoomStore — durable Rooms on an append-only JSONL log, one file per Room
// (<namespace>~<name>.jsonl) under a directory mounted on a Longhorn volume.
// This is the persistent collaboration / agent-memory substrate (Memory
// Preservation #5): every Event is appended as one JSON line, never rewritten,
// so the log is replayable (DST) and a Z-set retraction is just another appended
// line. On startup we replay each file into memory; writes append to disk first,
// then update the in-memory view. Single-writer (the StatefulSet pod owns it).
import { appendFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const FILE_SUFFIX = ".jsonl";
const fileFor = (resource) => `${resource.replace("/", "~")}${FILE_SUFFIX}`;
const resourceOf = (file) => file.slice(0, -FILE_SUFFIX.length).replace("~", "/");
export class FileRoomStore {
    rooms = new Map();
    dir;
    constructor(dir) {
        this.dir = dir;
        mkdirSync(dir, { recursive: true });
        this.replay();
    }
    /** Load every <ns>~<name>.jsonl into memory (one Event per line). */
    replay() {
        for (const file of readdirSync(this.dir)) {
            if (!file.endsWith(FILE_SUFFIX))
                continue;
            const resource = resourceOf(file);
            const events = [];
            const raw = readFileSync(join(this.dir, file), "utf8");
            for (const line of raw.split("\n")) {
                const t = line.trim();
                if (!t)
                    continue;
                try {
                    events.push(JSON.parse(t));
                }
                catch {
                    // a torn final line (crash mid-append) — skip it; the log is otherwise intact
                }
            }
            this.rooms.set(resource, { resource, events });
        }
    }
    /** Append one Event to a Room's log (durable) and to the in-memory view. */
    appendEvent(resource, ev) {
        appendFileSync(join(this.dir, fileFor(resource)), JSON.stringify(ev) + "\n");
        const room = this.rooms.get(resource);
        if (room)
            room.events.push(ev);
        else
            this.rooms.set(resource, { resource, events: [ev] });
    }
    /** The next deterministic id/seq for a Room (length-based; single-writer). */
    nextSeq(resource) {
        return this.rooms.get(resource)?.events.length ?? 0;
    }
    // ── RoomSource ────────────────────────────────────────────────────────
    async listRooms() {
        return [...this.rooms.values()];
    }
    async getRoom(resource) {
        return this.rooms.get(resource);
    }
    async grant(resource, requestId, by, granted, note) {
        const room = this.rooms.get(resource);
        if (!room)
            return false;
        if (!room.events.some((e) => e.id === requestId && e.body.type === "authorization-request"))
            return false;
        const seq = this.nextSeq(resource);
        this.appendEvent(resource, {
            id: `evt-${seq}`,
            seq,
            weight: 1,
            proposedBy: { id: by, kind: "human" },
            authorizedBy: { id: by, kind: "human" }, // only a human authorizes (no-directives)
            body: { type: "authorization-grant", requestId, granted, ...(note ? { note } : {}) },
        });
        return true;
    }
    /**
     * Append a typed Event to a Room (the room-service write path the controller +
     * persona runtime use). `by` is the proposer; `kind` defaults to persona.
     * Returns the appended Event so the caller can reference its id.
     */
    async append(resource, by, body) {
        const seq = this.nextSeq(resource);
        const ev = { id: `evt-${seq}`, seq, weight: body.type === "retraction" ? -1 : 1, proposedBy: { id: by.id, kind: by.kind ?? "persona" }, body };
        this.appendEvent(resource, ev);
        return ev;
    }
}
