#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts
//
// DOES EVERY ARGOCD `targetRevision` NAME A CHART VERSION UPSTREAM ACTUALLY
// PUBLISHED?
//
// -- THE DEFECT THIS EXISTS FOR, measured on main 2026-08-20 ---------------
// `full-ai-cluster/k8s/applications/oz/Application.yaml` pins
// `ziti-controller` at `targetRevision: 1.4.5`. OpenZiti never published a
// `ziti-controller` chart at 1.4.5 -- their 1.x chart line ends at 1.3.4, and
// `1.4.2` exists in that repository only as an `appVersion`, which is the
// *application's* version and not a coordinate Helm can resolve. ArgoCD cannot
// resolve the pin, so that Application can never sync. Nothing noticed,
// because `oz` is one of 26 of the 45 Applications in this tree that no CI
// lane exercises -- so nothing ever asked the upstream repository to hand over
// that chart. (workitem 081M0JVD5YG087G0R002QDFR9H, PR #13313.)
//
// A pin that cannot resolve is the purest form of this repo's organising
// refusal: a check that did not run must never look like a check that passed.
// The manifest is syntactically perfect, `kubectl apply` accepts it, the app
// appears in ArgoCD, and the chart behind it does not exist.
//
// -- WHY THE CHECK IS OFFLINE, AND WHAT THE NETWORK HALF IS FOR ------------
// The obvious implementation resolves each pin against its upstream registry
// at check time. That check is worth roughly one week: it makes every PR in
// this repository depend on twelve third-party registries being reachable, a
// flake reddens changes that touch nothing near the cluster tree, and the step
// gets deleted by whoever is on the receiving end of that. So the work is
// split by what changes at what rate (DV2.0):
//
//   OFFLINE (this file's default mode, PR-blocking).  Every coordinate in the
//   tree is resolved against `published-chart-versions.json`, a checked-in
//   snapshot of what each upstream repository publishes. Pure, hermetic,
//   deterministic, no sockets. This is what runs in the cross-verify floor.
//
//   NETWORK (`--refresh`, scheduled, NEVER PR-blocking).  Re-fetches every
//   coordinate's published version list from its registry and rewrites the
//   snapshot. Allowed to fail loudly -- a registry being down delays a roster
//   update and blocks nobody.
//
// The snapshot is therefore evidence with a date on it, not an oracle. It says
// "as of <fetchedAt>, this repository published these versions". A pin absent
// from that list is a pin nothing upstream could hand ArgoCD at that moment.
//
// -- WHY A MISSING ROSTER ENTRY IS A FINDING, NOT A SKIP -------------------
// The tempting behaviour for a coordinate the snapshot does not cover is to
// skip it. That is the defect class this file exists for, wearing the check's
// own uniform: the unchecked pin would be indistinguishable from a checked one
// in the exit code. So an uncovered coordinate FAILS, with the refresh command
// in the message. Likewise a manifest that will not parse, a source that is
// neither a chart nor a git path, and a roster entry for a coordinate the tree
// no longer contains. Every coordinate lands in exactly one bucket and the
// buckets are printed with counts, so a pass states its own scope.
//
// -- GIT-PATH SOURCES ARE RECOGNISED, NOT IGNORED -------------------------
// Eleven Applications here source a directory out of this repository rather
// than a chart out of a registry. Those have no chart version to resolve, so
// they are classified `git-path` and counted -- explicitly, by name, in the
// output. A source carrying BOTH `chart` and `path`, or NEITHER, is a finding:
// it is a coordinate this file cannot classify, and an unclassifiable
// coordinate must never be silently absent from the total.
//
// -- WHERE THIS STOPS, said out loud --------------------------------------
// The walk is `full-ai-cluster/k8s/applications/**` and nothing else. It is
// RECURSIVE, not depth-1, so `game-hosting/gmod/Application.yaml` is audited --
// the depth-1 assumption in the argocd-health harness is precisely how that
// manifest stayed invisible while failing to sync on every reconcile (see
// cluster/app-of-apps-discovery.ts). Out of scope, deliberately and by name:
// `full-ai-cluster/k8s/bootstrap/root-application.yaml`, the app-of-apps root,
// which is a git-path source into this repository and so has no chart version
// to resolve either way. Nothing else in the tree declares an Application.
//
// -- THE ACKNOWLEDGEMENT REGISTER, NOW EMPTY ------------------------------
// It held one entry, for `oz`, recorded on the day this file was written and
// retired the day after. The retirement is the register working, and the shape
// of it is worth keeping: the entry said the replacement version was "not
// mechanical" and "not drop-in for the pinned values in this manifest", and
// that turned out to be FALSE when someone measured it. `helm template` of
// 1.3.4, 2.1.2, 3.1.1 and 3.2.1 against that Application's own valuesObject
// produces the identical storage contract in all four; every key the manifest
// actually sets survives all three major lines. What was really blocking `oz`
// was a different, unrecorded defect the bad pin had been hiding -- a missing
// `clientApi.advertisedHost`, which every published version requires. So the
// acknowledgement was carrying a REASON nobody had checked, which is the failure
// mode a register is supposed to be immune to, and the register caught it in the
// end only because the pin moved and the entry went stale.
//
// The register is drift-checked in BOTH directions: an acknowledgement whose pin
// no longer exists, or whose pin has become resolvable, is itself a finding.
// That is what separates a dated acknowledgement from an allowlist -- an
// allowlist only ever grows quiet. That check is what refused this tree the
// moment the pin was corrected and the entry was left behind.
//
// Anchor (Beacon): this is dependency *resolvability* checking, the property
// `cargo`/`npm` get from a committed lockfile and Helm's `Chart.lock` gives a
// chart's own dependencies -- ArgoCD has no equivalent for an Application's
// `targetRevision`, which is why it must be audited rather than resolved.
//
// -- THE SECOND SNAPSHOT: PUBLISH DATES -----------------------------------
// `--refresh` also writes `published-chart-dates.json` (see
// chart-publish-dates.ts). Resolvability and CURRENCY are different questions
// -- a pin can resolve perfectly and be twenty-three majors behind -- and the
// currency answer needs one extra fact per version: when upstream published
// it. That fact is ALREADY in the `index.yaml` this file downloads, so it is
// recorded here rather than fetched again on a second schedule. Nothing in the
// PR-blocking path above reads it; `report-chart-currency.ts` does.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts
//   bun src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts --refresh
//
// Exit codes: 0 clean, 1 findings (or, under --refresh, roster changed / a
// fetch failed), 2 usage or IO.

import { readFileSync, readdirSync, writeFileSync, type Dirent } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseAllDocuments, parse as parseYaml } from "yaml";
import semver from "semver";
import {
  DATES_FILENAME,
  OCI_DATES_UNAVAILABLE,
  readChartDatesOrEmpty,
  writeChartDatesIfChanged,
  type ChartDatesEntry,
} from "./chart-publish-dates.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const APPLICATIONS_TREE = "full-ai-cluster/k8s/applications";
export const ROSTER_FILENAME = "published-chart-versions.json";
const ROSTER_PATH = join(import.meta.dir, ROSTER_FILENAME);

const REFRESH_COMMAND = "bun src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts --refresh";
const CURRENCY_REPORT_COMMAND = "bun src/Core.TypeScript/hygiene/report-chart-currency.ts --write";

// ---------------------------------------------------------------------------
// Coordinates extracted from the tree
// ---------------------------------------------------------------------------

/** How a source names the thing it wants, which decides how it is resolved. */
export type SourceKind = "helm-index" | "oci" | "git-path";

export interface ChartCoordinate {
  /** Manifest path relative to the repo root. */
  readonly manifest: string;
  /** `metadata.name`, so a finding names the Application an operator sees. */
  readonly appName: string;
  /** 0 for `spec.source`; the array index for `spec.sources[i]`. */
  readonly sourceIndex: number;
  readonly repoURL: string;
  readonly chart: string;
  readonly targetRevision: string;
  readonly kind: "helm-index" | "oci";
}

export interface GitPathSource {
  readonly manifest: string;
  readonly appName: string;
  readonly sourceIndex: number;
  readonly repoURL: string;
  readonly path: string;
  readonly targetRevision: string;
}

export type FindingRule =
  | "manifest-unparseable"
  | "source-unclassifiable"
  | "no-applications-found"
  | "roster-entry-missing"
  | "repository-unreachable"
  | "target-revision-unpublished"
  | "target-revision-unresolvable"
  | "roster-entry-orphaned"
  | "acknowledgement-stale";

export interface Finding {
  readonly rule: FindingRule;
  /** Manifest path, roster key, or register key -- whatever the rule is about. */
  readonly subject: string;
  readonly detail: string;
}

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

export interface RosterEntry {
  readonly repoURL: string;
  readonly chart: string;
  readonly kind: "helm-index" | "oci";
  /**
   * ISO-8601 UTC instant the version list below was recorded from upstream.
   *
   * A LOWER BOUND on freshness, not the last time it was read: `--refresh` does
   * not rewrite the file when it learned nothing, so a list confirmed
   * unchanged for months keeps the date it last differed. Said here rather than
   * left to be inferred, because the audit's own message quotes this field as
   * "published as of <fetchedAt>".
   */
  readonly fetchedAt: string;
  /**
   * Every version string the upstream repository published for this chart, in
   * the order upstream listed them. Stored WHOLE and never truncated to the
   * newest N: a truncated list would report an old-but-real pin as
   * unpublished, which is a false accusation the reader cannot distinguish
   * from a true one.
   */
  readonly versions: readonly string[];
  /**
   * Set when the refresh could not reach the repository AT ALL, carrying the
   * error verbatim; `versions` is then empty.
   *
   * This state exists because "we never looked" and "we looked and there is no
   * repository there" are different facts, and collapsing them is the defect
   * this file audits for. Two coordinates in this tree are in it today: a
   * GitHub Pages Helm repository that no longer exists, and a chart that moved
   * to OCI while the manifest still names an HTTPS index. Neither is a
   * refresh-and-retry; both are wrong coordinates.
   */
  readonly unreachable?: string;
}

export interface Roster {
  readonly note: string;
  readonly refreshCommand: string;
  readonly entries: Readonly<Record<string, RosterEntry>>;
}

/** Stable key for a (repository, chart) pair. `|` cannot occur in either half. */
export function rosterKey(repoURL: string, chart: string): string {
  return normalizeRepoUrl(repoURL) + "|" + chart;
}

/**
 * Trailing-slash-insensitive repository identity.
 *
 * `https://charts.jetstack.io` and `https://charts.jetstack.io/` are the same
 * repository and both spellings appear in this tree. Keying on the raw string
 * would give one repository two roster entries, and the second one would go
 * uncovered -- surfacing as a missing-entry finding whose cause is invisible.
 */
export function normalizeRepoUrl(repoURL: string): string {
  return repoURL.replace(/\/+$/, "");
}

/**
 * Which resolution protocol a repository speaks.
 *
 * A classic Helm repository is an HTTP(S) URL serving `index.yaml`. An OCI
 * registry has no index at all -- charts are artifacts and versions are tags,
 * reachable only through the registry API. ArgoCD accepts an OCI repository
 * either with an explicit `oci://` scheme or as a bare host/path, and BOTH
 * spellings are in this tree, so scheme alone cannot decide it.
 */
export function classifyRepoUrl(repoURL: string): "helm-index" | "oci" {
  const trimmed = repoURL.trim();
  if (trimmed.startsWith("oci://")) return "oci";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return "helm-index";
  return "oci";
}

// ---------------------------------------------------------------------------
// Extraction (pure over text)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringAt(record: Record<string, unknown> | undefined, key: string): string {
  const value = record?.[key];
  if (typeof value === "string") return value;
  // A bare `targetRevision: 1.4` parses as a number, and a version pin that
  // YAML happened to read as a float is still a pin an operator wrote.
  if (typeof value === "number") return String(value);
  return "";
}

export interface Extraction {
  readonly coordinates: readonly ChartCoordinate[];
  readonly gitPaths: readonly GitPathSource[];
  readonly findings: readonly Finding[];
}

const EMPTY_EXTRACTION: Extraction = { coordinates: [], gitPaths: [], findings: [] };

/**
 * Pull every `spec.source` / `spec.sources[]` out of one manifest's text.
 *
 * Pure over a string so this file's own refusals are falsifiable without a
 * filesystem -- an audit whose failure path nobody can produce is the defect
 * it is auditing for.
 */
export function extractSources(manifest: string, text: string): Extraction {
  let docs: unknown[];
  try {
    docs = parseAllDocuments(text).map((doc) => {
      if (doc.errors.length > 0) throw new Error(doc.errors[0]?.message ?? "YAML error");
      return doc.toJS({ maxAliasCount: -1 }) as unknown;
    });
  } catch (error) {
    return {
      ...EMPTY_EXTRACTION,
      findings: [
        {
          rule: "manifest-unparseable",
          subject: manifest,
          detail:
            "YAML would not parse (" +
            (error instanceof Error ? error.message : String(error)) +
            "). An unreadable manifest is NOT a skip: nothing here can say whether its " +
            "targetRevision resolves, and an unchecked pin must not share an exit code with " +
            "a checked one.",
        },
      ],
    };
  }

  const coordinates: ChartCoordinate[] = [];
  const gitPaths: GitPathSource[] = [];
  const findings: Finding[] = [];

  for (const doc of docs) {
    if (!isRecord(doc)) continue;
    if (stringAt(doc, "kind") !== "Application") continue;
    if (!stringAt(doc, "apiVersion").startsWith("argoproj.io/")) continue;

    const appName = nameOf(doc);
    const spec = isRecord(doc.spec) ? doc.spec : undefined;
    const sources: unknown[] = [];
    if (spec !== undefined && isRecord(spec.source)) sources.push(spec.source);
    if (spec !== undefined && Array.isArray(spec.sources)) sources.push(...spec.sources);

    if (sources.length === 0) {
      findings.push({
        rule: "source-unclassifiable",
        subject: manifest,
        detail:
          "Application `" +
          appName +
          "` declares neither spec.source nor spec.sources. Whatever it deploys, it is not " +
          "reachable from here -- and a coordinate this file cannot see is a coordinate it " +
          "must not silently omit from its totals.",
      });
      continue;
    }

    sources.forEach((raw, index) => {
      if (!isRecord(raw)) {
        findings.push({
          rule: "source-unclassifiable",
          subject: manifest,
          detail: "Application `" + appName + "` source[" + String(index) + "] is not a mapping.",
        });
        return;
      }
      const repoURL = stringAt(raw, "repoURL");
      const chart = stringAt(raw, "chart");
      const path = stringAt(raw, "path");
      const targetRevision = stringAt(raw, "targetRevision");

      if (repoURL === "") {
        findings.push({
          rule: "source-unclassifiable",
          subject: manifest,
          detail: "Application `" + appName + "` source[" + String(index) + "] has no repoURL.",
        });
        return;
      }
      if (chart !== "" && path !== "") {
        findings.push({
          rule: "source-unclassifiable",
          subject: manifest,
          detail:
            "Application `" +
            appName +
            "` source[" +
            String(index) +
            "] sets BOTH `chart` (" +
            chart +
            ") and `path` (" +
            path +
            "). ArgoCD treats those as different source types; this file will not guess " +
            "which one the pin belongs to.",
        });
        return;
      }
      if (chart === "" && path === "") {
        findings.push({
          rule: "source-unclassifiable",
          subject: manifest,
          detail:
            "Application `" +
            appName +
            "` source[" +
            String(index) +
            "] (" +
            repoURL +
            ") sets neither `chart` nor `path`, so it is neither a chart coordinate to " +
            "resolve nor a git directory to skip. Unclassifiable is a finding, never a skip.",
        });
        return;
      }
      if (targetRevision === "") {
        findings.push({
          rule: "source-unclassifiable",
          subject: manifest,
          detail:
            "Application `" +
            appName +
            "` source[" +
            String(index) +
            "] has no targetRevision. ArgoCD defaults it to HEAD/latest, which is an " +
            "unpinned deploy -- and an unpinned deploy is not something this audit will " +
            "quietly call resolvable.",
        });
        return;
      }

      if (path !== "") {
        gitPaths.push({ manifest, appName, sourceIndex: index, repoURL, path, targetRevision });
        return;
      }
      coordinates.push({
        manifest,
        appName,
        sourceIndex: index,
        repoURL,
        chart,
        targetRevision,
        kind: classifyRepoUrl(repoURL),
      });
    });
  }

  return { coordinates, gitPaths, findings };
}

function nameOf(doc: Record<string, unknown>): string {
  const metadata = isRecord(doc.metadata) ? doc.metadata : undefined;
  const name = stringAt(metadata, "name");
  return name === "" ? "(unnamed)" : name;
}

// ---------------------------------------------------------------------------
// Resolution against the roster
// ---------------------------------------------------------------------------

export type Resolution =
  | { readonly outcome: "exact" }
  | { readonly outcome: "range"; readonly matched: string }
  | { readonly outcome: "unpublished" }
  | { readonly outcome: "unresolvable" };

/**
 * Can upstream hand ArgoCD this pin?
 *
 * Exact string match first, because that is what nearly every pin here is and
 * it is the only test that needs no semver opinion (`v1.16.2` and `v0.15.0`
 * are real published version strings in this tree, and only exact matching
 * gets those right without argument).
 *
 * Failing that, ArgoCD also accepts a semver RANGE in `targetRevision`, so a
 * range that some published version satisfies is resolvable. A pin that is
 * neither an exact version nor a parseable range is `unresolvable` -- reported
 * separately from `unpublished`, because "upstream never shipped this" and "we
 * cannot tell what this asks for" are different facts about the world.
 */
export function resolveTargetRevision(targetRevision: string, published: readonly string[]): Resolution {
  if (published.includes(targetRevision)) return { outcome: "exact" };

  const range = semver.validRange(targetRevision, { loose: true });
  if (range === null) return { outcome: "unresolvable" };

  // Report the version Helm would actually pick -- the HIGHEST satisfying one,
  // not the first one the index happened to list. A range finding that names
  // some arbitrary old version reads as a different fact than it is.
  let best: string | null = null;
  for (const candidate of published) {
    const parsed = semver.valid(candidate, { loose: true });
    if (parsed === null) continue;
    if (!semver.satisfies(parsed, range, { loose: true, includePrerelease: true })) continue;
    if (best === null || semver.gt(parsed, semver.valid(best, { loose: true }) ?? parsed, { loose: true })) {
      best = candidate;
    }
  }
  if (best !== null) return { outcome: "range", matched: best };
  return { outcome: "unpublished" };
}

// ---------------------------------------------------------------------------
// The acknowledgement register
// ---------------------------------------------------------------------------

export interface Acknowledgement {
  /** The work-item that owns choosing the replacement. Mandatory. */
  readonly workitem: string;
  /** ISO date the acknowledgement was recorded. Mandatory. */
  readonly recordedOn: string;
  /** Why it is not simply fixed here. Mandatory. */
  readonly reason: string;
}

/** `<manifest>|<chart>|<targetRevision>` -- pin-exact, so any edit invalidates it. */
export function acknowledgementKey(coordinate: {
  readonly manifest: string;
  readonly chart: string;
  readonly targetRevision: string;
}): string {
  return coordinate.manifest + "|" + coordinate.chart + "|" + coordinate.targetRevision;
}

/**
 * Pins known to be unresolvable, recorded rather than suppressed.
 *
 * An entry does NOT make the finding go away -- every run prints it. What it
 * does is keep the exit code at 0 for a defect already filed against a human
 * decision, so the check can land on a tree that contains it. The key is
 * pin-exact: change the version, and the acknowledgement stops applying and
 * the pin is audited afresh.
 */
export const ACKNOWLEDGED_UNPUBLISHED: ReadonlyMap<string, Acknowledgement> = new Map([
  // EMPTY, and empty is the target state rather than a suspicious one. The only
  // entry this register has ever held -- `oz@1.4.5`, workitem
  // 081M0JVD5YG087G0R002QDFR9H -- was retired on 2026-08-21 when the pin was
  // corrected to ziti-controller 3.1.1 and the app was rendered for real. It was
  // not re-keyed to `oz@3.1.1`: re-keying preserves a "this pin does not resolve"
  // claim that has stopped being true, which is the one thing a dated
  // acknowledgement is supposed to make impossible.
  //
  // Adding an entry means a pin no registry serves, which means an Application
  // that cannot sync. Give it a workitem, a date, and a reason that has been
  // CHECKED -- the retired entry's reason ("not drop-in for the pinned values")
  // was never checked and was wrong.
]);

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

export interface AuditReport {
  readonly findings: readonly Finding[];
  /** Findings covered by a live acknowledgement -- printed, not fatal. */
  readonly acknowledged: readonly Finding[];
  readonly resolvedCount: number;
  readonly gitPathCount: number;
  readonly coordinateCount: number;
  readonly oldestFetchedAt: string;
}

export function auditCoordinates(
  extraction: Extraction,
  roster: Roster,
  acknowledgements: ReadonlyMap<string, Acknowledgement> = ACKNOWLEDGED_UNPUBLISHED,
): AuditReport {
  const findings: Finding[] = [...extraction.findings];
  const acknowledged: Finding[] = [];
  const seenKeys = new Set<string>();
  const usedAcknowledgements = new Set<string>();
  let resolvedCount = 0;
  let oldestFetchedAt = "";

  if (extraction.coordinates.length === 0 && extraction.gitPaths.length === 0) {
    findings.push({
      rule: "no-applications-found",
      subject: APPLICATIONS_TREE,
      detail:
        "no ArgoCD Application sources were found at all. The roster of coordinates is " +
        "derived from the tree, so an empty result means the walk is looking in the wrong " +
        "place -- and an audit that finds nothing to audit must not report success.",
    });
  }

  /**
   * Route one coordinate's finding to `findings` or to `acknowledged`.
   *
   * One place, so the two rules that can be acknowledged cannot drift apart in
   * whether they honour the register -- the drift-check below depends on
   * `usedAcknowledgements` being marked on every acknowledged path, and a
   * second copy of this logic is exactly where that stops being true.
   */
  const emit = (coordinate: ChartCoordinate, finding: Finding): void => {
    const registerKey = acknowledgementKey(coordinate);
    const ack = acknowledgements.get(registerKey);
    if (ack === undefined) {
      findings.push(finding);
      return;
    }
    usedAcknowledgements.add(registerKey);
    acknowledged.push({
      ...finding,
      detail: finding.detail + "\n      ACKNOWLEDGED " + ack.recordedOn + " (" + ack.workitem + "): " + ack.reason,
    });
  };

  for (const coordinate of extraction.coordinates) {
    const key = rosterKey(coordinate.repoURL, coordinate.chart);
    seenKeys.add(key);
    const entry = roster.entries[key];
    const where = coordinate.manifest + " (" + coordinate.appName + ")";

    if (entry === undefined) {
      findings.push({
        rule: "roster-entry-missing",
        subject: where,
        detail:
          "chart `" +
          coordinate.chart +
          "` from `" +
          coordinate.repoURL +
          "` has no entry in " +
          ROSTER_FILENAME +
          ", so nothing offline can say whether `" +
          coordinate.targetRevision +
          "` resolves. This is a FINDING and not a skip on purpose. Refresh the snapshot " +
          "and commit it:\n      " +
          REFRESH_COMMAND,
      });
      continue;
    }

    if (oldestFetchedAt === "" || entry.fetchedAt < oldestFetchedAt) oldestFetchedAt = entry.fetchedAt;

    if (entry.unreachable !== undefined && entry.unreachable !== "") {
      emit(coordinate, {
        rule: "repository-unreachable",
        subject: where,
        detail:
          "`" +
          coordinate.repoURL +
          "` is not a resolvable chart repository: " +
          entry.unreachable +
          " (observed " +
          entry.fetchedAt +
          "). No version of `" +
          coordinate.chart +
          "` can be fetched from that coordinate, so the pin `" +
          coordinate.targetRevision +
          "` is unresolvable regardless of whether upstream published it somewhere else.",
      });
      continue;
    }

    const resolution = resolveTargetRevision(coordinate.targetRevision, entry.versions);
    if (resolution.outcome === "exact" || resolution.outcome === "range") {
      resolvedCount++;
      continue;
    }

    const detail =
      resolution.outcome === "unresolvable"
        ? "targetRevision `" +
          coordinate.targetRevision +
          "` for chart `" +
          coordinate.chart +
          "` is neither one of the " +
          String(entry.versions.length) +
          " versions `" +
          coordinate.repoURL +
          "` published as of " +
          entry.fetchedAt +
          " nor a semver range anything could satisfy. ArgoCD has nothing to resolve it to."
        : "targetRevision `" +
          coordinate.targetRevision +
          "` for chart `" +
          coordinate.chart +
          "` is NOT among the " +
          String(entry.versions.length) +
          " versions `" +
          coordinate.repoURL +
          "` published as of " +
          entry.fetchedAt +
          ". ArgoCD cannot resolve this pin, so this Application can never sync. Newest " +
          "published: " +
          newestPublished(entry.versions).join(", ") +
          ".";

    emit(coordinate, {
      rule: resolution.outcome === "unresolvable" ? "target-revision-unresolvable" : "target-revision-unpublished",
      subject: where,
      detail,
    });
  }

  // Drift, both directions. A roster entry the tree no longer references is a
  // snapshot of something nobody deploys; an acknowledgement whose pin is gone
  // or has become resolvable is a mute button left switched on.
  for (const key of Object.keys(roster.entries)) {
    if (seenKeys.has(key)) continue;
    findings.push({
      rule: "roster-entry-orphaned",
      subject: key,
      detail:
        "the snapshot carries this coordinate but no Application under " +
        APPLICATIONS_TREE +
        " references it. Either the pin moved and the snapshot did not, or the entry is " +
        "left over. Re-run `" +
        REFRESH_COMMAND +
        "` to drop it.",
    });
  }

  for (const [key, ack] of acknowledgements) {
    if (usedAcknowledgements.has(key)) continue;
    findings.push({
      rule: "acknowledgement-stale",
      subject: key,
      detail:
        "recorded " +
        ack.recordedOn +
        " (" +
        ack.workitem +
        ") but this run produced no finding for it: either the pin is gone or it now " +
        "resolves. Delete the entry. An acknowledgement that outlives its defect is an " +
        "allowlist, which is the thing the register exists instead of.",
    });
  }

  return {
    findings,
    acknowledged,
    resolvedCount,
    gitPathCount: extraction.gitPaths.length,
    coordinateCount: extraction.coordinates.length,
    oldestFetchedAt,
  };
}

/** Newest few published versions, by semver where possible, for the message. */
function newestPublished(versions: readonly string[]): readonly string[] {
  const sortable = versions.filter((v) => semver.valid(v, { loose: true }) !== null);
  if (sortable.length === 0) return versions.slice(0, 3);
  return [...sortable].sort((a, b) => semver.rcompare(a, b, { loose: true })).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Filesystem walk
// ---------------------------------------------------------------------------

function listYamlFiles(dir: string): readonly string[] {
  // Same check-then-use class as the roster read below: `readdirSync` on a
  // missing directory throws ENOENT, so ask it directly instead of testing
  // existence first and racing the answer.
  let entries: readonly Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listYamlFiles(path);
    if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) return [path];
    return [];
  });
}

/** Cheap pre-filter so multi-megabyte vendored operator manifests are not parsed. */
const APPLICATION_KIND_LINE = /(^|\n)kind:\s*["']?Application["']?\s*(#[^\n]*)?(\n|$)/;

export function extractTree(repoRoot = REPO_ROOT): Extraction {
  const appsDir = resolve(repoRoot, APPLICATIONS_TREE);
  const coordinates: ChartCoordinate[] = [];
  const gitPaths: GitPathSource[] = [];
  const findings: Finding[] = [];
  for (const file of listYamlFiles(appsDir)) {
    const text = readFileSync(file, "utf8");
    if (!APPLICATION_KIND_LINE.test(text)) continue;
    const one = extractSources(relative(repoRoot, file), text);
    coordinates.push(...one.coordinates);
    gitPaths.push(...one.gitPaths);
    findings.push(...one.findings);
  }
  return { coordinates, gitPaths, findings };
}

export function readRoster(path = ROSTER_PATH): Roster {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed) || !isRecord(parsed.entries)) {
    throw new Error(path + " is not a roster: expected an object with an `entries` map.");
  }
  return parsed as unknown as Roster;
}

// ---------------------------------------------------------------------------
// The network half -- --refresh only, never on a PR-blocking path
// ---------------------------------------------------------------------------

/**
 * A registry's `WWW-Authenticate: Bearer realm=..,service=..,scope=..`.
 *
 * Parsed rather than assumed. Guessing `https://<host>/token?service=<host>`
 * happens to work for ghcr.io and is WRONG for code.forgejo.org, whose realm is
 * `/v2/token` and whose service is the literal `container_registry` -- so the
 * guess produced a 401 that read exactly like "this chart does not exist". The
 * challenge is the registry telling you where to ask; RFC 7235 / the OCI
 * distribution spec both say to read it.
 */
export function parseAuthChallenge(header: string): Readonly<Record<string, string>> {
  const fields: Record<string, string> = {};
  for (const match of header.matchAll(/([A-Za-z]+)="([^"]*)"/g)) {
    const [, key, value] = match;
    if (key !== undefined && value !== undefined) fields[key.toLowerCase()] = value;
  }
  return fields;
}

/** `oci://ghcr.io/a/b` and `ghcr.io/a/b` both -> `{host, repository}`. */
export function ociTarget(repoURL: string, chart: string): { host: string; repository: string } {
  const withoutScheme = normalizeRepoUrl(repoURL).replace(/^oci:\/\//, "");
  const [host = "", ...rest] = withoutScheme.split("/");
  return { host, repository: [...rest, chart].filter((s) => s !== "").join("/") };
}

/**
 * What a Helm index hands back, both halves of it.
 *
 * `created` rides along because it is ALREADY IN THE RESPONSE this function
 * parses -- a Helm index entry carries `version` and `created` side by side.
 * Currency (how far behind, and is upstream still alive) needs the dates;
 * collecting them here costs zero additional requests and zero additional
 * schedule, which is the only reason a second question gets to be asked at all
 * from a lane that exists to be cheap.
 */
interface HelmIndexRead {
  readonly versions: readonly string[];
  readonly created: Readonly<Record<string, string>>;
}

async function fetchHelmIndexVersions(repoURL: string, chart: string): Promise<HelmIndexRead> {
  const url = normalizeRepoUrl(repoURL) + "/index.yaml";
  const response = await fetch(url, { headers: { accept: "application/x-yaml, text/yaml, */*" } });
  if (!response.ok) throw new Error("GET " + url + " -> HTTP " + String(response.status));
  const index: unknown = parseYaml(await response.text());
  if (!isRecord(index) || !isRecord(index.entries)) throw new Error(url + " has no `entries` map");
  const charts = index.entries[chart];
  if (!Array.isArray(charts)) throw new Error(url + " publishes no chart named `" + chart + "`");
  const versions: string[] = [];
  const created: Record<string, string> = {};
  for (const entry of charts) {
    if (!isRecord(entry)) continue;
    const version = stringAt(entry, "version");
    if (version === "") continue;
    versions.push(version);
    // An index entry without `created` is left ABSENT, never defaulted. A
    // missing date must reach the report as "unknown"; a substituted one would
    // be the check-that-did-not-run wearing a plausible number.
    const when = stringAt(entry, "created");
    if (when !== "") created[version] = when;
  }
  return { versions, created };
}

async function fetchOciTags(repoURL: string, chart: string): Promise<readonly string[]> {
  const { host, repository } = ociTarget(repoURL, chart);
  const listUrl = "https://" + host + "/v2/" + repository + "/tags/list?n=1000";
  const headers: Record<string, string> = { accept: "application/json" };

  // Anonymous first, then follow the challenge. Registries that need no token
  // answer straight away; the ones that do tell you exactly where to get one.
  let response = await fetch(listUrl, { headers });
  if (response.status === 401) {
    const challenge = parseAuthChallenge(response.headers.get("www-authenticate") ?? "");
    const realm = challenge.realm ?? "";
    if (realm === "") throw new Error("GET " + listUrl + " -> HTTP 401 with no Bearer realm to follow");
    const tokenUrl = new URL(realm);
    if (challenge.service !== undefined) tokenUrl.searchParams.set("service", challenge.service);
    // The challenge's own scope is often the wildcard `*`; ask for the one
    // thing we actually want instead, which every conformant registry grants.
    tokenUrl.searchParams.set("scope", "repository:" + repository + ":pull");
    const tokenResponse = await fetch(tokenUrl, { headers: { accept: "application/json" } });
    if (!tokenResponse.ok) throw new Error("GET " + tokenUrl.toString() + " -> HTTP " + String(tokenResponse.status));
    const tokenBody: unknown = await tokenResponse.json();
    const token = isRecord(tokenBody) ? stringAt(tokenBody, "token") || stringAt(tokenBody, "access_token") : "";
    if (token === "") throw new Error(tokenUrl.toString() + " returned no token");
    headers.authorization = "Bearer " + token;
    response = await fetch(listUrl, { headers });
  }

  if (!response.ok) throw new Error("GET " + listUrl + " -> HTTP " + String(response.status));
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.tags)) throw new Error(listUrl + " returned no `tags` array");
  return body.tags.filter((t): t is string => typeof t === "string");
}

async function refresh(repoRoot: string): Promise<number> {
  const extraction = extractTree(repoRoot);
  const wanted = new Map<string, ChartCoordinate>();
  for (const coordinate of extraction.coordinates)
    wanted.set(rosterKey(coordinate.repoURL, coordinate.chart), coordinate);

  const fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const entries: Record<string, RosterEntry> = {};
  const dates: Record<string, ChartDatesEntry> = {};
  const failures: string[] = [];

  for (const [key, coordinate] of [...wanted].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    try {
      const read =
        coordinate.kind === "oci"
          ? { versions: await fetchOciTags(coordinate.repoURL, coordinate.chart), created: undefined }
          : await fetchHelmIndexVersions(coordinate.repoURL, coordinate.chart);
      const versions = read.versions;
      if (versions.length === 0) throw new Error("upstream listed zero versions");
      dates[key] =
        read.created === undefined
          ? { source: "unavailable", unavailable: OCI_DATES_UNAVAILABLE, created: {} }
          : { source: "helm-index-created", created: read.created };
      entries[key] = {
        repoURL: normalizeRepoUrl(coordinate.repoURL),
        chart: coordinate.chart,
        kind: coordinate.kind,
        fetchedAt,
        versions,
      };
      process.stdout.write("  ok   " + key + " (" + String(versions.length) + " versions)\n");
    } catch (error) {
      failures.push(key + ": " + (error instanceof Error ? error.message : String(error)));
      process.stdout.write("  FAIL " + key + "\n");
    }
  }

  // A failed fetch must never delete a coordinate's history from the snapshot:
  // that would turn a registry outage into a repo-wide "unpublished" verdict on
  // the next offline run. Keep what we had, and say the refresh was partial.
  //
  // A coordinate we have NEVER reached is different, and it must not fall out
  // of the snapshot either -- the offline run would then say "no entry, go
  // refresh", which is advice that cannot work and reads as a tooling gap
  // rather than as the wrong-coordinate defect it is. So the failure itself is
  // recorded, verbatim, with the instant it was observed.
  // Read-then-interpret, not exists-then-read. An absent roster is the
  // first-run case and yields no previous entries.
  let previous: Readonly<Record<string, RosterEntry>>;
  try {
    previous = readRoster().entries;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    previous = {};
  }
  const previousDates = readChartDatesOrEmpty().entries;
  for (const [key, coordinate] of wanted) {
    if (dates[key] === undefined) {
      // Same carry-forward reasoning as the versions below: an outage must not
      // erase dates we already hold, and a coordinate never once reached gets
      // an explicit `unavailable` rather than a silent gap.
      const keptDates = previousDates[key];
      const failure = failures.find((f) => f.startsWith(key + ": "));
      dates[key] =
        keptDates !== undefined && Object.keys(keptDates.created).length > 0
          ? keptDates
          : {
              source: "unavailable",
              unavailable: failure === undefined ? "not fetched" : failure.slice(key.length + 2),
              created: {},
            };
    }
    if (entries[key] !== undefined) continue;
    const kept = previous[key];
    if (kept !== undefined && kept.versions.length > 0) {
      entries[key] = kept;
      continue;
    }
    const failure = failures.find((f) => f.startsWith(key + ": "));
    entries[key] = {
      repoURL: normalizeRepoUrl(coordinate.repoURL),
      chart: coordinate.chart,
      kind: coordinate.kind,
      fetchedAt,
      versions: [],
      unreachable: failure === undefined ? "not fetched" : failure.slice(key.length + 2),
    };
  }

  const roster: Roster = {
    note:
      "Snapshot of chart versions each upstream repository publishes, keyed <repoURL>|<chart>. " +
      "Read offline by audit-chart-target-revisions.ts; never fetched on a PR-blocking path. " +
      "`fetchedAt` is when the list below was read, so a pin absent from it is a pin nothing " +
      "upstream could hand ArgoCD at that instant.",
    refreshCommand: REFRESH_COMMAND,
    entries: Object.fromEntries(Object.entries(entries).sort((a, b) => (a[0] < b[0] ? -1 : 1))),
  };

  const serialized = JSON.stringify(roster, null, 2) + "\n";
  // READ, then interpret ENOENT. `existsSync` followed by a read is
  // check-then-use: the file can change between the two, and CodeQL flags it
  // HIGH. Reading first removes the window rather than narrowing it, and an
  // absent roster is still the empty string, so the "unchanged" comparison
  // below is unaffected.
  let before: string;
  try {
    before = readFileSync(ROSTER_PATH, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    before = "";
  }
  const rosterUnchanged = sameIgnoringTimestamps(before, serialized);

  // The dates snapshot is written from the SAME fetches, in the same pass, so
  // the two files can never describe different network reads. It is written
  // INDEPENDENTLY of the roster, and that independence is the point: folding
  // the two into one "something changed" flag would make a dates-only change
  // rewrite the roster, whose only difference would then be `fetchedAt` -- the
  // timestamp-only weekly diff this function's own comment refuses to produce.
  const datesChanged = writeChartDatesIfChanged(dates);
  const unchanged = rosterUnchanged && !datesChanged;

  // Write only when something was LEARNED. Rewriting on every run would leave a
  // 35-line timestamp-only diff behind each scheduled refresh and dirty any
  // local tree that ran one, which is how a checked-in snapshot stops being
  // reviewable. The cost is stated where it lands: `fetchedAt` is then a LOWER
  // BOUND on when a list was last confirmed, not the last time it was read.
  if (!rosterUnchanged) writeFileSync(ROSTER_PATH, serialized);

  if (failures.length > 0) {
    process.stderr.write("\n" + String(failures.length) + " coordinate(s) unreachable this run:\n");
    for (const failure of failures) process.stderr.write("  " + failure + "\n");
    process.stderr.write(
      "Any versions previously snapshotted for those are KEPT, so a registry outage cannot " +
        "turn into an `unpublished` verdict offline; a coordinate never once reached is " +
        "recorded as `unreachable` with the error above.\n",
    );
  }

  // THE EXIT CODE TRACKS THE SNAPSHOT, NOT THE FETCHES -- deliberately.
  //
  // The first version returned 1 whenever any fetch failed. Two coordinates in
  // this tree are PERMANENTLY unreachable (wrong repoURLs, 081M0JX4M7H087G0R00
  // 29R5QG6), so that lane would have been red on every single run from the
  // day it landed -- and this file's own argument about `fetchedAt` applies to
  // it: a signal that is always on carries no information, and a lane nobody
  // can ever see go green is a lane nobody reads.
  //
  // So the division of labour is: THIS lane reports whether the snapshot
  // CHANGED (commit the diff), and the OFFLINE audit reports the verdict on
  // every PR, where an unreachable repository is a finding it prints by name.
  // A repository that goes from reachable to unreachable still surfaces here,
  // because that is a change to the snapshot.
  if (unchanged) {
    process.stdout.write(
      "\nrefresh clean -- " +
        String(Object.keys(entries).length) +
        " coordinate(s), no change; " +
        ROSTER_FILENAME +
        " and " +
        DATES_FILENAME +
        " left untouched.\n",
    );
    return 0;
  }
  process.stdout.write(
    "\nrefresh CHANGED " +
      (rosterUnchanged ? "" : ROSTER_FILENAME + " ") +
      (datesChanged ? DATES_FILENAME + " " : "") +
      "-- commit the diff, then regenerate the currency report:\n  " +
      CURRENCY_REPORT_COMMAND +
      "\n",
  );
  return 1;
}

/**
 * Did the refresh learn anything, ignoring the fact that it ran?
 *
 * `fetchedAt` moves on every refresh, so comparing raw text would report a
 * change every single time and the scheduled lane would be permanently red --
 * a signal that is always on carries no information.
 */
export function sameIgnoringTimestamps(before: string, after: string): boolean {
  const strip = (text: string): string => text.replace(/"fetchedAt": "[^"]*"/g, '"fetchedAt": ""');
  return strip(before) === strip(after);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function report(auditReport: AuditReport, extraction: Extraction): void {
  const { findings, acknowledged } = auditReport;

  if (acknowledged.length > 0) {
    process.stdout.write("chart targetRevision -- " + String(acknowledged.length) + " ACKNOWLEDGED finding(s)\n\n");
    for (const finding of acknowledged) {
      process.stdout.write("  [" + finding.rule + "] " + finding.subject + "\n      " + finding.detail + "\n\n");
    }
  }

  if (findings.length === 0) {
    process.stdout.write(
      "chart targetRevision OK -- " +
        String(auditReport.resolvedCount) +
        " of " +
        String(auditReport.coordinateCount) +
        " chart coordinate(s) resolve against a snapshot no older than " +
        (auditReport.oldestFetchedAt === "" ? "(none)" : auditReport.oldestFetchedAt) +
        "; " +
        String(acknowledged.length) +
        " acknowledged; " +
        String(auditReport.gitPathCount) +
        " git-path source(s) carry no chart version and are skipped BY NAME: " +
        extraction.gitPaths.map((g) => g.appName).join(", ") +
        "\n",
    );
    return;
  }

  process.stderr.write("chart targetRevision VIOLATED -- " + String(findings.length) + " finding(s)\n\n");
  for (const finding of findings) {
    process.stderr.write("  [" + finding.rule + "] " + finding.subject + "\n      " + finding.detail + "\n\n");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--refresh");
  if (unknown.length > 0) {
    process.stderr.write("usage: audit-chart-target-revisions.ts [--refresh]\n");
    process.exit(2);
  }

  if (args.includes("--refresh")) {
    process.exit(await refresh(REPO_ROOT));
  }

  const extraction = extractTree(REPO_ROOT);
  const auditReport = auditCoordinates(extraction, readRoster());
  report(auditReport, extraction);
  if (auditReport.findings.length > 0) process.exit(1);
}

if (import.meta.main) await main();
