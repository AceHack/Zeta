#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/crd-provider-consumer-order.ts
 *
 * DOES EVERY CUSTOM RESOURCE HAVE ITS CRD BY THE TIME ARGOCD APPLIES IT?
 *
 * -- THE DEFECT THIS CLOSES --------------------------------------------------
 * `sync-wave-dependency-graph.yaml`'s own `platform -> kube-prometheus-stack`
 * entry already names the shape: `platform` (sync-wave -20) ships a
 * `monitoring.coreos.com/v1` ServiceMonitor + PrometheusRule whose CRDs are
 * installed by `kube-prometheus-stack` (sync-wave 0). Without
 * `SkipDryRunOnMissingResource=true`, ArgoCD's dry-run rejects those two
 * objects on every cold boot ("no matches for kind ServiceMonitor") and
 * `platform` reports SyncFailed until wave 0 lands. That edge was found ONCE,
 * by hand, on 2026-09-03 ("derived mechanically ... by scanning in-repo
 * manifests for non-core apiVersions and mapping each custom kind to its
 * installing Application"), and nothing kept scanning after that one run.
 *
 * This module is that scan, committed and re-run on every PR that touches
 * `full-ai-cluster/k8s/**`. It answers three questions no existing checker
 * asks:
 *
 *   1. Which Application PROVIDES which CRD (group + kind)?
 *   2. Which Application CONSUMES which non-core kind, and at what wave?
 *   3. For every consumed kind, does its provider reconcile FIRST -- or does
 *      the consumer carry `SkipDryRunOnMissingResource=true` (as an
 *      Application-level syncOption or a per-resource annotation) so a
 *      provider-not-yet-there is a deferred apply rather than a SyncFailed?
 *
 * -- WHY THIS STOPPED BEING BOOTSTRAP NOISE AND STARTED BEING A DEADLOCK RISK
 * Before `resource.customizations.health.argoproj.io_Application` existed in
 * argocd-cm (see `derive-sync-waves.ts`'s manual-sync-floor check and
 * `audit-argocd-pin-parity.ts`'s health-lua parity check, the sibling findings
 * this same effort produced), a SyncFailed resource inside an otherwise-Healthy
 * Application was cosmetic: sync-wave gating only ordered the APPLY of each
 * child Application, so kube-prometheus-stack's wave-0 apply proceeded
 * regardless of platform's wave -20 status, and platform's next auto-sync
 * (selfHeal) would pick up the CRD once it existed. Once Application health
 * assessment is restored, wave progression WAITS for each wave to be Healthy
 * -- so a permanently-SyncFailed resource can make its owning Application
 * permanently non-Healthy, which wedges every LATER wave, cluster-wide. An
 * ordering defect that used to resolve itself on the next reconcile can now
 * deadlock the bootstrap. That is what makes this analyzer load-bearing
 * rather than cosmetic, and why it ships in the same change as the health lua.
 *
 * -- WHAT COUNTS AS A "PROVIDER" ---------------------------------------------
 *   - A `CustomResourceDefinition` object rendered/read from an Application's
 *     own manifests (Helm chart render, or raw directory-source YAML).
 *   - A BOOTSTRAP-INSTALLED provider (`full-ai-cluster/k8s/bootstrap/*-install.yaml`,
 *     e.g. cilium, cert-manager, external-secrets, spire, trust-manager, plus
 *     the standalone `gateway-api-crds.yaml`) -- these are applied by K3S
 *     BEFORE ArgoCD exists at all, so they are ALWAYS available to every
 *     Application regardless of that Application's own self-managed wave.
 *   - An entry in `DECLARED_OPERATOR_CRDS` -- CRDs an operator registers at
 *     RUNTIME (when it reconciles its own top-level CR) rather than shipping
 *     as a static manifest. kubevirt and cdi are the two known instances:
 *     each vendored operator.yaml ships exactly ONE CustomResourceDefinition
 *     (its own controller CRD -- `KubeVirt`, `CDI`), and the workload CRDs
 *     (`VirtualMachine`, `DataVolume`, ...) appear only once the operator is
 *     running. Nothing in this tree consumes those kinds today (checked by
 *     the "no known consumer" test), so the table is precautionary.
 *
 * -- WHAT COUNTS AS A "CONSUMER" ---------------------------------------------
 * Any rendered/read object whose `apiVersion` has a group NOT in
 * `BUILTIN_API_GROUPS` (the groups vanilla Kubernetes always serves) and is
 * not itself a `CustomResourceDefinition`.
 *
 * -- RENDERING -----------------------------------------------------------
 * Directory-sourced Applications are read directly off disk (no render
 * needed: what ships IS what ArgoCD applies, modulo the `directory.exclude`
 * glob, honored here). Helm-sourced Applications are rendered with
 * `helm template`, the same invocation shape `full-ai-cluster/k8s/tests/
 * validate-applications.ts` already uses (OCI vs HTTP repo handling included)
 * -- reimplemented rather than imported because that file is a top-level
 * script with no exports, and duplicating ~30 lines of `helm template`
 * plumbing is cheaper than restructuring a script this repo's other tooling
 * already depends on running standalone.
 *
 * Exit codes: 0 clean, 1 a real violation, 2 usage / render infrastructure
 * missing (helm not on PATH — never silently skipped: `--render=required`
 * (the default in CI) fails loudly rather than reporting a false clean).
 */

import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseAllDocuments, parse as parseYaml } from "yaml";
import { readShippedApplications, type ShippedApplication } from "./derive-sync-waves.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const BOOTSTRAP_DIR = "full-ai-cluster/k8s/bootstrap";

// ---------------------------------------------------------------------------
// Built-in API groups -- always served by a vanilla Kubernetes API server, so
// consuming a kind in one of these groups never depends on any Application.
// ---------------------------------------------------------------------------

export const BUILTIN_API_GROUPS: ReadonlySet<string> = new Set([
  "apps",
  "batch",
  "autoscaling",
  "networking.k8s.io",
  "rbac.authorization.k8s.io",
  "policy",
  "scheduling.k8s.io",
  "storage.k8s.io",
  "admissionregistration.k8s.io",
  "apiextensions.k8s.io", // the CRD kind itself
  "apiregistration.k8s.io",
  "authentication.k8s.io",
  "authorization.k8s.io",
  "certificates.k8s.io",
  "coordination.k8s.io",
  "discovery.k8s.io",
  "events.k8s.io",
  "node.k8s.io",
  "flowcontrol.apiserver.k8s.io",
  "resource.k8s.io",
  // K3s ships its own controllers/CRDs out of the box, before ArgoCD exists,
  // same status as a bootstrap-installed provider.
  "helm.cattle.io",
  "k3s.cattle.io",
]);

// ---------------------------------------------------------------------------
// Operator-installed CRDs: registered at RUNTIME by a controller, invisible
// to a static manifest scan or a `helm template` render.
// ---------------------------------------------------------------------------

export interface OperatorCrd {
  readonly group: string;
  readonly kind: string;
  readonly reason: string;
}

export const DECLARED_OPERATOR_CRDS: ReadonlyMap<string, readonly OperatorCrd[]> = new Map([
  [
    "kubevirt",
    [
      {
        group: "kubevirt.io",
        kind: "VirtualMachine",
        reason:
          "kubevirt-operator.yaml ships exactly ONE CustomResourceDefinition (kubevirt.io/v1 KubeVirt, the " +
          "operator's own top-level CR); virt-operator registers VirtualMachine/VirtualMachineInstance/... " +
          "at runtime once it reconciles that CR. No manifest in this tree creates a kubevirt.io/VirtualMachine " +
          "or VirtualMachineInstance today (checked mechanically below), so this entry is precautionary.",
      },
      {
        group: "kubevirt.io",
        kind: "VirtualMachineInstance",
        reason: "Same runtime-registration shape as VirtualMachine above.",
      },
    ],
  ],
  [
    "cdi",
    [
      {
        group: "cdi.kubevirt.io",
        kind: "DataVolume",
        reason:
          "cdi-operator.yaml ships exactly ONE CustomResourceDefinition (cdi.kubevirt.io/v1beta1 CDI, the " +
          "operator's own top-level CR); cdi-operator registers DataVolume/DataSource/... at runtime once it " +
          "reconciles that CR. No manifest in this tree creates a cdi.kubevirt.io/DataVolume today, so this " +
          "entry is precautionary.",
      },
      {
        group: "cdi.kubevirt.io",
        kind: "DataSource",
        reason: "Same runtime-registration shape as DataVolume above.",
      },
    ],
  ],
  [
    "cilium",
    [
      {
        group: "cilium.io",
        kind: "CiliumLoadBalancerIPPool",
        reason:
          "MEASURED: `helm template cilium --include-crds` (chart 1.20.1, this Application's own valuesObject) " +
          "renders 48 documents and ZERO CustomResourceDefinitions. Cilium's own agent/operator register their " +
          "CRDs at RUNTIME via client-go on startup (documented upstream behaviour: cilium-operator creates the " +
          "cilium.io CRD set itself rather than shipping them as chart manifests), so no static render will ever " +
          "find them. cilium is ALSO bootstrap-installed (full-ai-cluster/k8s/bootstrap/cilium-install.yaml), " +
          "applied by K3S before ArgoCD exists at all -- strictly earlier than every other provider in this " +
          "table -- so consumers of cilium.io (cilium-lb-ipam's CiliumLoadBalancerIPPool/CiliumL2AnnouncementPolicy) " +
          "are always safe regardless of cilium's own Application-level wave.",
      },
      {
        group: "cilium.io",
        kind: "CiliumL2AnnouncementPolicy",
        reason: "Same runtime-registration shape as CiliumLoadBalancerIPPool above.",
      },
    ],
  ],
  [
    "open-policy-agent",
    [
      {
        group: "constraints.gatekeeper.sh",
        // No single `kind` -- Gatekeeper synthesizes a NEW CRD per
        // ConstraintTemplate (K8sRequiredLabels, K8sCooldown, ...), so this
        // entry covers the whole group rather than one kind. `resolveViolations`
        // matches providers by GROUP, so one entry suffices.
        kind: "*",
        reason:
          "MEASURED: `helm template open-policy-agent --include-crds` (Gatekeeper chart, this Application's own " +
          "valuesObject) renders `templates.gatekeeper.sh/v1 ConstraintTemplate` as the only gatekeeper-family " +
          "CRD. `constraints.gatekeeper.sh` objects (the individual Constraint kinds hat-system's " +
          "01-cooldown.yaml..07*.yaml create) exist only because Gatekeeper's controller-manager watches every " +
          "ConstraintTemplate it reconciles and DYNAMICALLY REGISTERS a new CRD for that template's `crd.spec." +
          "names.kind` -- the same runtime-registration shape as kubevirt/cdi above, one layer further from the " +
          "static tree: the CRD comes from ANOTHER custom resource, not from a chart or an operator's own " +
          "top-level CR. sync-wave-dependency-graph.yaml already declares `hat-system -> open-policy-agent` for " +
          "exactly this reason (its citation: 'OPA constraints applied to a resource that landed BEFORE the " +
          "constraint do nothing').",
      },
    ],
  ],
]);

// ---------------------------------------------------------------------------
// Bootstrap-installed providers -- applied by K3S before ArgoCD exists, so
// ALWAYS satisfied regardless of the matching Application's own wave.
// ---------------------------------------------------------------------------

/**
 * Application names that are ALSO installed at K3S bootstrap
 * (`full-ai-cluster/k8s/bootstrap/<name>-install.yaml`), derived from the
 * bootstrap directory's own file roster rather than hand-listed -- a bootstrap
 * install file added or removed changes this set on the next run, not on the
 * next edit someone remembers to make here.
 */
export function bootstrapInstalledAppNames(repoRoot = REPO_ROOT): ReadonlySet<string> {
  const dir = resolve(repoRoot, BOOTSTRAP_DIR);
  if (!existsSync(dir)) return new Set();
  const names = new Set<string>();
  for (const entry of readdirSync(dir)) {
    const m = /^(.+)-install\.yaml$/.exec(entry);
    if (m?.[1] !== undefined) names.add(m[1]);
  }
  return names;
}

/** Synthetic "app name" for bootstrap-only providers with no matching Application at all. */
export const GATEWAY_API_CRDS_BOOTSTRAP_APP = "gateway-api-crds (bootstrap)";

// ---------------------------------------------------------------------------
// Manifest reading
// ---------------------------------------------------------------------------

export interface RenderedDoc {
  readonly apiVersion: string;
  readonly kind: string;
  readonly name: string;
  readonly namespace: string;
  readonly annotations: Readonly<Record<string, string>>;
  /**
   * Populated ONLY for `kind: CustomResourceDefinition` -- `spec.group` and
   * `spec.names.kind`, i.e. the group+kind this CRD PROVIDES to consumers
   * (distinct from `apiVersion`/`kind` above, which for a CRD object itself
   * is always `apiextensions.k8s.io/v1 CustomResourceDefinition`).
   */
  readonly crdProvides: { readonly group: string; readonly kind: string } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Parse a multi-document YAML blob into the fields this analyzer needs, skipping anything malformed. */
export function parseRenderedDocs(text: string): RenderedDoc[] {
  const out: RenderedDoc[] = [];
  let docs: ReturnType<typeof parseAllDocuments>;
  try {
    docs = parseAllDocuments(text);
  } catch {
    return out;
  }
  for (const doc of docs) {
    let value: unknown;
    try {
      value = doc.toJS({ maxAliasCount: -1 });
    } catch {
      continue;
    }
    if (!isRecord(value)) continue;
    const apiVersion = asString(value.apiVersion);
    const kind = asString(value.kind);
    if (apiVersion === "" || kind === "") continue;
    const metadata = isRecord(value.metadata) ? value.metadata : {};
    const rawAnnotations = isRecord(metadata.annotations) ? metadata.annotations : {};
    const annotations: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawAnnotations)) annotations[k] = typeof v === "string" ? v : String(v);
    let crdProvides: RenderedDoc["crdProvides"] = null;
    if (kind === "CustomResourceDefinition") {
      const spec = isRecord(value.spec) ? value.spec : {};
      const group = asString(spec.group);
      const names = isRecord(spec.names) ? spec.names : {};
      const providedKind = asString(names.kind);
      if (group !== "" && providedKind !== "") crdProvides = { group, kind: providedKind };
    }
    out.push({
      apiVersion,
      kind,
      name: asString(metadata.name),
      namespace: asString(metadata.namespace),
      crdProvides,
      annotations,
    });
  }
  return out;
}

/**
 * A brace-list glob matcher for ArgoCD `directory.exclude` values, e.g.
 * `'{operator/**,graph/**,queries/**,Application.yaml}'`. Deliberately narrow:
 * this repo's Application manifests only ever use a top-level `{a,b,c}` list
 * where each alternative is a plain path or a `dir/**` prefix, which is all
 * `gobwas/glob`'s `*` (crosses `/`, per app-of-apps-discovery.ts's own
 * finding) reduces to for these patterns.
 */
export function matchesExcludeGlob(relPath: string, exclude: string): boolean {
  const trimmed = exclude.trim();
  const inner = trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed.slice(1, -1) : trimmed;
  const alternatives = inner.split(",").map((s) => s.trim());
  for (const alt of alternatives) {
    if (alt === "") continue;
    if (alt === relPath) return true;
    if (alt.endsWith("/**") && relPath.startsWith(alt.slice(0, -3))) return true;
    if (alt.endsWith("**") && relPath.startsWith(alt.slice(0, -2))) return true;
  }
  return false;
}

function listYamlFilesRecursive(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listYamlFilesRecursive(abs, base));
    } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      out.push(relative(base, abs));
    }
  }
  return out;
}

export interface AppSource {
  readonly kind: "helm" | "directory" | "unknown";
  readonly chart?: string;
  readonly version?: string;
  readonly repoURL?: string;
  readonly releaseName?: string;
  readonly namespace?: string;
  readonly valuesObject?: unknown;
  readonly path?: string;
  readonly recurse?: boolean;
  readonly exclude?: string;
  /** The Application's OWN `spec.syncPolicy.syncOptions` list. */
  readonly syncOptions: readonly string[];
}

function get(value: unknown, path: readonly string[]): unknown {
  let cur = value;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function readAppSource(applicationYamlText: string): AppSource {
  let value: unknown;
  try {
    value = parseYaml(applicationYamlText);
  } catch {
    return { kind: "unknown", syncOptions: [] };
  }
  const syncOptionsRaw = get(value, ["spec", "syncPolicy", "syncOptions"]);
  const syncOptions = Array.isArray(syncOptionsRaw) ? syncOptionsRaw.filter((s): s is string => typeof s === "string") : [];

  const chart = get(value, ["spec", "source", "chart"]);
  if (typeof chart === "string") {
    const version = get(value, ["spec", "source", "targetRevision"]);
    const repoURL = get(value, ["spec", "source", "repoURL"]);
    const releaseName = get(value, ["spec", "source", "helm", "releaseName"]);
    const namespace = get(value, ["spec", "destination", "namespace"]);
    return {
      kind: "helm",
      chart,
      version: typeof version === "string" ? version : "",
      repoURL: typeof repoURL === "string" ? repoURL : "",
      releaseName: typeof releaseName === "string" ? releaseName : chart,
      namespace: typeof namespace === "string" ? namespace : "default",
      valuesObject: get(value, ["spec", "source", "helm", "valuesObject"]) ?? {},
      syncOptions,
    };
  }

  const path = get(value, ["spec", "source", "path"]);
  if (typeof path === "string") {
    const recurse = get(value, ["spec", "source", "directory", "recurse"]);
    const exclude = get(value, ["spec", "source", "directory", "exclude"]);
    return {
      kind: "directory",
      path,
      recurse: recurse === true,
      exclude: typeof exclude === "string" ? exclude : "",
      syncOptions,
    };
  }
  return { kind: "unknown", syncOptions };
}

/** `oci://host/path/chart` for an OCI Helm source. Mirrors validate-applications.ts. */
function trimSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "/") start++;
  while (end > start && value[end - 1] === "/") end--;
  return value.slice(start, end);
}

function isOciRepo(repoURL: string): boolean {
  return !repoURL.includes("://");
}

export interface RenderResult {
  readonly ok: boolean;
  readonly docs: readonly RenderedDoc[];
  readonly error?: string;
}

let helmMissingWarned = false;

function helmOnPath(): boolean {
  return Bun.spawnSync(["sh", "-c", "command -v helm"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
}

/** Render one Helm-sourced Application. Reuses the invocation shape `validate-applications.ts` uses under `--render`. */
export function renderHelmApp(source: AppSource): RenderResult {
  if (!helmOnPath()) {
    if (!helmMissingWarned) {
      helmMissingWarned = true;
      console.error("[crd-provider-consumer-order] helm is not on PATH -- Helm-sourced Applications cannot be analyzed");
    }
    return { ok: false, docs: [], error: "helm not on PATH" };
  }
  const chart = source.chart ?? "";
  const version = source.version ?? "";
  const repoURL = source.repoURL ?? "";
  const releaseName = source.releaseName ?? chart;
  const namespace = source.namespace ?? "default";
  // JSON is valid YAML 1.2 flow syntax, so it round-trips through `--values`
  // fine -- but the write MUST be synchronous. `Bun.write` returns a Promise;
  // in this synchronous function the first cut here fired it without
  // `await`, so `Bun.spawnSync` below routinely read an empty or partial
  // file and helm silently fell back to the chart's DEFAULT values. MEASURED:
  // cert-manager's `crds.enabled: true` (an explicit override) rendered 44
  // docs and ZERO CustomResourceDefinitions -- the jetstack chart's default
  // for `crds.enabled` is false, so the override was simply never applied. A
  // render that "succeeds" on the wrong values is worse than a failed render:
  // it reports NO-PROVIDER for a CRD the tree genuinely ships.
  const valuesText = JSON.stringify(source.valuesObject ?? {});
  const tmp = `${Bun.env.TMPDIR ?? Bun.env.TEMP ?? "/tmp"}/.crd-order-values-${Math.random().toString(36).slice(2)}.json`;
  writeFileSync(tmp, valuesText, "utf8");
  try {
    const chartArgs = isOciRepo(repoURL) ? [`oci://${trimSlashes(repoURL)}/${chart}`] : [chart, "--repo", repoURL];
    const result = Bun.spawnSync(
      [
        "helm",
        "template",
        releaseName,
        ...chartArgs,
        "--version",
        version,
        "--namespace",
        namespace,
        "--values",
        tmp,
        // MEASURED on this pinned Helm version (4.2.0): `helm template` OMITS a
        // chart's `crds/` directory unless told otherwise -- `helm template
        // --help` documents `--include-crds "include CRDs in the templated
        // output"`, and without it kube-prometheus-stack (which ships its nine
        // CRDs under `crds/`, confirmed with `helm show crds`) rendered 122
        // documents and ZERO CustomResourceDefinitions. cert-manager is
        // unaffected either way -- its six CRDs are conditionally-templated
        // regular manifests gated by `.Values.crds.enabled`, not `crds/`
        // content -- which is what made the gap easy to miss: some charts need
        // this flag and some do not, and a validator that never passes it is
        // silently right about the second group and wrong about the first.
        // `validate-applications.ts`'s own `--render` lane has the same gap;
        // recorded as a follow-up rather than fixed here, since that file
        // validates SCHEMA (kubeconform) rather than cross-Application CRD
        // ordering and a CRD kubeconform never sees is not a defect in that
        // file's stated scope.
        "--include-crds",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (result.exitCode !== 0) {
      return { ok: false, docs: [], error: result.stderr.toString().split("\n").slice(0, 3).join(" ").trim() };
    }
    return { ok: true, docs: parseRenderedDocs(result.stdout.toString()) };
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // best-effort cleanup; a leaked scratch file is not a correctness issue
    }
  }
}

/** Read one directory-sourced Application straight off disk, honoring `directory.exclude`. */
export function readDirectoryApp(source: AppSource, repoRoot = REPO_ROOT): RenderResult {
  const path = source.path ?? "";
  if (path === "") return { ok: false, docs: [], error: "no spec.source.path" };
  const abs = resolve(repoRoot, path);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    return { ok: false, docs: [], error: `${path} is not a directory` };
  }
  const files = source.recurse ? listYamlFilesRecursive(abs, abs) : readdirSync(abs).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  const docs: RenderedDoc[] = [];
  for (const rel of files) {
    if (rel === "Application.yaml") continue;
    if (source.exclude && source.exclude !== "" && matchesExcludeGlob(rel, source.exclude)) continue;
    let text: string;
    try {
      text = readFileSync(join(abs, rel), "utf8");
    } catch {
      continue;
    }
    docs.push(...parseRenderedDocs(text));
  }
  return { ok: true, docs };
}

// ---------------------------------------------------------------------------
// Provider / consumer extraction
// ---------------------------------------------------------------------------

export interface ProvidedCrd {
  readonly app: string;
  readonly group: string;
  readonly kind: string;
  readonly bootstrap: boolean;
}

export interface ConsumedKind {
  readonly app: string;
  readonly group: string;
  readonly kind: string;
  readonly resourceName: string;
  readonly skipDryRun: boolean;
}

function apiGroupOf(apiVersion: string): string {
  const slash = apiVersion.indexOf("/");
  return slash === -1 ? "" : apiVersion.slice(0, slash);
}

const SKIP_DRY_RUN_OPTION = "SkipDryRunOnMissingResource=true";
const SYNC_OPTIONS_ANNOTATION = "argocd.argoproj.io/sync-options";

function resourceSkipsDryRun(doc: RenderedDoc, appSyncOptions: readonly string[]): boolean {
  if (appSyncOptions.includes(SKIP_DRY_RUN_OPTION)) return true;
  const perResource = doc.annotations[SYNC_OPTIONS_ANNOTATION] ?? "";
  return perResource.split(",").map((s) => s.trim()).includes(SKIP_DRY_RUN_OPTION);
}

export interface AppManifestIndex {
  readonly provided: readonly ProvidedCrd[];
  readonly consumed: readonly ConsumedKind[];
  /** Apps whose source could not be rendered/read at all, with why. */
  readonly unanalyzable: ReadonlyMap<string, string>;
}

export function indexAppManifests(
  apps: readonly ShippedApplication[],
  readApplicationYaml: (relPath: string) => string,
  bootstrapApps: ReadonlySet<string>,
  render: (source: AppSource) => RenderResult = (s) => (s.kind === "helm" ? renderHelmApp(s) : readDirectoryApp(s)),
): AppManifestIndex {
  const provided: ProvidedCrd[] = [];
  const consumed: ConsumedKind[] = [];
  const unanalyzable = new Map<string, string>();

  for (const app of apps) {
    const source = readAppSource(readApplicationYaml(app.path));
    if (source.kind === "unknown") {
      unanalyzable.set(app.name, "Application declares neither spec.source.chart nor spec.source.path");
      continue;
    }
    const result = render(source);
    if (!result.ok) {
      unanalyzable.set(app.name, result.error ?? "render failed");
      continue;
    }
    const isBootstrap = bootstrapApps.has(app.name);
    for (const doc of result.docs) {
      if (doc.kind === "CustomResourceDefinition" && doc.crdProvides !== null) {
        provided.push({ app: app.name, group: doc.crdProvides.group, kind: doc.crdProvides.kind, bootstrap: isBootstrap });
        continue;
      }
      const group = apiGroupOf(doc.apiVersion);
      if (group === "" || BUILTIN_API_GROUPS.has(group)) continue;
      consumed.push({
        app: app.name,
        group,
        kind: doc.kind,
        resourceName: doc.name,
        skipDryRun: resourceSkipsDryRun(doc, source.syncOptions),
      });
    }
  }

  for (const [app, crds] of DECLARED_OPERATOR_CRDS) {
    // Derived, not hardcoded: `cilium` is ALSO bootstrap-installed, so its
    // runtime-registered CRDs must inherit that status the same way a
    // statically-rendered CRD from a bootstrap app would.
    const isBootstrap = bootstrapApps.has(app);
    for (const crd of crds) provided.push({ app, group: crd.group, kind: crd.kind, bootstrap: isBootstrap });
  }

  return { provided, consumed, unanalyzable };
}

/**
 * `gateway-api-crds.yaml` ships CRDs but is not an ArgoCD Application at all
 * -- it is a raw manifest K3S applies at bootstrap, alongside the
 * `*-install.yaml` HelmCharts. Read it the same way a directory-source
 * Application would be, and mark every CRD it provides as bootstrap (always
 * satisfied).
 */
export function bootstrapRawCrdProviders(repoRoot = REPO_ROOT): readonly ProvidedCrd[] {
  const path = resolve(repoRoot, BOOTSTRAP_DIR, "gateway-api-crds.yaml");
  if (!existsSync(path)) return [];
  const docs = parseRenderedDocs(readFileSync(path, "utf8"));
  const out: ProvidedCrd[] = [];
  for (const doc of docs) {
    if (doc.kind !== "CustomResourceDefinition" || doc.crdProvides === null) continue;
    out.push({ app: GATEWAY_API_CRDS_BOOTSTRAP_APP, group: doc.crdProvides.group, kind: doc.crdProvides.kind, bootstrap: true });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Violation resolution
// ---------------------------------------------------------------------------

export type ViolationKind = "NO-PROVIDER" | "ORDER" | "WEBHOOK-SAME-WAVE";

export interface Violation {
  readonly kind: ViolationKind;
  readonly app: string;
  readonly wave: number | null;
  readonly group: string;
  readonly resourceKind: string;
  readonly resourceName: string;
  readonly providerApp?: string;
  readonly providerWave?: number | null;
  readonly detail: string;
}

/** Groups whose provider's webhook readiness (not just CRD presence) matters -- see the header. */
export const WEBHOOK_SENSITIVE_GROUPS: ReadonlySet<string> = new Set(["cert-manager.io", "acme.cert-manager.io"]);

export function findKey(app: string, group: string): string {
  return `${app}|${group}`;
}

export function resolveViolations(
  index: AppManifestIndex,
  waves: ReadonlyMap<string, number | null>,
  bootstrapApps: ReadonlySet<string>,
  extraProviders: readonly ProvidedCrd[] = [],
): readonly Violation[] {
  const providersByGroup = new Map<string, ProvidedCrd[]>();
  for (const p of [...index.provided, ...extraProviders]) {
    const list = providersByGroup.get(p.group) ?? [];
    list.push(p);
    providersByGroup.set(p.group, list);
  }

  const violations: Violation[] = [];
  for (const c of index.consumed) {
    const providers = providersByGroup.get(c.group) ?? [];
    const consumerWave = waves.get(c.app) ?? null;

    if (providers.length === 0) {
      violations.push({
        kind: "NO-PROVIDER",
        app: c.app,
        wave: consumerWave,
        group: c.group,
        resourceKind: c.kind,
        resourceName: c.resourceName,
        detail: `no Application (or bootstrap manifest, or declared operator-installed CRD) provides group "${c.group}"`,
      });
      continue;
    }

    // Self-provided (an Application shipping both its CRD and a CR against it
    // in the same tree) is fine regardless of intra-app resource ordering --
    // that is the Application's OWN resource-level sync-wave, out of scope here.
    if (providers.some((p) => p.app === c.app)) continue;

    // Any bootstrap-installed provider satisfies the edge unconditionally for
    // CRD PRESENCE: it is applied by K3S before ArgoCD exists, so its CRDs
    // always precede every Application-managed consumer.
    const bootstrapProvider = providers.find((p) => p.bootstrap);
    if (bootstrapProvider !== undefined) {
      if (WEBHOOK_SENSITIVE_GROUPS.has(c.group) && bootstrapApps.has(bootstrapProvider.app)) {
        // CRD presence is not the only thing that matters for an admission
        // webhook: even though the CRD was installed at bootstrap, the
        // PROVIDER'S OWN self-managed Application (cert-manager adopts its
        // bootstrap installation the same way argocd does) reconciling at the
        // SAME wave as the consumer means the webhook Deployment could be
        // mid-rollout -- e.g. a chart upgrade replacing cert-manager's webhook
        // pod -- exactly when the consumer's admission request lands. This is
        // a CAUTION about readiness timing, not a CRD-presence problem, so it
        // is its own finding kind rather than folded into ORDER.
        const providerWave = waves.get(bootstrapProvider.app) ?? null;
        if (providerWave !== null && providerWave === consumerWave) {
          violations.push({
            kind: "WEBHOOK-SAME-WAVE",
            app: c.app,
            wave: consumerWave,
            group: c.group,
            resourceKind: c.kind,
            resourceName: c.resourceName,
            providerApp: bootstrapProvider.app,
            providerWave,
            detail:
              `${c.app} creates a ${c.group} ${c.kind} at the SAME wave (${String(consumerWave)}) as ` +
              `${bootstrapProvider.app}'s own self-managed reconcile -- the CRD is always present ` +
              "(bootstrap-installed), but the webhook could be mid-rollout",
          });
        }
      }
      continue;
    }

    // Ordinary Application-provided CRD: every DISTINCT PROVIDER APPLICATION
    // must reconcile STRICTLY BEFORE the consumer, or the consumer must skip
    // dry-run. Deduped by app: a provider shipping several CRDs in the same
    // group (kube-prometheus-stack ships nine under monitoring.coreos.com)
    // must produce ONE finding per consumer, not one per CRD it happens to
    // also provide.
    const distinctProviderApps = [...new Set(providers.map((p) => p.app))].map(
      (app) => providers.find((p) => p.app === app) as ProvidedCrd,
    );
    for (const p of distinctProviderApps) {
      const providerWave = waves.get(p.app) ?? null;
      if (providerWave === null || consumerWave === null) continue; // unannotated -- a different finding's job
      if (providerWave < consumerWave) continue; // correctly ordered
      if (c.skipDryRun) continue; // symptom silenced, deliberately
      violations.push({
        kind: "ORDER",
        app: c.app,
        wave: consumerWave,
        group: c.group,
        resourceKind: c.kind,
        resourceName: c.resourceName,
        providerApp: p.app,
        providerWave,
        detail:
          `${c.app} (wave ${String(consumerWave)}) creates a ${c.group} ${c.kind}, but its provider ${p.app} ` +
          `reconciles at wave ${String(providerWave)} -- not strictly earlier -- and ${c.app} does not carry ` +
          `SkipDryRunOnMissingResource=true (app-level syncOptions or the resource's own ` +
          `argocd.argoproj.io/sync-options annotation)`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Acknowledged findings -- same shape as every other adjudicated registry in
// this tree (derive-sync-waves.ts's ORDER_ADJUDICATION_PENDING,
// audit-existing-secret-is-minted.ts's baseline): a finding this analyzer
// raises but a human has already decided is acceptable, WITH a reason and a
// lift condition, never a silent skip.
// ---------------------------------------------------------------------------

export interface Acknowledged {
  readonly reason: string;
}

/** Key: `${violation.kind}|${app}|${group}|${resourceKind}`. Deliberately NOT keyed on resourceName: many ServiceMonitors from one app would need one entry each otherwise. */
export function acknowledgementKey(v: Violation): string {
  return `${v.kind}|${v.app}|${v.group}|${v.resourceKind}`;
}

export const ACKNOWLEDGED_FINDINGS: ReadonlyMap<string, Acknowledged> = new Map([
  [
    "NO-PROVIDER|gitlab|extensions|Ingress",
    {
      reason:
        "NOT a CRD-ordering defect -- a DIFFERENT and more serious bug this analyzer surfaced as a side effect. " +
        "`helm template gitlab --include-crds` (chart 8.7.0, this Application's own valuesObject) renders FOUR " +
        "Ingress objects (gitlab-kas, gitlab-webservice-default, gitlab-minio, gitlab-registry) under " +
        "`apiVersion: extensions/v1beta1` -- a group REMOVED from Kubernetes entirely at 1.22 (not merely " +
        "deprecated), so these four objects would be REJECTED by the API server on any current cluster, " +
        "independent of any sync-wave ordering. `extensions` is deliberately NOT added to BUILTIN_API_GROUPS: " +
        "doing so would hide this finding behind 'this group always exists', which is false. gitlab is already " +
        "excluded from every CI lane (argocd-health-test.ts's DEV_EXCLUDED_REASONS: 'HALF OF THIS REASON WAS " +
        "SPENT ... gitlab-initial-root-password Secret CI has no source for'), so nothing today applies this " +
        "chart and this defect has not yet reached a real cluster. Root cause is almost certainly a chart-version " +
        "or values gap (a newer chart major, or an `ingress.apiVersion`/class override this Application's " +
        "valuesObject does not set) rather than anything this PR's scope (CRD provider/consumer ordering) covers. " +
        "LIFTS WHEN: gitlab is un-deferred (its own DEV_EXCLUDED_REASONS entry names the condition) and a render " +
        "confirms the Ingress objects use a served apiVersion.",
    },
  ],
]);

export interface CrdOrderAudit {
  readonly index: AppManifestIndex;
  readonly violations: readonly Violation[];
  readonly unregistered: readonly Violation[];
  readonly staleAcknowledgements: readonly string[];
}

export function auditCrdOrder(
  apps: readonly ShippedApplication[],
  readApplicationYaml: (relPath: string) => string,
  repoRoot = REPO_ROOT,
  render?: (source: AppSource) => RenderResult,
): CrdOrderAudit {
  const bootstrapApps = bootstrapInstalledAppNames(repoRoot);
  const index = indexAppManifests(apps, readApplicationYaml, bootstrapApps, render);
  const waves = new Map<string, number | null>(apps.map((a) => [a.name, a.wave]));
  const violations = resolveViolations(index, waves, bootstrapApps, bootstrapRawCrdProviders(repoRoot));

  const seen = new Set(violations.map(acknowledgementKey));
  const unregistered = violations.filter((v) => !ACKNOWLEDGED_FINDINGS.has(acknowledgementKey(v)));
  const staleAcknowledgements = [...ACKNOWLEDGED_FINDINGS.keys()].filter((k) => !seen.has(k)).sort();

  return { index, violations, unregistered, staleAcknowledgements };
}

export function auditIsClean(audit: CrdOrderAudit): boolean {
  return audit.unregistered.length === 0 && audit.staleAcknowledgements.length === 0;
}

export function formatAudit(audit: CrdOrderAudit): string {
  const lines: string[] = [];
  lines.push(
    `CRD provider/consumer order: ${String(audit.index.provided.length)} CRD(s) provided, ` +
      `${String(audit.index.consumed.length)} custom kind reference(s) checked, ` +
      `${String(audit.index.unanalyzable.size)} Application(s) not analyzable.`,
    "",
  );
  if (audit.index.unanalyzable.size > 0) {
    lines.push("NOT ANALYZABLE:");
    for (const [app, reason] of audit.index.unanalyzable) lines.push(`  ${app}: ${reason}`);
    lines.push("");
  }
  const byKind = (kind: ViolationKind) => audit.violations.filter((v) => v.kind === kind);
  for (const kind of ["NO-PROVIDER", "ORDER", "WEBHOOK-SAME-WAVE"] as const) {
    const vs = byKind(kind);
    if (vs.length === 0) continue;
    lines.push(`${kind} -- ${String(vs.length)} finding(s):`);
    for (const v of vs) {
      const registered = !audit.unregistered.includes(v);
      lines.push(`  ${registered ? "[acknowledged] " : ""}${v.detail}`);
    }
    lines.push("");
  }
  if (audit.staleAcknowledgements.length > 0) {
    lines.push("STALE ACKNOWLEDGEMENTS -- match no current finding, delete them:");
    for (const k of audit.staleAcknowledgements) lines.push(`  ${k}`);
    lines.push("");
  }
  lines.push(
    auditIsClean(audit)
      ? "OK — every consumed custom kind has a provider that reconciles first, is bootstrap-installed, or is deliberately acknowledged."
      : "FAILED — see findings above.",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function readApplicationYamlFromDisk(relPath: string, repoRoot: string): string {
  return readFileSync(resolve(repoRoot, relPath), "utf8");
}

function main(): void {
  const requireRender = !Bun.argv.includes("--allow-unrendered");
  const apps = readShippedApplications(REPO_ROOT);
  const audit = auditCrdOrder(apps, (p) => readApplicationYamlFromDisk(p, REPO_ROOT), REPO_ROOT);
  console.log(formatAudit(audit));
  if (requireRender && audit.index.unanalyzable.size > 0) {
    console.error(
      `\n[crd-provider-consumer-order] ${String(audit.index.unanalyzable.size)} Application(s) could not be ` +
        "rendered/read -- this is a render-infrastructure failure (e.g. helm missing), not a clean pass. " +
        "Pass --allow-unrendered to downgrade this to a warning (local iteration only; never in CI).",
    );
    process.exit(2);
  }
  if (!auditIsClean(audit)) process.exit(1);
}

if (import.meta.main) main();
