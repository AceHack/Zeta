#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/chart-publish-dates.ts
//
// WHEN did upstream publish each chart version? -- the second snapshot, and the
// one that separates "behind" from "abandoned".
//
// -- WHY THIS FILE EXISTS SEPARATELY FROM THE VERSION SNAPSHOT -------------
// `audit-chart-target-revisions.ts` answers "does this pin RESOLVE?" and needs
// only a list of version strings. Currency -- "how far behind is this pin, and
// is upstream still alive?" -- needs one more fact per version: the instant
// upstream published it. Those two facts come out of the SAME network read
// (a Helm `index.yaml` carries `created` on every entry), so collecting the
// dates costs no additional connection and no additional schedule. What it
// would cost is churn in `published-chart-versions.json`, a file the
// resolvability audit's whole PR-blocking lane reads and which other work is
// concurrently editing. So the dates land beside it instead of inside it.
//
// -- THE ONE THING THIS FILE MUST NEVER DO --------------------------------
// Report an absent date as a recent one. A coordinate with no entry here, or
// an entry with no date for the version asked about, is UNKNOWN and renders as
// UNKNOWN -- never as "published today", never as "active". OCI registries are
// the standing case: `/v2/<repo>/tags/list` returns tags and nothing else, so
// three coordinates in this tree have no publish dates available at all and
// say so by name rather than by omission.
//
// The consumer is `report-chart-currency.ts`; the producer is the `--refresh`
// half of `audit-chart-target-revisions.ts`, which already has the index in
// hand when it calls in here.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DATES_FILENAME = "published-chart-dates.json";
export const DATES_PATH = join(import.meta.dir, DATES_FILENAME);

/** Why a coordinate has no dates, said out loud rather than left to omission. */
export const OCI_DATES_UNAVAILABLE =
  "OCI registries expose tags, not publish timestamps: /v2/<repo>/tags/list carries no " +
  "`created` field, and reading one would cost a manifest fetch per tag. Publish dates for " +
  "this coordinate are UNAVAILABLE, which is not the same fact as `published recently`.";

export interface ChartDatesEntry {
  /**
   * `helm-index-created` -- dates came from the index's own `created` fields.
   * `unavailable` -- the protocol carries no dates, or the fetch never reached
   * upstream. `created` is then empty and `unavailable` says which.
   */
  readonly source: "helm-index-created" | "unavailable";
  readonly unavailable?: string;
  /**
   * version string -> the upstream `created` value, VERBATIM.
   *
   * Not truncated to a date and not re-serialised: this is evidence read off
   * another party's index, and a lossy transform on evidence is a thing the
   * reader cannot undo or check. The report does the truncation at render time.
   */
  readonly created: Readonly<Record<string, string>>;
}

export interface ChartDates {
  readonly note: string;
  readonly refreshCommand: string;
  readonly entries: Readonly<Record<string, ChartDatesEntry>>;
}

const NOTE =
  "Publish dates for every chart version in published-chart-versions.json, keyed the same " +
  "<repoURL>|<chart>. Collected by the SAME --refresh pass that writes the version snapshot -- " +
  "a Helm index.yaml carries `created` on every entry, so these cost no extra request. Read " +
  "offline by report-chart-currency.ts to tell `behind` apart from `abandoned`. A coordinate " +
  "absent here, or a version absent from its `created` map, is UNKNOWN and must never render " +
  "as recent.";

export const DATES_REFRESH_COMMAND = "bun src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts --refresh";

/** Canonical bytes for the snapshot: key-sorted, 2-space, one trailing newline. */
export function serializeChartDates(entries: Readonly<Record<string, ChartDatesEntry>>): string {
  const sorted: Record<string, ChartDatesEntry> = {};
  for (const key of Object.keys(entries).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const entry = entries[key];
    if (entry === undefined) continue;
    sorted[key] = entry;
  }
  const document: ChartDates = { note: NOTE, refreshCommand: DATES_REFRESH_COMMAND, entries: sorted };
  return JSON.stringify(document, null, 2) + "\n";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read the snapshot, refusing to invent one.
 *
 * ENOENT throws here on purpose. The report's whole job is to distinguish a
 * fact from the absence of a fact, and a reader that silently substitutes an
 * empty map for a missing file would make "we never collected dates" look
 * exactly like "upstream published nothing" at every call site downstream.
 */
export function readChartDates(path: string = DATES_PATH): ChartDates {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed) || !isRecord(parsed.entries)) {
    throw new Error(path + " is not a dates snapshot: expected an object with an `entries` map.");
  }
  return parsed as unknown as ChartDates;
}

/** The writer's variant: a first run legitimately has nothing to carry forward. */
export function readChartDatesOrEmpty(path: string = DATES_PATH): ChartDates {
  try {
    return readChartDates(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return { note: NOTE, refreshCommand: DATES_REFRESH_COMMAND, entries: {} };
  }
}

/**
 * Write only when something was learned, and report whether it was.
 *
 * Same discipline as the version snapshot: a refresh that rewrites an
 * identical file on every scheduled run leaves a permanent dirty tree behind
 * it, and a diff that appears every week is a diff nobody reads. There is no
 * timestamp in these bytes at all, so "changed" is simply "the dates differ".
 */
export function writeChartDatesIfChanged(
  entries: Readonly<Record<string, ChartDatesEntry>>,
  path: string = DATES_PATH,
): boolean {
  const serialized = serializeChartDates(entries);
  let before: string;
  try {
    before = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    before = "";
  }
  if (before === serialized) return false;
  writeFileSync(path, serialized);
  return true;
}
