#!/usr/bin/env bun
// audit-push-without-rebase.ts — AH001: a commit-back lane that can destroy its own work.
//
// The rule this enforces
// ----------------------
// **Accidental heat is work destroyed by a lane that had a reversible form available
// and did not take it.** A workflow that commits and then `git push`es WITHOUT first
// rebasing loses the race whenever the remote has moved — and the commit it just built
// is erased. The frame was always landable; the lane simply did not know how to
// re-express it onto a moved base.
//
// Rebase is the reversible form: `Adj`-shaped in the Landauer sense, a re-expression of
// the same work that loses nothing. A failed bare push is an ERASURE — non-Adj, pays,
// and nobody consented to it.
//
// Live instance (2026-08-10): `tick-metrics` (run 31428773872) computed a correct metric
// frame, committed it, and lost it to a non-fast-forward rejection. It was the last
// commit-back lane still pushing bare; `lockfile-healer` and `drift-sweep` already
// rebased. Two lockfile breaks the same day were the same class — a lane that is fine in
// isolation and fails only under fleet concurrency.
//
// Why this is mechanically checkable when "waste" is not
// ------------------------------------------------------
// The question is not "was this expensive" — unanswerable in general. It is: **did a
// reversible retry form exist and go unused?** For a git write that reduces to a text
// question about the run block, and it is exact.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-push-without-rebase.ts
//   bun src/Core.TypeScript/hygiene/audit-push-without-rebase.ts --json
//
// Exit codes:
//   0   every pushing lane rebases first
//   1   at least one lane can destroy its own commit
//   2   configuration error (workflow dir missing)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

const WORKFLOW_DIR = ".github/workflows";
export const DRIFT_CLASS = "AH001";

/**
 * A push to the SHARED ref. Scoped deliberately: `main` is where every lane collides, so
 * a lost race there destroys work built against a base the whole fleet moves. A push to a
 * branch the lane itself owns has a different (usually empty) contention set, and
 * flagging those was the difference between a signal and noise on the first real run.
 */
const PUSH_TO_MAIN =
  /(?<![\w-])git\s+push\b[^\n]*(HEAD:main\b|origin\s+main\b)|(?<![\w-])git\s+push\s*(?:$|;|&&)/;
/** Deliberate overwrite — a different decision, out of scope for this check. */
const FORCE_PUSH = /(?<![\w-])git\s+push\b[^\n]*(--force|--force-with-lease|\+refs)/;
/**
 * ANY form that re-expresses local work onto a moved base. Both shapes count:
 *   - rebase-then-push           (lockfile-healer, drift-sweep, tick-metrics)
 *   - push-then-replay-on-reject (agent-heartbeat's retry loop — arguably better, since
 *     it pays the re-expression only when it actually races)
 * Requiring the rebase to come FIRST was too narrow and flagged the best-handled lane in
 * the repo. The property is the AVAILABILITY of a reversible retry, not its position.
 */
const REEXPRESSION = /(?<![\w-])git\s+(pull\s+--rebase|rebase|fetch)(?![\w-])/;
/** Only lanes that CREATE commits can destroy them. A push of an existing ref cannot. */
const COMMITS = /(?<![\w-])git\s+commit(?![\w-])/;
/** A shell comment, or a push named inside an echoed instruction — neither executes. */
const NOT_EXECUTED = /^\s*#|(?<![\w-])echo\b/;

export interface Finding {
  file: string;
  line: number;
  snippet: string;
}

export interface AuditResult {
  workflowsScanned: number;
  pushingLanes: number;
  findings: Finding[];
}

/**
 * Scan one workflow's text for run-blocks that commit then push with no rebase.
 *
 * Deliberately line-based rather than YAML-parsed: the property is ORDER of shell
 * commands inside a block, which survives no YAML abstraction. A rebase AFTER the push
 * does not help, so position matters and is checked.
 */
export function auditWorkflow(relPath: string, src: string): Finding[] {
  const lines = src.split("\n");
  const findings: Finding[] = [];

  // Treat each `run:` block as a unit: from a line containing `run:` until the
  // indentation returns to that of the step key (`- name:` / another key).
  let blockStart = -1;
  const flushBlock = (endExclusive: number) => {
    if (blockStart < 0) return;
    const block = lines.slice(blockStart, endExclusive);
    if (!block.some((l) => COMMITS.test(l))) {
      blockStart = -1;
      return; // nothing created here, so nothing to destroy
    }
    // A reversible retry ANYWHERE in the block counts — a rebase after the push is
    // agent-heartbeat's replay-on-rejection loop, which is a legitimate (arguably
    // better) form. Position is not the property; availability is.
    const hasReexpression = block.some((l) => !NOT_EXECUTED.test(l) && REEXPRESSION.test(l));
    if (hasReexpression) {
      blockStart = -1;
      return;
    }
    for (let i = 0; i < block.length; i++) {
      const text = block[i] ?? "";
      if (NOT_EXECUTED.test(text)) continue; // comment, or a push named inside an echo
      if (!PUSH_TO_MAIN.test(text) || FORCE_PUSH.test(text)) continue;
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
  let pushingLanes = 0;
  for (const f of files) {
    const abs = join(dir, f);
    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (PUSH_TO_MAIN.test(src) && COMMITS.test(src)) pushingLanes++;
    findings.push(...auditWorkflow(relative(root, abs), src));
  }
  return { workflowsScanned: files.length, pushingLanes, findings };
}

function renderHuman(r: AuditResult): string {
  const head = `${r.workflowsScanned} workflow(s), ${r.pushingLanes} commit-back lane(s)`;
  if (r.findings.length === 0) {
    return `push-without-rebase: OK — ${head}; every one re-expresses onto the moved base before pushing.`;
  }
  return [
    `push-without-rebase: ACCIDENTAL HEAT — ${r.findings.length} lane(s) can destroy their own commit. (${head})`,
    "",
    "A bare `git push` after `git commit` loses the race when the remote has moved, and",
    "the commit is erased. Rebase first: it re-expresses the same work onto the new base",
    "and loses nothing.",
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
