/**
 * src/Core.TypeScript/workflow-engine/closed-loop.ts
 *
 * 081KSNY2Z0008QG0R001YK61JQ.2 — closed-loop CI-result → next-hypothesis dispatch
 * orchestrator. Pure-TS substrate that composes:
 *   - TrueSkill ranking (081KSNY2Z0008QG0R001YK61JQ.1 PR #5764)
 *   - Evolution mash-refine (081KSNY2Z0008QG0R001YK61JQ.5 PR #5767)
 *   - Pairing tracker (081KSNY2Z0008QG0R001YK61JQ.4 PR #5768)
 *   - CI-result dispatch (via callbacks; integrates with 081KSNY2Z0008QG0R0008PN7RQ zflash
 *     test-harness substrate when wired by caller)
 *
 * Per human maintainer 2026-05-28 'S M L all please in that order lol' — L
 * (large scope) in the substrate-engineering ship-sequence. Wire-up that
 * turns the tournament-loop substrate into a live closed-loop iteration
 * system.
 *
 * Design: pure loop-orchestration substrate with INJECTABLE callbacks
 * for substrate-specific operations (ranking / evolution / verification).
 * Caller provides the functions; orchestrator handles loop structure +
 * propagation discipline. This separation-of-concerns means the
 * orchestrator does NOT tightly couple to specific TrueSkill / evolution
 * / pairing module implementations — it composes with ANY substrate that
 * implements the callback contracts.
 *
 * Source: Sakana Robin closed-loop (Crow + Falcon + Finch with raw-data
 * analysis feeding back to new hypothesis generation; Nature 2026
 * s41586-026-10652-y).
 *
 * Composes with:
 *   - 081KSNY2Z0008QG0R001YK61JQ.2 backlog row (closed-loop dispatch extension target)
 *   - 081KSNY2Z0008QG0R001YK61JQ.1 PR #5764 TrueSkill substrate (caller provides ranking fn)
 *   - 081KSNY2Z0008QG0R001YK61JQ.4 PR #5768 pairing tracker substrate (caller provides
 *     verification fn + pairing state)
 *   - 081KSNY2Z0008QG0R001YK61JQ.5 PR #5767 evolution substrate (caller provides evolution fn)
 *   - 081KSNY2Z0008QG0R0008PN7RQ zflash test-harness substrate (caller can wire CI dispatch
 *     to actual test runners per determineRunnability discriminator)
 *   - 081KSKBP80008QG0R000B3Y19A workflow engine substrate
 *   - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
 *     (Result<T, TFeedback>)
 *   - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md
 *     (each callback authors own TFeedback)
 *
 * PoC scope: pure orchestration logic with injectable callbacks. Real
 * CI integration (via tools/ci/ + 081KSNY2Z0008QG0R0008PN7RQ) handled by caller wiring.
 */

/**
 * Hypothesis — generic substrate item flowing through the tournament loop.
 */
export interface Hypothesis<T> {
  readonly id: string;
  readonly substrate: T;
  readonly cycleIndex: number; // which loop iteration generated this
  readonly derivedFrom: ReadonlyArray<string>; // ancestry chain
  readonly composesWith: ReadonlyArray<string>;
}

/**
 * CI verdict — outcome of dispatching a hypothesis to CI/test runner.
 *
 * Per asymmetric-authorship: CI-substrate-entity authors its own
 * feedback channel; orchestrator acknowledges via dispatch.
 */
export type CiVerdict =
  | { kind: "passed"; notes?: string }
  | { kind: "failed"; reason: string }
  | { kind: "needs-revision"; suggestions: ReadonlyArray<string> }
  | { kind: "infrastructure-error"; reason: string }; // blocked-on-runnability

/**
 * Closed-loop feedback per monad-propagation rule.
 */
export type LoopFeedback =
  | { kind: "EmptyHypothesisSet" }
  | { kind: "CiDispatchFailure"; hypothesisId: string; reason: string }
  | { kind: "RankingFailure"; reason: string }
  | { kind: "EvolutionFailure"; reason: string }
  | { kind: "InsufficientPropagatable"; propagatableCount: number; minRequired: number; cycleIndex: number }
  | { kind: "MaxCyclesReached"; cyclesCompleted: number };

/**
 * Result-shape per monad-propagation rule.
 */
export type LoopResult<T> =
  | { ok: true; refined: ReadonlyArray<Hypothesis<T>>; cycleIndex: number }
  | { ok: false; feedback: LoopFeedback };

/**
 * Closed-loop callbacks — substrate-entity-injected functions per
 * asymmetric-authorship discipline (each callback's substrate-entity
 * authors its own feedback channel).
 */
export interface LoopCallbacks<T> {
  /**
   * Dispatch a hypothesis to CI substrate (e.g. tools/ci/qemu-full-install-test.ts
   * per 081KSNY2Z0008QG0R0008PN7RQ zflash). Returns verdict that determines pairing-tracker recording.
   */
  readonly dispatchCi: (h: Hypothesis<T>) => Promise<CiVerdict>;

  /**
   * Rank verified hypotheses via TrueSkill (or compatible substrate).
   * Returns hypotheses sorted descending by conservativeSkill.
   * Per 081KSNY2Z0008QG0R001YK61JQ.1 PR #5764 — caller wires rate1v1 + conservativeSkill.
   */
  readonly rankSurvivors: (verified: ReadonlyArray<Hypothesis<T>>) => Promise<ReadonlyArray<Hypothesis<T>>>;

  /**
   * Evolve top-N ranked survivors into refined variants.
   * Per 081KSNY2Z0008QG0R001YK61JQ.5 PR #5767 — caller wires evolveTopN.
   */
  readonly evolveSurvivors: (
    ranked: ReadonlyArray<Hypothesis<T>>,
    cycleIndex: number,
  ) => Promise<ReadonlyArray<Hypothesis<T>>>;
}

/**
 * Closed-loop configuration.
 */
export interface LoopConfig {
  readonly maxCycles: number; // bounded iteration; safety bound
  readonly topNToEvolve: number; // how many survivors per cycle to evolve
  readonly minPropagatable: number; // minimum survivors required to continue (else terminate)
}

export const DEFAULT_LOOP_CONFIG: LoopConfig = {
  maxCycles: 10,
  topNToEvolve: 3,
  minPropagatable: 1,
};

/**
 * Run a single closed-loop iteration cycle.
 *
 * Cycle steps:
 *   1. Dispatch each hypothesis to CI
 *   2. Collect verdicts
 *   3. Filter to verified + needs-revision-with-suggestions (propagatable)
 *   4. Rank via TrueSkill (caller-injected)
 *   5. Evolve top-N (caller-injected)
 *   6. Return refined variants for next cycle
 *
 * Per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`:
 * the loop is genuinely-active substrate work; not standing-by-empty.
 */
export async function runCycle<T>(
  hypotheses: ReadonlyArray<Hypothesis<T>>,
  callbacks: LoopCallbacks<T>,
  cycleIndex: number,
  config: LoopConfig = DEFAULT_LOOP_CONFIG,
): Promise<LoopResult<T>> {
  if (hypotheses.length === 0) {
    return { ok: false, feedback: { kind: "EmptyHypothesisSet" } };
  }

  // Step 1+2: dispatch to CI + collect verdicts
  const verdicts: Array<{ hypothesis: Hypothesis<T>; verdict: CiVerdict }> = [];
  for (const h of hypotheses) {
    try {
      const verdict = await callbacks.dispatchCi(h);
      verdicts.push({ hypothesis: h, verdict });
    } catch (err) {
      return {
        ok: false,
        feedback: {
          kind: "CiDispatchFailure",
          hypothesisId: h.id,
          reason: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  // Step 3: filter to propagatable (passed + needs-revision-with-suggestions)
  const propagatable: Hypothesis<T>[] = [];
  for (const { hypothesis, verdict } of verdicts) {
    switch (verdict.kind) {
      case "passed":
        propagatable.push(hypothesis);
        break;
      case "needs-revision":
        if (verdict.suggestions.length > 0) {
          propagatable.push(hypothesis);
        }
        break;
      case "failed":
        // Excluded from propagation per pairing-tracker propagatableEmissionIds rule
        break;
      case "infrastructure-error":
        // Excluded; infrastructure failures don't reflect hypothesis quality
        break;
    }
  }

  if (propagatable.length < config.minPropagatable) {
    return {
      ok: false,
      feedback: {
        kind: "InsufficientPropagatable",
        propagatableCount: propagatable.length,
        minRequired: config.minPropagatable,
        cycleIndex,
      },
    };
  }

  // Step 4: rank via caller-injected TrueSkill
  let ranked: ReadonlyArray<Hypothesis<T>>;
  try {
    ranked = await callbacks.rankSurvivors(propagatable);
  } catch (err) {
    return {
      ok: false,
      feedback: { kind: "RankingFailure", reason: err instanceof Error ? err.message : String(err) },
    };
  }

  // Step 5: evolve top-N via caller-injected evolution
  const topN = ranked.slice(0, config.topNToEvolve);
  let refined: ReadonlyArray<Hypothesis<T>>;
  try {
    refined = await callbacks.evolveSurvivors(topN, cycleIndex + 1);
  } catch (err) {
    return {
      ok: false,
      feedback: { kind: "EvolutionFailure", reason: err instanceof Error ? err.message : String(err) },
    };
  }

  return {
    ok: true,
    refined,
    cycleIndex: cycleIndex + 1,
  };
}

/**
 * Run multiple closed-loop iteration cycles until termination
 * condition (max cycles OR propagatable drops below minimum OR
 * caller-supplied predicate returns false).
 *
 * Returns the final cycle's refined hypotheses + the cycle count completed.
 */
export interface LoopTermination<T> {
  readonly terminatedAtCycle: number;
  readonly reason: "max-cycles" | "insufficient-propagatable" | "predicate-stopped" | "error";
  readonly finalHypotheses: ReadonlyArray<Hypothesis<T>>;
  readonly feedback?: LoopFeedback;
}

export async function runLoop<T>(
  initialHypotheses: ReadonlyArray<Hypothesis<T>>,
  callbacks: LoopCallbacks<T>,
  config: LoopConfig = DEFAULT_LOOP_CONFIG,
  shouldContinue?: (cycleIndex: number, current: ReadonlyArray<Hypothesis<T>>) => boolean,
): Promise<LoopTermination<T>> {
  let current = initialHypotheses;
  let cycleIndex = 0;

  while (cycleIndex < config.maxCycles) {
    if (shouldContinue && !shouldContinue(cycleIndex, current)) {
      return {
        terminatedAtCycle: cycleIndex,
        reason: "predicate-stopped",
        finalHypotheses: current,
      };
    }

    const result = await runCycle(current, callbacks, cycleIndex, config);
    if (!result.ok) {
      if (result.feedback.kind === "InsufficientPropagatable") {
        return {
          terminatedAtCycle: cycleIndex,
          reason: "insufficient-propagatable",
          finalHypotheses: current,
          feedback: result.feedback,
        };
      }
      return {
        terminatedAtCycle: cycleIndex,
        reason: "error",
        finalHypotheses: current,
        feedback: result.feedback,
      };
    }
    current = result.refined;
    cycleIndex = result.cycleIndex;
  }

  return {
    terminatedAtCycle: cycleIndex,
    reason: "max-cycles",
    finalHypotheses: current,
  };
}
