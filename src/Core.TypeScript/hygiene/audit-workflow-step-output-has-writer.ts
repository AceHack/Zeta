#!/usr/bin/env bun
// audit-workflow-step-output-has-writer.ts — AH004: a step that CANNOT SUCCEED.
//
// (AH003 is the archive-lane record check. This is AH004.)
//
// The rule this enforces
// ----------------------
// A step that reads `${{ steps.X.outputs.Y }}` is making a claim: that some earlier step
// in the same job produces `Y`. When nothing does, the expression interpolates to the
// empty string — silently, with no warning from Actions — and the reading step runs with
// a blank value. If that step then guards on the value (`if [ -z "$PR" ]; then exit 1`),
// it fails on EVERY execution, forever, by construction.
//
// This is the vacuity class inverted. The familiar direction is a check that cannot fail
// reading as a check that passed. This is the mirror: a step that cannot pass, reporting
// a defect in the subject it is pointed at rather than in itself. Both are the same
// underlying fault — the outcome is decided by the wiring, not by the thing under test —
// and both are invisible in a green-vs-red summary, because a step that always fails
// looks exactly like a step catching a real and persistent problem.
//
// Live instance (2026-08-25): `agent-heartbeat.yml`'s "Arm heartbeat PR auto-merge" read
// `steps.flush.outputs.pr_number`. Nothing had written `pr_number` since SOVEREIGN MODE
// (2026-08-01) removed the per-lane `gh pr create` ceremony; the step was left behind
// when the design it belonged to came out. Across 12 consecutive runs it was `failure`
// for every lane with work and `skipped` for every lane without — never once `success`.
// Its error text ("snapshot produced no PR number") named the flush step, so the failure
// read as a broken flush rather than a fossil reader, and three separate agents diagnosed
// it as a token-scope fault on the auto-merge call. That call was never reached.
//
// What this does NOT flag, and why
// --------------------------------
//   * A step whose `id` belongs to a `uses:` step. Third-party and local composite
//     actions declare outputs in their own `action.yml`, which is not in this file and
//     may not be in this repo. Their outputs are opaque here, so a reference to one is
//     unverifiable — and flagging the unverifiable is how a check earns its suppressions.
//   * `needs.<job>.outputs.*`. That is job-level wiring, a genuinely different edge with
//     a different failure mode. Naming it here would widen the check past what its
//     evidence covers.
//   * A step that DELEGATES to an in-repo script which writes outputs of its own. The
//     workflow's `run:` is then only an invocation — `bun path/to/runner.ts` — and the
//     writes happen inside TypeScript, often behind a helper (`writeOutput("branch", …)`).
//     This audit follows those invocations and reads the script. If the name is written
//     there, the reference is satisfied. If the script touches `GITHUB_OUTPUT` but the
//     name cannot be found, the writer set is computed at runtime and is NOT statically
//     decidable, so the reference is counted as OPAQUE and reported in the summary rather
//     than flagged. Caught on the first run against `main`: this check's own draft flagged
//     `passkey-proposal-gated-commit.yml`, whose runner does write `branch` and
//     `proposal_id` — a false positive that would have blocked CI on a working workflow.
//
// So the check is deliberately narrow: it fires only where the writer WOULD be visible in
// the same file if it existed. Every finding is therefore decidable from the file alone.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-workflow-step-output-has-writer.ts
//   bun src/Core.TypeScript/hygiene/audit-workflow-step-output-has-writer.ts --json
//
// Exit codes:
//   0   every readable step-output reference has a writer (or is opaque)
//   1   at least one reference can never be satisfied
//   2   configuration error (workflow dir missing / unparseable)

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseDocument } from "yaml";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

const WORKFLOW_DIR = ".github/workflows";
export const DRIFT_CLASS = "AH004";

/** `${{ steps.<id>.outputs.<name> }}`, tolerant of arbitrary inner whitespace. */
const STEP_OUTPUT_REF = /steps\s*\.\s*([A-Za-z_][\w-]*)\s*\.\s*outputs\s*\.\s*([A-Za-z_][\w-]*)/g;

/**
 * Does this shell text write `name` to `$GITHUB_OUTPUT`?
 *
 * Covers the forms the repo actually uses plus the common variants: `echo`/`printf` with
 * the name inline, quoted or bare redirect target, and a heredoc whose body carries
 * `name=`. Deliberately permissive — a writer this misses becomes a FALSE POSITIVE, which
 * is the expensive direction for a check that blocks CI. A reader with no writer at all
 * matches none of these under any spelling.
 */
export function writesOutput(runText: string, name: string): boolean {
  if (!/GITHUB_OUTPUT/.test(runText)) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `name=` appearing anywhere in a block that also redirects to $GITHUB_OUTPUT. The two
  // can legitimately sit on different lines (heredoc, or a variable built then appended),
  // so requiring them on ONE line would reject writers that work.
  return new RegExp(`(^|[\\s"'{(])${escaped}\\s*=`, "m").test(runText);
}

/**
 * Script invocations inside a `run:` block, resolved repo-relative. Covers the runners
 * this repo actually uses; an interpreter this misses simply means the block is judged on
 * its inline shell alone, which is the pre-existing behaviour.
 */
const SCRIPT_INVOCATION =
  /(?:^|[\s;&|(])(?:bun|node|npx\s+tsx|tsx|deno\s+run(?:\s+[-\w=]+)*)\s+((?:\.\/)?[\w./-]+\.(?:ts|mts|cts|mjs|cjs|js))/g;

/** Does the delegated script name this output? `writeOutput("branch", …)` or `branch=`. */
function scriptNamesOutput(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`["'\`]${escaped}["'\`]|(^|[\\s"'{(])${escaped}\\s*=`, "m").test(text);
}

export type WriterVerdict = "writes" | "absent" | "opaque";

/** A shell comment. `exit 0` inside one returns from nothing. */
const SHELL_COMMENT = /^\s*#/;
/** An early success return. `exit 0` only — a nonzero exit fails the step, which is loud. */
const EARLY_SUCCESS_RETURN = /(?:^|[\s;&|(])exit\s+0(?:\s*(?:;|#|$))/;

/** Opens a shell scope. */
const SCOPE_OPEN = /(?:^|[\s;&|(])(?:if|case|for|while|until)(?![\w-])/;
/** Closes one. */
const SCOPE_CLOSE = /(?:^|[\s;])(?:fi|esac|done)(?:\s*(?:;|#|$))/;

/**
 * Lines inside `runText` where the step returns SUCCESS having written none of `names`.
 *
 * A step can satisfy `resolveWriter` — the write exists somewhere in the block — and still
 * return before reaching it. Downstream then reads the empty string from a step that
 * concluded `success`, which is the harder half of this defect to see: the producing step
 * is green, so nothing points at it.
 *
 * An `exit 0` is satisfied when EITHER an unconditional write has already run (depth 0, so
 * it executes on every path reaching here) OR the guard doing the returning wrote before
 * returning. Anything else returns success on a path that produced nothing.
 *
 * The first draft of this used a single "has anything been written above?" latch, and it
 * UNDER-REPORTED: a guard clause that writes and immediately exits would mark the latch and
 * silently exempt every later early return, including ones that write nothing. That cost a
 * real finding — `agent-heartbeat.yml`'s `RC == 4` "already on main" path — which only
 * surfaced when the scope tracking below replaced the latch. A check whose own conservatism
 * hides the second instance of the bug it was written for is the vacuity class in miniature.
 */
export function successPathsWithoutWrite(runText: string, names: readonly string[]): number[] {
  if (names.length === 0) return [];
  const lines = runText.split("\n");
  const hits: number[] = [];
  let depth = 0;
  let wroteUnconditionally = false;
  // wroteInScope[d] — has the scope currently open at depth d written, since it opened?
  const wroteInScope: boolean[] = [false];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (SHELL_COMMENT.test(line)) continue;

    if (names.some((n) => writesOutput(line, n))) {
      if (depth === 0) wroteUnconditionally = true;
      wroteInScope[depth] = true;
    }

    if (EARLY_SUCCESS_RETURN.test(line) && !wroteUnconditionally && !wroteInScope[depth]) {
      hits.push(i + 1);
    }

    // Scope bookkeeping runs AFTER the checks so a one-line `if X; then exit 0; fi` is
    // judged in the scope it actually belongs to.
    if (SCOPE_CLOSE.test(line) && depth > 0) {
      wroteInScope.pop();
      depth--;
    }
    if (SCOPE_OPEN.test(line) && !SCOPE_CLOSE.test(line)) {
      depth++;
      wroteInScope[depth] = false;
    }
  }

  // A return at the very end of the block is ordinary completion, not an early guard.
  const lastMeaningful = lines.reduce((acc, l, i) => (l.trim() === "" ? acc : i + 1), 0);
  return hits.filter((h) => h < lastMeaningful);
}

/**
 * Decide whether `name` is produced by a `run:` block, following any in-repo script it
 * invokes. Returns "opaque" when a delegated script writes outputs whose names this
 * cannot resolve statically — the honest third answer, kept distinct from "absent" so a
 * limit of the check never renders as a defect in the subject.
 */
export function resolveWriter(
  runText: string,
  name: string,
  readScript: (relPath: string) => string | null,
): WriterVerdict {
  if (writesOutput(runText, name)) return "writes";

  SCRIPT_INVOCATION.lastIndex = 0;
  let delegatesToOutputWriter = false;
  let m: RegExpExecArray | null;
  while ((m = SCRIPT_INVOCATION.exec(runText)) !== null) {
    const rel = (m[1] ?? "").replace(/^\.\//, "");
    const body = readScript(rel);
    if (body === null) continue;
    if (!/GITHUB_OUTPUT/.test(body)) continue;
    if (scriptNamesOutput(body, name)) return "writes";
    delegatesToOutputWriter = true;
  }
  return delegatesToOutputWriter ? "opaque" : "absent";
}

export interface Finding {
  file: string;
  job: string;
  readerStep: string;
  producerStep: string;
  output: string;
  reason: "no-such-step" | "step-writes-no-such-output" | "success-path-without-write";
  /** For "success-path-without-write": 1-indexed line of the early return inside `run:`. */
  runLine?: number;
}

export interface AuditResult {
  workflowsScanned: number;
  referencesChecked: number;
  /** References not statically decidable — a delegated script computes the writer set. */
  opaqueReferences: number;
  /** Workflows the audit could not read or parse. Reported, never silently dropped. */
  unreadableWorkflows: string[];
  findings: Finding[];
}

interface StepInfo {
  id: string;
  isRun: boolean;
  runText: string;
}

function stepLabel(step: unknown, index: number): string {
  if (step && typeof step === "object") {
    const rec = step as Record<string, unknown>;
    if (typeof rec["name"] === "string") return rec["name"];
    if (typeof rec["id"] === "string") return rec["id"];
    if (typeof rec["uses"] === "string") return rec["uses"];
  }
  return `step[${index}]`;
}

/**
 * Collect every text position in a step where an expression could reference an output.
 * `if`, `env`, `with`, and `run` all interpolate; scanning the step's whole serialised
 * form would also sweep up `name:` prose that merely mentions an expression, so the
 * fields are enumerated rather than flattened.
 */
function readableText(step: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of ["if", "run", "working-directory"]) {
    const v = step[key];
    if (typeof v === "string") parts.push(v);
  }
  for (const key of ["env", "with"]) {
    const v = step[key];
    if (v && typeof v === "object") {
      for (const inner of Object.values(v as Record<string, unknown>)) {
        if (typeof inner === "string") parts.push(inner);
      }
    }
  }
  return parts.join("\n");
}

export function auditWorkflow(
  relPath: string,
  src: string,
  readScript: (relPath: string) => string | null = () => null,
): { findings: Finding[]; refs: number; opaque: number } {
  const doc = parseDocument(src);
  const root = doc.toJS() as Record<string, unknown> | null;
  const findings: Finding[] = [];
  let refs = 0;
  let opaque = 0;
  if (!root || typeof root !== "object") return { findings, refs, opaque };

  const jobs = root["jobs"];
  if (!jobs || typeof jobs !== "object") return { findings, refs, opaque };

  for (const [jobName, jobRaw] of Object.entries(jobs as Record<string, unknown>)) {
    if (!jobRaw || typeof jobRaw !== "object") continue;
    const job = jobRaw as Record<string, unknown>;
    const steps = job["steps"];
    if (!Array.isArray(steps)) continue;

    // Index the job's steps by declared id. A step with no `id` can never be referenced,
    // so it contributes nothing to the writer set.
    const byId = new Map<string, StepInfo>();
    for (const s of steps) {
      if (!s || typeof s !== "object") continue;
      const rec = s as Record<string, unknown>;
      const id = rec["id"];
      if (typeof id !== "string") continue;
      const run = rec["run"];
      byId.set(id, {
        id,
        isRun: typeof run === "string" && typeof rec["uses"] !== "string",
        runText: typeof run === "string" ? run : "",
      });
    }

    // Which outputs are read from which producer — needed by the early-return class, which
    // can only be decided once every reader in the job has been seen.
    const readNames = new Map<string, Set<string>>();
    const readerOf = new Map<string, string>();

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (!s || typeof s !== "object") continue;
      const rec = s as Record<string, unknown>;
      const text = readableText(rec);
      if (!text) continue;
      STEP_OUTPUT_REF.lastIndex = 0;
      const seen = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = STEP_OUTPUT_REF.exec(text)) !== null) {
        const producerId = m[1] ?? "";
        const output = m[2] ?? "";
        const key = `${producerId}.${output}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs++;
        if (!readNames.has(producerId)) readNames.set(producerId, new Set());
        readNames.get(producerId)!.add(output);
        if (!readerOf.has(producerId)) readerOf.set(producerId, stepLabel(rec, i));
        const producer = byId.get(producerId);
        if (!producer) {
          findings.push({
            file: relPath,
            job: jobName,
            readerStep: stepLabel(rec, i),
            producerStep: producerId,
            output,
            reason: "no-such-step",
          });
          continue;
        }
        // Opaque by construction — see the header. Not a finding.
        if (!producer.isRun) {
          opaque++;
          continue;
        }
        const verdict = resolveWriter(producer.runText, output, readScript);
        if (verdict === "opaque") {
          opaque++;
          continue;
        }
        if (verdict === "absent") {
          findings.push({
            file: relPath,
            job: jobName,
            readerStep: stepLabel(rec, i),
            producerStep: producerId,
            output,
            reason: "step-writes-no-such-output",
          });
        }
      }
    }

    // Second class: a producer that DOES write its outputs, but returns success on a path
    // that reaches none of them.
    for (const [producerId, names] of readNames) {
      const producer = byId.get(producerId);
      if (!producer || !producer.isRun) continue;
      const decidable = [...names].filter(
        (n) => resolveWriter(producer.runText, n, readScript) === "writes",
      );
      if (decidable.length === 0) continue;
      for (const line of successPathsWithoutWrite(producer.runText, decidable)) {
        findings.push({
          file: relPath,
          job: jobName,
          readerStep: readerOf.get(producerId) ?? "(reader)",
          producerStep: producerId,
          output: decidable.join(","),
          reason: "success-path-without-write",
          runLine: line,
        });
      }
    }
  }
  return { findings, refs, opaque };
}

export function runAudit(): AuditResult {
  const root = repoRoot();
  const dir = resolve(root, WORKFLOW_DIR);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();

  const readScript = (rel: string): string | null => {
    try {
      return readFileSync(resolve(root, rel), "utf8");
    } catch {
      return null;
    }
  };

  const findings: Finding[] = [];
  const unreadableWorkflows: string[] = [];
  let referencesChecked = 0;
  let opaqueReferences = 0;
  for (const f of files) {
    let src: string;
    try {
      src = readFileSync(join(dir, f), "utf8");
    } catch {
      unreadableWorkflows.push(f);
      continue;
    }
    let res: { findings: Finding[]; refs: number; opaque: number };
    try {
      res = auditWorkflow(relative(root, join(dir, f)), src, readScript);
    } catch {
      // An unparseable workflow is yamllint's finding, not this audit's — but a file this
      // could not read is a file it did not check, and silence there would be the very
      // vacuity the audit exists to refuse. Recorded and reported, never dropped.
      //
      // This catch already earned its keep the wrong way once: while this file was being
      // written, a bad edit deleted `readableText`, every workflow threw a ReferenceError,
      // and the audit printed "OK — every reference has a writer" over 77 unchecked files.
      unreadableWorkflows.push(f);
      continue;
    }
    findings.push(...res.findings);
    referencesChecked += res.refs;
    opaqueReferences += res.opaque;
  }
  return {
    workflowsScanned: files.length,
    referencesChecked,
    opaqueReferences,
    unreadableWorkflows,
    findings,
  };
}

function renderHuman(r: AuditResult): string {
  const head =
    `${r.workflowsScanned} workflow(s), ${r.referencesChecked} step-output reference(s), ` +
    `${r.opaqueReferences} not statically decidable`;
  const unread =
    r.unreadableWorkflows.length === 0
      ? ""
      : `\n  NOT CHECKED (${r.unreadableWorkflows.length}): ${r.unreadableWorkflows.join(", ")}`;
  if (r.findings.length === 0) {
    return `workflow-step-output-has-writer: OK — ${head}; every reference has a writer.${unread}`;
  }
  const lines = [
    `workflow-step-output-has-writer: NO WRITER — ${r.findings.length} reference(s) that can`,
    `never be satisfied. (${head})`,
    "",
    "A `${{ steps.X.outputs.Y }}` with no writer interpolates to the empty string with no",
    "warning. A step that then guards on the value fails on every run, forever — and its",
    "error text names the PRODUCER, so the fault reads as a defect in that step rather",
    "than as a reference to something that was never produced.",
    "",
  ];
  for (const f of r.findings) {
    if (f.reason === "success-path-without-write") {
      lines.push(`  ${f.file} [${f.job}] step '${f.producerStep}'`);
      lines.push(
        `      returns success at run-block line ${String(f.runLine)} having written none of` +
          ` '${f.output}' (read by "${f.readerStep}")`,
      );
      continue;
    }
    const why =
      f.reason === "no-such-step"
        ? `no step with id '${f.producerStep}' exists in this job`
        : `step '${f.producerStep}' never writes '${f.output}' to $GITHUB_OUTPUT`;
    lines.push(`  ${f.file} [${f.job}] "${f.readerStep}"`);
    lines.push(`      reads steps.${f.producerStep}.outputs.${f.output} — ${why}`);
  }
  lines.push("");
  lines.push("FIX: write the output in the producing step, or delete the reader if the design");
  lines.push("it belonged to has been removed.");
  return lines.join("\n");
}

if (import.meta.main) {
  let result: AuditResult;
  try {
    result = runAudit();
  } catch (err) {
    console.error(`workflow-step-output-has-writer: configuration error — ${String(err)}`);
    process.exit(2);
  }
  // Zero references across a non-empty workflow dir means the scan itself did not run.
  // Reporting that as a pass is the failure this whole audit is about.
  if (result.workflowsScanned > 0 && result.referencesChecked === 0) {
    console.error(
      `workflow-step-output-has-writer: configuration error — scanned ${String(result.workflowsScanned)} ` +
        `workflow(s) and found ZERO step-output references. That is not a clean repo, it is a ` +
        `scan that did not run. Unreadable: ${result.unreadableWorkflows.length || "none"}.`,
    );
    process.exit(2);
  }
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ driftClass: DRIFT_CLASS, ...result }, null, 2));
  } else {
    console.log(renderHuman(result));
  }
  process.exit(result.findings.length === 0 ? 0 : 1);
}
