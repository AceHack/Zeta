#!/usr/bin/env bun
/**
 * audit-workflow-cli-flags — close the "workflow passes a flag the tool rejects" vacuity class.
 *
 * WHY THIS EXISTS (081M005VXY6087G0R001T04ATY)
 * -------------------------------------------------------------------------
 * `.github/workflows/agent-heartbeat.yml` invoked
 *   `bun src/Core.TypeScript/forge-host/github/archive-pr-reviews.ts ... --batch 3 ...`
 * for months. `--batch` is not a flag that tool accepts: its parser writes
 * `unknown arg: --batch` and calls `process.exit(1)`. The archive step therefore
 * did NO WORK on every single tick, while reporting success — the exit code was
 * swallowed by a `| tail -10` pipeline whose status is `tail`'s (0), which also
 * made the trailing `|| echo "::warning::..."` unreachable.
 *
 * That is a check that cannot fail. This lint makes the whole CLASS fail instead
 * of just the one instance: any workflow that passes a literal flag to a tool
 * whose parser REJECTS unknown flags is a guaranteed-fatal invocation, and it is
 * detectable statically by reading both sides.
 *
 * SCOPE DISCIPLINE — why only "closed flag set" tools
 * -------------------------------------------------------------------------
 * We only enforce against tools whose arg parser demonstrably rejects unknown
 * flags (it contains an `unknown arg` diagnostic IN CODE — comments stripped,
 * see `hasClosedFlagSet`). For those tools, and only those, "workflow passes a
 * flag not in the accepted set" implies "this invocation dies at argument
 * parsing, always". Tools that silently ignore unrecognised flags cannot be
 * judged this way without false positives, so they are skipped and reported as
 * skipped rather than guessed at.
 *
 * BOTH SIDES ARE READ WITH COMMENTS STRIPPED, and that symmetry is the point.
 * The tool side goes through `stripComments`; the workflow side goes through
 * `stripWorkflowComments`. Either half reading raw text reintroduces the same
 * vacuity in a different costume — a guard that exists only in prose on one
 * side, an invocation that exists only in prose on the other.
 *
 * Note this file is its own worked example: every `unknown arg` above is inside
 * a comment, and `main` accepts no flags at all, so the fixed heuristic
 * correctly reports it as NOT having a closed flag set.
 *
 * This is deliberately a STATIC check: it reads the parser's accepted-flag set
 * out of the source and the passed-flag set out of the workflow YAML. No network,
 * no `gh`, no execution — so it is safe to run in `bun test src/Core.TypeScript/hygiene/`.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export interface FlagViolation {
  workflow: string;
  tool: string;
  flag: string;
  accepted: string[];
}

export interface AuditResult {
  violations: FlagViolation[];
  toolsChecked: string[];
  toolsSkippedOpenParser: string[];
  invocationsScanned: number;
}

/**
 * Strip comments so a flag merely *discussed* in prose is not counted as accepted.
 *
 * ORDER IS LOAD-BEARING: line comments must go FIRST. A draft of this function
 * stripped block comments first and silently ate 6915 of the 14877 bytes of
 * `audit-rule-cross-refs.ts`, because that file contains the line comment
 *     // ... stale-pointer candidates in `.claude/rules/*.md`
 * whose `/*` opened a phantom block comment that ran to the next `*` + `/`.
 * The `"--report"` literal fell inside the eaten region, so the lint reported an
 * accepted flag as a violation. Removing line comments first makes that `/*`
 * disappear before the block-comment pass can see it.
 */
export function stripComments(source: string): string {
  return source.replace(/(^|[^:])\/\/[^\n]*/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * Extract the set of long flags an arg parser accepts.
 *
 * DELIBERATELY PERMISSIVE, and here is the reason. An earlier draft of this lint
 * matched only the syntactic shapes `arg === "--flag"`, `arg.startsWith("--flag=")`
 * and `case "--flag":`. That draft reported three violations against
 * `k8s-argocd-health-test.yml` (`--dry-run`, `--run`) which were FALSE POSITIVES:
 * `argocd-health-test.ts` accepts those through a lookup table
 * (`const MODE_FLAGS = { "--dry-run": ..., "--run": ... }`) and through
 * `new Set(["--git-ref", ...])`, neither of which the shape-matcher could see.
 *
 * A lint that cries wolf gets deleted, and a deleted lint is worth less than no
 * lint. So the accepted set is now "every `--flag` string literal in the source,
 * comments stripped" — table keys, Set members, comparisons and help text all
 * count. This can only ever OVER-accept, never under-accept, which means the
 * lint's failures are trustworthy even though its silence is not a proof of
 * correctness. That asymmetry is the right one for a guard: no false alarms,
 * and it still catches the real class (a flag the tool has simply never heard of,
 * like `--batch`, appears nowhere in the source at all).
 */
export function extractAcceptedFlags(source: string): Set<string> {
  const accepted = new Set<string>();
  const re = /["'`](--[A-Za-z0-9][A-Za-z0-9-]*)=?["'`\s]/g;
  const code = stripComments(source);
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const flag = m[1];
    if (flag !== undefined) accepted.add(flag);
  }
  return accepted;
}

/**
 * Does this parser reject unknown flags? Only then is an unaccepted flag
 * provably fatal rather than merely unused.
 *
 * READS THE SAME TEXT `extractAcceptedFlags` READS — comments stripped.
 * An earlier revision tested the RAW source, and the divergence was the bug:
 * a tool that merely *discusses* unknown arguments in prose read as having a
 * closed parser, and the audit then policed workflow invocations against a
 * parser that does not exist. A check that passes on a comment is the vacuity
 * class this whole lint exists to close.
 *
 * Caught the sharpest possible way in PR #10853: that agent removed a guard
 * from `setup-dual-background-agents.ts` to mutation-prove it, and the suite
 * stayed green — because the comment ABOVE the guard, explaining why the phrase
 * `unknown arg` matters, still contained the phrase. The explanation of the
 * guard satisfied the guard-detector.
 *
 * The guard must be in CODE, not in prose. `stripComments` is shared with
 * `extractAcceptedFlags` on purpose: two comment-strippers would be the same
 * divergence one level down.
 *
 * RESIDUAL LIMIT, STATED SO NOBODY READS THIS AS SOUND. This matches a PHRASE,
 * not a BEHAVIOUR, so a code string that merely *mentions* unknown flags still
 * enrols a tool. This very file is the proof: `main` prints
 * `"... skipped (parser tolerates unknown flags)"`, which says the opposite of
 * having a closed parser and still matches. Stripping comments removes the
 * largest and most tempting source of that error — prose written to explain a
 * guard, which is exactly what a careful author adds — it does not remove the
 * class. The mitigation stays the one the header states: enrolment can only
 * ever cause a violation to be REPORTED against a flag the source never
 * mentions, so a false enrolment is loud rather than silent.
 */
export function hasClosedFlagSet(source: string): boolean {
  return /unknown\s+(arg|argument|option|flag)/i.test(stripComments(source));
}

/**
 * Drop whole-line `#` comments from a workflow body.
 *
 * THE SAME INCONSISTENCY, OTHER DIRECTION. `extractAcceptedFlags` strips
 * comments out of the tool; nothing stripped them out of the *workflow*, so a
 * commented-out invocation was scanned as if it ran. Measured on this repo:
 * 7 of 121 scanned invocations came from `#` lines — worked examples in header
 * comments (`scaffold-stage1-create-repos.yml` lines 20-22 document three
 * `--dry-run` invocations; `agent-heartbeat.yml` line 897 names a tool in
 * prose). None produced a violation today, so this is a latent false positive:
 * the day a documented example drifts from the tool's real flag set, CI fails
 * on a line that never executes.
 *
 * Whole-line only, deliberately. A trailing `#` inside a `run:` block is a
 * shell comment, but `#` also appears inside quoted arguments and URLs, and
 * guessing where a shell comment starts without a shell parser is how a
 * stripper starts eating live code (see `stripComments`'s own scar). A line
 * whose first non-space character is `#` is a comment in both YAML and shell,
 * with no ambiguity to resolve.
 *
 * Runs BEFORE line-continuation joining: a commented-out invocation that spans
 * continued lines has `#` on each of them, and joining first would splice the
 * live remainder of a `\`-continued command onto a comment.
 */
export function stripWorkflowComments(workflowBody: string): string {
  // Blanked, not deleted: the line COUNT is preserved so a future caller can
  // still report `.github/workflows/x.yml:NNN` against the original file.
  return workflowBody
    .split("\n")
    .map((line) => (/^\s*#/.test(line) ? "" : line))
    .join("\n");
}

/**
 * Pull `bun <tool>.ts <args...>` invocations out of a workflow body.
 *
 * Whole-line `#` comments are removed first (see `stripWorkflowComments`), then
 * shell line-continuations are joined — the real-world defect spanned three
 * lines with trailing backslashes, and a commented-out example does too.
 *
 * Returns the full `args` token list as well as the `flags` subset. `args` is what
 * lets a caller replay a workflow's argv against the real parser (see
 * `archive-pr-reviews.test.ts`) instead of re-deriving it with a parallel regex —
 * one extractor, exercised by both the lint and the test.
 *
 * DELIBERATELY TEXT-ONLY, NO YAML PARSER. `pr-manifest-integrity.yml` runs the
 * forge-host tests with no `bun install` ("these tests import node builtins and
 * repo-local modules only"), and the repo is heading for zero external
 * dependencies. An earlier revision of the archive test imported `yaml` and broke
 * that job; nothing here may reach outside node builtins.
 */
export function extractInvocations(
  workflowBody: string,
): Array<{ tool: string; flags: string[]; args: string[] }> {
  const joined = stripWorkflowComments(workflowBody).replace(/\\\r?\n\s*/g, " ");
  const out: Array<{ tool: string; flags: string[]; args: string[] }> = [];
  const re = /\bbun\s+(?:run\s+)?(src\/[A-Za-z0-9_\-/.]+\.ts)([^\n]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(joined)) !== null) {
    const tool = m[1];
    const tail = m[2] ?? "";
    if (tool === undefined) continue;
    // Stop the argument list at a shell operator — everything after `|`, `||`,
    // `&&`, `;`, `>` belongs to another command, not to this invocation.
    // `2>&1` must match WITHOUT a required trailing space: a real invocation ends
    // `... --limit 3 2>&1)` inside a command substitution, and a whitespace-anchored
    // split would leave `2>&1)` sitting in the argument list.
    const argsPart = tail.split(/\s*(?:2>&1|\|\||\||&&|;|>)/)[0] ?? "";
    const args: string[] = [];
    for (const tok of argsPart.trim().split(/\s+/)) {
      if (tok.length === 0) continue;
      // Skip anything shell/GHA-interpolated; its literal value is unknowable here.
      if (tok.includes("$") || tok.includes("{{")) continue;
      args.push(tok);
    }
    const flags: string[] = [];
    for (const tok of args) {
      if (!tok.startsWith("--") || tok === "--") continue;
      const flag = tok.split("=")[0];
      if (flag !== undefined && /^--[A-Za-z0-9][A-Za-z0-9-]*$/.test(flag)) {
        flags.push(flag);
      }
    }
    out.push({ tool, flags, args });
  }
  return out;
}

export function auditWorkflowCliFlags(repoRoot: string): AuditResult {
  const workflowDir = join(repoRoot, ".github", "workflows");
  const violations: FlagViolation[] = [];
  const toolsChecked = new Set<string>();
  const toolsSkipped = new Set<string>();
  let invocationsScanned = 0;

  if (!existsSync(workflowDir)) {
    return {
      violations: [],
      toolsChecked: [],
      toolsSkippedOpenParser: [],
      invocationsScanned: 0,
    };
  }

  const sourceCache = new Map<string, string | null>();
  const readTool = (tool: string): string | null => {
    if (!sourceCache.has(tool)) {
      const abs = resolve(repoRoot, tool);
      sourceCache.set(tool, existsSync(abs) ? readFileSync(abs, "utf8") : null);
    }
    return sourceCache.get(tool) ?? null;
  };

  const files = readdirSync(workflowDir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort();

  for (const file of files) {
    const body = readFileSync(join(workflowDir, file), "utf8");
    for (const { tool, flags } of extractInvocations(body)) {
      invocationsScanned += 1;
      const source = readTool(tool);
      if (source === null) continue; // tool not in this checkout; not our call
      if (!hasClosedFlagSet(source)) {
        toolsSkipped.add(tool);
        continue;
      }
      toolsChecked.add(tool);
      const accepted = extractAcceptedFlags(source);
      for (const flag of flags) {
        if (!accepted.has(flag)) {
          violations.push({
            workflow: `.github/workflows/${file}`,
            tool,
            flag,
            accepted: [...accepted].sort(),
          });
        }
      }
    }
  }

  return {
    violations,
    toolsChecked: [...toolsChecked].sort(),
    toolsSkippedOpenParser: [...toolsSkipped].sort(),
    invocationsScanned,
  };
}

export function main(repoRoot: string): number {
  const result = auditWorkflowCliFlags(repoRoot);
  process.stdout.write(
    `[audit-workflow-cli-flags] scanned ${result.invocationsScanned} invocation(s); ` +
      `${result.toolsChecked.length} tool(s) with a closed flag set; ` +
      `${result.toolsSkippedOpenParser.length} skipped (parser tolerates unknown flags)\n`,
  );
  if (result.violations.length === 0) {
    process.stdout.write("[audit-workflow-cli-flags] OK — no rejected flags passed\n");
    return 0;
  }
  for (const v of result.violations) {
    process.stderr.write(
      `::error file=${v.workflow}::${v.workflow} passes '${v.flag}' to ${v.tool}, ` +
        `whose parser rejects unknown flags and will exit(1). ` +
        `Accepted: ${v.accepted.join(" ")}\n`,
    );
  }
  process.stderr.write(
    `[audit-workflow-cli-flags] FAIL — ${result.violations.length} guaranteed-fatal invocation(s)\n`,
  );
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.cwd()));
}
