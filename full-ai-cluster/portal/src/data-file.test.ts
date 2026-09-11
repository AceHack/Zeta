// full-ai-cluster/portal/src/data-file.test.ts
//
// FileRoomStore durability: appends persist to JSONL, a FRESH store on the same
// directory replays them (survives a "restart"), grants persist, and a torn
// final line (crash mid-append) is tolerated without losing the rest.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileRoomStore } from "./data-file.ts";

let dir: string;
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
    expect(room?.events[0]!.body.type).toBe("state-change");
    expect(room?.events[1]!.id).toBe("evt-1");
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
    const grant = room!.events[1]!;
    expect(grant.body).toMatchObject({ type: "authorization-grant", requestId: "evt-0", granted: true });
    expect(grant.authorizedBy).toEqual({ id: "aaron", kind: "human" }); // human-authored
  });

  test("a resource that escapes the volume is REFUSED, and writes nothing", async () => {
    // The reachable form: `GET/POST /api/rooms/<seg>/events` runs
    // `decodeURIComponent` on `<seg>`, so `%2F` arrives here as a real `/`.
    // `replace("/", "~")` replaced the FIRST slash only, leaving the rest of the
    // path live, and `join(dir, ...)` resolved back out of the mounted volume.
    const s = new FileRoomStore(dir);
    const escape = "../../../../../../tmp/zeta-portal-traversal-probe";
    await expect(s.append(escape, { id: "otto" }, { type: "message", text: "x" })).rejects.toThrow(
      /refusing room resource/,
    );
    expect(existsSync("/tmp/zeta-portal-traversal-probe.jsonl")).toBe(false);
  });

  test("every non-label resource shape is refused, not normalised", async () => {
    const s = new FileRoomStore(dir);
    for (const bad of ["a/b/c", "acme/../etc", "acme/CLAN", "acme/cl an", "-acme/clan", "", "acme/", "ac~me/clan"]) {
      await expect(s.append(bad, { id: "otto" }, { type: "message", text: "x" })).rejects.toThrow(
        /refusing room resource/,
      );
    }
  });

  test("an actor id that is not an identifier is refused before it reaches the log", async () => {
    // `spec.ai.admin` from a Deployable CR reaches `proposedBy.id` through the
    // chat route with no check of its own (CodeQL alert 182). An identity in the
    // append-only log is quoted back as who proposed or authorized an event.
    const s = new FileRoomStore(dir);
    await expect(s.append("acme/clan", { id: "ot\nto" }, { type: "message", text: "x" })).rejects.toThrow(
      /refusing actor id/,
    );
    await expect(s.append("acme/clan", { id: "" }, { type: "message", text: "x" })).rejects.toThrow(/refusing actor id/);
    // `readdirSync(dir)`, not `existsSync(file)`: the directory listing says
    // "no file was created under ANY name", which is the stronger claim, and it
    // does not pair an existence CHECK with the read below on the same path
    // (the repo's own check-then-use lint, and the CWE-367 class it enforces).
    expect(readdirSync(dir)).toEqual([]); // nothing was written by either refusal

    // grant() reaches the log through a second door, so it gets its own guard.
    await s.append("acme/clan", { id: "otto" }, { type: "authorization-request", gated: "budget", action: { summary: "x" } });
    await expect(s.grant("acme/clan", "evt-0", "a/b", true)).rejects.toThrow(/refusing actor id/);
    const lines = readFileSync(join(dir, "acme~clan.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(1); // the request only — the refused grant appended nothing
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
    expect(room?.events[0]!.body.type).toBe("message");
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
