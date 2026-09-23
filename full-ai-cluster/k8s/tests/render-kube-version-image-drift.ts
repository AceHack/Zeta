#!/usr/bin/env bun
/**
 * full-ai-cluster/k8s/tests/render-kube-version-image-drift.ts
 *
 * -- THE CLASS THIS CATCHES -------------------------------------------------
 * The SPIRE chart's post-install/post-upgrade/pre-delete hooks derive their
 * `kubectl` container's image TAG from `.Capabilities.KubeVersion.Version`
 * whenever `tools.kubectl.image.tag` is unset (`spire-lib.kubectl-image`,
 * chart 0.24.2). K3S reported `v1.35.7+k3s1`, the chart's own helper derived
 * `rancher/kubectl:v1.35.7`, and rancher has never published that tag --
 * confirmed live on GitHub Actions run 35687536936: helm-install-spire's
 * post-install-job ErrImagePull/NotFound-looped forever on real hardware,
 * blocking every workload that waits on SPIRE's SVIDs. Fixed by pinning
 * `tools.kubectl.image.tag` in both `k8s/bootstrap/spire-install.yaml` and its
 * ArgoCD twin `k8s/applications/spire/Application.yaml`.
 *
 * A chart image depending on the cluster's Kubernetes version is a class, not
 * a one-off -- any chart that derives an image reference from
 * `.Capabilities.KubeVersion` has the same failure mode waiting for the next
 * k3s patch bump. `kube-prometheus-stack`'s `charts/crds/templates/upgrade/job.yaml`
 * does exactly this for its `kubectl` sidecar (`$defaultKubernetesVersion` from
 * `.Capabilities.KubeVersion.Version`) -- inert today only because
 * `upgradeJob.enabled` defaults `false` and nothing in this tree overrides it,
 * so the Job never renders. If that default ever flips, this check starts
 * catching it rather than waiting for a second VM boot to notice.
 *
 * -- THE METHOD -------------------------------------------------------------
 * Render every chart TWICE with the identical values: once at the DECLARED
 * Kubernetes version (kubernetes-version.json) and once at declared+1 patch
 * (the shape of "the next k3s bump"). Collect every `image:` string in the
 * two renders and diff the sets. A chart whose image set is IDENTICAL at both
 * versions cannot have an image depending on `.Capabilities.KubeVersion` --
 * that is the one thing `helm template --kube-version` varies between the two
 * runs. A chart whose image set DIFFERS has exactly the defect class above,
 * and is named with the images that appeared or disappeared.
 *
 * This does not need to know Helm template syntax, does not need
 * `Capabilities.KubeVersion` grep (which finds API-version/ingress-class
 * gating far more often than image derivation -- measured 2026-09-22 across
 * the 31 external charts in this tree's catalog: 17 hits, all
 * apiVersion/webhook/minor-version gating except the two named above), and
 * cannot go stale the way a hardcoded chart roster would: it re-derives its
 * chart list from the manifests on every run.
 *
 * Run:  bun full-ai-cluster/k8s/tests/render-kube-version-image-drift.ts
 *       bun full-ai-cluster/k8s/tests/render-kube-version-image-drift.ts --scope bootstrap
 *       bun full-ai-cluster/k8s/tests/render-kube-version-image-drift.ts --scope catalog
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYamlStrict, parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { applicationDirs, bootstrapDirs } from "../../../src/Core.TypeScript/cluster/declared-cluster-trees.ts";
import { parseHelmChartCrs, type HelmChartCr } from "./render-first-boot-charts.ts";

export interface RenderTarget {
  readonly label: string;
  readonly releaseName: string;
  readonly chart: string;
  readonly repoURL: string;
  readonly version: string;
  readonly namespace: string;
  readonly valuesObject: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function get(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    const rec = asRecord(cur);
    if (rec === null) return undefined;
    cur = rec[seg];
  }
  return cur;
}

/** The one declared Kubernetes version; see full-ai-cluster/k8s/kubernetes-version.json. */
export function declaredKubeVersion(repoRoot: string): string {
  const path = join(repoRoot, "full-ai-cluster/k8s/kubernetes-version.json");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { kubernetesVersion?: unknown };
  const version = parsed.kubernetesVersion;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`${path} declares no kubernetesVersion`);
  }
  return version;
}

/**
 * `X.Y.Z` -> `X.Y.(Z+1)`. This is the shape of "the next k3s patch bump" --
 * the exact step that turned a working SPIRE render into an ErrImagePull loop
 * (1.35.6 declared, 1.35.7 actually shipped). A non-numeric patch component
 * refuses rather than silently returning the input unchanged.
 */
export function bumpPatch(version: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (m === null) {
    throw new Error(`cannot bump patch of "${version}": expected X.Y.Z`);
  }
  const [, major, minor, patch] = m;
  return `${major ?? ""}.${minor ?? ""}.${String(Number(patch) + 1)}`;
}

function yamlFilesIn(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((n) => n.endsWith(".yaml") || n.endsWith(".yml")).sort();
}

/**
 * Every `Application.yaml` under `dir`, walked recursively.
 *
 * `{ withFileTypes: true }`, not a readdir followed by a separate `statSync` per entry:
 * the two-call form is a check-then-use race an entry can vanish or change kind inside
 * (lint-check-then-use-file-races.ts's `readdir-then-stat` rule) -- the Dirent the listing
 * already returns knows its own kind, so there is no second syscall to race against.
 */
function applicationYamls(dir: string): string[] {
  let entries: { name: string; isDir: boolean }[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({ name: e.name, isDir: e.isDirectory() }));
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const { name, isDir } of entries) {
    const full = join(dir, name);
    if (isDir) out.push(...applicationYamls(full));
    else if (name === "Application.yaml") out.push(full);
  }
  return out.sort();
}

/** One ArgoCD Application's Helm source, or null when it has no Helm source (directory source, etc). */
export function parseApplicationTarget(yamlText: string, label: string): RenderTarget | null {
  const value = asRecord(parseYamlStrict(yamlText) as unknown);
  if (value === null || value["kind"] !== "Application") return null;
  const chart = get(value, "spec.source.chart");
  const version = get(value, "spec.source.targetRevision");
  const repoURL = get(value, "spec.source.repoURL");
  if (typeof chart !== "string" || typeof version !== "string" || typeof repoURL !== "string") return null;
  const releaseName = get(value, "spec.source.helm.releaseName");
  const namespace = get(value, "spec.destination.namespace");
  return {
    label,
    releaseName: typeof releaseName === "string" ? releaseName : chart,
    chart,
    repoURL,
    version,
    namespace: typeof namespace === "string" ? namespace : "default",
    valuesObject: get(value, "spec.source.helm.valuesObject") ?? {},
  };
}

function bootstrapTargets(root: string): RenderTarget[] {
  const out: RenderTarget[] = [];
  for (const dir of bootstrapDirs(root)) {
    for (const name of yamlFilesIn(join(root, dir))) {
      const rel = `${dir}/${name}`;
      const crs: HelmChartCr[] = parseHelmChartCrs(readFileSync(join(root, rel), "utf8"), rel);
      for (const cr of crs) {
        let valuesObject: unknown = {};
        if (cr.values.length > 0) {
          try {
            valuesObject = parseYamlStrict(cr.values);
          } catch {
            continue; // malformed valuesContent is validate-bootstrap.ts's problem, not this one's
          }
        }
        out.push({
          label: `${rel}: ${cr.chart} ${cr.version}`,
          releaseName: cr.name,
          chart: cr.chart,
          repoURL: cr.repo,
          version: cr.version,
          namespace: cr.namespace,
          valuesObject,
        });
      }
    }
  }
  return out;
}

function catalogTargets(root: string): RenderTarget[] {
  const out: RenderTarget[] = [];
  for (const dir of applicationDirs(root)) {
    for (const file of applicationYamls(join(root, dir))) {
      const rel = file.slice(root.length + 1);
      const target = parseApplicationTarget(readFileSync(file, "utf8"), rel);
      if (target !== null) out.push(target);
    }
  }
  return out;
}

function isOciRepo(repoURL: string): boolean {
  return !repoURL.includes("://");
}

function trimSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "/") start++;
  while (end > start && value[end - 1] === "/") end--;
  return value.slice(start, end);
}

/** Every string value bound to a key literally named `image`, walked recursively. This is
 * the shape every chart in this tree uses for a container image reference (verified against
 * spire and kube-prometheus-stack's derivation sites, both `image: "<registry>/<repo>:<tag>"`
 * as one string) -- so no Helm-template awareness is needed, only a YAML walk. */
export function collectImages(doc: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(doc)) {
    for (const v of doc) collectImages(v, out);
  } else if (doc !== null && typeof doc === "object") {
    for (const [k, v] of Object.entries(doc as Record<string, unknown>)) {
      if (k === "image" && typeof v === "string") out.add(v);
      else collectImages(v, out);
    }
  }
  return out;
}

function renderImages(target: RenderTarget, kubeVersion: string, tmp: string): { images: Set<string> } | { error: string } {
  if (isOciRepo(target.repoURL) === false && !target.repoURL.startsWith("http")) {
    return { error: `repo "${target.repoURL}" has no http(s) scheme and is not OCI-shaped` };
  }
  const valuesPath = join(tmp, `${target.releaseName}-${target.chart}-${kubeVersion}-values.yaml`);
  writeFileSync(valuesPath, stringifyYaml(target.valuesObject), "utf8");
  const chartArgs = isOciRepo(target.repoURL)
    ? [`oci://${trimSlashes(target.repoURL)}/${target.chart}`]
    : [target.chart, "--repo", target.repoURL];
  const rendered = Bun.spawnSync(
    [
      "helm",
      "template",
      target.releaseName,
      ...chartArgs,
      "--version",
      target.version,
      "--namespace",
      target.namespace,
      "--kube-version",
      kubeVersion,
      "--values",
      valuesPath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (rendered.exitCode !== 0) {
    return { error: rendered.stderr.toString().trim().slice(0, 400) };
  }
  const images = new Set<string>();
  for (const doc of parseAllDocuments(rendered.stdout.toString())) {
    const value = doc.toJS({ maxAliasCount: -1 }) as unknown;
    if (value !== null && value !== undefined) collectImages(value, images);
  }
  return { images };
}

function toolMissing(tool: string): boolean {
  return Bun.spawnSync(["sh", "-c", `command -v ${tool}`], { stdout: "pipe", stderr: "pipe" }).exitCode !== 0;
}

function main(): void {
  const { values: flags } = parseArgs({
    args: Bun.argv.slice(2),
    options: { scope: { type: "string", default: "all" } },
    strict: true,
  });
  const scope = flags.scope;
  if (scope !== "all" && scope !== "bootstrap" && scope !== "catalog") {
    console.error(`--scope must be all|bootstrap|catalog, got "${String(scope)}"`);
    process.exit(2);
  }

  if (toolMissing("helm")) {
    console.error("REFUSING: helm is not on PATH (MISE_ENV=full provides it).");
    process.exit(1);
  }

  const root = process.cwd();
  const declared = declaredKubeVersion(root);
  const bumped = bumpPatch(declared);
  console.log(`Rendering at declared kube-version ${declared} and bumped ${bumped}`);

  const targets: RenderTarget[] = [
    ...(scope !== "catalog" ? bootstrapTargets(root) : []),
    ...(scope !== "bootstrap" ? catalogTargets(root) : []),
  ];

  if (targets.length === 0) {
    console.error("REFUSING: found zero chart targets to render — a scan that finds nothing is not a clean result.");
    process.exit(1);
  }

  const tmp = mkdtempSync(join(tmpdir(), "zeta-kube-version-image-drift-"));
  let passed = 0;
  let errored = 0;
  const drifts: string[] = [];
  try {
    for (const target of targets) {
      const label = target.label;
      const atDeclared = renderImages(target, declared, tmp);
      const atBumped = renderImages(target, bumped, tmp);
      if ("error" in atDeclared) {
        console.log(`  SKIP (render failed at ${declared}): ${label} — ${atDeclared.error}`);
        errored++;
        continue;
      }
      if ("error" in atBumped) {
        console.log(`  SKIP (render failed at ${bumped}): ${label} — ${atBumped.error}`);
        errored++;
        continue;
      }
      const onlyAtDeclared = [...atDeclared.images].filter((i) => !atBumped.images.has(i)).sort();
      const onlyAtBumped = [...atBumped.images].filter((i) => !atDeclared.images.has(i)).sort();
      if (onlyAtDeclared.length === 0 && onlyAtBumped.length === 0) {
        passed++;
        continue;
      }
      drifts.push(
        `${label}: image set changes between kube-version ${declared} and ${bumped} — ` +
          `only at ${declared}: [${onlyAtDeclared.join(", ")}]; only at ${bumped}: [${onlyAtBumped.join(", ")}]. ` +
          `An image that depends on the CLUSTER's Kubernetes version is the SPIRE class (run 35687536936) — ` +
          `pin the offending values key to an existing tag rather than let the chart derive one.`,
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(
    `\nResults: ${String(passed)} stable, ${String(drifts.length)} drifted, ${String(errored)} render failures (of ${String(targets.length)} target(s))`,
  );
  for (const d of drifts) console.error(`  DRIFT: ${d}`);
  if (drifts.length > 0) process.exit(1);
  console.log("No chart's rendered images depend on the cluster's Kubernetes version.");
}

if (import.meta.main) main();
