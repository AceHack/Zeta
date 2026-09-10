#!/usr/bin/env bun
/**
 * Refuse a Kubernetes version literal that disagrees with the declaration.
 *
 * THE FAILURE THIS EXISTS FOR, measured 2026-09-01: the tree carried THREE separate
 * Kubernetes version literals and TWO different answers, and neither was what the
 * cluster runs.
 *
 *   audit-observability-chain.ts          1.31.0
 *   validate-applications.ts              1.33.0
 *   gate.yml (kubeconform)                1.33.0
 *   k3s, from this repo's own flake lock  1.35.6
 *
 * The kubeconform pin's own comment names that exact drift -- "Two lanes validating
 * the same kinds against two different Kubernetes versions is the drift this closes"
 * -- and it closed two lanes and left a third. A hand-applied fix reaches the places
 * its author grepped for; this reaches the places that exist.
 *
 * WHY A STALE VERSION IS NOT MERELY COSMETIC, and why this is a gate rather than a
 * report: it fails in BOTH directions. Too low REJECTS charts that would install
 * (mimir-distributed 6.x needs >= 1.32 and could not render at 1.31.0). Too low also
 * CLEARS charts using APIs removed after the declared version -- they validate here
 * and fail on the real cluster. That direction is silent, which makes it the dangerous
 * one, and silence is exactly what a linter is for.
 *
 * WHAT THIS DOES NOT CHECK, said plainly: that the declaration matches the flake. That
 * needs `nix` and a flake evaluation, which is not available in every lane this runs
 * in. The declaration records the command that derives it, and moving the lock without
 * moving the declaration is a gap this cannot see. Named here rather than implied.
 */

import { readFileSync } from "node:fs";
import { existingClusterDirs } from "../cluster/declared-cluster-trees.ts";
import { join } from "node:path";

export const DECLARATION_PATH = "full-ai-cluster/k8s/kubernetes-version.json";

/** A Kubernetes version literal found somewhere it should not be hardcoded. */
export interface VersionLiteral {
  readonly file: string;
  readonly line: number;
  readonly version: string;
  readonly text: string;
}

/** Files that legitimately name a version, and why. */
export const EXEMPT: ReadonlyMap<string, string> = new Map([
  [DECLARATION_PATH, "the declaration itself"],
  ["src/Core.TypeScript/hygiene/lint-kubernetes-version-agrees.ts", "this linter, which quotes the historical values"],
  ["src/Core.TypeScript/hygiene/lint-kubernetes-version-agrees.test.ts", "its falsifiers, which construct disagreeing fixtures"],
]);

/** Read the one declared version. Throws rather than defaulting. */
export function declaredVersion(repoRoot = "."): string {
  const parsed = JSON.parse(readFileSync(join(repoRoot, DECLARATION_PATH), "utf8")) as {
    kubernetesVersion?: unknown;
  };
  const version = parsed.kubernetesVersion;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${DECLARATION_PATH} declares no well-formed kubernetesVersion`);
  }
  return version;
}

/**
 * Every Kubernetes-version literal in `text` that is being USED as a version.
 *
 * Deliberately narrow. It matches only the two spellings that actually configure a
 * validator -- `--kube-version <v>` / `-kubernetes-version <v>`, and a `KUBE_VERSION`
 * or `kubernetesVersion` assignment. A broad "any 1.NN.N" scan would flag chart
 * versions, image tags and prose, and a linter that cries wolf is one people learn to
 * skip -- which is the same vacuity in a different costume.
 */
export function findVersionLiterals(file: string, text: string): readonly VersionLiteral[] {
  const out: VersionLiteral[] = [];
  const patterns = [
    // the flag, as a validator is actually invoked
    /-{1,2}kube(?:rnetes)?-version[ =]+"?(\d+\.\d+\.\d+)"?/g,
    // a named constant or field. The `"?` after the name matters: a JSON key is
    // QUOTED (`"kubernetesVersion": "1.30.0"`), and an earlier draft that omitted it
    // silently matched nothing there -- a scanner blind to the exact spelling the
    // declaration file itself uses.
    /\b(?:KUBE_VERSION|kubernetesVersion|kubeVersion)"?\s*[:=]\s*"(\d+\.\d+\.\d+)"/g,
    // an argument DEFAULT, where the value is not adjacent to its key:
    //   "kube-version": { type: "string", default: "1.33.0" }
    // This is the shape validate-applications.ts carried, and the shape a regression
    // would most plausibly take, so a matcher that missed it would miss the one it
    // was written for.
    /"kube-version"[^\n]*?default:\s*"(\d+\.\d+\.\d+)"/g,
  ];
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        out.push({ file, line: index + 1, version: match[1] as string, text: line.trim() });
      }
    }
  }
  return out;
}

/** Literals that disagree with the declaration. */
export function disagreements(
  found: readonly VersionLiteral[],
  declared: string,
): readonly VersionLiteral[] {
  return found.filter((l) => l.version !== declared && !EXEMPT.has(l.file));
}

export function formatFinding(l: VersionLiteral, declared: string): string {
  return (
    `  ${l.file}:${String(l.line)} names Kubernetes ${l.version}, but ${DECLARATION_PATH} ` +
    `declares ${declared}.\n      ${l.text}\n` +
    `      Read the declaration instead of writing a literal. A version that disagrees here ` +
    `validates the tree against an API surface the cluster does not have -- which rejects charts ` +
    `that would install, and silently clears charts that would not.`
  );
}

/** Files worth scanning: the validators and workflows that configure a version. */
export const SCAN_GLOBS: readonly string[] = [
  "src/Core.TypeScript/hygiene",
  "src/Core.TypeScript/cluster",
  // Every declared cluster tree that actually HAS a tests dir — derived, because the set of
  // trees is the roster's to state. `existingClusterDirs` and not `clusterDirs`: this is a
  // scan list, so a tree without tests contributes nothing rather than a missing path.
  ...existingClusterDirs(["tests"]),
  ".github/workflows",
];

if (import.meta.main) {
  const { readdirSync } = await import("node:fs");
  type Dirent = import("node:fs").Dirent;
  const repoRoot = ".";
  const declared = declaredVersion(repoRoot);
  const found: VersionLiteral[] = [];

  // `withFileTypes`, not a readdir followed by a stat. An earlier draft listed names
  // and then asked the filesystem again what each one was; lint-check-then-use-file-races
  // refused it, correctly -- an entry can vanish or change kind between the two, and
  // the listing already knew. The kind arrives with the listing, so there is no second
  // syscall to race against.
  const walk = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(join(repoRoot, dir), { withFileTypes: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") return;
      throw error;
    }
    for (const entry of entries) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(rel);
      } else if (entry.isFile() && /\.(ts|yml|yaml)$/.test(entry.name)) {
        found.push(...findVersionLiterals(rel, readFileSync(join(repoRoot, rel), "utf8")));
      }
    }
  };
  for (const g of SCAN_GLOBS) walk(g);

  const bad = disagreements(found, declared);
  const scanned = found.length;
  if (bad.length === 0) {
    process.stdout.write(
      `kubernetes-version: OK -- ${String(scanned)} literal(s) scanned, all agree with ` +
        `${declared} as declared in ${DECLARATION_PATH}\n`,
    );
    process.exit(0);
  }
  process.stdout.write(`kubernetes-version DISAGREES -- ${String(bad.length)} finding(s)\n\n`);
  for (const l of bad) process.stdout.write(`${formatFinding(l, declared)}\n\n`);
  process.exit(1);
}
