// full-ai-cluster/portal/src/data-file.test.ts
//
// FileRoomStore durability: appends persist to JSONL, a FRESH store on the same
// directory replays them (survives a "restart"), grants persist, and a torn
// final line (crash mid-append) is tolerated without losing the rest.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileRoomStore } from "./data-file.js";
let dir;
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "zeta-rooms-"));
});
afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});
describe("FileRoomStore durability", () => {
    test("appended events persist and a fresh store replays them (restart-survival)", async () => {
        const s1 = new FileRoomStore(dir);
        await s1.append("acme/clan", { id: "system" }, { type: "state-change", phase: "Running" });
        await s1.append("acme/clan", { id: "otto" }, { type: "authorization-request", gated: "budget", action: { summary: "bump mem" } });
        // a brand-new store on the SAME dir == a pod restart re-binding the volume
        const s2 = new FileRoomStore(dir);
        const room = await s2.getRoom("acme/clan");
        expect(room?.events.length).toBe(2);
        expect(room?.events[0].body.type).toBe("state-change");
        expect(room?.events[1].id).toBe("evt-1");
    });
    test("grant persists across a restart and clears the pending request", async () => {
        const s1 = new FileRoomStore(dir);
        await s1.append("acme/clan", { id: "otto" }, { type: "authorization-request", gated: "budget", action: { summary: "x" } });
        const okBad = await s1.grant("acme/clan", "evt-999", "aaron", true);
        expect(okBad).toBe(false); // unknown request
        const ok = await s1.grant("acme/clan", "evt-0", "aaron", true, "approved");
        expect(ok).toBe(true);
        const s2 = new FileRoomStore(dir);
        const room = await s2.getRoom("acme/clan");
        expect(room?.events.length).toBe(2);
        const grant = room.events[1];
        expect(grant.body).toMatchObject({ type: "authorization-grant", requestId: "evt-0", granted: true });
        expect(grant.authorizedBy).toEqual({ id: "aaron", kind: "human" }); // human-authored
    });
    test("each room is its own file; listRooms returns all", async () => {
        const s = new FileRoomStore(dir);
        await s.append("acme/clan", { id: "otto" }, { type: "message", text: "hi" });
        await s.append("beta/raid", { id: "lior" }, { type: "message", text: "yo" });
        expect(existsSync(join(dir, "acme~clan.jsonl"))).toBe(true);
        expect(existsSync(join(dir, "beta~raid.jsonl"))).toBe(true);
        const rooms = await s.listRooms();
        expect(rooms.map((r) => r.resource).sort()).toEqual(["acme/clan", "beta/raid"]);
    });
    test("a torn final line (crash mid-append) is skipped; prior events survive", async () => {
        const s1 = new FileRoomStore(dir);
        await s1.append("acme/clan", { id: "otto" }, { type: "message", text: "intact" });
        // simulate a half-written final line
        appendFileSync(join(dir, "acme~clan.jsonl"), '{"id":"evt-1","seq":1,"weig');
        const s2 = new FileRoomStore(dir);
        const room = await s2.getRoom("acme/clan");
        expect(room?.events.length).toBe(1); // the torn line dropped, the good one kept
        expect(room?.events[0].body.type).toBe("message");
    });
    test("retraction is appended with weight -1", async () => {
        const s = new FileRoomStore(dir);
        await s.append("acme/clan", { id: "otto" }, { type: "message", text: "oops" });
        const ret = await s.append("acme/clan", { id: "otto" }, { type: "retraction", retracts: "evt-0" });
        expect(ret.weight).toBe(-1);
        const persisted = readFileSync(join(dir, "acme~clan.jsonl"), "utf8").trim().split("\n");
        expect(persisted.length).toBe(2);
    });
});
