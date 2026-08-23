// Rendered resource requests — does a DECLARED cpu/memory rung correspond to
// the requests the charts actually render, at BOTH rungs?
//
// WHY THIS EXISTS
// ---------------
// `full-ai-cluster/k8s/storage-profiles.json` carries a two-rung CPU/memory
// ladder (`dev`, `metal`) and `storage-profiles.ts` reads it. Both sides of
// that pair read OUR YAML: the catalogue records what we wrote into an
// Application's `valuesObject`, and `verifyResourceProfileApplied` reads the
// same scalar back out. Neither has ever asked the chart whether that value
// reaches a container's `resources.requests`.
//
// The ladder's own numbers say it was asked ONCE, by hand: `$comment_resources`
// records "MEASURED 2026-08-21 by `helm pull` at each pinned targetRevision
// followed by `helm template`", summing requests over every rendered container
// times its workload's replica count. That measurement is the provenance of
// every number the budget gate prints — and nothing in the repo re-runs it. A
// number whose provenance is a one-time manual render is a number that goes
// stale silently, which is precisely what `rendered-storage-claims.ts` was
// written to stop happening to the storage ladder.
//
// This module is that equivalent for CPU and memory.
//
// WHY BOTH RUNGS, AND WHY IT IS NOT DECORATIVE
// --------------------------------------------
// A rung is not a helm flag: it is a set of values written into each
// Application's own `valuesObject`. So "render at rung X" means overlay X's
// numbers onto the coordinates the catalogue names and template the pinned
// chart against the result. Doing that at BOTH rungs is what makes the check
// sharp, because the difference between the two renders is observable:
//
//   a governed row whose two rungs differ MUST move the render. If overlaying
//   `dev` and overlaying `metal` produce the same rendered requests, that row's
//   coordinate is INERT — the chart never reads it — and the rung it prices is
//   a number the cluster will never get.
//
// That is the CPU/memory form of the defect `inert-valuesobject-keys.ts` found
// four times in one day, and it is invisible to any check that reads only our
// side of the values file.
//
// WHAT IT CHECKS, AND WHY BOTH DIRECTIONS
// ---------------------------------------
//   1. declared app total != rendered app total, at either rung  -> the budget
//      is arithmetic over numbers the cluster does not get
//   2. a rendered request no catalogue row accounts for          -> the budget
//      UNDERSTATES, which is the direction that produces a Pending pod
//   3. a governed row whose rungs differ but whose render does not -> inert
//   4. unrenderable                                              -> named,
//      never skipped; an app nobody could check must not read as one that passed
//
// WHAT A REQUEST TOTAL IS, PRECISELY
// ----------------------------------
// Kubernetes schedules a pod on `max(sum(regular containers), max(init
// container))` per resource (init containers run to completion one at a time,
// so the pod's floor is the largest single one, not their sum). Sidecar
// containers — init containers with `restartPolicy: Always` — run alongside the
// regular ones and are SUMMED instead. This module implements that formula
// rather than summing everything, because summing init containers overstates
// every pod that has one and the overstatement is invisible in a total.
//
// UNRESERVED IS A REAL ANSWER. Most rendered containers request nothing at all
// (`resources: {}` chart defaults). Those pods are BestEffort; the scheduler
// admits any number of them and no arithmetic here ever sees them. Every total
// this module prints is a FLOOR on the requirement, never the requirement, and
// the report says so on every line it prints it.
//
// OFFLINE BY DEFAULT, against a checked-in snapshot of what `helm template`
// produced at each rung — same reason as its storage sibling: a gate that needs
// the network is a gate that can be unavailable, and an unavailable gate reads
// like a passing one. `--measure` re-renders and rewrites the snapshot; the
// snapshot is text, so every byte of a re-measurement is a readable diff.
//
// AND THE SNAPSHOT COMPARES COVERAGE, NOT ROWS. `rendered-storage-claims.ts`
// shipped a `snapshotDrift` that compared row sets, and it printed "the
// snapshot matches the live render" against a tree that had grown a whole
// Application the snapshot did not cover, because the new app rendered no rows
// to disagree about. Absence is not agreement. `snapshotDrift` below compares
// the APP-ID SET per rung first and only then the rows.

import { readFileSync, readdirSync, writeFileSync, type Dirent } from "node:fs";
import { join, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { stringCompare } from "../collation/collation.ts";
import {
  discoverApplications,
  includeMatcher,
  renderApplication,
  type ApplicationSource,
  type ManifestOverlay,
  type RenderOptions,
} from "./rendered-storage-claims.ts";
import { loadResourceCatalogue, type ResourceCatalogue, type ProfileFinding } from "./storage-profiles.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const DEFAULT_SNAPSHOT_PATH = "src/Core.TypeScript/cluster/rendered-resource-requests.snapshot.json";
export const DEFAULT_BASELINE_PATH = "src/Core.TypeScript/cluster/rendered-resource-requests.baseline.json";

// ---------------------------------------------------------------------------
// Kubernetes quantity parsing — CPU millicores and memory mebibytes
// ---------------------------------------------------------------------------

const CPU_QUANTITY = /^([0-9]*\.?[0-9]+)(m?)$/;
const MEMORY_SUFFIX: Readonly<Record<string, number>> = {
  "": 1 / 1024 ** 2,
  Ki: 1 / 1024,
  Mi: 1,
  Gi: 1024,
  Ti: 1024 ** 2,
  Pi: 1024 ** 3,
  K: 1000 / 1024 ** 2,
  k: 1000 / 1024 ** 2,
  M: 1000 ** 2 / 1024 ** 2,
  G: 1000 ** 3 / 1024 ** 2,
  T: 1000 ** 4 / 1024 ** 2,
};
const MEMORY_QUANTITY = /^([0-9]*\.?[0-9]+)([A-Za-z]*)$/;

/** `"250m"` -> 250, `"1"` -> 1000, `"0.5"` -> 500. `null` when it is not a CPU quantity. */
export function cpuToMillis(raw: string): number | null {
  const match = CPU_QUANTITY.exec(raw.trim());
  if (match === null) return null;
  const magnitude = Number(match[1]);
  if (!Number.isFinite(magnitude)) return null;
  return match[2] === "m" ? magnitude : magnitude * 1000;
}

/** `"512Mi"` -> 512, `"1Gi"` -> 1024. `null` when it is not a memory quantity. */
export function memoryToMib(raw: string): number | null {
  const match = MEMORY_QUANTITY.exec(raw.trim());
  if (match === null) return null;
  const magnitude = Number(match[1]);
  if (!Number.isFinite(magnitude)) return null;
  const factor = MEMORY_SUFFIX[match[2] ?? ""];
  return factor === undefined ? null : magnitude * factor;
}

// ---------------------------------------------------------------------------
// Extraction — what the render actually reserves
// ---------------------------------------------------------------------------

export interface ContainerRequest {
  /** `Kind/name` of the workload the pod template hangs off. */
  readonly workload: string;
  readonly container: string;
  /** `regular` | `init` | `sidecar` — the three the scheduler treats differently. */
  readonly role: "regular" | "init" | "sidecar";
  readonly cpuMillis: number;
  readonly memoryMib: number;
}

export interface RenderedPodSpec {
  readonly appId: string;
  readonly workload: string;
  /** Pod copies this template produces. A DaemonSet is 1 here — see `daemonSetNote`. */
  readonly replicas: number;
  readonly containers: readonly ContainerRequest[];
  /** Scheduler-effective per-pod reservation. */
  readonly cpuMillis: number;
  readonly memoryMib: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The scheduler's per-pod reservation.
 *
 * `max(sum(regular) + sum(sidecar), max(init))` per resource. Init containers
 * run to completion one at a time, so the pod's floor is the LARGEST single one
 * rather than their sum; a sidecar (an init container with
 * `restartPolicy: Always`) runs alongside the regular containers and is summed.
 * Summing every container instead would overstate every pod that has an init
 * container, and an overstatement is invisible once it is inside a total.
 */
export function podEffectiveRequest(containers: readonly ContainerRequest[]): {
  cpuMillis: number;
  memoryMib: number;
} {
  let cpuRunning = 0;
  let memRunning = 0;
  let cpuInitMax = 0;
  let memInitMax = 0;
  for (const container of containers) {
    if (container.role === "init") {
      cpuInitMax = Math.max(cpuInitMax, container.cpuMillis);
      memInitMax = Math.max(memInitMax, container.memoryMib);
      continue;
    }
    cpuRunning += container.cpuMillis;
    memRunning += container.memoryMib;
  }
  return { cpuMillis: Math.max(cpuRunning, cpuInitMax), memoryMib: Math.max(memRunning, memInitMax) };
}

const POD_TEMPLATE_AT: Readonly<Record<string, readonly string[]>> = {
  Deployment: ["spec", "template"],
  StatefulSet: ["spec", "template"],
  DaemonSet: ["spec", "template"],
  ReplicaSet: ["spec", "template"],
  Job: ["spec", "template"],
  CronJob: ["spec", "jobTemplate", "spec", "template"],
};

function getIn(root: unknown, path: readonly string[]): unknown {
  let cursor: unknown = root;
  for (const key of path) {
    cursor = asRecord(cursor)[key];
    if (cursor === undefined) return undefined;
  }
  return cursor;
}

function containersOf(podSpec: Record<string, unknown>): ContainerRequest[] {
  const out: ContainerRequest[] = [];
  for (const [key, role] of [
    ["containers", "regular"],
    ["initContainers", "init"],
  ] as const) {
    for (const raw of asArray(podSpec[key])) {
      const container = asRecord(raw);
      const requests = asRecord(asRecord(container.resources).requests);
      const cpuRaw = requests.cpu;
      const memRaw = requests.memory;
      const effectiveRole = role === "init" && container.restartPolicy === "Always" ? "sidecar" : role;
      out.push({
        workload: "",
        container: typeof container.name === "string" ? container.name : "(unnamed)",
        role: effectiveRole,
        cpuMillis:
          typeof cpuRaw === "string" ? (cpuToMillis(cpuRaw) ?? 0) : typeof cpuRaw === "number" ? cpuRaw * 1000 : 0,
        memoryMib:
          typeof memRaw === "string" ? (memoryToMib(memRaw) ?? 0) : typeof memRaw === "number" ? memRaw / 1024 ** 2 : 0,
      });
    }
  }
  return out;
}

/**
 * Every pod template in one Application's render, with its scheduler-effective
 * reservation and the number of copies it produces.
 *
 * A DaemonSet counts as ONE, and that is a stated limit rather than an
 * oversight: a DaemonSet's pod count is the node count, which is a property of
 * the cluster and not of the render. On the one-node kind lane it IS one; on a
 * four-node metal cluster it is four. `daemonSets` is reported separately so a
 * reader can multiply.
 */
export function extractRenderedRequests(
  appId: string,
  documents: readonly Record<string, unknown>[],
): RenderedPodSpec[] {
  const out: RenderedPodSpec[] = [];
  for (const doc of documents) {
    const kind = doc.kind;
    if (typeof kind !== "string") continue;
    const at = POD_TEMPLATE_AT[kind];
    if (at === undefined) continue;
    const template = getIn(doc, at);
    if (template === undefined) continue;
    const podSpec = asRecord(asRecord(template).spec);
    const name = typeof asRecord(doc.metadata).name === "string" ? String(asRecord(doc.metadata).name) : "";
    const workload = `${kind}/${name}`;
    const rawReplicas = kind === "DaemonSet" ? 1 : asRecord(doc.spec).replicas;
    const replicas = typeof rawReplicas === "number" && Number.isFinite(rawReplicas) ? rawReplicas : 1;
    const containers = containersOf(podSpec).map((container) => ({ ...container, workload }));
    const effective = podEffectiveRequest(containers);
    out.push({ appId, workload, replicas, containers, ...effective });
  }
  return out.sort((a, b) => stringCompare(a.workload, b.workload));
}

// ---------------------------------------------------------------------------
// Overlaying a rung onto an Application's own values
// ---------------------------------------------------------------------------

const VALUES_PREFIX = "spec.source.helm.valuesObject.";

/**
 * The TREE an appId belongs to — `full-ai-cluster/mimir` -> `full-ai-cluster`.
 *
 * Load-bearing, and it was missing for one draft of this file. The resource
 * catalogue's `dir` keys are relative to `full-ai-cluster/k8s/applications`,
 * while `discoverApplications` walks BOTH that tree and `infra/k8s/applications`
 * — which have an Application named `gitlab` and one named `cockroachdb` each.
 * Splitting on the first slash alone matched `infra/gitlab` against
 * `full-ai-cluster`'s gitlab row and reported a 50m disagreement about an app
 * the row has never described. A checker that attributes one tree's render to
 * another tree's declaration is manufacturing its own findings, which is the
 * one thing a findings list must never contain.
 */
export function appTreeOf(appId: string): string {
  const slash = appId.indexOf("/");
  return slash < 0 ? "" : appId.slice(0, slash);
}

/** The directory an appId names: `full-ai-cluster/mimir` -> `mimir`. */
export function appDirOf(appId: string): string {
  const slash = appId.indexOf("/");
  return slash < 0 ? appId : appId.slice(slash + 1);
}

/** The one tree the CPU/memory ladder's `dir` keys are relative to. */
export const GOVERNED_TREE = "full-ai-cluster";

function deepClone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? {})) as unknown;
}

function setIn(root: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let cursor = root;
  for (const key of path.slice(0, -1)) {
    const next = cursor[key];
    if (typeof next !== "object" || next === null || Array.isArray(next)) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  const last = path[path.length - 1];
  if (last !== undefined) cursor[last] = value;
}

function deleteIn(root: Record<string, unknown>, path: readonly string[]): void {
  let cursor: Record<string, unknown> = root;
  for (const key of path.slice(0, -1)) {
    const next = cursor[key];
    if (typeof next !== "object" || next === null || Array.isArray(next)) return;
    cursor = next as Record<string, unknown>;
  }
  const last = path[path.length - 1];
  if (last !== undefined) delete cursor[last];
}

/** `1000` -> `"1"`, `250` -> `"250m"` — the same rendering `storage-profiles.ts` writes. */
export function formatCpuQuantity(millis: number): string {
  return millis % 1000 === 0 ? String(millis / 1000) : `${String(millis)}m`;
}

/**
 * The Application as it would be if `profile` had been applied to the tree.
 *
 * A rung is not a helm flag: it is a set of values in the Application's own
 * `valuesObject`, so this writes the rung's numbers at exactly the coordinates
 * the catalogue names and hands the result to the same renderer ArgoCD's
 * template step would see. Zero is written as an ABSENT key, matching
 * `verifyResourceProfileApplied`'s reading — an absent request IS a zero
 * reservation in Kubernetes, and `cpu: 0` would be a different, stranger thing
 * to ship.
 *
 * Rows whose `requestsField` is NOT under `spec.source.helm.valuesObject.` are
 * returned in `unoverlayable` rather than skipped. A row this function cannot
 * express is a row whose rung the render never sees, and a render that silently
 * ignores a rung is the vacuity class: it would agree with every rung equally.
 */
export interface OverlayResult {
  readonly source: ApplicationSource;
  readonly applied: readonly string[];
  readonly unoverlayable: readonly string[];
  /**
   * Rung values destined for a `git-path` source's own manifests.
   *
   * The SAME catalogue row, the same two-rung ladder, the same `--apply` verb —
   * only the coordinate's address space differs, and it differs because ArgoCD
   * forces it to: an Application that syncs a raw directory has no values file
   * to write into. Empty for every helm-remote source.
   */
  readonly manifestOverlays: readonly ManifestOverlay[];
}

export function overlayRung(source: ApplicationSource, catalogue: ResourceCatalogue, profile: string): OverlayResult {
  const dir = appDirOf(source.appId);
  const values = deepClone(source.valuesObject) as Record<string, unknown>;
  const applied: string[] = [];
  const unoverlayable: string[] = [];
  const manifestOverlays: ManifestOverlay[] = [];
  for (const claim of catalogue.claims) {
    if (claim.dir !== dir) continue;
    const cpu = claim.cpuMillis[profile];
    const memory = claim.memoryMib[profile];
    if (cpu === undefined || memory === undefined) {
      unoverlayable.push(claim.id);
      continue;
    }
    const pairs = [
      ["cpu", cpu, formatCpuQuantity(cpu)],
      ["memory", memory, `${String(memory)}Mi`],
    ] as const;

    if (claim.requestsField.startsWith(VALUES_PREFIX)) {
      const base = claim.requestsField.slice(VALUES_PREFIX.length).split(".");
      for (const [suffix, millis, text] of pairs) {
        const path = [...base, suffix];
        if (millis === 0) deleteIn(values, path);
        else setIn(values, path, text);
      }
      applied.push(claim.id);
      continue;
    }

    // NOT a values coordinate. On a git-path Application that is not a defect —
    // it is the only coordinate there is, and the row is expressed as an
    // in-manifest overlay. `renderGitPath` writes it into the parsed document
    // before the render, so the two rungs produce two different renders exactly
    // as `valuesObject` does for a chart.
    if (source.kind === "git-path" && claimIsInsideGitPath(claim.path, source.gitPath)) {
      for (const [suffix, millis, text] of pairs) {
        manifestOverlays.push({
          path: claim.path,
          docIndex: claim.docIndex,
          field: `${claim.requestsField}.${suffix}`,
          value: millis === 0 ? null : text,
        });
      }
      applied.push(claim.id);
      continue;
    }

    // Neither a values coordinate nor a manifest this Application syncs. A rung
    // written nowhere would agree with every rung equally.
    unoverlayable.push(claim.id);
  }
  return {
    source: { ...source, valuesObject: values },
    applied: applied.sort((a, b) => stringCompare(a, b)),
    unoverlayable: unoverlayable.sort((a, b) => stringCompare(a, b)),
    manifestOverlays: manifestOverlays.sort((a, b) =>
      stringCompare(`${a.path}#${String(a.docIndex)}.${a.field}`, `${b.path}#${String(b.docIndex)}.${b.field}`),
    ),
  };
}

/**
 * Is `claimPath` a manifest the Application at `gitPath` actually syncs?
 *
 * Prefix equality on a SEGMENT boundary, never `startsWith` alone: `startsWith`
 * would match `.../applications/orleans-legacy/x.yaml` against a gitPath of
 * `.../applications/orleans`, and an overlay attributed to the wrong
 * Application is a finding the checker manufactured.
 */
export function claimIsInsideGitPath(claimPath: string, gitPath: string): boolean {
  if (gitPath === "") return false;
  return claimPath.startsWith(`${gitPath}/`);
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

export interface AppMeasurement {
  readonly appId: string;
  readonly cpuMillis: number;
  readonly memoryMib: number;
  readonly pods: number;
  readonly workloads: readonly {
    readonly workload: string;
    readonly replicas: number;
    readonly cpuMillis: number;
    readonly memoryMib: number;
  }[];
  /** Governed rows whose rung this render actually carried. */
  readonly overlaid: readonly string[];
}

export interface UnrenderableApp {
  readonly appId: string;
  readonly reason: string;
  readonly detail: string;
}

export interface ProfileMeasurement {
  readonly profile: string;
  readonly apps: readonly AppMeasurement[];
  readonly unrenderable: readonly UnrenderableApp[];
  readonly unoverlayable: readonly string[];
}

export interface RenderSnapshot {
  readonly measuredOn: string;
  /** Every Application id discovered, whether or not it rendered. Coverage, not rows. */
  readonly appsDiscovered: readonly string[];
  readonly profiles: readonly ProfileMeasurement[];
}

export function measureProfile(
  catalogue: ResourceCatalogue,
  profile: string,
  options: RenderOptions = {},
): ProfileMeasurement {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const apps: AppMeasurement[] = [];
  const unrenderable: UnrenderableApp[] = [];
  const unoverlayable = new Set<string>();
  for (const source of discoverApplications(repoRoot)) {
    const overlay = overlayRung(source, catalogue, profile);
    for (const id of overlay.unoverlayable) unoverlayable.add(id);
    const rendered = renderApplication(overlay.source, {
      ...options,
      manifestOverlays: overlay.manifestOverlays,
    });
    if (!rendered.ok) {
      unrenderable.push({ appId: source.appId, reason: rendered.reason, detail: rendered.detail });
      continue;
    }
    const specs = extractRenderedRequests(source.appId, rendered.documents);
    let cpuMillis = 0;
    let memoryMib = 0;
    let pods = 0;
    for (const spec of specs) {
      cpuMillis += spec.cpuMillis * spec.replicas;
      memoryMib += spec.memoryMib * spec.replicas;
      pods += spec.replicas;
    }
    apps.push({
      appId: source.appId,
      cpuMillis: Math.round(cpuMillis),
      memoryMib: Math.round(memoryMib),
      pods,
      workloads: specs.map((spec) => ({
        workload: spec.workload,
        replicas: spec.replicas,
        cpuMillis: Math.round(spec.cpuMillis),
        memoryMib: Math.round(spec.memoryMib),
      })),
      overlaid: overlay.applied,
    });
  }
  return {
    profile,
    apps: apps.sort((a, b) => stringCompare(a.appId, b.appId)),
    unrenderable: unrenderable.sort((a, b) => stringCompare(a.appId, b.appId)),
    unoverlayable: [...unoverlayable].sort((a, b) => stringCompare(a, b)),
  };
}

export function measureSnapshot(catalogue: ResourceCatalogue, options: RenderOptions = {}): RenderSnapshot {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  return {
    measuredOn: new Date().toISOString().slice(0, 10),
    appsDiscovered: discoverApplications(repoRoot)
      .map((source) => source.appId)
      .sort((a, b) => stringCompare(a, b)),
    profiles: catalogue.profiles.map((profile) => measureProfile(catalogue, profile, options)),
  };
}

/**
 * Read a file, or `null` when it is not there.
 *
 * ATTEMPT the read; do not `existsSync` first. The check-then-use pair is a
 * TOCTOU window (`js/file-system-race`, and this repo's own
 * `lint-check-then-use-file-races`): between the check and the read the path can
 * be created, deleted or replaced, so the answer the check returned is already
 * stale. One syscall, one answer — a miss IS the ENOENT.
 */
function readIfPresent(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function loadSnapshot(path = DEFAULT_SNAPSHOT_PATH, repoRoot = REPO_ROOT): RenderSnapshot | null {
  const text = readIfPresent(resolve(repoRoot, path));
  return text === null ? null : (JSON.parse(text) as RenderSnapshot);
}

export function writeSnapshot(snapshot: RenderSnapshot, path = DEFAULT_SNAPSHOT_PATH, repoRoot = REPO_ROOT): void {
  writeFileSync(resolve(repoRoot, path), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

// ---------------------------------------------------------------------------
// Coverage drift — the snapshot must be about THIS tree
// ---------------------------------------------------------------------------

/**
 * COVERAGE FIRST, then rows.
 *
 * `rendered-storage-claims.ts` shipped a drift check that compared row sets and
 * printed "the snapshot matches the live render" against a tree that had grown
 * an Application the snapshot did not cover — the new app rendered no rows, so
 * there was nothing to disagree about. Absence read as agreement. The app-id
 * set is compared here BEFORE any total is, and a rung missing from the
 * snapshot is a drift rather than a rung that agreed.
 */
export function snapshotCoverageDrift(
  snapshot: RenderSnapshot,
  discovered: readonly string[],
  profiles: readonly string[],
): readonly string[] {
  const drift: string[] = [];
  const covered = new Set(snapshot.appsDiscovered);
  for (const appId of [...discovered].sort((a, b) => stringCompare(a, b))) {
    if (!covered.has(appId)) {
      drift.push(`${appId}: discovered in the tree and absent from the snapshot — re-measure with --measure`);
    }
  }
  const live = new Set(discovered);
  for (const appId of [...covered].sort((a, b) => stringCompare(a, b))) {
    if (!live.has(appId)) drift.push(`${appId}: in the snapshot and no longer in the tree — stale, re-measure`);
  }
  const snapshotProfiles = new Set(snapshot.profiles.map((entry) => entry.profile));
  for (const profile of profiles) {
    if (!snapshotProfiles.has(profile)) {
      drift.push(`rung "${profile}": the catalogue declares it and the snapshot has no measurement for it`);
    }
  }
  for (const entry of snapshot.profiles) {
    if (!profiles.includes(entry.profile)) {
      drift.push(`rung "${entry.profile}": measured in the snapshot and no longer a rung of the catalogue`);
    }
    const measured = new Set(entry.apps.map((app) => app.appId));
    const named = new Set(entry.unrenderable.map((app) => app.appId));
    for (const appId of snapshot.appsDiscovered) {
      if (measured.has(appId) || named.has(appId)) continue;
      drift.push(
        `${appId} @ ${entry.profile}: discovered, neither measured nor named unrenderable — ` +
          `an app nobody rendered must never read as an app that agreed`,
      );
    }
  }
  return drift;
}

// ---------------------------------------------------------------------------
// Comparison — declared ladder vs measured render
// ---------------------------------------------------------------------------

/**
 * A hardcoded request in an in-repo manifest that NO RUNG CAN REACH.
 *
 * THIS IS THE CLASS-CLOSER, and it is deliberately independent of the snapshot.
 * Every other check in this file reads `rendered-resource-requests.snapshot.json`,
 * which means a new Application only gets checked once somebody re-runs
 * `--measure`. A git-path Application needs no helm and no network to render —
 * it is a directory of YAML — so this one reads the TREE, every time, and a new
 * raw manifest carrying `resources.requests` fails on the PR that adds it
 * rather than on the next measurement.
 *
 * The coordinate granularity is per CONTAINER, not per Application: a second
 * container growing a request inside an already-governed Application is the
 * same defect as a new Application growing one, and an Application-level check
 * would pass it.
 *
 * WHAT IT DOES NOT DO: it says nothing about whether the rung's NUMBER is
 * right. A row with `dev` equal to `metal` satisfies this check completely.
 * That is correct — the defect this closes is unreachability, not miscalibration,
 * and `inert-rung` already covers a rung that moves on paper and not in the
 * render.
 */
export interface UnreachableCoordinate {
  readonly appId: string;
  /** Repo-relative manifest the request literal lives in. */
  readonly path: string;
  readonly docIndex: number;
  readonly workload: string;
  readonly container: string;
  readonly requestsField: string;
  readonly cpuMillis: number;
  readonly memoryMib: number;
  readonly replicas: number;
}

/** `spec.template.spec` / `spec.jobTemplate.spec.template.spec`, or null for a kind with no pod template. */
function podTemplateBase(kind: string): string | null {
  if (kind === "CronJob") return "spec.jobTemplate.spec.template.spec";
  return POD_TEMPLATE_AT[kind] === undefined ? null : "spec.template.spec";
}

/**
 * Every container in every `git-path` Application whose manifest declares a
 * nonzero request, paired with the catalogue coordinate that would govern it.
 *
 * Reads the files the Application's own `directory.include` glob selects — the
 * same selection `renderGitPath` makes — so a manifest ArgoCD does not apply is
 * not reported as one it does.
 */
export function unreachableGitPathRequests(
  catalogue: ResourceCatalogue,
  repoRoot = REPO_ROOT,
): readonly UnreachableCoordinate[] {
  const governed = new Set<string>();
  for (const claim of catalogue.claims) {
    governed.add(`${claim.path}#${String(claim.docIndex)}|${claim.requestsField}`);
  }
  const out: UnreachableCoordinate[] = [];
  for (const source of discoverApplications(repoRoot)) {
    if (source.kind !== "git-path" || source.gitPath === "") continue;
    const abs = resolve(repoRoot, source.gitPath);
    const matches = includeMatcher(source.includeGlob);
    let entries: readonly Dirent[];
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const entry of [...entries].sort((a, b) => stringCompare(a.name, b.name))) {
      if (!entry.isFile() || !matches(entry.name)) continue;
      const relative = `${source.gitPath}/${entry.name}`;
      const text = readIfPresent(join(abs, entry.name));
      if (text === null) continue;
      parseAllDocuments(text).forEach((parsed, docIndex) => {
        const doc = parsed.toJS() as Record<string, unknown> | null;
        if (doc === null || typeof doc !== "object") return;
        const kind = typeof doc.kind === "string" ? doc.kind : "";
        const base = podTemplateBase(kind);
        if (base === null) return;
        const template = getIn(doc, POD_TEMPLATE_AT[kind] ?? []);
        const podSpec = asRecord(asRecord(template).spec);
        const name = typeof asRecord(doc.metadata).name === "string" ? String(asRecord(doc.metadata).name) : "";
        const rawReplicas = kind === "DaemonSet" ? 1 : asRecord(doc.spec).replicas;
        const replicas = typeof rawReplicas === "number" && Number.isFinite(rawReplicas) ? rawReplicas : 1;
        for (const [key, list] of [
          ["containers", asArray(podSpec.containers)],
          ["initContainers", asArray(podSpec.initContainers)],
        ] as const) {
          list.forEach((raw, index) => {
            const container = asRecord(raw);
            const requests = asRecord(asRecord(container.resources).requests);
            const cpuRaw = requests.cpu;
            const memRaw = requests.memory;
            const cpuMillis =
              typeof cpuRaw === "string" ? (cpuToMillis(cpuRaw) ?? 0) : typeof cpuRaw === "number" ? cpuRaw * 1000 : 0;
            const memoryMib =
              typeof memRaw === "string"
                ? (memoryToMib(memRaw) ?? 0)
                : typeof memRaw === "number"
                  ? memRaw / 1024 ** 2
                  : 0;
            if (cpuMillis === 0 && memoryMib === 0) return;
            const requestsField = `${base}.${key}[${String(index)}].resources.requests`;
            if (governed.has(`${relative}#${String(docIndex)}|${requestsField}`)) return;
            out.push({
              appId: source.appId,
              path: relative,
              docIndex,
              workload: `${kind}/${name}`,
              container: typeof container.name === "string" ? container.name : "(unnamed)",
              requestsField,
              cpuMillis,
              memoryMib,
              replicas,
            });
          });
        }
      });
    }
  }
  return out.sort((a, b) =>
    stringCompare(
      `${a.path}#${String(a.docIndex)}|${a.requestsField}`,
      `${b.path}#${String(b.docIndex)}|${b.requestsField}`,
    ),
  );
}

/**
 * The unreachable coordinates as findings, so they adjudicate against the same
 * baseline as everything else — with a reason and a lift condition, never a
 * silent exclusion list.
 *
 * `claimId` is the coordinate rather than a catalogue id BECAUSE THERE IS NO
 * CATALOGUE ID: the whole finding is that nothing in the catalogue names this
 * place.
 */
export function gitPathReachabilityFindings(
  catalogue: ResourceCatalogue,
  repoRoot = REPO_ROOT,
): readonly ResourceFinding[] {
  return unreachableGitPathRequests(catalogue, repoRoot).map((entry) => ({
    kind: "unreachable-git-path-request" as const,
    // THE REPLICA COUNT IS IN THE KEY ON PURPOSE. Four of these coordinates sit
    // on workloads with `replicas: 0` — real hardcoded requests that schedule
    // nothing today. They cannot be expressed as a resourceClaim at all, because
    // `pods` is validated `>= 1` and a claim for a zero-replica workload would
    // add a whole pod to every rung total. So they are acknowledged in the
    // baseline — and putting `x<replicas>` in the key means that scaling one of
    // them to 1 CHANGES THE KEY: the acknowledgement stops matching (a new open
    // finding) and simultaneously goes stale (the old entry matches nothing).
    // Both halves fail the audit, so the 4000m that vllm would land the moment
    // somebody bumps its replica count cannot arrive quietly.
    claimId: `${entry.path}#${String(entry.docIndex)}|${entry.requestsField}@x${String(entry.replicas)}`,
    profile: "*",
    problem:
      `${entry.appId} syncs this manifest from a raw git path, and ${entry.workload} container ` +
      `"${entry.container}" hardcodes ${String(entry.cpuMillis)}m / ${String(Math.round(entry.memoryMib))}Mi ` +
      `x${String(entry.replicas)} replica(s). NO RUNG REACHES IT — there is no resourceClaim naming this ` +
      `coordinate, so \`--resource-profile <rung> --apply\` cannot move it and every rung prices the same ` +
      `number. Add a resourceClaim with path "${entry.path}", docIndex ${String(entry.docIndex)} and ` +
      `requestsField "${entry.requestsField}"`,
  }));
}

export type ResourceMismatchKind =
  | "declared-total-mismatch"
  | "uncovered-application"
  | "inert-rung"
  | "unreachable-git-path-request"
  | "unrenderable"
  | "unoverlayable-row";

export interface ResourceFinding extends ProfileFinding {
  readonly kind: ResourceMismatchKind;
  readonly profile: string;
}

/** What the catalogue says one directory costs under `profile`, or null when nothing covers it. */
export function declaredAppTotal(
  catalogue: ResourceCatalogue,
  profile: string,
  dir: string,
  tree: string = GOVERNED_TREE,
): { cpuMillis: number; memoryMib: number; governed: boolean } | null {
  if (tree !== GOVERNED_TREE) return null;
  const governedRows = catalogue.claims.filter((claim) => claim.dir === dir);
  if (governedRows.length > 0) {
    let cpuMillis = 0;
    let memoryMib = 0;
    for (const claim of governedRows) {
      const cpu = claim.cpuMillis[profile];
      const memory = claim.memoryMib[profile];
      if (cpu === undefined || memory === undefined) return null;
      cpuMillis += cpu * claim.pods;
      memoryMib += memory * claim.pods;
    }
    return { cpuMillis, memoryMib, governed: true };
  }
  const ungoverned = catalogue.ungoverned.find((app) => app.dir === dir);
  if (ungoverned === undefined) return null;
  if (ungoverned.cpuMillis === null || ungoverned.memoryMib === null) return null;
  return { cpuMillis: ungoverned.cpuMillis, memoryMib: ungoverned.memoryMib, governed: false };
}

export interface ComparisonInput {
  readonly catalogue: ResourceCatalogue;
  readonly snapshot: RenderSnapshot;
  readonly repoRoot?: string | undefined;
}

/**
 * Both directions, at every rung.
 *
 * ONE HONEST LIMIT, stated because a silent one is worse than the gap: the
 * comparison is at APPLICATION granularity, not per row. Two rows wrong in
 * opposite directions inside the same Application would cancel and this would
 * pass. Per-row attribution needs a container-to-row map the catalogue does not
 * carry (`requestsField` names a VALUES path, not a container), so inventing
 * one here would be a heuristic wearing a measurement's clothes. The `inert-rung`
 * check below is what covers the case that matters most — a row the chart never
 * reads — without needing that map.
 */
export function compareRenderedToDeclared(input: ComparisonInput): readonly ResourceFinding[] {
  const { catalogue, snapshot } = input;
  const findings: ResourceFinding[] = [];
  const byProfile = new Map(snapshot.profiles.map((entry) => [entry.profile, entry]));

  for (const profile of catalogue.profiles) {
    const measurement = byProfile.get(profile);
    if (measurement === undefined) continue; // reported by snapshotCoverageDrift
    for (const app of measurement.apps) {
      const dir = appDirOf(app.appId);
      const tree = appTreeOf(app.appId);
      const declared = declaredAppTotal(catalogue, profile, dir, tree);
      if (declared === null) {
        findings.push({
          kind: "uncovered-application",
          profile,
          claimId: app.appId,
          problem:
            `renders ${String(app.cpuMillis)}m / ${String(app.memoryMib)}Mi of requests at rung "${profile}" and ` +
            `the resource catalogue carries no measured total for it` +
            (tree === GOVERNED_TREE
              ? ""
              : ` (it is in the "${tree}" tree; the ladder's dir keys are relative to ` +
                `${GOVERNED_TREE}/k8s/applications and cover no other tree)`) +
            ` — every rung's sum understates the machine by exactly this much`,
        });
        continue;
      }
      if (declared.cpuMillis !== app.cpuMillis || declared.memoryMib !== app.memoryMib) {
        findings.push({
          kind: "declared-total-mismatch",
          profile,
          claimId: app.appId,
          problem:
            `rung "${profile}" declares ${String(declared.cpuMillis)}m / ${String(declared.memoryMib)}Mi ` +
            `(${declared.governed ? "governed rows" : "ungovernedRequests"}); the chart renders ` +
            `${String(app.cpuMillis)}m / ${String(app.memoryMib)}Mi across ${String(app.workloads.length)} ` +
            `workload(s). The budget is arithmetic over the declared number and the cluster gets the rendered one`,
        });
      }
    }
    for (const app of measurement.unrenderable) {
      findings.push({
        kind: "unrenderable",
        profile,
        claimId: app.appId,
        problem: `could not be rendered at rung "${profile}" (${app.reason}): ${app.detail}`,
      });
    }
    for (const id of measurement.unoverlayable) {
      findings.push({
        kind: "unoverlayable-row",
        profile,
        claimId: id,
        problem:
          `names a coordinate this renderer cannot express, so its rung was never written into the render — ` +
          `a rung the render never sees would agree with every rung equally`,
      });
    }
  }

  // INERT ROWS. A governed row whose two rungs differ MUST move the render.
  // Compared at Application granularity between the smallest and largest rung:
  // if an app's governed rows cut anything at all and the two renders are
  // byte-identical in their totals, the chart is not reading our values.
  const first = catalogue.profiles[0];
  const last = catalogue.profiles[catalogue.profiles.length - 1];
  if (first !== undefined && last !== undefined && first !== last) {
    const low = byProfile.get(first);
    const high = byProfile.get(last);
    if (low !== undefined && high !== undefined) {
      const highById = new Map(high.apps.map((app) => [app.appId, app]));
      for (const lowApp of low.apps) {
        const highApp = highById.get(lowApp.appId);
        if (highApp === undefined) continue;
        const dir = appDirOf(lowApp.appId);
        if (appTreeOf(lowApp.appId) !== GOVERNED_TREE) continue;
        const rows = catalogue.claims.filter((claim) => claim.dir === dir);
        if (rows.length === 0) continue;
        const declaredDelta = rows.reduce(
          (sum, claim) => sum + ((claim.cpuMillis[last] ?? 0) - (claim.cpuMillis[first] ?? 0)) * claim.pods,
          0,
        );
        if (declaredDelta === 0) continue;
        const renderedDelta = highApp.cpuMillis - lowApp.cpuMillis;
        if (renderedDelta !== 0) continue;
        findings.push({
          kind: "inert-rung",
          profile: `${first}->${last}`,
          claimId: lowApp.appId,
          problem:
            `its governed rows cut ${String(declaredDelta)}m between "${first}" and "${last}", and the render ` +
            `does not move by a single millicore. The chart never reads those keys, so the ladder is pricing a ` +
            `cut the cluster will not get`,
        });
      }
    }
  }

  return findings.sort(
    (a, b) =>
      stringCompare(a.profile, b.profile) || stringCompare(a.claimId, b.claimId) || stringCompare(a.kind, b.kind),
  );
}

// ---------------------------------------------------------------------------
// Baseline — known-open findings, each with a reason and a lift condition
// ---------------------------------------------------------------------------

export interface BaselineEntry {
  readonly key: string;
  readonly reason: string;
  /** The condition that retires this entry, phrased so a gate can decide it. */
  readonly liftsWhen: string;
}

export interface Baseline {
  readonly entries: readonly BaselineEntry[];
}

/** `<kind>|<profile>|<claimId>` — stable, and it changes when the DEFECT changes class. */
export function findingKey(finding: ResourceFinding): string {
  return `${finding.kind}|${finding.profile}|${finding.claimId}`;
}

export function loadBaseline(path = DEFAULT_BASELINE_PATH, repoRoot = REPO_ROOT): Baseline {
  const text = readIfPresent(resolve(repoRoot, path));
  if (text === null) return { entries: [] };
  const parsed = JSON.parse(text) as { entries?: unknown };
  const entries = Array.isArray(parsed.entries) ? (parsed.entries as Record<string, unknown>[]) : [];
  return {
    entries: entries.map((entry, index) => {
      const key = entry.key;
      const reason = entry.reason;
      const liftsWhen = entry.liftsWhen;
      if (typeof key !== "string" || key.length === 0)
        throw new Error(`${path}: entries[${String(index)}].key missing`);
      if (typeof reason !== "string" || reason.trim().length < 20) {
        throw new Error(
          `${path}: ${key} has no reason — a baselined finding with no stated reason is a finding that was hidden`,
        );
      }
      if (typeof liftsWhen !== "string" || !liftsWhen.startsWith("LIFTS WHEN:")) {
        throw new Error(
          `${path}: ${key}.liftsWhen must start with "LIFTS WHEN:" — an entry with no lift condition never leaves`,
        );
      }
      return { key, reason, liftsWhen };
    }),
  };
}

export interface Adjudicated {
  readonly open: readonly ResourceFinding[];
  readonly baselined: readonly ResourceFinding[];
  /** Baseline keys that match nothing — the defect is gone and the entry outlived it. */
  readonly stale: readonly string[];
}

export function adjudicate(findings: readonly ResourceFinding[], baseline: Baseline): Adjudicated {
  const keys = new Set(baseline.entries.map((entry) => entry.key));
  const seen = new Set<string>();
  const open: ResourceFinding[] = [];
  const baselined: ResourceFinding[] = [];
  for (const finding of findings) {
    const key = findingKey(finding);
    seen.add(key);
    if (keys.has(key)) baselined.push(finding);
    else open.push(finding);
  }
  const stale = [...keys].filter((key) => !seen.has(key)).sort((a, b) => stringCompare(a, b));
  return { open, baselined, stale };
}

// ---------------------------------------------------------------------------
// Report + CLI
// ---------------------------------------------------------------------------

export interface AuditResult {
  readonly findings: readonly ResourceFinding[];
  readonly adjudicated: Adjudicated;
  readonly coverageDrift: readonly string[];
  readonly snapshot: RenderSnapshot | null;
}

export function auditExitCode(result: AuditResult): number {
  if (result.snapshot === null) return 1;
  if (result.coverageDrift.length > 0) return 1;
  if (result.adjudicated.open.length > 0) return 1;
  if (result.adjudicated.stale.length > 0) return 1;
  return 0;
}

export function formatReport(result: AuditResult, catalogue: ResourceCatalogue): string {
  const lines: string[] = [];
  if (result.snapshot === null) {
    lines.push(`no snapshot at ${DEFAULT_SNAPSHOT_PATH} — run with --measure. A check that cannot run is not a check.`);
    return lines.join("\n");
  }
  for (const drift of result.coverageDrift) lines.push(`[coverage] ${drift}`);
  for (const finding of result.adjudicated.open) {
    lines.push(`[${finding.kind}] ${finding.claimId} @ ${finding.profile}: ${finding.problem}`);
  }
  for (const key of result.adjudicated.stale) {
    lines.push(`[stale-baseline] ${key}: baselined, and nothing reports it any more — delete the entry`);
  }
  lines.push("");
  lines.push(
    `measured ${result.snapshot.measuredOn} over ${String(result.snapshot.appsDiscovered.length)} Applications`,
  );
  for (const profile of catalogue.profiles) {
    const measurement = result.snapshot.profiles.find((entry) => entry.profile === profile);
    if (measurement === undefined) continue;
    const cpu = measurement.apps.reduce((sum, app) => sum + app.cpuMillis, 0);
    const memory = measurement.apps.reduce((sum, app) => sum + app.memoryMib, 0);
    lines.push(
      `  ${profile.padEnd(6)} rendered ${String(cpu).padStart(6)}m / ${String(memory).padStart(7)}Mi ` +
        `over ${String(measurement.apps.length)} rendered, ${String(measurement.unrenderable.length)} unrenderable`,
    );
  }
  lines.push(
    `  ${String(result.adjudicated.baselined.length)} finding(s) baselined with a reason and a lift condition`,
  );
  lines.push("");
  lines.push(
    "EVERY TOTAL HERE IS A FLOOR. Most rendered containers request nothing at all; those pods are BestEffort " +
      "and no arithmetic in this file ever sees them.",
  );
  return lines.join("\n");
}

export function auditRenderedResourceRequests(options: {
  readonly repoRoot?: string | undefined;
  readonly snapshotPath?: string | undefined;
  readonly baselinePath?: string | undefined;
}): { result: AuditResult; catalogue: ResourceCatalogue } {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const catalogue = loadResourceCatalogue(undefined, repoRoot);
  const snapshot = loadSnapshot(options.snapshotPath ?? DEFAULT_SNAPSHOT_PATH, repoRoot);
  if (snapshot === null) {
    return {
      result: { findings: [], adjudicated: { open: [], baselined: [], stale: [] }, coverageDrift: [], snapshot: null },
      catalogue,
    };
  }
  const discovered = discoverApplications(repoRoot).map((source) => source.appId);
  const coverageDrift = snapshotCoverageDrift(snapshot, discovered, catalogue.profiles);
  // The reachability findings come from the TREE, not the snapshot, so they are
  // computed even when the snapshot is stale or absent. A raw manifest that
  // grew a request between measurements must not wait for the next one.
  const findings = [
    ...compareRenderedToDeclared({ catalogue, snapshot, repoRoot }),
    ...gitPathReachabilityFindings(catalogue, repoRoot),
  ];
  const baseline = loadBaseline(options.baselinePath ?? DEFAULT_BASELINE_PATH, repoRoot);
  return { result: { findings, adjudicated: adjudicate(findings, baseline), coverageDrift, snapshot }, catalogue };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const repoRoot = REPO_ROOT;
  if (argv.includes("--measure")) {
    const catalogue = loadResourceCatalogue(undefined, repoRoot);
    const snapshot = measureSnapshot(catalogue, { repoRoot, cacheDir: process.env.ZETA_HELM_CACHE });
    writeSnapshot(snapshot, DEFAULT_SNAPSHOT_PATH, repoRoot);
    process.stdout.write(
      `measured ${String(snapshot.appsDiscovered.length)} Applications at ${String(snapshot.profiles.length)} rungs\n`,
    );
    for (const profile of snapshot.profiles) {
      const cpu = profile.apps.reduce((sum, app) => sum + app.cpuMillis, 0);
      const memory = profile.apps.reduce((sum, app) => sum + app.memoryMib, 0);
      process.stdout.write(
        `  ${profile.profile}: ${String(cpu)}m / ${String(memory)}Mi, ${String(profile.unrenderable.length)} unrenderable\n`,
      );
    }
    process.exit(0);
  }
  const { result, catalogue } = auditRenderedResourceRequests({ repoRoot });
  process.stdout.write(`${formatReport(result, catalogue)}\n`);
  process.exit(auditExitCode(result));
}
