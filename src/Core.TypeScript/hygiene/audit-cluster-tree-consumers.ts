#!/usr/bin/env bun
// audit-cluster-tree-consumers.ts — keeps the stale-cluster-tree consumer
// inventory a DERIVED fact rather than a grep somebody ran once.
//
// ── WHY (081M00QCHWA087G0R000GKKRXD) ────────────────────────────────────────
// This repo carries two declarations of one cluster. `full-ai-cluster/` is the
// live one: `zeta-install.sh` runs `nixos-install --flake
// /mnt/etc/zeta/full-ai-cluster#$HOST`, and the only `nix flake check` in CI
// runs with `working-directory: full-ai-cluster`. `infra/k8s` + `infra/nixos`
// are the older declaration, and they do not merely duplicate — they COLLIDE
// on the single Kubernetes identity Application/argocd/zeta-root, both with
// prune+selfHeal, so the last apply prunes the other tree's whole child graph.
//
// Consolidating has been deferred twice, both times for the same reason:
// nobody could show the list of things still reading the stale tree was
// COMPLETE. A 2026-08-16 pass named two code consumers and called the list
// closed. There were nine. That is the same failure the deletion is meant to
// fix — one copy checked against another copy — happening inside the check.
//
// So the roster is not the source of truth. `git grep` is. This audit derives
// the real consumer set and compares it to `cluster-tree-consumers.json`:
//
//   unrostered-consumer  a file references the stale tree and is not rostered.
//                        This is the re-divergence guard: new coupling to the
//                        tree we are trying to delete fails at PR time.
//   stale-roster-entry   a rostered path no longer references the stale tree
//                        (or no longer exists). The roster must SHRINK as the
//                        migration lands, so it can never over-claim safety.
//
// Deletion of `infra/k8s` + `infra/nixos` is provably safe when no `blocking`
// or `derived` entry remains. This audit does not authorize the deletion —
// that is gated on maintainer sign-off in the work item. It makes the
// precondition checkable instead of asserted.
//
// ── WHAT THIS DOES NOT CATCH (stated, not hidden) ──────────────────────────
// A reference that does not spell the path literally — a variable holding
// "infra" + "/k8s", a shell glob, a path assembled at runtime, or an off-repo
// machine that already tracks `.#control-plane` from the root flake. The last
// one is real and unknowable from inside the repo; it is recorded in the
// roster's flake.nix entry rather than glossed.
//
// Exit codes: 0 = roster matches the tree, 1 = drift, 2 = usage/IO error.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-cluster-tree-consumers.ts
//   bun src/Core.TypeScript/hygiene/audit-cluster-tree-consumers.ts --root DIR --roster FILE

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

/** Dispositions a rostered consumer may carry. Order is report order. */
const DISPOSITIONS = ["blocking", "derived", "prose", "self"] as const;
type Disposition = (typeof DISPOSITIONS)[number];

/** Dispositions that must reach zero before the stale tree can be deleted. */
const DELETION_BLOCKERS: readonly Disposition[] = ["blocking", "derived"];

interface RosterEntry {
  readonly path: string;
  readonly disposition: Disposition;
  readonly note?: string;
  readonly migrateTo?: string;
}

interface Roster {
  readonly stalePatterns: readonly string[];
  readonly survivingTree: string;
  readonly excludedPrefixes: readonly string[];
  readonly consumers: readonly RosterEntry[];
}

interface Finding {
  readonly kind: "unrostered-consumer" | "stale-roster-entry";
  readonly path: string;
  readonly detail: string;
}

/**
 * Ordinal order, deliberately NOT `localeCompare`
 * (.claude/rules/culture-invariant-by-default.md): the order findings are
 * reported in must not vary with the runner's locale.
 */
function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function fail(message: string): never {
  process.stderr.write(`[cluster-tree-consumers] ${message}\n`);
  process.exit(2);
}

function isDisposition(value: unknown): value is Disposition {
  return typeof value === "string" && (DISPOSITIONS as readonly string[]).includes(value);
}

function loadRoster(rosterPath: string): Roster {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(rosterPath, "utf-8"));
  } catch (e) {
    fail(`cannot read roster ${rosterPath}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const raw = parsed as Partial<Roster>;
  if (!Array.isArray(raw.stalePatterns) || raw.stalePatterns.length === 0) {
    fail(`roster ${rosterPath}: stalePatterns must be a non-empty array`);
  }
  if (!Array.isArray(raw.excludedPrefixes)) {
    fail(`roster ${rosterPath}: excludedPrefixes must be an array`);
  }
  if (!Array.isArray(raw.consumers)) {
    fail(`roster ${rosterPath}: consumers must be an array`);
  }
  for (const entry of raw.consumers) {
    if (typeof entry?.path !== "string" || entry.path.length === 0) {
      fail(`roster ${rosterPath}: every consumer needs a non-empty string path`);
    }
    if (!isDisposition(entry.disposition)) {
      fail(
        `roster ${rosterPath}: consumer ${entry.path} has disposition ` +
          `${JSON.stringify(entry.disposition)}; expected one of ${DISPOSITIONS.join(", ")}`,
      );
    }
    // A wildcard would turn this audit into the vacuity class: a roster that
    // matches everything cannot report an unrostered consumer.
    if (entry.path.includes("*")) {
      fail(`roster ${rosterPath}: consumer paths are literal, not globs (${entry.path})`);
    }
  }
  return {
    stalePatterns: raw.stalePatterns,
    survivingTree: typeof raw.survivingTree === "string" ? raw.survivingTree : "(unset)",
    excludedPrefixes: raw.excludedPrefixes,
    consumers: raw.consumers as readonly RosterEntry[],
  };
}

/**
 * Every tracked file in `root` that literally names one of `patterns`, with the
 * excluded prefixes pruned. `git grep -l` is used rather than reading files: it
 * honours .gitignore, skips binaries, and does not depend on the working tree
 * being clean.
 *
 * The exclusions are pushed down into git's pathspec rather than only filtered
 * in JS afterwards, and that is not cosmetic. MEASURED 2026-08-17 on this repo:
 * the first implementation filtered only in JS and took 17.4 s wall, because
 * `docs/history/`, `docs/pr-discussions/` and `docs/github/` are most of the
 * tracked files (35,122 total, 15,711 after exclusions) and every one of them
 * was read and scanned just to be discarded. With the pathspec: 0.9 s wall
 * warm. A 17 s gate step is one nobody keeps.
 *
 * The caller still applies the same prefixes to the result. That is deliberate
 * redundancy, not a leftover: the pathspec is an optimisation and the JS filter
 * is the semantics the mutation suite drives, so if the two ever disagree the
 * stricter one wins rather than a file silently escaping the audit.
 */
function derivedConsumers(
  root: string,
  patterns: readonly string[],
  excludedPrefixes: readonly string[],
): string[] {
  const fixedStrings = patterns.flatMap((pattern) => ["-e", pattern]);
  const pathspecs = excludedPrefixes.map((prefix) => `:(exclude,glob)${prefix}**`);
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync(
    "git",
    ["-C", root, "grep", "-lI", "-F", ...fixedStrings, "--", ".", ...pathspecs],
    { encoding: "utf-8", maxBuffer: SPAWN_MAX_BUFFER },
  );
  // git grep: 0 = matches found, 1 = none found, >1 = real error.
  if (result.error) fail(`git grep failed: ${result.error.message}`);
  if (result.status !== 0 && result.status !== 1) {
    fail(`git grep exited ${result.status}: ${result.stderr}`);
  }
  return (result.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: "string" },
      roster: { type: "string" },
    },
    allowPositionals: false,
  });

  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(values.root ?? resolve(here, "../../.."));
  const rosterPath = resolve(values.roster ?? join(here, "cluster-tree-consumers.json"));
  const roster = loadRoster(rosterPath);

  const excluded = (path: string): boolean =>
    roster.excludedPrefixes.some((prefix) => path.startsWith(prefix));

  const derived = derivedConsumers(root, roster.stalePatterns, roster.excludedPrefixes)
    .filter((path) => !excluded(path))
    .sort(compareOrdinal);
  const derivedSet = new Set(derived);

  const rosterByPath = new Map(roster.consumers.map((entry) => [entry.path, entry]));
  const findings: Finding[] = [];

  for (const path of derived) {
    if (!rosterByPath.has(path)) {
      findings.push({
        kind: "unrostered-consumer",
        path,
        detail:
          `names the stale tree (${roster.stalePatterns.join(" | ")}) but is not in the roster. ` +
          `New coupling to a tree scheduled for deletion — either point it at ` +
          `${roster.survivingTree}/ or add it to ${rosterPath} with a disposition and a migration target.`,
      });
    }
  }

  for (const entry of roster.consumers) {
    if (derivedSet.has(entry.path)) continue;
    const stillThere = existsSync(join(root, entry.path));
    findings.push({
      kind: "stale-roster-entry",
      path: entry.path,
      detail: stillThere
        ? "is rostered as a consumer but no longer names the stale tree — the migration moved; drop this entry."
        : "is rostered as a consumer but does not exist — drop this entry.",
    });
  }

  const counts = new Map<Disposition, number>(DISPOSITIONS.map((d) => [d, 0]));
  for (const entry of roster.consumers) {
    if (!derivedSet.has(entry.path)) continue;
    counts.set(entry.disposition, (counts.get(entry.disposition) ?? 0) + 1);
  }
  const remaining = DELETION_BLOCKERS.reduce((sum, d) => sum + (counts.get(d) ?? 0), 0);

  process.stdout.write(
    `cluster-tree consumers: ${derived.length} file(s) outside infra/ name ` +
      `${roster.stalePatterns.join(" or ")}\n`,
  );
  for (const disposition of DISPOSITIONS) {
    process.stdout.write(`  ${disposition.padEnd(9)} ${counts.get(disposition) ?? 0}\n`);
  }
  process.stdout.write(
    `deleting infra/k8s + infra/nixos is provably safe when blocking+derived reaches 0; ` +
      `currently ${remaining}.\n`,
  );

  if (findings.length === 0) {
    process.stdout.write("roster matches the tree.\n");
    process.exit(0);
  }

  process.stdout.write(`\n${findings.length} finding(s):\n`);
  for (const finding of findings.sort(
    (a, b) => compareOrdinal(a.kind, b.kind) || compareOrdinal(a.path, b.path),
  )) {
    process.stdout.write(`  [${finding.kind}] ${finding.path}\n      ${finding.detail}\n`);
  }
  process.exit(1);
}

main();
