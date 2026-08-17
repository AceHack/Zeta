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
  readonly check: "root-app-collision" | "storage-budget" | "false-redundancy";
  readonly severity: "blocker" | "warning";
  readonly message: string;
  readonly detail: readonly string[];
}

export interface Ledger {
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

export function extractStorageClaims(manifest: AppManifest): readonly StorageClaim[] {
  const out: StorageClaim[] = [];
  for (const doc of manifest.docs) {
    for (const [field, value] of walk(doc)) {
      if (!STORAGE_CLASS_KEYS.has(lastSegment(field))) continue;
      if (typeof value !== "string" || value.length === 0) continue;
      const scope = field.slice(0, Math.max(0, field.lastIndexOf(".")));
      const size = sizeNear(doc, scope);
      if (size === null) continue;
      const replicas = replicasGoverning(doc, field);
      out.push({
        app: manifest.app,
        path: manifest.path,
        field,
        storageClass: value,
        gibibytes: size,
        replicas,
      });
    }
  }
  return out;
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
// Budget + redundancy findings
// ---------------------------------------------------------------------------

export function findStorageBudgetOverruns(claims: readonly StorageClaim[], ledger: Ledger): readonly Finding[] {
  const budget = ledger.nodeDiskGib * ledger.nodeCount;
  const findings: Finding[] = [];
  for (const storageClass of [...ledger.budgetedStorageClasses].sort((a, b) => stringCompare(a, b))) {
    const matching = claims.filter((claim) => claim.storageClass === storageClass);
    if (matching.length === 0) continue;
    const total = matching.reduce((sum, claim) => sum + claim.gibibytes * claim.replicas, 0);
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

export function auditAll(ledger: Ledger, roots: readonly string[] = DEFAULT_ROOTS, repoRoot = REPO_ROOT) {
  const manifests = loadManifests(roots, repoRoot);
  const replicaClaims = manifests.flatMap((manifest) => extractReplicaClaims(manifest, ledger.nodeCount));
  const storageClaims = manifests.flatMap((manifest) => extractStorageClaims(manifest));
  const findings = [
    ...findRootAppCollisions(collectRootAppIdentities(manifests), ledger.acknowledgedRootAppDuplicates),
    ...findStorageBudgetOverruns(storageClaims, ledger),
    ...findFalseRedundancy(replicaClaims, ledger),
  ];
  return { manifests: manifests.length, replicaClaims, storageClaims, findings } as const;
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
  return {
    nodeDiskGib: parsed.nodeDiskGib,
    nodeCount: parsed.nodeCount,
    budgetedStorageClasses: parsed.budgetedStorageClasses ?? [],
    acknowledgedFalseRedundancy: parsed.acknowledgedFalseRedundancy ?? [],
    acknowledgedRootAppDuplicates: parsed.acknowledgedRootAppDuplicates ?? [],
  };
}

export const DEFAULT_LEDGER_PATH = "full-ai-cluster/k8s/single-node-budget.json";

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
  try {
    report = auditAll(ledger);
  } catch (error) {
    console.error(`single-node readiness ABORTED: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ ledger, ...report, storageTotals: storageTotals(report.storageClaims) }, null, 2));
  } else {
    console.log(`single-node readiness: ${report.manifests} manifests, nodeCount=${ledger.nodeCount}`);
    console.log("\nDerived per-node storage requirement (sum of declared PVC capacity x replicas):");
    for (const [storageClass, gib] of storageTotals(report.storageClaims)) {
      const budgeted = ledger.budgetedStorageClasses.includes(storageClass);
      console.log(
        `  ${storageClass.padEnd(18)} ${gib.toFixed(0).padStart(6)} GiB` +
          (budgeted ? `  (budget ${(ledger.nodeDiskGib * ledger.nodeCount).toFixed(0)} GiB)` : "  (unbudgeted)"),
      );
    }
    for (const finding of report.findings) {
      console.log(`\n[${finding.severity}] ${finding.check}: ${finding.message}`);
      for (const line of finding.detail) console.log(`    ${line}`);
    }
    if (report.findings.length === 0) console.log("no blockers.");
  }
  process.exit(report.findings.some((finding) => finding.severity === "blocker") ? 1 : 0);
}

if (import.meta.main) {
  main(process.argv.slice(2));
}
