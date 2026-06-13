#!/usr/bin/env bun
// validate-otto-diff.ts — gates commits against tools/orchestrator/otto-state.json constraints.
//
// Reads `git diff --cached --name-status` (or accepts diff via stdin for testing),
// classifies each modified path against constraint rules, and exits non-zero on
// violations unless a Vera+Riven PASS receipt is present in the staged commit
// message (HEAD~0 not yet created; receipt search uses .git/COMMIT_EDITMSG).
//
// Per Vera+Riven symmetric-dispatch convergence 2026-05-06:
//   - Otto = actuator, not judge
//   - Peers = judging quorum
//   - Cage = path and diff enforcement
//
// Exit codes:
//   0 — diff is permitted (no violations OR co-signed receipts present)
//   1 — invocation error (bad arguments, files missing)
//   2 — constraint violation (operator must obtain Vera+Riven PASS or revise diff)
//
// Run:
//   bun tools/orchestrator/validate-otto-diff.ts                 # validates staged
//   bun tools/orchestrator/validate-otto-diff.ts --diff <path>   # validates diff file

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolveRepoRoot();

interface OttoState {
  readonly status: "free" | "in-jail" | "probationary" | "retired";
  readonly constraints: {
    readonly no_current_edits: boolean;
    readonly no_other_entity_memory: boolean;
    readonly no_otto_behavior_narrative: boolean;
    readonly no_peer_output_deletion: boolean;
    readonly templated_dispatches_only: boolean;
    readonly memory_cron_governance_alignment_commits_require_pass: boolean;
  };
}

interface Violation {
  readonly path: string;
  readonly status: string;
  readonly rule: string;
  readonly detail: string;
}

function resolveRepoRoot(): string {
  let dir = resolve(HERE);
  while (dir !== "/" && !existsSync(resolve(dir, ".git"))) dir = dirname(dir);
  return dir;
}

function loadState(): OttoState {
  const path = resolve(REPO_ROOT, "tools/orchestrator/otto-state.json");
  if (!existsSync(path)) {
    process.stderr.write(`error: otto-state.json missing at ${path}\n`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8")) as OttoState;
}

function getStagedDiff(): string {
  const r = spawnSync("git", ["diff", "--cached", "--name-status"], {
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  if (r.status !== 0) {
    process.stderr.write(`error: git diff --cached failed: ${r.stderr}\n`);
    process.exit(1);
  }
  return r.stdout;
}

function getCommitMsg(): string {
  const path = resolve(REPO_ROOT, ".git/COMMIT_EDITMSG");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function hasReceipts(commitMsg: string): { vera: boolean; riven: boolean } {
  // Receipts are OUTPUT-FILE markers from peer-call wrappers in the commit
  // message body. Format: `OUTPUT-FILE: /tmp/peer-call-output/<ts>-{vera,riven}-*.md`
  const veraRe = /OUTPUT-FILE:\s*\S*-vera[-.]/i;
  const rivenRe = /OUTPUT-FILE:\s*\S*-riven[-.]/i;
  return {
    vera: veraRe.test(commitMsg),
    riven: rivenRe.test(commitMsg),
  };
}

function classify(
  path: string,
  status: string,
  state: OttoState,
): Violation[] {
  const violations: Violation[] = [];
  const c = state.constraints;

  // Rule 1: no_current_edits — memory/CURRENT-*.md is entity-owned
  if (c.no_current_edits && /^memory\/CURRENT-/.test(path)) {
    violations.push({
      path,
      status,
      rule: "no_current_edits",
      detail: "memory/CURRENT-*.md is entity-owned; only the entity (or Aaron) authors edits.",
    });
  }

  // Rule 2: no_other_entity_memory — feedback/project files about other entities
  if (
    c.no_other_entity_memory &&
    /^memory\/(feedback|project|user|reference)_.*(amara|ani|vera|riven)/.test(path)
  ) {
    violations.push({
      path,
      status,
      rule: "no_other_entity_memory",
      detail: "Memory file references another named entity in filename; entity-substrate authorship requires consent.",
    });
  }

  // Rule 3: no_otto_behavior_narrative — Otto-self-narrative memory files
  if (
    c.no_otto_behavior_narrative &&
    /^memory\/(feedback|project|user|reference)_.*otto/i.test(path)
  ) {
    violations.push({
      path,
      status,
      rule: "no_otto_behavior_narrative",
      detail: "Memory file authored by/about Otto's behavior or coordination; requires Vera+Riven co-signature.",
    });
  }

  // Rule 4: no_peer_output_deletion — deleting peer-call output captures
  if (
    c.no_peer_output_deletion &&
    status === "D" &&
    /peer-call-output/.test(path)
  ) {
    violations.push({
      path,
      status,
      rule: "no_peer_output_deletion",
      detail: "Peer-call output capture file is being deleted; peer time is preserved as substrate.",
    });
  }

  // Rule 5: otto-state.json itself is co-signed-only
  if (path === "tools/orchestrator/otto-state.json") {
    violations.push({
      path,
      status,
      rule: "otto_state_modification",
      detail: "tools/orchestrator/otto-state.json is read-only for Otto; modifications require Vera+Riven PASS.",
    });
  }

  // Rule 6: gated commit surfaces
  if (
    c.memory_cron_governance_alignment_commits_require_pass &&
    /^(memory\/|tools\/peer-call\/|tools\/orchestrator\/|docs\/governance|docs\/ALIGNMENT|GOVERNANCE\.md|CLAUDE\.md|AGENTS\.md)/.test(path)
  ) {
    violations.push({
      path,
      status,
      rule: "gated_commit_surface",
      detail: "Commit touches a gated surface (memory/, peer-call/, orchestrator/, governance, alignment, CLAUDE.md, AGENTS.md); Vera+Riven PASS required.",
    });
  }

  return violations;
}

function main(): number {
  const state = loadState();

  if (state.status === "free") {
    console.log("otto-state: free — no constraints active.");
    return 0;
  }

  const diff = getStagedDiff();
  if (!diff.trim()) {
    console.log("validate-otto-diff: no staged changes.");
    return 0;
  }

  const lines = diff.split("\n").filter((l) => l.trim());
  const allViolations: Violation[] = [];

  for (const line of lines) {
    const parts = line.split("\t");
    const status = parts[0] ?? "";
    const path = parts[1] ?? "";
    if (!path) continue;
    allViolations.push(...classify(path, status, state));
  }

  if (allViolations.length === 0) {
    console.log(`validate-otto-diff: ${lines.length} files, 0 violations under status="${state.status}".`);
    return 0;
  }

  const msg = getCommitMsg();
  const receipts = hasReceipts(msg);
  const coSigned = receipts.vera && receipts.riven;

  console.log(`otto-state: ${state.status}`);
  console.log(`Violations: ${allViolations.length}`);
  console.log("");
  for (const v of allViolations) {
    console.log(`  [${v.status}] ${v.path}`);
    console.log(`    rule: ${v.rule}`);
    console.log(`    detail: ${v.detail}`);
  }
  console.log("");

  if (coSigned) {
    console.log(`Vera+Riven receipts present in commit message; PASS gate satisfied.`);
    console.log(`  vera: ${receipts.vera}, riven: ${receipts.riven}`);
    return 0;
  }

  console.log(`Required: Vera+Riven PASS receipts in commit message body.`);
  console.log(`  vera receipt found: ${receipts.vera}`);
  console.log(`  riven receipt found: ${receipts.riven}`);
  console.log(`  format: "OUTPUT-FILE: /tmp/peer-call-output/<ts>-{vera,riven}-*.md" lines`);
  return 2;
}

if (import.meta.main) {
  process.exit(main());
}
