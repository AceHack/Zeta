/**
 * src/Core.TypeScript/workflow-engine/evolution.ts
 *
 * B-0914.5 — pure-TS evolution agent (mash + refine surviving substrate)
 * for workflow engine. Pure function over ranked survivors → refined
 * variants per the co-scientist evolution agent pattern.
 *
 * Source: Google co-scientist evolution agent (Nature 2026) — takes
 * surviving hypotheses + mashes them together to create refined
 * variants. Bridges logical gaps; iteratively refines high-quality
 * substrate.
 *
 * Substrate-engineering composition:
 *   - Closes the tournament loop with TrueSkill (PR #5764):
 *     1. Generate hypotheses (LLM call; out of scope for this file)
 *     2. Rank via TrueSkill (B-0914.1 — shipped)
 *     3. Take top-N survivors
 *     4. Mash + refine (THIS FILE — B-0914.5)
 *     5. Loop back to step 2 with refined variants
 *
 * Per Aaron 2026-05-28 'S M L all please in that order lol' — this is
 * the SMALL substrate-engineering work in the sequence; pure function;
 * tight scope; composes with TrueSkill substrate.
 *
 * Composes with:
 *   - B-0914.5 backlog row (evolution agent extension)
 *   - B-0914.1 (PR #5764) TrueSkill substrate (ranking input)
 *   - B-0867 workflow engine substrate (future ActionClass 'evolve-via-mash-refine')
 *   - .claude/rules/additive-not-zero-sum.md (substrate compounds via composition)
 *   - .claude/rules/honor-those-that-came-before.md (survivors' substrate preserved)
 *   - .claude/rules/monad-propagation-pattern (Result<T, TFeedback>)
 *   - .claude/rules/asymmetric-authorship (TFeedback authored by function)
 *
 * PoC scope: pure function over typed survivors with 3 composition
 * strategies (simple-merge / cross-pollinate / mutate). Attribute-level
 * composition rather than semantic-level (semantic composition would
 * require LLM call; deferred to integration layer).
 */
export function evolveSurvivors(context) {
    if (context.survivors.length === 0) {
        return { ok: false, feedback: { kind: "EmptySurvivorSet" } };
    }
    const prefix = context.variantIdPrefix ?? "evolved";
    switch (context.strategy) {
        case "simple-merge": {
            if (context.survivors.length < 2) {
                return {
                    ok: false,
                    feedback: { kind: "InsufficientSurvivors", required: 2, provided: context.survivors.length },
                };
            }
            const top = context.survivors[0];
            const next = context.survivors[1];
            const merged = { ...top.substrate };
            // Fill any undefined keys from next-ranked survivor
            for (const key of Object.keys(next.substrate)) {
                if (merged[key] === undefined) {
                    merged[key] = next.substrate[key];
                }
            }
            return {
                ok: true,
                variants: [
                    {
                        id: `${prefix}-merge-${top.id}-${next.id}`,
                        substrate: merged,
                        derivedFrom: [top.id, next.id],
                        strategy: "simple-merge",
                        composesWith: [...top.composesWith, ...next.composesWith, "B-0914.5"],
                    },
                ],
            };
        }
        case "cross-pollinate": {
            if (context.survivors.length < 2) {
                return {
                    ok: false,
                    feedback: { kind: "InsufficientSurvivors", required: 2, provided: context.survivors.length },
                };
            }
            const top = context.survivors[0];
            const next = context.survivors[1];
            const crossed = {};
            // Interleave attributes: even-indexed keys from top, odd-indexed from next
            const allKeys = Array.from(new Set([...Object.keys(top.substrate), ...Object.keys(next.substrate)])).sort();
            for (let i = 0; i < allKeys.length; i++) {
                const key = allKeys[i];
                const source = i % 2 === 0 ? top.substrate : next.substrate;
                const fallback = i % 2 === 0 ? next.substrate : top.substrate;
                const sourceVal = source[key];
                crossed[key] = sourceVal !== undefined ? sourceVal : fallback[key];
            }
            return {
                ok: true,
                variants: [
                    {
                        id: `${prefix}-cross-${top.id}-${next.id}`,
                        substrate: crossed,
                        derivedFrom: [top.id, next.id],
                        strategy: "cross-pollinate",
                        composesWith: [...top.composesWith, ...next.composesWith, "B-0914.5"],
                    },
                ],
            };
        }
        case "mutate": {
            const top = context.survivors[0];
            if (!context.mutator) {
                return {
                    ok: false,
                    feedback: {
                        kind: "MergeConflict",
                        survivorId: top.id,
                        reason: "mutate strategy requires mutator callback in EvolutionContext",
                    },
                };
            }
            const mutated = context.mutator(top.substrate);
            return {
                ok: true,
                variants: [
                    {
                        id: `${prefix}-mut-${top.id}`,
                        substrate: mutated,
                        derivedFrom: [top.id],
                        strategy: "mutate",
                        composesWith: [...top.composesWith, "B-0914.5"],
                    },
                ],
            };
        }
    }
}
/**
 * Convenience: take top-N TrueSkill-ranked items + evolve them per
 * the chosen strategy.
 *
 * Composes with TrueSkill substrate (B-0914.1; PR #5764):
 * caller sorts items by `conservativeSkill(rating)` descending, slices
 * top-N, passes to this function.
 */
export function evolveTopN(survivors, n, strategy, options) {
    const topN = survivors.slice(0, n);
    return evolveSurvivors({
        survivors: topN,
        strategy,
        ...(options?.mergeAttribute && { mergeAttribute: options.mergeAttribute }),
        ...(options?.mutator && { mutator: options.mutator }),
        ...(options?.variantIdPrefix && { variantIdPrefix: options.variantIdPrefix }),
    });
}
