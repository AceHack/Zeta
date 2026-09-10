#!/usr/bin/env bun
/**
 * render-first-boot-charts.ts — `helm template` every chart K3S installs on FIRST BOOT.
 *
 * -- THE GAP THIS CLOSES ---------------------------------------------------
 * `validate-applications.ts --render` renders all 37 charts in
 * `full-ai-cluster/k8s/applications/` and schema-validates the output. The
 * `helm.cattle.io/v1` HelmChart CRs under the two `k8s/bootstrap/` trees get NO such treatment:
 * `validate-bootstrap.ts` checks that each pins an exact version and that the roster
 * matches `services.k3s.manifests`, and stops there. Nothing has ever asked whether those
 * charts RENDER with the `valuesContent` beside them.
 *
 * They are the manifests K3S auto-applies on NixOS first boot, before ArgoCD exists — so
 * they are simultaneously the most metal-specific surface in the tree and the least
 * checked one. No CI lane applies them: the kind and k3d lanes bring ArgoCD up from
 * `dev-cluster/use-cases.ts` instead. A values key that stopped being valid at the pinned
 * version would be found by someone's hardware, at boot, with no ArgoCD yet running to
 * report it.
 *
 * Aaron 2026-09-06: *"continue with our k8s/helm testing that closely matches metal in
 * CI."* This is the render half of that. The pin half is
 * `src/Core.TypeScript/hygiene/audit-bootstrap-application-pin-parity.ts`, which is
 * offline; this one needs helm and the network, so it lives in `helm-validate.yml`
 * beside the Application renderer that already has both.
 *
 * -- WHAT IT DOES AND DOES NOT PROVE ---------------------------------------
 * PROVES: the chart+version resolves upstream, the templates evaluate against these exact
 * values, and the resulting objects satisfy their Kubernetes schemas.
 *
 * DOES NOT PROVE: that the release comes up. `helm template` is not `helm install`, and a
 * chart that renders can still fail on a webhook, a missing CRD, or a PVC nothing can
 * bind. That is what the NixOS/QEMU tests in `full-ai-cluster/nixos/tests/` are for
 * (`k3s-first-boot-roster.nix`, `k3s-first-boot-apply-order-eval-test.nix`), and this does
 * not replace them — it is the cheap check that runs on every PR, ahead of the expensive
 * ones that need a VM.
 *
 * Run:  bun full-ai-cluster/k8s/tests/render-first-boot-charts.ts
 *       bun full-ai-cluster/k8s/tests/render-first-boot-charts.ts --kube-version 1.33.0
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { bootstrapDirs } from "../../../src/Core.TypeScript/cluster/declared-cluster-trees.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseAllDocuments } from "yaml";

/** Derived from the tree roster — see `declared-cluster-trees.ts` for why it is not a literal. */
export const BOOTSTRAP_DIRS: readonly string[] = bootstrapDirs();

/** The lowest number of HelmChart CRs a healthy scan finds. A scan below this REFUSES. */
export const MIN_EXPECTED_CHARTS = 6;

export interface HelmChartCr {
  readonly file: string;
  readonly name: string;
  readonly chart: string;
  readonly repo: string;
  readonly version: string;
  readonly namespace: string;
  readonly values: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Every HelmChart CR in one manifest, multi-document.
 *
 * `spire-install.yaml` carries two, so a first-document-only reader would silently render
 * half of that file and still print a confident count.
 */
export function parseHelmChartCrs(yamlText: string, file: string): HelmChartCr[] {
  const out: HelmChartCr[] = [];
  for (const doc of parseAllDocuments(yamlText)) {
    const value = asRecord(doc.toJS({ maxAliasCount: -1 }) as unknown);
    if (value === null || value["kind"] !== "HelmChart") continue;
    const spec = asRecord(value["spec"]);
    const metadata = asRecord(value["metadata"]);
    const chart = str(spec?.["chart"]);
    const repo = str(spec?.["repo"]);
    const version = str(spec?.["version"]);
    if (chart === null || repo === null || version === null) continue;
    out.push({
      file,
      name: str(metadata?.["name"]) ?? chart,
      chart,
      repo,
      version,
      namespace: str(spec?.["targetNamespace"]) ?? "default",
      // A CR with no valuesContent renders at chart defaults, which is exactly what K3S
      // would install — `spire-crds` is that case today.
      values: str(spec?.["valuesContent"]) ?? "",
    });
  }
  return out;
}

function toolMissing(tool: string): boolean {
  return Bun.spawnSync(["sh", "-c", `command -v ${tool}`], { stdout: "pipe", stderr: "pipe" }).exitCode !== 0;
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

function main(): void {
  const { values: flags } = parseArgs({
    args: Bun.argv.slice(2),
    options: { "kube-version": { type: "string" } },
    strict: true,
  });
  const kubeVersion = flags["kube-version"] ?? "1.33.0";
  const root = process.cwd();

  const charts: HelmChartCr[] = [];
  for (const dir of BOOTSTRAP_DIRS) {
    for (const name of yamlFilesIn(join(root, dir))) {
      const rel = `${dir}/${name}`;
      charts.push(...parseHelmChartCrs(readFileSync(join(root, rel), "utf8"), rel));
    }
  }

  // REFUSES on a thin scan rather than reporting zero failures over it. A renamed
  // directory would otherwise make this print "all charts render" having rendered none —
  // the failure this repo names first and most often.
  if (charts.length < MIN_EXPECTED_CHARTS) {
    console.error(
      `REFUSING: found ${String(charts.length)} first-boot HelmChart CR(s), floor is ${String(MIN_EXPECTED_CHARTS)}. ` +
        `A clean result over a collapsed scan is not a clean result.`,
    );
    process.exit(1);
  }

  if (toolMissing("helm") || toolMissing("kubeconform")) {
    console.error("REFUSING: helm and/or kubeconform is not on PATH (MISE_ENV=full provides both).");
    process.exit(1);
  }

  const tmp = mkdtempSync(join(tmpdir(), "zeta-first-boot-render-"));
  let passed = 0;
  const failures: string[] = [];
  try {
    for (const cr of charts) {
      const label = `${cr.file}: ${cr.chart} ${cr.version}`;

      // ArgoCD's OCI convention (a bare host with no scheme) is not K3S's, and no
      // bootstrap CR uses it today. Refuse loudly rather than hand helm something it will
      // misread as a repo URL.
      if (!cr.repo.startsWith("http://") && !cr.repo.startsWith("https://")) {
        failures.push(`${label}: repo "${cr.repo}" has no http(s) scheme — this renderer has no OCI path`);
        continue;
      }

      const valuesPath = join(tmp, `${cr.name}-${cr.chart}-values.yaml`);
      writeFileSync(valuesPath, cr.values, "utf8");

      const rendered = Bun.spawnSync(
        [
          "helm",
          "template",
          cr.name,
          cr.chart,
          "--repo",
          cr.repo,
          "--version",
          cr.version,
          "--namespace",
          cr.namespace,
          "--kube-version",
          kubeVersion,
          "--values",
          valuesPath,
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      if (rendered.exitCode !== 0) {
        failures.push(`${label}: helm template failed — ${rendered.stderr.toString().trim().slice(0, 400)}`);
        continue;
      }
      const manifest = rendered.stdout.toString();
      const manifestPath = join(tmp, `${cr.name}-${cr.chart}.yaml`);
      writeFileSync(manifestPath, manifest, "utf8");

      const conform = Bun.spawnSync(
        ["kubeconform", "-strict", "-ignore-missing-schemas", "-summary", "-kubernetes-version", kubeVersion, manifestPath],
        { stdout: "pipe", stderr: "pipe" },
      );
      const summary = `${conform.stdout.toString()}${conform.stderr.toString()}`.trim().split("\n").pop() ?? "";
      if (conform.exitCode !== 0) {
        failures.push(`${label}: kubeconform failed — ${summary.slice(0, 400)}`);
        continue;
      }
      passed += 1;
      console.log(`  PASS: ${label} (${String(manifest.length)} bytes) — ${summary}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log("\n========================================");
  console.log(`Results: ${String(passed)} rendered, ${String(failures.length)} failed (of ${String(charts.length)})`);
  for (const failure of failures) console.error(`  FAIL: ${failure}`);
  if (failures.length > 0) process.exit(1);
  console.log("Every chart K3S installs on first boot renders with the values beside it.");
}

if (import.meta.main) main();
