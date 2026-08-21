#!/usr/bin/env bun
// included-proof-summary.ts -- make the included Synced+Healthy proof say what it found.
//
// THE DEFECT THIS CLOSES. `live kind included Synced+Healthy proof` is the deepest
// end-to-end evidence this repo has that the cluster actually comes up: it asserts every
// non-excluded dev ArgoCD Application reaches Synced+Healthy on a real kind cluster. It
// carried `continue-on-error: true` from 2026-06-20 (#8789, "live kind job advisory until
// stable") until 2026-08-21. MEASURED over the 195 job runs from 2026-06-21 to 2026-08-21:
// the job reached a decisive conclusion 157 times and FAILED 53 of them -- and 52 of those
// 53 failures were reported at run level as `success`. The whole 2026-08-16..2026-08-21
// window (44 consecutive failures, 18 of them on `main`) was one real defect -- `cdi` and
// `kubevirt` asserted under the auto-sync contract when both are declared manual-sync --
// which the job caught correctly on the first run and which nobody saw for four and a half
// days, because every surface that aggregates runs said green.
//
// So the job was never the problem. The REPORTING was: a check that ran and failed looked
// exactly like a check that passed. Removing the flag makes the run conclusion honest;
// this script makes the reason legible without opening an 11,000-line log.
//
// WHAT IT DOES NOT DO. It does not block anything. `gate (required)` is the only required
// status check on this repository, and this job is not in its floor -- so an honest red
// run here is a signal a human or agent can see, not a merge veto. Promoting it to a
// required check is a policy call for the maintainer, not a cleanup, and is deliberately
// left alone.
//
// Usage (CI):
//   bun src/Core.TypeScript/cluster/included-proof-summary.ts --log "$RUNNER_TEMP/included-proof.log"
// Usage (local, against a captured run):
//   bun src/Core.TypeScript/cluster/included-proof-summary.ts --log /tmp/proof.log
//
// Exit 0 always: this is an observability layer. The verdict stays with the harness step,
// whose exit code is what turns the job red.

import { appendFileSync, readFileSync } from "node:fs";

/** One asserted Application as `argocd-health-test.ts --scope included` reports it. */
export interface ProofApplication {
  readonly name: string;
  readonly ok: boolean;
  readonly syncStatus?: string;
  readonly healthStatus?: string;
  readonly reason?: string;
}

/** The trailing JSON report the harness prints on stdout. */
export interface ProofReport {
  readonly ok: boolean;
  readonly applications?: readonly ProofApplication[];
  readonly failure?: {
    readonly kind?: string;
    readonly message?: string;
    readonly detail?: readonly ProofApplication[];
  };
}

/** What a caller should write out: GitHub markdown plus workflow-command annotations. */
export interface RenderedSummary {
  readonly markdown: string;
  readonly annotations: readonly string[];
}

/**
 * Pull the harness's report out of a captured stdout log.
 *
 * The harness pretty-prints one JSON object as the tail of stdout, after an unknown
 * amount of progress text. Rather than assume the object starts at a fixed offset, this
 * scans every line that begins a brace at column 0, newest first, and returns the first
 * one that both parses and carries a boolean `ok`. Brace counting respects string
 * literals and escapes, so a `{` inside a message never truncates the scan.
 *
 * Returns `null` when no such object exists. `null` is a REPORTED state, never a silent
 * pass -- see `renderSummary`.
 */
export function extractTrailingReport(text: string): ProofReport | null {
  const starts: number[] = [];
  if (text.startsWith("{")) starts.push(0);
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n" && text[i + 1] === "{") starts.push(i + 1);
  }

  for (let s = starts.length - 1; s >= 0; s -= 1) {
    const start = starts[s];
    if (start === undefined) continue;
    const end = scanBalanced(text, start);
    if (end < 0) continue;
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end));
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as { ok?: unknown }).ok === "boolean"
      ) {
        return parsed as ProofReport;
      }
    } catch {
      // Not a complete object at this offset; keep walking backwards.
    }
  }
  return null;
}

/**
 * Index just past the closing quote of the JSON string literal opening at `from`,
 * or `text.length` if it never closes. Backslash escapes consume the next character,
 * so an escaped quote does not end the literal.
 */
function endOfString(text: string, from: number): number {
  let i = from + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === '"') return i + 1;
    i += 1;
  }
  return text.length;
}

/**
 * Index just past the `}` closing the object opened at `from`, or -1 if unbalanced.
 *
 * String literals are SKIPPED WHOLE rather than counted, because ArgoCD messages
 * routinely carry braces -- an unbalanced one in a message would otherwise make the
 * counter run off the end and report "no verdict" for a run that produced one.
 */
function scanBalanced(text: string, from: number): number {
  let depth = 0;
  let i = from;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      i = endOfString(text, i);
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return -1;
}

/**
 * Render the report as a job summary plus annotations.
 *
 * Three outcomes, and each one says which it is:
 *   - report present and green -- one line naming how many Applications were asserted;
 *   - report present and red   -- a table of the Applications that missed, one `::error::`
 *                                annotation each, so the reason is on the run's annotation
 *                                list and in the checks UI without opening the log;
 *   - report absent            -- an explicit UNREADABLE notice. The harness died before
 *                                printing its verdict (timeout, crash, runner loss), which
 *                                is a real outcome and must not render as either green or
 *                                a specific failure.
 */
export function renderSummary(report: ProofReport | null): RenderedSummary {
  const heading = "## live kind included Synced+Healthy proof\n\n";

  if (report === null) {
    return {
      markdown: `${heading}**UNREADABLE** -- the harness printed no verdict JSON. It exited before reporting (timeout, crash, or lost runner); the step log is the only record.\n`,
      annotations: [
        annotation(
          "included proof produced no verdict",
          "argocd-health-test.ts printed no report JSON -- it exited before reporting. Read the step log.",
        ),
      ],
    };
  }

  const apps = report.applications ?? [];
  if (report.ok) {
    return {
      markdown:
        `${heading}**PASS** -- ${String(apps.length)} asserted dev ArgoCD Application${apps.length === 1 ? "" : "s"} reached their required state on a live kind cluster.\n`,
      annotations: [],
    };
  }

  // Prefer the harness's own failure detail; fall back to the per-app rows.
  const detail = report.failure?.detail ?? [];
  const failed = detail.length > 0 ? detail : apps.filter((a) => !a.ok);

  const message = report.failure?.message ?? "the included proof failed";
  const kind = report.failure?.kind ?? "Failure";

  let markdown = `${heading}**FAIL (${kind})** -- ${message}\n\n`;
  if (failed.length > 0) {
    markdown += "| Application | sync | health | reason |\n| --- | --- | --- | --- |\n";
    for (const a of failed) {
      markdown += `| \`${a.name}\` | ${a.syncStatus ?? "-"} | ${a.healthStatus ?? "-"} | ${a.reason ?? "-"} |\n`;
    }
  } else {
    markdown += "_The harness reported a failure with no per-Application detail._\n";
  }
  // The harness omits `applications` entirely when it fails, so a total is only printed
  // when one was actually reported. Printing "0 asserted" from an absent field would be a
  // fabricated measurement -- the same silent-wrongness this script exists to remove.
  if (apps.length > 0) {
    markdown += `\n${String(apps.length)} Application${apps.length === 1 ? " was" : "s were"} asserted in total.\n`;
  }

  const annotations = failed.length > 0
    ? failed.map((a) =>
      annotation(
        `included proof: ${a.name}`,
        `${a.name} is ${a.syncStatus ?? "?"}/${a.healthStatus ?? "?"} -- ${a.reason ?? message}`,
      )
    )
    : [annotation("included proof failed", message)];

  return { markdown, annotations };
}

/** A GitHub `::error::` workflow command. Newlines must be encoded or the command truncates. */
function annotation(title: string, message: string): string {
  const encode = (s: string) =>
    s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  return `::error title=${encode(title)}::${encode(message)}`;
}

function main(argv: readonly string[]): number {
  const at = argv.indexOf("--log");
  if (at < 0 || at + 1 >= argv.length) {
    process.stderr.write(
      "usage: bun src/Core.TypeScript/cluster/included-proof-summary.ts --log <captured-stdout>\n",
    );
    return 0;
  }

  const logPath = argv[at + 1] ?? "";
  let text = "";
  try {
    text = readFileSync(logPath, "utf8");
  } catch (err) {
    // A missing capture file is itself the UNREADABLE case, and must say so.
    process.stderr.write(`included-proof-summary: cannot read log: ${String(err)}\n`);
  }

  const { markdown, annotations } = renderSummary(
    text === "" ? null : extractTrailingReport(text),
  );

  for (const a of annotations) process.stdout.write(`${a}\n`);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath !== undefined && summaryPath !== "") {
    appendFileSync(summaryPath, markdown, "utf8");
  } else {
    process.stdout.write(markdown);
  }
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
