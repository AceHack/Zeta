/**
 * autonomy.test.ts — the loop stops, and says why.
 *
 * A loop that cannot stop is worse than no loop: it burns a budget producing nothing and reports
 * success by never admitting it finished. So every stop reason is reached here by construction, and
 * the two that matter most are the ones a naive driver gets wrong —
 *
 *   no_progress   an organization re-deciding the same things is not working. A deterministic
 *                 runtime called twice on unchanged inputs produces an identical cycle, so this is
 *                 not a heuristic; it is the honest reading of a pure function called again.
 *   bound_reached the backstop. Reaching it means the other three failed to fire, which is itself
 *                 the finding — so it is reported rather than folded into "not delivered".
 *
 * The runtime is INJECTED, so these settle deterministically without standing up an organization.
 */

import { describe, expect, test } from "bun:test";
import {
  progressOf,
  runUntilSettled,
  sameProgress,
  StopReason,
  type AutonomyResult,
} from "./autonomy";
import type { OrgRuntimeDeps, OrgRuntimeReport } from "./org-runtime";

/** Only the fields the driver reads. The rest of a report is irrelevant to stopping. */
const report = (over: Partial<OrgRuntimeReport> = {}): OrgRuntimeReport =>
  ({
    delivered: false,
    halted: [],
    gateEvaluations: [],
    changesLanded: [],
    changesHandedOff: [],
    cascade: { nodes: [] },
    ...over,
  }) as unknown as OrgRuntimeReport;

const deps = { nowMs: 0 } as unknown as OrgRuntimeDeps;

/** A runtime that returns a scripted sequence, then repeats the last one forever. */
const scripted = (reports: readonly OrgRuntimeReport[]) => {
  let i = 0;
  return async () => {
    const r = reports[Math.min(i, reports.length - 1)]!;
    i += 1;
    return r;
  };
};

describe("A LOOP WHOSE ITERATIONS CANNOT SEE EACH OTHER IS NOT A LOOP", () => {
  test("what cycle 1 LANDED is visible to cycle 2", () => {
    // `deps.alreadyLanded` is folded from the store once, before the loop. Without accumulating it
    // here, an item merged in cycle 1 comes back in cycle 2 as done-with-no-commit and the run
    // refuses to deliver work it just shipped — the same defect `priorCascade` was fixed for, one
    // field over.
    const seen: (readonly string[])[] = [];
    const run = async (d: OrgRuntimeDeps): Promise<OrgRuntimeReport> => {
      seen.push([...(d.alreadyLanded ?? [])].sort());
      return report({
        changesLanded: seen.length === 1 ? ["task-1"] : ["task-2"],
        // Progress has to differ or the driver stops for no-progress before cycle 3.
        gateEvaluations: Array.from({ length: seen.length }, (_, i) => i) as never,
      });
    };
    return runUntilSettled(
      { nowMs: 0, alreadyLanded: new Set<string>() } as unknown as OrgRuntimeDeps,
      { maxCycles: 3 },
      run,
    ).then(() => {
      expect(seen[0]).toEqual([]);
      expect(seen[1]).toEqual(["task-1"]);
      expect(seen[2]).toEqual(["task-1", "task-2"]);
    });
  });

  test("NOT MEASURED survives the loop — it does not become an empty set", () => {
    // A caller with no store supplies nothing, and "nothing has ever landed" is a different claim
    // from "we did not look". Turning the first into the second here would make every store-less
    // run start failing on a question it never asked.
    const seen: (ReadonlySet<string> | undefined)[] = [];
    const run = async (d: OrgRuntimeDeps): Promise<OrgRuntimeReport> => {
      seen.push(d.alreadyLanded);
      return report({ gateEvaluations: Array.from({ length: seen.length }, (_, i) => i) as never });
    };
    return runUntilSettled({ nowMs: 0 } as unknown as OrgRuntimeDeps, { maxCycles: 2 }, run).then(() => {
      expect(seen).toEqual([undefined, undefined]);
    });
  });
});

describe("DELIVERED is the only good ending", () => {
  test("it stops on the cycle that delivers", async () => {
    const r = await runUntilSettled(deps, { maxCycles: 10 }, scripted([
      report(),
      report({ gateEvaluations: [1] as never }),
      report({ delivered: true, gateEvaluations: [1, 2] as never }),
    ]));
    expect(r.stoppedBecause).toBe(StopReason.Delivered);
    expect(r.cycles).toBe(3);
    expect(r.summary).toContain("delivered after 3 cycle(s)");
  });

  test("delivery wins over a halt in the SAME cycle", async () => {
    // A cycle that delivered has finished even if it also stopped a task. Reporting it as halted
    // would tell a caller the run gave up when it succeeded.
    const r = await runUntilSettled(deps, { maxCycles: 5 }, scripted([
      report({ delivered: true, halted: [{ taskId: "t", action: "pause", byHatId: "em" }] as never }),
    ]));
    expect(r.stoppedBecause).toBe(StopReason.Delivered);
  });
});

describe("HALTED — the organization decided to stop, which is a real outcome", () => {
  test("an escalation that halted a task stops the loop and names who decided", async () => {
    const r = await runUntilSettled(deps, { maxCycles: 10 }, scripted([
      report({ halted: [{ taskId: "task-1", action: "pause", byHatId: "engineering_manager" }] as never }),
    ]));
    expect(r.stoppedBecause).toBe(StopReason.Halted);
    expect(r.summary).toContain("engineering_manager");
    expect(r.summary).toContain("task-1");
    expect(r.summary).toContain("pause");
  });

  test("halted is checked BEFORE no-progress, so a decision is never reported as nothing", async () => {
    // Both would fire on the second cycle here. An escalation is a DECISION; calling it "the cycle
    // changed nothing" would lose who decided what.
    const stalled = report({ halted: [{ taskId: "t", action: "re_scope", byHatId: "em" }] as never });
    const r = await runUntilSettled(deps, { maxCycles: 5 }, scripted([stalled]));
    expect(r.stoppedBecause).toBe(StopReason.Halted);
  });
});

describe("NO PROGRESS — the one a naive driver gets wrong", () => {
  test("two identical cycles stop the loop", async () => {
    const same = report({ gateEvaluations: [1, 2] as never });
    const r = await runUntilSettled(deps, { maxCycles: 50 }, scripted([same, same]));
    expect(r.stoppedBecause).toBe(StopReason.NoProgress);
    expect(r.cycles).toBe(2);
    expect(r.summary).toContain("changed nothing");
  });

  test("...and a cycle that DID move something does not stop it", async () => {
    // The pair is the measurement. Without this, a detector that always fires would pass the test
    // above and stop every run on its second cycle.
    const r = await runUntilSettled(deps, { maxCycles: 4 }, scripted([
      report({ gateEvaluations: [1] as never }),
      report({ gateEvaluations: [1, 2] as never }),
      report({ gateEvaluations: [1, 2, 3] as never }),
      report({ gateEvaluations: [1, 2, 3, 4] as never }),
    ]));
    expect(r.stoppedBecause).toBe(StopReason.BoundReached);
    expect(r.cycles).toBe(4);
  });

  test("EACH of the tracked numbers counts as progress on its own", async () => {
    const base = { gateEvaluations: [1] as never };
    const moves: Partial<OrgRuntimeReport>[] = [
      { ...base, gateEvaluations: [1, 2] as never },
      { ...base, changesLanded: ["c"] as never },
      { ...base, cascade: { nodes: [{ state: "done" }] } as never },
    ];
    for (const move of moves) {
      const r = await runUntilSettled(deps, { maxCycles: 2 }, scripted([report(base), report(move)]));
      expect(r.stoppedBecause).toBe(StopReason.BoundReached);
    }
  });
});

describe("BOUND REACHED is a backstop, and is reported as one", () => {
  test("a loop that keeps moving stops at the bound and says so", async () => {
    let n = 0;
    const r = await runUntilSettled(deps, { maxCycles: 3 }, async () => {
      n += 1;
      return report({ gateEvaluations: Array.from({ length: n }) as never });
    });
    expect(r.stoppedBecause).toBe(StopReason.BoundReached);
    expect(r.cycles).toBe(3);
    expect(r.summary).toContain("without delivering");
  });

  test("a bound below one is REFUSED rather than silently running once", async () => {
    await expect(
      runUntilSettled(deps, { maxCycles: 0 }, scripted([report()])),
    ).rejects.toThrow("at least 1");
  });
});

describe("the loop is observable and advances its own clock", () => {
  test("onCycle sees every cycle, in order", async () => {
    const seen: number[] = [];
    await runUntilSettled(
      deps,
      { maxCycles: 3, onCycle: (c) => seen.push(c) },
      scripted([
        report({ gateEvaluations: [1] as never }),
        report({ gateEvaluations: [1, 2] as never }),
        report({ delivered: true }),
      ]),
    );
    expect(seen).toEqual([1, 2, 3]);
  });

  test("nextNowMs advances the clock a cycle sees", async () => {
    // Without this every cycle runs at one instant, and a runtime whose ids are keyed on the clock
    // would mint colliding ids across cycles.
    const clocks: number[] = [];
    await runUntilSettled(
      { nowMs: 1_000 } as unknown as OrgRuntimeDeps,
      { maxCycles: 3, nextNowMs: (_c, prev) => prev + 500 },
      async (d) => {
        clocks.push(d.nowMs);
        return report({ gateEvaluations: Array.from({ length: clocks.length }) as never });
      },
    );
    expect(clocks).toEqual([1_000, 1_500, 2_000]);
  });

  test("a person's pause stops the loop BETWEEN cycles, and says so", async () => {
    // `pause_run` was replayed into a flag and shown on the dashboard, and the loop never asked it.
    let asked = 0;
    const r = await runUntilSettled(
      deps,
      { maxCycles: 5, pausedBecause: () => (++asked >= 2 ? "paused by max: restarting on new code" : undefined) },
      scripted([
        report({ gateEvaluations: [1] as never }),
        report({ gateEvaluations: [1, 2] as never }),
        report({ gateEvaluations: [1, 2, 3] as never }),
      ]),
    );
    expect(r.cycles).toBe(2);
    expect(r.stoppedBecause).toBe(StopReason.Paused);
    expect(r.summary).toContain("restarting on new code");
  });

  test("every cycle's report is kept, not just the last", async () => {
    const r: AutonomyResult = await runUntilSettled(deps, { maxCycles: 3 }, scripted([
      report({ gateEvaluations: [1] as never }),
      report({ gateEvaluations: [1, 2] as never }),
      report({ delivered: true }),
    ]));
    expect(r.reports).toHaveLength(3);
    expect(r.last).toBe(r.reports[2]!);
  });
});

describe("progressOf reduces a cycle to what must move", () => {
  test("it reads the four numbers and nothing else", () => {
    const p = progressOf(
      report({
        gateEvaluations: [1, 2] as never,
        changesLanded: ["c"] as never,
        cascade: { nodes: [{ state: "done" }, { state: "open" }] } as never,
        delivered: false,
      }),
    );
    expect(p).toEqual({ gatesPassed: 2, workItemsDone: 1, changesLanded: 1, delivered: false });
  });

  test("sameProgress is exact — any one field differing is progress", () => {
    const base = { gatesPassed: 1, workItemsDone: 1, changesLanded: 1, delivered: false };
    expect(sameProgress(base, { ...base })).toBe(true);
    expect(sameProgress(base, { ...base, gatesPassed: 2 })).toBe(false);
    expect(sameProgress(base, { ...base, workItemsDone: 2 })).toBe(false);
    expect(sameProgress(base, { ...base, changesLanded: 2 })).toBe(false);
    expect(sameProgress(base, { ...base, delivered: true })).toBe(false);
  });
});

describe("HANDED OFF IS NOT DELIVERED", () => {
  // The Agentic Team's first handoff printed "DELIVERED: delivered after 1 cycle(s)" for a run that
  // merged nothing and opened three merge requests for people to review.
  test("a cycle whose finished work went to people for review stops as handed_off, and says so", async () => {
    const r = await runUntilSettled(deps, { maxCycles: 3 }, scripted([report({ delivered: true, changesHandedOff: ["task-1", "task-2"] })]));
    expect(r.stoppedBecause).toBe(StopReason.HandedOff);
    expect(r.summary).toContain("handed 2 change(s) to people for review");
    expect(r.summary).toContain("nothing was merged");
  });
});
