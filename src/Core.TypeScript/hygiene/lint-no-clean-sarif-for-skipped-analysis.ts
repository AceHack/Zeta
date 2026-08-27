// src/Core.TypeScript/hygiene/lint-no-clean-sarif-for-skipped-analysis.ts
//
// AN ANALYSIS THAT DID NOT RUN MUST NOT BE REPORTED AS AN ANALYSIS THAT FOUND
// NOTHING.
//
// This is exit-2-means-never-ran versus exit-1-means-failed, pointed at the
// security surface. It is worse there than elsewhere, because the vacuous
// result is not merely absent -- it is a POSITIVE signal of safety. A missing
// check leaves an alert open. A check that reports "clean" without running
// CLOSES the alert, and the closed alert is then indistinguishable from a
// fixed defect.
//
// THE MEASURED INSTANCE THIS FILE EXISTS FOR (2026-08-27).
// `.github/workflows/codeql.yml` synthesised a minimal SARIF with
// `"results": []` and uploaded it under the REAL analysis categories
// (`/language:javascript-typescript` and four siblings) on every event,
// including `push`. GitHub recorded it as a successful analysis finding
// nothing:
//
//     analysis 1679102987 - 2026-08-27T02:56:34Z
//       analysis_key .github/workflows/codeql.yml:path-gate
//       category     /language:javascript-typescript
//       results_count 0    error ""    tool.version 0.0.0
//
// and marked 102 open alerts across 14 rules `fixed` at that same instant,
// none dismissed. The commit it attributed the fix to changed two lines of one
// JSON data file. `js/http-to-file-access` #267
// (`src/Core.TypeScript/peer-call/summon.ts:369`) and #772
// (`src/Core.TypeScript/observe/tick-reasoning.ts:59`) were closed with their
// dataflows still present in the source.
//
// WHY THE UPLOAD WAS NOT ITSELF THE MISTAKE, WHICH IS WHY THIS LINT ALLOWS TWO
// REMEDIES RATHER THAN BANNING THE PLACEHOLDER. The synthetic SARIF solved a
// real problem: a docs-only change should not have to run a full analysis, and
// a required check must report SOMETHING. What was wrong was not that a
// placeholder was uploaded -- it was that the placeholder claimed to be clean.
//
// In `codeql.yml` the placeholder was removed outright rather than repaired,
// because there it turned out to be load-bearing for nothing: the only
// required status check in this repository is `gate (required)`, and no active
// ruleset carries a `code_scanning` rule (both pinned in
// `hygiene/github-settings.expected.json`). That is a fact about THIS repo's
// settings on 2026-08-27, not a general truth, so the remedies stay available
// for the next workflow that genuinely needs a placeholder.
//
// GITHUB ALREADY DRAWS THE DISTINCTION, and the same run proves it. The
// cancelled `Analyze (javascript-typescript)` leg ALSO uploaded a zero-result
// SARIF for the same category seconds later (analysis 1679104588) and it
// changed no alert, because codeql-action marks a run that did not complete
// `executionSuccessful: false` and GitHub recorded it as
// `error: "unsuccessful execution, exit code: 0"`. So the format has a way to
// say "did not run"; the synthetic SARIF simply did not use it.
//
// THE RULE THIS ENFORCES, stated as the property rather than as the instance:
//
//     A JOB THAT NEVER RUNS AN ANALYSER MAY NOT UPLOAD A RESULT THAT LOOKS
//     LIKE A COMPLETED ANALYSIS.
//
// So a step that uploads a SARIF the workflow itself synthesised with an empty
// `results` array must satisfy at least one of:
//
//   1. the synthesised SARIF marks `"executionSuccessful": false`, so GitHub
//      records a run that did not complete rather than a clean scan; or
//   2. the job actually runs the analyser (`codeql-action/init` or
//      `codeql-action/analyze` appears among its steps), so the empty result
//      is that job's own considered verdict about its own category.
//
// Anything else is a clean-looking analysis, and there is no event on which
// that is harmless.
//
// AN EVENT GATE IS NOT A REMEDY, and this file's first version wrongly said it
// was. That version allowed "gated off push and schedule", reasoning that a
// `pull_request` analysis lands on `refs/pull/N/merge` and is discarded with
// the ref. The first half is true; the conclusion is false, and it was
// falsified live on PR #15636 the same day:
//
//     04:05:02  path-gate  js-ts  results_count 0
//               -> alert #803 fixed, and its advanced-security review thread
//                  AUTO-RESOLVED
//     04:09:57  analyze    js-ts  results_count 1
//               -> alert #803 reopened, thread unresolved
//
// A PR-ref alert is not scratch: closing it auto-resolves the
// `github-advanced-security[bot]` review thread -- confirmed directly, the
// thread's `resolvedBy` is that bot, so no human is in the loop -- and
// `required_conversation_resolution` is TRUE on this repository. Inside that
// window the PR's last blocker is gone, and auto-merge is standard here. The
// `main` case leaves a wrong record until the next analysis; this one can let
// a change through irreversibly, which is strictly worse. So the ephemeral ref
// is the MORE dangerous surface, not the safe one, and the remedy set no
// longer contains anything event-shaped.
//
// WHY (2) IS A REMEDY AND NOT A HOLE, and what it deliberately does not cover.
// `codeql.yml`'s `analyze` job also emits an empty SARIF -- its "no-source
// baseline", for a matrix language with no first-party files at this commit.
// That claim is substantively different from the path-gate one: it is made by
// the job that OWNS that category's analysis, about its own language, and it
// is gated on a measurement (a `git ls-files` count) that can come out either
// way. If a language genuinely has no source then zero alerts is the correct
// state and closing them is right. This lint therefore clears it -- and states
// the residual rather than papering it over: it does NOT check that the
// measurement is correct. A `has_source` detector that regresses, through a
// rename or a moved directory, would close that language's alerts, and only a
// test of the detector catches that. A rule strict enough to forbid it would
// also forbid the honest case, so the gap is named instead of closed here.
//
// NON-VACUITY. This lint is itself an enumerating check, which is the shape
// that goes blind: rename the emit step, reformat the heredoc, switch upload
// actions, and it would report "0 violations" over a corpus of zero. So it
// carries a floor on its own recognizers -- if it finds no synthesised-empty
// SARIF and no SARIF upload anywhere in `.github/workflows/`, it exits 4
// NAMING the recognizer that went dark instead of passing.
//
// DST: pure function of the tracked workflow files. No clock, no network, no
// randomness. Output is ordinal-sorted throughout.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/lint-no-clean-sarif-for-skipped-analysis.ts
//   bun src/Core.TypeScript/hygiene/lint-no-clean-sarif-for-skipped-analysis.ts --json
//
// Exit codes:
//   0  no synthesised-clean SARIF can reach a ref anything depends on
//   1  usage error
//   3  violation -- a synthesised clean SARIF is uploaded by a non-analyser job
//   4  recognizer dark -- the corpus is empty, so a pass would be vacuous

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

/** One step that synthesises a SARIF whose `results` array is empty. */
export interface EmitSite {
  readonly workflow: string;
  readonly job: string;
  readonly step: string;
  /** Heredoc targets written by the step, `${...}` collapsed to `*`. */
  readonly writes: readonly string[];
  /** Whether the synthesised SARIF says the run did not complete. */
  readonly declaresUnsuccessful: boolean;
  /** Whether the emitting job runs an analyser at all (remedy 2). */
  readonly jobRunsAnalyser: boolean;
  /** Effective `if:` for the step (job condition && step condition). */
  readonly condition: string;
}

/** One step that uploads a SARIF file to code scanning. */
export interface UploadSite {
  readonly workflow: string;
  readonly job: string;
  readonly step: string;
  readonly sarifFile: string;
  readonly condition: string;
}

/** A synthesised-clean SARIF a non-analyser job can still upload. */
export interface Finding {
  readonly workflow: string;
  readonly job: string;
  readonly step: string;
  readonly sarifFile: string;
  readonly emittedBy: string;
  readonly why: string;
}

export interface Report {
  readonly workflowsScanned: number;
  readonly emitSites: readonly EmitSite[];
  readonly uploadSites: readonly UploadSite[];
  readonly findings: readonly Finding[];
  /** Recognizers that matched nothing at all; a pass would be vacuous. */
  readonly darkRecognizers: readonly string[];
}

/**
 * A SARIF run with an empty `results` array, in the formatting a shell
 * heredoc produces. Deliberately tolerant of whitespace and of the array
 * being written on one line or several.
 */
const EMPTY_RESULTS = /"results"\s*:\s*\[\s*\]/;

/** The documented "this run did not complete" marker (SARIF invocations). */
const DECLARES_UNSUCCESSFUL = /"executionSuccessful"\s*:\s*false/;

/**
 * `cat > "path" <<X` / `cat >"path"` / `cat > path <<X` heredoc targets.
 *
 * Applied to the script AFTER `normalizePath`, never before. A raw script
 * contains `${{ matrix.language }}` -- which has SPACES -- so matching this
 * against the raw text truncates the target at the first space and yields
 * `sarif/no-source-${{`. That is not a cosmetic bug: the truncated path
 * matches no upload's `sarif_file`, the pair goes unlinked, and the lint
 * reports zero violations over a site it simply failed to see. Measured on
 * this file's first run, which is why the order is pinned by a test.
 */
const HEREDOC_TARGET = /\bcat\s+>\s*"?([^"\s<>]+)"?/g;

/** Any pinned or floating reference to a SARIF-uploading action. */
const UPLOAD_SARIF_ACTION = "codeql-action/upload-sarif";

/** A step that actually runs the analyser, making the job an analysis owner. */
const ANALYSER_ACTION = /codeql-action\/(init|analyze)/;

/**
 * Every ref a code-scanning analysis can be written against has a consumer
 * that a false "clean" damages, so this list is exhaustive by construction
 * rather than by enumeration:
 *
 *   `refs/heads/main`         - the durable security record
 *   `refs/pull/N/merge`       - the advanced-security review threads that
 *                               `required_conversation_resolution` gates on
 *   `gh-readonly-queue/*`     - the same, inside the merge queue
 *
 * Kept as a named export because the failure it records is worth keeping
 * legible: the first version of this lint treated only the first row as
 * durable and accepted an event gate as a remedy. See the header.
 */
export const REFS_A_FALSE_CLEAN_DAMAGES = [
  "refs/heads/<default>",
  "refs/pull/N/merge",
  "refs/heads/gh-readonly-queue/*",
] as const;

/** Collapse `${VAR}` and `${{ expr }}` to `*` so a written path is matchable. */
export function normalizePath(p: string): string {
  return p.replace(/\$\{\{[^}]*\}\}/g, "*").replace(/\$\{[^}]*\}/g, "*");
}

/** Does a written-path pattern (with `*` holes) cover a concrete path? */
export function pathMatches(pattern: string, concrete: string): boolean {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${escaped}$`).test(normalizePath(concrete));
}

/** Join a job-level and step-level `if:` into one effective condition. */
function effectiveCondition(jobIf: unknown, stepIf: unknown): string {
  return [jobIf, stepIf].filter((c): c is string => typeof c === "string" && c.length > 0).join(" && ");
}

/**
 * Narrowing helpers. A workflow file is arbitrary YAML, so every read below
 * goes through one of these rather than through a cast: an `as` on parsed YAML
 * asserts a shape nobody checked, and this file's whole subject is a claim
 * asserted without a check.
 */
function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asArray(v: unknown): readonly unknown[] {
  return Array.isArray(v) ? (v as readonly unknown[]) : [];
}

/** Every `${{ }}`-normalised heredoc target a synthesising script writes. */
function heredocTargets(script: string): string[] {
  // Normalize BEFORE matching: `${{ matrix.language }}` has spaces.
  const writes: string[] = [];
  for (const m of normalizePath(script).matchAll(HEREDOC_TARGET)) {
    const target = m[1];
    if (target !== undefined) writes.push(target);
  }
  return writes.toSorted();
}

/** Collect the emit and upload sites of one job. */
function collectJobSites(
  workflow: string,
  jobName: string,
  job: Record<string, unknown>,
): { emitSites: EmitSite[]; uploadSites: UploadSite[] } {
  const emitSites: EmitSite[] = [];
  const uploadSites: UploadSite[] = [];

  const steps = asArray(job.steps)
    .map(asRecord)
    .filter((s): s is Record<string, unknown> => s !== undefined);

  // Does this job own an analysis at all? A job with no analyser step can
  // never have anything to report, so a clean result from it is vacuous by
  // construction -- remedy (3) in the header.
  const jobRunsAnalyser = steps.some((s) => {
    const uses = asString(s.uses);
    return uses !== undefined && ANALYSER_ACTION.test(uses);
  });

  for (const step of steps) {
    const stepName = asString(step.name) ?? "(unnamed)";
    const condition = effectiveCondition(job.if, step.if);

    const script = asString(step.run);
    if (script !== undefined && EMPTY_RESULTS.test(script)) {
      emitSites.push({
        workflow,
        job: jobName,
        step: stepName,
        writes: heredocTargets(script),
        declaresUnsuccessful: DECLARES_UNSUCCESSFUL.test(script),
        jobRunsAnalyser,
        condition,
      });
    }

    const uses = asString(step.uses);
    if (uses?.includes(UPLOAD_SARIF_ACTION) === true) {
      uploadSites.push({
        workflow,
        job: jobName,
        step: stepName,
        sarifFile: asString(asRecord(step.with)?.sarif_file) ?? "",
        condition,
      });
    }
  }

  return { emitSites, uploadSites };
}

/**
 * Link each upload to the emit step that produced its file, and report the
 * pairs no remedy clears. Separate from `auditWorkflow` so the linking rule
 * can be read on its own -- it is where the whole verdict is decided.
 */
function pairSites(workflow: string, emitSites: readonly EmitSite[], uploadSites: readonly UploadSite[]): Finding[] {
  const findings: Finding[] = [];
  for (const upload of uploadSites) {
    if (upload.sarifFile === "") continue;
    for (const emit of emitSites) {
      if (!emit.writes.some((w) => pathMatches(w, upload.sarifFile))) continue;
      if (emit.declaresUnsuccessful) continue;
      if (emit.jobRunsAnalyser) continue;

      // No third escape. There is deliberately no `if (gated) continue;` here:
      // an event gate was the first version's second remedy and PR #15636
      // falsified it -- see the header. Every event this workflow can run on
      // writes a ref whose alerts something depends on.
      findings.push({
        workflow,
        job: upload.job,
        step: upload.step,
        sarifFile: upload.sarifFile,
        emittedBy: `${emit.job} / ${emit.step}`,
        why:
          "synthesised SARIF has an empty `results` array, does not declare " +
          "`executionSuccessful: false`, and comes from a job that runs no " +
          "analyser -- so GitHub records it as a clean analysis, marks every " +
          "open alert in its category fixed, and auto-resolves their " +
          "advanced-security review threads",
      });
    }
  }
  return findings;
}

/** Audit one workflow's text. Pure: no disk, no clock. */
export function auditWorkflow(
  text: string,
  workflow: string,
): {
  emitSites: EmitSite[];
  uploadSites: UploadSite[];
  findings: Finding[];
} {
  const emitSites: EmitSite[] = [];
  const uploadSites: UploadSite[] = [];
  const findings: Finding[] = [];

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch {
    // A workflow we cannot parse is not a workflow we can clear. It
    // contributes nothing to the corpus, so the recognizer floor -- not a
    // silent pass -- is what notices if parsing stops working everywhere.
    return { emitSites, uploadSites, findings };
  }
  const doc = asRecord(parsed);
  if (doc === undefined) return { emitSites, uploadSites, findings };

  const jobs = asRecord(doc.jobs) ?? {};
  for (const jobName of Object.keys(jobs).toSorted()) {
    const job = asRecord(jobs[jobName]);
    if (job === undefined) continue;
    const sites = collectJobSites(workflow, jobName, job);
    emitSites.push(...sites.emitSites);
    uploadSites.push(...sites.uploadSites);
  }

  // No trigger-scope escape either. The first version returned early when the
  // workflow had no `push`/`schedule` trigger; a pull_request-only workflow is
  // exactly the surface PR #15636 was damaged on.
  findings.push(...pairSites(workflow, emitSites, uploadSites));
  return { emitSites, uploadSites, findings };
}

/** Read `.github/workflows/*.yml` under `root` and audit every file. */
export function runAudit(root: string): Report {
  const dir = join(root, ".github", "workflows");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .toSorted();

  const emitSites: EmitSite[] = [];
  const uploadSites: UploadSite[] = [];
  const findings: Finding[] = [];

  for (const file of files) {
    const out = auditWorkflow(readFileSync(join(dir, file), "utf8"), file);
    emitSites.push(...out.emitSites);
    uploadSites.push(...out.uploadSites);
    findings.push(...out.findings);
  }

  const darkRecognizers: string[] = [];
  if (emitSites.length === 0) darkRecognizers.push("synthesised-empty-sarif");
  if (uploadSites.length === 0) darkRecognizers.push("upload-sarif-step");

  return {
    workflowsScanned: files.length,
    emitSites,
    uploadSites,
    // Ordinal ordering, not locale collation: the report is compared across
    // machines and must not depend on the runner's locale.
    findings: findings.toSorted((a, b) => {
      const ka = `${a.workflow} ${a.job} ${a.step}`;
      const kb = `${b.workflow} ${b.job} ${b.step}`;
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return 0;
    }),
    darkRecognizers: darkRecognizers.toSorted(),
  };
}

export function renderReport(report: Report): string {
  const lines = [
    `workflows scanned:        ${String(report.workflowsScanned)}`,
    `synthesised-empty SARIFs: ${String(report.emitSites.length)}`,
    `SARIF upload steps:       ${String(report.uploadSites.length)}`,
    `findings:                 ${String(report.findings.length)}`,
  ];
  for (const f of report.findings) {
    lines.push(
      "",
      `  ${f.workflow} :: ${f.job} :: ${f.step}`,
      `    uploads ${f.sarifFile}`,
      `    emitted by ${f.emittedBy}`,
      `    ${f.why}`,
    );
  }
  return lines.join("\n");
}

export function main(argv: readonly string[]): number {
  const json = argv.includes("--json");
  const unknown = argv.filter((a) => a !== "--json");
  if (unknown.length > 0) {
    process.stderr.write(
      `usage: lint-no-clean-sarif-for-skipped-analysis.ts [--json]\n` +
        `unexpected argument(s): ${unknown.join(", ")}\n`,
    );
    return 1;
  }

  const root = resolve(import.meta.dir, "..", "..", "..");
  const report = runAudit(root);

  process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${renderReport(report)}\n`);

  if (report.darkRecognizers.length > 0) {
    process.stderr.write(
      `\nRECOGNIZER DARK: ${report.darkRecognizers.join(", ")} matched nothing.\n` +
        "A pass over an empty corpus is the failure this lint exists to catch,\n" +
        "so it is reported as one. Fix the recognizer, never the floor.\n",
    );
    return 4;
  }

  if (report.findings.length > 0) {
    process.stderr.write(
      "\nA SKIPPED ANALYSIS IS BEING REPORTED AS A CLEAN ANALYSIS.\n" +
        "GitHub reads a zero-result SARIF as 'this category was analysed and is\n" +
        "clean', and marks every open alert in that category fixed -- with the\n" +
        "defect still in the source. Either declare `executionSuccessful: false`\n" +
        "in the synthesised SARIF, or gate the upload off push and schedule so it\n" +
        "cannot reach a ref whose alerts persist.\n",
    );
    return 3;
  }

  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
