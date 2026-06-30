/**
 * Workflow World substrate — the shared git-flow space where multiple
 * lifetimes interact.
 *
 * Port of `src/Core.TypeScript/workflow-engine/world.ts` (Merge1 §05).
 * The donor `World` is generic over a `composed-lifetime.ts` dispatch
 * substrate that is out of scope for this slice; per the §05 spec this
 * port lands the self-contained `World` registry + `StandardVerdict` +
 * `registerLifetimePair` surface (matching the §05 doc sketch) plus the
 * `GitWorld` specialization and the `ChangeControlPort` seam.
 *
 * Naming canon (the maintainer, 2026-05-28):
 *   - LIFETIME = editable per-substrate-entity DU
 *   - WORLD    = shared substrate where multiple lifetimes interact
 *   - GIT FLOW = operational form of the world
 */

/**
 * The shared substrate where multiple lifetimes interact. PoC scope: a
 * registry of composed-lifetime matrices keyed by lifetime-pair name.
 */
export interface World {
  readonly registry: ReadonlyMap<string, ReadonlyMap<string, unknown>>;
}

/** Empty world — no lifetime pairs registered. */
export const EMPTY_WORLD: World = { registry: new Map() };

/**
 * Standard transition verdict — the recurring vocabulary across lifetime
 * pairs (advance / block / complete / no-op / escalate).
 */
export type StandardVerdict =
  | { readonly kind: "advance" }
  | { readonly kind: "block"; readonly reason: string }
  | { readonly kind: "complete" }
  | { readonly kind: "no-op" }
  | { readonly kind: "escalate-to-operator"; readonly reason: string };

/**
 * Register a composed-lifetime matrix in the world.
 *
 * Returns a NEW world (immutable — retraction-native). Generic over
 * `W extends World` so callers passing a specialized subclass
 * (GitWorld / GitHubWorld / GitLabWorld) receive the SAME specialized
 * type back with subclass fields preserved.
 */
export function registerLifetimePair<W extends World, T>(
  world: W,
  pairName: string,
  matrix: ReadonlyMap<string, T>,
): W {
  const newRegistry = new Map(world.registry);
  newRegistry.set(pairName, matrix as ReadonlyMap<string, unknown>);
  return { ...world, registry: newRegistry };
}

/**
 * Look up a composed-lifetime matrix by pair name. Returns undefined if
 * the pair is not registered.
 */
export function lookupLifetimePair<T>(
  world: World,
  pairName: string,
): ReadonlyMap<string, T> | undefined {
  return world.registry.get(pairName) as ReadonlyMap<string, T> | undefined;
}

/** GitWorld — specialized World for git-based change control. */
export interface GitWorld extends World {
  readonly forgeName: string;
  readonly branchUniverse: string;
  readonly prUniverse: string;
}

/** GitHubWorld — GitHub-specific forge. */
export interface GitHubWorld extends GitWorld {
  readonly forgeName: "github";
}

/** GitLabWorld — GitLab-specific forge. */
export interface GitLabWorld extends GitWorld {
  readonly forgeName: "gitlab";
}

/** Construct a GitWorld with an empty registry. */
export function createGitWorld(forgeName: string, branchUniverse: string, prUniverse: string): GitWorld {
  return { registry: new Map(), forgeName, branchUniverse, prUniverse };
}

// --- Change-control seam (MP-7: Result-shaped, never throws) ----------------

export type ChangeControlError =
  | { readonly kind: "commit_failed"; readonly reason: string }
  | { readonly kind: "pr_open_failed"; readonly reason: string }
  | { readonly kind: "pr_merge_failed"; readonly reason: string };

export type ChangeControlResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ChangeControlError };

export interface Change {
  readonly path: string;
  readonly contents: string;
}

export interface CommitResult {
  readonly commit: string;
}

export interface PRResult {
  readonly prNumber: number;
  readonly url: string;
}

export interface MergeResult {
  readonly merged: boolean;
}

/**
 * The room's change-control port — how the room interacts with the World.
 * Real binding = a GitWorld-backed adapter; mock = the in-memory DST
 * adapter below.
 */
export interface WorldChangeControlPort {
  readonly world: World;
  commit(changes: readonly Change[]): Promise<ChangeControlResult<CommitResult>>;
  openPR(commit: string, title: string, body: string): Promise<ChangeControlResult<PRResult>>;
  mergePR(prNumber: number): Promise<ChangeControlResult<MergeResult>>;
}

/**
 * In-memory change-control adapter for DST. Deterministic: commit hashes
 * and PR numbers are derived from a monotonic counter, never from a clock
 * or RNG. All operations succeed and return Results (never throw).
 */
export function createMockChangeControl(world: World = EMPTY_WORLD): WorldChangeControlPort {
  let counter = 0;
  return {
    world,
    commit(changes: readonly Change[]): Promise<ChangeControlResult<CommitResult>> {
      counter += 1;
      const paths = changes.map((c) => c.path).join(",");
      return Promise.resolve({ ok: true, value: { commit: `commit-${counter}-${paths.length}` } });
    },
    openPR(commit: string, _title: string, _body: string): Promise<ChangeControlResult<PRResult>> {
      counter += 1;
      return Promise.resolve({ ok: true, value: { prNumber: counter, url: `mock://pr/${counter}/${commit}` } });
    },
    mergePR(_prNumber: number): Promise<ChangeControlResult<MergeResult>> {
      return Promise.resolve({ ok: true, value: { merged: true } });
    },
  };
}
