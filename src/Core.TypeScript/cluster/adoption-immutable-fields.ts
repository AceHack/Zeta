#!/usr/bin/env bun
/**
 * adoption-immutable-fields.ts — a chart installed at first boot and then ADOPTED by an
 * ArgoCD Application must render the same IMMUTABLE fields on both sides.
 *
 * ── THE DEFECT THIS CLOSES (081M3HYPQCR087G0R003C2VPRS) ─────────────────────────────
 * First-boot replica, constrained lane, dispatch 36333824468 (and the 2026-09-27
 * scheduled run before it, job 108575341470):
 *
 *   spire: OutOfSync/Progressing -- SyncError: ... error when patching ...:
 *   StatefulSet.apps "spire-server" is invalid: spec: Forbidden: updates to
 *   statefulset spec for fields other than 'replicas', 'ordinals', 'template',
 *   'updateStrategy', 'revisionHistoryLimit', 'persistentVolumeClaimRetentionPolicy'
 *   and 'minReadySeconds' are forbidden (retried 5 times).
 *
 * K3S's helm-controller installs spire from `k8s/bootstrap/spire-install.yaml`; the
 * `spire` Application then adopts the same release. The COMMITTED pair renders a
 * byte-identical StatefulSet -- measured, `helm template` 0.24.2 at kube 1.35.6, `diff`
 * of the two StatefulSets empty. The divergence was introduced by the dev-rung serve
 * tree: `rung-overrides.yaml` entry `spire/disk-dev` sets the Application's
 * `spire-server.persistence.size` to 512Mi, while the bootstrap HelmChart -- which no
 * rung ever touches, because k3s reads it from the node's manifest directory -- still
 * declares 5Gi. So the live StatefulSet has
 * `volumeClaimTemplates[spire-data].spec.resources.requests.storage: 5Gi` and ArgoCD
 * asks for 512Mi, and the API server refuses the patch forever: nothing about a retry
 * changes an immutable field.
 *
 * WHERE IT BITES, stated narrowly because the first reading was wider than the
 * evidence: every lane that combines the k3s bootstrap roster with a rung-overlaid
 * Application tree -- today the first-boot replica, both modes. The committed (`metal`)
 * tree, which is what an installed disk serves, renders the pair identically, and this
 * file checks that too.
 *
 * ── WHAT "IMMUTABLE" MEANS HERE ─────────────────────────────────────────────────────
 * The fields the API server refuses to change on update, per kind:
 *   StatefulSet   selector, serviceName, podManagementPolicy, volumeClaimTemplates
 *   Deployment / DaemonSet / ReplicaSet   selector
 *   Job (non-hook)   selector, template
 *   Service   clusterIP, clusterIPs
 *   PersistentVolumeClaim   storageClassName, accessModes, volumeMode, and the storage
 *                           request (it may GROW, never shrink -- compared for equality,
 *                           which is the stricter and the honest reading of "the two
 *                           owners agree")
 * Helm hooks are skipped: both installers treat them as ephemeral, and the Application
 * side commonly disables them outright.
 *
 * ── HONEST LIMITS ──────────────────────────────────────────────────────────────────
 *   - It compares two RENDERS. A field the API server defaults (podManagementPolicy is
 *     the one that matters) is defaulted here first, so an omitted default and an
 *     explicit one read as equal -- as they do on the server.
 *   - A resource rendered on only one side is counted, not failed: that is a
 *     different defect class (two owners of different objects), and failing it here
 *     would conflate them.
 *   - It needs `helm` and the network. The comparison itself is pure and has hermetic
 *     falsifiers in the `.test.ts`, including the spire 5Gi-vs-512Mi pair.
 *
 * Run:   bun src/Core.TypeScript/cluster/adoption-immutable-fields.ts [--apply-all-overrides]
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { type HelmChartCr, parseHelmChartCrs } from "../../../full-ai-cluster/k8s/tests/render-first-boot-charts.ts";
import { stringCompare } from "../collation/collation.ts";
import { bootstrapDirs } from "./declared-cluster-trees.ts";
import { type ApplicationSource, discoverApplications, renderApplication } from "./rendered-storage-claims.ts";
import type { RungOverride } from "./rung-overrides.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

type Doc = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Key-sorted JSON, ORDINAL order: two renders that differ only in key order are equal. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = asRecord(value);
  if (record !== null) {
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort(stringCompare);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** `Kind/namespace/name`. A render that omits the namespace inherits the release's. */
export function resourceKey(doc: Doc, defaultNamespace: string): string {
  const metadata = asRecord(doc["metadata"]) ?? {};
  const namespace = typeof metadata["namespace"] === "string" ? metadata["namespace"] : defaultNamespace;
  return `${String(doc["kind"])}/${namespace}/${String(metadata["name"])}`;
}

function isHook(doc: Doc): boolean {
  const annotations = asRecord(asRecord(doc["metadata"])?.["annotations"]);
  return annotations !== null && annotations["helm.sh/hook"] !== undefined;
}

/**
 * The immutable fields of one rendered document, as field -> canonical JSON, or `null`
 * for a kind with none this check tracks (or a Helm hook).
 */
export function immutableFields(doc: Doc): Map<string, string> | null {
  if (isHook(doc)) return null;
  const spec = asRecord(doc["spec"]) ?? {};
  const out = new Map<string, string>();
  const put = (field: string, value: unknown): void => {
    out.set(field, canonical(value));
  };
  switch (doc["kind"]) {
    case "StatefulSet": {
      put("spec.selector", spec["selector"]);
      put("spec.serviceName", spec["serviceName"]);
      // Defaulted exactly as the API server defaults it, so an omitted default and an
      // explicit `OrderedReady` compare equal -- as they do on the server.
      put("spec.podManagementPolicy", spec["podManagementPolicy"] ?? "OrderedReady");
      const templates = Array.isArray(spec["volumeClaimTemplates"]) ? (spec["volumeClaimTemplates"] as unknown[]) : [];
      for (const template of templates) {
        const t = asRecord(template) ?? {};
        const name = String(asRecord(t["metadata"])?.["name"]);
        put(`spec.volumeClaimTemplates[${name}]`, { metadata: t["metadata"], spec: t["spec"] });
      }
      if (templates.length === 0) put("spec.volumeClaimTemplates", []);
      return out;
    }
    case "Deployment":
    case "DaemonSet":
    case "ReplicaSet":
      put("spec.selector", spec["selector"]);
      return out;
    case "Job":
      put("spec.selector", spec["selector"]);
      put("spec.template", spec["template"]);
      return out;
    case "Service":
      if (spec["clusterIP"] !== undefined) put("spec.clusterIP", spec["clusterIP"]);
      if (spec["clusterIPs"] !== undefined) put("spec.clusterIPs", spec["clusterIPs"]);
      return out;
    case "PersistentVolumeClaim": {
      put("spec.storageClassName", spec["storageClassName"]);
      put("spec.accessModes", spec["accessModes"]);
      put("spec.volumeMode", spec["volumeMode"] ?? "Filesystem");
      put("spec.resources.requests.storage", asRecord(asRecord(spec["resources"])?.["requests"])?.["storage"]);
      return out;
    }
    default:
      return null;
  }
}

export interface ImmutableFinding {
  readonly resource: string;
  readonly field: string;
  readonly bootstrap: string;
  readonly application: string;
}

export interface Comparison {
  readonly findings: readonly ImmutableFinding[];
  /** Resources with immutable fields present on BOTH sides and compared. */
  readonly compared: number;
  /** Resources with immutable fields rendered on only one side (counted, not failed). */
  readonly oneSided: number;
}

/** Compare the immutable fields of every resource BOTH renders produce. */
export function compareAdoptedRenders(
  bootstrapDocs: readonly Doc[],
  applicationDocs: readonly Doc[],
  namespace: string,
): Comparison {
  const index = (docs: readonly Doc[]): Map<string, Map<string, string>> => {
    const byKey = new Map<string, Map<string, string>>();
    for (const doc of docs) {
      const fields = immutableFields(doc);
      if (fields !== null) byKey.set(resourceKey(doc, namespace), fields);
    }
    return byKey;
  };
  const boot = index(bootstrapDocs);
  const app = index(applicationDocs);
  const findings: ImmutableFinding[] = [];
  let compared = 0;
  let oneSided = 0;
  for (const key of new Set([...boot.keys(), ...app.keys()])) {
    const b = boot.get(key);
    const a = app.get(key);
    if (b === undefined || a === undefined) {
      oneSided += 1;
      continue;
    }
    compared += 1;
    for (const field of [...new Set([...b.keys(), ...a.keys()])].sort(stringCompare)) {
      const bv = b.get(field) ?? "(absent)";
      const av = a.get(field) ?? "(absent)";
      if (bv !== av) findings.push({ resource: key, field, bootstrap: bv, application: av });
    }
  }
  findings.sort((x, y) => stringCompare(`${x.resource} ${x.field}`, `${y.resource} ${y.field}`));
  return { findings, compared, oneSided };
}

// ---------------------------------------------------------------------------
// Pairing: which Application adopts which first-boot HelmChart
// ---------------------------------------------------------------------------

export interface AdoptionPair {
  readonly bootstrap: HelmChartCr;
  readonly application: ApplicationSource;
}

function treeOfPath(path: string): string {
  return path.startsWith("infra/") ? "infra" : "full-ai-cluster";
}

/**
 * A bootstrap HelmChart and an Application are ONE release when they live in the same
 * declared tree and install the same chart. Same rule `bootstrap-application-pin-parity`
 * pairs pins by, plus the tree, so `infra`'s argocd never pairs with `full-ai-cluster`'s.
 */
export function adoptionPairs(
  crs: readonly HelmChartCr[],
  applications: readonly ApplicationSource[],
): readonly AdoptionPair[] {
  const out: AdoptionPair[] = [];
  for (const cr of crs) {
    for (const application of applications) {
      if (application.kind !== "helm-remote" || application.chart !== cr.chart) continue;
      if (treeOfPath(application.manifestPath) !== treeOfPath(cr.file)) continue;
      out.push({ bootstrap: cr, application });
    }
  }
  return out.sort((a, b) => stringCompare(a.application.appId, b.application.appId));
}

/** Every first-boot HelmChart CR in every declared tree. */
export function discoverBootstrapCrs(repoRoot = REPO_ROOT): readonly HelmChartCr[] {
  const out: HelmChartCr[] = [];
  for (const dir of bootstrapDirs(repoRoot)) {
    // One read; a missing directory is an answer (no CRs), not a race to check first.
    let names: string[];
    try {
      names = readdirSync(join(repoRoot, dir)).filter((n) => n.endsWith(".yaml") || n.endsWith(".yml"));
    } catch {
      names = [];
    }
    for (const name of names.sort(stringCompare)) {
      const rel = `${dir}/${name}`;
      out.push(...parseHelmChartCrs(readFileSync(join(repoRoot, rel), "utf8"), rel));
    }
  }
  return out;
}

/**
 * The rung overrides that would make an ADOPTED Application diverge from the bootstrap
 * install it adopts. The bootstrap side is read by k3s from the node's manifest
 * directory and no rung ever touches it, so any lane that runs the k3s bootstrap roster
 * must not apply these -- the Application has to stay equal to what k3s installed.
 */
export function overridesOnAdoptedApplications(
  overrides: readonly RungOverride[],
  pairs: readonly AdoptionPair[],
): readonly RungOverride[] {
  const adopted = new Set(pairs.map((p) => p.application.manifestPath));
  return overrides.filter((o) => adopted.has(o.path));
}

/** The bootstrap CR as the source the shared renderer takes: HelmChart name IS the release name. */
export function bootstrapAsSource(cr: HelmChartCr, appId: string): ApplicationSource {
  return {
    appId: `bootstrap/${appId}`,
    manifestPath: cr.file,
    kind: "helm-remote",
    repoURL: cr.repo,
    chart: cr.chart,
    targetRevision: cr.version,
    releaseName: cr.name,
    namespace: cr.namespace,
    valuesObject: (parseYaml(cr.values === "" ? "{}" : cr.values) as unknown) ?? {},
    gitPath: "",
    includeGlob: "",
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const { applyServeTreeRung } = await import("./argocd-health-test.ts");
  const { stageLaneTree } = await import("./lane-tree-source.ts");
  const { loadRungOverrides } = await import("./rung-overrides.ts");
  const { loadResourceCatalogue } = await import("./storage-profiles.ts");
  const { declaredKubeVersion } = await import("./image-resolvability.ts");

  const kubeVersion = declaredKubeVersion(REPO_ROOT);
  const cacheDir = join(REPO_ROOT, ".helm-render-cache");
  const crs = discoverBootstrapCrs(REPO_ROOT);
  const pairs = adoptionPairs(crs, discoverApplications(REPO_ROOT));
  if (crs.length === 0 || pairs.length === 0) {
    console.error(`[adoption-immutable-fields] REFUSING: ${String(crs.length)} HelmChart CR(s), ${String(pairs.length)} pair(s). A zero means the scan is broken.`);
    return 1;
  }

  // The tree the first-boot replica serves at the dev rung: the SAME pipeline, with the
  // SAME skip the replica applies. Checking the committed tree alone would miss exactly
  // the divergence that shipped.
  const staged = mkdtempSync(join(tmpdir(), "zeta-adoption-"));
  stageLaneTree(REPO_ROOT, staged, "http://lane.invalid/zeta.git");
  const overrides = loadRungOverrides(loadResourceCatalogue(undefined, staged).profiles, staged);
  // `--apply-all-overrides` is the NEGATIVE CONTROL: it serves the dev tree the way the
  // replica did before 081M3HYPQCR087G0R003C2VPRS, and must go red on spire.
  const applyAll = process.argv.includes("--apply-all-overrides");
  const skip = applyAll ? new Set<string>() : new Set(overridesOnAdoptedApplications(overrides, pairs).map((o) => o.id));
  applyServeTreeRung("dev", staged, {}, { skipOverrideIds: skip });
  const devApps = new Map(discoverApplications(staged).map((a) => [a.manifestPath, a]));

  let failed = false;
  for (const pair of pairs) {
    const boot = renderApplication(bootstrapAsSource(pair.bootstrap, pair.application.appId), { repoRoot: REPO_ROOT, cacheDir, kubeVersion });
    if (!boot.ok) {
      console.error(`  UNRENDERABLE bootstrap ${pair.bootstrap.file} ${pair.bootstrap.chart}: ${boot.reason} ${boot.detail}`);
      failed = true;
      continue;
    }
    const trees: [string, ApplicationSource | undefined][] = [
      ["committed", pair.application],
      ["dev-served", devApps.get(pair.application.manifestPath)],
    ];
    for (const [label, source] of trees) {
      if (source === undefined) continue; // not in the served subtree (infra)
      const app = renderApplication(source, { repoRoot: REPO_ROOT, cacheDir, kubeVersion });
      if (!app.ok) {
        console.error(`  UNRENDERABLE ${label} ${source.appId}: ${app.reason} ${app.detail}`);
        failed = true;
        continue;
      }
      const result = compareAdoptedRenders(boot.documents, app.documents, pair.application.namespace);
      const verdict = result.findings.length === 0 ? "ok" : "DIVERGES";
      console.log(
        `  ${verdict.padEnd(8)} ${pair.application.appId} [${label}] vs ${pair.bootstrap.file}: ` +
          `${String(result.compared)} compared, ${String(result.oneSided)} one-sided`,
      );
      for (const f of result.findings) {
        console.error(`    ${f.resource} ${f.field}\n      bootstrap:   ${f.bootstrap}\n      application: ${f.application}`);
        failed = true;
      }
    }
  }
  rmSync(staged, { recursive: true, force: true });
  console.log(
    failed
      ? "[adoption-immutable-fields] FAIL: an adopting Application would patch an immutable field k3s already set -- ArgoCD can never sync it."
      : `[adoption-immutable-fields] ${String(pairs.length)} adoption pair(s): immutable fields agree (skipped dev overrides: ${[...skip].join(", ") || "none"})`,
  );
  return failed ? 1 : 0;
}

if (import.meta.main) process.exit(await main());
