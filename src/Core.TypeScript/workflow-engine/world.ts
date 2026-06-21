/**
 * src/Core.TypeScript/workflow-engine/world.ts
 *
 * World substrate + reusable lifetime composition helpers.
 *
 * Per the human maintainer (2026-05-28) two substantive substrate-engineering
 * questions:
 * 1. 'do you have to write custom code everytime you compose two lifetimes'
 * 2. '(do we still call the shared git flow a lifetime or world or
 *    shared space?)'
 *
 * Substrate-engineering naming substrate (acknowledged by the human
 * maintainer): use 'WORLD' for the shared git-flow substrate where
 * multiple lifetimes interact. Different scope from 'lifetime'
 * (per-substrate-entity DU); world contains lifetimes; lifetime
 * composition happens IN the world.
 *
 * Substrate-engineering substrate-reusability substrate (answers Q1):
 * dispatch substrate is REUSABLE; only the matrix is per-pair. This file
 * ships reusable helpers + matrix-builder substrate that factors
 * recurring transition patterns (advance/block/complete) so caller
 * doesn't write custom code per lifetime pair when patterns recur.
 *
 * Composes with:
 *   - src/Core.TypeScript/workflow-engine/composed-lifetime.ts (PR #5771) — base dispatch
 *   - 081KRCQQF0008QG0R0008VT354 Clifford-algebraic narrative engine for Pauli-symmetry-
 *     breaking-from-agenda-conservation prediction (civ-sim / game-world
 *     substrate-engineering target this world substrate composes with)
 *   - 081KSKBP80008QG0R000B3Y19A workflow engine (multiple lifetimes interact in workflow world)
 *   - 13th-ferry §33.7 multi-AI cascade (each AI inhabits the world)
 *   - .claude/rules/additive-not-zero-sum (world substrate compounds)
 *   - .claude/rules/honor-those-that-came-before (lifetime variants
 *     preserved in world substrate when adding new ones)
 *   - .claude/rules/monad-propagation-pattern (Result<T, TFeedback>)
 *
 * Naming canon (the human maintainer, 2026-05-28):
 *   - LIFETIME = editable per-substrate-entity DU (per the human
 *     maintainer's earlier 'lifetime not lifecycle because you can edit
 *     it FYI the DUs')
 *   - WORLD = shared substrate where multiple lifetimes interact
 *   - GIT FLOW = operational form of the world (substrate-engineering
 *     substrate the world IS realized as)
 */

import {
  buildComposedMatrix,
  composeFromDispatcher,
  composeKey,
  dispatchComposed,
  type ComposedKey,
  type ComposedLifetimeContext,
  type LifetimeState,
  type TransitionFeedback,
  type TransitionResult,
} from "./composed-lifetime";

// Re-export the composed-lifetime substrate as part of the world substrate
// (callers compose with world.ts for both naming + helpers).
export {
  buildComposedMatrix,
  composeFromDispatcher,
  composeKey,
  dispatchComposed,
  type ComposedKey,
  type ComposedLifetimeContext,
  type LifetimeState,
  type TransitionFeedback,
  type TransitionResult,
};

/**
 * World — the shared substrate where multiple lifetimes interact.
 *
 * Per the human maintainer (2026-05-28) naming substrate-engineering:
 * 'world' is the shared git-flow substrate. Different scope from
 * per-substrate-entity lifetimes; world contains lifetimes + their
 * composition rules.
 *
 * Generic over the named lifetimes the world contains. PoC scope:
 * world holds a registry of composed-lifetime matrices keyed by
 * lifetime-pair name. Caller registers matrices when introducing new
 * lifetime pairs; dispatch lookups go through the world's registry.
 *
 * Type-safety scope-disclosure (substrate-honest): `registry` stores
 * matrices erased to `ReadonlyMap<string, unknown>` keyed by pair-name
 * string. `lookupLifetimePair<A, B, T>` + `dispatchInWorld<A, B, T>`
 * cast at the lookup boundary using the generic arguments the caller
 * supplies — TypeScript accepts the cast regardless of what the
 * registered matrix actually holds. This means a caller can register
 * one verdict type under `"pair-a"` and later look it up with a
 * different `T` without a compile error; the runtime shape will not
 * match the type the caller expects.
 *
 * Substrate-engineering target (not PoC scope): a typed-token API
 * (`PairToken<A, B, T>` carrying phantom-type witnesses; `definePair`
 * + `registerPair` + `lookupPair` taking tokens; `dispatchByToken`)
 * would preserve types end-to-end. The existing string-keyed surface
 * stays as escape-hatch for substrate-engineering work that needs
 * the string-key shape (e.g., dynamic registration from config /
 * external substrate). Production callers should reach for the typed
 * substrate when it lands; the string-keyed surface earns its keep
 * during PoC + as an explicit-cast escape-hatch only.
 */
export interface World {
  readonly registry: ReadonlyMap<string, ReadonlyMap<string, unknown>>;
}

/**
 * Empty world — no lifetime pairs registered.
 */
export const EMPTY_WORLD: World = {
  registry: new Map(),
};

/**
 * Standard transition verdict — used across MANY lifetime pairs.
 *
 * Substrate-engineering substrate-honesty: the recurring verbs are
 * advance / block / complete / no-op / escalate. This discriminated
 * union factors out the recurring vocabulary so per-pair matrices
 * reuse it instead of inventing parallel verdict types.
 *
 * Per the human maintainer (2026-05-28) substrate-engineering question
 * 'do you have to write custom code everytime' — NO; this StandardVerdict
 * factors out the recurring substrate so most lifetime pairs reuse it.
 */
export type StandardVerdict =
  | { kind: "advance" }
  | { kind: "block"; reason: string }
  | { kind: "complete" }
  | { kind: "no-op" }
  | { kind: "escalate-to-operator"; reason: string };

/**
 * Register a composed-lifetime matrix in the world.
 *
 * Returns a NEW world (immutable substrate per asymmetric-authorship);
 * world authors its own substrate via consent-channel.
 *
 * Generic over `W extends World` so callers passing a specialized
 * subclass (GitWorld / GitHubWorld / GitLabWorld / etc.) receive the
 * SAME specialized type back with subclass fields (forgeName,
 * branchUniverse, prUniverse, etc.) preserved. Returning a bare
 * `World` here would silently drop those fields under structural
 * typing — caller would see them disappear despite the function
 * signature claiming a `World` round-trip.
 */
export function registerLifetimePair<W extends World, A extends LifetimeState, B extends LifetimeState, T>(
  world: W,
  pairName: string,
  matrix: ReadonlyMap<ComposedKey<A, B>, T>,
): W {
  const newRegistry = new Map(world.registry);
  newRegistry.set(pairName, matrix as ReadonlyMap<string, unknown>);
  return { ...world, registry: newRegistry };
}

/**
 * Look up a composed-lifetime matrix by pair name.
 *
 * Returns undefined if pair not registered.
 */
export function lookupLifetimePair<A extends LifetimeState, B extends LifetimeState, T>(
  world: World,
  pairName: string,
): ReadonlyMap<ComposedKey<A, B>, T> | undefined {
  return world.registry.get(pairName) as ReadonlyMap<ComposedKey<A, B>, T> | undefined;
}

/**
 * Reusable matrix builder: every-pair → advance.
 *
 * Caller often wants the common case of "all valid transitions advance;
 * the matrix surfaces only the EXCEPTIONS (block / complete / no-op)."
 * This helper builds the advance-by-default matrix; caller overrides
 * specific cells with block/complete as needed.
 *
 * Substrate-engineering substrate-reusability: factors out the recurring
 * "every-cell-defaults-to-advance" pattern so caller doesn't write the
 * cross-product manually.
 */
export function defaultAdvanceMatrix<A extends LifetimeState, B extends LifetimeState>(
  universeA: ReadonlyArray<A>,
  universeB: ReadonlyArray<B>,
  overrides?: ReadonlyMap<ComposedKey<A, B>, StandardVerdict>,
): ReadonlyMap<ComposedKey<A, B>, StandardVerdict> {
  const result = new Map<ComposedKey<A, B>, StandardVerdict>();
  for (const a of universeA) {
    for (const b of universeB) {
      const key = composeKey(a, b);
      const override = overrides?.get(key);
      result.set(key, override ?? { kind: "advance" });
    }
  }
  return result;
}

/**
 * Reusable matrix builder: terminal state at specific cell.
 *
 * Substrate-engineering shortcut: when a single (A, B) cell signals
 * "the lifetime composition terminates here with `complete` verdict",
 * this builds the matrix from defaults + the terminal cell.
 */
export function terminalMatrix<A extends LifetimeState, B extends LifetimeState>(
  universeA: ReadonlyArray<A>,
  universeB: ReadonlyArray<B>,
  terminalA: A,
  terminalB: B,
  blockReason?: string,
): ReadonlyMap<ComposedKey<A, B>, StandardVerdict> {
  const overrides = new Map<ComposedKey<A, B>, StandardVerdict>();
  overrides.set(composeKey(terminalA, terminalB), { kind: "complete" });
  // Block all OTHER cells where A is at the terminal state (can't go elsewhere)
  for (const b of universeB) {
    if (b.kind !== terminalB.kind) {
      const key = composeKey(terminalA, b);
      overrides.set(key, {
        kind: "block",
        reason: blockReason ?? `terminal A=${terminalA.kind}; can't transition B≠${terminalB.kind}`,
      });
    }
  }
  return defaultAdvanceMatrix(universeA, universeB, overrides);
}

/**
 * Reusable matrix builder: gate matrix from a predicate.
 *
 * Most general helper: dispatch verdict per-cell via predicate. Used
 * when transitions follow a SIMPLE PATTERN expressible in code rather
 * than enumerated by hand.
 *
 * Composes with composeFromDispatcher; this is the StandardVerdict-typed
 * specialization.
 */
export function predicateMatrix<A extends LifetimeState, B extends LifetimeState>(
  universeA: ReadonlyArray<A>,
  universeB: ReadonlyArray<B>,
  predicate: (a: A, b: B) => StandardVerdict,
): ReadonlyMap<ComposedKey<A, B>, StandardVerdict> {
  const result = new Map<ComposedKey<A, B>, StandardVerdict>();
  for (const a of universeA) {
    for (const b of universeB) {
      const verdict = predicate(a, b);
      result.set(composeKey(a, b), verdict);
    }
  }
  return result;
}

/**
 * World-level dispatch feedback — extends base TransitionFeedback with
 * the unregistered-pair failure mode unique to world-scope dispatch.
 *
 * Per asymmetric-authorship: substrate-entity (the world) authors the
 * complete TFeedback channel its callers must handle. Exporting this
 * union lets downstream consumers do exhaustive `switch` on the full
 * world-dispatch feedback shape instead of ad-hoc narrowing on an
 * inline return-type extension. Composes with base TransitionFeedback
 * (per composed-lifetime.ts) which covers the lower-level
 * undefined-transition / invalid-state-A / invalid-state-B classes.
 */
export type WorldTransitionFeedback = TransitionFeedback | { kind: "UnregisteredPair"; pairName: string };

/**
 * World-level dispatch result-shape per monad-propagation rule.
 *
 * Wraps the verdict-or-feedback discriminated union so callers can
 * pattern-match exhaustively on a single named type instead of
 * stitching together base TransitionResult + the world-extension.
 */
export type WorldTransitionResult<T> =
  | { ok: true; verdict: T; fromKey: string }
  | { ok: false; feedback: WorldTransitionFeedback };

/**
 * World-level dispatch: look up the matrix by pair name + dispatch
 * the composed transition.
 *
 * Per asymmetric-authorship: substrate-entity (the world) authors what
 * lifetime pairs it knows about; caller acknowledges by registering
 * pairs before dispatch.
 */
export function dispatchInWorld<A extends LifetimeState, B extends LifetimeState, T>(
  world: World,
  pairName: string,
  a: A,
  b: B,
): WorldTransitionResult<T> {
  const matrix = lookupLifetimePair<A, B, T>(world, pairName);
  if (matrix === undefined) {
    return { ok: false, feedback: { kind: "UnregisteredPair", pairName } };
  }
  return dispatchComposed<A, B, T>({ matrix }, a, b);
}
