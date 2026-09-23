#!/usr/bin/env bun
// src/Core.TypeScript/cluster/storage-capabilities.ts
//
// NO CHART NAMES A STORAGE PROVIDER. It names a CAPABILITY, and each cluster
// binds the capability to whatever provider it actually runs.
//
// The maintainer, 2026-09-23: "where possible like PVC we should try to have an
// abstraction so no chart is requesting a specific PVC provider, it references
// some class of PVC that's more abstract."
//
// WHAT IT REPLACES. Until this module, 20 class lines across 16 Applications
// wrote `longhorn` and seven more wrote `zeta-local-path` -- a
// provider's product name and a provisioner's binary name. So the dev/CI lane
// could only run them by FAKING the provider: a StorageClass literally named
// `longhorn` bound to `rancher.io/local-path`, guarded by a check that its
// provisioner was NOT Longhorn. That alias was honest about itself, but the
// shape was backwards -- the chart said "Longhorn" and the cluster had to lie
// about what Longhorn was. Here the chart says what it NEEDS and the cluster
// says what it HAS, and neither sentence is false on any substrate.
//
// ── THE CAPABILITIES ─────────────────────────────────────────────────────────
// Three, and only three. Named for what a workload may rely on, not for how it
// is implemented. Kubernetes has exactly this indirection built in -- a
// StorageClass IS a name bound to a provisioner -- so no new mechanism exists
// here; what is new is refusing to spend the name on the provider.
//
//   zeta-block-replicated  durable RWO block, replicated where the cluster can.
//                          Metal: Longhorn (driver.longhorn.io). Its replica
//                          count follows the node count, which is 1 today
//                          (longhorn/Application.yaml defaultReplicaCount), so
//                          the capability is "as replicated as this cluster
//                          can make it", never a promise of three copies.
//   zeta-block-local       node-local, UNREPLICATED RWO block. Caches, scratch,
//                          and the early-wave workloads that must bind before
//                          Longhorn exists (openbao -60, spire -50). Metal and
//                          dev: rancher.io/local-path. THE CLUSTER DEFAULT.
//   zeta-shared            RWX. Metal: Longhorn's NFSv4 share-manager
//                          (longhorn-prereqs.nix installs nfs-utils for exactly
//                          this). Dev/CI: DELIBERATELY UNBOUND -- local-path is
//                          RWO-only, so an RWX claim there could only hang
//                          Pending; the harness's access-mode rule keeps such
//                          Applications out of the proof instead.
//
// ── WHY THE DEFAULT IS zeta-block-local, NOT zeta-block-replicated ───────────
// The first design made the REPLICATED class the default, so a chart that omits
// a class would still land somewhere durable. The tree argued otherwise, twice:
//
//   1. THE DISK BUDGET. The class-less claims in the render (dapr 48 GiB, gitlab
//      66, loki 20, mimir 6 -- rendered-storage-claims.snapshot.json) total
//      ~140 GiB. The replicated class is the one `budgetedStorageClasses`
//      governs, at 943 GiB on profile `measured` against 1047 GiB usable on the
//      smallest registered node (single-node-budget.json). Defaulting to it
//      moves 140 GiB into that budget: ~1083 GiB, OVER the measured box. The
//      default is not a naming question; it decides which disk a chart that
//      said nothing lands on.
//   2. FIRST BOOT. The default must exist before ArgoCD does. Metal's Longhorn
//      installs at wave -15; anything class-less that syncs earlier would pend
//      against a default whose provisioner is not running yet -- the exact
//      inversion vault/TOPOLOGY.md fact #6 measured. rancher.io/local-path is a
//      k3s auto-deploy manifest and is there from boot.
//
// So the default stays where it was (the local class, formerly
// `zeta-local-path`), renamed to its capability. Moving it is a disk-budget
// decision for a maintainer, and this file says so rather than making it.
//
// ── BINDING MODE: WaitForFirstConsumer, ON BOTH ──────────────────────────────
// Dev and metal are identical here, and the choice is the long-term one rather
// than the convenient one. local-path is node-local, so under `Immediate` it
// would choose a node BEFORE the scheduler does -- wrong on any multi-node
// cluster (the reasoning the old dev `longhorn` alias recorded in its own
// header). For Longhorn it is the topology-aware mode that lets a volume follow
// the node its pod lands on once there is more than one node. Metal's Longhorn
// class was `Immediate` until now; it moves, dev does not. The one cost, stated
// so nobody debugs it cold: a PVC with no consuming pod never binds.
//
// ── THE FALSIFIER ────────────────────────────────────────────────────────────
// `auditStorageCapabilities` below, run in the k8s-argocd-health-test plan job.
// It is an ALLOWLIST, not a denylist: every non-empty storageClass value in an
// Application tree or in the committed render must be one of the three names.
// A denylist of provider names would pass the next provider nobody listed.

import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseAllDocuments } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const STORAGE_CAPABILITY = {
  blockReplicated: "zeta-block-replicated",
  blockLocal: "zeta-block-local",
  shared: "zeta-shared",
} as const;

export type StorageCapability = (typeof STORAGE_CAPABILITY)[keyof typeof STORAGE_CAPABILITY];

export const STORAGE_CAPABILITIES: readonly StorageCapability[] = Object.values(STORAGE_CAPABILITY);

/** The one class every cluster marks default. See the header for why it is the local one. */
export const DEFAULT_STORAGE_CAPABILITY: StorageCapability = STORAGE_CAPABILITY.blockLocal;

/**
 * Provider / provisioner names that have appeared, or plausibly would, as a
 * `storageClassName`. Used ONLY to make a refusal say what went wrong -- the
 * gate itself is the allowlist above, so a provider missing from this list is
 * still refused.
 */
export const KNOWN_PROVIDER_CLASS_NAMES: readonly string[] = [
  "longhorn",
  "zeta-local-path",
  "local-path",
  "standard",
  "hostpath",
  "openebs-hostpath",
  "ceph-block",
  "rook-ceph-block",
  "nfs-client",
  "gp2",
  "gp3",
];

export function isStorageCapability(name: string): name is StorageCapability {
  return (STORAGE_CAPABILITIES as readonly string[]).includes(name);
}

/** Where each cluster declares its bindings. One file per substrate. */
export const METAL_STORAGE_BINDINGS_SOURCE = "full-ai-cluster/nixos/modules/local-storage.nix";
export const DEV_STORAGE_BINDINGS_DIR = "full-ai-cluster/dev-cluster/manifests";

/** The trees whose manifests reach a cluster and so may name a StorageClass. */
export const CLASS_NAMING_ROOTS: readonly string[] = [
  "full-ai-cluster/k8s/applications",
  "full-ai-cluster/k8s/bootstrap",
];

export const RENDER_SNAPSHOT = "src/Core.TypeScript/cluster/rendered-storage-claims.snapshot.json";

export interface ClassNameViolation {
  readonly where: string;
  readonly value: string;
  readonly why: string;
}

const CLASS_KEY = /^\s*(?:-\s+)?(storageClass|storageClassName)\s*:\s*(.*)$/;

/**
 * Every `storageClass:` / `storageClassName:` SCALAR in a YAML text, with its
 * 1-based line. A flow-mapping value (`{ type: string, ... }` in a CRD schema)
 * is not a class name and is skipped; so is an empty value (the cluster default).
 *
 * Line-based on purpose, like `requestsLonghornStorageClass` before it: the key
 * appears inside Helm `valuesObject`, StatefulSet volumeClaimTemplates, bare
 * PVCs and CRD schemas, and a line scan reads all of them the same way.
 */
export function storageClassValues(text: string): readonly { line: number; value: string }[] {
  const found: { line: number; value: string }[] = [];
  text.split("\n").forEach((raw, index) => {
    const match = CLASS_KEY.exec(raw);
    if (match === null) return;
    let value = (match[2] ?? "").split("#", 1)[0]?.trim() ?? "";
    if (value.startsWith("{") || value.startsWith("[") || value === "|" || value === ">") return;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value === "" || value === "null" || value === "~") return;
    found.push({ line: index + 1, value });
  });
  return found;
}

/**
 * `null` when absent -- one syscall, one answer (CWE-367): read, then interpret
 * ENOENT, rather than an existence check whose answer is stale when the read runs.
 */
function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function yamlFilesUnder(dir: string): readonly string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return yamlFilesUnder(path);
    return entry.isFile() && /\.ya?ml$/.test(entry.name) ? [path] : [];
  });
}

function refusal(value: string): string {
  const known = KNOWN_PROVIDER_CLASS_NAMES.includes(value)
    ? `"${value}" is a PROVIDER name`
    : `"${value}" is not a storage capability`;
  return (
    `${known}; name what the workload needs -- one of ${STORAGE_CAPABILITIES.join(", ")} -- and let each ` +
    `cluster bind it (${METAL_STORAGE_BINDINGS_SOURCE}, ${DEV_STORAGE_BINDINGS_DIR}/)`
  );
}

/** Every provider-named (i.e. non-capability) class in the manifest trees and the committed render. */
export function findProviderNamedClasses(repoRoot = REPO_ROOT): readonly ClassNameViolation[] {
  const violations: ClassNameViolation[] = [];
  for (const root of CLASS_NAMING_ROOTS) {
    for (const file of yamlFilesUnder(join(repoRoot, root))) {
      for (const { line, value } of storageClassValues(readFileSync(file, "utf8"))) {
        if (isStorageCapability(value)) continue;
        violations.push({ where: `${relative(repoRoot, file)}:${String(line)}`, value, why: refusal(value) });
      }
    }
  }
  const snapshotText = readIfPresent(join(repoRoot, RENDER_SNAPSHOT));
  if (snapshotText !== null) {
    const snapshot = JSON.parse(snapshotText) as {
      rendered?: { appId?: string; name?: string; storageClassName?: string }[];
    };
    for (const claim of snapshot.rendered ?? []) {
      const value = claim.storageClassName ?? "";
      if (value === "" || isStorageCapability(value)) continue;
      violations.push({
        where: `${RENDER_SNAPSHOT} ${claim.appId ?? "?"} ${claim.name ?? "?"}`,
        value,
        why: `the RENDER emits it -- an upstream chart default, or a value path our valuesObject does not reach. ${refusal(value)}`,
      });
    }
  }
  return violations;
}

export interface StorageClassBinding {
  readonly name: string;
  readonly provisioner: string;
  readonly isDefault: boolean;
  readonly bindingMode: string;
}

/** StorageClass objects in a YAML text (multi-document aware). */
export function storageClassesIn(text: string): readonly StorageClassBinding[] {
  const out: StorageClassBinding[] = [];
  for (const doc of parseAllDocuments(text)) {
    const value: unknown = doc.toJS();
    if (typeof value !== "object" || value === null) continue;
    const record = value as {
      kind?: unknown;
      metadata?: { name?: unknown; annotations?: Record<string, unknown> };
      provisioner?: unknown;
      volumeBindingMode?: unknown;
    };
    if (record.kind !== "StorageClass") continue;
    if (typeof record.metadata?.name !== "string" || typeof record.provisioner !== "string") continue;
    out.push({
      name: record.metadata.name,
      provisioner: record.provisioner,
      isDefault: record.metadata.annotations?.["storageclass.kubernetes.io/is-default-class"] === "true",
      bindingMode: typeof record.volumeBindingMode === "string" ? record.volumeBindingMode : "Immediate",
    });
  }
  return out;
}

/**
 * The metal bindings, read out of the nix module's embedded manifest. The nix
 * file carries the YAML inside a `''...''` string, so this extracts the text of
 * every `writeText "<name>.yaml" ''` block and parses each as YAML.
 */
export function metalStorageBindings(repoRoot = REPO_ROOT): readonly StorageClassBinding[] {
  const text = readIfPresent(join(repoRoot, METAL_STORAGE_BINDINGS_SOURCE));
  if (text === null) return [];
  const blocks = [...text.matchAll(/writeText\s+"[^"]+\.yaml"\s+''\n([\s\S]*?)\n\s*'';/g)];
  return blocks.flatMap((block) => {
    const body = block[1] ?? "";
    const indent = /^( *)\S/m.exec(body)?.[1]?.length ?? 0;
    const dedented = body
      .split("\n")
      .map((line) => line.slice(Math.min(indent, line.length - line.trimStart().length)))
      .join("\n");
    return storageClassesIn(dedented);
  });
}

/**
 * Capabilities metal binds to the SAME provisioner as `zeta-block-replicated`
 * -- i.e. that draw from the one Longhorn pool the storage-profile ladder
 * budgets. Today `zeta-block-replicated` and `zeta-shared`.
 *
 * DERIVED from the metal bindings, never restated: if `zeta-shared` were ever
 * rebound to a different provider, its claims would leave the ladder's scope
 * on the same edit instead of being counted against a pool they no longer use.
 * FAILS CLOSED to the replicated capability alone when the bindings cannot be
 * read -- the narrowest scope, which makes a catalogue row on another class
 * LOUD (a stale-row finding) rather than silently matched.
 */
export function metalPoolCapabilities(repoRoot = REPO_ROOT): readonly string[] {
  const bindings = metalStorageBindings(repoRoot);
  const replicated = bindings.find((b) => b.name === STORAGE_CAPABILITY.blockReplicated);
  if (replicated === undefined) return [STORAGE_CAPABILITY.blockReplicated];
  return bindings
    .filter((b) => b.provisioner === replicated.provisioner && isStorageCapability(b.name))
    .map((b) => b.name)
    .sort();
}

export function devStorageBindings(repoRoot = REPO_ROOT): readonly StorageClassBinding[] {
  return yamlFilesUnder(join(repoRoot, DEV_STORAGE_BINDINGS_DIR)).flatMap((file) =>
    storageClassesIn(readFileSync(file, "utf8")),
  );
}

export interface BindingFinding {
  readonly cluster: "metal" | "dev";
  readonly problem: string;
}

/**
 * Each cluster binds the names it promises, with ONE default -- the declared
 * default capability -- and WaitForFirstConsumer on every capability class.
 *
 * `required` differs per cluster ON PURPOSE: dev binds the two RWO names and
 * leaves `zeta-shared` unbound, and a dev binding for it would be refused
 * here, because local-path cannot serve RWX and a class that exists but can
 * never bind is worse than one that is absent (the claim pends instead of
 * being kept out of the proof).
 */
export function auditBindings(
  cluster: "metal" | "dev",
  bindings: readonly StorageClassBinding[],
): readonly BindingFinding[] {
  const findings: BindingFinding[] = [];
  const required =
    cluster === "metal"
      ? STORAGE_CAPABILITIES
      : [STORAGE_CAPABILITY.blockReplicated, STORAGE_CAPABILITY.blockLocal];
  const byName = new Map(bindings.map((b) => [b.name, b]));
  for (const name of required) {
    if (!byName.has(name)) findings.push({ cluster, problem: `does not bind "${name}"` });
  }
  if (cluster === "dev" && byName.has(STORAGE_CAPABILITY.shared)) {
    findings.push({
      cluster,
      problem: `binds "${STORAGE_CAPABILITY.shared}" (RWX) -- no dev provisioner can serve RWX, so the class would exist and never bind`,
    });
  }
  for (const binding of bindings) {
    if (!isStorageCapability(binding.name)) {
      findings.push({ cluster, problem: `declares provider-named class "${binding.name}" -- bind a capability name instead` });
      continue;
    }
    if (binding.bindingMode !== "WaitForFirstConsumer") {
      findings.push({
        cluster,
        problem: `"${binding.name}" binds ${binding.bindingMode}; every capability class is WaitForFirstConsumer on every cluster`,
      });
    }
  }
  const defaults = bindings.filter((b) => b.isDefault).map((b) => b.name);
  if (defaults.length !== 1 || defaults[0] !== DEFAULT_STORAGE_CAPABILITY) {
    findings.push({
      cluster,
      problem: `default class(es) are [${defaults.join(", ")}]; exactly one is required and it is "${DEFAULT_STORAGE_CAPABILITY}"`,
    });
  }
  return findings;
}

export interface StorageCapabilityAudit {
  readonly providerNamed: readonly ClassNameViolation[];
  readonly bindings: readonly BindingFinding[];
}

export function auditStorageCapabilities(repoRoot = REPO_ROOT): StorageCapabilityAudit {
  return {
    providerNamed: findProviderNamedClasses(repoRoot),
    bindings: [
      ...auditBindings("metal", metalStorageBindings(repoRoot)),
      ...auditBindings("dev", devStorageBindings(repoRoot)),
    ],
  };
}

if (import.meta.main) {
  const audit = auditStorageCapabilities();
  const metal = metalStorageBindings();
  const dev = devStorageBindings();
  console.log("storage capabilities: " + STORAGE_CAPABILITIES.join(", ") + ` (default ${DEFAULT_STORAGE_CAPABILITY})`);
  for (const [cluster, list] of [["metal", metal], ["dev", dev]] as const) {
    for (const b of list) {
      console.log(`  ${cluster.padEnd(5)} ${b.name.padEnd(22)} -> ${b.provisioner}${b.isDefault ? " (default)" : ""}`);
    }
  }
  for (const v of audit.providerNamed) console.log(`REFUSED ${v.where}: ${v.why}`);
  for (const f of audit.bindings) console.log(`REFUSED binding (${f.cluster}): ${f.problem}`);
  const bad = audit.providerNamed.length + audit.bindings.length;
  console.log(bad === 0 ? "ok: no manifest names a storage provider, and both clusters bind every capability they promise" : `${String(bad)} finding(s)`);
  process.exit(bad === 0 ? 0 : 1);
}
