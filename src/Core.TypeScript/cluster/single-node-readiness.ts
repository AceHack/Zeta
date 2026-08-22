// Single-node readiness auditor for the hardware proof-of-concept.
//
// WHY THIS EXISTS
// ---------------
// The investor PoC stands the whole stack up on ONE box. Kubernetes will
// happily let you do that, and it will happily let you LIE about it: a
// StatefulSet asking for `replicas: 3` under the CockroachDB chart's DEFAULT
// `podAntiAffinity.type: soft` schedules all three Raft members onto the one
// node you have. `kubectl get pods` then shows 3/3 Running and the demo says
// "distributed SQL" while the real failure domain is a single disk. Losing
// that disk loses the Raft majority; the database is unrecoverable.
//
// Empirically observed on a live single-node kind cluster (2026-08-14,
// podman/applehv, kind 0.31.0, kindest/node v1.35.0):
//
//   cockroachdb-0  Init:0/1  node=zeta-dejan-poc-control-plane
//   cockroachdb-1  Init:0/1  node=zeta-dejan-poc-control-plane
//   cockroachdb-2  Init:0/1  node=zeta-dejan-poc-control-plane
//
//   Longhorn volume datadir-cockroachdb-0:
//     state=detached robustness=faulted
//     Scheduled=False reason=ReplicaSchedulingFailure
//     message="insufficient storage;precheck new replica failed"
//   -> AttachVolume.Attach failed: "volume ... is not ready for workloads"
//
// ...because 1030 GiB of `longhorn`-class PVCs were requested against a node
// with 100 GB of disk. Both faults are STATIC properties of the manifests.
// This auditor reads them off the YAML so they are caught in CI, before a
// demo, rather than at minute 12 of a bring-up.
//
// WHAT IT CHECKS (each can go red; see single-node-readiness.test.ts)
//
//   A. root-app-collision   Two app-of-apps roots claiming the same
//                           namespace/name identity with different source
//                           paths. Kubernetes has ONE object at that
//                           identity; with prune+selfHeal the second apply
//                           deletes the first tree's entire child graph.
//   B. storage-budget       Sum of requested PVC capacity per StorageClass
//                           against the declared per-node disk budget.
//   C. false-redundancy     replicas > 1 without hard anti-affinity on a
//                           1-node cluster: nominal quorum, single failure
//                           domain. Must be acknowledged in the ledger.
//
// Verdicts are FACTS, not sentences (dual-use-detection rule): the tool
// reports "this StatefulSet's redundancy is nominal, not real on N nodes".
// Whether that is acceptable for a PoC is the ledger's (human's) call.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { parseAllDocuments } from "yaml";
// Ordinal (code-point) ordering, per .claude/rules/culture-invariant-by-default.md.
// NOT localeCompare: it is culture-SENSITIVE, so the same keys sort differently
// per machine locale. That matters here because these orderings are not display —
// they feed a fingerprint (see buildFingerprint below) and the audit's stable
// output. `stringCompare` also walks code points rather than UTF-16 code units,
// so astral characters order the same way the other oracles order them.
import { stringCompare } from "../collation/collation.ts";
import {
  DEFAULT_CATALOGUE_PATH,
  HEALTH_WORKFLOW_PATH,
  METAL_ROOT_APPLICATION_PATH,
  ciBudgetedProfile,
  crossCheckClaims,
  devLaneAppliedDirs,
  envelopeBudget,
  loadCatalogue,
  loadResourceCatalogue,
  metalAppliedDirs,
  pinnedChartVersion,
  profileBringUpGib,
  profileTotalGib,
  resourceTotal,
  verifyProfileApplied,
  verifyResourceProfileApplied,
  type ProfileCatalogue,
  type ResourceCatalogue,
} from "./storage-profiles.ts";
import { clusterDefaultStorageClass } from "./cluster-default-storage-class.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

/** Charts whose default `podAntiAffinity.type` is `soft` — i.e. co-scheduling is ALLOWED unless overridden. */
const SOFT_ANTIAFFINITY_BY_DEFAULT = new Set(["cockroachdb"]);

export type RedundancyVerdict =
  /** replicas <= nodeCount, or replicas == 1 — the manifest tells the truth. */
  | "honest"
  /** replicas > nodeCount AND hard anti-affinity — surplus pods stay Pending forever. Loud, not silent. */
  | "needs-more-nodes"
  /** replicas > nodeCount AND soft/no anti-affinity — pods co-schedule; nominal quorum, one failure domain. */
  | "false-redundancy";

export interface ReplicaClaim {
  readonly app: string;
  readonly path: string;
  /** Dotted path inside the manifest where the replica count was read. */
  readonly field: string;
  readonly replicas: number;
  readonly antiAffinity: "hard" | "soft" | "none";
  readonly verdict: RedundancyVerdict;
}

export interface StorageClaim {
  readonly app: string;
  readonly path: string;
  readonly field: string;
  readonly storageClass: string;
  readonly gibibytes: number;
  /** Per-pod claims are multiplied by the StatefulSet replica count. */
  readonly replicas: number;
}

export interface RootAppIdentity {
  readonly path: string;
  readonly namespace: string;
  readonly name: string;
  readonly sourcePath: string;
}

export interface Finding {
  readonly check:
    | "root-app-collision"
    | "storage-budget"
    | "false-redundancy"
    | "capacity-provenance"
    | "compute-provenance"
    | "rung-coverage"
    | "storage-profile"
    | "resource-profile"
    | "ledger-figures";
  readonly severity: "blocker" | "warning";
  readonly message: string;
  readonly detail: readonly string[];
}

export interface Ledger {
  /**
   * The storage size profile THIS deployment runs, named in
   * `full-ai-cluster/k8s/storage-profiles.json`.
   *
   * It lives in the ledger rather than in the catalogue because it is a
   * property of this cluster's hardware, not of the ladder: the catalogue is
   * the same everywhere, the rung is not (Aaron 2026-08-20 — "some of our
   * boxes are NASs some are regular PCs").
   *
   * `readLedger` REFUSES a ledger that omits it. A default here would be the
   * quiet kind of vacuity: the auditor would compare the manifests against a
   * profile nobody chose and report agreement, which is a check that did not
   * run wearing the face of one that passed.
   */
  readonly activeStorageProfile: string;
  /**
   * The CPU/memory rung THIS deployment runs, named in the same catalogue's
   * `resourceProfiles`.
   *
   * REQUIRED, and it is the key this file was missing. `activeStorageProfile`
   * has always said which disk rung the tree carries, so the storage ladder
   * could be checked against the manifests and against measured hardware. The
   * CPU ladder had no such declaration at all: two rungs existed, one of them
   * was written into the manifests, and NOTHING in the repo recorded which. A
   * budget audit was run against `dev` while the tree carried `metal`, and both
   * were green on the half each was measured against.
   *
   * Defaulting it would rebuild that hole. Refusing it makes the tree state
   * which substrate its numbers are for, which is the precondition for every
   * other check here being about the cluster somebody is going to power on.
   */
  readonly activeResourceProfile: string;
  /** Usable disk per node in GiB, dedicated to the replicated-storage class. */
  readonly nodeDiskGib: number;
  readonly nodeCount: number;
  /** StorageClasses that are node-local replicated storage (budget applies). */
  readonly budgetedStorageClasses: readonly string[];
  /** `app` entries whose false-redundancy is knowingly accepted for the PoC. */
  readonly acknowledgedFalseRedundancy: readonly string[];
  /**
   * Root-app duplicates that are knowingly tolerated, recorded as
   * `<namespace>/<name>=<sorted source paths joined by "|">`.
   *
   * The source-path SET is part of the key on purpose. Acknowledging the bare
   * identity would make the check unfalsifiable: a third tree could later claim
   * the same name and be silently absorbed by the existing acknowledgement.
   * Pinning the set means any change to it — a tree added, removed or repointed
   * — goes red and has to be re-stated deliberately.
   */
  readonly acknowledgedRootAppDuplicates: readonly string[];
  /**
   * Capacity shortfalls against MEASURED hardware that are knowingly carried,
   * recorded as `<storageClass>=<declared>GiB>><measured>GiB@<node>`.
   *
   * Both numbers are in the key on purpose, for the same reason the root-app
   * key pins its source set: acknowledging the bare storage class would make
   * the check unfalsifiable, because any later PVC growth — or a smaller node
   * joining — would be silently absorbed by the existing entry. Pinning the
   * arithmetic means every movement of either side goes red and has to be
   * re-stated deliberately.
   *
   * An acknowledgement suppresses the EXIT CODE, never the output: the auditor
   * prints each acknowledged shortfall with its full arithmetic on the normal
   * path, so "no blockers." can never stand alone beside an oversubscribed disk.
   *
   * The UNVERIFIED case is deliberately NOT acknowledgeable. A shortfall you
   * can see is debt; a comparator you do not have is not a check at all, and
   * an exemption for it would be exactly the vacuity this file exists to catch.
   */
  readonly acknowledgedCapacityShortfall: readonly string[];
  /**
   * Compute shortfalls against MEASURED hardware, recorded as
   * `cpu=<declared>m>><measured>m@<node>` / `memory=<declared>Mi>><measured>Mi@<node>`.
   *
   * Same shape and same reason as `acknowledgedCapacityShortfall`: both numbers
   * in the key, so growth on either side re-reddens instead of being absorbed.
   * The UNVERIFIED case is likewise not acknowledgeable.
   */
  readonly acknowledgedComputeShortfall: readonly string[];
  /**
   * The one tolerated disagreement between the rung the tree CARRIES and the
   * rung CI BUDGETS, recorded as
   * `<committed>@<budgeted-lane>=<cpu>m/<mem>Mi>><budgetCpu>m/<budgetMem>Mi`.
   *
   * This is debt with a decision behind it, not an exemption. The committed
   * rung not fitting the CI runner is a real fact about a real trade
   * (per-substrate override vs one tree); pinning all four numbers means the
   * moment any of them moves, the trade has to be re-stated rather than
   * inherited. Deleting the entry is the fix, and the fix is a maintainer call.
   */
  readonly acknowledgedRungBudgetGap: readonly string[];
}

// ---------------------------------------------------------------------------
// YAML walking — a real parser, never a line regex.
// ---------------------------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Parse a possibly multi-document YAML file. Throws on malformed YAML — that is the point. */
export function parseYamlDocuments(text: string, label: string): readonly Json[] {
  const docs = parseAllDocuments(text);
  const out: Json[] = [];
  for (const doc of docs) {
    if (doc.errors.length > 0) {
      const first = doc.errors[0];
      throw new Error(`${label}: ${first === undefined ? "unknown YAML error" : first.message}`);
    }
    const value = doc.toJS({ maxAliasCount: 100 }) as Json;
    if (value !== null && value !== undefined) out.push(value);
  }
  return out;
}

function isRecord(value: Json): value is { [k: string]: Json } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Indexed read that survives `noUncheckedIndexedAccess`: a missing key reads as `null`. */
function at(value: Json, key: string): Json {
  if (!isRecord(value)) return null;
  return value[key] ?? null;
}

/** Depth-first walk yielding every (dotted-path, value) pair. */
export function* walk(value: Json, prefix = ""): Generator<readonly [string, Json]> {
  yield [prefix, value];
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const child = value[i];
      if (child !== undefined) yield* walk(child, `${prefix}[${i}]`);
    }
    return;
  }
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child !== undefined) yield* walk(child, prefix === "" ? key : `${prefix}.${key}`);
  }
}

// ---------------------------------------------------------------------------
// Capacity parsing — Kubernetes quantity suffixes, normalised to GiB.
// ---------------------------------------------------------------------------

const QUANTITY = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|Pi|k|M|G|T|P)?$/;
const BINARY_GIB: Readonly<Record<string, number>> = {
  Ki: 1 / (1024 * 1024),
  Mi: 1 / 1024,
  Gi: 1,
  Ti: 1024,
  Pi: 1024 * 1024,
  k: 1e3 / 2 ** 30,
  M: 1e6 / 2 ** 30,
  G: 1e9 / 2 ** 30,
  T: 1e12 / 2 ** 30,
  P: 1e15 / 2 ** 30,
};

/** Returns GiB, or null if `raw` is not a Kubernetes capacity quantity. */
export function quantityToGib(raw: string): number | null {
  const match = QUANTITY.exec(raw.trim());
  if (match === null) return null;
  const magnitude = Number(match[1]);
  if (!Number.isFinite(magnitude)) return null;
  const suffix = match[2];
  if (suffix === undefined) return magnitude / 2 ** 30; // bare bytes
  const factor = BINARY_GIB[suffix];
  return factor === undefined ? null : magnitude * factor;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

const REPLICA_KEYS = new Set(["replicas", "replicaCount"]);
const STORAGE_CLASS_KEYS = new Set(["storageClass", "storageClassName"]);

function lastSegment(field: string): string {
  const dot = field.lastIndexOf(".");
  return dot < 0 ? field : field.slice(dot + 1);
}

/** Read `podAntiAffinity.type` if the manifest sets it; otherwise fall back to the chart default. */
export function antiAffinityOf(doc: Json, chartName: string): "hard" | "soft" | "none" {
  for (const [field, value] of walk(doc)) {
    if (lastSegment(field) !== "type") continue;
    if (!field.includes("podAntiAffinity")) continue;
    if (value === "hard") return "hard";
    if (value === "soft") return "soft";
  }
  return SOFT_ANTIAFFINITY_BY_DEFAULT.has(chartName) ? "soft" : "none";
}

export function classifyRedundancy(
  replicas: number,
  antiAffinity: "hard" | "soft" | "none",
  nodeCount: number,
): RedundancyVerdict {
  if (replicas <= nodeCount) return "honest";
  return antiAffinity === "hard" ? "needs-more-nodes" : "false-redundancy";
}

export interface AppManifest {
  readonly app: string;
  readonly path: string;
  readonly docs: readonly Json[];
}

export function extractReplicaClaims(manifest: AppManifest, nodeCount: number): readonly ReplicaClaim[] {
  const out: ReplicaClaim[] = [];
  for (const doc of manifest.docs) {
    const rawChart = at(at(at(doc, "spec"), "source"), "chart");
    const chart = typeof rawChart === "string" ? rawChart : "";
    const antiAffinity = antiAffinityOf(doc, chart);
    for (const [field, value] of walk(doc)) {
      if (!REPLICA_KEYS.has(lastSegment(field))) continue;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1) continue;
      out.push({
        app: manifest.app,
        path: manifest.path,
        field,
        replicas: value,
        antiAffinity,
        verdict: classifyRedundancy(value, antiAffinity, nodeCount),
      });
    }
  }
  return out;
}

/** Nearest enclosing replica count for a storage field, so per-pod PVCs are multiplied correctly. */
function replicasGoverning(doc: Json, storageField: string): number {
  let best = 1;
  let bestDepth = -1;
  for (const [field, value] of walk(doc)) {
    if (!REPLICA_KEYS.has(lastSegment(field))) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) continue;
    // A replica count governs a storage claim if they share a manifest root
    // section (`spec.source.helm.valuesObject.<section>` etc.). Prefer the
    // deepest shared prefix.
    const parent = field.slice(0, Math.max(0, field.lastIndexOf(".")));
    const shared = parent.length > 0 && storageField.startsWith(parent.slice(0, parent.lastIndexOf(".") + 1));
    const depth = shared ? parent.length : 0;
    if (depth > bestDepth) {
      bestDepth = depth;
      best = value;
    } else if (bestDepth < 0) {
      best = value;
    }
  }
  return best;
}

/**
 * Kinds that DESCRIBE a volume without ever provisioning one.
 *
 * `platform.zeta.io/v1alpha1 Blueprint` is a run-recipe — pure data the
 * platform-controller renders only when a `Deployable` names it. Its
 * `storageClassName` + `storage.size` are the SHAPE of a PVC some future
 * instance will get, not a PVC. Counting one is the same error in the opposite
 * direction from the one this auditor was built for: there, a declared claim
 * governed nothing; here, a claim that provisions nothing was counted against
 * the disk.
 */
const TEMPLATE_KINDS = new Set(["Blueprint"]);

/**
 * Blueprint names some `Deployable` in the scanned tree instantiates.
 *
 * A DENYLIST WITH A DOOR, not an exemption. The template kind above is skipped
 * only while nothing instantiates it — write a Deployable that names `mssql`
 * and its 8 GiB is counted again, with no edit here. That is what keeps this
 * from being the "acknowledge it and the number goes away" move: the exclusion
 * is a consequence of the tree, and the tree can revoke it.
 *
 * DELIBERATELY GENEROUS about which Deployables count. `examples/` is scanned
 * even though `platform/Application.yaml`'s `directory.include` glob keeps Argo
 * from applying it, so an example Deployable is enough to bring a Blueprint's
 * capacity back into the total. That over-counts rather than under-counts, and
 * the direction is the point: this ledger convicts, never acquits.
 */
export function instantiatedBlueprints(manifests: readonly AppManifest[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const manifest of manifests) {
    for (const doc of manifest.docs) {
      if (!isRecord(doc)) continue;
      if (at(doc, "kind") !== "Deployable") continue;
      const blueprint = at(at(doc, "spec"), "blueprint");
      if (typeof blueprint === "string" && blueprint.length > 0) out.add(blueprint);
    }
  }
  return out;
}

export interface StorageExtractionOptions {
  /**
   * What a BLANK `storageClassName` resolves to. `null` (or absent) keeps the
   * old behaviour of dropping such a claim — which is honest only when the
   * default genuinely is not known, and is an UNDERCOUNT whenever it is.
   */
  readonly clusterDefault?: string | null;
  /** Blueprints some Deployable instantiates; see `instantiatedBlueprints`. */
  readonly instantiated?: ReadonlySet<string> | undefined;
}

export function extractStorageClaims(
  manifest: AppManifest,
  options: StorageExtractionOptions = {},
): readonly StorageClaim[] {
  const out: StorageClaim[] = [];
  const clusterDefault = options.clusterDefault ?? null;
  const instantiated = options.instantiated ?? new Set<string>();
  for (const doc of manifest.docs) {
    if (isTemplateDocument(doc, instantiated)) continue;
    for (const [field, value] of walk(doc)) {
      if (!STORAGE_CLASS_KEYS.has(lastSegment(field))) continue;
      if (typeof value !== "string") continue;
      // A BLANK class is not "no claim" — it is a claim on whatever class the
      // cluster marks default, which here is `zeta-local-path`
      // (rancher.io/local-path, reclaimPolicy DELETE). Dropping it, as this
      // function did until 2026-08-22, hid a real disk consumer from the total.
      // With no default declared anywhere in the tree the honest answer is
      // still to drop it: an unknown class cannot be added to a named one.
      const storageClass = value.length === 0 ? clusterDefault : value;
      if (storageClass === null) continue;
      const scope = field.slice(0, Math.max(0, field.lastIndexOf(".")));
      const size = sizeNear(doc, scope);
      if (size === null) continue;
      const replicas = replicasGoverning(doc, field);
      out.push({
        app: manifest.app,
        path: manifest.path,
        field,
        storageClass,
        gibibytes: size,
        replicas,
      });
    }
  }
  return out;
}

/** A template document whose kind provisions nothing, and which nothing instantiates. */
function isTemplateDocument(doc: Json, instantiated: ReadonlySet<string>): boolean {
  if (!isRecord(doc)) return false;
  const kind = at(doc, "kind");
  if (typeof kind !== "string" || !TEMPLATE_KINDS.has(kind)) return false;
  const name = at(at(doc, "metadata"), "name");
  return typeof name !== "string" || !instantiated.has(name);
}

const SIZE_KEYS = new Set(["size", "storage"]);

/** Find the capacity declared alongside (or just under) a storageClass key. */
function sizeNear(doc: Json, scope: string): number | null {
  let fallback: number | null = null;
  for (const [field, value] of walk(doc)) {
    if (!SIZE_KEYS.has(lastSegment(field))) continue;
    if (typeof value !== "string") continue;
    const gib = quantityToGib(value);
    if (gib === null) continue;
    if (scope.length > 0 && field.startsWith(`${scope}.`)) return gib;
    if (scope.length > 0 && field.startsWith(`${scope.slice(0, scope.lastIndexOf(".") + 1)}`)) fallback ??= gib;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Root App-of-Apps identity collision
// ---------------------------------------------------------------------------

export function collectRootAppIdentities(manifests: readonly AppManifest[]): readonly RootAppIdentity[] {
  const out: RootAppIdentity[] = [];
  for (const manifest of manifests) {
    for (const doc of manifest.docs) {
      if (!isRecord(doc)) continue;
      if (at(doc, "kind") !== "Application") continue;
      const metadata = at(doc, "metadata");
      const source = at(at(doc, "spec"), "source");
      if (!isRecord(metadata) || !isRecord(source)) continue;
      const rawPath = at(source, "path");
      const sourcePath = typeof rawPath === "string" ? rawPath : "";
      // Only app-of-apps roots: a git-directory source pointing at an
      // applications directory (not a Helm chart source).
      if (sourcePath.length === 0 || !sourcePath.endsWith("applications")) continue;
      const namespace = at(metadata, "namespace");
      const name = at(metadata, "name");
      out.push({
        path: manifest.path,
        namespace: typeof namespace === "string" ? namespace : "default",
        name: typeof name === "string" ? name : "",
        sourcePath,
      });
    }
  }
  return out;
}

export function findRootAppCollisions(
  identities: readonly RootAppIdentity[],
  acknowledged: readonly string[],
): readonly Finding[] {
  const byIdentity = new Map<string, RootAppIdentity[]>();
  for (const identity of identities) {
    const key = `${identity.namespace}/${identity.name}`;
    const bucket = byIdentity.get(key);
    if (bucket === undefined) byIdentity.set(key, [identity]);
    else bucket.push(identity);
  }
  const findings: Finding[] = [];
  for (const [key, bucket] of [...byIdentity.entries()].sort((a, b) => stringCompare(a[0], b[0]))) {
    const distinctSources = new Set(bucket.map((identity) => identity.sourcePath));
    if (distinctSources.size < 2) continue;
    const fingerprint = `${key}=${[...distinctSources].sort((a, b) => stringCompare(a, b)).join("|")}`;
    if (acknowledged.includes(fingerprint)) continue;
    findings.push({
      check: "root-app-collision",
      severity: "blocker",
      message:
        `${bucket.length} app-of-apps roots claim the single Kubernetes identity ` +
        `Application/${key} but point at ${distinctSources.size} different source paths. ` +
        `Only one can exist in a cluster; with prune+selfHeal the last apply deletes the other tree's children.`,
      detail: [
        ...bucket
          .map((identity) => `${identity.path} -> spec.source.path: ${identity.sourcePath}`)
          .sort((a, b) => stringCompare(a, b)),
        `acknowledge with: ${fingerprint}`,
      ],
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// MEASURED node capacity — the comparator that has provenance.
//
// WHY THIS EXISTS, SEPARATELY FROM `storage-budget`
// -------------------------------------------------
// `storage-budget` compares the declared PVC total against `nodeDiskGib` in
// the ledger. That number is 2048, and the ledger's own comment says of it:
//
//     "It is NOT a measurement of the box Aaron has today - it is the
//      requirement the manifests imply"
//     "STATUS: awaiting maintainer sign-off on nodeDiskGib"
//
// So on 2026-08-21 the auditor printed `no blockers.` and exited 0 while
// comparing ~1409 GiB of declared `longhorn` PVCs against an unsigned
// aspiration. A gate whose comparator is an aspiration is not a gate: it
// cannot fail for the reason it exists, and a check that cannot fail looks
// exactly like a check that passed.
//
// This check supplies a comparator that has PROVENANCE. Four ClusterNode
// registrations are checked in under `maintainers/*/cluster-nodes/*/node.yaml`,
// written by real metal boots: zeta-install.sh composes `spec.hardware.storage`
// from `lsblk -ndo NAME,SIZE,TYPE -e7` on the node itself. Those are measured
// bytes off real hardware, committed by a self-registration PR.
//
// THE INFERENCE IS ONE-WAY, ON PURPOSE
// ------------------------------------
// The bound below is the SUM of every whole block device on the node. That is
// deliberately over-generous: it counts the USB stick, and it ignores the ESP,
// the root filesystem, swap, and Longhorn's own reserve — none of which the
// registration records. So:
//
//   declared > bound  =>  PROVEN oversubscribed. No reading of the hardware
//                         rescues it; the disks are not there.
//   declared <= bound =>  proves NOTHING about whether it fits.
//
// It convicts, never acquits — the same shape as the rest of this file's
// verdicts, and the reason the finding says "exceeds every disk on the node"
// rather than "will not fit".
//
// Note this is independent of HOW Longhorn is told about those disks (the
// `node.longhorn.io/default-disks-config` mechanism, PR #12175): physical
// capacity bounds every disk-set mechanism from above, broken or fixed.
// ---------------------------------------------------------------------------

/** One node's measured hardware, read off a checked-in ClusterNode registration. */
export interface MeasuredNode {
  /** Repo-relative path of the registration, so a finding can cite its evidence. */
  readonly path: string;
  readonly hostname: string;
  /** Verbatim `spec.hardware.storage` entries, e.g. `/dev/nvme0n1 931.5G`. */
  readonly devices: readonly string[];
  /**
   * Sum of every parsed device size in GiB, or `null` when the registration
   * carries no parsable storage line at all. `null` is NOT zero: an unmeasured
   * node must not read as a node with no disks.
   */
  readonly totalGib: number | null;
  /** Verbatim `spec.hardware.cores`, kept so a finding can quote what it read. */
  readonly coresRaw: number | null;
  /** Verbatim `spec.hardware.memory`, e.g. `66G`. */
  readonly memoryRaw: string | null;
  /**
   * `spec.hardware.cores` x 1000, or `null` when the registration records none.
   * `null` is NOT zero, for the same reason `totalGib` is not: a node nobody
   * measured must not read as a node with no CPU.
   */
  readonly cpuMillis: number | null;
  /** `spec.hardware.memory` parsed as DECIMAL bytes (see `siMemoryToMib`), in MiB. */
  readonly memoryMib: number | null;
}

/**
 * lsblk's human-readable sizes are BINARY (`931.5G` is 931.5 GiB), which is why
 * this cannot reuse `quantityToGib`: there `G` is the Kubernetes SI suffix and
 * means 10^9 bytes. Feeding an lsblk string through the Kubernetes parser would
 * shrink every measurement by ~7% and make the bound look tighter than it is.
 */
export function lsblkSizeToGib(raw: string): number | null {
  const match = /^(\d+(?:[.,]\d+)?)([BKMGTPE])$/.exec(raw.trim());
  if (match === null) return null;
  // Ordinal digits only — the regex already refused anything else. The comma
  // branch is for locale-formatted lsblk output, normalised to a point.
  const magnitude = Number((match[1] ?? "").replace(",", "."));
  if (!Number.isFinite(magnitude)) return null;
  const factor: Readonly<Record<string, number>> = {
    B: 1 / 1024 ** 3,
    K: 1 / 1024 ** 2,
    M: 1 / 1024,
    G: 1,
    T: 1024,
    P: 1024 ** 2,
    E: 1024 ** 3,
  };
  const scale = factor[match[2] ?? ""];
  return scale === undefined ? null : magnitude * scale;
}

/** `/dev/nvme0n1 931.5G` -> 931.5. Returns null for any line without a size token. */
export function deviceLineToGib(line: string): number | null {
  const parts = line.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last === undefined ? null : lsblkSizeToGib(last);
}

/**
 * `spec.hardware.cores` -> millicores.
 *
 * THE FIELD NAME IS WRONG AND THE NUMBER IS RIGHT, which is worth stating
 * because reading it the other way would make this gate acquit a machine it
 * should convict. Both registration scripts write it as `CORES="$(nproc)"`
 * (`full-ai-cluster/usb-nixos-installer/zeta-install.sh`,
 * `tools/installer/zeta-self-register.sh`), and `nproc` counts LOGICAL CPUs,
 * not physical cores. maximdolphin's registrations record `cores: 22` on an
 * Intel Core Ultra 9 185H, which is a 16-core / 22-thread part — the 22 is the
 * thread count, and it disagrees with the field's name by 6.
 *
 * That is the number this conversion wants. The kubelet reports
 * `status.capacity.cpu` from the same logical-CPU count, and a Kubernetes CPU
 * unit IS one logical CPU, so `nproc x 1000` is the node's millicore capacity
 * exactly. Converting the *physical* core count would understate a
 * hyperthreaded box by up to a third and turn a fitting catalogue into a
 * finding.
 */
export function coresToMillis(cores: number): number | null {
  if (!Number.isFinite(cores) || cores <= 0) return null;
  return Math.round(cores * 1000);
}

/**
 * `spec.hardware.memory` -> MiB, read as DECIMAL.
 *
 * THIS IS THE MIRROR IMAGE OF `lsblkSizeToGib`, AND THE TRAP RUNS THE OTHER
 * WAY. Storage is captured with `lsblk -ndo NAME,SIZE,TYPE -e7`, whose human
 * sizes are BINARY — so `931.5G` is 931.5 GiB and feeding it to a Kubernetes
 * (SI) parser would shrink it ~7%. Memory on the same node, in the same script,
 * one line apart, is captured with `free -h --si`, and `--si` means what it
 * says: `66G` is 66 x 10^9 bytes = 62942 MiB, NOT 66 GiB = 67584 MiB.
 *
 * Reading it as binary would inflate the bound by 4642 MiB, and inflating a
 * bound is the ACQUITTING direction: the check would pass a catalogue that the
 * box cannot hold. One node, two hardware fields, two unit systems, and only
 * one of them is the direction that hurts. (Independent confirmation that
 * decimal is the right reading: 66 GiB is 70.9 GB, which is more RAM than a
 * 64 GiB machine physically has, so a binary reading of `66G` describes a
 * machine that does not exist.)
 *
 * `free` reports MemTotal, which is already less than installed RAM — firmware
 * and the kernel take their cut before it is counted. So this is a measurement
 * of what the OS can hand out, which is the quantity the scheduler divides.
 */
export function siMemoryToMib(raw: string): number | null {
  const match = /^(\d+(?:[.,]\d+)?)\s*([BKMGTP])(i?)$/.exec(raw.trim());
  if (match === null) return null;
  const magnitude = Number((match[1] ?? "").replace(",", "."));
  if (!Number.isFinite(magnitude) || magnitude <= 0) return null;
  // AN EXPLICIT `i` IS BELIEVED. `free -h` WITHOUT `--si` prints `62Gi`, and a
  // node registered by an older script or a hand edit may carry that form. A
  // unit that states it is binary is not ambiguous and must not be forced
  // through the decimal table — the bare suffix is the only one this file gets
  // to interpret, and it interprets it from the capture command.
  const binary = (match[3] ?? "") === "i";
  const base = binary ? 1024 : 1000;
  const power: Readonly<Record<string, number>> = { B: 0, K: 1, M: 2, G: 3, T: 4, P: 5 };
  const exponent = power[match[2] ?? ""];
  return exponent === undefined ? null : Math.floor((magnitude * base ** exponent) / 1024 ** 2);
}

export const DEFAULT_REGISTRATIONS_ROOT = "maintainers";

/**
 * Read every checked-in ClusterNode registration under
 * `<registrationsRoot>/<maintainer>/cluster-nodes/<node>/node.yaml`.
 *
 * Registrations with no `spec.hardware.storage` (the post-boot self-register
 * path never captured it) come back with `totalGib: null` and are reported as
 * gaps rather than dropped, so an unmeasured node is visible as unmeasured.
 */
export function collectMeasuredNodes(
  repoRoot = REPO_ROOT,
  registrationsRoot = DEFAULT_REGISTRATIONS_ROOT,
): readonly MeasuredNode[] {
  const abs = resolve(repoRoot, registrationsRoot);
  if (!existsSync(abs)) return [];
  const out: MeasuredNode[] = [];
  for (const file of listYaml(abs)) {
    const rel = relative(repoRoot, file).split(sep).join("/");
    if (!rel.includes("/cluster-nodes/")) continue;
    for (const doc of parseYamlDocuments(readFileSync(file, "utf8"), rel)) {
      if (at(doc, "kind") !== "ClusterNode") continue;
      const spec = at(doc, "spec");
      const rawHost = at(spec, "hostname");
      const rawStorage = at(at(spec, "hardware"), "storage");
      const devices = Array.isArray(rawStorage)
        ? rawStorage.filter((entry): entry is string => typeof entry === "string")
        : [];
      const sizes = devices.map((entry) => deviceLineToGib(entry)).filter((gib): gib is number => gib !== null);
      const rawCores = at(at(spec, "hardware"), "cores");
      const rawMemory = at(at(spec, "hardware"), "memory");
      const coresRaw = typeof rawCores === "number" ? rawCores : null;
      const memoryRaw = typeof rawMemory === "string" ? rawMemory : null;
      out.push({
        path: rel,
        hostname: typeof rawHost === "string" ? rawHost : rel,
        devices,
        totalGib: sizes.length === 0 ? null : sizes.reduce((sum, gib) => sum + gib, 0),
        coresRaw,
        memoryRaw,
        cpuMillis: coresRaw === null ? null : coresToMillis(coresRaw),
        memoryMib: memoryRaw === null ? null : siMemoryToMib(memoryRaw),
      });
    }
  }
  return out.sort((a, b) => stringCompare(a.path, b.path));
}

/**
 * The cluster's verified per-node capacity: the SMALLEST measured node, because
 * a catalogue that must fit on every node has to fit on the smallest one. Null
 * when nothing is measured — the caller must then refuse, not substitute.
 */
export function verifiedNodeCapacity(nodes: readonly MeasuredNode[]): MeasuredNode | null {
  let best: MeasuredNode | null = null;
  for (const node of nodes) {
    if (node.totalGib === null) continue;
    if (best === null || node.totalGib < (best.totalGib ?? Infinity)) best = node;
  }
  return best;
}

/**
 * The cluster's verified per-node COMPUTE floor: the node with the fewest
 * measured logical CPUs, and separately the node with the least measured RAM.
 *
 * TWO FLOORS, NOT ONE NODE, and the split is not pedantry. Nothing forces the
 * smallest-CPU box to also be the smallest-RAM box, and picking one node then
 * reading both of its numbers would silently compare a catalogue's memory
 * against a machine that is not the memory floor. Each dimension is bounded by
 * its own worst node, which is the only reading that convicts correctly on a
 * heterogeneous fleet. `null` on either side means nothing was measured for it
 * — the caller must refuse, never substitute.
 */
export interface ComputeFloor {
  readonly cpu: MeasuredNode | null;
  readonly memory: MeasuredNode | null;
}

export function verifiedNodeCompute(nodes: readonly MeasuredNode[]): ComputeFloor {
  let cpu: MeasuredNode | null = null;
  let memory: MeasuredNode | null = null;
  for (const node of nodes) {
    if (node.cpuMillis !== null && (cpu === null || node.cpuMillis < (cpu.cpuMillis ?? Infinity))) cpu = node;
    if (node.memoryMib !== null && (memory === null || node.memoryMib < (memory.memoryMib ?? Infinity))) memory = node;
  }
  return { cpu, memory };
}

// ---------------------------------------------------------------------------
// SCHEDULABLE capacity — a REPORT, and the reason it is not the gate.
//
// The bound above is RAW: every block device on the node, summed, with nothing
// held back. Longhorn never offers a node's raw disk to replicas. Two settings
// bound it, and this repo leaves both at the chart's defaults in the tree that
// owns the storage ladder:
//
//   storageOverProvisioningPercentage   longhorn-1.7.2/values.yaml:214,
//                                       "The default value is 100"
//   storageMinimalAvailablePercentage   same file:216, "The default value is 25"
//
// So a disk stops accepting replicas well before it is full, and the honest
// figure to size a cluster against is ~75% of it, less the OS root. That is
// the number `--list` has always printed in its "needs ~N GiB of disk" column;
// what was missing is that the GATE never compared against it. It compares
// declared capacity against the raw sum, and passes anything under it.
//
// WHY THIS STAYS A REPORT AND THE RAW SUM STAYS THE GATE
// -----------------------------------------------------
// Not timidity — the raw sum is the only comparator with no assumption in it.
// The schedulable figure needs three things the registrations do not record:
//
//   1. WHICH devices Longhorn manages. `defaultDataPath: /var/lib/longhorn`
//      puts the default disk on the ROOT filesystem, so on node-ad1efd only
//      /dev/nvme0n1 is a Longhorn disk unless /dev/sda is mounted and added by
//      hand. Counting both is an assumption in the generous direction.
//   2. How big the OS root is. 30 GiB is a BUDGET CHOICE here, not a measurement.
//   3. `storageReservedPercentageForDefaultDisk`, a THIRD reserve which the
//      chart leaves at `~` and whose default the chart does not state
//      (values.yaml:218 documents the field, not the number). Real schedulable
//      capacity is therefore at most what this computes, never more.
//
// A bound built on three assumptions can be wrong in the acquitting direction,
// and this file's whole discipline is that its inferences convict and never
// acquit. So: the raw sum keeps the exit code, the schedulable estimate is
// printed beside it, and a profile whose BRING-UP total clears the schedulable
// estimate is one somebody has actually checked rather than hoped about.
// ---------------------------------------------------------------------------

/** longhorn-1.7.2/values.yaml:214 — "Percentage of storage that can be allocated relative to hard drive capacity. The default value is 100". */
export const LONGHORN_CHART_DEFAULT_OVER_PROVISIONING_PERCENT = 100;
/** longhorn-1.7.2/values.yaml:216 — "Percentage of minimum available disk capacity ... The default value is 25". */
export const LONGHORN_CHART_DEFAULT_MINIMAL_AVAILABLE_PERCENT = 25;
/**
 * Held back for the OS root, swap and the ESP. A BUDGET CHOICE, not a
 * measurement: no ClusterNode registration records a partition table, so
 * nothing here can derive it. Named as a constant so it is one number to argue
 * with rather than a literal sprinkled through the arithmetic.
 */
export const OS_ROOT_ALLOWANCE_GIB = 30;

/** One deployed Longhorn Application's reserve settings. `null` means the manifest leaves the chart default in place. */
export interface LonghornReserve {
  readonly path: string;
  readonly overProvisioningPercentage: number | null;
  readonly minimalAvailablePercentage: number | null;
  /** Fraction of a disk that replicas may occupy under these settings. */
  readonly usableFraction: number;
}

/**
 * Fraction of a disk Longhorn will let replicas occupy.
 *
 * `min` of the two, not a product. Over-provisioning is a THIN-provisioning
 * allowance — 200 lets you schedule twice the disk on the promise that the
 * volumes stay sparse — while the minimal-available floor is about REAL free
 * bytes and does not care what was promised. Multiplying them would let a
 * thin-provisioning knob buy physical capacity, which is exactly the arithmetic
 * that produced the `ReplicaSchedulingFailure` this file's header records.
 */
export function longhornUsableFraction(
  overProvisioningPercentage: number | null,
  minimalAvailablePercentage: number | null,
): number {
  const over = overProvisioningPercentage ?? LONGHORN_CHART_DEFAULT_OVER_PROVISIONING_PERCENT;
  const minimalAvailable = minimalAvailablePercentage ?? LONGHORN_CHART_DEFAULT_MINIMAL_AVAILABLE_PERCENT;
  return Math.max(0, Math.min(over, 100 - minimalAvailable)) / 100;
}

function percentAt(value: Json, key: string): number | null {
  const raw = at(value, key);
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/**
 * Every Longhorn Application in the tree, with the reserve it deploys.
 *
 * There are two, and they DISAGREE (full-ai-cluster leaves the chart defaults,
 * infra sets 200/15). Only one app-of-apps root can own the cluster — that
 * collision is already carried in the ledger as acknowledgedRootAppDuplicates —
 * so which reserve is live is genuinely unknown from the repo. `mostConservative`
 * below resolves that by taking the tighter of the two rather than guessing,
 * which turns an ambiguity into a one-way bound instead of a coin flip.
 */
export function collectLonghornReserves(manifests: readonly AppManifest[]): readonly LonghornReserve[] {
  const out: LonghornReserve[] = [];
  for (const manifest of manifests) {
    for (const doc of manifest.docs) {
      if (at(doc, "kind") !== "Application") continue;
      const source = at(at(doc, "spec"), "source");
      if (at(source, "chart") !== "longhorn") continue;
      const settings = at(at(at(source, "helm"), "valuesObject"), "defaultSettings");
      const over = percentAt(settings, "storageOverProvisioningPercentage");
      const minimalAvailable = percentAt(settings, "storageMinimalAvailablePercentage");
      out.push({
        path: manifest.path,
        overProvisioningPercentage: over,
        minimalAvailablePercentage: minimalAvailable,
        usableFraction: longhornUsableFraction(over, minimalAvailable),
      });
    }
  }
  return out.sort((a, b) => stringCompare(a.path, b.path));
}

/**
 * The tightest usable fraction any deployed Longhorn declares. Chart defaults
 * when the tree declares no Longhorn at all — an absent manifest must not read
 * as an unlimited disk.
 */
export function mostConservativeUsableFraction(reserves: readonly LonghornReserve[]): number {
  const chartDefault = longhornUsableFraction(null, null);
  return reserves.reduce((tightest, reserve) => Math.min(tightest, reserve.usableFraction), chartDefault);
}

/** Upper bound on GiB Longhorn will schedule across `nodeCount` nodes of this size. Never negative. */
export function schedulableBoundGib(
  rawGibPerNode: number,
  usableFraction: number,
  nodeCount: number,
  osRootGib = OS_ROOT_ALLOWANCE_GIB,
): number {
  return Math.max(0, rawGibPerNode - osRootGib) * usableFraction * nodeCount;
}

export function capacityShortfallKey(storageClass: string, declaredGib: number, node: MeasuredNode): string {
  return `${storageClass}=${declaredGib.toFixed(0)}GiB>>${(node.totalGib ?? 0).toFixed(0)}GiB@${node.hostname}`;
}

/**
 * Per-budgeted-class declared totals.
 *
 * `override` is the storage-profile catalogue's number for that class, and it
 * WINS when present. It has to: the derivation below is measurably blind in
 * both directions — it cannot see pod counts that live in an upstream chart
 * (mimir renders 3 ingesters and 3 store-gateways from zone-aware defaults our
 * YAML never mentions: +200 GiB), and its nearest-enclosing-replicas heuristic
 * invents ones that do not exist (redis master borrows the neighbouring
 * `replica.replicaCount: 2`: -10 GiB). Comparing a disk against the smaller of
 * two numbers because it is the one we happened to derive is how a gate stops
 * being one.
 */
export function declaredTotals(
  claims: readonly StorageClaim[],
  budgeted: readonly string[],
  override: ReadonlyMap<string, number> | null,
): ReadonlyMap<string, number> {
  const totals = new Map<string, number>();
  for (const claim of claims) {
    if (!budgeted.includes(claim.storageClass)) continue;
    totals.set(claim.storageClass, (totals.get(claim.storageClass) ?? 0) + claim.gibibytes * claim.replicas);
  }
  if (override === null) return totals;
  for (const [storageClass, gib] of override) {
    if (budgeted.includes(storageClass)) totals.set(storageClass, gib);
  }
  return totals;
}

export function findCapacityProvenance(
  claims: readonly StorageClaim[],
  ledger: Ledger,
  nodes: readonly MeasuredNode[],
  override: ReadonlyMap<string, number> | null = null,
): readonly Finding[] {
  const budgeted = [...ledger.budgetedStorageClasses].sort((a, b) => stringCompare(a, b));
  const totals = declaredTotals(claims, budgeted, override);
  if (totals.size === 0) return [];

  const floor = verifiedNodeCapacity(nodes);
  const unmeasured = nodes.filter((node) => node.totalGib === null);

  // REFUSE. Nothing measured means there is no comparator with provenance, and
  // the only honest verdict a gate can return without one is "I cannot know".
  if (floor === null) {
    return [
      {
        check: "capacity-provenance",
        severity: "blocker",
        message:
          `Capacity UNVERIFIED: ${totals.size} budgeted StorageClass(es) declare storage, but no checked-in ` +
          `ClusterNode registration carries a measurable spec.hardware.storage. The only other comparator is ` +
          `ledger.nodeDiskGib=${ledger.nodeDiskGib}, which the ledger itself records as an unsigned requirement ` +
          `rather than a measurement — so passing on it would be a check that cannot fail. Register a node ` +
          `(zeta-install.sh writes spec.hardware.storage from lsblk) or add its measured devices by hand.`,
        detail: [
          ...[...totals.entries()]
            .sort((a, b) => stringCompare(a[0], b[0]))
            .map(([storageClass, gib]) => `${gib.toFixed(0).padStart(6)} GiB declared  ${storageClass}`),
          ...unmeasured.map((node) => `no hardware.storage recorded: ${node.path}`).sort((a, b) => stringCompare(a, b)),
          "this finding is NOT acknowledgeable — an absent comparator is not debt, it is an absent check",
        ],
      },
    ];
  }

  const findings: Finding[] = [];
  for (const storageClass of budgeted) {
    const declared = totals.get(storageClass);
    if (declared === undefined) continue;
    const bound = (floor.totalGib ?? 0) * ledger.nodeCount;
    if (declared <= bound) continue;
    const key = capacityShortfallKey(storageClass, declared, floor);
    if (ledger.acknowledgedCapacityShortfall.includes(key)) continue;
    findings.push({
      check: "capacity-provenance",
      severity: "blocker",
      message:
        `StorageClass "${storageClass}" declares ${declared.toFixed(0)} GiB, which exceeds EVERY block device on ` +
        `the smallest measured node (${floor.hostname}: ${bound.toFixed(0)} GiB across ${floor.devices.length} ` +
        `device(s) x ${ledger.nodeCount} node(s)) by ${(declared - bound).toFixed(0)} GiB — ` +
        `${(declared / Math.max(bound, 1)).toFixed(2)}x. That bound counts every disk including the boot and USB ` +
        `devices and reserves nothing for the OS, so it is generous: exceeding it is proven oversubscription, ` +
        `not an estimate. Buy the disk, trim the catalogue, or record the shortfall as debt.`,
      detail: [
        `measured evidence: ${floor.path}`,
        ...floor.devices.map((device) => `  ${device}`).sort((a, b) => stringCompare(a, b)),
        ...unmeasured.map((node) => `unmeasured node (not counted): ${node.path}`).sort((a, b) => stringCompare(a, b)),
        `acknowledge with: ${key}`,
      ],
    });
  }
  return findings;
}


// ---------------------------------------------------------------------------
// COMPUTE provenance — the CPU/memory half of the same comparator
//
// WHY IT EXISTS, AND WHAT WAS MISSING
// -----------------------------------
// `findCapacityProvenance` above compares the DECLARED storage ladder against
// MEASURED hardware read off the checked-in ClusterNode registrations. Nothing
// did that for CPU or memory. The CPU/memory ladder had two rungs, one of them
// was written into the manifests, and the only machine either rung was ever
// compared against was a 4000m GitHub runner — while the registrations record
// 16 and 22 logical CPUs. Roughly 4x between the substrate the numbers were
// validated against and the substrate they are for.
//
// So the `metal` rung's figures were declarations validated by nothing. This is
// the missing comparator, built on the same three commitments as the storage
// one:
//
//   1. REFUSE without a comparator. No registration carrying a measurable
//      `spec.hardware.cores` / `spec.hardware.memory` means there is no
//      comparator with provenance, and the honest verdict is "I cannot know".
//      Not acknowledgeable — an absent comparator is an absent check.
//   2. CONVICT, NEVER ACQUIT. The bound is the node's whole measured capacity
//      with nothing held back for the kubelet, the control plane, kube-system,
//      or the OS. Exceeding it is proven oversubscription; not exceeding it
//      proves nothing on its own, and the message says so.
//   3. FLOOR PER DIMENSION. The smallest-CPU node and the smallest-RAM node are
//      not necessarily the same box (`verifiedNodeCompute`).
//
// AND IT IS COMPUTED OVER THE METAL COHORT, NOT THE DEV LANE. The bootstrap
// root applies every Application in the tree; the CI root excludes nine. Pricing
// the metal box against the dev lane's 37 would under-count by every app the
// dev lane happens to skip — which includes gitlab, ollama, vllm and longhorn,
// four of the largest reservations in the catalogue.
// ---------------------------------------------------------------------------

export function computeShortfallKey(dimension: "cpu" | "memory", declared: number, bound: number, host: string): string {
  const unit = dimension === "cpu" ? "m" : "Mi";
  return `${dimension}=${declared.toFixed(0)}${unit}>>${bound.toFixed(0)}${unit}@${host}`;
}

export function findComputeProvenance(
  ledger: Ledger,
  nodes: readonly MeasuredNode[],
  resources: ResourceCatalogue | null,
  repoRoot = REPO_ROOT,
): readonly Finding[] {
  if (resources === null) return [];
  if (!resources.profiles.includes(ledger.activeResourceProfile)) {
    return [
      {
        check: "compute-provenance",
        severity: "blocker",
        message:
          `activeResourceProfile "${ledger.activeResourceProfile}" is not a rung of ${DEFAULT_CATALOGUE_PATH} ` +
          `(known: ${resources.profiles.join(", ")}). Nothing can be compared against a rung that does not exist.`,
        detail: [],
      },
    ];
  }

  const dirs = metalAppliedDirs(repoRoot);
  if (dirs === null) {
    return [
      {
        check: "compute-provenance",
        severity: "blocker",
        message:
          `Compute UNVERIFIED: the metal cohort could not be read off ${METAL_ROOT_APPLICATION_PATH}. ` +
          `Without the root Application there is no defensible answer to "which Applications does the hardware ` +
          `cluster apply", and a total over a guessed cohort is not a measurement of anything.`,
        detail: ["this finding is NOT acknowledgeable — an absent cohort is an absent check"],
      },
    ];
  }

  const total = resourceTotal(resources, ledger.activeResourceProfile, dirs);
  const floor = verifiedNodeCompute(nodes);
  const unmeasuredNodes = nodes.filter((node) => node.cpuMillis === null || node.memoryMib === null);

  if (floor.cpu === null || floor.memory === null) {
    return [
      {
        check: "compute-provenance",
        severity: "blocker",
        message:
          `Compute UNVERIFIED: the "${ledger.activeResourceProfile}" rung reserves ` +
          `${String(total.cpuMillis)}m of CPU and ${String(total.memoryMib)}Mi of memory across the ` +
          `${String(dirs.length)} Applications the metal root applies, but no checked-in ClusterNode ` +
          `registration carries a measurable spec.hardware.cores AND spec.hardware.memory. The runner ` +
          `envelope (${String(resources.envelope.cpuMillis)}m) is not a substitute: it describes a ` +
          `${resources.envelope.runner}, not the box this rung is for.`,
        detail: [
          ...nodes
            .map((node) => `${node.path}: cores=${node.coresRaw ?? "absent"} memory=${node.memoryRaw ?? "absent"}`)
            .sort((a, b) => stringCompare(a, b)),
          "this finding is NOT acknowledgeable — an absent comparator is not debt, it is an absent check",
        ],
      },
    ];
  }

  const findings: Finding[] = [];

  // An UNMEASURED Application is a hole in the sum, and a sum with a hole in it
  // is what "it fits on the box" would be claimed from. Same refusal the runner
  // budget makes, over the metal cohort instead of the dev lane.
  for (const dir of total.unmeasured) {
    const key = `${dir}@${pinnedChartVersion(dir, repoRoot)}`;
    if (resources.acknowledgedUnmeasured.includes(key)) continue;
    findings.push({
      check: "compute-provenance",
      severity: "blocker",
      message:
        `${dir} is applied by the metal root with an UNKNOWN request total and is not acknowledged as ` +
        `"${key}". An app nobody could measure is not an app that costs nothing.`,
      detail: [],
    });
  }

  const dimensions = [
    {
      dimension: "cpu" as const,
      declared: total.cpuMillis,
      bound: (floor.cpu.cpuMillis ?? 0) * ledger.nodeCount,
      node: floor.cpu,
      unit: "m",
      evidence: `cores=${String(floor.cpu.coresRaw ?? 0)} (nproc: LOGICAL CPUs) x 1000 x ${String(ledger.nodeCount)} node(s)`,
      consequence:
        `Pods above the line take "Insufficient cpu" and stay Pending. That is what ` +
        `hindsight-postgresql-0 did on the runner, and the hardware box is where it must not happen again.`,
    },
    {
      dimension: "memory" as const,
      declared: total.memoryMib,
      bound: (floor.memory.memoryMib ?? 0) * ledger.nodeCount,
      node: floor.memory,
      unit: "Mi",
      evidence:
        `memory="${floor.memory.memoryRaw ?? ""}" read as DECIMAL (free -h --si) x ${String(ledger.nodeCount)} node(s)`,
      consequence: `Pods above the line take "Insufficient memory" and stay Pending.`,
    },
  ];

  for (const entry of dimensions) {
    if (entry.declared <= entry.bound) continue;
    const key = computeShortfallKey(entry.dimension, entry.declared, entry.bound, entry.node.hostname);
    if (ledger.acknowledgedComputeShortfall.includes(key)) continue;
    findings.push({
      check: "compute-provenance",
      severity: "blocker",
      message:
        `Resource rung "${ledger.activeResourceProfile}" reserves ${entry.declared.toFixed(0)}${entry.unit} of ` +
        `${entry.dimension} across the ${String(dirs.length)} Applications the metal root applies, which exceeds ` +
        `the WHOLE measured capacity of the smallest registered node (${entry.node.hostname}: ` +
        `${entry.bound.toFixed(0)}${entry.unit}) by ${(entry.declared - entry.bound).toFixed(0)}${entry.unit} — ` +
        `${(entry.declared / Math.max(entry.bound, 1)).toFixed(2)}x. That bound reserves nothing for the kubelet, ` +
        `the control plane, kube-system or the OS, so exceeding it is proven oversubscription, not an estimate. ` +
        entry.consequence,
      detail: [
        `measured evidence: ${entry.node.path}`,
        `  ${entry.evidence}`,
        ...unmeasuredNodes
          .map((node) => `unmeasured node (not counted): ${node.path}`)
          .sort((a, b) => stringCompare(a, b)),
        `acknowledge with: ${key}`,
      ],
    });
  }
  return findings;
}

/**
 * Does the tree carry the rung it says it carries?
 *
 * The CPU/memory twin of `findStorageProfileDrift`. Without it
 * `activeResourceProfile` would be a label nobody checks, which is the same
 * vacuity the storage half already refuses.
 */
export function findResourceProfileDrift(
  ledger: Ledger,
  resources: ResourceCatalogue | null,
  repoRoot = REPO_ROOT,
): readonly Finding[] {
  if (resources === null || !resources.profiles.includes(ledger.activeResourceProfile)) return [];
  const drift = verifyResourceProfileApplied(resources, ledger.activeResourceProfile, repoRoot);
  if (drift.length === 0) return [];
  return [
    {
      check: "resource-profile",
      severity: "blocker",
      message:
        `The ledger says this deployment runs resource rung "${ledger.activeResourceProfile}", and ` +
        `${String(drift.length)} manifest value(s) disagree. Every compute figure this auditor prints is ` +
        `computed from that rung, so while they disagree the totals describe a tree nobody committed.`,
      detail: drift.map((finding) => `${finding.claimId}: ${finding.problem}`).sort((a, b) => stringCompare(a, b)),
    },
  ];
}

// ---------------------------------------------------------------------------
// RUNG COVERAGE — is the rung CI budgets the rung the tree carries?
//
// THE DEFECT THIS CLOSES, measured 2026-08-22:
//
//     rung    --check           --budget
//     dev     exit 1, 54 drifts exit 0
//     metal   exit 0            exit 1
//
// One rung was checked and not budgeted; the other was budgeted and not
// checked; each was green on the half it was measured against, and nothing
// compared the two. The workflow's own comment said so in prose. Prose is not a
// check — that is the whole standing lesson of this file — so here is the check.
//
// It does NOT decide the underlying trade. Whether the committed tree moves to
// `dev` or grows a per-substrate override point is a maintainer call with real
// costs on both sides. What this refuses is the state where nobody has to make
// it because both gates are green.
// ---------------------------------------------------------------------------

export function rungBudgetGapKey(
  committed: string,
  budgeted: string,
  cpu: number,
  memory: number,
  budgetCpu: number,
  budgetMemory: number,
): string {
  return `${committed}@${budgeted}-lane=${cpu.toFixed(0)}m/${memory.toFixed(0)}Mi>>${budgetCpu.toFixed(0)}m/${budgetMemory.toFixed(0)}Mi`;
}

export function findRungCoverage(
  ledger: Ledger,
  resources: ResourceCatalogue | null,
  repoRoot = REPO_ROOT,
): readonly Finding[] {
  if (resources === null) return [];
  const budgeted = ciBudgetedProfile(repoRoot);
  if (budgeted === null) {
    return [
      {
        check: "rung-coverage",
        severity: "blocker",
        message:
          `Rung coverage UNVERIFIED: ${HEALTH_WORKFLOW_PATH} does not run exactly one ` +
          `\`--resource-profile <rung> --budget\` step, so there is no answer to "which rung does CI budget". ` +
          `Zero steps means the budget is unenforced; two different rungs means two answers, which is not one.`,
        detail: ["this finding is NOT acknowledgeable — an unreadable gate is an absent check"],
      },
    ];
  }
  if (!resources.profiles.includes(ledger.activeResourceProfile)) return [];
  if (budgeted === ledger.activeResourceProfile) return [];

  const laneDirs = devLaneAppliedDirs(repoRoot);
  const committedOnLane = resourceTotal(resources, ledger.activeResourceProfile, laneDirs);
  const budget = envelopeBudget(resources.envelope);
  const key = rungBudgetGapKey(
    ledger.activeResourceProfile,
    budgeted,
    committedOnLane.cpuMillis,
    committedOnLane.memoryMib,
    budget.cpuMillis,
    budget.memoryMib,
  );
  const fits = committedOnLane.cpuMillis <= budget.cpuMillis && committedOnLane.memoryMib <= budget.memoryMib;
  if (fits) {
    return [
      {
        check: "rung-coverage",
        severity: "blocker",
        message:
          `CI budgets rung "${budgeted}" and the tree carries "${ledger.activeResourceProfile}", which is a ` +
          `disagreement with no cost left: the committed rung FITS the runner budget ` +
          `(${String(committedOnLane.cpuMillis)}m / ${String(committedOnLane.memoryMib)}Mi against ` +
          `${String(budget.cpuMillis)}m / ${String(budget.memoryMib)}Mi). Point the workflow's --budget step at ` +
          `"${ledger.activeResourceProfile}" so the gate is about the tree that ships.`,
        detail: [`workflow: ${HEALTH_WORKFLOW_PATH}`],
      },
    ];
  }
  if (ledger.acknowledgedRungBudgetGap.includes(key)) return [];
  return [
    {
      check: "rung-coverage",
      severity: "blocker",
      message:
        `The green budget gate is about a rung the tree does not carry. CI budgets "${budgeted}"; the ledger ` +
        `says the tree carries "${ledger.activeResourceProfile}", and "${ledger.activeResourceProfile}" over ` +
        `the ${String(laneDirs.length)} Applications the dev lane applies is ` +
        `${String(committedOnLane.cpuMillis)}m / ${String(committedOnLane.memoryMib)}Mi against a ` +
        `${String(budget.cpuMillis)}m / ${String(budget.memoryMib)}Mi budget — over by ` +
        `${String(Math.max(0, committedOnLane.cpuMillis - budget.cpuMillis))}m / ` +
        `${String(Math.max(0, committedOnLane.memoryMib - budget.memoryMib))}Mi. So a passing budget step is not ` +
        `evidence that the lane can schedule what it applies. Resolve it or carry it as stated debt.`,
      detail: [
        `workflow: ${HEALTH_WORKFLOW_PATH}`,
        `acknowledge with: ${key}`,
        "the resolutions are: apply the budgeted rung to the tree, budget the committed rung, or add a",
        "per-substrate override point so one tree can carry two rungs. All three are maintainer calls.",
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Budget + redundancy findings
// ---------------------------------------------------------------------------

export function findStorageBudgetOverruns(
  claims: readonly StorageClaim[],
  ledger: Ledger,
  override: ReadonlyMap<string, number> | null = null,
): readonly Finding[] {
  const budget = ledger.nodeDiskGib * ledger.nodeCount;
  const budgeted = [...ledger.budgetedStorageClasses].sort((a, b) => stringCompare(a, b));
  const totals = declaredTotals(claims, budgeted, override);
  const findings: Finding[] = [];
  for (const storageClass of budgeted) {
    const matching = claims.filter((claim) => claim.storageClass === storageClass);
    if (matching.length === 0) continue;
    const total = totals.get(storageClass) ?? 0;
    if (total <= budget) continue;
    findings.push({
      check: "storage-budget",
      severity: "blocker",
      message:
        `StorageClass "${storageClass}" is over-subscribed: ${total.toFixed(0)} GiB requested across ` +
        `${matching.length} claims against a ${budget.toFixed(0)} GiB budget ` +
        `(${ledger.nodeCount} node(s) x ${ledger.nodeDiskGib} GiB). Longhorn refuses to schedule replicas ` +
        `past the disk and reports ReplicaSchedulingFailure "insufficient storage"; dependent pods stay in Init.`,
      detail: matching
        .map(
          (claim) =>
            `${(claim.gibibytes * claim.replicas).toFixed(0).padStart(5)} GiB  ` +
            `${claim.gibibytes.toFixed(0)}Gi x ${claim.replicas}  ${claim.path}  (${claim.field})`,
        )
        .sort((a, b) => stringCompare(a, b)),
    });
  }
  return findings;
}

export function findFalseRedundancy(claims: readonly ReplicaClaim[], ledger: Ledger): readonly Finding[] {
  const offenders = claims.filter(
    (claim) => claim.verdict === "false-redundancy" && !ledger.acknowledgedFalseRedundancy.includes(claim.app),
  );
  const byApp = new Map<string, ReplicaClaim[]>();
  for (const claim of offenders) {
    const bucket = byApp.get(claim.app);
    if (bucket === undefined) byApp.set(claim.app, [claim]);
    else bucket.push(claim);
  }
  return [...byApp.entries()]
    .sort((a, b) => stringCompare(a[0], b[0]))
    .map(([app, bucket]) => ({
      check: "false-redundancy" as const,
      severity: "blocker" as const,
      message:
        `${app} declares replicas > ${ledger.nodeCount} with ${bucket[0]?.antiAffinity ?? "none"} anti-affinity. ` +
        `On ${ledger.nodeCount} node(s) every replica co-schedules: the redundancy is nominal, the failure ` +
        `domain is one node. Either drop to ${ledger.nodeCount}, set hard anti-affinity so the shortfall is ` +
        `visible as Pending pods, or record it in acknowledgedFalseRedundancy with the reason.`,
      detail: bucket
        .map((claim) => `${claim.path}: ${claim.field} = ${claim.replicas}`)
        .sort((a, b) => stringCompare(a, b)),
    }));
}

// ---------------------------------------------------------------------------
// Filesystem loading
// ---------------------------------------------------------------------------

export function loadManifests(roots: readonly string[], repoRoot = REPO_ROOT): readonly AppManifest[] {
  const out: AppManifest[] = [];
  for (const root of roots) {
    const abs = resolve(repoRoot, root);
    if (!existsSync(abs)) continue;
    for (const file of listYaml(abs)) {
      // POSIX-normalise before anything derives identity from it. `relative()`
      // returns backslashes on Windows, and every downstream consumer -- the
      // `applications` anchor split in appNameFor, the ledger's
      // acknowledgedRootAppDuplicates keys, the reported finding paths -- is
      // written in forward slashes. Normalising once here keeps `app` and
      // `path` platform-independent, so the ledger matches on every OS.
      const rel = relative(repoRoot, file).split(sep).join("/");
      const text = readFileSync(file, "utf8");
      out.push({ app: appNameFor(rel), path: rel, docs: parseYamlDocuments(text, rel) });
    }
  }
  return out.sort((a, b) => stringCompare(a.path, b.path));
}

/**
 * App identity = `<tree>/<dir directly under applications|bootstrap>`.
 *
 * Tree-qualified on purpose: `infra/k8s/applications/cockroachdb` and
 * `full-ai-cluster/k8s/applications/cockroachdb` are DIFFERENT declarations of
 * the same workload, and merging them under one name would hide exactly the
 * two-tree drift this auditor exists to surface.
 */
export function appNameFor(relPath: string): string {
  // Split on EITHER separator. loadManifests already POSIX-normalises, but this
  // is exported and called directly by tests and other callers; splitting on
  // "/" alone silently degenerates on a Windows-shaped path (one part, anchor
  // never found, identity becomes `<wholepath>/<wholepath>`), which matches no
  // ledger key and made every acknowledged app read as a fresh violation.
  const parts = relPath.split(/[\\/]/);
  const anchor = parts.findIndex((part) => part === "applications" || part === "bootstrap");
  const tree = parts[0] ?? "?";
  if (anchor < 0 || anchor + 1 >= parts.length) return `${tree}/${parts[parts.length - 1] ?? relPath}`;
  const next = parts[anchor + 1] ?? "";
  // A file sitting directly in applications/ or bootstrap/ names itself.
  const leaf = anchor + 2 >= parts.length ? next.replace(/\.ya?ml$/, "") : next;
  return `${tree}/${leaf}`;
}

function listYaml(dir: string, depth = 0): readonly string[] {
  if (depth > 4) return [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => stringCompare(a.name, b.name));
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listYaml(path, depth + 1);
    if (!entry.isFile()) return [];
    if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) return [];
    if (statSync(path).size === 0) return [];
    return [path];
  });
}

export const DEFAULT_ROOTS: readonly string[] = [
  "full-ai-cluster/k8s/applications",
  "full-ai-cluster/k8s/bootstrap",
  "infra/k8s/applications",
  "infra/k8s/bootstrap",
];

/**
 * The `storage-profile` check: does the tree actually run the profile the
 * ledger says it runs, and does the catalogue still cover the tree?
 *
 * Three ways to go red, and none of them is "the total looks wrong":
 *   - the ledger names a profile the catalogue does not define
 *   - a manifest's size or pod count differs from the active profile's
 *   - the two oracles disagree about what is in the tree (a claim with no row,
 *     a row with no claim, or a pod count our own YAML answers differently)
 *
 * Bring-up scheduling is deliberately NOT a finding. `scheduledAtBringUp:
 * false` is a report, because it is one `argocd app sync` away from false and
 * a gate that discounted it would pass today and fail the moment anyone acted.
 */
export function findStorageProfileDrift(
  ledger: Ledger,
  catalogue: ProfileCatalogue,
  storageClaims: readonly StorageClaim[],
  repoRoot = REPO_ROOT,
): readonly Finding[] {
  const profile = ledger.activeStorageProfile;
  if (!catalogue.profiles.includes(profile)) {
    return [
      {
        check: "storage-profile",
        severity: "blocker",
        message:
          `The ledger's activeStorageProfile is "${profile}", which the storage-profile catalogue does not ` +
          `define. Known profiles: ${catalogue.profiles.join(", ")}. Nothing can be checked against a rung ` +
          `that does not exist, and "cannot check" must never read as "checked".`,
        detail: [`catalogue: ${DEFAULT_CATALOGUE_PATH}`],
      },
    ];
  }
  const drift = verifyProfileApplied(catalogue, profile, repoRoot);
  const cross = catalogue.claims.length === 0 ? [] : crossCheckClaims(catalogue, storageClaims, "longhorn", profile);
  const findings: Finding[] = [];
  if (drift.length > 0) {
    findings.push({
      check: "storage-profile",
      severity: "blocker",
      message:
        `${String(drift.length)} manifest value(s) disagree with the active storage profile "${profile}". ` +
        `The ladder is only worth its arithmetic if the YAML matches it: switch with ` +
        `\`bun src/Core.TypeScript/cluster/storage-profiles.ts --profile ${profile} --apply\`, or change ` +
        `activeStorageProfile in the ledger to the rung the tree actually runs.`,
      detail: drift.map((finding) => `${finding.claimId}: ${finding.problem}`).sort((a, b) => stringCompare(a, b)),
    });
  }
  if (cross.length > 0) {
    findings.push({
      check: "storage-profile",
      severity: "blocker",
      message:
        `${String(cross.length)} disagreement(s) between the storage-profile catalogue and this auditor's own ` +
        `extraction of the tree. Two oracles read the same manifests; where they differ, one is wrong and the ` +
        `declared-capacity total that guards the disk is built on the wrong one.`,
      detail: cross.map((finding) => `${finding.claimId}: ${finding.problem}`).sort((a, b) => stringCompare(a, b)),
    });
  }
  return findings;
}

export const DEFAULT_LEDGER_PATH = "full-ai-cluster/k8s/single-node-budget.json";

/** The file's bytes, or `null` when it is not there. One syscall, one answer. */
function readIfPresent(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// The RENDER's reading, and the prose figures that quote it
// ---------------------------------------------------------------------------

/**
 * Per-StorageClass GiB the RENDER asks for, read from the checked-in snapshot.
 *
 * WHY THE READINESS AUDITOR READS THE RENDER AT ALL. This module extracts from
 * OUR YAML, and that is a genuinely different question from what a chart
 * produces — but it is also a STRUCTURALLY partial answer for any class most of
 * whose consumers we never declare. Measured 2026-08-22: of the 193 GiB the
 * full-ai-cluster tree renders onto `zeta-local-path`, 98 GiB comes from charts
 * whose Application says nothing at all about storage (gitlab 76, loki 20,
 * mimir-alertmanager 1, dapr 1). No amount of teaching this extractor to read
 * blank classes recovers those: there is no key in our tree to read.
 *
 * So the two figures are NOT redundant and neither supersedes the other on
 * every question. The derived one answers "how much did we DECLARE", which is
 * what the storage-profile ladder governs; the rendered one answers "how much
 * will the cluster ASK FOR", which is what the disk has to hold. The second is
 * the one to trust for capacity, and the report says so in those words rather
 * than printing two numbers and leaving the reader to choose.
 *
 * PER TREE, because the two Application roots are mutually exclusive: the
 * ledger's own `acknowledgedRootAppDuplicates` records that both declare
 * `argocd/zeta-root`, so one prunes the other and a single node runs ONE of
 * them. Summing both trees answers a question no cluster asks.
 */
export interface RenderedClassTotals {
  readonly measuredOn: string;
  /** class -> GiB across every tree. */
  readonly total: ReadonlyMap<string, number>;
  /** class -> tree -> GiB. */
  readonly byTree: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

export const DEFAULT_RENDER_SNAPSHOT_PATH = "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json";

export function readRenderedTotals(
  repoRoot = REPO_ROOT,
  snapshotPath = DEFAULT_RENDER_SNAPSHOT_PATH,
): RenderedClassTotals | null {
  // ATTEMPT the read; do not `existsSync` first. The check-then-use pair is a
  // TOCTOU window (`js/file-system-race`, and the repo's own
  // `lint-check-then-use-file-races`): the snapshot can be rewritten or removed
  // between the check and the read, so the answer the check gave is already
  // stale. One syscall, one answer — a miss IS the ENOENT.
  const text = readIfPresent(resolve(repoRoot, snapshotPath));
  if (text === null) return null;
  const parsed = JSON.parse(text) as {
    measuredOn?: unknown;
    clusterDefaultStorageClass?: unknown;
    rendered?: unknown;
  };
  const clusterDefault =
    typeof parsed.clusterDefaultStorageClass === "string" ? parsed.clusterDefaultStorageClass : null;
  const total = new Map<string, number>();
  const byTree = new Map<string, Map<string, number>>();
  for (const row of Array.isArray(parsed.rendered) ? parsed.rendered : []) {
    const pvc = row as { appId?: unknown; storageClassName?: unknown; gibibytes?: unknown; count?: unknown };
    const declared = typeof pvc.storageClassName === "string" ? pvc.storageClassName : "";
    const effective = declared === "" ? clusterDefault : declared;
    // An unparseable rendered size is `null` in the snapshot and is NOT zero.
    // Skipping it keeps the class total honestly incomplete instead of
    // silently short — the render audit is where that finding belongs.
    if (effective === null || typeof pvc.gibibytes !== "number") continue;
    const count = typeof pvc.count === "number" ? pvc.count : 1;
    const gib = pvc.gibibytes * count;
    total.set(effective, (total.get(effective) ?? 0) + gib);
    const tree = typeof pvc.appId === "string" ? (pvc.appId.split("/")[0] ?? "?") : "?";
    const bucket = byTree.get(effective) ?? new Map<string, number>();
    bucket.set(tree, (bucket.get(tree) ?? 0) + gib);
    byTree.set(effective, bucket);
  }
  return {
    measuredOn: typeof parsed.measuredOn === "string" ? parsed.measuredOn : "",
    total,
    byTree,
  };
}

/** A `<storageClass>  <N> GiB` figure quoted in one of the ledger's `$comment_*` blocks. */
export interface QuotedFigure {
  readonly storageClass: string;
  readonly gibibytes: number;
  readonly line: string;
}

const QUOTED_FIGURE = /^\s{2,}([A-Za-z][A-Za-z0-9._-]*)\s+([0-9]+)\s*GiB\b/;

/**
 * Every aligned `<class>  <N> GiB` row inside the ledger's prose blocks.
 *
 * Prose in a checked-in file is not documentation, it is an UNCHECKED ASSERTION
 * — and this ledger's prose carries the disk numbers a reader acts on. Until
 * 2026-08-22 nothing refused a hand-edit of them: the render figure could be
 * changed back to the superseded one and every test in the repo stayed green.
 * That is the vacuity class in the one place this file exists to prevent it.
 */
export function quotedFigures(comments: readonly string[], knownClasses: ReadonlySet<string>): readonly QuotedFigure[] {
  const out: QuotedFigure[] = [];
  for (const line of comments) {
    const match = QUOTED_FIGURE.exec(line);
    if (match === null) continue;
    const storageClass = match[1] ?? "";
    if (!knownClasses.has(storageClass)) continue;
    out.push({ storageClass, gibibytes: Number(match[2]), line: line.trim() });
  }
  return out;
}

/** Every `$comment*` string in the ledger JSON, flattened. */
export function ledgerComments(path: string, repoRoot = REPO_ROOT): readonly string[] {
  const text = readIfPresent(resolve(repoRoot, path));
  if (text === null) return [];
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const out: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith("$comment")) continue;
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) for (const entry of value) if (typeof entry === "string") out.push(entry);
  }
  return out;
}

/**
 * Does every storage figure the ledger's prose quotes still equal something the
 * auditor computes?
 *
 * The recognised set is deliberately a UNION of every reading the file is
 * entitled to cite — the YAML-derived total, each rung of the ladder, the
 * render across trees and the render per tree — because the prose's job is to
 * explain how those readings differ. What it may not do is quote a number that
 * is none of them, which is precisely what a stale figure is.
 */
export function findLedgerFigureDrift(
  ledger: Ledger,
  storageClaims: readonly StorageClaim[],
  catalogue: ProfileCatalogue | null,
  ledgerPath: string = DEFAULT_LEDGER_PATH,
  repoRoot = REPO_ROOT,
): readonly Finding[] {
  const derived = new Map(storageTotals(storageClaims));
  const render = readRenderedTotals(repoRoot);
  const recognised = new Map<string, Map<number, string>>();
  const remember = (storageClass: string, gib: number, why: string): void => {
    const bucket = recognised.get(storageClass) ?? new Map<number, string>();
    bucket.set(Math.round(gib), why);
    recognised.set(storageClass, bucket);
  };
  for (const [storageClass, gib] of derived) remember(storageClass, gib, "the YAML-derived total");
  if (catalogue !== null) {
    for (const storageClass of ledger.budgetedStorageClasses) {
      for (const profile of catalogue.profiles) {
        remember(storageClass, profileTotalGib(catalogue, profile), `the "${profile}" rung`);
        remember(storageClass, profileBringUpGib(catalogue, profile), `the "${profile}" rung at bring-up`);
      }
    }
  }
  if (render !== null) {
    for (const [storageClass, gib] of render.total) remember(storageClass, gib, "the render, every tree");
    for (const [storageClass, trees] of render.byTree) {
      for (const [tree, gib] of trees) remember(storageClass, gib, `the render, ${tree} tree`);
    }
  }
  const known = new Set(recognised.keys());
  for (const storageClass of ledger.budgetedStorageClasses) known.add(storageClass);
  const stale = quotedFigures(ledgerComments(ledgerPath, repoRoot), known).filter((figure) => {
    const bucket = recognised.get(figure.storageClass);
    return bucket === undefined || !bucket.has(figure.gibibytes);
  });
  if (stale.length === 0) return [];
  return [
    {
      check: "ledger-figures",
      severity: "blocker",
      message:
        `${String(stale.length)} storage figure(s) quoted in ${ledgerPath}'s prose match no reading this auditor ` +
        `computes. A number in a comment is read and acted on exactly like a number in a field; if nothing ` +
        `refuses a stale one, the file's most-read surface is its least-checked.`,
      detail: [
        ...stale.map(
          (figure) =>
            `"${figure.line}" — no reading of "${figure.storageClass}" equals ${String(figure.gibibytes)} GiB`,
        ),
        "recognised readings:",
        ...[...recognised.entries()]
          .sort((a, b) => stringCompare(a[0], b[0]))
          .flatMap(([storageClass, bucket]) =>
            [...bucket.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([gib, why]) => `  ${storageClass} ${String(gib)} GiB — ${why}`),
          ),
      ],
    },
  ];
}

export function auditAll(
  ledger: Ledger,
  roots: readonly string[] = DEFAULT_ROOTS,
  repoRoot = REPO_ROOT,
  registrationsRoot = DEFAULT_REGISTRATIONS_ROOT,
  catalogue: ProfileCatalogue | null = null,
  ledgerPath: string = DEFAULT_LEDGER_PATH,
  resources: ResourceCatalogue | null = null,
) {
  const manifests = loadManifests(roots, repoRoot);
  const measuredNodes = collectMeasuredNodes(repoRoot, registrationsRoot);
  const replicaClaims = manifests.flatMap((manifest) => extractReplicaClaims(manifest, ledger.nodeCount));
  const extraction: StorageExtractionOptions = {
    clusterDefault: clusterDefaultStorageClass(repoRoot),
    instantiated: instantiatedBlueprints(manifests),
  };
  const storageClaims = manifests.flatMap((manifest) => extractStorageClaims(manifest, extraction));
  // The profile total REPLACES the derived one for budgeted classes when a
  // catalogue is supplied. `main` always supplies one and `readLedger` refuses
  // a ledger with no activeStorageProfile, so the null branch is reachable only
  // from tests over synthetic trees that have no catalogue to be checked against.
  const override =
    catalogue === null || !catalogue.profiles.includes(ledger.activeStorageProfile)
      ? null
      : new Map<string, number>([["longhorn", profileTotalGib(catalogue, ledger.activeStorageProfile)]]);
  const findings = [
    ...findRootAppCollisions(collectRootAppIdentities(manifests), ledger.acknowledgedRootAppDuplicates),
    ...(catalogue === null ? [] : findStorageProfileDrift(ledger, catalogue, storageClaims, repoRoot)),
    ...findCapacityProvenance(storageClaims, ledger, measuredNodes, override),
    ...findStorageBudgetOverruns(storageClaims, ledger, override),
    ...findFalseRedundancy(replicaClaims, ledger),
    ...findLedgerFigureDrift(ledger, storageClaims, catalogue, ledgerPath, repoRoot),
    ...findResourceProfileDrift(ledger, resources, repoRoot),
    ...findComputeProvenance(ledger, measuredNodes, resources, repoRoot),
    ...findRungCoverage(ledger, resources, repoRoot),
  ];
  return {
    manifests: manifests.length,
    measuredNodes,
    longhornReserves: collectLonghornReserves(manifests),
    replicaClaims,
    storageClaims,
    catalogue,
    resources,
    findings,
  } as const;
}

/** Per-StorageClass declared capacity in GiB, descending. This is the hardware spec, derived. */
export function storageTotals(claims: readonly StorageClaim[]): readonly (readonly [string, number])[] {
  const totals = new Map<string, number>();
  for (const claim of claims) {
    totals.set(claim.storageClass, (totals.get(claim.storageClass) ?? 0) + claim.gibibytes * claim.replicas);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || stringCompare(a[0], b[0]));
}

export function readLedger(path: string, repoRoot = REPO_ROOT): Ledger {
  const abs = resolve(repoRoot, path);
  const parsed = JSON.parse(readFileSync(abs, "utf8")) as Partial<Ledger>;
  if (typeof parsed.nodeDiskGib !== "number" || typeof parsed.nodeCount !== "number") {
    throw new Error(`${path}: nodeDiskGib and nodeCount are required numbers`);
  }
  // REFUSED, not defaulted. A default rung would make the storage-profile check
  // report agreement with a profile nobody selected — the vacuity class exactly.
  if (typeof parsed.activeStorageProfile !== "string" || parsed.activeStorageProfile.trim().length === 0) {
    throw new Error(
      `${path}: activeStorageProfile is required and must name a profile in ${DEFAULT_CATALOGUE_PATH}. ` +
        `There is no default: which rung of the storage ladder a deployment runs is a property of its hardware, ` +
        `and guessing it would make the profile check unable to fail.`,
    );
  }
  // REFUSED for the same reason activeStorageProfile is, and the hole it closes
  // is the one PR #13663 named: two CPU rungs existed, one was written into the
  // manifests, and nothing in the repo recorded which. A default would let the
  // compute comparator report agreement with a rung nobody selected.
  if (typeof parsed.activeResourceProfile !== "string" || parsed.activeResourceProfile.trim().length === 0) {
    throw new Error(
      `${path}: activeResourceProfile is required and must name a rung in ${DEFAULT_CATALOGUE_PATH}'s ` +
        `resourceProfiles. There is no default: which CPU/memory rung a deployment runs decides which box its ` +
        `numbers are about, and guessing it is how a 4000m runner ends up standing in for a 16-core machine.`,
    );
  }
  return {
    activeStorageProfile: parsed.activeStorageProfile,
    activeResourceProfile: parsed.activeResourceProfile,
    nodeDiskGib: parsed.nodeDiskGib,
    nodeCount: parsed.nodeCount,
    budgetedStorageClasses: parsed.budgetedStorageClasses ?? [],
    acknowledgedFalseRedundancy: parsed.acknowledgedFalseRedundancy ?? [],
    acknowledgedRootAppDuplicates: parsed.acknowledgedRootAppDuplicates ?? [],
    acknowledgedCapacityShortfall: parsed.acknowledgedCapacityShortfall ?? [],
    // Defaulted to EMPTY, not refused, and the direction is why: an absent
    // acknowledgement list means "no debt is carried", which is the STRICTER
    // reading. A missing key can only make these checks louder, never quieter.
    acknowledgedComputeShortfall: parsed.acknowledgedComputeShortfall ?? [],
    acknowledgedRungBudgetGap: parsed.acknowledgedRungBudgetGap ?? [],
  };
}


/**
 * The compute half of the report — printed on EVERY run, green or not.
 *
 * The storage section prints its measured bound beside its declared total even
 * when nothing is over, because a standing decision that only appears when it
 * fails is a decision nobody revisits. Same reasoning here, with one addition
 * that only applies to CPU: the two substrates are ~4x apart, and until this
 * block existed the only machine either rung was printed against was the
 * runner. Somebody about to power on hardware should be able to read the
 * hardware number without running a different command.
 */
function printComputeSection(
  ledger: Ledger,
  nodes: readonly MeasuredNode[],
  resources: ResourceCatalogue,
): void {
  const dirs = metalAppliedDirs();
  const budget = envelopeBudget(resources.envelope);
  const laneDirs = devLaneAppliedDirs();
  console.log("\nCPU / memory rungs — the metal cohort against MEASURED node capacity:");
  if (dirs === null) {
    console.log(`  the metal cohort could not be read off ${METAL_ROOT_APPLICATION_PATH} — see findings`);
    return;
  }
  const floor = verifiedNodeCompute(nodes);
  for (const name of resources.profiles) {
    const metalTotal = resourceTotal(resources, name, dirs);
    const laneTotal = resourceTotal(resources, name, laneDirs);
    console.log(
      `  ${name === ledger.activeResourceProfile ? "*" : " "} ${name.padEnd(6)} ` +
        `metal cohort (${String(dirs.length)} apps): ${String(metalTotal.cpuMillis).padStart(5)}m / ` +
        `${String(metalTotal.memoryMib).padStart(6)}Mi   ` +
        `dev lane (${String(laneDirs.length)} apps): ${String(laneTotal.cpuMillis).padStart(5)}m / ` +
        `${String(laneTotal.memoryMib).padStart(6)}Mi` +
        (name === ledger.activeResourceProfile ? "   <- ACTIVE (ledger.activeResourceProfile)" : ""),
    );
  }
  console.log(
    `  runner budget (what CI measures against): ${String(budget.cpuMillis)}m / ${String(budget.memoryMib)}Mi ` +
      `on a ${resources.envelope.runner}`,
  );
  if (floor.cpu === null || floor.memory === null) {
    console.log("  Measured node compute: NONE — no ClusterNode registration records BOTH cores and memory.");
    return;
  }
  console.log(
    `  measured floor: ${floor.cpu.hostname} ${String((floor.cpu.cpuMillis ?? 0) * ledger.nodeCount)}m ` +
      `(cores=${String(floor.cpu.coresRaw ?? 0)} x ${String(ledger.nodeCount)} node(s), nproc = LOGICAL CPUs) · ` +
      `${floor.memory.hostname} ${String((floor.memory.memoryMib ?? 0) * ledger.nodeCount)}Mi ` +
      `(memory="${floor.memory.memoryRaw ?? ""}" read as DECIMAL — free -h --si)`,
  );
  console.log(
    "  That bound is the node's WHOLE capacity: nothing is held back for the kubelet, the control plane,\n" +
      "  kube-system or the OS, and BestEffort pods never appear in the declared total at all. Exceeding it\n" +
      "  convicts; staying under it proves nothing on its own.",
  );
}

function main(argv: readonly string[]): void {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.error(
      "usage: bun src/Core.TypeScript/cluster/single-node-readiness.ts [--ledger PATH] [--nodes N] [--json]",
    );
    process.exit(2);
  }
  const ledgerFlag = argv.indexOf("--ledger");
  const ledgerPath = ledgerFlag >= 0 ? (argv[ledgerFlag + 1] ?? DEFAULT_LEDGER_PATH) : DEFAULT_LEDGER_PATH;
  let ledger = readLedger(ledgerPath);
  const nodesFlag = argv.indexOf("--nodes");
  if (nodesFlag >= 0) {
    const nodes = Number(argv[nodesFlag + 1]);
    if (!Number.isInteger(nodes) || nodes < 1) {
      console.error("--nodes must be a positive integer");
      process.exit(2);
    }
    ledger = { ...ledger, nodeCount: nodes };
  }

  let report: ReturnType<typeof auditAll>;
  let catalogue: ProfileCatalogue;
  let resources: ResourceCatalogue;
  try {
    // Loaded (and validated) BEFORE the audit, so a malformed catalogue aborts
    // rather than quietly falling through to the derived totals.
    catalogue = loadCatalogue(DEFAULT_CATALOGUE_PATH);
    resources = loadResourceCatalogue(DEFAULT_CATALOGUE_PATH);
    report = auditAll(ledger, DEFAULT_ROOTS, REPO_ROOT, DEFAULT_REGISTRATIONS_ROOT, catalogue, ledgerPath, resources);
  } catch (error) {
    console.error(`single-node readiness ABORTED: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  const profile = ledger.activeStorageProfile;
  const profileKnown = catalogue.profiles.includes(profile);
  if (argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          ledger,
          ...report,
          storageTotals: storageTotals(report.storageClaims),
          profileTotals: Object.fromEntries(
            catalogue.profiles.map((name) => [
              name,
              { declaredGib: profileTotalGib(catalogue, name), bringUpGib: profileBringUpGib(catalogue, name) },
            ]),
          ),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `single-node readiness: ${report.manifests} manifests, nodeCount=${ledger.nodeCount}, ` +
        `storage profile=${profile}, resource rung=${ledger.activeResourceProfile}`,
    );
    printComputeSection(ledger, report.measuredNodes, resources);
    console.log("\nStorage profile ladder (declared = size x pods over every longhorn claim):");
    for (const name of catalogue.profiles) {
      const declared = profileTotalGib(catalogue, name);
      console.log(
        `  ${name === profile ? "*" : " "} ${name.padEnd(10)} ${declared.toFixed(0).padStart(5)} GiB declared, ` +
          `${profileBringUpGib(catalogue, name).toFixed(0).padStart(5)} GiB provisions at bring-up` +
          (name === profile ? "   <- ACTIVE (ledger.activeStorageProfile)" : ""),
      );
    }
    console.log(
      "  Bring-up is the subset whose Application is actually applied on a fresh sync. It is a REPORT, never a\n" +
        "  discount: Longhorn's StorageClass is volumeBindingMode Immediate, so any PVC that gets applied\n" +
        "  provisions with zero pods, and a manual-sync app is one `argocd app sync` from being counted.",
    );
    console.log("\nDerived per-node storage requirement (sum of declared PVC capacity x replicas):");
    const floor = verifiedNodeCapacity(report.measuredNodes);
    const rendered = readRenderedTotals();
    for (const [storageClass, gib] of storageTotals(report.storageClaims)) {
      const budgeted = ledger.budgetedStorageClasses.includes(storageClass);
      const authoritative = budgeted && profileKnown ? profileTotalGib(catalogue, profile) : null;
      console.log(
        `  ${storageClass.padEnd(18)} ${gib.toFixed(0).padStart(6)} GiB derived` +
          // "aspirational" is not decoration. nodeDiskGib is unsigned by the
          // ledger's own admission, so a bare "(budget N GiB)" reads as a
          // measurement it is not.
          (budgeted
            ? `  (nodeDiskGib budget ${(ledger.nodeDiskGib * ledger.nodeCount).toFixed(0)} GiB, ASPIRATIONAL)`
            : "  (unbudgeted)"),
      );
      // The derived number is printed above because it is a real second reading,
      // and printed as SUPERSEDED here because it is the blind one: it cannot see
      // upstream chart pod counts and it invents some of ours.
      if (authoritative !== null && Math.abs(authoritative - gib) > 0.5) {
        console.log(
          `  ${" ".repeat(18)} ${authoritative.toFixed(0).padStart(6)} GiB CHECKED (profile "${profile}") ` +
            `— supersedes the derived ${gib.toFixed(0)} GiB; the extractor cannot see chart-default pod counts`,
        );
      }
      // The same superseding, for the classes no profile rung governs. The
      // render is per TREE because the two Application roots collide on
      // `argocd/zeta-root` and one prunes the other: a single node runs one of
      // them, so their sum is a number no cluster is ever asked for.
      const renderedTrees = rendered?.byTree.get(storageClass);
      if (renderedTrees !== undefined) {
        for (const [tree, treeGib] of [...renderedTrees.entries()].sort((a, b) => stringCompare(a[0], b[0]))) {
          console.log(
            `  ${" ".repeat(18)} ${treeGib.toFixed(0).padStart(6)} GiB RENDERED (${tree} tree, ` +
              `snapshot ${rendered?.measuredOn ?? "?"}) — trust this over the derived ${gib.toFixed(0)} GiB for ` +
              `capacity; our YAML declares only part of what the charts ask for`,
          );
        }
      }
    }
    console.log(
      floor === null
        ? "\nMeasured node capacity: NONE — no checked-in ClusterNode registration records hardware.storage."
        : `\nMeasured node capacity (smallest registered node, every block device counted):\n` +
            `  ${floor.hostname.padEnd(18)} ${((floor.totalGib ?? 0) * ledger.nodeCount).toFixed(0).padStart(6)} GiB` +
            `  (${floor.path})`,
    );
    // SCHEDULABLE, printed beside RAW so nobody reads the gate's comparator as
    // the disk a profile has to fit in. This is an estimate and says so; the
    // exit code is still the raw comparison. See the block comment above
    // `longhornUsableFraction` for why the assumptions keep it out of the gate.
    if (floor !== null) {
      const fraction = mostConservativeUsableFraction(report.longhornReserves);
      const schedulable = schedulableBoundGib(floor.totalGib ?? 0, fraction, ledger.nodeCount);
      console.log(
        `\nSchedulable estimate (REPORT, not the gate — the exit code is still the raw comparison above):\n` +
          `  ${(fraction * 100).toFixed(0)}% of (${(floor.totalGib ?? 0).toFixed(0)} GiB - ${OS_ROOT_ALLOWANCE_GIB} GiB OS root) ` +
          `x ${ledger.nodeCount} node(s) = ${schedulable.toFixed(0)} GiB Longhorn will place`,
      );
      for (const reserve of report.longhornReserves) {
        const over = reserve.overProvisioningPercentage;
        const minimalAvailable = reserve.minimalAvailablePercentage;
        console.log(
          `    ${reserve.path}: overProvisioning=${over === null ? "chart default 100" : over.toFixed(0)}, ` +
            `minimalAvailable=${minimalAvailable === null ? "chart default 25" : minimalAvailable.toFixed(0)} ` +
            `-> ${(reserve.usableFraction * 100).toFixed(0)}% usable`,
        );
      }
      if (profileKnown) {
        const declared = profileTotalGib(catalogue, profile);
        const bringUp = profileBringUpGib(catalogue, profile);
        const verdict = (gib: number): string =>
          gib <= schedulable
            ? `fits, ${(schedulable - gib).toFixed(0)} GiB spare`
            : `DOES NOT FIT, over by ${(gib - schedulable).toFixed(0)} GiB`;
        console.log(
          `    profile "${profile}" bring-up  ${bringUp.toFixed(0).padStart(5)} GiB  ${verdict(bringUp)}\n` +
            `    profile "${profile}" declared  ${declared.toFixed(0).padStart(5)} GiB  ${verdict(declared)}` +
            (declared > schedulable && bringUp <= schedulable
              ? `\n    -> the gap is capacity that is DECLARED but never applied on a fresh sync. It stays a\n` +
                `       standing decision, not a passed check: syncing those Applications at their current\n` +
                `       ceilings would ask Longhorn for storage it will refuse to place.`
              : ""),
        );
      }
    }
    // Acknowledged shortfalls suppress the exit code, never the print. A
    // silently-acknowledged oversubscription is the same vacuity as an
    // aspirational comparator, one layer down.
    if (floor !== null && ledger.acknowledgedCapacityShortfall.length > 0) {
      console.log(
        "\nACKNOWLEDGED capacity shortfalls (debt, not clearance — exit code suppressed, arithmetic is not):",
      );
      for (const key of [...ledger.acknowledgedCapacityShortfall].sort((a, b) => stringCompare(a, b))) {
        console.log(`  ${key}`);
      }
    }
    for (const finding of report.findings) {
      console.log(`\n[${finding.severity}] ${finding.check}: ${finding.message}`);
      for (const line of finding.detail) console.log(`    ${line}`);
    }
    if (report.findings.length === 0) console.log("\nno blockers.");
  }
  process.exit(report.findings.some((finding) => finding.severity === "blocker") ? 1 : 0);
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
