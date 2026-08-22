/**
 * first-session-budget.test.ts — the tick budget is MEASURED, INJECTED, and READ.
 *
 * Three separate claims, three separate tests, because they fail independently:
 *
 *   1. the number is derived from the state machine, not picked  (diameter)
 *   2. someone is on the record for it                           (attribution)
 *   3. the loop actually reads it                                (injection)
 *
 * (3) is the vacuity guard. A budget field the loop ignores is the same failure
 * as a golden vector nothing opens: it looks like compliance and constrains
 * nothing. So both loops are run against a deliberately-too-small budget and
 * must stop early.
 *
 * No live model anywhere in this file. The backends are deterministic mocks that
 * read the numbered options out of the prompt `chooseIndex` builds.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelBackend } from "../accelerator/local-llm";
import {
  buildFirstSessionMenu,
  defaultNodeSession,
  FIRST_SESSION_ADVANCING_TICKS,
  FIRST_SESSION_LLM_TICK_BUDGET,
  firstSessionActionKey,
  runFirstSessionLoop,
  simulateFirstSession,
  type NodeSessionState,
} from "./first-session";
import {
  FIRST_SESSION_RUN_TICK_BUDGET,
  SETUP_RETRIES_PER_CREDENTIAL,
  SETUP_STEPS_ON_LONGEST_PATH,
  parseArgs,
  runFirstSession,
  type RunOptions,
} from "./first-session-run";
import { ARC_SWARM_TICK_BUDGET } from "../arc-solver/arc-harness";
import { budgetIsAttributed, clampTicks, type TickBudget } from "./tick-budget";
import type { ShellRunner } from "./first-session-executor";

function stateKey(s: NodeSessionState): string {
  return [
    s.credentials.gh,
    s.credentials.claude,
    s.credentials.codex,
    s.credentials.gemini,
    String(s.complete),
    String(s.cloudHelpersOffered),
  ].join("|");
}

/**
 * Exhaustive walk of the reachable state space under the menu the operator is
 * actually offered. Returns the longest simple path (no state revisited — a
 * revisit is the retry case, which the conductor budget covers separately), the
 * reachable-state count, and any transition that leaves the state unchanged.
 */
function walkFirstSessionMachine(): {
  longestPath: number;
  witness: string[];
  reachable: number;
  nonAdvancing: string[];
} {
  const reachable = new Set<string>();
  const nonAdvancing: string[] = [];
  let longestPath = 0;
  let witness: string[] = [];

  const recur = (s: NodeSessionState, depth: number, onPath: Set<string>, path: string[]): void => {
    reachable.add(stateKey(s));
    if (depth > longestPath) {
      longestPath = depth;
      witness = [...path];
    }
    if (s.complete) return;
    for (const action of buildFirstSessionMenu(s)) {
      const next = simulateFirstSession(s, action);
      const nextKey = stateKey(next);
      if (nextKey === stateKey(s)) {
        nonAdvancing.push(`${stateKey(s)} --${firstSessionActionKey(action)}--> unchanged`);
      }
      if (onPath.has(nextKey)) continue;
      onPath.add(nextKey);
      path.push(firstSessionActionKey(action));
      recur(next, depth + 1, onPath, path);
      path.pop();
      onPath.delete(nextKey);
    }
  };

  const start = defaultNodeSession();
  recur(start, 0, new Set([stateKey(start)]), []);
  return { longestPath, witness, reachable: reachable.size, nonAdvancing };
}

/**
 * Deterministic backend: reads the numbered options out of the prompt and picks
 * by kind-preference — set up a credential if offered, otherwise reveal the
 * cloud helpers, otherwise take the lead. That preference order walks the
 * longest path through the machine without any model, and without this file
 * having to track the session itself (`chooseIndex` skips the backend entirely
 * when the menu has one option, so a cursor would desync).
 */
const longestPathBackend: ModelBackend = {
  name: "longest-path",
  complete: (prompt: string) => {
    const numbered = /^(\d+): (.*)$/;
    const options: { index: number; label: string }[] = [];
    for (const line of prompt.split("\n")) {
      const m = numbered.exec(line);
      const idx = m?.[1];
      const label = m?.[2];
      if (idx !== undefined && label !== undefined) {
        options.push({ index: Number.parseInt(idx, 10), label });
      }
    }
    const setUp = options.find((o) => o.label.startsWith("Set up "));
    if (setUp) return Promise.resolve(String(setUp.index));
    const cloud = options.find((o) => o.label.startsWith("Show optional cloud helpers"));
    if (cloud) return Promise.resolve(String(cloud.index));
    return Promise.resolve("0");
  },
};

function fakeRunner(overrides: Partial<ShellRunner>): ShellRunner {
  return {
    run: overrides.run ?? (() => ({ exitCode: 1 })),
    spawnInteractive: overrides.spawnInteractive ?? (() => ({ exitCode: 0 })),
    which: overrides.which ?? ((cmd) => (cmd === "gh" ? "/usr/bin/gh" : null)),
  };
}

/**
 * `gh auth status` succeeds → the probe reports gh ready, so the menu offers
 * `use_local_llm_only`. Without this the "local-only" demo token resolves to
 * nothing and the loop exits on a null action rather than on its budget — which
 * is how the first draft of the marker test failed: my script, not the code.
 */
function ghReadyRunner(): ShellRunner {
  return fakeRunner({
    run: (cmd, args) => (cmd === "gh" && args[0] === "auth" ? { exitCode: 0 } : { exitCode: 1 }),
  });
}

function silently<T>(fn: () => T | Promise<T>): Promise<{ value: T; log: string }> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  return Promise.resolve()
    .then(fn)
    .then((value) => ({ value, log: lines.join("\n") }))
    .finally(() => {
      console.log = original;
    });
}

// ─── 1. the number is measured ────────────────────────────────────────────────

describe("first-session tick budget — derived from the machine, not picked", () => {
  it("longest advancing path is exactly FIRST_SESSION_ADVANCING_TICKS", () => {
    const walk = walkFirstSessionMachine();
    expect(walk.longestPath).toBe(FIRST_SESSION_ADVANCING_TICKS);
    expect(walk.reachable).toBe(115);
    expect(walk.witness).toEqual([
      "setup_credential:gh",
      "offer_cloud_helpers",
      "setup_credential:claude",
      "setup_credential:codex",
      "setup_credential:gemini",
      "complete_first_session",
    ]);
  });

  it("no menu action leaves the session unchanged — the pure loop cannot stall", () => {
    // This is the measurement that justifies the LLM budget having zero headroom.
    expect(walkFirstSessionMachine().nonAdvancing).toEqual([]);
  });

  it("the LLM budget equals the measured diameter", () => {
    expect(FIRST_SESSION_LLM_TICK_BUDGET.maxTicks).toBe(FIRST_SESSION_ADVANCING_TICKS);
  });

  it("the conductor budget is the measured floor plus its stated retry allowance", () => {
    // Not a restatement of 18: each term is separately named, so changing the
    // number without changing a term fails here.
    expect(FIRST_SESSION_RUN_TICK_BUDGET.maxTicks).toBe(
      FIRST_SESSION_ADVANCING_TICKS + SETUP_RETRIES_PER_CREDENTIAL * SETUP_STEPS_ON_LONGEST_PATH,
    );
    expect(FIRST_SESSION_RUN_TICK_BUDGET.maxTicks).toBeGreaterThan(
      FIRST_SESSION_LLM_TICK_BUDGET.maxTicks,
    );
  });

  it("every budget covers the measured diameter — a loop that cannot finish is not a budget", () => {
    for (const b of [FIRST_SESSION_LLM_TICK_BUDGET, FIRST_SESSION_RUN_TICK_BUDGET]) {
      expect(b.maxTicks).toBeGreaterThanOrEqual(FIRST_SESSION_ADVANCING_TICKS);
    }
  });
});

// ─── 2. someone is on the record ──────────────────────────────────────────────

describe("tick budgets carry attribution", () => {
  const budgets: readonly TickBudget[] = [
    FIRST_SESSION_LLM_TICK_BUDGET,
    FIRST_SESSION_RUN_TICK_BUDGET,
    ARC_SWARM_TICK_BUDGET,
  ];

  it("all three dogfooding budgets are attributed", () => {
    for (const b of budgets) {
      expect(budgetIsAttributed(b)).toBe(true);
    }
  });

  it("budgetIsAttributed rejects a bare number wearing a budget's clothes", () => {
    // The falsifier for the check above: it must be able to say no.
    expect(budgetIsAttributed({ name: "x", maxTicks: 24, chosenBy: "", rationale: "" })).toBe(false);
    expect(
      budgetIsAttributed({ name: "", maxTicks: 24, chosenBy: "someone", rationale: "because" }),
    ).toBe(false);
    expect(
      budgetIsAttributed({ name: "x", maxTicks: 0, chosenBy: "someone", rationale: "because" }),
    ).toBe(false);
  });

  it("the two first-session budgets differ, and each says why in its own words", () => {
    expect(FIRST_SESSION_LLM_TICK_BUDGET.maxTicks).not.toBe(FIRST_SESSION_RUN_TICK_BUDGET.maxTicks);
    expect(FIRST_SESSION_LLM_TICK_BUDGET.rationale).not.toBe(
      FIRST_SESSION_RUN_TICK_BUDGET.rationale,
    );
    expect(FIRST_SESSION_RUN_TICK_BUDGET.rationale).toContain("retries");
  });

  it("clampTicks floors at 1 — no caller can switch the rail off", () => {
    const off = (n: number): TickBudget => ({
      name: "t",
      maxTicks: n,
      chosenBy: "test",
      rationale: "test",
    });
    expect(clampTicks(off(0))).toBe(1);
    expect(clampTicks(off(-5))).toBe(1);
    expect(clampTicks(off(7.9))).toBe(7);
    expect(clampTicks(FIRST_SESSION_LLM_TICK_BUDGET)).toBe(FIRST_SESSION_ADVANCING_TICKS);
  });
});

// ─── 3. the loop reads it ─────────────────────────────────────────────────────

describe("the budget is injected and READ (not decoration)", () => {
  const tiny: TickBudget = {
    name: "deliberately-too-small",
    maxTicks: 1,
    chosenBy: "test",
    rationale: "proves the loop reads the field instead of an inline constant",
  };

  it("pure loop: a 1-tick budget stops after one action, incomplete", async () => {
    const { trace, finalSession } = await runFirstSessionLoop(
      defaultNodeSession(),
      longestPathBackend,
      tiny,
    );
    expect(trace.length).toBe(1);
    expect(finalSession.complete).toBe(false);
  });

  it("pure loop: the real budget completes the longest path, exactly at the bound", async () => {
    const { trace, finalSession } = await runFirstSessionLoop(
      defaultNodeSession(),
      longestPathBackend,
    );
    expect(finalSession.complete).toBe(true);
    expect(trace.map(firstSessionActionKey)).toEqual([
      "setup_credential:gh",
      "offer_cloud_helpers",
      "setup_credential:claude",
      "setup_credential:codex",
      "setup_credential:gemini",
      "complete_first_session",
    ]);
    expect(trace.length).toBe(FIRST_SESSION_LLM_TICK_BUDGET.maxTicks);
  });

  it("conductor: a 1-tick budget cannot finish a two-step demo script", async () => {
    const marker = join(mkdtempSync(join(tmpdir(), "zeta-budget-")), "complete.marker");
    const opts: RunOptions = {
      ...parseArgs(["--demo", "--script", "setup-gh,local-only", "--dry-run"]),
      runner: fakeRunner({}),
      home: "/home/zeta",
      markerPath: marker,
      tickBudget: tiny,
    };
    const { value: final } = await silently(() => runFirstSession(opts));
    expect(final.complete).toBe(false);
    expect(existsSync(marker)).toBe(false);
  });

  it("conductor: the real budget finishes the same script", async () => {
    const marker = join(mkdtempSync(join(tmpdir(), "zeta-budget-")), "complete.marker");
    const opts: RunOptions = {
      ...parseArgs(["--demo", "--script", "setup-gh,local-only", "--dry-run"]),
      runner: fakeRunner({}),
      home: "/home/zeta",
      markerPath: marker,
    };
    const { value: final } = await silently(() => runFirstSession(opts));
    expect(final.complete).toBe(true);
  });
});

// ─── 4. the real path: the marker is a file on disk, not a simulated one ──────

describe("first-session marker — the one durable side effect, exercised for real", () => {
  it("writes a real marker file when the run is NOT a dry run", async () => {
    // Every pre-existing runFirstSession test passes --dry-run, so writeMarker
    // had zero coverage: the single piece of state that decides whether a node
    // re-runs first-login on every subsequent shell was never executed by a test.
    const dir = mkdtempSync(join(tmpdir(), "zeta-marker-real-"));
    const marker = join(dir, "nested", "first-session-complete");
    const opts: RunOptions = {
      ...parseArgs(["--demo", "--script", "local-only"]),
      runner: ghReadyRunner(),
      home: "/home/zeta",
      markerPath: marker,
    };

    const { value: final } = await silently(() => runFirstSession(opts));

    expect(final.complete).toBe(true);
    expect(existsSync(marker)).toBe(true);
    // Content is a real ISO timestamp, and mkdirSync recursive created the parent.
    const stamp = readFileSync(marker, "utf8").trim();
    expect(Number.isNaN(Date.parse(stamp))).toBe(false);
  });

  it("a second, non-demo run short-circuits on the marker it wrote", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-marker-real-"));
    const marker = join(dir, "first-session-complete");
    const ghReady = ghReadyRunner();

    const first: RunOptions = {
      ...parseArgs(["--demo", "--script", "local-only"]),
      runner: ghReady,
      home: "/home/zeta",
      markerPath: marker,
    };
    await silently(() => runFirstSession(first));
    expect(existsSync(marker)).toBe(true);

    // Non-demo, non-dry-run: the short-circuit branch. It returns BEFORE any
    // readline prompt, which is what makes this branch testable at all.
    const second: RunOptions = {
      ...parseArgs([]),
      runner: ghReady,
      home: "/home/zeta",
      markerPath: marker,
    };
    const { value: final, log } = await silently(() => runFirstSession(second));

    expect(final.complete).toBe(true);
    expect(log).toContain("zeta-first-session: already-complete");

    // GAP CLOSED 2026-08-18. This assertion previously pinned `"missing"` as a
    // KNOWN GAP — the short-circuit returned `defaultNodeSession()` instead of
    // probing, fabricating an all-missing credential set on a machine where gh
    // was authenticated — and said in as many words that it would turn red when
    // someone fixed it on purpose. It did, and this is that fix: the branch now
    // probes for what is observable and replays the journal for what was chosen
    // (`reconcileSessionRecord`). The runner here has gh authenticated, so the
    // honest answer is "ready".
    expect(final.credentials.gh).toBe("ready");
  });
});
