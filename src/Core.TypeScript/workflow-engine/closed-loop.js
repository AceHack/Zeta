/**
 * src/Core.TypeScript/workflow-engine/closed-loop.ts
 *
 * B-0914.2 — closed-loop CI-result → next-hypothesis dispatch
 * orchestrator. Pure-TS substrate that composes:
 *   - TrueSkill ranking (B-0914.1 PR #5764)
 *   - Evolution mash-refine (B-0914.5 PR #5767)
 *   - Pairing tracker (B-0914.4 PR #5768)
 *   - CI-result dispatch (via callbacks; integrates with B-0891 zflash
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
 *   - B-0914.2 backlog row (closed-loop dispatch extension target)
 *   - B-0914.1 PR #5764 TrueSkill substrate (caller provides ranking fn)
 *   - B-0914.4 PR #5768 pairing tracker substrate (caller provides
 *     verification fn + pairing state)
 *   - B-0914.5 PR #5767 evolution substrate (caller provides evolution fn)
 *   - B-0891 zflash test-harness substrate (caller can wire CI dispatch
 *     to actual test runners per determineRunnability discriminator)
 *   - B-0867 workflow engine substrate
 *   - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
 *     (Result<T, TFeedback>)
 *   - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md
 *     (each callback authors own TFeedback)
 *
 * PoC scope: pure orchestration logic with injectable callbacks. Real
 * CI integration (via tools/ci/ + B-0891) handled by caller wiring.
 */
export const DEFAULT_LOOP_CONFIG = {
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
export async function runCycle(hypotheses, callbacks, cycleIndex, config = DEFAULT_LOOP_CONFIG) {
    if (hypotheses.length === 0) {
        return { ok: false, feedback: { kind: "EmptyHypothesisSet" } };
    }
    // Step 1+2: dispatch to CI + collect verdicts
    const verdicts = [];
    for (const h of hypotheses) {
        try {
            const verdict = await callbacks.dispatchCi(h);
            verdicts.push({ hypothesis: h, verdict });
        }
        catch (err) {
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
    const propagatable = [];
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
    let ranked;
    try {
        ranked = await callbacks.rankSurvivors(propagatable);
    }
    catch (err) {
        return {
            ok: false,
            feedback: { kind: "RankingFailure", reason: err instanceof Error ? err.message : String(err) },
        };
    }
    // Step 5: evolve top-N via caller-injected evolution
    const topN = ranked.slice(0, config.topNToEvolve);
    let refined;
    try {
        refined = await callbacks.evolveSurvivors(topN, cycleIndex + 1);
    }
    catch (err) {
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
export async function runLoop(initialHypotheses, callbacks, config = DEFAULT_LOOP_CONFIG, shouldContinue) {
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
