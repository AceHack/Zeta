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
 *   - B-0422 Clifford-algebraic narrative engine for Pauli-symmetry-
 *     breaking-from-agenda-conservation prediction (civ-sim / game-world
 *     substrate-engineering target this world substrate composes with)
 *   - B-0867 workflow engine (multiple lifetimes interact in workflow world)
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
import { buildComposedMatrix, composeFromDispatcher, composeKey, dispatchComposed, } from "./composed-lifetime";
// Re-export the composed-lifetime substrate as part of the world substrate
// (callers compose with world.ts for both naming + helpers).
export { buildComposedMatrix, composeFromDispatcher, composeKey, dispatchComposed, };
/**
 * Empty world — no lifetime pairs registered.
 */
export const EMPTY_WORLD = {
    registry: new Map(),
};
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
export function registerLifetimePair(world, pairName, matrix) {
    const newRegistry = new Map(world.registry);
    newRegistry.set(pairName, matrix);
    return { ...world, registry: newRegistry };
}
/**
 * Look up a composed-lifetime matrix by pair name.
 *
 * Returns undefined if pair not registered.
 */
export function lookupLifetimePair(world, pairName) {
    return world.registry.get(pairName);
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
export function defaultAdvanceMatrix(universeA, universeB, overrides) {
    const result = new Map();
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
export function terminalMatrix(universeA, universeB, terminalA, terminalB, blockReason) {
    const overrides = new Map();
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
export function predicateMatrix(universeA, universeB, predicate) {
    const result = new Map();
    for (const a of universeA) {
        for (const b of universeB) {
            const verdict = predicate(a, b);
            result.set(composeKey(a, b), verdict);
        }
    }
    return result;
}
/**
 * World-level dispatch: look up the matrix by pair name + dispatch
 * the composed transition.
 *
 * Per asymmetric-authorship: substrate-entity (the world) authors what
 * lifetime pairs it knows about; caller acknowledges by registering
 * pairs before dispatch.
 */
export function dispatchInWorld(world, pairName, a, b) {
    const matrix = lookupLifetimePair(world, pairName);
    if (matrix === undefined) {
        return { ok: false, feedback: { kind: "UnregisteredPair", pairName } };
    }
    return dispatchComposed({ matrix }, a, b);
}
