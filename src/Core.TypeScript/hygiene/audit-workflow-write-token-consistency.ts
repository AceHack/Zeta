#!/usr/bin/env bun
// audit-workflow-write-token-consistency.ts — a workflow step that WRITES to the forge must
// not hardcode `secrets.GITHUB_TOKEN` when that same workflow already knows about a PAT.
//
// WHY THIS FILE EXISTS
// --------------------
// On 2026-08-25 the PR-archive coverage collapse was traced to ONE line. In
// `.github/workflows/agent-heartbeat.yml`, the step that arms auto-merge carried:
//
//     env:
//       GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
//
// while every other credentialed step in the same file used the fallback chain
// `ZETA_TELEMETRY_FLUSH_TOKEN || ZETA_PR_ARCHIVE_TOKEN || GITHUB_TOKEN`. The consequence is
// not a failure — it is a SILENCE:
//
//     armed with GITHUB_TOKEN -> the merge lands as `github-actions[bot]`
//     -> GitHub suppresses workflow triggers for GITHUB_TOKEN-driven events (the recursion
//        guard, and it is deliberate on GitHub's side)
//     -> no `pull_request: closed` event -> pr-archive-on-merge.yml never runs
//     -> the PR is never archived, and NOTHING IS RED because no run was ever created.
//
// Measured over 2026-08-21..25: of 765 eligible unarchived PRs, 747 (97.6%) were bot-merged;
// of 539 archived in the same window, 530 (98.3%) were user-merged. Per-SHA the split is
// total — bot-merged SHAs have 0 workflow runs, user-merged SHAs have 1, success. Daily
// coverage was 100.00% from 08-11 to 08-20 and fell off a cliff on 08-21, exactly tracking
// the bot-merge share crossing over.
//
// It was misdiagnosed as a credential problem several times, and the misdiagnosis was
// reasonable: the symptom looks exactly like a PAT that lacks a scope. It was not. The step
// did not read the PAT at all, so no amount of granting could reach it.
//
// THE DEFECT IS THE INCONSISTENCY, NOT THE INSTANCE. One step out of nine in one file
// disagreed with the others about which credential to use, and prose cannot hold that line —
// the next step someone adds will copy whichever neighbour they happened to look at. Hence a
// check.
//
// WHAT IT CHECKS
// --------------
// For every step in every workflow:
//
//   1. does the step perform a FORGE WRITE through the `gh` CLI (merge a PR, create a PR,
//      or any explicitly-mutating `gh api` call)?  AND
//   2. does the step's own `GH_TOKEN` resolve to a bare `secrets.GITHUB_TOKEN` /
//      `github.token`, with no PAT anywhere in the expression?  AND
//   3. does the WORKFLOW FILE already reference a PAT secret elsewhere?
//
// All three ⇒ finding. Condition 3 is what keeps this a consistency check rather than a
// policy: a workflow that has never heard of a PAT is not being inconsistent, and a repo-wide
// "always use a PAT" rule would be wrong (accelerator-move-next.yml uses GITHUB_TOKEN
// *because* of the no-re-trigger property, and says so).
//
// A step that names a PAT in `GH_TOKEN` and keeps `FALLBACK_GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
// for a measured degradation path PASSES. That is the shape the repair took, and it is the
// shape this audit is protecting: prefer the PAT, degrade loudly, never silently.
//
// HONEST LIMITS — stated so a green run is not read as more than it is
// --------------------------------------------------------------------
//   * `git push` IS in the same event-suppression class, but its credential is a JOB-level
//     property (`actions/checkout` `token:` / the persisted credential), not the step's
//     `env:`. Checking it here would be checking the wrong scope. Every push lane in this
//     repo was hand-verified on 2026-08-25 and is already on a PAT chain or a dedicated
//     token (`lint-autofix-apply.yml` AUTOFIX_TOKEN, `mirror-to-fork.yml` ACEHACK_MIRROR_TOKEN,
//     `agent-heartbeat.yml` checkout PAT chain); this audit does not keep them that way.
//   * Full-line shell comments are stripped before write-op detection, because these workflows
//     carry long comment blocks that MENTION `gh pr create`. Trailing inline comments are not
//     stripped — a write op hidden behind one would be a false POSITIVE, which is the safe
//     direction.
//   * It reasons about the literal `${{ }}` expression, not about what the token can actually
//     DO. A PAT lacking the scope still passes here; that is a credential fact, not a
//     workflow fact, and the workflow's own `::warning::` is what surfaces it.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOW_DIR = ".github/workflows";
const RULE = "docs/research/2026-08-13-graphql-is-the-scarce-budget-and-automerge-is-graphql-only.md";

const findings: string[] = [];
function fail(headline: string, detail: string): void {
  findings.push(`${headline}\n    ${detail}`);
}

/** A `secrets.X` reference that is not the workflow-provided token. */
export const PAT_REF = /secrets\.([A-Z][A-Z0-9_]*(?:_TOKEN|_PAT))\b/g;
export function patSecretsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(PAT_REF)) {
    const name = m[1];
    if (name !== undefined && name !== "GITHUB_TOKEN") out.add(name);
  }
  return [...out].sort();
}

/**
 * Forge WRITES performed through the `gh` CLI with the step's own credential.
 *
 * `gh pr merge` covers both arming (`--auto`, the GraphQL `enablePullRequestAutoMerge`
 * mutation) and direct merge; both attribute the eventual merge to the acting identity, which
 * is the whole mechanism this audit exists for.
 */
export const WRITE_OPS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bgh\s+pr\s+merge\b/, "gh pr merge (arms or performs a merge)"],
  [/\bgh\s+pr\s+create\b/, "gh pr create (opens a PR)"],
  [/\bgh\s+pr\s+(?:close|reopen|ready|edit)\b/, "gh pr close/reopen/ready/edit (mutates a PR)"],
  [/\bgh\s+api\b[^\n]*(?:-X|--method)\s+(?:POST|PUT|PATCH|DELETE)\b/, "gh api with a mutating method"],
  // This repo's own forge writers. Most PRs here are NOT opened by `gh pr create` — they are
  // opened by `flush-via-staging.ts flush`, which pushes a staging branch and opens the PR
  // over the API using the step's `GH_TOKEN`. Matching only the `gh` CLI would have left the
  // eleven telemetry flush lanes — the largest PR-producing population in the repo —
  // unchecked, which is the vacuity class this file is otherwise built to refuse.
  [/flush-via-staging\.ts\s+flush\b/, "flush-via-staging.ts flush (pushes a branch, opens a PR)"],
  [/merge-heartbeats-to-main\.ts\b/, "merge-heartbeats-to-main.ts (opens the heartbeat flush PR)"],
];

/** Strip full-line shell comments; these workflows discuss `gh pr create` at length in prose. */
export function stripComments(run: string): string {
  return run
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

export interface Step {
  readonly name: string;
  readonly line: number;
  readonly body: string;
}

/**
 * Split a workflow into steps.
 *
 * Line-based on purpose: the check is about the literal `${{ }}` expression a maintainer sees
 * in the diff, and a YAML round-trip would normalise away exactly the textual detail being
 * checked. A step starts at `- name:` and runs until the next list item at the same
 * indentation or the first line indented less than the marker.
 */
export function parseSteps(text: string): Step[] {
  const lines = text.split("\n");
  const starts: Array<{ idx: number; indent: number; name: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)-\s+name:\s*(.*)$/.exec(lines[i]!);
    if (m) starts.push({ idx: i, indent: m[1]!.length, name: m[2]!.trim() });
  }
  const steps: Step[] = [];
  for (let s = 0; s < starts.length; s++) {
    const { idx, indent, name } = starts[s]!;
    let end = lines.length;
    for (let i = idx + 1; i < lines.length; i++) {
      const l = lines[i]!;
      if (l.trim() === "") continue;
      const ind = l.length - l.trimStart().length;
      if (ind <= indent) {
        end = i;
        break;
      }
    }
    steps.push({ name, line: idx + 1, body: lines.slice(idx, end).join("\n") });
  }
  return steps;
}

/** The value of `GH_TOKEN:` in this step's env, or null when the step sets none. */
export function ghTokenExpr(body: string): string | null {
  const m = /^\s*GH_TOKEN:\s*(.+?)\s*$/m.exec(body);
  return m ? m[1]! : null;
}

/**
 * The verdict for ONE step, as a pure function so the contract has a falsifier.
 *
 * Returns the offending write-op label, or null when the step is fine. Neutral fact, not a
 * sentence: the caller decides whether to fail the build
 * (.claude/rules/dual-use-detection-is-neutral-oracle-decides.md).
 */
export function judgeStep(step: Step, patsInFile: readonly string[]): string | null {
  const run = stripComments(step.body);
  const op = WRITE_OPS.find(([re]) => re.test(run));
  if (!op) return null;
  // Condition 3: a workflow that never heard of a PAT is not being inconsistent.
  if (patsInFile.length === 0) return null;
  const expr = ghTokenExpr(step.body);
  if (expr === null) return null; // credential comes from elsewhere; out of scope
  if (patSecretsIn(expr).length > 0) return null; // reaches the PAT — the repaired shape
  if (!/secrets\.GITHUB_TOKEN|github\.token/.test(expr)) return null;
  return op[1];
}

/** True when the step performs a forge write at all (used for the liveness floor). */
export function isForgeWrite(step: Step): boolean {
  const run = stripComments(step.body);
  return WRITE_OPS.some(([re]) => re.test(run));
}

// ── Scan ──────────────────────────────────────────────────────────────────────
function main(): void {
  let files: string[];
  try {
    files = readdirSync(WORKFLOW_DIR)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .sort();
  } catch {
    console.error(`FATAL: cannot read ${WORKFLOW_DIR}. Run from the repository root.`);
    process.exit(2);
  }

  let stepsSeen = 0;
  let writeStepsSeen = 0;
  let patFiles = 0;

  for (const f of files) {
    const path = join(WORKFLOW_DIR, f);
    const text = readFileSync(path, "utf8");
    const pats = patSecretsIn(text);
    if (pats.length > 0) patFiles++;

    for (const step of parseSteps(text)) {
      stepsSeen++;
      if (isForgeWrite(step)) writeStepsSeen++;
      const op = judgeStep(step, pats);
      if (op === null) continue;
      fail(
        `${path}:${step.line} — step "${step.name}" performs ${op} with a bare workflow token.`,
        `GH_TOKEN is \`${ghTokenExpr(step.body)}\`, but this workflow already references ${pats.join(", ")}. ` +
          `A forge write made with GITHUB_TOKEN is attributed to github-actions[bot], and GitHub ` +
          `suppresses workflow triggers for GITHUB_TOKEN-driven events — so the resulting ` +
          `pull_request event never fires and pr-archive-on-merge.yml never runs, with no failure ` +
          `anywhere. FIX: use the same fallback chain the rest of this file uses ` +
          `(\`secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.ZETA_PR_ARCHIVE_TOKEN || secrets.GITHUB_TOKEN\`) ` +
          `and keep GITHUB_TOKEN as an explicit, LOUD FALLBACK_GH_TOKEN rather than the silent default.`,
      );
    }
  }

  // ── Liveness — the audit must not pass while inspecting nothing ─────────────
  if (files.length === 0) {
    fail(
      `LIVENESS: found 0 workflow files under ${WORKFLOW_DIR}.`,
      `Every check below is then vacuously true. Refusing to report success.`,
    );
  }
  if (stepsSeen === 0) {
    fail(
      `LIVENESS: parsed 0 steps out of ${files.length} workflow file(s).`,
      `The step splitter matched nothing, so no step could ever be judged. Refusing to report success.`,
    );
  }
  if (writeStepsSeen === 0) {
    fail(
      `LIVENESS: found 0 forge-write steps across ${files.length} workflow file(s).`,
      `This repo demonstrably merges and opens PRs from CI, so a zero here means the write-op ` +
        `patterns have drifted from what the workflows actually run. Refusing to report success.`,
    );
  }
  if (patFiles === 0) {
    fail(
      `LIVENESS: no workflow references a PAT secret.`,
      `The comparison this audit makes needs a PAT to exist somewhere; with none, every step ` +
        `passes for the wrong reason. Refusing to report success.`,
    );
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  // Coverage is printed unconditionally. "0 checked" must never read as "0 problems".
  console.log(
    `workflow write-token consistency: ${files.length} workflow(s), ${stepsSeen} step(s), ` +
      `${writeStepsSeen} forge-write step(s), ${patFiles} workflow(s) carrying a PAT secret`,
  );

  if (findings.length > 0) {
    console.error(`\n${findings.length} finding(s):\n`);
    for (const f of findings) console.error(`  - ${f}\n`);
    console.error(`Background: ${RULE}`);
    process.exit(1);
  }

  console.log("OK — every forge-write step reaches the PAT its workflow already knows about.");
}

if (import.meta.main) main();
