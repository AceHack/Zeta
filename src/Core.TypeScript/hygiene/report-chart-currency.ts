#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/report-chart-currency.ts
//
// HOW FAR BEHIND IS EVERY HELM CHART PIN, AND IS ITS UPSTREAM STILL ALIVE?
//
// -- WHY THIS IS A DIFFERENT QUESTION FROM THE ONE ALREADY ANSWERED --------
// `audit-chart-target-revisions.ts` answers "does this pin RESOLVE?" and it is
// a PR-blocking gate, because an unresolvable pin is a REGRESSION: it was fine,
// someone changed something, now an Application can never sync. Currency is not
// that. On the day this landed, 34 of 35 pins in this tree were behind
// upstream and 14 of those crossed a major boundary. A pin can resolve
// perfectly and be 23 majors behind -- `kube-prometheus-stack` is pinned at
// 65.5.0 against an upstream at 88.5.3 -- and nothing in the resolvability
// audit notices, correctly, because nothing is broken.
//
// -- WHY THIS MUST NOT BE A GATE, stated before anyone is tempted -----------
// Being behind is a STANDING CONDITION, not a regression. A gate on it would be
// red from birth (34 of 35), and a signal that is red from birth is learned-to-
// ignore inside a week -- at which point it is worse than absent, because the
// tree now carries a check everyone routes around. So this emits a REPORT: a
// committed generated file whose git diff shows drift, and a job summary on the
// schedule that already refreshes the data. Nothing here ever exits non-zero on
// account of a chart being out of date. `--check` exits 1 for exactly one
// reason, and it is not a chart: the committed report no longer matches what
// the committed data produces.
//
// -- WHERE THE DATA COMES FROM: no second network lane ---------------------
// Both snapshots this reads are written by ONE pass of
// `audit-chart-target-revisions.ts --refresh`, on the weekly schedule that
// already exists (chart-version-refresh.yml):
//
//   published-chart-versions.json   what upstream publishes  (already existed)
//   published-chart-dates.json      WHEN it published each   (rides the same
//                                   index.yaml read -- zero extra requests)
//
// This file opens no sockets at all. It is a pure function of two committed
// snapshots plus the Application tree, which is what makes the committed report
// byte-reproducible and its diff meaningful.
//
// -- BEHIND IS NOT UNMAINTAINED, and conflating them inverts the danger -----
// A pure "versions behind" metric reports the most dangerous dependency in this
// tree as the healthiest one. `minio` is the ONLY pin here that is not behind --
// and only because upstream ARCHIVED the repository: charts.min.io published
// 5.4.0 on 2025-01-02 and has published nothing since, while the server it
// packages carries unpatched HIGH advisories whose fixes ship only in a
// proprietary product (docs/research/2026-08-21-minio-is-archived-*). "0 behind"
// and "upstream is alive" are two facts, so they get two columns: the gap, and
// the date of upstream's most recent publish. A chart nobody has published in
// two years reads as DORMANT here, not as CURRENT.
//
// -- AND A CHART WE COULD NOT REACH IS NEITHER -----------------------------
// A check that did not run must never look like a check that passed. A
// coordinate whose repository the refresh could not reach, or which has no
// entry in the snapshot at all, renders UNREACHABLE. A coordinate whose
// registry carries no publish timestamps (every OCI registry -- tags/list has
// no `created`) renders its activity as `unknown`, never as `active`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/report-chart-currency.ts            # stdout
//   bun src/Core.TypeScript/hygiene/report-chart-currency.ts --write    # regenerate the committed report
//   bun src/Core.TypeScript/hygiene/report-chart-currency.ts --check    # is the committed report stale?
//
// Exit codes: 0 clean (including "everything is behind"), 1 only for --check
// drift, 2 usage or IO.

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import semver from "semver";

import {
  extractTree,
  readRoster,
  rosterKey,
  ROSTER_FILENAME,
  type ChartCoordinate,
  type Extraction,
  type Roster,
  type RosterEntry,
} from "./audit-chart-target-revisions.ts";
import { DATES_FILENAME, readChartDates, type ChartDates, type ChartDatesEntry } from "./chart-publish-dates.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const REPORT_RELATIVE_PATH = "docs/CHART-CURRENCY.md";
const WRITE_COMMAND = "bun src/Core.TypeScript/hygiene/report-chart-currency.ts --write";
const REFRESH_COMMAND = "bun src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts --refresh";

/**
 * Days of upstream silence before the report stops calling a repository active.
 *
 * These are REPORTING BUCKETS, not a policy, and they are deliberately coarse:
 * the number of days is printed beside the label on every row, so a reader who
 * disagrees with the boundary can see the underlying figure and draw their own.
 * 180 days is roughly two quarters -- long enough that a maintained chart with a
 * slow release cadence is not slandered. 365 is the point at which "they have
 * not shipped anything in a year" is a fact worth acting on by itself; `minio`,
 * the case that motivated the split, sits at ~596 days.
 */
export const QUIET_AFTER_DAYS = 180;
export const DORMANT_AFTER_DAYS = 365;

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/**
 * How big a step the bump is -- ITS OWN COLUMN, never folded into "behind".
 *
 * A patch bump and a major bump are not the same decision and a single number
 * of releases cannot tell them apart: 5 patches is an afternoon, 1 major is a
 * values-schema migration. `minor-0x` exists because a 0.x minor is a major by
 * semver's own convention (semver.org §4: anything may change at any time
 * below 1.0.0), and nine pins in this tree are on a 0.x line.
 */
export type BumpClass = "none" | "patch" | "minor" | "minor-0x" | "major" | "unknown";

/** What upstream's publishing record says, as a fact separate from the gap. */
export type UpstreamActivity = "active" | "quiet" | "dormant" | "unknown" | "unreachable";

export type Verdict =
  | "UNREACHABLE"
  | "PIN-UNPUBLISHED"
  | "PIN-UNPARSEABLE"
  | "DORMANT"
  | "BEHIND-MAJOR"
  | "BEHIND"
  | "CURRENT";

export interface CurrencyRow {
  readonly app: string;
  readonly chart: string;
  readonly repoURL: string;
  readonly manifest: string;
  readonly pinned: string;
  /** Verbatim upstream `created` for the pinned version; "" when unknown. */
  readonly pinnedPublishedAt: string;
  /** Newest published STABLE version; "" when nothing is known. */
  readonly newestStable: string;
  readonly newestPublishedAt: string;
  /** Published stable versions strictly greater than the pin; null when uncomputable. */
  readonly behind: number | null;
  readonly bump: BumpClass;
  readonly activity: UpstreamActivity;
  /** Days from upstream's newest publish to the snapshot instant; null when unknown. */
  readonly silentDays: number | null;
  readonly verdict: Verdict;
  /** Non-semver version strings upstream published, excluded from ordering. */
  readonly unorderableVersions: number;
  readonly note: string;
}

/** Sort order: worst first, then stable tiebreaks so the file is reproducible. */
const VERDICT_SEVERITY: Readonly<Record<Verdict, number>> = {
  UNREACHABLE: 0,
  "PIN-UNPUBLISHED": 1,
  "PIN-UNPARSEABLE": 2,
  DORMANT: 3,
  "BEHIND-MAJOR": 4,
  BEHIND: 5,
  CURRENT: 6,
};

function stableVersions(versions: readonly string[]): readonly string[] {
  return versions.filter((v) => {
    const parsed = semver.valid(v, { loose: true });
    if (parsed === null) return false;
    return (semver.prerelease(parsed, { loose: true }) ?? []).length === 0;
  });
}

/**
 * Newest published stable version, by semver.
 *
 * Pre-releases are excluded from "newest" AND from the behind count, because a
 * pin sitting behind a release candidate is not behind anything an operator
 * would deploy. This matches the one-off survey the recurring report replaces
 * (docs/research/2026-08-21-every-remote-helm-chart-pin-surveyed-*), so the two
 * are comparable rather than quietly different.
 */
export function newestStableVersion(versions: readonly string[]): string {
  let best = "";
  for (const candidate of stableVersions(versions)) {
    if (best === "" || semver.gt(candidate, best, { loose: true })) best = candidate;
  }
  return best;
}

/** Published stable versions strictly greater than the pin. */
export function countBehind(pinned: string, versions: readonly string[]): number | null {
  if (semver.valid(pinned, { loose: true }) === null) return null;
  return stableVersions(versions).filter((v) => semver.gt(v, pinned, { loose: true })).length;
}

/** Which compatibility boundary the bump crosses, if any. */
export function classifyBump(pinned: string, newest: string): BumpClass {
  const from = semver.valid(pinned, { loose: true });
  const to = semver.valid(newest, { loose: true });
  if (from === null || to === null) return "unknown";
  if (semver.gte(from, to, { loose: true })) return "none";
  if (semver.major(from) !== semver.major(to)) return "major";
  if (semver.minor(from) !== semver.minor(to)) return semver.major(to) === 0 ? "minor-0x" : "minor";
  return "patch";
}

/** Whole days between two instants; null when either side is missing or unparseable. */
export function daysBetween(fromIso: string, toIso: string): number | null {
  if (fromIso === "" || toIso === "") return null;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86_400_000);
}

export function classifyActivity(silentDays: number | null): UpstreamActivity {
  if (silentDays === null) return "unknown";
  if (silentDays >= DORMANT_AFTER_DAYS) return "dormant";
  if (silentDays >= QUIET_AFTER_DAYS) return "quiet";
  return "active";
}

/**
 * One coordinate's currency, from the two snapshots and nothing else.
 *
 * `roster` may be undefined (no entry at all) and `dates` may be undefined (no
 * dates collected) INDEPENDENTLY, and each absence has its own rendering. That
 * is the whole point of the function: the three states -- known, unknown, and
 * unreachable -- must not collapse into two anywhere on the path to the table.
 */
export function computeRow(
  coordinate: ChartCoordinate,
  entry: RosterEntry | undefined,
  dates: ChartDatesEntry | undefined,
): CurrencyRow {
  const base = {
    app: coordinate.appName,
    chart: coordinate.chart,
    repoURL: coordinate.repoURL,
    manifest: coordinate.manifest,
    pinned: coordinate.targetRevision,
  };

  if (entry === undefined) {
    return {
      ...base,
      pinnedPublishedAt: "",
      newestStable: "",
      newestPublishedAt: "",
      behind: null,
      bump: "unknown",
      activity: "unreachable",
      silentDays: null,
      verdict: "UNREACHABLE",
      unorderableVersions: 0,
      note:
        "no entry in " +
        ROSTER_FILENAME +
        " -- nothing offline knows what upstream publishes. `" +
        REFRESH_COMMAND +
        "`",
    };
  }

  if ((entry.unreachable ?? "") !== "" || entry.versions.length === 0) {
    return {
      ...base,
      pinnedPublishedAt: "",
      newestStable: "",
      newestPublishedAt: "",
      behind: null,
      bump: "unknown",
      activity: "unreachable",
      silentDays: null,
      verdict: "UNREACHABLE",
      unorderableVersions: 0,
      note: "repository unreachable at last refresh: " + (entry.unreachable ?? "upstream listed zero versions"),
    };
  }

  const created = dates?.created ?? {};
  const newestStable = newestStableVersion(entry.versions);
  const newestPublishedAt = created[newestStable] ?? "";
  const pinnedPublishedAt = created[coordinate.targetRevision] ?? "";
  const silentDays = daysBetween(newestPublishedAt, entry.fetchedAt);
  const activity = classifyActivity(silentDays);
  const behind = countBehind(coordinate.targetRevision, entry.versions);
  const bump = classifyBump(coordinate.targetRevision, newestStable);
  const unorderableVersions = entry.versions.length - stableVersions(entry.versions).length;

  const pinPublished = entry.versions.includes(coordinate.targetRevision);
  const noteParts: string[] = [];
  if (dates === undefined) {
    noteParts.push("no publish dates collected for this coordinate (" + DATES_FILENAME + " has no entry)");
  } else if (dates.source === "unavailable") {
    noteParts.push(dates.unavailable ?? "publish dates unavailable");
  }

  let verdict: Verdict;
  if (semver.valid(coordinate.targetRevision, { loose: true }) === null) {
    verdict = "PIN-UNPARSEABLE";
    noteParts.push("pin is not a plain semver version, so no gap can be counted from it");
  } else if (!pinPublished) {
    verdict = "PIN-UNPUBLISHED";
    noteParts.push("upstream never published this exact version -- see audit-chart-target-revisions.ts");
  } else if (behind !== null && behind > 0) {
    verdict = bump === "major" ? "BEHIND-MAJOR" : "BEHIND";
  } else if (activity === "dormant") {
    verdict = "DORMANT";
    noteParts.push("at the newest published version ONLY because upstream stopped publishing");
  } else {
    verdict = "CURRENT";
  }

  return {
    ...base,
    pinnedPublishedAt,
    newestStable,
    newestPublishedAt,
    behind,
    bump,
    activity,
    silentDays,
    verdict,
    unorderableVersions,
    note: noteParts.join("; "),
  };
}

export function computeRows(extraction: Extraction, roster: Roster, dates: ChartDates): readonly CurrencyRow[] {
  const rows = extraction.coordinates.map((coordinate) => {
    const key = rosterKey(coordinate.repoURL, coordinate.chart);
    return computeRow(coordinate, roster.entries[key], dates.entries[key]);
  });
  return [...rows].sort((a, b) => {
    const severity = VERDICT_SEVERITY[a.verdict] - VERDICT_SEVERITY[b.verdict];
    if (severity !== 0) return severity;
    const gap = (b.behind ?? -1) - (a.behind ?? -1);
    if (gap !== 0) return gap;
    if (a.app !== b.app) return a.app < b.app ? -1 : 1;
    return a.chart < b.chart ? -1 : a.chart > b.chart ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** `2025-01-02T09:12:34.123Z` -> `2025-01-02`; anything unparseable -> `?`. */
function day(iso: string): string {
  if (iso === "") return "?";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match?.[1] ?? "?";
}

function activityCell(row: CurrencyRow): string {
  switch (row.activity) {
    case "unreachable":
      return "UNREACHABLE";
    case "unknown":
      return "unknown";
    case "dormant":
      return "**DORMANT** " + String(row.silentDays) + "d";
    case "quiet":
      return "quiet " + String(row.silentDays) + "d";
    case "active":
      return "active " + String(row.silentDays) + "d";
  }
}

function bumpCell(bump: BumpClass): string {
  switch (bump) {
    case "major":
      return "**MAJOR**";
    case "minor-0x":
      return "minor (0.x)";
    case "none":
      return "--";
    case "unknown":
      return "?";
    default:
      return bump;
  }
}

function countOf(rows: readonly CurrencyRow[], predicate: (row: CurrencyRow) => boolean): string {
  return String(rows.filter(predicate).length);
}

/**
 * The whole report as markdown, a pure function of its inputs.
 *
 * NO CLOCK IS READ HERE, and that is load-bearing rather than stylistic. The
 * committed file must be byte-identical when nothing upstream changed, or a
 * weekly job dirties the tree forever and the diff stops meaning anything. Ages
 * are therefore measured against the SNAPSHOT INSTANT (`fetchedAt`), not
 * against now -- which is also the more honest statement: "as of the last
 * refresh, upstream had published nothing for 596 days".
 */
export function renderReport(rows: readonly CurrencyRow[], gitPathApps: readonly string[], asOf: string): string {
  const lines: string[] = [];
  const push = (line = ""): void => {
    lines.push(line);
  };

  push("# Helm chart currency — how far behind every pin is, and whether upstream is still alive");
  push();
  push("<!-- GENERATED FILE. Do not hand-edit: `" + WRITE_COMMAND + "` overwrites it. -->");
  push();
  push(
    "**As of:** " +
      (asOf === "" ? "(no snapshot)" : asOf) +
      " — the instant `" +
      ROSTER_FILENAME +
      "` was last refreshed. Every age below is measured against that instant, not against " +
      "the moment you are reading this, so this file is byte-reproducible from committed data.",
  );
  push();
  push(
    "**This is a report, never a gate.** Being behind is a standing condition, not a regression: " +
      countOf(rows, (r) => (r.behind ?? 0) > 0) +
      " of " +
      String(rows.length) +
      " pins are behind upstream right now. A CI check on that would be red from birth and " +
      "learned-to-ignore within a week. The blocking question — *does this pin resolve at all?* — " +
      "is a different one and is answered on every PR by " +
      "`src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts`.",
  );
  push();
  push(
    "**Behind is not unmaintained.** A pure versions-behind metric reports the most dangerous " +
      "dependency in this tree as the healthiest one, which is exactly what happened with `minio`: " +
      "it is the only pin that is not behind, and only because upstream archived the repository. " +
      "So the gap and upstream's publishing record are two separate columns, and a chart nobody " +
      "has published in over a year reads `DORMANT`, not `CURRENT`.",
  );
  push();
  push("## Headline");
  push();
  push("| | count |");
  push("|---|---|");
  push("| chart coordinates under `full-ai-cluster/k8s/applications` | " + String(rows.length) + " |");
  push("| behind upstream | " + countOf(rows, (r) => (r.behind ?? 0) > 0) + " |");
  push("| …of those, crossing a **major** boundary | " + countOf(rows, (r) => r.bump === "major") + " |");
  push(
    "| …of those, a `0.x` minor (breaking by semver convention) | " +
      countOf(rows, (r) => r.bump === "minor-0x") +
      " |",
  );
  push("| at the newest version and upstream still active | " + countOf(rows, (r) => r.verdict === "CURRENT") + " |");
  push(
    "| **`DORMANT`** — at the newest version because upstream stopped publishing | " +
      countOf(rows, (r) => r.verdict === "DORMANT") +
      " |",
  );
  push("| upstream silent for over a year (any gap) | " + countOf(rows, (r) => r.activity === "dormant") + " |");
  push(
    "| **`UNREACHABLE`** — the refresh could not reach the repository | " +
      countOf(rows, (r) => r.verdict === "UNREACHABLE") +
      " |",
  );
  push("| pin upstream never published | " + countOf(rows, (r) => r.verdict === "PIN-UNPUBLISHED") + " |");
  push(
    "| publish dates unavailable (OCI registries carry none) | " +
      countOf(rows, (r) => r.activity === "unknown") +
      " |",
  );
  push();
  push("## Every remote chart pin");
  push();
  push("| verdict | app | chart | pinned | pin published | newest stable | published | behind | bump | upstream |");
  push("|---|---|---|---|---|---|---|---|---|---|");
  for (const row of rows) {
    push(
      "| " +
        [
          "`" + row.verdict + "`",
          "`" + row.app + "`",
          "`" + row.chart + "`",
          "`" + row.pinned + "`",
          day(row.pinnedPublishedAt),
          row.newestStable === "" ? "?" : "`" + row.newestStable + "`",
          day(row.newestPublishedAt),
          row.behind === null ? "?" : String(row.behind),
          bumpCell(row.bump),
          activityCell(row),
        ].join(" | ") +
        " |",
    );
  }
  push();

  const noted = rows.filter((row) => row.note !== "");
  if (noted.length > 0) {
    push("## Rows that carry a caveat");
    push();
    for (const row of noted) {
      push("- **`" + row.app + "` / `" + row.chart + "`** (`" + row.manifest + "`) — " + row.note);
    }
    push();
  }

  push("## Reading the columns");
  push();
  push(
    "- **behind** — published **stable** versions strictly greater than the pin. Pre-releases are excluded from the count and from *newest stable*, because a pin sitting behind a release candidate is not behind anything an operator would deploy.",
  );
  push(
    "- **bump** — the compatibility boundary the newest version sits across. `**MAJOR**` and `patch` are not the same decision and deliberately do not share a column with the release count. `minor (0.x)` is called out separately because below `1.0.0` semver permits anything to change in a minor.",
  );
  push(
    "- **upstream** — days from upstream's most recent publish to the snapshot instant. `active` < " +
      String(QUIET_AFTER_DAYS) +
      "d, `quiet` " +
      String(QUIET_AFTER_DAYS) +
      "–" +
      String(DORMANT_AFTER_DAYS) +
      "d, `**DORMANT**` ≥ " +
      String(DORMANT_AFTER_DAYS) +
      "d. The raw day count is printed beside the label so a reader who disagrees with the boundary can see the figure it came from.",
  );
  push(
    "- **`unknown`** — dates were never collected for that coordinate. OCI registries are the standing case: `/v2/<repo>/tags/list` returns tags with no timestamps, and reading one would cost a manifest fetch per tag. Unknown never renders as `active`.",
  );
  push(
    "- **`UNREACHABLE`** — the refresh could not reach the repository, so nothing here knows what upstream publishes. A check that did not run must never look like a check that passed.",
  );
  push();
  push("## Scope, and where it stops");
  push();
  push(
    "Every `spec.source` / `spec.sources[]` naming a remote chart under `full-ai-cluster/k8s/applications/**`, walked recursively. Deliberately out of scope, by name:",
  );
  push();
  push(
    "- **git-path sources** — " +
      (gitPathApps.length === 0 ? "none" : gitPathApps.map((a) => "`" + a + "`").join(", ")) +
      ". These source a directory out of this repository and carry no chart version to be behind.",
  );
  push(
    "- **`full-ai-cluster/k8s/bootstrap/`** — the app-of-apps root and the bootstrap chart pins. The resolvability audit excludes them for the same reason and this report inherits its coordinate set unchanged, so the two always describe the same tree.",
  );
  push();
  push("## How to regenerate, and what refreshes the data");
  push();
  push("```bash");
  push("# 1. Re-read every upstream index (network, weekly, chart-version-refresh.yml).");
  push("#    Writes BOTH snapshots from one pass -- versions and publish dates.");
  push(REFRESH_COMMAND);
  push();
  push("# 2. Re-render this file from the committed snapshots (no network).");
  push(WRITE_COMMAND);
  push("```");
  push();
  push(
    "Data: `src/Core.TypeScript/hygiene/" +
      ROSTER_FILENAME +
      "` · `src/Core.TypeScript/hygiene/" +
      DATES_FILENAME +
      "`.",
  );
  push(
    "Anchor (Beacon): this is dependency **currency** — the question `npm outdated` / `cargo outdated` / Dependabot answer for package manifests, and which ArgoCD answers for nothing, since an `Application` has no lockfile and no upgrade notion at all.",
  );
  push();
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export interface BuiltReport {
  readonly markdown: string;
  readonly rows: readonly CurrencyRow[];
}

export function buildReport(repoRoot = REPO_ROOT): BuiltReport {
  const extraction = extractTree(repoRoot);
  const roster = readRoster();
  const dates = readChartDates();
  const rows = computeRows(extraction, roster, dates);
  // The snapshot instant every age is measured against: the OLDEST fetchedAt in
  // play, so the report never claims data fresher than its stalest input.
  let asOf = "";
  for (const entry of Object.values(roster.entries)) {
    if (asOf === "" || entry.fetchedAt < asOf) asOf = entry.fetchedAt;
  }
  const gitPathApps = [...new Set(extraction.gitPaths.map((g) => g.appName))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return { markdown: renderReport(rows, gitPathApps, asOf), rows };
}

function main(): void {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--write" && a !== "--check");
  if (unknown.length > 0 || (args.includes("--write") && args.includes("--check"))) {
    process.stderr.write("usage: report-chart-currency.ts [--write | --check]\n");
    process.exit(2);
  }

  const { markdown, rows } = buildReport();
  const path = join(REPO_ROOT, REPORT_RELATIVE_PATH);

  if (args.includes("--write")) {
    // Read-then-interpret, never exists-then-read: an absent report is the
    // first-run case, and testing for it separately opens a window between the
    // test and the use.
    let before: string;
    try {
      before = readFileSync(path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      before = "";
    }
    if (before === markdown) {
      process.stdout.write(
        REPORT_RELATIVE_PATH + " already current -- left untouched (" + String(rows.length) + " coordinates).\n",
      );
      return;
    }
    writeFileSync(path, markdown);
    process.stdout.write(
      "wrote " + REPORT_RELATIVE_PATH + " (" + String(rows.length) + " coordinates) -- commit the diff.\n",
    );
    return;
  }

  if (args.includes("--check")) {
    let committed: string;
    try {
      committed = readFileSync(path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      committed = "";
    }
    if (committed === markdown) {
      process.stdout.write(
        REPORT_RELATIVE_PATH + " matches the committed snapshots (" + String(rows.length) + " coordinates).\n",
      );
      return;
    }
    // The ONLY non-chart-related failure this file has. It does not fire
    // because a chart is out of date -- it fires because the generated file no
    // longer matches what the committed data produces, which is a stale
    // artifact and is fixed by one command.
    process.stderr.write(
      REPORT_RELATIVE_PATH +
        " is STALE: it does not match what the committed snapshots render.\n" +
        "This is not a chart being out of date -- that is never an error here. Regenerate:\n  " +
        WRITE_COMMAND +
        "\n",
    );
    process.exit(1);
  }

  process.stdout.write(markdown);
}

if (import.meta.main) main();
