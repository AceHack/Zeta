/**
 * cost-ledger.test.ts — the money is counted once, attributed, and never invented.
 *
 * The failures these pin are the ones that made 2026-09-11 unaccountable: a spend with no record, a
 * total that double-counts a retried run, and a call whose cost is unknown quietly reading as zero.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { foldCost, readCostDir, renderCost, type CostLine } from "./cost-ledger";

const NL = String.fromCharCode(10);

const line = (over: Partial<CostLine>): CostLine => ({
  at: "2026-09-11T10:00:00.000Z",
  org: "acme",
  profile: "dev-portal",
  workId: "task-012",
  hat: "backend_implementer",
  mode: "work",
  model: "claude-opus-5",
  sessionId: "s1",
  costUsd: 1,
  inputTokens: 10,
  outputTokens: 20,
  cacheReadTokens: 30,
  cacheWriteTokens: 40,
  reason: "a comment was left",
  ...over,
});

describe("A DAY IS COUNTED ONCE, HOWEVER MANY TIMES IT IS READ", () => {
  test("the same session appended twice is one call and one charge", () => {
    // A run that is retried writes its calls again, and a person folding a ledger twice must not be
    // told the organization spent twice. The session id is the key, so folding is idempotent.
    const fold = foldCost([line({}), line({}), line({ sessionId: "s2", costUsd: 2 })]);
    expect(fold.total.calls).toBe(2);
    expect(fold.total.usd).toBe(3);
    expect(fold.duplicates).toBe(1);
  });

  test("a call whose cost the harness did not report is COUNTED and SAID, never read as free", () => {
    const fold = foldCost([line({ sessionId: "a", costUsd: 1 }), line({ sessionId: "b", costUsd: null })]);
    expect(fold.total.usd).toBe(1);
    expect(fold.total.calls).toBe(2);
    expect(fold.withoutCost).toBe(1);
    expect(renderCost(fold)).toContain("reported no cost figure");
  });

  test("a cost that is not a number cannot poison the total - it is counted as unknown", () => {
    // A ledger is whatever was appended, including by a future writer that got the field wrong. One
    // bad value must not turn a day's total into NaN and make the whole record unreadable.
    const bad = { ...line({ sessionId: "b" }), costUsd: "lots" } as unknown as CostLine;
    const fold = foldCost([line({ sessionId: "a", costUsd: 3 }), bad]);
    expect(fold.total.usd).toBe(3);
    expect(Number.isNaN(fold.total.usd)).toBe(false);
    expect(fold.withoutCost).toBe(1);
  });

  test("a line with no session id still counts - an unkeyed call is money that was spent", () => {
    const fold = foldCost([line({ sessionId: null }), line({ sessionId: null })]);
    expect(fold.total.calls).toBe(2);
    expect(fold.total.usd).toBe(2);
  });
});

describe("EVERY DOLLAR SAYS WHERE IT WENT AND WHAT IT WAS ANSWERING", () => {
  test("the fold attributes by work item, hat, mode, model, profile and reason", () => {
    const fold = foldCost([
      line({ sessionId: "a", costUsd: 10, hat: "backend_implementer", mode: "work", model: "claude-opus-5", workId: "task-012", reason: "a comment was left" }),
      line({ sessionId: "b", costUsd: 1, hat: "release_manager", mode: "describe", model: "claude-sonnet-5", workId: "task-040", reason: "the request was opened" }),
    ]);
    expect(fold.byWork.get("task-012")?.usd).toBe(10);
    expect(fold.byHat.get("release_manager")?.usd).toBe(1);
    expect(fold.byMode.get("describe")?.calls).toBe(1);
    expect(fold.byModel.get("claude-opus-5")?.usd).toBe(10);
    expect(fold.byProfile.get("dev-portal")?.usd).toBe(11);
    // WHY, not only how much. A total nobody can account for is the thing this replaces.
    expect(fold.byReason.get("a comment was left")?.usd).toBe(10);
  });

  test("a field the recorder could not fill is named as unstated rather than dropped", () => {
    // A field the writer never filled is ABSENT, not null - both must read as unstated.
    const { reason: _neverFilled, ...noReason } = line({ sessionId: "a", workId: null });
    const fold = foldCost([noReason]);
    expect(fold.byWork.get("(not stated)")?.calls).toBe(1);
    expect(fold.byReason.get("(not stated)")?.calls).toBe(1);
  });

  test("the report shows the reasons only when they are asked for", () => {
    const fold = foldCost([line({})]);
    expect(renderCost(fold)).not.toContain("by reason the run was started");
    expect(renderCost(fold, { reasons: true })).toContain("by reason the run was started");
  });
});

describe("READING A STORE'S LEDGER", () => {
  test("days are bounded by name, a malformed line is reported rather than fatal, and a missing ledger is empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "cost-read-"));
    try {
      const cost = join(dir, "cost");
      mkdirSync(cost, { recursive: true });
      writeFileSync(join(cost, "2026-09-10.jsonl"), JSON.stringify(line({ sessionId: "old", costUsd: 5 })) + NL);
      writeFileSync(
        join(cost, "2026-09-11.jsonl"),
        JSON.stringify(line({ sessionId: "new", costUsd: 7 })) + NL + "{ this is not json" + NL,
      );

      const all = readCostDir(cost);
      expect(all.lines.length).toBe(2);
      expect(all.unreadable).toBe(1);

      const bounded = readCostDir(cost, "2026-09-11");
      expect(bounded.lines.length).toBe(1);
      expect(foldCost(bounded.lines).total.usd).toBe(7);

      const until = readCostDir(cost, undefined, "2026-09-10");
      expect(foldCost(until.lines).total.usd).toBe(5);

      // A store that has never run has no ledger, and that is an empty answer, not an error.
      expect(readCostDir(join(dir, "nothing-here")).lines.length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
