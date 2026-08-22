#!/usr/bin/env bun
// gate-scope-summary.ts -- make `gate (required)` say WHICH green it is.
//
// THE DEFECT THIS CLOSES. `gate (required)` rolls up the uncompensatable floor and
// treats `skipped` as success -- correct, because the path filter legitimately skips
// the .NET build/test steps and the whole 7-language `full-verify` job on a docs-only
// PR. But that makes a green `gate (required)` TWO-VALUED and publishes neither value:
// it is either the full seven-language byte-lock or a much smaller run, and to anything
// reading check status -- including armed auto-merge, which is how most things land
// here -- WALL-CLOCK DURATION IS THE ONLY THING TELLING THEM APART. That is the vacuity
// class at the rollup level: a check that did not run looks exactly like a check that
// passed. Skipping stays legitimate; what changes is that the green now carries its
// own scope.
//
// THE SECOND THING IT MAKES VISIBLE. `build-and-test` carries
// `continue-on-error: ${{ startsWith(matrix.os, 'windows-') }}`, and it IS in the floor.
// So a Windows build/test failure reaches `gate-required` as success. MEASURED
// 2026-08-19 over the 152 completed `gate` runs that carried Windows legs
// (2026-04-25..2026-08-19): windows-2025 failed 12 times, windows-11-arm 9 times, and in
// every one of the 11 instances since `gate (required)` existed the check reported
// SUCCESS alongside the red leg. This script names those legs in the summary instead of
// leaving them a fact you had to go looking for. It does NOT change what blocks --
// flipping that flag is a policy call, not a cleanup.
//
// HOW IT DERIVES THE FLOOR -- no second copy of the list. The floor is read from the
// `needs` context GitHub hands the rollup job (`toJSON(needs)`), which IS the `needs:`
// list, keyed by job id, with each result. Adding or removing a floor job therefore
// updates this summary with no edit here. `gate.yml` is parsed only to turn a job id
// into the display name the Actions API reports (`lint` -> `lint (semgrep)`,
// `build-and-test` -> `build-and-test (<os>)`); a parse miss degrades to an explicit
// UNRESOLVED row, never to a silently wrong summary.
//
// NON-BLOCKING FAILURES ARE DERIVED, NOT HARDCODED. A leg whose API conclusion is
// `failure` while its own need's rollup result is `success` can only be a
// continue-on-error leg. Nothing here knows the word "windows"; any future
// continue-on-error leg surfaces the same way.
//
// Usage (CI):
//   gh api ... --jq '.jobs[]' | NEEDS_JSON='${{ toJSON(needs) }}' bun gate-scope-summary.ts
// Usage (local, against a captured fixture):
//   bun src/Core.TypeScript/ci/gate-scope-summary.ts --jobs <file.json>
//
// Exit 0 always: this is an observability layer. The blocking verdict stays in the
// rollup's own check step, whose logic this does not touch.

import { appendFileSync, readFileSync } from "node:fs";

export interface RunStep {
  readonly name: string;
  readonly conclusion: string | null;
}

export interface RunJob {
  readonly name: string;
  readonly status?: string | undefined;
  readonly conclusion: string | null;
  readonly steps?: readonly RunStep[] | undefined;
}

/** One matrix leg (or the single job) that a floor `needs:` entry expanded into. */
export interface LegRow {
  readonly name: string;
  readonly conclusion: string;
  readonly stepsRan: number;
  readonly stepsSkipped: number;
  readonly skippedStepNames: readonly string[];
  /** API says failure, the rollup's `needs` result says success => continue-on-error. */
  readonly nonBlockingFailure: boolean;
}

export interface FloorRow {
  /** Job id as it appears in `gate-required.needs`. */
  readonly need: string;
  /** Display name declared in gate.yml (may contain a `${{ ... }}` tail). */
  readonly declaredName: string;
  /** The `needs.<id>.result` GitHub reported to the rollup. */
  readonly rollupResult: string;
  readonly legs: readonly LegRow[];
}

export type Scope = "full" | "reduced" | "unknown";

export interface GateSummary {
  readonly scope: Scope;
  /** Floor jobs whose rollup result was `skipped` -- the jobs that did not run at all. */
  readonly skippedFloorJobs: readonly string[];
  readonly executedFloorJobs: readonly string[];
  readonly nonBlockingFailures: readonly string[];
  readonly unresolvedNeeds: readonly string[];
  /** Failed jobs outside the floor (drift lints) -- reported, never blocking. */
  readonly outsideFloorFailures: readonly string[];
  readonly rows: readonly FloorRow[];
}

// ── gate.yml: job id -> declared display name ──────────────────────────────────────
//
// Deliberately a small line scanner rather than a YAML dependency: the rollup job runs
// with a sparse checkout and no `bun install`, so a dependency would cost more than the
// whole step. Only two shapes are read -- a job id at two-space indent under `jobs:`,
// and its `name:` at four-space indent -- and `gateYmlJobNames` is pinned against the
// real gate.yml by the test beside this file, so a shape change fails there first.
// Parsed with string operations rather than regexes: the two shapes are trivially
// expressible without one, and a linear scan has no backtracking to reason about.
const ID_CHARS = new Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-");

/** `  <job-id>:` at exactly two-space indent, or null. */
function jobIdOf(line: string): string | null {
  if (!line.startsWith("  ") || line.startsWith("   ")) return null;
  const body = line.slice(2).trimEnd();
  if (!body.endsWith(":")) return null;
  const id = body.slice(0, -1);
  if (id.length === 0) return null;
  for (const ch of id) if (!ID_CHARS.has(ch)) return null;
  return id;
}

/** `    name: <value>` at exactly four-space indent, or null. */
function jobNameOf(line: string): string | null {
  const prefix = "    name:";
  if (!line.startsWith(prefix) || line.startsWith("     ")) return null;
  return line.slice(prefix.length).trim();
}

export function gateYmlJobNames(yamlText: string): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  let inJobs = false;
  let current: string | null = null;
  for (const rawLine of yamlText.split("\n")) {
    if (rawLine.trimEnd() === "jobs:") {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    // A non-indented, non-empty, non-comment line ends the `jobs:` mapping.
    if (/^\S/.test(rawLine)) break;

    const jobId = jobIdOf(rawLine);
    if (jobId !== null) {
      current = jobId;
      continue;
    }
    if (current === null) continue;
    const declared = jobNameOf(rawLine);
    if (declared !== null && !names.has(current)) {
      names.set(current, stripQuotes(declared));
    }
  }
  return names;
}

function stripQuotes(value: string): string {
  const first = value.at(0);
  if ((first === '"' || first === "'") && value.endsWith(first) && value.length > 1) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Match the Actions-API job names belonging to one declared job name.
 * A declared name containing `${{ ... }}` is a matrix job, so its literal head is a
 * prefix (`build-and-test (` matches `build-and-test (windows-2025)`); anything else
 * must match exactly, which keeps `lint (semgrep)` from swallowing `lint (semgrep drift)`.
 */
export function matchJobs(declaredName: string, jobs: readonly RunJob[]): readonly RunJob[] {
  const exprAt = declaredName.indexOf("${{");
  if (exprAt < 0) return jobs.filter((j) => j.name === declaredName);
  const prefix = declaredName.slice(0, exprAt);
  return jobs.filter((j) => j.name.startsWith(prefix));
}

function scopeOf(rows: readonly FloorRow[], unresolved: readonly string[], skipped: readonly string[]): Scope {
  if (rows.length === 0 || unresolved.length > 0) return "unknown";
  if (skipped.length > 0) return "reduced";
  return "full";
}

export function summarizeGate(
  needs: Readonly<Record<string, { readonly result?: string | undefined }>>,
  jobs: readonly RunJob[],
  declaredNames: ReadonlyMap<string, string>,
): GateSummary {
  const rows: FloorRow[] = [];
  const unresolvedNeeds: string[] = [];
  const claimed = new Set<string>();

  for (const need of Object.keys(needs).sort()) {
    const rollupResult = needs[need]?.result ?? "unknown";
    const declaredName = declaredNames.get(need) ?? need;
    const matched = matchJobs(declaredName, jobs);
    if (matched.length === 0) unresolvedNeeds.push(need);

    const legs: LegRow[] = matched.map((job) => {
      const steps = job.steps ?? [];
      const skippedStepNames = steps.filter((s) => s.conclusion === "skipped").map((s) => s.name);
      const conclusion = job.conclusion ?? job.status ?? "unknown";
      return {
        name: job.name,
        conclusion,
        stepsRan: steps.filter((s) => s.conclusion !== "skipped").length,
        stepsSkipped: skippedStepNames.length,
        skippedStepNames,
        nonBlockingFailure: conclusion === "failure" && rollupResult === "success",
      };
    });
    for (const job of matched) claimed.add(job.name);
    rows.push({ need, declaredName, rollupResult, legs });
  }

  const skippedFloorJobs = rows.filter((r) => r.rollupResult === "skipped").map((r) => r.need);
  const executedFloorJobs = rows.filter((r) => r.rollupResult !== "skipped").map((r) => r.need);
  const nonBlockingFailures = rows.flatMap((r) => r.legs.filter((l) => l.nonBlockingFailure).map((l) => l.name));
  const outsideFloorFailures = jobs
    .filter((j) => !claimed.has(j.name) && j.conclusion === "failure")
    .map((j) => j.name);

  return {
    scope: scopeOf(rows, unresolvedNeeds, skippedFloorJobs),
    skippedFloorJobs,
    executedFloorJobs,
    nonBlockingFailures,
    unresolvedNeeds,
    outsideFloorFailures,
    rows,
  };
}

/** Join key for grouping identical skip-sets; not a display separator. */
const SEP = "\u0000";

const SCOPE_HEADLINE: Readonly<Record<Scope, string>> = {
  full: "every floor job ran. No floor job was skipped by the path filter.",
  reduced:
    "at least one floor job did NOT run. This green covers less than a full-scope green; the skipped jobs are named below.",
  unknown: "the floor could not be fully resolved against this run's job list. Treat the table below as incomplete.",
};

const code = (value: string): string => "`" + value + "`";
const codeList = (values: readonly string[]): string => values.map(code).join(", ");

function renderTable(rows: readonly FloorRow[]): string[] {
  const out: string[] = [
    "| floor job | rollup result | leg | leg result | steps ran | steps skipped |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of rows) {
    if (row.legs.length === 0) {
      const cell = `**UNRESOLVED** (no job matched ${code(row.declaredName)})`;
      out.push(`| ${code(row.need)} | ${row.rollupResult} | ${cell} | -- | -- | -- |`);
      continue;
    }
    for (const leg of row.legs) {
      const legResult = leg.nonBlockingFailure ? "**FAILED (non-blocking)**" : leg.conclusion;
      const ran = String(leg.stepsRan);
      const skipped = String(leg.stepsSkipped);
      out.push(`| ${code(row.need)} | ${row.rollupResult} | ${leg.name} | ${legResult} | ${ran} | ${skipped} |`);
    }
  }
  return out;
}

/**
 * Matrix legs skip the same steps for the same reason, so identical skip-sets are grouped
 * rather than printed once per leg.
 */
function renderSkippedSteps(rows: readonly FloorRow[]): string[] {
  const legs = rows.flatMap((r) => r.legs.filter((l) => l.stepsSkipped > 0));
  if (legs.length === 0) return [];
  const grouped = new Map<string, string[]>();
  for (const leg of legs) {
    const key = leg.skippedStepNames.join(SEP);
    const names = grouped.get(key);
    if (names === undefined) grouped.set(key, [leg.name]);
    else names.push(leg.name);
  }
  const out: string[] = ["<details><summary>Steps skipped inside floor jobs that DID run</summary>", ""];
  for (const [key, legNames] of grouped) {
    const stepNames = key
      .split(SEP)
      .map((n) => `_${n}_`)
      .join(", ");
    out.push(`- ${codeList(legNames)}: ${stepNames}`);
  }
  out.push("", "</details>", "");
  return out;
}

function renderDetailsList(title: string, items: readonly string[]): string[] {
  if (items.length === 0) return [];
  const out: string[] = [`<details><summary>${title}</summary>`, ""];
  for (const item of items) out.push(`- ${code(item)}`);
  out.push("", "</details>", "");
  return out;
}

export function renderMarkdown(s: GateSummary): string {
  const out: string[] = [
    "### `gate (required)` -- what this green covers",
    "",
    `**Scope: ${s.scope.toUpperCase()}** -- ${SCOPE_HEADLINE[s.scope]}`,
    "",
    ...renderTable(s.rows),
    "",
  ];

  if (s.skippedFloorJobs.length > 0) {
    out.push(`**Floor jobs that did NOT run:** ${codeList(s.skippedFloorJobs)}`, "");
  }

  out.push(...renderSkippedSteps(s.rows));

  if (s.nonBlockingFailures.length > 0) {
    out.push(
      "**Non-blocking failures -- these legs FAILED and this check still reports success** " +
        "(`continue-on-error` in `build-and-test`; see the residue note at that flag):",
    );
    for (const n of s.nonBlockingFailures) out.push(`- ${code(n)}`);
    out.push("");
  }

  // Read mid-run: jobs outside the floor may still be in flight, and are not listed here.
  out.push(
    ...renderDetailsList("Failed jobs OUTSIDE the floor (drift, non-blocking by design)", s.outsideFloorFailures),
  );

  if (s.unresolvedNeeds.length > 0) {
    const names = codeList(s.unresolvedNeeds);
    out.push(`**Unresolved floor entries** (in \`needs:\` but no matching job in this run): ${names}`, "");
  }

  return out.join("\n");
}

/** One line for the check-run annotation, so the scope is legible without opening logs. */
export function renderNotice(s: GateSummary): string {
  const ran = String(s.executedFloorJobs.length);
  const total = String(s.rows.length);
  const skipped = s.skippedFloorJobs.length > 0 ? ` Skipped: ${s.skippedFloorJobs.join(", ")}.` : "";
  const nb =
    s.nonBlockingFailures.length > 0
      ? ` NON-BLOCKING FAILURES: ${s.nonBlockingFailures.join(", ")} (failed, not reflected in this check).`
      : "";
  return `gate scope=${s.scope}: ${ran}/${total} floor jobs ran.${skipped}${nb}`;
}

// ── CLI ────────────────────────────────────────────────────────────────────────────

/** Accepts a `{jobs:[...]}` envelope, a bare array, or the NDJSON `gh api --paginate --jq '.jobs[]'` stream. */
export function parseJobsInput(text: string): readonly RunJob[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as RunJob[];
    if (parsed !== null && typeof parsed === "object" && Array.isArray((parsed as { jobs?: unknown }).jobs)) {
      return (parsed as { jobs: RunJob[] }).jobs;
    }
  } catch {
    // fall through to NDJSON
  }
  const jobs: RunJob[] = [];
  for (const line of trimmed.split("\n")) {
    const l = line.trim();
    if (l.length === 0) continue;
    jobs.push(JSON.parse(l) as RunJob);
  }
  return jobs;
}

function writeGithubFile(envVar: "GITHUB_STEP_SUMMARY" | "GITHUB_OUTPUT", content: string): void {
  const path = process.env[envVar];
  if (path === undefined || path.length === 0) return;
  appendFileSync(path, content.endsWith("\n") ? content : `${content}\n`);
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Uint8Array);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const jobsFlag = argv.indexOf("--jobs");
  const gateFlag = argv.indexOf("--gate-yml");
  const gateYmlPath = gateFlag >= 0 ? (argv[gateFlag + 1] ?? "") : ".github/workflows/gate.yml";

  const jobsText = jobsFlag >= 0 ? readFileSync(argv[jobsFlag + 1] ?? "", "utf8") : await readStdin();
  const jobs = parseJobsInput(jobsText);

  const needsRaw = process.env.NEEDS_JSON ?? "{}";
  const needs = JSON.parse(needsRaw) as Record<string, { result?: string }>;

  let declaredNames: ReadonlyMap<string, string> = new Map();
  try {
    declaredNames = gateYmlJobNames(readFileSync(gateYmlPath, "utf8"));
  } catch {
    console.log(`[gate-scope] could not read ${gateYmlPath}; falling back to job ids for display names.`);
  }

  const summary = summarizeGate(needs, jobs, declaredNames);
  const markdown = renderMarkdown(summary);
  console.log(markdown);
  writeGithubFile("GITHUB_STEP_SUMMARY", `${markdown}\n`);

  const notice = renderNotice(summary);
  console.log(`::notice title=gate scope::${notice}`);
  for (const leg of summary.nonBlockingFailures) {
    console.log(
      `::warning title=non-blocking failure::${leg} FAILED. It is inside the required floor but carries ` +
        `continue-on-error, so \`gate (required)\` still reports success.`,
    );
  }

  writeGithubFile(
    "GITHUB_OUTPUT",
    [
      `scope=${summary.scope}`,
      `floor-executed=${summary.executedFloorJobs.join(",")}`,
      `floor-skipped=${summary.skippedFloorJobs.join(",")}`,
      `nonblocking-failures=${summary.nonBlockingFailures.join(",")}`,
    ].join("\n"),
  );
}

if (import.meta.main) {
  await main();
}
