/**
 * src/Core.TypeScript/workflow-engine/closed-loop.test.ts
 *
 * 081KSNY2Z0008QG0R001YK61JQ.2 — invariant tests for closed-loop orchestrator.
 */

import { describe, expect, it } from "bun:test";
import {
  DEFAULT_LOOP_CONFIG,
  runCycle,
  runLoop,
  type CiVerdict,
  type Hypothesis,
  type LoopCallbacks,
  type LoopFeedback,
} from "./closed-loop";

interface SubstrateT extends Record<string, unknown> {
  payload: string;
}

const hypothesis = (id: string, payload: string, cycle = 0): Hypothesis<SubstrateT> => ({
  id,
  substrate: { payload },
  cycleIndex: cycle,
  derivedFrom: [],
  composesWith: [],
});

// Test callbacks — caller-injected per asymmetric-authorship
const passingCi = async (_h: Hypothesis<SubstrateT>): Promise<CiVerdict> => ({ kind: "passed" });
const failingCi = async (_h: Hypothesis<SubstrateT>): Promise<CiVerdict> => ({ kind: "failed", reason: "test" });
const mixedCi = async (h: Hypothesis<SubstrateT>): Promise<CiVerdict> => {
  if (h.id.endsWith("-good")) return { kind: "passed" };
  if (h.id.endsWith("-revise")) return { kind: "needs-revision", suggestions: ["fix x"] };
  return { kind: "failed", reason: "bad" };
};

// Identity rank (passes through; real impl uses TrueSkill)
const identityRank = async (
  hs: ReadonlyArray<Hypothesis<SubstrateT>>,
): Promise<ReadonlyArray<Hypothesis<SubstrateT>>> => hs;

// Mock evolution: produce single refined variant from top-N
const mockEvolve = async (
  ranked: ReadonlyArray<Hypothesis<SubstrateT>>,
  cycle: number,
): Promise<ReadonlyArray<Hypothesis<SubstrateT>>> => {
  if (ranked.length === 0) return [];
  return [
    {
      id: `evolved-cycle-${cycle}`,
      substrate: { payload: `evolved-${ranked.map((h) => h.id).join("+")}` },
      cycleIndex: cycle,
      derivedFrom: ranked.map((h) => h.id),
      composesWith: [],
    },
  ];
};

describe("081KSNY2Z0008QG0R001YK61JQ.2 closed-loop orchestrator", () => {
  it("runCycle with empty hypotheses returns EmptyHypothesisSet", async () => {
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: passingCi,
      rankSurvivors: identityRank,
      evolveSurvivors: mockEvolve,
    };
    const result = await runCycle([], callbacks, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.feedback.kind).toBe("EmptyHypothesisSet");
  });

  it("runCycle propagates passed hypotheses through ranking + evolution", async () => {
    const hs = [hypothesis("h1", "alpha"), hypothesis("h2", "beta")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: passingCi,
      rankSurvivors: identityRank,
      evolveSurvivors: mockEvolve,
    };
    const result = await runCycle(hs, callbacks, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.refined.length).toBe(1);
    expect(result.refined[0]!.id).toBe("evolved-cycle-1");
    expect(result.cycleIndex).toBe(1);
  });

  it("runCycle excludes failed hypotheses from propagation", async () => {
    const hs = [hypothesis("h1-good", "alpha"), hypothesis("h2-bad", "beta")];
    let rankedCount = 0;
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: mixedCi,
      rankSurvivors: async (verified) => {
        rankedCount = verified.length;
        return verified;
      },
      evolveSurvivors: mockEvolve,
    };
    const result = await runCycle(hs, callbacks, 0);
    expect(result.ok).toBe(true);
    expect(rankedCount).toBe(1); // only h1-good propagated
  });

  it("runCycle includes needs-revision with non-empty suggestions", async () => {
    const hs = [hypothesis("h1-good", "alpha"), hypothesis("h2-revise", "beta"), hypothesis("h3-bad", "gamma")];
    let rankedCount = 0;
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: mixedCi,
      rankSurvivors: async (verified) => {
        rankedCount = verified.length;
        return verified;
      },
      evolveSurvivors: mockEvolve,
    };
    await runCycle(hs, callbacks, 0);
    expect(rankedCount).toBe(2); // good + revise both propagate; bad excluded
  });

  it("runCycle returns InsufficientPropagatable when propagatable below minimum", async () => {
    const hs = [hypothesis("h1", "alpha")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: failingCi, // all fail
      rankSurvivors: identityRank,
      evolveSurvivors: mockEvolve,
    };
    const result = await runCycle(hs, callbacks, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.feedback.kind).toBe("InsufficientPropagatable");
  });

  it("runCycle returns CiDispatchFailure on CI exception", async () => {
    const hs = [hypothesis("h1", "alpha")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: async () => {
        throw new Error("ci broken");
      },
      rankSurvivors: identityRank,
      evolveSurvivors: mockEvolve,
    };
    const result = await runCycle(hs, callbacks, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.feedback.kind).toBe("CiDispatchFailure");
  });

  it("runCycle returns RankingFailure on ranking exception", async () => {
    const hs = [hypothesis("h1", "alpha")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: passingCi,
      rankSurvivors: async () => {
        throw new Error("rank broken");
      },
      evolveSurvivors: mockEvolve,
    };
    const result = await runCycle(hs, callbacks, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.feedback.kind).toBe("RankingFailure");
  });

  it("runCycle returns EvolutionFailure on evolution exception", async () => {
    const hs = [hypothesis("h1", "alpha")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: passingCi,
      rankSurvivors: identityRank,
      evolveSurvivors: async () => {
        throw new Error("evolve broken");
      },
    };
    const result = await runCycle(hs, callbacks, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.feedback.kind).toBe("EvolutionFailure");
  });

  it("infrastructure-error verdicts are excluded from propagation (don't reflect hypothesis quality)", async () => {
    const hs = [hypothesis("h1", "alpha"), hypothesis("h2", "beta")];
    let rankedCount = 0;
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: async (_h) => ({ kind: "infrastructure-error", reason: "blocked-on-runnability" }),
      rankSurvivors: async (v) => {
        rankedCount = v.length;
        return v;
      },
      evolveSurvivors: mockEvolve,
    };
    const result = await runCycle(hs, callbacks, 0);
    expect(result.ok).toBe(false); // no propagatable
    expect(rankedCount).toBe(0); // ranking never called with empty
  });

  it("runLoop iterates until max-cycles", async () => {
    const hs = [hypothesis("h0", "init")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: passingCi,
      rankSurvivors: identityRank,
      evolveSurvivors: mockEvolve,
    };
    const termination = await runLoop(hs, callbacks, { ...DEFAULT_LOOP_CONFIG, maxCycles: 3 });
    expect(termination.terminatedAtCycle).toBe(3);
    expect(termination.reason).toBe("max-cycles");
  });

  it("runLoop terminates early via predicate", async () => {
    const hs = [hypothesis("h0", "init")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: passingCi,
      rankSurvivors: identityRank,
      evolveSurvivors: mockEvolve,
    };
    const termination = await runLoop(
      hs,
      callbacks,
      DEFAULT_LOOP_CONFIG,
      (cycleIndex, _current) => cycleIndex < 2, // stop at cycle 2
    );
    expect(termination.terminatedAtCycle).toBe(2);
    expect(termination.reason).toBe("predicate-stopped");
  });

  it("runLoop terminates on insufficient-propagatable", async () => {
    const hs = [hypothesis("h0-bad", "init")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: mixedCi, // h0-bad → failed
      rankSurvivors: identityRank,
      evolveSurvivors: mockEvolve,
    };
    const termination = await runLoop(hs, callbacks);
    expect(termination.reason).toBe("insufficient-propagatable");
    expect(termination.terminatedAtCycle).toBe(0);
  });

  it("runLoop terminates on error", async () => {
    const hs = [hypothesis("h0", "init")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: async () => {
        throw new Error("broken");
      },
      rankSurvivors: identityRank,
      evolveSurvivors: mockEvolve,
    };
    const termination = await runLoop(hs, callbacks);
    expect(termination.reason).toBe("error");
    expect(termination.feedback?.kind).toBe("CiDispatchFailure");
  });

  it("LoopFeedback exhaustive switch (compile-time check)", () => {
    type Feedback = LoopFeedback;
    const assertNever = (x: never): never => {
      throw new Error(`unhandled LoopFeedback: ${JSON.stringify(x)}`);
    };
    const acknowledge = (f: Feedback): string => {
      switch (f.kind) {
        case "EmptyHypothesisSet":
        case "CiDispatchFailure":
        case "RankingFailure":
        case "EvolutionFailure":
        case "InsufficientPropagatable":
        case "MaxCyclesReached":
          return f.kind;
        default:
          return assertNever(f);
      }
    };
    expect(acknowledge({ kind: "EmptyHypothesisSet" })).toBe("EmptyHypothesisSet");
    expect(acknowledge({ kind: "CiDispatchFailure", hypothesisId: "x", reason: "y" })).toBe("CiDispatchFailure");
    expect(acknowledge({ kind: "InsufficientPropagatable", propagatableCount: 0, minRequired: 1, cycleIndex: 0 })).toBe(
      "InsufficientPropagatable",
    );
  });

  it("CiVerdict exhaustive switch (compile-time check)", () => {
    const assertNever = (x: never): never => {
      throw new Error(`unhandled CiVerdict: ${JSON.stringify(x)}`);
    };
    const acknowledge = (v: CiVerdict): string => {
      switch (v.kind) {
        case "passed":
        case "failed":
        case "needs-revision":
        case "infrastructure-error":
          return v.kind;
        default:
          return assertNever(v);
      }
    };
    expect(acknowledge({ kind: "passed" })).toBe("passed");
    expect(acknowledge({ kind: "failed", reason: "x" })).toBe("failed");
    expect(acknowledge({ kind: "needs-revision", suggestions: [] })).toBe("needs-revision");
    expect(acknowledge({ kind: "infrastructure-error", reason: "x" })).toBe("infrastructure-error");
  });

  it("integration test: full closed-loop with realistic callback wiring", async () => {
    const hs = [hypothesis("h1-good", "alpha"), hypothesis("h2-good", "beta"), hypothesis("h3-bad", "gamma")];
    const callbacks: LoopCallbacks<SubstrateT> = {
      dispatchCi: mixedCi,
      rankSurvivors: identityRank,
      evolveSurvivors: mockEvolve,
    };
    const termination = await runLoop(hs, callbacks, { ...DEFAULT_LOOP_CONFIG, maxCycles: 2 });
    // Cycle 0: h3-bad fails, h1-good + h2-good propagate, evolve to 1 variant
    //   ("evolved-cycle-1") via mockEvolve.
    // Cycle 1: mixedCi falls through to "failed" for "evolved-cycle-*" ids
    //   (no -good/-bad/-revise suffix), so propagatable.length = 0 < minPropagatable=1.
    //   Terminates deterministically as insufficient-propagatable at cycle 1.
    expect(termination.terminatedAtCycle).toBe(1);
    expect(termination.reason).toBe("insufficient-propagatable");
    expect(termination.feedback?.kind).toBe("InsufficientPropagatable");
  });
});
