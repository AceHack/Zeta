/**
 * src/Core.TypeScript/observe/event-sink-folder.test.ts — the real folder-direct-to-main sink.
 *
 * No real git: `commit` is injected with a fake. Writes go to a real temp dir.
 * Verifies the fact envelope shape + ZetaId identity (Category.WorkItem) +
 * idempotency (EEXIST = ok, G-Set) + Result discipline (write/commit failure →
 * ok:false, never throws) + composition with `execute`.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unpack, DETERMINISTIC_ENV } from "../zeta-id/zeta-id";
import { Category, type ZetaId } from "../zeta-id/types";
import { execute } from "./execute";
import {
  coauthorFor,
  folderSink,
  gitCommitToMain,
  mintObserveEventIdHex,
  type CommitOutcome,
  type EventEnvelope,
} from "./event-sink-folder";
import type { NextAction, World } from "./observe";

let dir: string;
let committed: { path: string; envelope: EventEnvelope }[];
const okCommit = (path: string, envelope: EventEnvelope): CommitOutcome => {
  committed.push({ path, envelope });
  return { ok: true };
};
const FIXED = Date.UTC(2026, 4, 31, 12, 0, 0); // 2026-05-31T12:00:00.000Z

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "observe-events-"));
  committed = [];
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const freeTime: NextAction = { kind: "free_time", reason: "rest" };

/**
 * Canonical ids — the only thing the sink accepts as a path segment.
 *
 * These were `"a".repeat(32)` etc: 32 valid hex characters that do NOT decode as ZetaIds
 * (`"a".repeat(32)` is version 21, `"1".repeat(32)` is version 2). They passed only while
 * `isCanonicalEventId` was a bare `/^[0-9a-f]{32}$/`. It now decodes, so the fixtures mint
 * real ids — `DETERMINISTIC_ENV` keeps them reproducible (DST), the per-character
 * timestamp keeps them distinct.
 */
const ID = (c: string): string => mintObserveEventIdHex(DETERMINISTIC_ENV, 1_700_000_000_000 + (c.codePointAt(0) ?? 0));
const ID_A = ID("a");
const ID_DUP = ID("d");
const ID_CLASH = ID("c");
const ID_FAILC = ID("e");
const ID_WRITEF = ID("f");

describe("folderSink — write the fact envelope + commit", () => {
  it("writes <eventDir>/<id>.json and commits it; returns ok + eventId", async () => {
    const sink = folderSink({ eventDir: dir, by: "otto-cli", mint: () => ID_A, now: () => FIXED, commit: okCommit });
    const r = await sink.append(freeTime);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventId).toBe(ID_A);
    expect(committed).toHaveLength(1);
    expect(committed[0]?.path).toBe(join(dir, `${ID_A}.json`));

    const env = JSON.parse(readFileSync(join(dir, `${ID_A}.json`), "utf-8")) as EventEnvelope;
    expect(env).toEqual({ id: ID_A, at: "2026-05-31T12:00:00.000Z", by: "otto-cli", action: freeTime });
  });

  it("is idempotent: same id + same content appended twice → both ok (EEXIST no-op, G-Set)", async () => {
    const sink = folderSink({ eventDir: dir, by: "otto-cli", mint: () => ID_DUP, now: () => FIXED, commit: okCommit });
    const a = await sink.append(freeTime);
    const b = await sink.append(freeTime);
    expect(a.ok && b.ok).toBe(true);
  });

  it("rejects a same-id collision with DIFFERENT content (not a silent no-op)", async () => {
    const sink = folderSink({
      eventDir: dir,
      by: "otto-cli",
      mint: () => ID_CLASH,
      now: () => FIXED,
      commit: okCommit,
    });
    const first = await sink.append(freeTime);
    const second = await sink.append({ kind: "self_reflect", reason: "different action, same id" });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toContain("collision");
  });

  it("rejects a non-canonical id (path-traversal / reserved-name guard; never writes outside)", async () => {
    for (const evil of ["../outside", "con", "not-hex", "AAAA", "a".repeat(31)]) {
      const sink = folderSink({ eventDir: dir, by: "otto-cli", mint: () => evil, now: () => FIXED, commit: okCommit });
      const r = await sink.append(freeTime);
      expect(r.ok).toBe(false);
      expect(committed).toHaveLength(0); // never wrote, never committed
    }
  });

  it("surfaces a commit failure as ok:false (never throws)", async () => {
    const failCommit = (): CommitOutcome => ({ ok: false, reason: "not on main" });
    const sink = folderSink({
      eventDir: dir,
      by: "otto-cli",
      mint: () => ID_FAILC,
      now: () => FIXED,
      commit: failCommit,
    });
    const r = await sink.append(freeTime);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not on main");
    // the event did NOT land → the written file is removed (not left for loadWorld to half-read)
    expect(existsSync(join(dir, `${ID_FAILC}.json`))).toBe(false);
  });

  it("surfaces a write failure as ok:false (unwritable dir, never throws)", async () => {
    const sink = folderSink({
      eventDir: "/dev/null/cannot-create",
      by: "otto-cli",
      mint: () => ID_WRITEF,
      now: () => FIXED,
      commit: okCommit,
    });
    const r = await sink.append(freeTime);
    expect(r.ok).toBe(false);
    expect(committed).toHaveLength(0); // never reached commit
  });

  it("does NOT delete a pre-existing durable event when a later append's commit fails (G-Set P0)", async () => {
    const ID_DUR = ID("1");
    // 1) land the event durably (commit ok)
    await folderSink({ eventDir: dir, by: "otto-cli", mint: () => ID_DUR, now: () => FIXED, commit: okCommit }).append(
      freeTime,
    );
    expect(existsSync(join(dir, `${ID_DUR}.json`))).toBe(true);
    // 2) a second append of the SAME id whose commit fails must NOT delete the pre-existing file
    const failCommit = (): CommitOutcome => ({ ok: false, reason: "not on main" });
    const r = await folderSink({
      eventDir: dir,
      by: "otto-cli",
      mint: () => ID_DUR,
      now: () => FIXED,
      commit: failCommit,
    }).append(freeTime);
    expect(r.ok).toBe(false);
    expect(existsSync(join(dir, `${ID_DUR}.json`))).toBe(true); // durable event preserved
  });

  it("a THROWING injected commit → ok:false AND removes the file we created (P1)", async () => {
    const ID_THROW = ID("2");
    const throwCommit = (): CommitOutcome => {
      throw new Error("boom");
    };
    const r = await folderSink({
      eventDir: dir,
      by: "otto-cli",
      mint: () => ID_THROW,
      now: () => FIXED,
      commit: throwCommit,
    }).append(freeTime);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("append failed");
    expect(existsSync(join(dir, `${ID_THROW}.json`))).toBe(false); // our half-written file cleaned up
  });

  it("converts an injected throw (now()=NaN) to ok:false, never throws (Result-only contract)", async () => {
    const sink = folderSink({
      eventDir: dir,
      by: "otto-cli",
      mint: () => ID_A,
      now: () => Number.NaN,
      commit: okCommit,
    });
    const r = await sink.append(freeTime); // new Date(NaN).toISOString() throws inside append
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("append failed");
  });
});

describe("mintObserveEventIdHex — stable WorkItem-category identity", () => {
  it("mints a 32-hex id tagged Category.WorkItem", () => {
    const id = mintObserveEventIdHex();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(unpack(BigInt(`0x${id}`) as ZetaId).category).toBe(Category.WorkItem);
  });

  it("two mints are distinct (crypto env)", () => {
    expect(mintObserveEventIdHex()).not.toBe(mintObserveEventIdHex());
  });
});

describe("folderSink composes with execute (the real adapter end-to-end)", () => {
  it("execute(free_time, folderSink) appends the event + transitions mode", async () => {
    const world: World = { backlog: [] };
    const ID_EXEC = ID("b");
    const sink = folderSink({ eventDir: dir, by: "otto-cli", mint: () => ID_EXEC, now: () => FIXED, commit: okCommit });
    const r = await execute(world, freeTime, sink);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.world.mode).toBe("free_time");
      expect(r.eventId).toBe(ID_EXEC);
    }
    // the durable event landed (one file, one commit)
    expect(committed).toHaveLength(1);
    const env = JSON.parse(readFileSync(join(dir, `${ID_EXEC}.json`), "utf-8")) as EventEnvelope;
    expect(env.action).toEqual(freeTime);
  });
});

describe("coauthorFor — harness-specific trailer from the acting agent (shared sink)", () => {
  it("maps each surface to its trailer; falls back to naming the sender", () => {
    expect(coauthorFor("otto-cli")).toBe("Co-Authored-By: Claude <noreply@anthropic.com>");
    expect(coauthorFor("alexa-kiro")).toBe("Co-Authored-By: Kiro <noreply@kiro.dev>");
    expect(coauthorFor("riven-cursor")).toBe("Co-Authored-By: Grok <noreply@x.ai>");
    expect(coauthorFor("vera-codex")).toBe("Co-Authored-By: Codex <noreply@openai.com>");
    expect(coauthorFor("lior-antigravity")).toBe("Co-Authored-By: Gemini <noreply@google.com>");
    expect(coauthorFor("addison")).toBe("Co-Authored-By: addison <noreply@zeta.local>");
    // bare-prefix near-misses must NOT be mis-stamped (exact-or-hyphen only)
    expect(coauthorFor("ottobot")).toBe("Co-Authored-By: ottobot <noreply@zeta.local>");
    expect(coauthorFor("liorx")).toBe("Co-Authored-By: liorx <noreply@zeta.local>");
  });
});

describe("gitCommitToMain — exported (real default; not run here)", () => {
  it("is a function (real git path is exercised by the runtime, not unit tests)", () => {
    expect(typeof gitCommitToMain).toBe("function");
  });
});

describe("folderSink — entropy tracker wiring", () => {
  // Importing the entropy tracker here to test the integration
  const { createEntropyTracker } = require("../algebra/entropy-tracker") as typeof import("../algebra/entropy-tracker");

  it("when entropy tracker is wired, each append stamps {entropy_state, entropy_heat} on the envelope", async () => {
    const tracker = createEntropyTracker();
    // Simulate some prior computation: 3 branches (3 bits of uncertainty)
    tracker.branch();
    tracker.branch();
    tracker.branch();
    // State before append: entropy_state=3, entropy_heat=0

    const ID_ENT = ID("3");
    const sink = folderSink({
      eventDir: dir,
      by: "alexa",
      mint: () => ID_ENT,
      now: () => FIXED,
      commit: okCommit,
      entropy: tracker,
    });
    const r = await sink.append(freeTime);
    expect(r.ok).toBe(true);

    // The append is NOT a measurement (corrected 2026-08-14). It adds a fact to an append-only
    // log: the post-state contains the event, so the pre-state is the post-state minus it, and a
    // re-append of the same id is the identity — both injective, so the derived charge is 0
    // (`APPEND_ONLY_ERASURE_BITS`). The old `measure(1)` was a literal justified by a collapse
    // that happens upstream, in the chooser, which this sink never sees. Ledger unchanged:
    // entropy_state stays 3, entropy_heat stays 0.
    const env = JSON.parse(readFileSync(join(dir, `${ID_ENT}.json`), "utf-8")) as EventEnvelope;
    expect(env.entropy).toBeDefined();
    expect(env.entropy?.entropy_state).toBe(3);
    expect(env.entropy?.entropy_heat).toBe(0);
  });

  it("appends pay nothing, at any count — an append-only log erases nothing", async () => {
    const tracker = createEntropyTracker();
    tracker.branch();
    tracker.branch();
    tracker.branch();
    tracker.branch(); // 4 bits

    let callCount = 0;
    // Distinct real ids per call (was `"4".repeat(31) + n` — valid hex, not a ZetaId).
    const mintSeq = () => mintObserveEventIdHex(DETERMINISTIC_ENV, 1_700_000_000_000 + callCount++);
    const sink = folderSink({
      eventDir: dir,
      by: "alexa",
      mint: mintSeq,
      now: () => FIXED,
      commit: okCommit,
      entropy: tracker,
    });

    await sink.append(freeTime);
    await sink.append({ kind: "explore", reason: "fwd" });

    expect(tracker.state.entropy_heat).toBe(0);
    expect(tracker.state.hard_measurements).toBe(0);
    // And the deficit the old literal created is gone: nothing is erased that was never admitted.
    // (entropy-tracker.ts header named this sink as one of the two callers driving that negative.)
    expect(tracker.state.entropy_state).toBe(4);
    expect(tracker.state.bits_erased).toBe(0);
    expect(tracker.state.second_law_satisfied).toBe(true);
  });

  it("a caller that KNOWS the menu size charges the real erasure: log2(N), not 1", async () => {
    const tracker = createEntropyTracker();
    const ID_DEC = ID("7");
    const sink = folderSink({
      eventDir: dir,
      by: "alexa",
      mint: () => ID_DEC,
      now: () => FIXED,
      commit: okCommit,
      entropy: tracker,
      // observe.ts `buildMenu` produced 8 candidates and exactly one was recorded.
      decisionCandidates: () => 8,
    });
    const result = await sink.append(freeTime);

    expect(result.ok).toBe(true);
    expect(tracker.state.entropy_heat).toBe(3); // log2(8) — three times the literal that shipped
    expect(tracker.state.hard_measurements).toBe(1);
  });

  it("a declared menu of one is not a decision, and is charged as one: zero", async () => {
    const tracker = createEntropyTracker();
    const ID_ONE = ID("8");
    const sink = folderSink({
      eventDir: dir,
      by: "alexa",
      mint: () => ID_ONE,
      now: () => FIXED,
      commit: okCommit,
      entropy: tracker,
      decisionCandidates: () => 1,
    });
    const result = await sink.append(freeTime);

    expect(result.ok).toBe(true);
    expect(tracker.state.entropy_heat).toBe(0);
    expect(tracker.state.hard_measurements).toBe(0);
  });

  it("without entropy tracker, envelope has no entropy field (backward-compatible)", async () => {
    const ID_NO = ID("5");
    const sink = folderSink({
      eventDir: dir,
      by: "otto-cli",
      mint: () => ID_NO,
      now: () => FIXED,
      commit: okCommit,
      // no entropy tracker
    });
    await sink.append(freeTime);
    const env = JSON.parse(readFileSync(join(dir, `${ID_NO}.json`), "utf-8")) as EventEnvelope;
    expect(env.entropy).toBeUndefined();
  });

  it("composes with execute: entropy is stamped on the appended event end-to-end", async () => {
    const tracker = createEntropyTracker();
    tracker.branch();
    tracker.branch(); // 2 bits uncertainty

    const ID_E2E = ID("6");
    const sink = folderSink({
      eventDir: dir,
      by: "alexa",
      mint: () => ID_E2E,
      now: () => FIXED,
      commit: okCommit,
      entropy: tracker,
    });
    const world: World = { backlog: [] };
    const r = await execute(world, freeTime, sink);
    expect(r.ok).toBe(true);

    const env = JSON.parse(readFileSync(join(dir, `${ID_E2E}.json`), "utf-8")) as EventEnvelope;
    // Unchanged by the append: recording a fact is not erasing one.
    expect(env.entropy).toEqual({ entropy_state: 2, entropy_heat: 0 });
  });
});
