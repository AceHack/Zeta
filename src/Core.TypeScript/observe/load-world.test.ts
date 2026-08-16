/**
 * src/Core.TypeScript/observe/load-world.test.ts — the real World snapshot (read side of the loop).
 *
 * Backlog channel is injected (so no real repo backlog needed); mode channel reads
 * real event JSON from a temp dir (the schema-on-read fold). Closes-the-loop test:
 * loadWorld → observe returns the persisted mode.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWorld as loadWorldReal, readEventActions } from "./load-world";
import { observe, type BacklogItem, type NextAction } from "./observe";
import { defaultNodeSession } from "./first-session";
import { mintObserveEventIdHex } from "./event-sink-folder";
import { DETERMINISTIC_ENV } from "../zeta-id/zeta-id";

function loadWorld(opts: Parameters<typeof loadWorldReal>[0]): ReturnType<typeof loadWorldReal> {
  return loadWorldReal({
    nodeSession: { session: { ...defaultNodeSession(), complete: true } },
    ...opts,
  });
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "loadworld-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/**
 * A distinct, stable, GENUINELY DECODABLE id per key character.
 *
 * This was `c.repeat(32)` — 32 valid hex characters that are not ZetaIds (`"a".repeat(32)`
 * decodes to version 21; `"1".repeat(32)` to version 2). Those fixtures passed only while
 * the reader's id check was a bare `/^[0-9a-f]{32}$/`; the reader now decodes, so the
 * fixtures mint real ids. `DETERMINISTIC_ENV` keeps them reproducible (DST) and the
 * per-character timestamp keeps them distinct.
 */
const ID = (c: string): string => mintObserveEventIdHex(DETERMINISTIC_ENV, 1_700_000_000_000 + (c.codePointAt(0) ?? 0));
function writeEvent(id: string, at: string, action: NextAction): void {
  writeFileSync(join(dir, `${id}.json`), `${JSON.stringify({ id, at, by: "otto-cli", action }, null, 2)}\n`);
}
const item: BacklogItem = { id: "B-1", title: "x", ready: true, ambiguous: false };

describe("readEventActions — schema-on-read, deterministic order", () => {
  it("returns [] for a missing dir", () => {
    expect(readEventActions(join(dir, "nope"))).toEqual([]);
  });

  it("orders events by at then id (replayable)", () => {
    writeEvent(ID("b"), "2026-05-31T00:00:02.000Z", { kind: "self_reflect", reason: "later" });
    writeEvent(ID("a"), "2026-05-31T00:00:01.000Z", { kind: "free_time", reason: "earlier" });
    expect(readEventActions(dir).map((a) => a.kind)).toEqual(["free_time", "self_reflect"]);
  });

  it("skips malformed files, non-canonical ids, unknown kinds, and ill-shaped payloads", () => {
    writeFileSync(join(dir, "bad.json"), "{not json");
    writeFileSync(
      join(dir, `${ID("c")}.json`),
      JSON.stringify({ id: "short", at: "t", action: { kind: "free_time", reason: "x" } }),
    );
    writeFileSync(
      join(dir, `${ID("d")}.json`),
      JSON.stringify({ id: ID("d"), at: "t", action: { kind: "bogus_kind" } }),
    );
    // canonical id + known kind but NO item — would throw in simulate; must be skipped
    writeFileSync(join(dir, `${ID("9")}.json`), JSON.stringify({ id: ID("9"), at: "t", action: { kind: "do_item" } }));
    // known reason-kind but no reason — skipped
    writeFileSync(
      join(dir, `${ID("8")}.json`),
      JSON.stringify({ id: ID("8"), at: "t", action: { kind: "free_time" } }),
    );
    writeEvent(ID("e"), "2026-05-31T00:00:01.000Z", { kind: "free_time", reason: "ok" });
    expect(readEventActions(dir).map((a) => a.kind)).toEqual(["free_time"]);
  });

  it("recurses into date-partitioned subdirs (YYYY/MM/DD/{id}.json)", () => {
    const day = join(dir, "2026", "05", "31");
    mkdirSync(day, { recursive: true });
    writeFileSync(
      join(day, `${ID("a")}.json`),
      JSON.stringify({
        id: ID("a"),
        at: "2026-05-31T00:00:01.000Z",
        by: "otto-cli",
        action: { kind: "self_reflect", reason: "deep" },
      }),
    );
    expect(readEventActions(dir).map((a) => a.kind)).toEqual(["self_reflect"]);
  });

  it("folds a do_item event over empty backlog without throwing (payload validated upstream)", () => {
    writeEvent(ID("a"), "2026-05-31T00:00:01.000Z", { kind: "do_item", item });
    // do_item is a valid payload (has item.id) → fold(do_item) sets mode "work", no throw
    expect(() => readEventActions(dir)).not.toThrow();
    const w = loadWorld({ eventDir: dir, nextAction: () => ({ kind: "free_time", reason: "x" }) });
    expect(w.mode).toBe("work");
  });
});

describe("loadWorld — backlog channel (selector) + mode channel (fold)", () => {
  it("do_item selection → backlog = [that item]; empty log → mode unset", () => {
    const w = loadWorld({ eventDir: dir, nextAction: () => ({ kind: "do_item", item }) });
    expect(w.backlog).toEqual([item]);
    expect(w.mode).toBeUndefined();
    expect(w.operator).toBeUndefined();
  });

  it("free_time selection (empty/blocked backlog) → empty backlog", () => {
    const w = loadWorld({ eventDir: dir, nextAction: () => ({ kind: "free_time", reason: "nothing ready" }) });
    expect(w.backlog).toEqual([]);
  });

  it("mode = the last (by at) mode-setting event in the log", () => {
    writeEvent(ID("a"), "2026-05-31T00:00:01.000Z", { kind: "free_time", reason: "rest" });
    writeEvent(ID("b"), "2026-05-31T00:00:02.000Z", { kind: "self_reflect", reason: "journal" });
    const w = loadWorld({ eventDir: dir, nextAction: () => ({ kind: "do_item", item }) });
    expect(w.mode).toBe("self_reflect");
  });

  it("wires the operator channel when provided", () => {
    const w = loadWorld({
      eventDir: dir,
      nextAction: () => ({ kind: "free_time", reason: "x" }),
      operator: { pendingMessage: true, pendingFerry: false },
    });
    expect(w.operator?.pendingMessage).toBe(true);
  });
});

describe("closes the loop: loadWorld → observe honors the persisted mode", () => {
  it("a self_reflect event in the log → observe returns self_reflect (work offered, not forced)", () => {
    writeEvent(ID("a"), "2026-05-31T00:00:01.000Z", { kind: "self_reflect", reason: "thinking" });
    // even with ready work available from the backlog channel, the persisted free mode wins
    const w = loadWorld({ eventDir: dir, nextAction: () => ({ kind: "do_item", item }) });
    expect(observe(w).kind).toBe("self_reflect");
  });

  it("empty log + ready work → observe returns the backlog pick (mode unset)", () => {
    const w = loadWorld({ eventDir: dir, nextAction: () => ({ kind: "do_item", item }) });
    const a = observe(w);
    expect(a.kind).toBe("do_item");
    if (a.kind === "do_item") expect(a.item.id).toBe("B-1");
  });
});
