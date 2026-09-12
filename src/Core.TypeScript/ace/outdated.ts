// outdated.ts -- "which of our dependencies are out of date?", answered OFFLINE.
//
// Aaron 2026-09-11: *"ace should have dependabot like, out-of-date features ... we just need to
// make sure we have some way locally to tell, out of date deps. ace is where this belongs."*
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// THE CONSTRAINT THAT SHAPES EVERYTHING: LOCALLY
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// `.claude/rules/clone-at-tag-stays-sufficient.md` requires this tree to stay buildable and
// checkable from `git clone` at a pinned tag with NO package manager present -- permanently. A
// freshness check that phones five registries is therefore not allowed to be the only way to ask
// the question, and it is not allowed to become a step anything depends on.
//
// So the design is two separated acts:
//
//   ace outdated              READS a committed snapshot. Zero network. Works on a plane.
//   ace outdated --refresh    WRITES that snapshot from the registries. An explicit act.
//
// The snapshot is data in the repo, which means IT AGES. That is not a flaw to be minimised --
// it is the whole reason the second half of this file exists.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// "I DO NOT KNOW HOW CURRENT MY KNOWLEDGE IS" IS A FIRST-CLASS ANSWER
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// The failure this command must not have is the one this repo names as its worst: A CHECK THAT
// DID NOT RUN LOOKING LIKE ONE THAT PASSED. For a freshness report that failure has a specific
// shape -- a dependency whose latest version nobody knows silently rendering as "up to date".
//
// Two mechanisms, and they are deliberately ORTHOGONAL AXES rather than one score:
//
//   DISTANCE   how far behind is this pin?     UpToDate | Behind | Ahead | Unknown
//   FRESHNESS  how old is the knowledge?       fresh | aging | stale | absent
//
// Crossing them is the point. `UpToDate` + `stale` is NOT "up to date": it is "current as of a
// 94-day-old observation", and the renderer prints it that way. Collapsing the two axes into one
// verdict is exactly how "we have not looked since June" becomes "green".
//
// And `Unknown` is the DEFAULT. A row reaches `UpToDate` only by positively parsing BOTH versions
// and comparing them. No snapshot entry, an unparsable version, a range pin -- every one of those
// lands on `Unknown` with a stated reason. There is no code path from absence to "current".
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// EXIT CODES
// ══════════════════════════════════════════════════════════════════════════════════════════
//
//   0  ran; nothing behind                  ("ran and found nothing")
//   1  ran; at least one dependency behind  ("ran and found something")
//   2  could not run                        -- no manifest readable at all, bad arguments, or a
//                                              `--refresh` that failed. NEVER a pass.
//
// The 0/2 split is the one the brief asks for and the one an exit-code-only reading destroys;
// `local-checks.ts` states the same distinction in words and this follows it. `--fail-on-unknown`
// and `--max-snapshot-age-days` turn the OTHER two honest-ignorance conditions into exit 1 for
// callers that want them to block; they do not change what is reported, only what is fatal.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// WHAT THIS REUSES
// ══════════════════════════════════════════════════════════════════════════════════════════
//
//   ./semver.ts                    parseVersion / compareVersions -- the ordering
//   ./outdated-inventory.ts        the pinned half (which reuses ../ci/toolchain-manifest.ts)
//   ../dep-update/toy-classify.ts  IS THE CONSUMER, not a dependency: that module classifies an
//                                  `UpdateProposal` (publisher, from, to, claimedBump) and
//                                  nothing in the repo produced one. `proposalsFrom` below is
//                                  the missing producer. This command does NOT re-implement its
//                                  adherence/provenance judgement, and deliberately holds no
//                                  opinion about whether an update SHOULD be taken.
//   ../io/safe-io.ts               bounded reads, bounded fetches, writeTextIfChanged
//
// A note on register, per `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`: every
// row here names a FACT -- `Behind`, `Unknown`, `stale`. There is no `Vulnerable`, no `Risky`,
// no `ShouldUpgrade`. Whether being four minors behind is fine or alarming is the caller's
// oracle, and `dep-update` is where that judgement already lives.
//
// Rule 0: TypeScript, no .sh.

import { mkdirSync, readdirSync } from "node:fs";
import { readFileBounded, writeTextIfChanged, fetchBounded } from "../io/safe-io.ts";
import { parseVersion, compareVersions, type Version } from "./semver.ts";
import {
  ECOSYSTEMS,
  collectPinned,
  manifestRoster,
  type Ecosystem,
  type PinnedDependency,
  type PinnedInventory,
} from "./outdated-inventory.ts";

/** Where the committed snapshot lives. ONE FILE PER ECOSYSTEM -- see the growth note below. */
export const SNAPSHOT_DIR = "registry/latest-known";

/**
 * PARTITIONED BY ECOSYSTEM, NOT ONE FILE.
 *
 * `.claude/rules/dv2-data-split-discipline-activated.md` #5 and the unbounded-growth register
 * both push the same way: a single file rewritten on every refresh is the churn shape
 * `audit-single-file-rewrite-churn.ts` exists to make visible. Splitting per ecosystem means a
 * `--refresh --ecosystem npm` rewrites ONE file, so a refresh of one registry does not produce a
 * diff touching every dependency in the repo. The file COUNT is bounded by `ECOSYSTEMS` (a
 * closed union), which is what makes the directory row's ceiling a real ratchet.
 */
export function snapshotPathFor(ecosystem: Ecosystem): string {
  return `${SNAPSHOT_DIR}/${ecosystem}.json`;
}

// -- the snapshot -------------------------------------------------------------------------

export interface LatestRecord {
  /** The newest version the registry reported at `observedAt`. */
  readonly latest: string;
  /** ISO `YYYY-MM-DD`, the day this specific row was observed. */
  readonly observedAt: string;
  /** The URL the value came from. The provenance of the LATEST half. */
  readonly source: string;
}

export interface EcosystemSnapshot {
  readonly ecosystem: Ecosystem;
  /** ISO `YYYY-MM-DD` of the most recent refresh of this file as a whole. */
  readonly observedAt: string;
  /** Registry-canonical name -> what was observed. */
  readonly packages: Readonly<Record<string, LatestRecord>>;
}

/** A snapshot file that is absent or unreadable. Carried, never treated as an empty snapshot. */
export interface SnapshotGap {
  readonly ecosystem: Ecosystem;
  readonly path: string;
  readonly reason: string;
}

export interface LoadedSnapshots {
  readonly byEcosystem: ReadonlyMap<Ecosystem, EcosystemSnapshot>;
  readonly gaps: readonly SnapshotGap[];
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;

/** Parse and VALIDATE one snapshot file. A malformed snapshot is a gap, never a partial truth. */
export function parseSnapshot(text: string, ecosystem: Ecosystem): EcosystemSnapshot | { readonly error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (e) {
    return { error: `not valid JSON: ${(e as Error).message}` };
  }
  if (typeof raw !== "object" || raw === null) return { error: "top level must be an object" };
  const o = raw as Record<string, unknown>;
  if (o["ecosystem"] !== ecosystem) {
    return { error: `declares ecosystem '${String(o["ecosystem"])}' but lives at ${snapshotPathFor(ecosystem)}` };
  }
  const observedAt = o["observedAt"];
  if (typeof observedAt !== "string" || !ISO_DAY.test(observedAt)) {
    return { error: "'observedAt' must be an ISO YYYY-MM-DD day -- without it the age is unknowable" };
  }
  const packagesRaw = o["packages"];
  if (typeof packagesRaw !== "object" || packagesRaw === null) return { error: "'packages' must be an object" };
  const packages: Record<string, LatestRecord> = {};
  for (const [name, v] of Object.entries(packagesRaw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) return { error: `packages['${name}'] must be an object` };
    const r = v as Record<string, unknown>;
    const latest = r["latest"];
    const rowObserved = r["observedAt"];
    const source = r["source"];
    if (typeof latest !== "string" || latest.length === 0) return { error: `packages['${name}'].latest must be a non-empty string` };
    if (typeof rowObserved !== "string" || !ISO_DAY.test(rowObserved)) {
      return { error: `packages['${name}'].observedAt must be an ISO YYYY-MM-DD day` };
    }
    if (typeof source !== "string" || source.length === 0) return { error: `packages['${name}'].source must name where the value came from` };
    packages[name] = { latest, observedAt: rowObserved, source };
  }
  return { ecosystem, observedAt, packages };
}

export function serializeSnapshot(snap: EcosystemSnapshot): string {
  // Ordinal key order, explicitly. `Object.keys` order is insertion order, which would make the
  // committed file depend on the order the registry answered -- a diff that changes for no
  // reason is a diff nobody reads. `.claude/rules/culture-invariant-by-default.md`: ordinal,
  // never `localeCompare`.
  const names = Object.keys(snap.packages).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const packages: Record<string, LatestRecord> = {};
  for (const n of names) {
    const rec = snap.packages[n];
    if (rec !== undefined) packages[n] = rec;
  }
  return `${JSON.stringify({ ecosystem: snap.ecosystem, observedAt: snap.observedAt, packages }, null, 2)}\n`;
}

function joinRepoPath(root: string, rel: string): string {
  return root.endsWith("/") ? `${root}${rel}` : `${root}/${rel}`;
}

export function loadSnapshots(root: string, ecosystems: readonly Ecosystem[] = ECOSYSTEMS): LoadedSnapshots {
  const byEcosystem = new Map<Ecosystem, EcosystemSnapshot>();
  const gaps: SnapshotGap[] = [];
  for (const eco of ecosystems) {
    const rel = snapshotPathFor(eco);
    const r = readFileBounded(joinRepoPath(root, rel));
    if (!r.ok) {
      gaps.push({ ecosystem: eco, path: rel, reason: `${r.error.kind}: ${r.error.message}` });
      continue;
    }
    const parsed = parseSnapshot(r.value.text, eco);
    if ("error" in parsed) {
      gaps.push({ ecosystem: eco, path: rel, reason: parsed.error });
      continue;
    }
    byEcosystem.set(eco, parsed);
  }
  return { byEcosystem, gaps };
}

// -- staleness ----------------------------------------------------------------------------

export type Freshness = "fresh" | "aging" | "stale" | "absent";

export interface StalenessPolicy {
  /** At or below this many days old, knowledge is `fresh`. */
  readonly freshDays: number;
  /** At or below this many days old, `aging`. Above it, `stale`. */
  readonly agingDays: number;
}

/**
 * Declared, not ambient -- a caller may pass its own, the same way `dep-update`'s
 * `defaultToyPolicy` is an oracle the caller chose rather than a constant the mechanism imposes
 * (manifesto §11).
 *
 * These particular numbers are a TOY under
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`: nothing has measured how fast this
 * repo's upstreams actually move, so 7 and 30 are round numbers and are labelled as such. What is
 * NOT a toy is the mechanism -- the age is computed from committed dates and an injected `now`,
 * and it is reported whatever the thresholds say.
 */
export const defaultStalenessPolicy: StalenessPolicy = { freshDays: 7, agingDays: 30 };

/** Whole days between two ISO days, UTC. Negative when `observedAt` is in the future. */
export function ageInDays(observedAt: string, now: Date): number {
  const then = Date.parse(`${observedAt}T00:00:00Z`);
  if (Number.isNaN(then)) return Number.NaN;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - then) / 86_400_000);
}

export function freshnessOf(ageDays: number, policy: StalenessPolicy): Freshness {
  if (Number.isNaN(ageDays)) return "absent";
  if (ageDays <= policy.freshDays) return "fresh";
  if (ageDays <= policy.agingDays) return "aging";
  return "stale";
}

// -- the comparison -----------------------------------------------------------------------

/**
 * What is known about the LATEST half. Named as facts; `Unknown` is a row, not a missing row.
 */
export type Knowledge =
  | { readonly t: "Known"; readonly latest: string; readonly observedAt: string; readonly source: string; readonly ageDays: number; readonly freshness: Freshness }
  /** No snapshot file for this ecosystem at all. Every row in it is unknowable. */
  | { readonly t: "NoSnapshot"; readonly path: string; readonly reason: string }
  /** The snapshot exists and does not mention this dependency. Its age is still known. */
  | { readonly t: "NotInSnapshot"; readonly snapshotObservedAt: string; readonly ageDays: number; readonly freshness: Freshness };

export type Distance =
  | { readonly t: "UpToDate" }
  | { readonly t: "Behind"; readonly bump: "major" | "minor" | "patch"; readonly majorsBehind: number }
  /** The pin is newer than the snapshot knows about -- a prerelease, or a stale snapshot. */
  | { readonly t: "Ahead" }
  /** The default. Carries WHY, because "unknown" with no reason is indistinguishable from a bug. */
  | { readonly t: "Unknown"; readonly why: string };

export interface OutdatedRow {
  readonly dependency: PinnedDependency;
  readonly knowledge: Knowledge;
  readonly distance: Distance;
}

function bumpBetween(from: Version, to: Version): "major" | "minor" | "patch" {
  if (to.major !== from.major) return "major";
  if (to.minor !== from.minor) return "minor";
  return "patch";
}

/**
 * Compare one pin against what is known.
 *
 * EVERY EARLY RETURN LANDS ON `Unknown`, never on `UpToDate`. That ordering is the load-bearing
 * property of this function and the thing its CONTROL test pins: a reporter that answered
 * "up to date" for the cases it could not evaluate would pass every "it detects a behind
 * dependency" test ever written.
 */
export function compareOne(dep: PinnedDependency, knowledge: Knowledge): Distance {
  if (knowledge.t === "NoSnapshot") {
    return { t: "Unknown", why: `no known-latest snapshot at ${knowledge.path}` };
  }
  if (knowledge.t === "NotInSnapshot") {
    return { t: "Unknown", why: `the ${dep.ecosystem} snapshot of ${knowledge.snapshotObservedAt} does not mention '${dep.name}'` };
  }
  if (dep.pinKind === "range") {
    return {
      t: "Unknown",
      why: `'${dep.current}' is a range, not a pin -- the installed version is whatever the resolver chose, which this command does not run`,
    };
  }
  const from = parseVersion(dep.current.replace(/^v/u, ""));
  const to = parseVersion(knowledge.latest.replace(/^v/u, ""));
  if (from === null) return { t: "Unknown", why: `cannot parse pinned version '${dep.current}' as a semantic version` };
  if (to === null) return { t: "Unknown", why: `cannot parse known-latest '${knowledge.latest}' as a semantic version` };
  const ord = compareVersions(from, to);
  if (ord === 0) return { t: "UpToDate" };
  if (ord > 0) return { t: "Ahead" };
  return { t: "Behind", bump: bumpBetween(from, to), majorsBehind: to.major - from.major };
}

export function knowledgeFor(dep: PinnedDependency, snapshots: LoadedSnapshots, now: Date, policy: StalenessPolicy): Knowledge {
  const snap = snapshots.byEcosystem.get(dep.ecosystem);
  if (snap === undefined) {
    const gap = snapshots.gaps.find((g) => g.ecosystem === dep.ecosystem);
    return { t: "NoSnapshot", path: gap?.path ?? snapshotPathFor(dep.ecosystem), reason: gap?.reason ?? "not loaded" };
  }
  const rec = snap.packages[dep.name];
  if (rec === undefined) {
    const age = ageInDays(snap.observedAt, now);
    return { t: "NotInSnapshot", snapshotObservedAt: snap.observedAt, ageDays: age, freshness: freshnessOf(age, policy) };
  }
  const age = ageInDays(rec.observedAt, now);
  return { t: "Known", latest: rec.latest, observedAt: rec.observedAt, source: rec.source, ageDays: age, freshness: freshnessOf(age, policy) };
}

export interface OutdatedReport {
  readonly rows: readonly OutdatedRow[];
  readonly unreadableSources: readonly { readonly path: string; readonly reason: string }[];
  readonly snapshotGaps: readonly SnapshotGap[];
  /** Ecosystems that produced at least one pinned row. */
  readonly ecosystemsCovered: readonly Ecosystem[];
  /** In `ECOSYSTEMS` and contributing nothing -- either no manifest, or no rows in it. */
  readonly ecosystemsWithoutPins: readonly Ecosystem[];
  readonly counts: {
    readonly total: number;
    readonly behind: number;
    readonly upToDate: number;
    readonly ahead: number;
    readonly unknown: number;
  };
  /** Oldest and newest per-row observation age in days. `null` when nothing is known at all. */
  readonly snapshotAgeDays: { readonly min: number; readonly max: number } | null;
}

/** The pure fold. Takes `now` as an argument -- no ambient clock, so this replays under DST. */
export function buildReport(
  inventory: PinnedInventory,
  snapshots: LoadedSnapshots,
  now: Date,
  policy: StalenessPolicy = defaultStalenessPolicy,
): OutdatedReport {
  const rows: OutdatedRow[] = inventory.deps.map((dependency) => {
    const knowledge = knowledgeFor(dependency, snapshots, now, policy);
    return { dependency, knowledge, distance: compareOne(dependency, knowledge) };
  });

  let behind = 0;
  let upToDate = 0;
  let ahead = 0;
  let unknown = 0;
  let minAge = Number.POSITIVE_INFINITY;
  let maxAge = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    if (r.distance.t === "Behind") behind += 1;
    else if (r.distance.t === "UpToDate") upToDate += 1;
    else if (r.distance.t === "Ahead") ahead += 1;
    else unknown += 1;
    if (r.knowledge.t === "Known" && !Number.isNaN(r.knowledge.ageDays)) {
      minAge = Math.min(minAge, r.knowledge.ageDays);
      maxAge = Math.max(maxAge, r.knowledge.ageDays);
    }
  }

  const covered = new Set<Ecosystem>(inventory.deps.map((d) => d.ecosystem));
  const ecosystemsCovered = ECOSYSTEMS.filter((e) => covered.has(e));
  const ecosystemsWithoutPins = ECOSYSTEMS.filter((e) => !covered.has(e));

  return {
    rows,
    unreadableSources: inventory.unreadable,
    snapshotGaps: snapshots.gaps,
    ecosystemsCovered,
    ecosystemsWithoutPins,
    counts: { total: rows.length, behind, upToDate, ahead, unknown },
    snapshotAgeDays: Number.isFinite(minAge) ? { min: minAge, max: maxAge } : null,
  };
}

// -- exit code ----------------------------------------------------------------------------

export interface ExitPolicy {
  readonly failOnUnknown: boolean;
  /** Exit 1 when any known row's observation is older than this. `null` disables. */
  readonly maxSnapshotAgeDays: number | null;
}

export const defaultExitPolicy: ExitPolicy = { failOnUnknown: false, maxSnapshotAgeDays: null };

/**
 * 2 IS NOT A WORSE 1. It means the question was never asked.
 *
 * An inventory that read no manifest at all did not run, and the only honest thing a report can
 * say then is "I could not look" -- which must not share an exit code with "I looked and
 * everything is current".
 */
export function exitCodeFor(report: OutdatedReport, policy: ExitPolicy = defaultExitPolicy): number {
  if (report.rows.length === 0 && report.unreadableSources.length > 0) return 2;
  if (report.counts.total === 0) return 2;
  if (report.counts.behind > 0) return 1;
  if (policy.failOnUnknown && report.counts.unknown > 0) return 1;
  if (policy.maxSnapshotAgeDays !== null && report.snapshotAgeDays !== null && report.snapshotAgeDays.max > policy.maxSnapshotAgeDays) {
    return 1;
  }
  // Nothing known at all, but manifests were read: the snapshot is missing entirely. That is
  // "could not run" for the freshness question even though the inventory half succeeded.
  if (report.snapshotAgeDays === null) return 2;
  return 0;
}

// -- rendering ----------------------------------------------------------------------------

function describeKnowledge(k: Knowledge): string {
  if (k.t === "Known") return `${k.latest} (observed ${k.observedAt}, ${String(k.ageDays)}d ago, ${k.freshness})`;
  if (k.t === "NotInSnapshot") return `unknown (snapshot of ${k.snapshotObservedAt} does not list it)`;
  return `unknown (${k.path} unavailable)`;
}

function describeDistance(d: Distance, k: Knowledge): string {
  switch (d.t) {
    case "Behind":
      return `BEHIND (${d.bump}${d.majorsBehind > 0 ? `, ${String(d.majorsBehind)} major(s)` : ""})`;
    case "UpToDate":
      // NEVER a bare "current". The freshness qualifier travels with the verdict, because
      // "current as of 94 days ago" and "current" are different claims.
      return k.t === "Known" && k.freshness !== "fresh" ? `current as of a ${k.freshness} observation` : "current";
    case "Ahead":
      return "ahead of the snapshot";
    default:
      return "UNKNOWN";
  }
}

/**
 * The one line that must never be able to read as "everything is fine" when it is not.
 *
 * It always carries the unknown count and the snapshot age band, so exit 0 cannot be mistaken for
 * "all current" when half the tree was never resolvable.
 */
export function summaryLine(report: OutdatedReport): string {
  const c = report.counts;
  const age =
    report.snapshotAgeDays === null
      ? "snapshot age n/a (nothing known)"
      : `snapshot age ${String(report.snapshotAgeDays.min)}-${String(report.snapshotAgeDays.max)}d`;
  const missing = report.snapshotGaps.length > 0 ? `, ${String(report.snapshotGaps.length)} ecosystem(s) with no snapshot` : "";
  return (
    `ace outdated: ${String(c.total)} pinned - ${String(c.behind)} behind - ${String(c.upToDate)} current - ` +
    `${String(c.ahead)} ahead - ${String(c.unknown)} unknown - ${age}${missing} - ` +
    `covered: ${report.ecosystemsCovered.join(",") || "none"}` +
    `${report.ecosystemsWithoutPins.length > 0 ? ` - no pins found: ${report.ecosystemsWithoutPins.join(",")}` : ""}`
  );
}

export function renderReport(report: OutdatedReport, opts: { readonly showAll: boolean }): string {
  const lines: string[] = [];
  // Rows unknowable because their WHOLE ecosystem has no snapshot are summarised per ecosystem
  // rather than listed. Printing the same sentence 184 times buries the rows that carry a
  // per-dependency reason -- and a report nobody reads to the end is a report that did not run.
  const ecosystemWide = new Set(report.snapshotGaps.map((g) => g.ecosystem));
  const interesting = report.rows
    .filter((r) => !(r.knowledge.t === "NoSnapshot" && ecosystemWide.has(r.dependency.ecosystem)))
    .filter((r) => opts.showAll || r.distance.t === "Behind" || r.distance.t === "Unknown");
  let lastEco: Ecosystem | null = null;
  for (const r of interesting) {
    if (r.dependency.ecosystem !== lastEco) {
      lines.push(`\n  ${r.dependency.ecosystem}`);
      lastEco = r.dependency.ecosystem;
    }
    const d = describeDistance(r.distance, r.knowledge);
    lines.push(`    ${r.dependency.name}  ${r.dependency.current} -> ${describeKnowledge(r.knowledge)}  [${d}]`);
    if (r.distance.t === "Unknown") lines.push(`        why: ${r.distance.why}`);
    lines.push(`        pinned in: ${r.dependency.source}`);
  }
  if (report.unreadableSources.length > 0) {
    lines.push("\n  COULD NOT READ (these dependencies are absent from every count above):");
    for (const u of report.unreadableSources) lines.push(`    ${u.path}: ${u.reason}`);
  }
  if (report.snapshotGaps.length > 0) {
    lines.push("\n  NO KNOWN-LATEST SNAPSHOT (every dependency in these ecosystems reports unknown):");
    for (const g of report.snapshotGaps) {
      const affected = report.rows.filter((r) => r.dependency.ecosystem === g.ecosystem).length;
      lines.push(`    ${g.path}: ${g.reason}`);
      lines.push(`        ${String(affected)} pinned dependenc(ies) in '${g.ecosystem}' are UNKNOWN, not current`);
    }
    lines.push(`    refresh with: bun src/Core.TypeScript/ace/ace.ts outdated --refresh`);
  }
  lines.push("");
  lines.push(summaryLine(report));
  return lines.join("\n");
}

export function renderJson(report: OutdatedReport): string {
  return `${JSON.stringify(
    {
      summary: summaryLine(report),
      counts: report.counts,
      snapshotAgeDays: report.snapshotAgeDays,
      ecosystemsCovered: report.ecosystemsCovered,
      ecosystemsWithoutPins: report.ecosystemsWithoutPins,
      snapshotGaps: report.snapshotGaps,
      unreadableSources: report.unreadableSources,
      rows: report.rows.map((r) => ({
        ecosystem: r.dependency.ecosystem,
        name: r.dependency.name,
        current: r.dependency.current,
        pinKind: r.dependency.pinKind,
        pinnedIn: r.dependency.source,
        knowledge: r.knowledge,
        distance: r.distance,
      })),
    },
    null,
    2,
  )}\n`;
}

// -- the bridge into dep-update -----------------------------------------------------------

/**
 * Every `Behind` row, shaped as the `UpdateProposal` that `../dep-update/toy-classify.ts` has
 * been waiting for since it was written.
 *
 * That module types the DECISION (auto-eligible / scrutiny-raised / held) over a proposal, and
 * nothing in the repo produced a proposal. This is the producer, and it is the reason
 * `ace outdated` belongs in `ace` rather than in `hygiene`: it is the front of a dependency
 * pipeline, not an audit of one.
 *
 * `publisher` is the ECOSYSTEM, not a person. Per-publisher attribution needs registry ownership
 * metadata this offline snapshot does not carry, and inventing a publisher identity to fill the
 * field would be exactly the fabrication the adherence ledger is supposed to measure against.
 */
export interface UpdateProposalSeed {
  readonly publisher: string;
  readonly ecosystem: string;
  readonly packageName: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly claimedBump: "patch" | "minor" | "major";
}

export function proposalsFrom(report: OutdatedReport): UpdateProposalSeed[] {
  const out: UpdateProposalSeed[] = [];
  for (const r of report.rows) {
    if (r.distance.t !== "Behind" || r.knowledge.t !== "Known") continue;
    out.push({
      publisher: r.dependency.ecosystem,
      ecosystem: r.dependency.ecosystem,
      packageName: r.dependency.name,
      fromVersion: r.dependency.current,
      toVersion: r.knowledge.latest,
      claimedBump: r.distance.bump,
    });
  }
  return out;
}

// -- discovery ----------------------------------------------------------------------------

/** `Cargo.toml` / `uv.lock` in the immediate children of `src`. Depth-bounded: a scan, not a repo walk. */
export function discoverMultiProjectManifests(root: string): { readonly cargo: string[]; readonly uv: string[] } {
  const cargo: string[] = [];
  const uv: string[] = [];
  let entries: readonly string[];
  try {
    entries = readdirSync(joinRepoPath(root, "src"));
  } catch {
    return { cargo, uv };
  }
  for (const dir of [...entries].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    let inner: readonly string[];
    try {
      inner = readdirSync(joinRepoPath(root, `src/${dir}`));
    } catch {
      continue;
    }
    if (inner.includes("Cargo.toml")) cargo.push(`src/${dir}/Cargo.toml`);
    if (inner.includes("uv.lock")) uv.push(`src/${dir}/uv.lock`);
  }
  return { cargo, uv };
}

export function collectRepoPins(root: string): PinnedInventory {
  const found = discoverMultiProjectManifests(root);
  return collectPinned(root, manifestRoster(found.cargo, found.uv));
}

// -- the refresh (THE ONLY NETWORK IN THIS FILE) -------------------------------------------

/**
 * How to ask each registry for a package's newest version.
 *
 * `mise` is deliberately ABSENT and that absence is reported rather than faked: a mise tool key
 * is a backend-qualified id (`pipx:semgrep`, `github:yannh/kubeconform`, `core:node`) whose
 * upstream differs per backend, so one URL template cannot answer for the table. Implementing it
 * means implementing mise's backend registry, and a template that guessed would produce confident
 * wrong answers for most of the table -- worse than `unknown`.
 */
export type LatestResolver = (name: string) => Promise<{ readonly latest: string; readonly source: string } | { readonly error: string }>;

function isPrerelease(v: string): boolean {
  return /[-+]/u.test(v);
}

/** Newest STABLE version; prereleases are skipped because none of our pins are prereleases. */
function newestStable(versions: readonly string[]): string | null {
  let best: string | null = null;
  for (const v of versions) {
    if (isPrerelease(v)) continue;
    const parsed = parseVersion(v);
    if (parsed === null) continue;
    if (best === null || compareVersions(parsed, best) > 0) best = v;
  }
  return best;
}

/**
 * MEASURED, not guessed: PyPI's `/pypi/<name>/json` carries the package's ENTIRE release history,
 * and `aiohttp` is 9.15 MB of it (measured 2026-09-11). An 8 MB cap truncated it, the truncated
 * body failed to parse, and the row was reported unresolved -- which is the CORRECT failure, and
 * also an avoidable one. 32 MB clears the largest response any of these registries returns for
 * the packages this repo pins; a package that exceeds it still fails loudly rather than silently
 * resolving from a half-read body.
 */
const REGISTRY_RESPONSE_CAP_BYTES = 32 * 1024 * 1024;

async function getJson(url: string): Promise<unknown | { readonly error: string }> {
  const r = await fetchBounded(url, { timeoutMs: 30_000, maxBytes: REGISTRY_RESPONSE_CAP_BYTES });
  if (!r.ok) return { error: `${r.error.kind}: ${r.error.message}` };
  if (r.value.truncated) return { error: `response exceeded ${String(REGISTRY_RESPONSE_CAP_BYTES)} bytes and was truncated` };
  try {
    return JSON.parse(r.value.body) as unknown;
  } catch (e) {
    return { error: `response was not JSON: ${(e as Error).message}` };
  }
}

export const NETWORK_RESOLVERS: Partial<Record<Ecosystem, LatestResolver>> = {
  nuget: async (name) => {
    const url = `https://api.nuget.org/v3-flatcontainer/${encodeURIComponent(name.toLowerCase())}/index.json`;
    const j = await getJson(url);
    if (typeof j === "object" && j !== null && "error" in j) return j as { readonly error: string };
    const versions = (j as { versions?: unknown }).versions;
    if (!Array.isArray(versions)) return { error: "no 'versions' array" };
    const latest = newestStable(versions.filter((v): v is string => typeof v === "string"));
    return latest === null ? { error: "no stable version" } : { latest, source: url };
  },
  npm: async (name) => {
    const url = `https://registry.npmjs.org/${name.split("/").map(encodeURIComponent).join("/")}/latest`;
    const j = await getJson(url);
    if (typeof j === "object" && j !== null && "error" in j) return j as { readonly error: string };
    const version = (j as { version?: unknown }).version;
    return typeof version === "string" ? { latest: version, source: url } : { error: "no 'version' field" };
  },
  cargo: async (name) => {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
    const j = await getJson(url);
    if (typeof j === "object" && j !== null && "error" in j) return j as { readonly error: string };
    const max = (j as { crate?: { max_stable_version?: unknown } }).crate?.max_stable_version;
    return typeof max === "string" ? { latest: max, source: url } : { error: "no 'crate.max_stable_version'" };
  },
  pypi: async (name) => {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
    const j = await getJson(url);
    if (typeof j === "object" && j !== null && "error" in j) return j as { readonly error: string };
    const version = (j as { info?: { version?: unknown } }).info?.version;
    return typeof version === "string" ? { latest: version, source: url } : { error: "no 'info.version'" };
  },
  go: async (name) => {
    const url = `https://proxy.golang.org/${name.toLowerCase()}/@latest`;
    const j = await getJson(url);
    if (typeof j === "object" && j !== null && "error" in j) return j as { readonly error: string };
    const version = (j as { Version?: unknown }).Version;
    return typeof version === "string" ? { latest: version, source: url } : { error: "no 'Version' field" };
  },
};

export interface RefreshOutcome {
  readonly ecosystem: Ecosystem;
  readonly resolved: number;
  readonly failed: readonly { readonly name: string; readonly reason: string }[];
  readonly written: boolean;
  readonly path: string;
}

/**
 * Refresh one ecosystem's snapshot from its registry. THE EXPLICIT, SEPARATE ACT.
 *
 * A dependency the registry could not answer for is dropped from the snapshot and listed in
 * `failed` -- it is NOT carried forward with an old value under a new `observedAt`, which would
 * re-date knowledge nobody re-observed. The per-row `observedAt` exists so a partial refresh
 * keeps honest per-row ages rather than laundering them all to today.
 */
export async function refreshEcosystem(
  root: string,
  ecosystem: Ecosystem,
  names: readonly string[],
  today: string,
  resolver: LatestResolver,
): Promise<RefreshOutcome> {
  const packages: Record<string, LatestRecord> = {};
  const failed: { name: string; reason: string }[] = [];
  // Sequential on purpose: this is a courtesy to public registries and there is no DoP knob to
  // dial here (`.claude/rules/async-all-the-way-truthful-signatures.md` -- an unbounded
  // `Promise.all` over 200 names is exactly the un-knobbed fan-out that rule names).
  for (const name of [...new Set(names)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const r = await resolver(name);
    if ("error" in r) {
      failed.push({ name, reason: r.error });
      continue;
    }
    packages[name] = { latest: r.latest, observedAt: today, source: r.source };
  }
  const snap: EcosystemSnapshot = { ecosystem, observedAt: today, packages };
  const rel = snapshotPathFor(ecosystem);
  const abs = joinRepoPath(root, rel);
  mkdirSync(joinRepoPath(root, SNAPSHOT_DIR), { recursive: true });
  const w = writeTextIfChanged(abs, serializeSnapshot(snap));
  if (!w.ok) throw new Error(`cannot write ${rel}: ${w.error.kind}: ${w.error.message}`);
  return {
    ecosystem,
    resolved: Object.keys(packages).length,
    failed,
    written: !w.value.unchanged,
    path: rel,
  };
}
