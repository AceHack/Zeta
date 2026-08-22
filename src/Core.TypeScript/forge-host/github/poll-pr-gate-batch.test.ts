// poll-pr-gate-batch.test.ts — DST coverage for the multi-PR refresh tool.
//
// Exercises the pure-function surface (`summarize`) and the orchestration
// boundary (`pollAllBounded` with injected `pollFn`) deterministically:
// no `gh` spawn, no network, no clock dependency. Output is reproducible
// across runs because every input is fixed and every random/time source
// is excluded by construction.
//
// Per the human maintainer 2026-05-01 (the rule this tool was written
// to satisfy): *"DST is bascically impossible there [in bash], not in ts."* These
// tests are the worked-example proof that a TS tool ported from a bash
// equivalent can carry DST grade-A coverage that the bash form
// structurally cannot.
//
// Runs via `bun test tools/github/poll-pr-gate-batch.test.ts`.

import { describe, expect, test } from "bun:test";
import {
  main,
  pollAllBounded,
  summarize,
  type BatchReport,
  type BatchSummary,
  type BusClaimsFn,
  type GateReport,
  type PollOutcome,
  type ReadPRStateFn,
} from "./poll-pr-gate-batch";
import type { ClaimRecord } from "../../bus/claim.ts";

// Fixed-shape factory keeps tests terse + deterministic. Every field
// has a default; tests override only what they're asserting on.
function mkReport(over: Partial<GateReport> = {}): GateReport {
  return {
    number: 1,
    state: "OPEN",
    gate: "CLEAN",
    checks: { ok: 5, inProgress: 0, pending: 0, failed: 0 },
    requiredChecks: { ok: 5, inProgress: 0, pending: 0, failed: 0 },
    unresolvedThreads: 0,
    autoMerge: "none",
    mergeCommit: null,
    warnings: [],
    nextAction: "none",
    ...over,
  };
}

describe("summarize", () => {
  test("empty input produces empty aggregates", () => {
    const s: BatchSummary = summarize([]);
    expect(s.byGate).toEqual({});
    expect(s.byNextAction).toEqual({});
    expect(s.byState).toEqual({});
    expect(s.actionable).toEqual([]);
    expect(s.warnings).toEqual([]);
  });

  test("counts each axis independently", () => {
    const s = summarize([
      mkReport({ number: 1, gate: "CLEAN", state: "MERGED", nextAction: "verify-merge" }),
      mkReport({ number: 2, gate: "BLOCKED", state: "OPEN", nextAction: "resolve-threads" }),
      mkReport({ number: 3, gate: "BLOCKED", state: "OPEN", nextAction: "wait-ci" }),
      mkReport({ number: 4, gate: "DIRTY", state: "OPEN", nextAction: "rebase" }),
    ]);
    expect(s.byGate).toEqual({ CLEAN: 1, BLOCKED: 2, DIRTY: 1 });
    expect(s.byNextAction).toEqual({
      "verify-merge": 1,
      "resolve-threads": 1,
      "wait-ci": 1,
      rebase: 1,
    });
    expect(s.byState).toEqual({ MERGED: 1, OPEN: 3 });
  });

  test("actionable excludes 'none' and 'verify-merge'", () => {
    // The actionable contract: a PR is actionable iff there's a
    // concrete next step the loop can take. MERGED PRs (nextAction
    // verify-merge) are terminal-success; CLOSED PRs (nextAction
    // none) are terminal-no-op. Both excluded from actionable.
    const s = summarize([
      mkReport({ number: 10, nextAction: "verify-merge" }),
      mkReport({ number: 11, nextAction: "none" }),
      mkReport({ number: 12, nextAction: "wait-ci" }),
      mkReport({ number: 13, nextAction: "resolve-threads" }),
      mkReport({ number: 14, nextAction: "rebase" }),
      mkReport({ number: 15, nextAction: "fix-failed-checks" }),
    ]);
    expect(s.actionable).toEqual([12, 13, 14, 15]);
  });

  test("warnings prefix per-PR with #N: marker", () => {
    const s = summarize([
      mkReport({ number: 100, warnings: ["non-required check failed: foo"] }),
      mkReport({ number: 101, warnings: ["non-required check failed: bar", "non-required check failed: baz"] }),
      mkReport({ number: 102, warnings: [] }),
    ]);
    expect(s.warnings).toEqual([
      "#100: non-required check failed: foo",
      "#101: non-required check failed: bar",
      "#101: non-required check failed: baz",
    ]);
  });

  test("preserves input order in actionable list", () => {
    // Order matters for the loop's prioritisation (older PRs first =
    // smaller numbers first). Verify summarize doesn't sort or
    // reorder under the hood.
    const s = summarize([
      mkReport({ number: 999, nextAction: "wait-ci" }),
      mkReport({ number: 100, nextAction: "wait-ci" }),
      mkReport({ number: 500, nextAction: "wait-ci" }),
    ]);
    expect(s.actionable).toEqual([999, 100, 500]);
  });
});

// ── Deterministic completion gate — the test owns the clock ──────────────────
//
// The three orchestration tests below assert *scheduling* properties: output
// aligned to input order under out-of-order completion, and a hard ceiling on
// in-flight polls. They used to drive those with real `setTimeout` delays
// (a staggered `(6 - pr) * 5`ms, and two 10ms holds), which is an undeclared
// ambient time channel. bun's per-test budget is wall-clock, so under CPU
// contention the OS delivers those timers late and unevenly and the file's
// runtime — and eventually its verdict — becomes a function of machine load.
// That is a §4 DST violation (a test that does not replay deterministically)
// and a §13 noninterference violation (influence entering outside a declared,
// metered channel); see `.claude/rules/local-time-never-enters-the-shared-fold.md`.
//
// Measured, so the claim is falsifiable and so nobody re-derives it from the
// outage it is adjacent to. Under 10 competing busy-loops, the whole file ran
// 1150 / 563 / 538 ms with the timers and 393 / 388 / 423 ms without them —
// a 2.1x spread collapsing to 1.09x. Per test, idle: 26.8 / 44.3 / 11.4 ms
// before, 1.39 / 0.26 / 0.21 ms after. Note what that does NOT say: ~83 ms of
// timer was never going to reach bun's 5000 ms cap on its own. The seven-PR
// outage of 2026-08-18 was a BLOCKING `spawnSync("gh", ...)` in `main()`,
// fixed in #12045 — a different channel, in the same file, with a much larger
// coefficient. This rewrite closes the remaining one; it does not claim the
// credit for the first.
//
// The substrate `pollAllBounded` schedules on contains no timer at all — grep
// `setTimeout|setInterval|setImmediate|Date.now` across
// `src/Core.TypeScript/ferry-throttler/` and there are zero hits; it advances
// purely on microtasks. So the test can own the clock outright: every poll
// parks until the test releases it by name, and `settle()` drains the microtask
// queue. Completion order stops being an outcome of the scheduler's mood and
// becomes an input the test states. That makes the out-of-order premise
// *guaranteed* rather than merely likely, which is why these rewrites assert
// strictly more than the timer versions did, not less.

interface Gate {
  /** The injected `pollFn`: parks every call until `release(pr)` is called. */
  readonly poll: (pr: number) => Promise<PollOutcome>;
  /** PR numbers in dispatch order — one entry per `pollFn` entry. */
  readonly started: readonly number[];
  /** PR numbers in completion order — one entry per `release`. */
  readonly completed: readonly number[];
  /** Polls currently parked, i.e. the live in-flight count. */
  readonly inFlight: () => number;
  /** Highest in-flight count observed across the whole run. */
  readonly peak: () => number;
  /** Complete one parked poll. Throws if that PR is not in flight. */
  readonly release: (pr: number) => void;
  /** Complete every currently-parked poll, in dispatch order. */
  readonly releaseAll: () => void;
}

function makeGate(): Gate {
  const started: number[] = [];
  const completed: number[] = [];
  const parked = new Map<number, () => void>();
  let peak = 0;
  const poll = (pr: number): Promise<PollOutcome> =>
    new Promise((res) => {
      started.push(pr);
      parked.set(pr, () => res({ number: pr, report: mkReport({ number: pr }) }));
      peak = Math.max(peak, parked.size);
    });
  const release = (pr: number): void => {
    const resolve = parked.get(pr);
    // Loud, not silent: releasing a PR that was never dispatched means the
    // pool scheduled something other than what the test believes it did.
    if (resolve === undefined) throw new Error(`release(${pr}): not in flight`);
    parked.delete(pr);
    completed.push(pr);
    resolve();
  };
  const releaseAll = (): void => {
    for (const pr of [...parked.keys()]) release(pr);
  };
  return { poll, started, completed, inFlight: () => parked.size, peak: () => peak, release, releaseAll };
}

/**
 * Drain the microtask queue so the throttler reaches its next quiescent point.
 * No wall-clock is consulted: each `await` yields exactly one microtask turn.
 * 64 turns is far beyond the throttler's await-chain depth per step; if that
 * substrate ever grows deeper, the assertions after `settle()` fail loudly
 * rather than passing vacuously.
 */
async function settle(turns = 64): Promise<void> {
  for (let i = 0; i < turns; i++) await Promise.resolve();
}

describe("pollAllBounded with injected pollFn", () => {
  test("returns outcomes in input order regardless of completion order", async () => {
    // DST contract: even if pollFn resolves out of order (worker
    // scheduling races), the `outcomes` array MUST be input-aligned
    // by index. Without this guarantee, the per-PR JSON in stdout
    // wouldn't match the input PR list, breaking caller assumptions.
    const gate = makeGate();
    const done = pollAllBounded([1, 2, 3, 4, 5], "o", "r", 5, gate.poll);

    await settle();
    expect(gate.inFlight()).toBe(5);

    // Complete strictly last-to-first. The old version bought this with a
    // staggered real delay and could only *hope* the OS honoured the 5ms
    // spacing; here the reversal is stated, so the premise the assertion
    // depends on cannot silently evaporate under load.
    for (const pr of [5, 4, 3, 2, 1]) {
      gate.release(pr);
      await settle();
    }

    const outcomes = await done;
    expect(outcomes.map((o) => o.number)).toEqual([1, 2, 3, 4, 5]);
    // And confirm the completions really did run out-of-order:
    expect(gate.completed).toEqual([5, 4, 3, 2, 1]);
  });

  test("respects concurrency bound — never more than N in flight", async () => {
    const gate = makeGate();
    const prs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const done = pollAllBounded(prs, "o", "r", 3, gate.poll);

    await settle();
    // Exactly 3 — the ceiling is a bound AND it is tight (4 would be a leak,
    // 2 would be under-use). The timer version could only sample a peak.
    expect(gate.inFlight()).toBe(3);
    expect(gate.started.slice(0, 3)).toEqual([1, 2, 3]);

    // Release one at a time. The pool must refill to exactly 3 while enough
    // work remains and taper to 0 at the tail — checked after EVERY release,
    // not merely as a max over a run whose interleaving was up to the OS.
    for (let i = 0; i < prs.length; i++) {
      const next = gate.started[i];
      expect(next).toBeDefined();
      gate.release(next!);
      await settle();
      expect(gate.inFlight()).toBe(Math.min(3, prs.length - (i + 1)));
    }

    const outcomes = await done;
    expect(outcomes.map((o) => o.number)).toEqual(prs);
    // The worker pool has 3 workers; peak should be exactly 3.
    expect(gate.peak()).toBe(3);
  });

  test("worker count clamped to PR count when prs.length < concurrency", async () => {
    // Prevents spawning useless idle workers when the input is
    // smaller than the requested concurrency.
    const gate = makeGate();
    const done = pollAllBounded([42, 43], "o", "r", 16, gate.poll);

    await settle();
    // 16 workers requested for 2 PRs: exactly 2 dispatched, none idle.
    expect(gate.inFlight()).toBe(2);
    expect(gate.started).toEqual([42, 43]);

    gate.releaseAll();
    const outcomes = await done;
    expect(outcomes.map((o) => o.number)).toEqual([42, 43]);
    expect(gate.peak()).toBe(2);
  });

  test("empty PR list resolves immediately with empty outcomes", async () => {
    let called = false;
    const pollFn = (): Promise<PollOutcome> => {
      called = true;
      return Promise.resolve({ number: 0, report: mkReport() });
    };
    const outcomes = await pollAllBounded([], "o", "r", 4, pollFn);
    expect(outcomes).toEqual([]);
    expect(called).toBe(false);
  });

  test("propagates errors as PollError outcomes without throwing", async () => {
    // The loop must NEVER throw — a single PR's failure (auth,
    // rate-limit, JSON parse) shouldn't cascade and lose the other
    // PRs' results. Errors are surfaced as PollOutcome.error so the
    // caller can partition success/failure deterministically.
    const pollFn = (pr: number): Promise<PollOutcome> =>
      Promise.resolve(
        pr === 99
          ? { number: pr, error: { number: pr, exitCode: 2, stderr: "auth fail" } }
          : { number: pr, report: mkReport({ number: pr }) },
      );
    const outcomes = await pollAllBounded([1, 99, 2], "o", "r", 4, pollFn);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0]?.report?.number).toBe(1);
    expect(outcomes[1]?.error?.exitCode).toBe(2);
    expect(outcomes[2]?.report?.number).toBe(2);
  });

  test("converts a rejected pollFn promise into a PollError outcome", async () => {
    // P0 invariant (Copilot review on PR #1153 2026-05-01):
    // pollAllBounded must NEVER reject — even if pollFn throws or
    // returns a rejected promise. The orchestrator's contract is
    // that Promise.all(workers) always resolves; rejection from a
    // single PR's poll converts to PollOutcome.error so the caller
    // partitions success/failure deterministically.
    const pollFn = (pr: number): Promise<PollOutcome> =>
      pr === 99
        ? Promise.reject(new Error("synthetic rejection"))
        : Promise.resolve({ number: pr, report: mkReport({ number: pr }) });
    const outcomes = await pollAllBounded([1, 99, 2], "o", "r", 4, pollFn);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0]?.report?.number).toBe(1);
    expect(outcomes[1]?.error?.exitCode).toBe(-1);
    expect(outcomes[1]?.error?.stderr).toContain("synthetic rejection");
    expect(outcomes[2]?.report?.number).toBe(2);
  });
});

// ── main() — --with-bus-claims (081KR7JY10008QG0R000R503K2 slice 5) ──────────────────────────────

// Capture process.stdout.write and restore after each test.
function captureStdout(): { read: () => string; restore: () => void } {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  // Use a compatible function signature to avoid strict-mode overload mismatch.
  (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
    chunks.push(s);
    return true;
  };
  return {
    read: () => chunks.join(""),
    restore: () => { process.stdout.write = orig; },
  };
}

const fakeClaim: ClaimRecord = {
  id: "test-uuid",
  from: "otto",
  itemId: "081KR7JY10008QG0R000R503K2",
  branch: "feat/b-0400-slice5",
  timestamp: "2026-05-13T00:00:00.000Z",
  expiresAt: "2026-05-14T00:00:00.000Z",
};

const emptyPriorState: ReadPRStateFn = () => ({ open: [], clean: [] });

describe("main() — --with-bus-claims flag", () => {
  test("busClaimsFn is called and busClaims field is present when flag is passed", async () => {
    let called = false;
    let priorStateReads = 0;
    const busClaimsFn: BusClaimsFn = () => { called = true; return [fakeClaim]; };
    const readPRStateFn: ReadPRStateFn = () => {
      priorStateReads++;
      return { open: [], clean: [] };
    };
    const pollFn = (pr: number): Promise<PollOutcome> =>
      Promise.resolve({ number: pr, report: mkReport({ number: pr }) });

    const cap = captureStdout();
    let code: number;
    try {
      code = await main(["--with-bus-claims", "1"], busClaimsFn, pollFn, readPRStateFn);
    } finally {
      cap.restore();
    }

    expect(code!).toBe(0);
    expect(called).toBe(true);
    expect(priorStateReads).toBe(0);
    const batch = JSON.parse(cap.read()) as BatchReport;
    expect(Array.isArray(batch.busClaims)).toBe(true);
    expect(batch.busClaims).toHaveLength(1);
    expect(batch.busClaims![0]!.from).toBe("otto");
    expect(batch.busClaims![0]!.itemId).toBe("081KR7JY10008QG0R000R503K2");
  });

  test("busClaimsFn is NOT called and busClaims is absent when flag is omitted", async () => {
    let called = false;
    const busClaimsFn: BusClaimsFn = () => { called = true; return [fakeClaim]; };
    const pollFn = (pr: number): Promise<PollOutcome> =>
      Promise.resolve({ number: pr, report: mkReport({ number: pr }) });

    const cap = captureStdout();
    let code: number;
    try {
      code = await main(["1"], busClaimsFn, pollFn, emptyPriorState);
    } finally {
      cap.restore();
    }

    expect(code!).toBe(0);
    expect(called).toBe(false);
    const batch = JSON.parse(cap.read()) as BatchReport;
    expect(batch.busClaims).toBeUndefined();
  });

  test("busClaims serialized as empty array when --with-bus-claims and busClaimsFn returns nothing", async () => {
    // Verifies busClaims: [] appears in the batch output when the bus is empty.
    // Note: the --all-open empty-PR early-return path is not exercised here because
    // listOpenPRs is not injectable in this test harness; that path requires a
    // dedicated integration test.
    const busClaimsFn: BusClaimsFn = () => [];
    const pollFn = (pr: number): Promise<PollOutcome> =>
      Promise.resolve({ number: pr, report: mkReport({ number: pr }) });

    const cap = captureStdout();
    let code: number;
    try {
      code = await main(["--with-bus-claims", "2"], busClaimsFn, pollFn, emptyPriorState);
    } finally {
      cap.restore();
    }

    expect(code!).toBe(0);
    const batch = JSON.parse(cap.read()) as BatchReport;
    expect(batch.busClaims).toEqual([]);
  });

  test("multi-PR main() reads prior state through the injection, never an ambient forge process", async () => {
    // The regression this pins is the one that turned `test (TS hermetic)` red
    // on seven PRs at once (2026-08-18): `main()` reached `readPRState()`
    // directly, which is a BLOCKING `spawnSync("gh", ["pr","list", ...])` with a
    // 30s ceiling. Because spawnSync stalls the event loop, bun's 5000ms
    // wall-clock budget could not even fire until `gh` returned, so all three
    // tests in this block timed out at ~5000ms whenever the forge was slow or
    // unreachable — exactly the hermetic tier's condition.
    //
    // The three tests above all poll a SINGLE PR, and single-PR runs skip prior-
    // state classification entirely (priority cannot reorder one item). So they
    // are hermetic by that shortcut, and would stay green even if the injection
    // regressed. This test takes the >1 branch, where the reader is genuinely
    // consulted, and asserts the injected one is what gets called. If someone
    // drops the parameter and calls the module-level `readPRState` again, this
    // goes red on a machine with no `gh` — which is the whole point.
    let priorStateReads = 0;
    const readPRStateFn: ReadPRStateFn = () => {
      priorStateReads++;
      // #7 is CLEAN from the prior snapshot, #8 is not -> #8 is urgent.
      return { open: [], clean: [{ number: 7, title: "clean pr", mergeState: "clean" }] };
    };
    const pollFn = (pr: number): Promise<PollOutcome> =>
      Promise.resolve({ number: pr, report: mkReport({ number: pr }) });

    const cap = captureStdout();
    let code: number;
    try {
      code = await main(["7", "8"], () => [], pollFn, readPRStateFn);
    } finally {
      cap.restore();
    }

    expect(code!).toBe(0);
    expect(priorStateReads).toBe(1);
    const batch = JSON.parse(cap.read()) as BatchReport;
    // Priority routing must not disturb input alignment: #8 drains first in the
    // urgent lane, but the report order still follows the argv order.
    expect(batch.count).toBe(2);
    expect(batch.reports.map((r) => r.number)).toEqual([7, 8]);
  });
});
