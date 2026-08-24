#!/usr/bin/env bun
// audit-skip-token-cannot-land.ts — AH002: a commit-back lane whose push can NEVER land.
//
// The rule this enforces
// ----------------------
// Ruleset "CI Gate" (16134995) makes `gate (required)` a required status check on the
// default branch. A required check is evaluated at PUSH time against the pushed tip, so
// a commit that has never been through a check run is rejected before any check could
// start:
//
//     remote: - Required status check "gate (required)" is expected.
//
// A `[skip ci]` token in that commit's message GUARANTEES no `gate` run is ever
// scheduled for it. So the two together are not a race that a retry clears — they are a
// **deterministic, permanent** refusal. The lane cannot land, ever, by construction.
//
// Why this needs its own check (the reason AH001 does not catch it)
// -----------------------------------------------------------------
// AH001 asks "could this lane destroy work it created?" and is satisfied by a rebase.
// A rebase does not help here: re-expressing onto a moved base still produces a tip with
// no gate run and a skip token, which is refused identically. The properties are
// independent — a lane can pass AH001 and still be unable to land, which is exactly the
// state `lockfile-healer` was in when this audit was written.
//
// The vacuity this closes
// -----------------------
// The skip-token refusal already existed — inside `flush-via-staging.ts`, which refuses a
// skip token in a message handed to it. That protects every lane that ALREADY adopted the
// safe route, and is invisible to every lane that did not. A guard that covers only those
// who no longer need catching is the vacuity class: it reads as protection and constrains
// nothing. This audit moves the refusal to where un-migrated lanes actually live.
//
// Live instance (2026-08-24): `lockfile-healer.yml` committed `[skip ci]` and pushed
// `HEAD:main`. It was green 40/40 because `Commit and push` is gated on
// `steps.detect.outputs.code == '1'` and no lockfile drift had occurred — the
// load-bearing path had never executed under the ruleset. The lane would have failed at
// the worst possible moment: when `bun install --frozen-lockfile` was already broken for
// every consumer.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-skip-token-cannot-land.ts
//   bun src/Core.TypeScript/hygiene/audit-skip-token-cannot-land.ts --json
//
// Exit codes:
//   0   no lane pushes a skip-token commit at a gate-protected branch
//   1   at least one lane can never land
//   2   configuration error (workflow dir missing)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

const WORKFLOW_DIR = ".github/workflows";
export const DRIFT_CLASS = "AH002";

/**
 * A push at the gate-protected shared ref. Same scoping as AH001: `main` is the branch
 * ruleset "CI Gate" covers, so it is the only ref where a missing gate run is fatal. A
 * push to `heartbeat/*` is precisely the sanctioned route and must never be flagged.
 */
const PUSH_TO_MAIN = /(?<![\w-])git\s+push\b[^\n]*(HEAD:main\b|origin\s+main\b)/;
/** Any recognised CI-skip token. GitHub honours these in the message's first line. */
const SKIP_TOKEN = /\[(skip ci|ci skip|skip actions|actions skip)\]/i;
/** Only lanes that CREATE commits can push an ungated tip. */
const COMMITS = /(?<![\w-])git\s+commit(?![\w-])/;
/**
 * A shell comment, or a token named inside an echoed instruction — neither reaches a
 * commit message. This is what lets a workflow DOCUMENT the ban (as the fixed
 * `lockfile-healer` and `drift-sweep` both do) without tripping the check that enforces it.
 */
const NOT_EXECUTED = /^\s*#|(?<![\w-])echo\b/;

export interface Finding {
  file: string;
  line: number;
  snippet: string;
}

export interface AuditResult {
  workflowsScanned: number;
  commitBackLanes: number;
  findings: Finding[];
}

/**
 * Scan one workflow for a run-block that both carries a skip token in a commit it builds
 * AND pushes at `main`. Both halves must be in the SAME block: a skip token in one step
 * and a push in another are not necessarily the same commit, and flagging that pairing
 * across a whole file produced false positives on lanes that push a different ref.
 *
 * Line-based rather than YAML-parsed for the same reason AH001 is: the property is about
 * shell text inside a `run:` block, which survives no YAML abstraction.
 */
export function auditWorkflow(relPath: string, src: string): Finding[] {
  const lines = src.split("\n");
  const findings: Finding[] = [];

  let blockStart = -1;
  const flushBlock = (endExclusive: number) => {
    if (blockStart < 0) return;
    const block = lines.slice(blockStart, endExclusive);
    const executable = block.filter((l) => !NOT_EXECUTED.test(l));
    const buildsSkipCommit = executable.some((l) => SKIP_TOKEN.test(l));
    const createsCommit = executable.some((l) => COMMITS.test(l));
    if (!buildsSkipCommit || !createsCommit) {
      blockStart = -1;
      return;
    }
    for (let i = 0; i < block.length; i++) {
      const text = block[i] ?? "";
      if (NOT_EXECUTED.test(text)) continue;
      if (!PUSH_TO_MAIN.test(text)) continue;
      findings.push({ file: relPath, line: blockStart + i + 1, snippet: text.trim() });
    }
    blockStart = -1;
  };

  for (let n = 0; n < lines.length; n++) {
    const text = lines[n] ?? "";
    if (/^\s*-?\s*(name|uses|id|if|with|env)\s*:/.test(text) && blockStart >= 0) {
      flushBlock(n);
    }
    if (/^\s*run\s*:/.test(text)) {
      flushBlock(n);
      blockStart = n;
    }
  }
  flushBlock(lines.length);
  return findings;
}

export function runAudit(): AuditResult {
  const root = repoRoot();
  const dir = resolve(root, WORKFLOW_DIR);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();

  const findings: Finding[] = [];
  let commitBackLanes = 0;
  for (const f of files) {
    const abs = join(dir, f);
    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (PUSH_TO_MAIN.test(src) && COMMITS.test(src)) commitBackLanes++;
    findings.push(...auditWorkflow(relative(root, abs), src));
  }
  return { workflowsScanned: files.length, commitBackLanes, findings };
}

function renderHuman(r: AuditResult): string {
  const head = `${r.workflowsScanned} workflow(s), ${r.commitBackLanes} commit-back lane(s)`;
  if (r.findings.length === 0) {
    return `skip-token-cannot-land: OK — ${head}; no lane pushes a skip-token commit at a gate-protected branch.`;
  }
  return [
    `skip-token-cannot-land: CANNOT LAND — ${r.findings.length} lane(s) push a commit that`,
    `is refused by construction. (${head})`,
    "",
    'Ruleset "CI Gate" evaluates `gate (required)` at PUSH time. A `[skip ci]` commit is',
    "never scheduled for a gate run, so the push is refused deterministically — retrying",
    "cannot clear it. Route the write through `flush-via-staging.ts` instead: park the",
    "commit on `heartbeat/<lane>`, open a PR, and let `gate` actually run.",
    "",
    ...r.findings.map((f) => `  ${f.file}:${f.line}\n    ${f.snippet}`),
  ].join("\n");
}

export function main(argv: string[]): number {
  const root = repoRoot();
  try {
    if (!statSync(resolve(root, WORKFLOW_DIR)).isDirectory()) throw new Error("not a dir");
  } catch {
    process.stderr.write(`error: ${WORKFLOW_DIR} not found under ROOT=${root}\n`);
    return 2;
  }
  const r = runAudit();
  process.stdout.write((argv.includes("--json") ? JSON.stringify(r, null, 2) : renderHuman(r)) + "\n");
  return r.findings.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
