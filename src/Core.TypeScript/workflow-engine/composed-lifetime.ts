/**
 * src/Core.TypeScript/workflow-engine/composed-lifetime.ts
 *
 * Double-dispatch substrate for composing two editable-lifetime DUs.
 *
 * Per Aaron 2026-05-28: 'how can we do double dispatch in this system,
 * when you compose two lifecycles you need it' + 'the only reason i'm
 * confortable calling it a lifetime is becuase you can edit it FYI
 * the DUs.'
 *
 * Substantive substrate-engineering distinction (Aaron-named):
 *   - LIFECYCLE = fixed/final/locked at design time; substrate-engineering
 *     edits = breaking change
 *   - LIFETIME = editable substrate; DU variants can be added/removed/
 *     refactored over time; substrate evolves
 *
 * The editability IS what makes the substrate trustworthy enough to
 * call it a 'lifetime'. Composes with Mod 2 grammar-extension (081KSKBP80008QG0R000B3Y19A;
 * action grammar itself editable) + substrate-smoothness rule + asymmetric-
 * authorship (substrate-entity AUTHORS variants) + additive-not-zero-sum
 * + honor-those-that-came-before (prior variants preserved when adding new).
 *
 * Pattern 3 of 5 double-dispatch patterns (template-literal-type composed
 * key) — flat cross-product visibility; TS strict-mode enforces
 * exhaustiveness via `never`; each transition declares its own Result-shape
 * verdict.
 *
 * Composes with:
 *   - 081KSNY2Z0008QG0R003WFDCJ9 PR #5758 lifecycle DU split (rename target: lifetime DU split)
 *   - 081KSNY2Z0008QG0R001YK61JQ.2 PR #5769 closed-loop orchestrator (composed-lifetime
 *     dispatch via callback)
 *   - 081KSNY2Z0008QG0R001YK61JQ.4 PR #5768 pairing tracker (composed pairing+verification
 *     lifetime double-dispatch)
 *   - .claude/rules/monad-propagation-pattern (Result<T, TFeedback>)
 *   - .claude/rules/asymmetric-authorship (substrate-entity authors DU)
 *   - .claude/rules/substrate-smoothness-as-load-bearing-property
 *   - .claude/rules/additive-not-zero-sum (substrate evolves additively)
 *
 * PoC scope: pure-TS double-dispatch substrate with template-literal-type
 * composed key. Real workflow-engine integration deferred per
 * operator-substrate-direction.
 */

/**
 * Lifetime kind — the discriminator field for an editable-lifetime DU.
 *
 * Per Aaron 2026-05-28: the term 'lifetime' (vs 'lifecycle') signals
 * substrate-engineering EDITABILITY. Each lifetime DU has a `kind`
 * discriminator; variants can be added/removed over time per the
 * substrate-engineering substrate.
 */
export interface LifetimeState {
  readonly kind: string;
}

/**
 * Generic composed-key type — `${A["kind"]}:${B["kind"]}`.
 *
 * The `:` separator is the canonical composed-key delimiter; consistent
 * across substrate-engineering substrate.
 */
export type ComposedKey<A extends LifetimeState, B extends LifetimeState> = `${A["kind"]}:${B["kind"]}`;

/**
 * Compute composed-key from two lifetime states.
 *
 * Pure function; no side effects; composable via Result.bind.
 */
export function composeKey<A extends LifetimeState, B extends LifetimeState>(a: A, b: B): ComposedKey<A, B> {
  return `${a.kind}:${b.kind}` as ComposedKey<A, B>;
}

/**
 * Transition feedback per asymmetric-authorship + monad-propagation rules.
 */
export type TransitionFeedback =
  | { kind: "UndefinedComposedTransition"; composedKey: string }
  | { kind: "InvalidStateA"; reason: string }
  | { kind: "InvalidStateB"; reason: string };

/**
 * Result-shape per monad-propagation rule.
 */
export type TransitionResult<T> =
  | { ok: true; verdict: T; fromKey: string }
  | { ok: false; feedback: TransitionFeedback };

/**
 * Composed-lifetime dispatch context.
 *
 * Caller provides:
 *   - `matrix`: lookup table from composed-key → transition verdict
 *   - `defaultVerdict`: optional fallback for composed keys not in matrix
 *     (omitting → returns UndefinedComposedTransition for missing keys)
 *
 * The MATRIX form (Pattern 4) is used here as the substrate-engineering
 * substrate; supports adding/removing transitions as DUs evolve (per
 * Aaron's editable-lifetime substrate). Pattern 3 (template-literal-type
 * composed-key switch) is the runtime form; this MATRIX is the data form
 * that composes with Pattern 3 dispatch.
 */
export interface ComposedLifetimeContext<A extends LifetimeState, B extends LifetimeState, T> {
  readonly matrix: ReadonlyMap<ComposedKey<A, B>, T>;
  readonly defaultVerdict?: T;
}

/**
 * Dispatch a double-dispatch transition based on the composed key
 * `${a.kind}:${b.kind}`.
 *
 * Per Aaron 2026-05-28 substrate-engineering substrate: when composing
 * two editable-lifetime DUs, this is the dispatch function. Returns
 * Result-shape per monad-propagation discipline.
 */
export function dispatchComposed<A extends LifetimeState, B extends LifetimeState, T>(
  context: ComposedLifetimeContext<A, B, T>,
  a: A,
  b: B,
): TransitionResult<T> {
  // Input validation
  if (typeof a.kind !== "string" || a.kind.length === 0) {
    return { ok: false, feedback: { kind: "InvalidStateA", reason: `kind=${String(a.kind)}` } };
  }
  if (typeof b.kind !== "string" || b.kind.length === 0) {
    return { ok: false, feedback: { kind: "InvalidStateB", reason: `kind=${String(b.kind)}` } };
  }

  const key = composeKey(a, b);
  const verdict = context.matrix.get(key);
  if (verdict !== undefined) {
    return { ok: true, verdict, fromKey: key };
  }
  if (context.defaultVerdict !== undefined) {
    return { ok: true, verdict: context.defaultVerdict, fromKey: key };
  }
  return { ok: false, feedback: { kind: "UndefinedComposedTransition", composedKey: key } };
}

/**
 * Convenience: build a composed-lifetime matrix from a list of
 * `[composedKey, verdict]` tuples.
 *
 * Substrate-engineering convenience for declarative substrate-engineering
 * substrate — matrix as data; can be inspected, edited, serialized.
 *
 * Per the editable-lifetime substrate: adding new transitions = adding
 * new tuples to this list. Per substrate-smoothness: no if-statements
 * branch; pure data + dispatch function.
 */
export function buildComposedMatrix<A extends LifetimeState, B extends LifetimeState, T>(
  entries: ReadonlyArray<readonly [ComposedKey<A, B>, T]>,
): ReadonlyMap<ComposedKey<A, B>, T> {
  return new Map(entries);
}

/**
 * Compose a substrate-engineering matrix from a sparse cross-product —
 * caller provides `(a, b) → verdict` function for valid transitions +
 * the universe of A states + universe of B states; this function
 * computes the dense matrix.
 *
 * Returns the matrix + the count of undefined transitions (returning
 * undefined from the dispatcher → not added to matrix).
 *
 * Useful for substrate-engineering substrate where transitions are
 * sparse (most pairs undefined; few specific transitions valid).
 */
export function composeFromDispatcher<A extends LifetimeState, B extends LifetimeState, T>(
  universeA: ReadonlyArray<A>,
  universeB: ReadonlyArray<B>,
  dispatcher: (a: A, b: B) => T | undefined,
): { matrix: ReadonlyMap<ComposedKey<A, B>, T>; undefinedCount: number } {
  const entries: Array<[ComposedKey<A, B>, T]> = [];
  let undefinedCount = 0;
  for (const a of universeA) {
    for (const b of universeB) {
      const verdict = dispatcher(a, b);
      if (verdict !== undefined) {
        entries.push([composeKey(a, b), verdict]);
      } else {
        undefinedCount++;
      }
    }
  }
  return { matrix: new Map(entries), undefinedCount };
}
