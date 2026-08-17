#!/usr/bin/env bun
/**
 * environment-dependent-test-files — the TS suite is TWO TIERS, and the split must be honest.
 *
 * THE DEFECT THIS CLOSES. `test (TS suite)` ran one `bun test` over everything. MEASURED
 * 2026-08-16 across the 53 most recent completed `gate` runs: the job was red in 17 of them
 * (32%). In 15 of those 17 the ENTIRE cause was one deterministic test — `folderSink —
 * entropy tracker wiring` — i.e. a real regression, and it sat there across sixteen merges
 * because the job is deliberately outside `gate (required)` and a red X nobody has to clear
 * is a red X nobody reads.
 *
 * The reason nobody read it is measurable too, and it is not in CI. MEASURED the same day on
 * a FRESH CLONE of `main` (macOS, `bun install` only): `bun test` = 4 failures + 1 unhandled
 * error, ZERO of them code defects —
 *
 *   tests/cross-verification/_harness/cross-verify-ir.test.ts  x4
 *       "Q# lane prerequisites present"        — src/Core.Python/.venv/bin/python3 absent
 *       "splitmix64 / fmix32 / every lane"     — `dotnet run` cannot find SDK 10.0.302
 *   src/Core.TypeScript/zflash/esp-inject.test.ts               x1 (unhandled, module scope)
 *       EPERM scandir ~/Downloads              — macOS TCC on the Downloads folder
 *
 * So the SAME command is red-for-environment on a laptop and red-for-regression on a runner,
 * and nothing in either output separates the two. A developer forms the prior "this suite is
 * always red" where they work, and carries it to the pull request. THAT is the mechanism by
 * which a real regression came to look exactly like ambient noise — not CI noise, a
 * local/CI divergence in what red means.
 *
 * THE REMEDY, AS A PROPERTY. After the split, `bun --config=bunfig.hermetic.toml test` is red if
 * and only if the code is broken — on a runner, and on a laptop that has never run
 * `uv sync`, has no .NET SDK, and has nothing plugged into it. A red hermetic check means a
 * real regression, so no reviewer has to ask "is this one real?".
 *
 * WHY A SECOND bunfig AND NOT A FILTER LIST IN THE WORKFLOW. `bun test` positional arguments
 * are INCLUDE filters; there is no exclude form. The repo already carries exactly one place
 * where "bun must not discover this" is written down — `pathIgnorePatterns` — and exactly
 * one discipline for it: every entry is declared with a written reason in a registry, and a
 * checker fails on an undeclared, unreasoned, or stale entry (`unexecuted-test-files.ts`).
 * This is that mechanism at one more tier, not a new one. The header of `test-typescript` in
 * gate.yml argues at length that a filter list in a workflow is a defect that regrows every
 * time someone forgets to extend it; a second config keeps the exclusions in the same file
 * type, under the same checker discipline.
 *
 * THE TWO REGISTRIES ARE DISJOINT, AND THAT IS THE POINT.
 *
 *   registry/unexecuted-test-files.json          — runs in NO lane. Coverage genuinely lost.
 *   registry/environment-dependent-test-files.json — runs in the environment-dependent lane,
 *                                                    just not in the hermetic one.
 *
 * A path in both would mean "excluded from the tier that still runs it AND from everything",
 * which is not a state anyone means; it is how a file goes dark while looking accounted-for.
 * `check` rejects it.
 *
 * FIVE FATAL CONDITIONS, each a way the split could lie:
 *   - a hermetic-only exclusion with no registry entry     (the silent-mute case)
 *   - an entry with an empty `dependency` or `reason`      (the "" escape hatch: a skip must
 *                                                           NAME what is missing, or an absent
 *                                                           check and a passing one look alike)
 *   - an entry no workflow executes in the PR lane         (excluded from hermetic AND run
 *                                                           nowhere = silently deleted)
 *   - an entry also listed as unexecuted                   (the two registries disagree)
 *   - a registry path that is not a tracked test file      (so the list cannot rot)
 *
 * And, before any of them, NON-VACUITY: if either config parses to nothing, this fails loudly
 * rather than reporting a clean sheet. A checker that silently finds nothing is the defect.
 *
 * Usage:
 *   bun src/Core.TypeScript/hygiene/environment-dependent-test-files.ts [repo-root]
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { trackedFiles } from "../git/tracked-files";
import {
  byOrdinal,
  executes,
  loadAllowList,
  parseInvocations,
  type BunTestInvocation,
} from "./unexecuted-test-files";

/** The whole-suite config. Its ignores are "runs in NO lane". */
export const BASE_CONFIG = "bunfig.toml";

/** The hermetic-tier config. Its ignores are the base ignores PLUS this registry. */
export const HERMETIC_CONFIG = "bunfig.hermetic.toml";

export const REGISTRY = join("registry", "environment-dependent-test-files.json");

/**
 * Non-vacuity floor on the base config's ignore list. Deliberately far below the real count
 * (17 as of 2026-08-16) and far above zero, so ordinary churn never trips it while a regex
 * that stops matching cannot pass as "the two configs agree, both being empty".
 */
export const MIN_BASE_PATTERNS = 6;

/** Abort with a prefixed message. Every failure mode here is fatal by design. */
export function fail(message: string): never {
  throw new Error("environment-dependent-test-files: " + message);
}

export interface EnvEntry {
  /** Exact repo-relative path of a tracked `*.test.ts` file. */
  readonly path: string;
  /**
   * The NAMED thing whose absence makes this file environment-dependent — a binary, an SDK
   * version, a venv, a cluster, a device. Not a category ("environment", "CI"): the point of
   * this field is that a reader of a skip can tell what to install to un-skip it.
   */
  readonly dependency: string;
  /** Why the dependency cannot be assumed present, ideally with a measurement. */
  readonly reason: string;
  readonly workitem?: string;
}

/**
 * The `pathIgnorePatterns` entries of a bunfig, in file order.
 *
 * THROWS when the key is missing rather than returning empty. An empty list would make the
 * set-equality check below trivially satisfiable by deleting the key from both files, which
 * is the "both empty, therefore equal" hole.
 */
export function ignorePatterns(root: string, config: string): readonly string[] {
  const p = join(root, config);
  if (!existsSync(p)) fail(config + " does not exist");
  const block = /pathIgnorePatterns\s*=\s*\[([\s\S]*?)\]/.exec(readFileSync(p, "utf8"));
  const raw = block?.[1];
  if (raw === undefined) fail(config + " has no pathIgnorePatterns array");
  const out = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
  if (out.length === 0) fail(config + " has an empty pathIgnorePatterns array");
  return out;
}

/** The registry, or an empty list when the file is absent. */
export function loadRegistry(root: string): readonly EnvEntry[] {
  const p = join(root, REGISTRY);
  if (!existsSync(p)) return [];
  const parsed: unknown = JSON.parse(readFileSync(p, "utf8"));
  if (!Array.isArray(parsed)) fail(REGISTRY + " must be a JSON array");
  return parsed as readonly EnvEntry[];
}

/** Set difference, ordinal-sorted, so every finding below is diffable. */
export function without(all: readonly string[], drop: ReadonlySet<string>): readonly string[] {
  return [...all].filter((x) => !drop.has(x)).sort(byOrdinal);
}

export interface Verdict {
  /** Ignored by the hermetic config only, and named by no registry entry. */
  readonly undeclared: readonly string[];
  /** Registry entries missing a `dependency` or a `reason`. */
  readonly unattributed: readonly string[];
  /** Registry entries the hermetic config does not actually exclude. */
  readonly notExcluded: readonly string[];
  /** Registry entries no pull_request-lane invocation executes. */
  readonly unrun: readonly string[];
  /** Registry entries also present in registry/unexecuted-test-files.json. */
  readonly doubleListed: readonly string[];
  /** Registry entries that are not tracked `*.test.ts` files. */
  readonly untracked: readonly string[];
}

const attributed = (s: unknown): boolean => typeof s === "string" && s.trim() !== "";

/**
 * The five fatal conditions plus the rot guard.
 *
 * `unrun` is the load-bearing one. Excluding a file from the hermetic tier is legitimate;
 * excluding it from the hermetic tier while no other lane runs it is deletion wearing a
 * split's face, and it would leave the suite reporting green over a file it stopped
 * executing. That is the same class the sibling checker exists for, arriving through the
 * new door this split opens, so it is closed at the same time the door is cut.
 */
export function check(
  hermeticOnly: readonly string[],
  registry: readonly EnvEntry[],
  trackedTests: ReadonlySet<string>,
  unexecutedPaths: ReadonlySet<string>,
  runsInPrLane: (path: string) => boolean,
): Verdict {
  const named = new Set(registry.map((e) => e.path));
  const excluded = new Set(hermeticOnly);
  const paths = (es: readonly EnvEntry[]): readonly string[] =>
    es.map((e) => e.path).sort(byOrdinal);
  return {
    undeclared: hermeticOnly.filter((p) => !named.has(p)).slice().sort(byOrdinal),
    unattributed: paths(registry.filter((e) => !attributed(e.dependency) || !attributed(e.reason))),
    notExcluded: paths(registry.filter((e) => !excluded.has(e.path))),
    unrun: paths(registry.filter((e) => !runsInPrLane(e.path))),
    doubleListed: paths(registry.filter((e) => unexecutedPaths.has(e.path))),
    untracked: paths(registry.filter((e) => !trackedTests.has(e.path))),
  };
}

export interface Report {
  readonly base: readonly string[];
  readonly hermetic: readonly string[];
  /** Patterns the hermetic config adds on top of the base config. */
  readonly hermeticOnly: readonly string[];
  /** Base patterns the hermetic config DROPPED — always a defect, never intended. */
  readonly dropped: readonly string[];
  readonly registry: readonly EnvEntry[];
  readonly invocations: readonly BunTestInvocation[];
  readonly verdict: Verdict;
}

/** Does any workflow carrying a `pull_request` trigger execute this file? */
export function executedInPrLane(
  invocations: readonly BunTestInvocation[],
  file: string,
): boolean {
  return invocations.some((i) => i.triggers.includes("pull_request") && executes(i, file));
}

/**
 * The whole check, NON-VACUITY first.
 *
 * Order is load-bearing for the same reason it is in the sibling checker: if the config parse
 * came back thin, every verdict below is trivially clean and this would report a green sheet
 * having inspected nothing.
 */
export function report(root: string): Report {
  const base = ignorePatterns(root, BASE_CONFIG);
  if (base.length < MIN_BASE_PATTERNS) {
    fail("parsed only " + String(base.length) + " patterns from " + BASE_CONFIG + "; the parse is broken");
  }
  const hermetic = ignorePatterns(root, HERMETIC_CONFIG);
  const baseSet = new Set(base);
  const hermeticSet = new Set(hermetic);
  const hermeticOnly = without(hermetic, baseSet);
  const dropped = without(base, hermeticSet);
  const registry = loadRegistry(root);
  const invocations = parseInvocations(root);
  const tracked = new Set(trackedFiles(root).filter((f) => f.endsWith(".test.ts")));
  const unexecuted = new Set(loadAllowList(root).map((e) => e.path));
  const verdict = check(hermeticOnly, registry, tracked, unexecuted, (p) =>
    executedInPrLane(invocations, p),
  );
  return { base, hermetic, hermeticOnly, dropped, registry, invocations, verdict };
}

/** Human-readable findings. Empty means the check passed. */
export function findings(r: Report): readonly string[] {
  const out: string[] = [];
  r.dropped.forEach((p) => {
    out.push(
      "DROPPED FROM THE HERMETIC CONFIG: " + p + " -- " + HERMETIC_CONFIG + " must be a SUPERSET of " +
        BASE_CONFIG + "; a pattern missing here means the hermetic tier runs a file the whole suite does not.",
    );
  });
  r.verdict.undeclared.forEach((p) => {
    out.push(
      "EXCLUDED FROM THE HERMETIC TIER WITHOUT A REASON: " + p + " -- add an entry to " + REGISTRY +
        " naming the missing dependency, or drop the pattern.",
    );
  });
  r.verdict.unattributed.forEach((p) => {
    out.push(
      "UNATTRIBUTED SKIP: " + p + " -- an entry must NAME the missing dependency and say why it " +
        "cannot be assumed present. An unexplained exclusion is a mute.",
    );
  });
  r.verdict.notExcluded.forEach((p) => {
    out.push(
      "LISTED BUT NOT EXCLUDED: " + p + " -- it is in " + REGISTRY + " but " + HERMETIC_CONFIG +
        " does not ignore it, so the hermetic tier still runs it. Add the pattern or remove the entry.",
    );
  });
  r.verdict.unrun.forEach((p) => {
    out.push(
      "EXCLUDED FROM HERMETIC AND RUN BY NOTHING: " + p + " -- no pull_request-lane `bun test` " +
        "reaches it, so this is not a tier split, it is a deletion. Add it to the " +
        "environment-dependent job in gate.yml.",
    );
  });
  r.verdict.doubleListed.forEach((p) => {
    out.push(
      "IN BOTH REGISTRIES: " + p + " -- registry/unexecuted-test-files.json says it runs nowhere " +
        "and " + REGISTRY + " says the environment-dependent lane runs it. Exactly one is true.",
    );
  });
  r.verdict.untracked.forEach((p) => {
    out.push("NOT A TRACKED TEST FILE: " + p + " -- the entry has rotted; remove or repoint it.");
  });
  return out;
}

/** The one-line summary printed on every run, pass or fail. */
export function summary(r: Report): string {
  const counts = [r.base.length, r.hermetic.length, r.hermeticOnly.length, r.registry.length];
  const label = "base-ignores/hermetic-ignores/hermetic-only/registry-entries";
  return "[environment-dependent-test-files] " + label + " = " + counts.join(" ");
}

/**
 * The tier split, in the words a reader of CI needs. Printed by the environment-dependent
 * job so the log NAMES what that tier exists for, rather than leaving "why is this a
 * separate job" to be reconstructed from a workflow file.
 */
export function manifest(r: Report): readonly string[] {
  return r.registry
    .slice()
    .sort((a, b) => byOrdinal(a.path, b.path))
    .map((e) => "  " + e.path + "  [needs: " + e.dependency + "]");
}

const CLI_NAME = /environment-dependent-test-files\.(?:ts|js)$/;
const invokedDirectly = typeof process.argv[1] === "string" && CLI_NAME.test(process.argv[1]);
if (invokedDirectly) {
  const root = process.argv[2] ?? process.cwd();
  const r = report(root);
  console.log(summary(r));
  manifest(r).forEach((line) => {
    console.log(line);
  });
  const problems = findings(r);
  problems.forEach((line) => {
    console.error("  " + line);
  });
  if (problems.length > 0) process.exit(1);
  console.log("[environment-dependent-test-files] every hermetic-tier exclusion names its dependency and runs elsewhere.");
}
