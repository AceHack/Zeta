#!/usr/bin/env bun
/**
 * run-tier0.ts — run all Tier-0 healers over the working tree, UNDER A BOUNDED BLAST RADIUS.
 *
 * Called by the heartbeat workflow (otto's duty). Reads files from disk, applies the composed
 * Tier-0 healers, writes back any changes — but never more than `--max-files` of them, and never
 * partially.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE BOUND EXISTS (2026-08-01)
 *
 * The society is moving off PR review toward "drift cleanup after the fact" (Aaron: "i'm happy
 * to keep moving away from PR ceremony as long as we have the replacements for it"). Auditing
 * what a PR actually provided, every column had a replacement except one:
 *
 *     pre-merge CI    → post-merge CI + these healers        ✓
 *     human review    → n/a for machine telemetry            ✓
 *     audit trail     → git history + AgencySignature        ✓
 *     rollback        → git revert / Z-set retraction        ✓
 *     BLAST RADIUS    → NOTHING                              ✗   ← this file
 *
 * Retraction-over-prevention works because drift is *bounded and observable*. An unbounded
 * autonomous writer breaks that: a single bad tick that rewrites 4,000 files is not "drift you
 * heal later", it is an outage, and the healer that caused it runs again on the next tick. The
 * bound is what keeps after-the-fact cleanup tractable — it is the precondition for dropping
 * the gate, not a substitute for it.
 *
 * This is not hypothetical for this specific script: on 2026-08-01 the unused-import healer
 * shipped WITH an unused import and turned main red. A zero-intelligence healer is exactly the
 * kind of thing that is confidently wrong at scale.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ALL-OR-NOTHING, NOT FIRST-N
 *
 * The bound is checked against the COMPLETE plan before a single byte is written. Writing 24
 * files and stopping at the 25th would leave the tree in a state no healer intended — a partial
 * application is worse than either healing everything or healing nothing, because it is not
 * reproducible and not idempotent. So: compute the whole plan, decide once, then apply all of
 * it or none of it. (Discipline #6 idempotency: re-running after a refusal is a no-op; re-running
 * after a successful heal converges, because healers are fixpoints.)
 *
 * Exceeding the bound is NOT silently truncated — silent truncation is how a check goes vacuous.
 * It exits 2 and prints the full plan, so the oversized drift is visible and a human decides.
 *
 * Exit codes:
 *   0 — healers ran (may or may not have healed anything); or --dry-run completed
 *   1 — fatal error: a malformed --max-files, or an UNRECOGNISED ARGUMENT (nothing written)
 *   2 — BLAST RADIUS EXCEEDED: nothing was written, the plan is printed, a human decides
 *
 * 1 and 2 are deliberately NOT merged even though both mean "nothing was written".
 * `agent-heartbeat.yml` treats rc=2 as a ::warning:: and ends the step cleanly — an oversized
 * plan is a finding about the repo, not a broken tick. A mistyped flag is a broken *invocation*,
 * and routing it through the rc=2 branch would let a heal step that never ran report itself as a
 * known-and-tolerated condition. rc=1 lands in the `HEALER FAILED rc=$HEAL_RC` warning instead.
 *
 * Usage:
 *   bun run-tier0.ts [--repo-root <path>] [--max-files N] [--dry-run] [--plan-out <path>]
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { composeHealers, type FileTree } from "../healer-harness";
import { staleJsHealer } from "./stale-js";
import { unpinnedActionsHealer } from "./unpinned-actions";
import { exactOptionalHealer } from "./exact-optional-spread";
import { unusedImportHealer } from "./unused-import";
import { staleDocCrossRefHealer } from "./stale-doc-cross-ref";

/**
 * The default bound. Chosen from the observed corpus, not from taste: real Tier-0 drift runs
 * land 1–8 files. 25 is comfortably above every honest run we have on record and far below the
 * "something has gone wrong" range. Raise it deliberately and in a commit that says why; do not
 * raise it to make a red run go green — an oversized plan is a FINDING.
 */
export const DEFAULT_MAX_FILES = 25;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Flags that consume the following token as their value. */
const VALUE_FLAGS: ReadonlySet<string> = new Set(["--repo-root", "--max-files", "--plan-out"]);
/** Flags that stand alone. */
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set(["--dry-run"]);

/**
 * FAIL CLOSED ON AN UNRECOGNISED ARGUMENT — 081M03HRHBS087G0R001HRAFQ0.
 *
 * `process.argv.includes("--dry-run")` asks one question and treats EVERY other string as
 * consent: `--dry-runn`, `--dryrun` and `--help` all mean "write to the repository". PR #10832
 * probed a sibling tool with `--help` and started a ~1,700-file rewrite. Nothing about this
 * healer makes it immune — it rewrites every healable file in `--repo-root`.
 *
 * Called as the FIRST statement of `main()`, which is above `--plan-out`'s write, above the
 * blast-radius check and above the rewrite loop, so the refusal cannot land after a partial run.
 *
 * The diagnostic string `unknown arg` is load-bearing beyond being readable:
 * `hygiene/audit-workflow-cli-flags.ts` only polices tools whose parser demonstrably rejects
 * unknown flags, and it detects that by finding this phrase in the source. Before this guard
 * existed the healer was *skipped* by that lint — the absence of a guard bought exemption from
 * the check that would catch a bad workflow invocation. Do not reword it to "unrecognised
 * argument" without teaching `hasClosedFlagSet` the new phrasing.
 */
function rejectUnknownArgs(argv: readonly string[]): void {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        console.error(`[tier-0] FATAL: ${arg} requires a value.`);
        process.exit(1);
      }
      i++; // consume the value; it is not a stray positional
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) continue;
    console.error(
      `unknown arg: ${arg}\n` +
        `[tier-0] REFUSED — nothing was written. Accepted: ` +
        `${[...VALUE_FLAGS, ...BOOLEAN_FLAGS].sort().join(" ")}`,
    );
    process.exit(1);
  }
}

/** Recursively collect files (skipping node_modules, .git, binary). */
function collectFiles(dir: string, base: string = dir): Map<string, string> {
  const files = new Map<string, string>();
  const SKIP = new Set(["node_modules", ".git", "dist", "bin", ".cache"]);

  function walk(d: string): void {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = relative(base, full);
        // Only include healable files (TS, YAML workflows, markdown docs)
        if (rel.endsWith(".ts") || rel.endsWith(".tsx") ||
            rel.endsWith(".js") || rel.endsWith(".md") ||
            (rel.endsWith(".yml") && rel.includes(".github/workflows/"))) {
          try {
            files.set(rel, readFileSync(full, "utf-8"));
          } catch { /* skip unreadable */ }
        }
      }
    }
  }
  walk(dir);
  return files;
}

/** The composed Tier-0 healer pipeline. */
const tier0 = composeHealers("tier-0-composed", [
  staleJsHealer,
  unpinnedActionsHealer,
  unusedImportHealer,
  exactOptionalHealer,
  staleDocCrossRefHealer,
]);

/** What the healers WOULD do. Computed in full before anything touches disk. */
export interface HealPlan {
  /** Paths whose content changed, with the new content. */
  readonly rewrites: ReadonlyMap<string, string>;
  /** Paths the healers dropped from the tree (stale-js). Reported, not deleted here. */
  readonly removals: readonly string[];
  /** rewrites.size + removals.length — what the bound is checked against. */
  readonly touched: number;
}

/**
 * Diff the healed tree against the original. PURE — no filesystem, no clock — so the bound can
 * be tested against synthetic trees without a repo (and so it is DST-replayable).
 */
export function computePlan(before: FileTree, after: FileTree): HealPlan {
  const rewrites = new Map<string, string>();
  for (const [path, content] of after) {
    if (before.get(path) !== content) rewrites.set(path, content);
  }
  const removals: string[] = [];
  for (const path of before.keys()) {
    if (!after.has(path)) removals.push(path);
  }
  return { rewrites, removals, touched: rewrites.size + removals.length };
}

/** Renders the plan for a human. Always printed when the bound is exceeded — never truncated. */
export function describePlan(plan: HealPlan): string {
  const lines: string[] = [];
  for (const path of [...plan.rewrites.keys()].sort()) lines.push(`  REWRITE  ${path}`);
  for (const path of [...plan.removals].sort()) lines.push(`  REMOVE   ${path}`);
  return lines.join("\n");
}

function main(): void {
  rejectUnknownArgs(process.argv.slice(2));

  const repoRoot = argValue("--repo-root") ?? process.cwd();
  const dryRun = process.argv.includes("--dry-run");
  const planOut = argValue("--plan-out");

  const rawMax = argValue("--max-files");
  const parsedMax = rawMax === undefined ? DEFAULT_MAX_FILES : Number(rawMax);
  if (!Number.isFinite(parsedMax) || parsedMax < 1) {
    // A malformed bound must not silently become "unbounded". Fail loudly.
    console.error(`[tier-0] FATAL: --max-files must be a positive integer, got "${rawMax}".`);
    process.exit(1);
  }
  const maxFiles = Math.floor(parsedMax);

  console.log(`[tier-0] Scanning ${repoRoot}... (blast radius bound: ${maxFiles} files${dryRun ? ", DRY RUN" : ""})`);

  const tree: FileTree = collectFiles(repoRoot);
  console.log(`[tier-0] Collected ${tree.size} healable files`);

  // Compute the ENTIRE plan first. Nothing has touched disk at this point.
  const plan = computePlan(tree, tier0.heal(tree));

  if (planOut) {
    // Emitted so the workflow can stage EXACTLY these paths instead of `git add -A`, which
    // would sweep in anything else the tick happened to leave in the tree.
    writeFileSync(planOut, [...plan.rewrites.keys(), ...plan.removals].sort().join("\n") + "\n");
  }

  if (plan.touched === 0) {
    console.log(`[tier-0] No drift found. All clean.`);
    return;
  }

  // ── THE BOUND ── checked against the complete plan, before any write.
  if (plan.touched > maxFiles) {
    console.error(
      `\n[tier-0] ✗ BLAST RADIUS EXCEEDED — ${plan.touched} files planned, bound is ${maxFiles}.\n` +
        `[tier-0] NOTHING WAS WRITTEN. The working tree is untouched.\n\n` +
        describePlan(plan) +
        `\n\n[tier-0] A Tier-0 run this large is a FINDING, not a routine heal — honest runs land\n` +
        `[tier-0] 1-8 files. Either a healer has a bug (the unused-import healer shipped with an\n` +
        `[tier-0] unused import on 2026-08-01), or real drift accumulated and wants a human read.\n` +
        `[tier-0] Inspect the plan above, then re-run with an explicit --max-files if it is genuine.\n`,
    );
    process.exit(2);
  }

  if (dryRun) {
    console.log(`[tier-0] DRY RUN — ${plan.touched} file(s) would change, nothing written:\n${describePlan(plan)}`);
    return;
  }

  // Within bound: apply the whole plan.
  for (const [path, content] of plan.rewrites) {
    writeFileSync(join(repoRoot, path), content);
    console.log(`[tier-0] HEALED: ${path}`);
  }
  for (const path of plan.removals) {
    // We do not unlink here — removal is staged at the git layer so it is reviewable as a diff.
    console.log(`[tier-0] WOULD REMOVE: ${path} (stale — handle in git stage)`);
  }

  console.log(`[tier-0] Fixed ${plan.touched} file(s) (bound ${maxFiles}).`);
}

if (import.meta.main) main();
