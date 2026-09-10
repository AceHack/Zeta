#!/usr/bin/env bun
// declared-cluster-trees.ts — one declaration of WHICH cluster trees exist.
//
// WHY THIS FILE EXISTS
// --------------------
// The repo carries two declarations of one cluster: `full-ai-cluster/` (live) and `infra/k8s`
// (older, scheduled for deletion under 081M00QCHWA087G0R000GKKRXD). Several guards exist
// precisely BECAUSE there are two — the argocd pin-parity audit, the bootstrap/Application pin
// audit, the committed-credential scan. Their job is to prove the two declarations agree.
//
// Each of them hardcoded the pair. That has two costs, and the second is the interesting one:
//
//   1. The eventual deletion (which is GATED on maintainer sign-off, and is not performed or
//      authorised here) becomes a four-file edit instead of a one-line one.
//   2. `git grep infra/k8s` reports those guards as consumers of the stale tree, which is
//      true but unhelpful: they are not surfaces that need MIGRATING, they are the surfaces
//      that make the migration safe. The roster's own criterion — deletion is provably safe
//      when every `blocking` entry is gone — cannot be reached by a guard whose subject IS
//      the two-tree divergence, because it must keep naming the tree until the tree is gone.
//
// Deriving the pair from the roster resolves both without weakening anything: coverage is
// identical, the guards still scan both trees, and the tree list has exactly one home.
//
// WHAT REPLACES THE HARDCODED PAIR'S SAFETY. A literal list cannot silently shrink; a derived
// one can, and a guard that quietly scans one fewer tree is the vacuity class. So the
// derivation REFUSES when a declared root is absent from disk, which is strictly louder than
// the count check it replaces — it names the tree that vanished instead of reporting that a
// number moved.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROSTER_FILE = "src/Core.TypeScript/hygiene/cluster-tree-consumers.json";

export interface DeclaredTrees {
  /** The tree that survives the consolidation, e.g. `full-ai-cluster`. */
  readonly surviving: string;
  /** Trees scheduled for deletion, e.g. `infra/k8s`, `infra/nixos`. */
  readonly stale: readonly string[];
}

export function readDeclaredTrees(repoRoot = process.cwd()): DeclaredTrees {
  const raw = readFileSync(join(repoRoot, ROSTER_FILE), "utf-8");
  const parsed = JSON.parse(raw) as { survivingTree?: unknown; stalePatterns?: unknown };
  const surviving = parsed.survivingTree;
  const stale = parsed.stalePatterns;
  if (typeof surviving !== "string" || surviving.length === 0) {
    throw new Error(`${ROSTER_FILE}: survivingTree missing or not a string`);
  }
  if (!Array.isArray(stale) || stale.some((s) => typeof s !== "string")) {
    throw new Error(`${ROSTER_FILE}: stalePatterns missing or not a string array`);
  }
  return { surviving, stale: stale as readonly string[] };
}

/**
 * Every Kubernetes manifest root, surviving first then stale in the roster's own order.
 *
 * A stale pattern counts as a k8s root when its last path segment is `k8s` — `infra/nixos` is
 * a NixOS tree and carries no manifests, so it is not one.
 */
export function clusterK8sRoots(trees: DeclaredTrees): readonly string[] {
  const roots = [`${trees.surviving}/k8s`];
  for (const s of trees.stale) {
    const segs = s.split("/");
    if (segs[segs.length - 1] === "k8s") roots.push(s);
  }
  return roots;
}

/** Refuse when a declared root is not on disk — a guard scanning one fewer tree is a guard that did not run. */
export function assertRootsPresent(roots: readonly string[], repoRoot = process.cwd()): void {
  const missing = roots.filter((r) => !existsSync(join(repoRoot, r)));
  if (missing.length > 0) {
    throw new Error(
      `declared cluster tree(s) absent from disk: ${missing.join(", ")}. ` +
        `Either the tree was deleted without updating ${ROSTER_FILE}, or the roster names a tree that never existed. ` +
        `Both leave every two-tree parity guard silently scanning less than it claims.`,
    );
  }
}

/**
 * `<root>/<name>` for each declared k8s root and each requested subdirectory, grouped by
 * ROOT and then by name — so `clusterDirs(["applications", "bootstrap"])` reads
 * live/apps, live/bootstrap, stale/apps, stale/bootstrap. That grouping is the order the
 * hardcoded lists this replaces already used, and it is the readable one: a reader scanning
 * the output sees one tree at a time.
 *
 * The ROOTS are asserted present; the subdirectories are not, because a caller asking for a
 * directory that does not exist is asking a question about its own arguments, not about
 * whether the tree list has silently shrunk. Use `existingClusterDirs` for optional ones.
 */
export function clusterDirs(names: readonly string[], repoRoot = process.cwd()): readonly string[] {
  const roots = clusterK8sRoots(readDeclaredTrees(repoRoot));
  assertRootsPresent(roots, repoRoot);
  const out: string[] = [];
  for (const r of roots) for (const n of names) out.push(`${r}/${n}`);
  return out;
}

/** Like `clusterDirs`, but drops subdirectories that do not exist — for optional ones. */
export function existingClusterDirs(names: readonly string[], repoRoot = process.cwd()): readonly string[] {
  return clusterDirs(names, repoRoot).filter((d) => existsSync(join(repoRoot, d)));
}

/** `<root>/bootstrap` for each declared k8s root, verified present. */
export function bootstrapDirs(repoRoot = process.cwd()): readonly string[] {
  return clusterDirs(["bootstrap"], repoRoot);
}

/** `<root>/applications` for each declared k8s root, verified present. */
export function applicationDirs(repoRoot = process.cwd()): readonly string[] {
  return clusterDirs(["applications"], repoRoot);
}

/** A named manifest under each declared k8s root's bootstrap dir. */
export function bootstrapManifests(name: string, repoRoot = process.cwd()): readonly string[] {
  return bootstrapDirs(repoRoot).map((d) => `${d}/${name}`);
}
