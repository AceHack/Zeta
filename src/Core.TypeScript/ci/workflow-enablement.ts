#!/usr/bin/env bun
// workflow-enablement.ts -- a workflow DISABLED IN THE FORGE is a check that did not run
// looking like one that passed.
//
// THE CONDITION, AND WHY EVERY EXISTING GUARD MISSES IT
// -----------------------------------------------------
// GitHub Actions carries a per-workflow "state" that is administrative, not textual:
// active, disabled_manually, disabled_inactivity. A workflow can sit at its correct path,
// fully valid, referenced by prose and by rosters, and produce ZERO runs forever because
// somebody pressed "Disable workflow" in the UI or called
// PUT /actions/workflows/{id}/disable. Nothing about the repository changes. No run
// appears, so no run can be red. The check does not fail -- it stops existing.
//
// EVERY GUARD THIS REPO ALREADY HAS IS A GUARD OVER TEXT, so none can see it:
//   * lint-no-nested-workflow-dirs.ts -- "a workflow file GitHub will never read is not a
//     check". The nearest sibling, and it reads PATHS. A disabled workflow sits at a path
//     GitHub reads perfectly well; it simply refuses to dispatch it.
//   * lint-linter-coverage-vs-ci-invocation -- "a configured linter must be an invoked
//     one". It finds the invocation in the YAML. The YAML is correct.
//   * lint-workflow-job-timeouts, lint-drift-publication-lands, the workflow-shape
//     falsifiers -- all read the committed file.
// The state lives ONLY in the forge, so only a live query can see it.
//
// MEASURED 2026-09-09 on Lucent-Financial-Group/Zeta: 16 of 105 workflows were
// disabled_manually, and no surface in the repository named that fact.
//
// THEY WERE DISABLED ON PURPOSE, and this file is NOT a case for turning them back on.
// The maintainer (Aaron, 2026-09-09) stopped the cadence/heartbeat lanes because they
// were growing the repository uncontrollably: several hold contents:write and COMMIT on
// every scheduled run -- drift-sweep.yml writes a tick event to docs/drift-events/ per
// cadence -- so re-enabling one resumes exactly what was removed. The registry records
// them as `intentional` and the audit is content with that forever.
//
// SO WHAT IS THIS FOR. Visibility, and nothing more. A workflow that produces no runs
// produces no red X, so its silence is invisible by construction, and this repository has
// no other surface that can see it. The value is in the DELTA: the seventeenth
// disablement nobody wrote down, an entry that quietly comes back to life, a roster row
// that has gone stale. Those are the findings. The recorded sixteen are furniture.
//
// A design note, deliberately not a work item: verdict-drought.ts runs in two hosts on
// purpose ("a drought detector that lives only inside gate is cancelled by exactly the
// condition it exists to report"), and drift-sweep was the second one. That redundancy is
// currently gone. Restoring it would need a NON-COMMITTING host, which is a later design
// question and not a defect to be filed now.
//
// WHAT IT DOES, AND THE BASELINE DISCIPLINE
// -----------------------------------------
// registry/workflow-enablement.json records every workflow known to be non-active, with a
// reason and a classification. The fold compares that record against the live state.
//
//   BLOCKING (exit 1) -- the register moved and nobody wrote it down:
//     undeclared-disabled       non-active in the forge, absent from the registry. THE
//                               NEXT SILENT DISABLEMENT LANDS HERE.
//     stale-baseline-now-active the registry names a workflow that is running again. A
//                               roster claiming a closed gap teaches readers to skip the
//                               row that names an open one.
//     baseline-path-absent      the registry names a path the forge does not list at all
//                               (renamed, deleted) -- an entry that can never be true.
//     malformed-entry           no reason, or an unknown classification. A roster row with
//                               no reason records nothing.
//
//   LOUD BUT NOT BLOCKING (exit 0) -- the recorded, still-true state:
//     known-disabled / intentional  a decided answer.
//     known-disabled / unreviewed   a warning annotation per entry plus a count. These are
//                               the 16 measured above: recorded as FACT, explicitly NOT as
//                               approval, printed on every run so that "unreviewed" cannot
//                               quietly become "fine".
//
// WHY THE UNREVIEWED SET DOES NOT GO RED. gate.yml states the reason in its own words: "a
// red X nobody must clear is a red X nobody reads." Sixteen findings nobody on this branch
// has the authority to resolve would paint a permanent red on the drift (loud) job and
// train every reader to ignore it -- destroying the signal this file exists to add. The
// check is non-vacuous from its first run all the same: it is armed against the
// SEVENTEENTH disablement, against any of the sixteen coming back, and against its own
// roster going stale. Same baseline shape audit-tick-shard-relative-paths already uses.
//
// ITS OWN LIVENESS -- HOW THIS DETECTOR FAILS, STATED PLAINLY
// -----------------------------------------------------------
//   * THE LISTING COMES BACK EMPTY (token denied, API change, wrong repo) -> register
//     unmeasured, exit 2, never 0. An empty population is not a clean one.
//   * THE LISTING IS TRUNCATED. The API paginates at 100. A disabled workflow on a page
//     that never arrived would be invisible, and every registry entry on that page would
//     read as baseline-path-absent. foldEnablement therefore takes totalCount and refuses
//     to fold a listing shorter than it: register unmeasured, exit 2.
//   * THE STEP NEVER EXECUTES because its host job was cancelled. This is the one failure
//     this file cannot self-report -- the same honest limit verdict-drought.ts states. It
//     is not papered over: it is why the roster it protects matters, since the first thing
//     to go quiet is the thing nobody is watching.
//
// PLACEMENT: DRIFT TIER, AND THAT IS FORCED, NOT PREFERRED
// ---------------------------------------------------------
// This is a LIVE POPULATION QUERY -- "what workflows are out there right now" -- and
// floor-live-remote-queries.ts refuses exactly that inside the blocking floor, for a
// measured reason: a pre-merge gate verdict must be a function of the CANDIDATE, never of
// repo-wide state the candidate cannot touch. A PR adding a comment must not go red
// because somebody disabled a cadence lane an hour earlier. So this rides in drift (loud),
// which already holds actions:read and already goes red beside a green required check.
//
// DISCIPLINES. Noninterference (13): foldEnablement is pure -- no clock, no network, no
// filesystem; every crossing happens in main(). Idempotency (12): same listing + same
// registry => byte-identical report. Culture-invariant: ordinal comparison only, never
// localeCompare.
//
// Usage:
//   bun src/Core.TypeScript/ci/workflow-enablement.ts --repo <owner/name>
//   bun src/Core.TypeScript/ci/workflow-enablement.ts --observations <file.json>
//
// Exit 0 = live enablement matches the registry (unreviewed entries are warnings).
// Exit 1 = the registry and the forge disagree; the finding names the workflow.
// Exit 2 = the check could not run. Never confused with exit 0.

import { appendFileSync, readFileSync } from "node:fs";

export const KNOWN_CLASSIFICATIONS = ["intentional", "unreviewed"] as const;
export type Classification = (typeof KNOWN_CLASSIFICATIONS)[number];

export interface ObservedWorkflow {
  readonly path: string;
  /** active | disabled_manually | disabled_inactivity | anything GitHub adds later. */
  readonly state: string;
}

export interface RegistryEntry {
  readonly path: string;
  readonly state: string;
  readonly reason: string;
  readonly classification: string;
}

export type FindingKind =
  "undeclared-disabled" | "stale-baseline-now-active" | "baseline-path-absent" | "malformed-entry" | "known-disabled";

export interface Finding {
  readonly kind: FindingKind;
  readonly path: string;
  readonly detail: string;
  /** true when this finding drives a non-zero exit. */
  readonly blocking: boolean;
}

export type Register = "ok" | "drift" | "unmeasured";

export interface EnablementReport {
  readonly register: Register;
  readonly observedCount: number;
  readonly totalCount: number;
  readonly activeCount: number;
  readonly findings: readonly Finding[];
  readonly unreviewedCount: number;
  readonly intentionalCount: number;
  readonly reasons: readonly string[];
}

/**
 * A workflow is RUNNABLE only when its state is exactly "active". A strict allow-list of
 * one, not a deny-list of the disabled states, and the direction matters: a deny-list gets
 * it wrong the day GitHub adds a fourth state, and it gets it wrong in the dangerous
 * direction -- an unknown state would read as runnable, which is this file's whole subject.
 */
export function isRunnable(state: string): boolean {
  return state === "active";
}

function byPath<T extends { readonly path: string }>(rows: readonly T[]): readonly T[] {
  // Ordinal sort. localeCompare is culture-sensitive and would reorder this report between
  // machines (.claude/rules/culture-invariant-by-default.md).
  return [...rows].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * The whole judgement, as a pure function. totalCount is the API's own total_count and is
 * compared against the number of rows actually handed over: a short page is a listing that
 * did not finish, and folding it would manufacture baseline-path-absent findings for
 * everything on the pages that never arrived.
 */
export function foldEnablement(
  observed: readonly ObservedWorkflow[],
  registry: readonly RegistryEntry[],
  totalCount: number,
): EnablementReport {
  if (observed.length === 0) {
    return {
      register: "unmeasured",
      observedCount: 0,
      totalCount,
      activeCount: 0,
      findings: [],
      unreviewedCount: 0,
      intentionalCount: 0,
      reasons: [
        "The workflow listing came back EMPTY. The enablement state was NOT measured. " +
          "An empty population is reported as unmeasured, never as a clean bill of health.",
      ],
    };
  }

  if (observed.length < totalCount) {
    return {
      register: "unmeasured",
      observedCount: observed.length,
      totalCount,
      activeCount: observed.filter((w) => isRunnable(w.state)).length,
      findings: [],
      unreviewedCount: 0,
      intentionalCount: 0,
      reasons: [
        `The listing is TRUNCATED: ${String(observed.length)} row(s) received for a reported total ` +
          `of ${String(totalCount)}. A workflow on a page that never arrived would be invisible, and ` +
          "every registry entry on that page would read as absent. Refusing to fold.",
      ],
    };
  }

  const reasons: string[] = [];
  const findings: Finding[] = [];
  const observedByPath = new Map<string, ObservedWorkflow>();
  for (const w of observed) observedByPath.set(w.path, w);

  const registryByPath = new Map<string, RegistryEntry>();
  let unreviewedCount = 0;
  let intentionalCount = 0;

  const add = (f: Finding): void => {
    findings[findings.length] = f;
  };
  const addReason = (r: string): void => {
    reasons[reasons.length] = r;
  };

  for (const e of byPath(registry)) {
    if (e.reason.trim().length === 0) {
      add(mk("malformed-entry", e.path, DETAIL_EMPTY_REASON, true));
      continue;
    }
    const known = KNOWN_CLASSIFICATIONS as readonly string[];
    if (!known.includes(e.classification)) {
      add(mk("malformed-entry", e.path, DETAIL_BAD_CLASS + e.classification, true));
      continue;
    }
    registryByPath.set(e.path, e);
  }

  // Direction 1: the forge says non-active. Does the registry know?
  for (const w of byPath(observed)) {
    if (isRunnable(w.state)) continue;
    const declared = registryByPath.get(w.path);
    if (declared === undefined) {
      add(mk("undeclared-disabled", w.path, "state " + w.state + DETAIL_UNDECLARED, true));
      continue;
    }
    if (declared.classification === "unreviewed") unreviewedCount += 1;
    else intentionalCount += 1;
    const note = "state " + w.state + " (" + declared.classification + "): " + declared.reason;
    add(mk("known-disabled", w.path, note, false));
  }

  // Direction 2: the registry claims a gap. Is the gap still there?
  for (const e of byPath([...registryByPath.values()])) {
    const live = observedByPath.get(e.path);
    if (live === undefined) {
      add(mk("baseline-path-absent", e.path, DETAIL_ABSENT, true));
      continue;
    }
    if (isRunnable(live.state)) add(mk("stale-baseline-now-active", e.path, DETAIL_STALE, true));
  }

  const blocking = findings.filter((f) => f.blocking);
  const activeCount = observed.filter((w) => isRunnable(w.state)).length;

  if (blocking.length === 0) {
    addReason(
      "Live enablement matches the registry: " +
        String(activeCount) +
        " of " +
        String(observed.length) +
        " workflow(s) active, and every non-active one is recorded.",
    );
    if (unreviewedCount > 0) addReason(String(unreviewedCount) + DETAIL_UNREVIEWED);
  } else {
    addReason(String(blocking.length) + " blocking finding(s): the forge enablement state and the registry disagree.");
  }

  return {
    register: blocking.length === 0 ? "ok" : "drift",
    observedCount: observed.length,
    totalCount,
    activeCount,
    findings: byPath(findings),
    unreviewedCount,
    intentionalCount,
    reasons,
  };
}

const DETAIL_EMPTY_REASON = "registry entry carries an EMPTY reason. A roster row with no reason records nothing.";

const DETAIL_BAD_CLASS = "registry entry has an unknown classification: ";

const DETAIL_UNDECLARED =
  " in the forge and NOT in registry/workflow-enablement.json. This workflow produces no runs, " +
  "so it can produce no red X. Declare it (with a reason) or re-enable it.";

const DETAIL_ABSENT =
  "named in registry/workflow-enablement.json but the forge lists no workflow at that path " +
  "(renamed or deleted). An entry that can never be true hides the next real one.";

const DETAIL_STALE =
  "registry says disabled; the forge says active. The entry is STALE -- remove it. A roster that " +
  "claims a closed gap teaches readers to skip the row that names an open one.";

const DETAIL_UNREVIEWED =
  " recorded entr(ies) are classified unreviewed -- recorded as FACT, not as approval. They are " +
  "printed on every run so that unreviewed cannot quietly become fine. Clearing them is a " +
  "maintainer decision: re-enable, or reclassify with a reason.";

function mk(kind: FindingKind, path: string, detail: string, blocking: boolean): Finding {
  return { kind, path, detail, blocking };
}

export function renderEnablementMarkdown(report: EnablementReport): string {
  const lines: string[] = [];
  const say = (s: string): void => {
    lines[lines.length] = s;
  };
  say("## workflow enablement -- is every committed check actually runnable?\n");
  if (report.register === "unmeasured") say("**NOT MEASURED**\n");
  else if (report.register === "drift") say("**DRIFT -- the registry and the forge disagree**\n");
  else say("**OK -- every non-active workflow is recorded**\n");

  say("| measurement | value |");
  say("| --- | --- |");
  say("| register | " + report.register + " |");
  say("| workflows listed | " + String(report.observedCount) + " of " + String(report.totalCount) + " |");
  say("| active (runnable) | " + String(report.activeCount) + " |");
  say("| recorded non-active, intentional | " + String(report.intentionalCount) + " |");
  say("| recorded non-active, UNREVIEWED | " + String(report.unreviewedCount) + " |");
  const blocking = report.findings.filter((f) => f.blocking);
  say("| blocking findings | " + String(blocking.length) + " |");
  say("");

  if (blocking.length > 0) {
    say("**Blocking findings:**\n");
    for (const f of blocking) say("- " + f.kind + " **" + f.path + "** -- " + f.detail);
    say("");
  }
  const known = report.findings.filter((f) => !f.blocking);
  if (known.length > 0) {
    say("**Recorded non-active workflows** (no runs, therefore no red X):\n");
    for (const f of known) say("- **" + f.path + "** -- " + f.detail);
    say("");
  }
  say("**Why:**\n");
  for (const r of report.reasons) say("- " + r);
  say("");
  say(
    "**Nothing here blocks a merge.** This job is not in the gate (required) needs list. It is a " +
      "live population query, which floor-live-remote-queries.ts refuses inside the blocking " +
      "floor: a candidate verdict must never move on repo-wide state the candidate cannot touch.",
  );
  return lines.join("\n");
}

/**
 * The STEP-SUMMARY rendering, and the reason it is a second function rather than a reuse
 * of `renderEnablementMarkdown`.
 *
 * CodeQL `js/http-to-file-access` (alert 930): "Write to file system depends on Untrusted
 * data." `main()` appends to `$GITHUB_STEP_SUMMARY` -- a real file write -- and the full
 * markdown embeds workflow paths and states that came from a network fetch.
 *
 * A FIRST ATTEMPT VALIDATED THOSE STRINGS AND THE ALERT STAYED OPEN. That is CodeQL being
 * right and me being clever: a regex guard leaves the ORIGINAL string flowing on the true
 * branch, so the taint path is intact however well the value was checked. Validation
 * narrows what an attacker can put in a file; it does not stop the file depending on
 * remote data. (The validation is KEPT -- see `sanitizeObservation` -- because it is worth
 * having on its own merits. It is simply not what closes this.)
 *
 * So the flow is broken structurally instead: NOTHING network-derived reaches the file.
 * This function emits counts (numbers), the register (a local union), and fixed prose.
 * Every string here is a literal in this file.
 *
 * THE DETAIL IS NOT LOST, it moves to a channel that is not a file: the full markdown
 * still goes to stdout, and every finding still emits a `::error::` / `::warning::`
 * annotation. Those are the surfaces a reader actually uses for findings; the step summary
 * keeps the shape of the run. Nothing is narrowed -- exit codes are untouched.
 */

/**
 * Counts, as PRIMITIVES re-derived from the report.
 *
 * Alert 931 (the successor to 930) showed that CodeQL taints the whole `report` OBJECT,
 * so `renderEnablementSummary(report)` returned a tainted string no matter which fields it
 * actually read. Field-level reasoning does not help against object-level taint.
 *
 * So the summary is built from values that are literals or numbers by construction:
 * `register` is re-derived through a ternary whose every branch is a literal IN THIS FILE,
 * and each count goes through `Number()`. Nothing that reaches the file is a string that
 * came off the wire.
 */
export interface EnablementCounts {
  readonly register: "ok" | "drift" | "unmeasured";
  readonly observed: number;
  readonly total: number;
  readonly active: number;
  readonly intentional: number;
  readonly unreviewed: number;
  readonly blocking: number;
}

export function countsFromReport(report: EnablementReport): EnablementCounts {
  const register = report.register === "ok" ? "ok" : report.register === "drift" ? "drift" : "unmeasured";
  return {
    register,
    observed: Number(report.observedCount),
    total: Number(report.totalCount),
    active: Number(report.activeCount),
    intentional: Number(report.intentionalCount),
    unreviewed: Number(report.unreviewedCount),
    blocking: Number(report.findings.filter((f) => f.blocking).length),
  };
}

export function renderEnablementSummary(counts: EnablementCounts): string {
  const lines = [
    "## workflow enablement -- is every committed check actually runnable?",
    "",
    "| measurement | value |",
    "| --- | --- |",
    "| register | " + counts.register + " |",
    "| workflows listed | " + String(counts.observed) + " of " + String(counts.total) + " |",
    "| active (runnable) | " + String(counts.active) + " |",
    "| recorded non-active, intentional | " + String(counts.intentional) + " |",
    "| recorded non-active, UNREVIEWED | " + String(counts.unreviewed) + " |",
    "| blocking findings | " + String(counts.blocking) + " |",
    "",
    "Workflow paths and states are deliberately NOT written here: they are network-derived, " +
      "and a step summary is a file. They appear in the job log and in the per-finding " +
      "annotations, which is where findings are read anyway (CodeQL js/http-to-file-access).",
  ];
  return lines.join("\n");
}

export function enablementAnnotations(report: EnablementReport): readonly string[] {
  const out: string[] = [];
  const emit = (s: string): void => {
    out[out.length] = s;
  };
  if (report.register === "unmeasured") {
    for (const r of report.reasons) emit("::error title=workflow-enablement went quiet::" + r);
    return out;
  }
  for (const f of report.findings) {
    if (f.blocking) emit("::error title=workflow " + f.kind + "::" + f.path + " -- " + f.detail);
    else emit("::warning title=workflow disabled::" + f.path + " -- " + f.detail);
  }
  return out;
}

function flagValue(argv: readonly string[], flag: string, fallback: string): string {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? (argv[i + 1] ?? fallback) : fallback;
}

interface ApiWorkflow {
  readonly path?: string;
  readonly state?: string;
}

interface ApiListing {
  readonly total_count?: number;
  readonly workflows?: readonly ApiWorkflow[];
}

/**
 * The ONLY shape a workflow path may take on its way to a file. Anchored, bounded, and a
 * character allowlist rather than a denylist.
 */
export const WORKFLOW_PATH_PATTERN = /^\.github\/workflows\/[A-Za-z0-9._-]{1,120}\.ya?ml$/;

/**
 * The only shape a state may take. GitHub's states are `active`, `disabled_manually` and
 * `disabled_inactivity`; the pattern admits any future lowercase/underscore name without
 * admitting arbitrary bytes.
 */
export const WORKFLOW_STATE_PATTERN = /^[a-z_]{1,32}$/;

/** Substituted for a path that failed validation. Never matches a registry entry. */
export const REJECTED_PATH = "<rejected-workflow-path>";

/**
 * Substituted for a state that failed validation. Deliberately NOT `active`, so a
 * rejected row is non-runnable and the report goes LOUD rather than quiet -- the
 * substitution must never be the thing that makes a check pass.
 */
export const REJECTED_STATE = "unrecognized-state";

/**
 * Build an observation from an API row, admitting only values matched against the
 * patterns above.
 *
 * WHY THIS EXISTS -- CodeQL `js/http-to-file-access`, alert 930. `main()` writes the
 * rendered report to `$GITHUB_STEP_SUMMARY`, and every string in that report descends
 * from a network fetch. The source is trusted TODAY, which is an argument about the
 * remote rather than about this program: a compromised or merely changed API response
 * would reach a file write unexamined. So nothing crosses that boundary unvalidated.
 *
 * IT IS ALSO A REAL IMPROVEMENT, not query appeasement. A registry that can only contain
 * well-formed rows is better than one mirroring whatever arrived, and both substitutions
 * FAIL CLOSED: a rejected path matches no registry entry (so it reports as
 * `undeclared-disabled`) and a rejected state is not `active` (so it is never runnable).
 * A malformed row makes noise instead of passing silently.
 *
 * The `name` field was DELETED rather than sanitised: nothing read it, and a free-text
 * field nothing reads is a taint source with no consumer.
 */
export function sanitizeObservation(w: ApiWorkflow): ObservedWorkflow {
  const rawPath = w.path ?? "";
  const rawState = w.state ?? "";
  return {
    path: WORKFLOW_PATH_PATTERN.test(rawPath) ? rawPath : REJECTED_PATH,
    state: WORKFLOW_STATE_PATTERN.test(rawState) ? rawState : REJECTED_STATE,
  };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const registryPath = flagValue(argv, "--registry", "registry/workflow-enablement.json");
  const observationsPath = flagValue(argv, "--observations", "");
  const repo = flagValue(argv, "--repo", process.env["REPO"] ?? "");

  let registry: readonly RegistryEntry[];
  try {
    const raw = JSON.parse(readFileSync(registryPath, "utf8")) as { readonly entries?: readonly RegistryEntry[] };
    registry = raw.entries ?? [];
  } catch (err) {
    console.log(
      "::error title=workflow-enablement could not read its registry::" +
        registryPath +
        ": " +
        String(err) +
        ". Reported as exit 2 -- the check did not run. It is NOT reported as clean.",
    );
    return 2;
  }

  let observed: readonly ObservedWorkflow[];
  let totalCount: number;

  if (observationsPath.length > 0) {
    const raw = JSON.parse(readFileSync(observationsPath, "utf8")) as ApiListing;
    observed = (raw.workflows ?? []).map(sanitizeObservation);
    totalCount = raw.total_count ?? observed.length;
  } else {
    const token = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";
    if (token.length === 0 || repo.length === 0) {
      console.log(
        "::error title=workflow-enablement went quiet::No GH_TOKEN or no --repo, and no " +
          "--observations fixture. The enablement state was NOT measured. Exit 2, never 0: a " +
          "detector that silently does nothing is the exact defect it exists to catch.",
      );
      return 2;
    }
    // PAGINATED, and the truncation guard in foldEnablement stays armed behind it.
    // Measured on the first live run of this file: the repo carries 105 workflows and the
    // page size is 100, so a single-page read silently lost five of them -- and the
    // registry seeded from that read would have been wrong in the direction that matters
    // (a disabled workflow on page 2 is invisible). Belt and braces on purpose: the loop
    // fetches until it has total_count rows, and the fold still refuses to judge a short
    // listing rather than trusting the loop.
    const headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" };
    const collected: ObservedWorkflow[] = [];
    let declaredTotal = 0;
    let page = 1;
    const MAX_PAGES = 20;
    while (page <= MAX_PAGES) {
      const url = "https://api.github.com/repos/" + repo + "/actions/workflows?per_page=100&page=" + String(page);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.log(
          "::error title=workflow-enablement went quiet::GET /actions/workflows page " +
            String(page) +
            " returned " +
            String(res.status) +
            ". Exit 2 -- not measured.",
        );
        return 2;
      }
      const body = (await res.json()) as ApiListing;
      declaredTotal = body.total_count ?? declaredTotal;
      const rows = (body.workflows ?? []).map(sanitizeObservation);
      for (const r of rows) collected[collected.length] = r;
      if (rows.length === 0 || collected.length >= declaredTotal) break;
      page += 1;
    }
    observed = collected;
    totalCount = declaredTotal;
  }

  const report = foldEnablement(observed, registry, totalCount);
  const markdown = renderEnablementMarkdown(report);
  console.log(markdown);
  for (const line of enablementAnnotations(report)) console.log(line);

  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath !== undefined && summaryPath.length > 0) {
    // Deliberately NOT `markdown`: see renderEnablementSummary. Nothing network-derived
    // reaches a file.
    appendFileSync(summaryPath, renderEnablementSummary(countsFromReport(report)) + "\n");
  }

  if (report.register === "unmeasured") {
    console.log("\nEXIT 2 -- the enablement state could not be measured. This is not a pass.");
    return 2;
  }
  if (report.register === "drift") {
    console.log(
      "\nEXIT 1 -- the registry and the forge disagree. This job is NOT in the gate (required) " +
        "floor: the merge is unaffected. Red here means read it, not stop.",
    );
    return 1;
  }
  console.log("\nEXIT 0 -- every non-active workflow is recorded, and the detector proved it looked.");
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
