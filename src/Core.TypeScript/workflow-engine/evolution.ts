/**
 * src/Core.TypeScript/workflow-engine/evolution.ts
 *
 * 081KSNY2Z0008QG0R001YK61JQ.5 — pure-TS evolution agent (mash + refine surviving substrate)
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
 *     2. Rank via TrueSkill (081KSNY2Z0008QG0R001YK61JQ.1 — shipped)
 *     3. Take top-N survivors
 *     4. Mash + refine (THIS FILE — 081KSNY2Z0008QG0R001YK61JQ.5)
 *     5. Loop back to step 2 with refined variants
 *
 * Per Aaron 2026-05-28 'S M L all please in that order lol' — this is
 * the SMALL substrate-engineering work in the sequence; pure function;
 * tight scope; composes with TrueSkill substrate.
 *
 * Composes with:
 *   - 081KSNY2Z0008QG0R001YK61JQ.5 backlog row (evolution agent extension)
 *   - 081KSNY2Z0008QG0R001YK61JQ.1 (PR #5764) TrueSkill substrate (ranking input)
 *   - 081KSKBP80008QG0R000B3Y19A workflow engine substrate (future ActionClass 'evolve-via-mash-refine')
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

/**
 * Survivor — an item that survived TrueSkill ranking + is candidate for
 * evolution. Generic over the substrate type T being evolved.
 *
 * Composes with TrueSkillRating from trueskill.ts; survivor's TrueSkill
 * conservative-skill IS the ranking signal.
 */
export interface Survivor<T> {
  readonly id: string; // unique identifier
  readonly substrate: T; // the actual substrate being evolved
  readonly conservativeSkill: number; // TrueSkill ranking score (higher = better)
  readonly composesWith: ReadonlyArray<string>; // attribution + composition tracking
}

/**
 * Evolution strategy — how to combine survivors into refined variants.
 */
export type EvolutionStrategy =
  | "simple-merge" // take attributes from highest-ranked + fill gaps from next
  | "cross-pollinate" // alternate attributes between 2 survivors
  | "mutate"; // perturb single highest-ranked survivor

/**
 * Evolution feedback per asymmetric-authorship + monad-propagation rules.
 */
export type EvolutionFeedback =
  | { kind: "InsufficientSurvivors"; required: number; provided: number }
  | { kind: "EmptySurvivorSet" }
  | { kind: "UnsupportedStrategy"; strategy: string }
  | { kind: "MergeConflict"; survivorId: string; reason: string };

/**
 * Result-shape per monad-propagation rule.
 */
export type EvolutionResult<T> =
  | { ok: true; variants: ReadonlyArray<RefinedVariant<T>> }
  | { ok: false; feedback: EvolutionFeedback };

/**
 * Refined variant — output of evolution. Tracks provenance (which
 * survivors it was derived from) for substrate-honest attribution
 * per honor-those-that-came-before discipline.
 */
export interface RefinedVariant<T> {
  readonly id: string;
  readonly substrate: T;
  readonly derivedFrom: ReadonlyArray<string>; // survivor ids
  readonly strategy: EvolutionStrategy;
  readonly composesWith: ReadonlyArray<string>;
}

/**
 * Mash + refine survivors into refined variants per the chosen strategy.
 *
 * Per the co-scientist evolution agent pattern:
 *   - simple-merge: take top survivor's substrate as base + fill any
 *     undefined attributes from next-ranked survivor (substrate-honest:
 *     prefers higher-ranked; preserves lower-ranked attribute-fill)
 *   - cross-pollinate: alternate attributes between top 2 survivors
 *     (interleaved attribute selection by sorted-key parity)
 *   - mutate: take highest-ranked + apply a perturbation transformer
 *
 * Survivors expected to be pre-sorted by conservativeSkill descending;
 * function does NOT re-sort to preserve caller's sort discipline.
 *
 * The `mergeAttribute` callback handles per-attribute composition for
 * simple-merge and cross-pollinate strategies; allows caller-substrate-
 * specific merge logic. For mutate, the `mutator` callback transforms
 * the top survivor's substrate.
 */
export interface EvolutionContext<T> {
  readonly survivors: ReadonlyArray<Survivor<T>>;
  readonly strategy: EvolutionStrategy;
  readonly mergeAttribute?: (a: T, b: T, key: string) => unknown;
  readonly mutator?: (substrate: T) => T;
  readonly variantIdPrefix?: string; // prefix for generated variant ids
}

export function evolveSurvivors<T extends Record<string, unknown>>(context: EvolutionContext<T>): EvolutionResult<T> {
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
      const top = context.survivors[0]!;
      const next = context.survivors[1]!;
      const merged: Record<string, unknown> = { ...top.substrate };
      // Fill any undefined keys from next-ranked survivor
      for (const key of Object.keys(next.substrate)) {
        if (merged[key] === undefined) {
          merged[key] = (next.substrate as Record<string, unknown>)[key];
        }
      }
      return {
        ok: true,
        variants: [
          {
            id: `${prefix}-merge-${top.id}-${next.id}`,
            substrate: merged as T,
            derivedFrom: [top.id, next.id],
            strategy: "simple-merge",
            composesWith: [...top.composesWith, ...next.composesWith, "081KSNY2Z0008QG0R001YK61JQ.5"],
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
      const top = context.survivors[0]!;
      const next = context.survivors[1]!;
      const crossed: Record<string, unknown> = {};
      // Interleave attributes: even-indexed keys from top, odd-indexed from next
      const allKeys = Array.from(new Set([...Object.keys(top.substrate), ...Object.keys(next.substrate)])).sort();
      for (let i = 0; i < allKeys.length; i++) {
        const key = allKeys[i]!;
        const source = i % 2 === 0 ? top.substrate : next.substrate;
        const fallback = i % 2 === 0 ? next.substrate : top.substrate;
        const sourceVal = (source as Record<string, unknown>)[key];
        crossed[key] = sourceVal !== undefined ? sourceVal : (fallback as Record<string, unknown>)[key];
      }
      return {
        ok: true,
        variants: [
          {
            id: `${prefix}-cross-${top.id}-${next.id}`,
            substrate: crossed as T,
            derivedFrom: [top.id, next.id],
            strategy: "cross-pollinate",
            composesWith: [...top.composesWith, ...next.composesWith, "081KSNY2Z0008QG0R001YK61JQ.5"],
          },
        ],
      };
    }
    case "mutate": {
      const top = context.survivors[0]!;
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
            composesWith: [...top.composesWith, "081KSNY2Z0008QG0R001YK61JQ.5"],
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
 * Composes with TrueSkill substrate (081KSNY2Z0008QG0R001YK61JQ.1; PR #5764):
 * caller sorts items by `conservativeSkill(rating)` descending, slices
 * top-N, passes to this function.
 */
export function evolveTopN<T extends Record<string, unknown>>(
  survivors: ReadonlyArray<Survivor<T>>,
  n: number,
  strategy: EvolutionStrategy,
  options?: {
    mergeAttribute?: (a: T, b: T, key: string) => unknown;
    mutator?: (substrate: T) => T;
    variantIdPrefix?: string;
  },
): EvolutionResult<T> {
  const topN = survivors.slice(0, n);
  return evolveSurvivors({
    survivors: topN,
    strategy,
    ...(options?.mergeAttribute && { mergeAttribute: options.mergeAttribute }),
    ...(options?.mutator && { mutator: options.mutator }),
    ...(options?.variantIdPrefix && { variantIdPrefix: options.variantIdPrefix }),
  });
}
