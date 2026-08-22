#!/usr/bin/env bun
// src/Core.TypeScript/cluster/reason-truth.ts
//
// IS THE REASON TRUE? -- the half every reasoned-exclusion registry in this
// tree was missing (081M0KRQP56087G0R000BK28QS).
//
// -- THE DEFECT THIS EXISTS FOR, stated by the check that could not catch it -
// `auditDevExclusionReasons` (argocd-health-test.ts) audits the dev-exclusion
// registry in four directions, and its own header says what none of them do:
//
//     "all four directions check that a reason is PRESENT and names a lift
//      condition. NONE of them checks that the reason is TRUE. [...] a false
//      sentence with a `LIFTS WHEN:` clause satisfies every mechanical
//      property it has."
//
// That was not a hypothetical. Two measured instances, both on 2026-08-21:
//
//   temporal  #13472 recorded "ITS CHART HAS NO PERSISTENCE STORE CONFIGURED,
//             so it does not render [...] carried as an acknowledged
//             `helm-template-failed` row in its baseline". #13469 merged forty
//             minutes later, wired the datastore, re-measured the render as OK
//             and DELETED that baseline row. The reason was false on merge and
//             both audit directions stayed green through it.
//
//   oz        `audit-chart-target-revisions.ts` carried an acknowledgement
//             saying the replacement chart versions "are not drop-in for the
//             pinned values in this manifest". #13471 rendered all four
//             published versions against that Application's own valuesObject
//             and got an identical storage contract from every one. It was a
//             plausible sentence nobody had ever checked, and it was false.
//
// -- WHAT IS CHECKABLE, AND WHAT IS NOT -----------------------------------
// A reason is prose, and prose about behaviour nobody measures cannot be
// verified by a program. Pattern-matching that prose and calling the result
// verification would be a NEW vacuity wearing this file's name -- the exact
// failure this file exists to remove. So the split is drawn explicitly:
//
//   CHECKABLE  A reason that CITES an artifact the tree already holds. The
//              citation names a baseline row, a rendered app, a chart pin, a
//              published version, a repo path, a glob entry, a CI job. Each is
//              resolved against that artifact and must still hold. This is the
//              drift-checked-acknowledgement pattern (`staleUnrenderableKeys`,
//              `ACKNOWLEDGED_UNPUBLISHED`'s both-directions check) generalised
//              from a registry's KEYS to the claims inside its prose.
//
//   NOT        Everything else. Counted, printed by name as `uncited`, and
//              NEVER reported as verified. A pass here states its own scope.
//
// -- WHY A TYPED CITATION AND NOT A PROSE SCANNER -------------------------
// The tempting implementation reads the sentence: find "does not render", find
// the app name, contradict it with the snapshot. It cannot work, and the
// current `temporal` reason is the counter-example that proves it -- that
// reason names `helm-template-failed` in order to say the row was RETIRED. A
// scanner that reddens on the token reddens the honest correction; one that
// tries to detect negation is guessing at English in a gate. Polarity has to
// be DECLARED, not inferred, so a claim is written as a value:
//
//     [cite: unrenderable full-ai-cluster/temporal helm-template-failed]
//     [cite: no-unrenderable full-ai-cluster/temporal]
//
// Both are one token apart and mean opposite things; each is checked against
// the same artifact. The prose stays prose, and the CLAIM is the typed part.
//
// -- THE HOLE THAT LEAVES, AND ITS GUARD ----------------------------------
// A typed citation is opt-in, so the obvious dodge is to write the claim in
// prose and cite nothing. `unbound-identifier` refuses exactly that, over a
// CLOSED vocabulary this repo owns: the render failure classes emitted by
// `rendered-storage-claims.ts` (`helm-template-failed`, `helm-pull-failed`,
// ...). Naming one in a reason without binding a citation for the subject is a
// finding. The vocabulary is small and stated rather than open-ended, because a
// guard whose scope nobody can enumerate is the thing this file refuses.
//
// -- WHAT THIS DOES NOT CLAIM, said plainly -------------------------------
// A citation is only as good as the artifact behind it. `renders` is decided by
// a checked-in snapshot of `helm template`, which is a measurement of the CHART,
// never of a live cluster. `unpublished` is decided by a dated roster snapshot.
// And a reason can be false in a way no artifact in this tree records at all --
// oz's "not drop-in" was such a claim, and what this file would have caught
// there is the narrower fact that the reason was anchored to a pin the tree no
// longer held. That is a real catch and it is not the same as reading the
// sentence. The honest summary: this makes a reason's ANCHORS checkable, and
// leaves its prose to a reader.
//
// Usage:
//   bun src/Core.TypeScript/cluster/reason-truth.ts
//   bun src/Core.TypeScript/cluster/reason-truth.ts --json
//
// Exit codes: 0 every citation holds, 1 a citation is refuted / malformed / an
// identifier is unbound, 2 IO or usage.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { DEFAULT_ROOT_DEV_CATALOG } from "./ports.ts";
import {
  discoverApplications,
  loadBaseline,
  loadSnapshot,
  applicationManifestPaths,
  type ApplicationSource,
  type Baseline,
  type RenderSnapshot,
} from "./rendered-storage-claims.ts";
import {
  devLaneAppliedDirs,
  envelopeBudget,
  loadResourceCatalogue,
  resourceTotal,
  type ResourceCatalogue,
} from "./storage-profiles.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const ROSTER_PATH = "src/Core.TypeScript/hygiene/published-chart-versions.json";
const WORKFLOWS_DIR = ".github/workflows";
const APPLICATIONS_TREE = "full-ai-cluster/k8s/applications";
const FULL_AI_CLUSTER_CATALOGUE = "full-ai-cluster/k8s/storage-profiles.json";
const RESOURCE_CATALOGUE_MISSING =
  `this tree has no readable ${FULL_AI_CLUSTER_CATALOGUE}, so a capacity claim cannot be decided here -- ` +
  `refused rather than passed, because an undecidable claim reported as checked is the defect this file exists for`;

// ---------------------------------------------------------------------------
// The citation grammar
// ---------------------------------------------------------------------------

/**
 * Every citation kind, its arity, and the artifact that decides it.
 *
 * Kinds come in polarity PAIRS wherever an absence is as claimable as a
 * presence (`unrenderable`/`no-unrenderable`, `renders`/`renders-not`,
 * `published`/`unpublished`, `glob-defers`/`glob-applies`). That is what lets a
 * correction be written as a checked claim instead of as unfalsifiable prose
 * about a claim that used to be true.
 */
export type CitationKind =
  | "path"
  | "unrenderable"
  | "no-unrenderable"
  | "renders"
  | "renders-not"
  | "pvc-class"
  | "pvc-total"
  | "no-pvc"
  | "chart-pin"
  | "published"
  | "unpublished"
  | "glob-defers"
  | "glob-applies"
  | "workflow-job"
  | "resource-rung"
  | "lane-cpu";

const CITATION_ARITY: Readonly<Record<CitationKind, number>> = {
  path: 1,
  unrenderable: 2,
  "no-unrenderable": 1,
  renders: 1,
  "renders-not": 1,
  "pvc-class": 2,
  "pvc-total": 2,
  "no-pvc": 1,
  "chart-pin": 3,
  published: 2,
  unpublished: 2,
  "glob-defers": 1,
  "glob-applies": 1,
  "workflow-job": 2,
  "resource-rung": 3,
  "lane-cpu": 3,
};

const CITATION_KINDS: ReadonlySet<string> = new Set(Object.keys(CITATION_ARITY));

export interface Citation {
  readonly kind: CitationKind;
  readonly args: readonly string[];
  /** The literal `[cite: ...]` text, so a finding can quote what it read. */
  readonly raw: string;
}

export interface MalformedCitation {
  readonly raw: string;
  readonly detail: string;
}

export interface ParsedCitations {
  readonly citations: readonly Citation[];
  readonly malformed: readonly MalformedCitation[];
}

const CITATION_PATTERN = /\[cite:([^\]]*)\]/g;

/**
 * Split on whitespace, keeping double-quoted runs together.
 *
 * Needed because a CI job name has spaces in it (`"live kind Cilium CNI"`), and
 * a citation that could not name one would leave the largest class of stale
 * reference in this repo -- a job that was renamed -- outside the check.
 */
export function splitCitationArgs(body: string): readonly string[] {
  const args: string[] = [];
  let current = "";
  let quoted = false;
  let started = false;
  for (const character of body) {
    if (character === '"') {
      quoted = !quoted;
      started = true;
      continue;
    }
    if (!quoted && /\s/.test(character)) {
      if (started) args.push(current);
      current = "";
      started = false;
      continue;
    }
    current += character;
    started = true;
  }
  if (started) args.push(current);
  return args;
}

/**
 * Pull every `[cite: ...]` out of a reason.
 *
 * An unknown kind or a wrong argument count is MALFORMED, never skipped: a
 * citation nothing evaluates is indistinguishable, in the exit code, from one
 * that held -- which is the defect class this whole file is about.
 */
export function extractCitations(text: string): ParsedCitations {
  const citations: Citation[] = [];
  const malformed: MalformedCitation[] = [];
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const raw = match[0];
    const args = splitCitationArgs(match[1] ?? "");
    const kind = args[0];
    if (kind === undefined || !CITATION_KINDS.has(kind)) {
      malformed.push({
        raw,
        detail:
          kind === undefined
            ? "empty citation"
            : `unknown citation kind "${kind}" -- known kinds: ${[...CITATION_KINDS].sort().join(", ")}`,
      });
      continue;
    }
    const rest = args.slice(1);
    const expected = CITATION_ARITY[kind as CitationKind];
    if (rest.length !== expected) {
      malformed.push({
        raw,
        detail: `"${kind}" takes ${String(expected)} argument(s), got ${String(rest.length)}`,
      });
      continue;
    }
    citations.push({ kind: kind as CitationKind, args: rest, raw });
  }
  return { citations, malformed };
}

// ---------------------------------------------------------------------------
// The evidence the citations are resolved against
// ---------------------------------------------------------------------------

export interface Evidence {
  readonly repoRoot: string;
  readonly baseline: Baseline;
  readonly snapshot: RenderSnapshot | null;
  /**
   * Does the snapshot still cover the tree it is being asked about?
   *
   * `appsDiscovered` is compared against the live manifest count. A snapshot
   * measured over 53 Applications says nothing about a 54th, so a render claim
   * resolved against it would be an unchecked claim reported as a checked one.
   */
  readonly snapshotCoversTree: boolean;
  readonly snapshotAppCount: number;
  readonly liveAppCount: number;
  readonly sources: readonly ApplicationSource[];
  /** chart name -> every version any rostered repository publishes for it. */
  readonly publishedVersions: ReadonlyMap<string, ReadonlySet<string>>;
  readonly globDeferred: ReadonlySet<string>;
  /** workflow file name -> job ids AND job names (expressions stripped). */
  readonly workflowJobs: ReadonlyMap<string, ReadonlySet<string>>;
  /**
   * The CPU/memory rung catalogue, or `null` when this tree has none.
   *
   * `null` is a REFUSAL, never a pass: a capacity claim resolved against a
   * catalogue that is not there would be an unchecked number reported as a
   * checked one, which is the whole defect this file exists for.
   */
  readonly resourceCatalogue: ResourceCatalogue | null;
  /** The Application directories the dev lane's root catalogue actually applies. */
  readonly devLaneDirs: readonly string[];
}

/** Read a file, or `null` when it is not there -- one syscall, one answer. */
function readIfPresent(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if ((error as NodeJS.ErrnoException).code === "EISDIR") return null;
    throw error;
  }
}

/**
 * `${{ matrix.runner }}` and friends are removed before a job name is compared,
 * so a citation names the stable half of the name and a matrix expansion does
 * not have to be transcribed into a reason.
 */
export function normalizeJobName(name: string): string {
  return name
    .replace(/\$\{\{[^}]*\}\}/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readWorkflowJobs(repoRoot: string): ReadonlyMap<string, ReadonlySet<string>> {
  const dir = resolve(repoRoot, WORKFLOWS_DIR);
  let entries: readonly string[];
  try {
    entries = readdirSync(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw error;
  }
  const jobs = new Map<string, ReadonlySet<string>>();
  for (const entry of entries) {
    if (!entry.endsWith(".yml") && !entry.endsWith(".yaml")) continue;
    const text = readIfPresent(join(dir, entry));
    if (text === null) continue;
    const names = new Set<string>();
    try {
      const document = parseYaml(text) as { jobs?: Record<string, { name?: unknown }> } | null;
      for (const [id, job] of Object.entries(document?.jobs ?? {})) {
        names.add(id);
        if (typeof job?.name === "string") names.add(normalizeJobName(job.name));
      }
    } catch {
      // A workflow this repo cannot parse is a separate defect with its own
      // lint; here it contributes no job names, so a citation into it fails
      // rather than passing on an empty parse.
    }
    jobs.set(entry, names);
  }
  return jobs;
}

function readPublishedVersions(repoRoot: string): ReadonlyMap<string, ReadonlySet<string>> {
  const text = readIfPresent(resolve(repoRoot, ROSTER_PATH));
  if (text === null) return new Map();
  const parsed = JSON.parse(text) as { entries?: Record<string, { chart?: unknown; versions?: unknown }> };
  const byChart = new Map<string, Set<string>>();
  for (const entry of Object.values(parsed.entries ?? {})) {
    if (typeof entry.chart !== "string" || !Array.isArray(entry.versions)) continue;
    const versions = byChart.get(entry.chart) ?? new Set<string>();
    for (const version of entry.versions) if (typeof version === "string") versions.add(version);
    byChart.set(entry.chart, versions);
  }
  return byChart;
}

/** The directories `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` keeps off the dev cluster. */
export function globDeferredDirs(excludeGlob: string): ReadonlySet<string> {
  return new Set(
    excludeGlob
      .replace(/^\{/, "")
      .replace(/\}$/, "")
      .split(",")
      .map((entry) => entry.trim().replace(/\/\*\*$/, ""))
      .filter((entry) => entry.length > 0),
  );
}

export function loadEvidence(
  repoRoot: string = REPO_ROOT,
  excludeGlob: string = DEFAULT_ROOT_DEV_CATALOG.excludeGlob,
): Evidence {
  const snapshot = loadSnapshot(undefined, repoRoot);
  const liveAppCount = applicationManifestPaths(repoRoot).length;
  return {
    repoRoot,
    baseline: loadBaseline(undefined, repoRoot),
    snapshot,
    snapshotCoversTree: snapshot !== null && snapshot.appsDiscovered === liveAppCount,
    snapshotAppCount: snapshot?.appsDiscovered ?? 0,
    liveAppCount,
    sources: discoverApplications(repoRoot),
    publishedVersions: readPublishedVersions(repoRoot),
    globDeferred: globDeferredDirs(excludeGlob),
    workflowJobs: readWorkflowJobs(repoRoot),
    ...loadResourceEvidence(repoRoot, excludeGlob),
  };
}

/**
 * The two resource-ladder artifacts, loaded defensively.
 *
 * `loadResourceCatalogue` THROWS on a tree with no catalogue (or a malformed
 * one), and `loadEvidence` is deliberately callable against an arbitrary
 * `--repo-root` -- that is how the exit-1 path is exercised. So a missing
 * catalogue becomes `null` here and REFUTES at the citation, rather than
 * taking the whole audit down with an exception or, worse, defaulting to an
 * empty catalogue whose totals would all be zero and would silently agree with
 * nothing.
 */
function loadResourceEvidence(
  repoRoot: string,
  excludeGlob: string,
): Pick<Evidence, "resourceCatalogue" | "devLaneDirs"> {
  try {
    return {
      resourceCatalogue: loadResourceCatalogue(undefined, repoRoot),
      devLaneDirs: devLaneAppliedDirs(repoRoot, excludeGlob),
    };
  } catch {
    return { resourceCatalogue: null, devLaneDirs: [] };
  }
}

// ---------------------------------------------------------------------------
// Checking one citation
// ---------------------------------------------------------------------------

export type RefutationRule =
  | "malformed-citation"
  | "cited-path-missing"
  | "cited-line-out-of-range"
  | "cited-acknowledgement-retired"
  | "cited-absence-contradicted"
  | "render-claim-refuted"
  | "render-claim-unsupported"
  | "snapshot-coverage-stale"
  | "cited-storage-class-absent"
  | "cited-total-disagrees"
  | "cited-pvc-absence-contradicted"
  | "cited-app-unknown"
  | "cited-pin-moved"
  | "cited-version-published"
  | "cited-version-unpublished"
  | "roster-does-not-cover-chart"
  | "cited-glob-deferral-lifted"
  | "cited-glob-application-refuted"
  | "cited-workflow-missing"
  | "cited-workflow-job-missing"
  | "resource-catalogue-absent"
  | "cited-rung-unknown"
  | "cited-rung-disagrees"
  | "cited-lane-total-disagrees"
  | "cited-lane-verdict-disagrees"
  | "unbound-identifier";

export interface Refutation {
  readonly subject: string;
  readonly rule: RefutationRule;
  readonly citation: string;
  readonly detail: string;
}

export interface ReasonSubject {
  /** Registry key, e.g. `gitlab` -- what a reader sees in the finding. */
  readonly key: string;
  /** `<tree>/<app>`, used to resolve app-relative paths. Empty when not an app. */
  readonly appId: string;
  readonly text: string;
  /** Which registry the reason came from, so a finding says where to edit. */
  readonly registry: string;
}

/** The render failure classes `rendered-storage-claims.ts` emits -- a CLOSED set. */
export const RENDER_FAILURE_CLASSES: readonly string[] = [
  "helm-pull-failed",
  "helm-pull-produced-nothing",
  "helm-template-failed",
  "git-path-missing",
  "no-pinned-version",
];

function baselineUnrenderableClasses(baseline: Baseline, appId: string): readonly string[] {
  return baseline.unrenderable
    .filter((entry) => entry.key === appId || entry.key.startsWith(`${appId}@`))
    .map((entry) => entry.observed);
}

function snapshotUnrenderable(snapshot: RenderSnapshot, appId: string): boolean {
  return snapshot.unrenderable.some((app) => app.appId === appId);
}

function appDirOf(appId: string): string {
  const parts = appId.split("/");
  return parts[parts.length - 1] ?? appId;
}

function resolvePath(evidence: Evidence, subject: ReasonSubject, cited: string): string | null {
  const candidates = [resolve(evidence.repoRoot, cited)];
  if (subject.appId !== "") {
    candidates.push(resolve(evidence.repoRoot, APPLICATIONS_TREE, appDirOf(subject.appId), cited));
  }
  for (const candidate of candidates) {
    const text = readIfPresent(candidate);
    if (text !== null) return text;
  }
  return null;
}

/**
 * One citation, resolved against the tree. `null` means it holds.
 *
 * Every branch that CANNOT decide returns a refutation rather than `null` --
 * a missing snapshot, a roster that does not cover the chart, an unknown app.
 * An undecidable citation reported as holding is a check that did not run
 * wearing the face of one that passed, which is the failure this file exists
 * to remove rather than to commit.
 */
export function checkCitation(citation: Citation, evidence: Evidence, subject: ReasonSubject): Refutation | null {
  const refute = (rule: RefutationRule, detail: string): Refutation => ({
    subject: `${subject.registry}[${subject.key}]`,
    rule,
    citation: citation.raw,
    detail,
  });
  /**
   * Did the snapshot actually MEASURE the app this claim is about?
   *
   * Two ways to establish it, and neither is an assumption. DEMONSTRATED: the
   * app appears in the snapshot's own rows (rendered or unrenderable), so it
   * was rendered whatever else has changed since. INHERITED: `appsDiscovered`
   * still equals the live manifest count, so every Application in the tree was
   * covered -- which is the only way a claim about an app with NO rows (a chart
   * that renders zero PersistentVolumeClaims) can be decided at all.
   *
   * Neither holds ⇒ refuse. An app the snapshot never saw is 0 bytes of
   * evidence, and reporting a claim about it as checked is the defect this file
   * exists for.
   */
  const needSnapshot = (appId: string): Refutation | null => {
    if (evidence.snapshot === null) {
      return refute("snapshot-coverage-stale", `no render snapshot is checked in, so this claim cannot be decided`);
    }
    const demonstrated =
      evidence.snapshot.rendered.some((pvc) => pvc.appId === appId) ||
      evidence.snapshot.unrenderable.some((app) => app.appId === appId);
    if (demonstrated || evidence.snapshotCoversTree) return null;
    return refute(
      "snapshot-coverage-stale",
      `the snapshot measured ${String(evidence.snapshotAppCount)} Applications and the tree now has ` +
        `${String(evidence.liveAppCount)}, and ${appId} is in none of its rows -- so it cannot say whether this ` +
        `claim holds. Re-measure with ` +
        `\`bun src/Core.TypeScript/cluster/rendered-storage-claims.ts --write-snapshot\``,
    );
  };
  const args = citation.args;
  const arg = (index: number): string => args[index] ?? "";

  switch (citation.kind) {
    case "path": {
      const [cited, line] = arg(0).split(":");
      const text = resolvePath(evidence, subject, cited ?? "");
      if (text === null) return refute("cited-path-missing", `${arg(0)} does not resolve to a file in this tree`);
      if (line !== undefined && line !== "") {
        const wanted = Number.parseInt(line, 10);
        const lines = text.split("\n").length;
        if (!Number.isFinite(wanted) || wanted < 1 || wanted > lines) {
          return refute(
            "cited-line-out-of-range",
            `${arg(0)} names line ${line}, and that file has ${String(lines)} lines`,
          );
        }
      }
      return null;
    }
    case "unrenderable": {
      const classes = baselineUnrenderableClasses(evidence.baseline, arg(0));
      if (classes.includes(arg(1))) return null;
      return refute(
        "cited-acknowledgement-retired",
        classes.length === 0
          ? `the baseline carries no unrenderable acknowledgement for ${arg(0)} at all -- it was retired, and this ` +
              `reason still cites it`
          : `the baseline's acknowledgement for ${arg(0)} is "${classes.join(", ")}", not "${arg(1)}"`,
      );
    }
    case "no-unrenderable": {
      const classes = baselineUnrenderableClasses(evidence.baseline, arg(0));
      if (classes.length === 0) return null;
      return refute(
        "cited-absence-contradicted",
        `the baseline DOES carry an unrenderable acknowledgement for ${arg(0)}: "${classes.join(", ")}"`,
      );
    }
    case "renders": {
      const stale = needSnapshot(arg(0));
      if (stale !== null) return stale;
      if (evidence.snapshot === null) return stale;
      if (!snapshotUnrenderable(evidence.snapshot, arg(0))) return null;
      return refute(
        "render-claim-unsupported",
        `the measured snapshot lists ${arg(0)} as UNRENDERABLE, so "it renders" is not what the tree records`,
      );
    }
    case "renders-not": {
      const stale = needSnapshot(arg(0));
      if (stale !== null) return stale;
      if (evidence.snapshot === null) return stale;
      if (snapshotUnrenderable(evidence.snapshot, arg(0))) return null;
      return refute(
        "render-claim-refuted",
        `the measured snapshot (${evidence.snapshot.measuredOn}) rendered ${arg(0)} -- it is not in the ` +
          `unrenderable list, so a reason saying it cannot render is refuted by data already in this tree`,
      );
    }
    case "pvc-class": {
      const stale = needSnapshot(arg(0));
      if (stale !== null) return stale;
      if (evidence.snapshot === null) return stale;
      const rows = evidence.snapshot.rendered.filter((pvc) => pvc.appId === arg(0));
      if (rows.some((pvc) => pvc.storageClassName === arg(1))) return null;
      return refute(
        "cited-storage-class-absent",
        rows.length === 0
          ? `${arg(0)} renders no PersistentVolumeClaim at all, so it cannot be requesting "${arg(1)}"`
          : `${arg(0)} renders ${String(rows.length)} claim(s), on ` +
              `${[...new Set(rows.map((pvc) => pvc.storageClassName || "<cluster default>"))].join(", ")} -- ` +
              `not "${arg(1)}"`,
      );
    }
    case "pvc-total": {
      const stale = needSnapshot(arg(0));
      if (stale !== null) return stale;
      if (evidence.snapshot === null) return stale;
      const rows = evidence.snapshot.rendered.filter((pvc) => pvc.appId === arg(0));
      const total = rows.reduce((sum, pvc) => sum + (pvc.gibibytes ?? 0) * pvc.count, 0);
      const claimed = Number.parseInt(arg(1), 10);
      if (Number.isFinite(claimed) && total === claimed) return null;
      return refute(
        "cited-total-disagrees",
        `${arg(0)} renders ${String(total)} GiB across ${String(rows.length)} claim(s), not ${arg(1)} GiB -- a ` +
          `number quoted in prose drifts silently the moment the chart or the values move`,
      );
    }
    case "no-pvc": {
      const stale = needSnapshot(arg(0));
      if (stale !== null) return stale;
      if (evidence.snapshot === null) return stale;
      const rows = evidence.snapshot.rendered.filter((pvc) => pvc.appId === arg(0));
      if (rows.length === 0) return null;
      return refute(
        "cited-pvc-absence-contradicted",
        `${arg(0)} renders ${String(rows.length)} PersistentVolumeClaim(s): ` +
          `${rows.map((pvc) => `${pvc.name} ${pvc.size}`).join(", ")}`,
      );
    }
    case "chart-pin": {
      const sources = evidence.sources.filter((source) => source.appId === arg(0));
      if (sources.length === 0)
        return refute("cited-app-unknown", `no Application with appId ${arg(0)} is in the tree`);
      const forChart = sources.filter((source) => source.chart === arg(1));
      if (forChart.some((source) => source.targetRevision === arg(2))) return null;
      return refute(
        "cited-pin-moved",
        forChart.length === 0
          ? `${arg(0)} sources no chart named "${arg(1)}" (it sources ` +
              `${sources.map((source) => source.chart || source.gitPath || "<git-path>").join(", ")})`
          : `${arg(0)} pins ${arg(1)} at ${forChart.map((source) => source.targetRevision).join(", ")}, ` +
              `not ${arg(2)} -- the reason outlived the pin it was written about`,
      );
    }
    case "published":
    case "unpublished": {
      const versions = evidence.publishedVersions.get(arg(0));
      if (versions === undefined) {
        return refute(
          "roster-does-not-cover-chart",
          `${ROSTER_PATH} has no entry for chart "${arg(0)}", so this claim cannot be decided offline -- refresh ` +
            `with \`bun src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts --refresh\``,
        );
      }
      const present = versions.has(arg(1));
      if (citation.kind === "published" && present) return null;
      if (citation.kind === "unpublished" && !present) return null;
      return present
        ? refute("cited-version-published", `the roster DOES list ${arg(0)} ${arg(1)} as published`)
        : refute("cited-version-unpublished", `the roster does not list ${arg(0)} ${arg(1)} as published`);
    }
    case "glob-defers": {
      if (evidence.globDeferred.has(arg(0))) return null;
      return refute(
        "cited-glob-deferral-lifted",
        `${arg(0)} is no longer named in DEFAULT_ROOT_DEV_CATALOG.excludeGlob, so the dev lane DOES apply it`,
      );
    }
    case "glob-applies": {
      if (!evidence.globDeferred.has(arg(0))) return null;
      return refute(
        "cited-glob-application-refuted",
        `${arg(0)} IS named in DEFAULT_ROOT_DEV_CATALOG.excludeGlob, so the dev lane never applies it`,
      );
    }
    case "workflow-job": {
      const jobs = evidence.workflowJobs.get(arg(0));
      if (jobs === undefined) return refute("cited-workflow-missing", `${WORKFLOWS_DIR}/${arg(0)} does not exist`);
      if (jobs.has(normalizeJobName(arg(1)))) return null;
      return refute(
        "cited-workflow-job-missing",
        `${WORKFLOWS_DIR}/${arg(0)} declares no job named "${arg(1)}" -- a cited lane that was renamed or deleted ` +
          `leaves the reason resting on a job nobody runs`,
      );
    }
    case "resource-rung": {
      // `[cite: resource-rung <dir> <profile> <cpuMillis>]`
      //
      // What ONE Application reserves at ONE rung, pods included. This is the
      // citation for "hindsight asks for 1000m", and it exists because that
      // sentence is the one a reader is most likely to act on -- it is the
      // number somebody reaches for when they want a pod to schedule, and a
      // reason that states it from memory is a reason that will be wrong the
      // first time anyone shrinks the app.
      const catalogue = evidence.resourceCatalogue;
      if (catalogue === null) return refute("resource-catalogue-absent", RESOURCE_CATALOGUE_MISSING);
      const rows = catalogue.claims.filter((claim) => claim.dir === arg(0));
      if (rows.length === 0) {
        const ungoverned = catalogue.ungoverned.some((app) => app.dir === arg(0));
        return refute(
          "cited-rung-unknown",
          ungoverned
            ? `${arg(0)} is an UNGOVERNED row: no rung prices it, so it has no per-profile number to cite`
            : `${FULL_AI_CLUSTER_CATALOGUE} has no resourceClaims row for directory "${arg(0)}"`,
        );
      }
      if (!catalogue.profiles.includes(arg(1))) {
        return refute(
          "cited-rung-unknown",
          `"${arg(1)}" is not a rung -- ${FULL_AI_CLUSTER_CATALOGUE} declares ${catalogue.profiles.join(", ")}`,
        );
      }
      const measured = rows.reduce((sum, claim) => sum + (claim.cpuMillis[arg(1)] ?? 0) * claim.pods, 0);
      const claimed = Number.parseInt(arg(2), 10);
      if (Number.isFinite(claimed) && measured === claimed) return null;
      return refute(
        "cited-rung-disagrees",
        `${arg(0)} at rung "${arg(1)}" totals ${String(measured)}m across ${String(rows.length)} row(s), ` +
          `not ${arg(2)}m -- the reason outlived the ladder it was written against`,
      );
    }
    case "lane-cpu": {
      // `[cite: lane-cpu <profile> <cpuMillis> fits|over]`
      //
      // The WHOLE dev lane at one rung, and its verdict against the runner
      // budget. The pair is the point: a reason that blames one Application for
      // a lane that does not fit is only honest if the lane-wide number is on
      // the record beside it, and `fits`/`over` is a polarity pair for the same
      // reason every other kind here has one -- "metal does not fit" and "dev
      // does" are opposite claims about the same artifact, and both are things
      // a reason wants to assert.
      const catalogue = evidence.resourceCatalogue;
      if (catalogue === null) return refute("resource-catalogue-absent", RESOURCE_CATALOGUE_MISSING);
      if (!catalogue.profiles.includes(arg(0))) {
        return refute(
          "cited-rung-unknown",
          `"${arg(0)}" is not a rung -- ${FULL_AI_CLUSTER_CATALOGUE} declares ${catalogue.profiles.join(", ")}`,
        );
      }
      const verdictWord = arg(2);
      if (verdictWord !== "fits" && verdictWord !== "over") {
        return refute(
          "cited-lane-verdict-disagrees",
          `the third argument must be "fits" or "over", not "${verdictWord}" -- a verdict left off would make ` +
            `this citation a number with no claim attached to it`,
        );
      }
      const total = resourceTotal(catalogue, arg(0), evidence.devLaneDirs);
      const claimed = Number.parseInt(arg(1), 10);
      if (!Number.isFinite(claimed) || total.cpuMillis !== claimed) {
        return refute(
          "cited-lane-total-disagrees",
          `the dev lane at rung "${arg(0)}" totals ${String(total.cpuMillis)}m across ` +
            `${String(evidence.devLaneDirs.length)} Applications, not ${arg(1)}m`,
        );
      }
      const budget = envelopeBudget(catalogue.envelope);
      const fits = total.cpuMillis <= budget.cpuMillis;
      if (fits === (verdictWord === "fits")) return null;
      return refute(
        "cited-lane-verdict-disagrees",
        `the reason says the lane is "${verdictWord}" at rung "${arg(0)}", but ${String(total.cpuMillis)}m ` +
          `against a ${String(budget.cpuMillis)}m budget ${fits ? "FITS" : "does NOT fit"}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// The audit over a registry of reasons
// ---------------------------------------------------------------------------

export interface ReasonTruthReport {
  /** A citation the tree refutes, or one nothing can decide. Fatal. */
  readonly refuted: readonly Refutation[];
  /** A checkable identifier named in prose with no citation bound to it. Fatal. */
  readonly unbound: readonly Refutation[];
  /**
   * Subjects whose reason cites nothing at all. REPORTED, NOT FATAL -- this is
   * the honest limit written into the output rather than into a comment.
   */
  readonly uncited: readonly string[];
  readonly citationsChecked: number;
  readonly subjectsChecked: number;
}

/**
 * Check every reason in a registry.
 *
 * `unbound` fires only over `RENDER_FAILURE_CLASSES`, and only when the subject
 * carries no baseline citation of its own. It is deliberately narrow: the
 * alternative is a scanner that guesses which nouns in a sentence are claims,
 * and a guard whose scope cannot be enumerated cannot be audited either.
 */
export function auditReasonTruth(subjects: readonly ReasonSubject[], evidence: Evidence): ReasonTruthReport {
  const refuted: Refutation[] = [];
  const unbound: Refutation[] = [];
  const uncited: string[] = [];
  let citationsChecked = 0;

  for (const subject of subjects) {
    const parsed = extractCitations(subject.text);
    for (const bad of parsed.malformed) {
      refuted.push({
        subject: `${subject.registry}[${subject.key}]`,
        rule: "malformed-citation",
        citation: bad.raw,
        detail: bad.detail,
      });
    }
    for (const citation of parsed.citations) {
      citationsChecked += 1;
      const verdict = checkCitation(citation, evidence, subject);
      if (verdict !== null) refuted.push(verdict);
    }
    if (parsed.citations.length === 0 && parsed.malformed.length === 0) uncited.push(subject.key);

    const bindsBaseline = parsed.citations.some(
      (citation) =>
        (citation.kind === "unrenderable" || citation.kind === "no-unrenderable") && citation.args[0] === subject.appId,
    );
    if (!bindsBaseline) {
      for (const failureClass of RENDER_FAILURE_CLASSES) {
        if (!subject.text.includes(failureClass)) continue;
        unbound.push({
          subject: `${subject.registry}[${subject.key}]`,
          rule: "unbound-identifier",
          citation: failureClass,
          detail:
            `the reason names the render failure class "${failureClass}" and binds no citation for ` +
            `${subject.appId} -- write \`[cite: unrenderable ${subject.appId} ${failureClass}]\` if the ` +
            `acknowledgement is live, or \`[cite: no-unrenderable ${subject.appId}]\` if the reason is ` +
            `recording that it was retired`,
        });
      }
    }
  }

  return { refuted, unbound, uncited, citationsChecked, subjectsChecked: subjects.length };
}

export function reasonTruthExitCode(report: ReasonTruthReport): number {
  return report.refuted.length > 0 || report.unbound.length > 0 ? 1 : 0;
}

export function formatReasonTruthReport(report: ReasonTruthReport): string {
  const lines: string[] = [];
  lines.push(
    `reason-truth: ${String(report.citationsChecked)} citation(s) across ${String(report.subjectsChecked)} reason(s)`,
  );
  for (const finding of [...report.refuted, ...report.unbound]) {
    lines.push(`  REFUTED ${finding.subject} [${finding.rule}]`);
    lines.push(`    cited: ${finding.citation}`);
    lines.push(`    ${finding.detail}`);
  }
  lines.push(
    `  uncited (prose nothing here can check, counted so a pass states its scope): ${String(report.uncited.length)}` +
      (report.uncited.length === 0 ? "" : ` -- ${report.uncited.join(", ")}`),
  );
  lines.push(report.refuted.length + report.unbound.length === 0 ? "  every cited anchor still holds" : "  FAILED");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// The registries this repo has, turned into subjects
// ---------------------------------------------------------------------------

/** A `<dir> -> reason` registry over `full-ai-cluster/k8s/applications`. */
export function subjectsFromAppRegistry(
  registry: ReadonlyMap<string, string>,
  registryName: string,
  tree = "full-ai-cluster",
): readonly ReasonSubject[] {
  return [...registry].map(([key, text]) => ({ key, appId: `${tree}/${key}`, text, registry: registryName }));
}

async function main(argv: readonly string[]): Promise<never> {
  // Imported here rather than at module scope: `argocd-health-test.ts` is the
  // harness, and the harness must be able to import nothing from this file for
  // the dependency to stay one-way (registry -> checker, never back).
  const { DEV_EXCLUDED_REASONS, APPLIED_BUT_UNASSERTED_REASONS } = await import("./argocd-health-test.ts");
  // `--repo-root` exists so the EXIT CODE is testable. Pointed at a tree that
  // holds none of the cited artifacts, every citation is refuted and this
  // process must exit 1; a test spawns exactly that. Without it the only way to
  // exercise the exit path would be to break the registry on purpose, and an
  // exit code nothing exercises is the same defect one directory over.
  const rootFlag = argv.indexOf("--repo-root");
  const repoRoot = rootFlag >= 0 ? (argv[rootFlag + 1] ?? REPO_ROOT) : REPO_ROOT;
  const evidence = loadEvidence(repoRoot);
  const report = auditReasonTruth(
    [
      ...subjectsFromAppRegistry(DEV_EXCLUDED_REASONS, "DEV_EXCLUDED_REASONS"),
      ...subjectsFromAppRegistry(APPLIED_BUT_UNASSERTED_REASONS, "APPLIED_BUT_UNASSERTED_REASONS"),
    ],
    evidence,
  );
  process.stdout.write(
    argv.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : `${formatReasonTruthReport(report)}\n`,
  );
  process.exit(reasonTruthExitCode(report));
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
