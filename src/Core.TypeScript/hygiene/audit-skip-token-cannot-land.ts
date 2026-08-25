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
/**
 * Only lanes that CREATE commits can push an ungated tip.
 *
 * `git -c <k>=<v> commit` is the same commit. Surfaced 2026-08-25 by the `-c` regression
 * test below: without the allowance, prefixing ONE global option hid the commit from the
 * audit entirely — the same "spelling decides the verdict" defect as the `echo` hole, one
 * token to the left. `zetadb-scheduled-node.yml` on `main` used both spellings in one block
 * (`| git commit --file=-` and `git -c core.editor=true commit --amend`), so the bare form
 * happened to carry it. A lane that used only the `-c` form would have been invisible.
 */
const COMMITS = /(?<![\w-])git\s+(?:-c\s+\S+\s+)*commit(?![\w-])/;
/**
 * A run-block that builds its commit message on STDIN — `{ echo …; } | git commit --file=-`
 * or `-F -`. Inside such a block an `echo` is not narration, it IS the message.
 *
 * WHY THIS EXISTS (2026-08-25) — the exemption below was inverted for the one live offender.
 * `NOT_EXECUTED` exempted any line containing `echo`, so a workflow could DOCUMENT the ban
 * without tripping the check that enforces it. But the standard idiom for *constructing* a
 * commit message is exactly a group of `echo`s piped into `git commit --file=-` — so the
 * exemption written to ignore narration was silently ignoring the message itself.
 *
 * Measured, not reasoned. `zetadb-scheduled-node.yml` on `main` commits
 * `db(zetadb): fold scheduled journal [skip ci]` through
 * `{ echo "…[skip ci]"; … } | git commit --file=-` and then pushes `HEAD:main` in a
 * five-attempt retry loop. AH002 reported OK on it. Rewriting that one `echo` as `printf` —
 * no other edit — made AH002 fire on the push line. A single character of spelling decided
 * whether the check could see the only lane on `main` it was built to catch.
 *
 * That is the vacuity class appearing inside an enforcement surface: a check that reads as
 * protection and, for the shape that actually occurs, constrains nothing. What it was masking
 * is not hypothetical — the retry loop would have reported five identical PERMANENT ruleset
 * refusals as "sustained contention" (081KZM0FTJM), pointing the diagnosis at a race that
 * does not exist.
 *
 * NARROWING, NOT REMOVAL. A block with no stdin-message sink keeps the full `echo` exemption,
 * so `lockfile-healer` and `drift-sweep` still document the ban freely. Only inside a block
 * that demonstrably pipes text into a commit message does `echo` become executable content.
 * Honest limit: `<<EOF` heredocs and `git commit -m "$(…)"` are other ways to build a message
 * and are not recognised here. This closes the shape that occurs in this repo, and the
 * regression tests name the shapes it does not.
 */
const COMMIT_MESSAGE_FROM_STDIN = /(?<![\w-])git\s+(?:-c\s+\S+\s+)*commit\b[^\n]*(?:--file=-|-F\s+-)(?!\S)/;

/**
 * A shell comment, or a token named inside an echoed instruction — neither reaches a
 * commit message. This is what lets a workflow DOCUMENT the ban (as the fixed
 * `lockfile-healer` and `drift-sweep` both do) without tripping the check that enforces it.
 *
 * `echoIsMessage` is set when the enclosing block builds its message on stdin. A shell
 * comment is never executed either way.
 */
export function notExecuted(line: string, echoIsMessage: boolean): boolean {
  if (/^\s*#/.test(line)) return true;
  if (echoIsMessage) return false;
  return /(?<![\w-])echo\b/.test(line);
}

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
    // Decided per BLOCK, not per line: whether an `echo` is narration or message content is
    // a property of the block it sits in. Comments are stripped first so a block cannot
    // acquire the sink from a line that documents it.
    const echoIsMessage = block.some((l) => !/^\s*#/.test(l) && COMMIT_MESSAGE_FROM_STDIN.test(l));
    const executable = block.filter((l) => !notExecuted(l, echoIsMessage));
    const buildsSkipCommit = executable.some((l) => SKIP_TOKEN.test(l));
    const createsCommit = executable.some((l) => COMMITS.test(l));
    if (!buildsSkipCommit || !createsCommit) {
      blockStart = -1;
      return;
    }
    for (let i = 0; i < block.length; i++) {
      const text = block[i] ?? "";
      if (notExecuted(text, echoIsMessage)) continue;
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
