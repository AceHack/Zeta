#!/usr/bin/env bun
// audit-workflow-credential-role-separation.ts — AH003: a `||` chain that collapses
// three distinct credential ROLES into one variable.
//
// The rule this enforces
// ----------------------
// `docs/security/2026-08-17-society-heartbeat-token-boundary-and-gate-start-failure.md`
// is the authoritative role table for this repository, and it names THREE roles with
// three separate credentials:
//
//     dispatch     -> ZETA_SOCIETY_DISPATCH_TOKEN   (workflow-dispatch a named workflow)
//     branch-push  -> ZETA_TELEMETRY_FLUSH_TOKEN    (authenticate the staging-branch push)
//     PR-create    -> ZETA_PR_ARCHIVE_TOKEN         (authenticate `gh pr create` / arming)
//
// A workflow expression of the shape
//
//     ${{ secrets.A || secrets.B || secrets.GITHUB_TOKEN }}
//
// erases that table at the point of use. `||` in a GitHub expression selects on the
// left operand being FALSY — for a secret, on it being the EMPTY STRING — so an absent
// scoped credential is silently replaced by one carrying DIFFERENT authority. The step
// then runs, and fails somewhere DOWNSTREAM with an error naming the wrong subject.
//
// Why the `secrets.GITHUB_TOKEN` rung is the worst one
// ----------------------------------------------------
// GitHub's recursion guard: events produced by actions taken with `GITHUB_TOKEN` do not
// trigger other workflow runs. So a lane that quietly degraded onto it did not merely
// run with less authority — it stopped emitting the events downstream jobs wait on,
// while still reporting success. A check that did not run must never look like a check
// that passed, and a lane that stopped delivering must never look like one that
// delivered.
//
// The vacuity this closes
// -----------------------
// Nothing in this repository could state the role boundary mechanically. The boundary
// lived in prose (the security doc) and in per-step comments — several of which, on
// `main` when this audit was written, described the ladder as if the fallback were the
// SAFE half ("the `||` ladder covers ABSENCE"). Prose that mis-describes the mechanism
// is worse than absent prose: it reads as a design and encodes a defect. 25 sites across
// 12 workflows had accumulated behind that reading.
//
// Measured cost of the defect (2026-08-25): three separate agents misdiagnosed one
// heartbeat failure as an auto-merge token-scope fault. The step that produced the
// misleading error is READ-ONLY and had no business holding a write-scoped PAT at all.
//
// WHAT THIS AUDIT DOES *NOT* FORBID
// ---------------------------------
// A deliberate, EXPLICIT, LOGGED degradation inside a `run:` block — probe the scope the
// work actually uses, then `echo "::warning ...FIX: grant <secret> <scope>"` and swap.
// `agent-heartbeat.yml` implements exactly that and it is good design: it distinguishes
// DENIED from ABSENT and says which one it hit, out loud. The forbidden thing is the
// SILENT selection in an `env:`/`with:` expression, where no log line can ever mention
// that a different authority was substituted. Shell-level fallbacks are untouched here,
// as is any expression naming exactly ONE secret.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-workflow-credential-role-separation.ts
//   bun src/Core.TypeScript/hygiene/audit-workflow-credential-role-separation.ts --json
//
// Exit codes:
//   0   every credential expression names exactly one secret
//   1   at least one expression chains two or more secrets
//   2   configuration error (workflow dir missing)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

const WORKFLOW_DIR = ".github/workflows";
export const DRIFT_CLASS = "AH003";

/**
 * A `${{ ... }}` expression. Non-greedy so adjacent expressions on one line stay separate;
 * `[^]` rather than `.` so a multi-line expression is still one match.
 */
const EXPRESSION = /\$\{\{([^]*?)\}\}/g;

/** `secrets.NAME`. The dotted form is the only one GitHub accepts for a named secret. */
const SECRET_REF = /\bsecrets\.([A-Za-z_][A-Za-z0-9_]*)/g;

/**
 * A comment line. Workflow files in this repo DOCUMENT the removed ladder at length —
 * `agent-heartbeat.yml` quotes the exact expression it no longer uses — and a check that
 * cannot distinguish a description from a use would make the fix unlandable. This is the
 * same carve-out `audit-skip-token-cannot-land.ts` needs for the same reason.
 *
 * Scoped to YAML comments only (`#` first on the line). An expression inside a shell
 * heredoc or an `echo` is still live text as far as GitHub's expression evaluator is
 * concerned — it is interpolated before the shell ever sees it — so those are NOT exempt.
 */
const YAML_COMMENT = /^\s*#/;

export interface Finding {
  /** Repo-relative workflow path. */
  file: string;
  /** 1-based line of the expression's opening `${{`. */
  line: number;
  /** The secrets the expression chains, in source order. */
  secrets: string[];
  /** The offending expression, whitespace-collapsed. */
  expression: string;
}

export interface AuditResult {
  workflowsScanned: number;
  /** Every `${{ ... }}` containing at least one `secrets.` reference. */
  credentialExpressions: number;
  findings: Finding[];
}

/**
 * Findings for one workflow's source.
 *
 * Line-based comment stripping rather than a YAML parse, for two reasons. The property is
 * about EXPRESSION TEXT, which survives no YAML abstraction — `yaml` hands back the string
 * either way and the comment is gone before you can ask which line it came from. And the
 * check must run on a file that does not parse, because a malformed workflow is exactly
 * when someone is mid-edit on a credential.
 */
export function auditWorkflow(relPath: string, src: string): { findings: Finding[]; credentialExpressions: number } {
  const rawLines = src.split("\n");
  // Blank out comment lines while PRESERVING line count, so reported line numbers are real.
  const scannable = rawLines.map((l) => (YAML_COMMENT.test(l) ? "" : l)).join("\n");

  const findings: Finding[] = [];
  let credentialExpressions = 0;

  EXPRESSION.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXPRESSION.exec(scannable)) !== null) {
    const body = m[1] ?? "";
    const secrets: string[] = [];
    SECRET_REF.lastIndex = 0;
    let s: RegExpExecArray | null;
    while ((s = SECRET_REF.exec(body)) !== null) secrets.push(s[1] ?? "");
    if (secrets.length === 0) continue;
    credentialExpressions++;
    if (secrets.length < 2) continue;
    const line = scannable.slice(0, m.index).split("\n").length;
    findings.push({
      file: relPath,
      line,
      secrets,
      expression: m[0].replace(/\s+/g, " ").trim(),
    });
  }
  return { findings, credentialExpressions };
}

export function runAudit(): AuditResult {
  const root = repoRoot();
  const dir = resolve(root, WORKFLOW_DIR);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();

  const findings: Finding[] = [];
  let credentialExpressions = 0;
  for (const f of files) {
    const abs = join(dir, f);
    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const r = auditWorkflow(relative(root, abs), src);
    credentialExpressions += r.credentialExpressions;
    findings.push(...r.findings);
  }
  return { workflowsScanned: files.length, credentialExpressions, findings };
}

export function renderHuman(r: AuditResult): string {
  const head = `${r.workflowsScanned} workflow(s), ${r.credentialExpressions} credential expression(s)`;
  if (r.findings.length === 0) {
    return `workflow-credential-role-separation: OK — ${head}; every credential expression names exactly one secret.`;
  }
  const byFile = new Map<string, number>();
  for (const f of r.findings) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
  return [
    `workflow-credential-role-separation: ROLE COLLAPSE — ${r.findings.length} expression(s) in`,
    `${byFile.size} file(s) chain two or more secrets. (${head})`,
    "",
    "`||` selects on the left secret being EMPTY, so an absent scoped credential is silently",
    "replaced by one with DIFFERENT authority and the step fails downstream naming the wrong",
    "subject. A `secrets.GITHUB_TOKEN` rung is worse still: GitHub's recursion guard means the",
    "degraded lane also stops producing the events downstream jobs wait on.",
    "",
    "FIX: name the ONE secret for the role the step actually exercises —",
    "  branch-push  (a `git push` / persisted checkout credential) -> ZETA_TELEMETRY_FLUSH_TOKEN",
    "  PR-create    (`gh pr create` / `gh pr merge --auto`)        -> ZETA_PR_ARCHIVE_TOKEN",
    "  dispatch     (`gh workflow run` / workflow_dispatch)        -> ZETA_SOCIETY_DISPATCH_TOKEN",
    "  read-only    (reads a rollup, a PR, a commit)               -> GITHUB_TOKEN",
    "and make absence a LOUD, NAMED refusal in the step's `run:` block. A deliberate,",
    "explicitly-logged degradation in shell is fine — the silent one in an expression is not.",
    "Role table: docs/security/2026-08-17-society-heartbeat-token-boundary-and-gate-start-failure.md",
    "",
    ...r.findings.map((f) => `  ${f.file}:${f.line}  [${f.secrets.join(" || ")}]\n    ${f.expression}`),
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
