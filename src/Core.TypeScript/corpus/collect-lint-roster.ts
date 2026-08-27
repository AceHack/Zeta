/**
 * collect-lint-roster.ts — fold an injected lint-finding roster into a CorrectionLog.
 *
 * NOT A SCRAPER. Does not walk `lint-*.ts`. The naming slice forbade inventing
 * FIX strings for the 22 failure-only linters and forbade writing patches as a
 * rider. This collector takes seeds the caller already has. The five teaching
 * lints Otto named are a *fixture roster* (`TEACHING_LINT_SEEDS`), not a live
 * grep of the tree.
 *
 * Dual-use: a seed with no `fix` still enters (violation hub, no repair).
 * Absence of `lint/repair` is the measurement. This module does not emit an
 * erasure verdict.
 *
 * NO AMBIENT ANYTHING. Tick and asserter are supplied.
 */

import { type Asserter, type LabelRefusal } from "./labelled-observation.ts";
import { fromLintFinding, type LintFindingSeed } from "./from-lint-finding.ts";
import { emptyLog, observe, type CorrectionLog } from "./correction-zset.ts";

export interface CollectLintRosterInput {
  readonly findings: readonly LintFindingSeed[];
  readonly assertedBy: Asserter;
  readonly at: number;
}

export interface CollectLintRosterResult {
  readonly log: CorrectionLog;
  readonly refused: readonly { readonly finding: LintFindingSeed; readonly why: string }[];
  readonly labelRefused: readonly LabelRefusal[];
}

/**
 * The five lint modules that already teach a repair (Otto 2026-08-27 census).
 * Prose is the satellite; this is not a machine patch. Source: the twelve-factor
 * absorb table, not a live scrape.
 */
export const TEACHING_LINT_SEEDS: readonly LintFindingSeed[] = [
  {
    rule: "check-then-use-file-races",
    file: "src/Core.TypeScript/hygiene/lint-check-then-use-file-races.ts",
    signature: "existsSync(p)->readFileSync(p)",
    detail: "stat then use of the same path",
    fix: "Delete the check and perform the operation, interpreting its failure. One syscall, one answer, no window.",
  },
  {
    rule: "graphql-transport-in-scripts",
    file: "src/Core.TypeScript/hygiene/lint-graphql-transport-in-scripts.ts",
    signature: "gh pr view",
    detail: "GraphQL default in a committed loop",
    fix: "Use the REST spelling the lint already knows (gh api repos/.../pulls/N).",
  },
  {
    rule: "no-decide-by-grep",
    file: "src/Core.TypeScript/hygiene/lint-no-decide-by-grep.ts",
    signature: "grep-as-oracle",
    detail: "a grep exit code used as a decision",
    fix: "Use run-checked.ts.",
  },
  {
    rule: "no-nested-workflow-dirs",
    file: "src/Core.TypeScript/hygiene/lint-no-nested-workflow-dirs.ts",
    signature: ".github/workflows/**/nested",
    detail: "workflow file not at .github/workflows/",
    fix: "Move the file to .github/workflows/.",
  },
  {
    rule: "no-path-resolved-privilege-elevator",
    file: "src/Core.TypeScript/hygiene/lint-no-path-resolved-privilege-elevator.ts",
    signature: "path.resolve elevator",
    detail: "resolved path used as a privilege elevator",
    fix: "Use resolveElevatorPathOrThrow.",
  },
];

export function collectLintRoster(input: CollectLintRosterInput): CollectLintRosterResult {
  let log = emptyLog();
  const refused: { readonly finding: LintFindingSeed; readonly why: string }[] = [];
  const labelRefused: LabelRefusal[] = [];
  for (const finding of input.findings) {
    const result = fromLintFinding({
      finding,
      assertedBy: input.assertedBy,
      at: input.at,
    });
    if (result.row === null) {
      refused.push({ finding, why: result.why ?? "hub could not be formed" });
      continue;
    }
    log = observe(log, result.row);
    for (const r of result.refused) labelRefused.push(r);
  }
  return { log, refused, labelRefused };
}
