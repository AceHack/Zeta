/**
 * Falsifiers for `upgrade-only-hook-first-sync.ts`, and the gitlab
 * `upgrade-check` first-sync deadlock it was written for.
 *
 *   A. SYNTHETIC -- the hook classification and dependency walk, no `helm`.
 *   B. THE GITLAB APPLICATION -- requires `helm` on PATH (skipped loudly
 *      otherwise). Renders `full-ai-cluster/k8s/applications/gitlab/Application.yaml`
 *      exactly as ArgoCD would, then:
 *        1. with the repo's own values: no upgrade-only hook may depend on a
 *           non-hook object of the same render (RED on the shipped values,
 *           where `gitlab-gitlab-upgrade-check` mounts `gitlab-gitlab-chart-info`);
 *        2. with `upgradeCheck.enabled` FORCED back on: the chart's own
 *           `runcheck` script, executed offline with the ConfigMap absent (what a
 *           first ArgoCD sync gives it), exits 1 with the exact line seen live --
 *           and exits 0 once chart-info is present. That is the proof the check is
 *           inapplicable on a fresh ArgoCD install, not merely inconvenient, and it
 *           goes red if a future chart version stops failing closed (at which point
 *           the check should be re-enabled).
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { readAppSource } from "./crd-provider-consumer-order.ts";
import { runRuncheckOffline } from "./gitlab-upgrade-path-guard.ts";
import { firstSyncDependencies, isUpgradeOnlyHook } from "./upgrade-only-hook-first-sync.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const GITLAB_APP = resolve(REPO_ROOT, "full-ai-cluster/k8s/applications/gitlab/Application.yaml");

// ---------------------------------------------------------------------------
// A. Synthetic
// ---------------------------------------------------------------------------

const hookJob = (hook: string, extra: Record<string, string> = {}) => ({
  kind: "Job",
  metadata: { name: "check", annotations: { "helm.sh/hook": hook, ...extra } },
  spec: {
    template: {
      spec: {
        containers: [{ name: "c", envFrom: [{ secretRef: { name: "creds" } }] }],
        volumes: [
          { name: "info", configMap: { name: "chart-info", optional: true } },
          { name: "scripts", configMap: { name: "scripts" } },
        ],
      },
    },
  },
});
const plainConfigMap = { kind: "ConfigMap", metadata: { name: "chart-info" } };
const hookConfigMap = { kind: "ConfigMap", metadata: { name: "scripts", annotations: { "helm.sh/hook": "pre-upgrade" } } };
const plainSecret = { kind: "Secret", metadata: { name: "creds" } };

describe("isUpgradeOnlyHook", () => {
  test("pre-upgrade alone is upgrade-only (Helm skips it on install; ArgoCD runs it on first sync)", () => {
    expect(isUpgradeOnlyHook(hookJob("pre-upgrade"))).toBe(true);
    expect(isUpgradeOnlyHook(hookJob("post-upgrade"))).toBe(true);
  });
  test("a hook that also runs on install is not upgrade-only", () => {
    expect(isUpgradeOnlyHook(hookJob("pre-install,pre-upgrade"))).toBe(false);
  });
  test("an explicit argocd.argoproj.io/hook overrides the Helm mapping", () => {
    expect(isUpgradeOnlyHook(hookJob("pre-upgrade", { "argocd.argoproj.io/hook": "PostSync" }))).toBe(false);
  });
  test("a non-hook object is not a hook", () => {
    expect(isUpgradeOnlyHook(plainConfigMap)).toBe(false);
  });
});

describe("firstSyncDependencies", () => {
  test("flags non-hook ConfigMap and Secret the upgrade-only hook reads; ignores hook-owned and external objects", () => {
    expect(firstSyncDependencies([hookJob("pre-upgrade"), plainConfigMap, hookConfigMap, plainSecret])).toEqual([
      { hook: "Job/check", dependsOn: "ConfigMap/chart-info", optional: true },
      { hook: "Job/check", dependsOn: "Secret/creds", optional: false },
    ]);
  });
  test("an install-time hook is not flagged -- Helm itself runs it before those objects exist", () => {
    expect(firstSyncDependencies([hookJob("pre-install,pre-upgrade"), plainConfigMap, plainSecret])).toEqual([]);
  });
  test("an object the render does not produce is out of scope", () => {
    expect(firstSyncDependencies([hookJob("pre-upgrade")])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// B. The gitlab Application
// ---------------------------------------------------------------------------

function onPath(bin: string): boolean {
  return Bun.spawnSync(["sh", "-c", `command -v ${bin}`], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
}
const HELM = onPath("helm");
if (!HELM) console.warn("upgrade-only-hook-first-sync.test: helm not on PATH -- the gitlab render half is SKIPPED, not passed");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function renderGitlab(mutateValues: (values: Record<string, unknown>) => void = () => {}): unknown[] {
  const source = readAppSource(readFileSync(GITLAB_APP, "utf8"));
  expect(source.kind).toBe("helm");
  const values = structuredClone(isRecord(source.valuesObject) ? source.valuesObject : {});
  mutateValues(values);
  const dir = mkdtempSync(join(tmpdir(), "gitlab-upgrade-check-"));
  try {
    const valuesFile = join(dir, "values.yaml");
    writeFileSync(valuesFile, stringifyYaml(values), "utf8");
    const result = Bun.spawnSync(
      [
        "helm", "template", source.releaseName ?? "gitlab", source.chart ?? "", "--repo", source.repoURL ?? "",
        "--version", source.version ?? "", "--namespace", source.namespace ?? "default", "--values", valuesFile,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (result.exitCode !== 0) throw new Error(`helm template gitlab failed: ${result.stderr.toString()}`);
    return parseAllDocuments(result.stdout.toString()).map((d) => d.toJS({ maxAliasCount: -1 }) as unknown);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!HELM)("gitlab Application -- upgrade-check on ArgoCD's first sync", () => {
  test(
    "with the repo's values, no upgrade-only hook reads a non-hook object of the same render",
    () => {
      expect(firstSyncDependencies(renderGitlab())).toEqual([]);
    },
    { timeout: 120_000 },
  );

  test(
    "the chart's own runcheck, forced on, fails closed with chart-info absent and passes with it present",
    () => {
      const docs = renderGitlab((values) => {
        values.upgradeCheck = { ...(isRecord(values.upgradeCheck) ? values.upgradeCheck : {}), enabled: true };
      });
      const deps = firstSyncDependencies(docs);
      expect(deps).toContainEqual({
        hook: "Job/gitlab-gitlab-upgrade-check",
        dependsOn: "ConfigMap/gitlab-gitlab-chart-info",
        optional: true,
      });

      const records = docs.filter(isRecord);
      const scripts = records.find((d) => d.kind === "ConfigMap" && isRecord(d.metadata) && d.metadata.name === "gitlab-gitlab-upgrade-check");
      const chartInfo = records.find((d) => d.kind === "ConfigMap" && isRecord(d.metadata) && d.metadata.name === "gitlab-gitlab-chart-info");
      const job = records.find((d) => d.kind === "Job" && isRecord(d.metadata) && d.metadata.name === "gitlab-gitlab-upgrade-check");
      if (!isRecord(scripts?.data) || !isRecord(chartInfo?.data) || !job) throw new Error("upgrade-check objects missing from render");
      const runcheck = String(scripts.data.runcheck);
      const container = ((job.spec as any).template.spec.containers as any[])[0];
      const env: Record<string, string> = {};
      for (const e of container.env as { name: string; value: string }[]) env[e.name] = e.value;

      if (!onPath("sh") || !onPath("sort")) {
        console.warn("sh/sort not on PATH -- offline runcheck execution SKIPPED");
        return;
      }
      // First ArgoCD sync: PreSync runs before the Sync phase creates chart-info.
      const fresh = runRuncheckOffline(runcheck, env, null);
      // The chart's docs link moved on every major along the 17.7 -> 19.4 path (8.7.0: docs.gitlab.com/ee/update/#upgrade-paths,
      // 8.11.8: docs.gitlab.com/update/#upgrade-paths, 10.4.1: docs.gitlab.com/update/upgrade_paths/), so the sentence is pinned up
      // to the host -- what proves the script FAILS CLOSED is the refusal and the exit code below, not a path.
      expect(fresh.stdout).toMatch(/Please follow the upgrade documentation at https:\/\/docs\.gitlab\.com\//);
      expect(fresh.exitCode).toBe(1);

      // Control: the same script, with the ConfigMap a completed sync would have created.
      const chartInfoData: Record<string, string> = {};
      for (const [key, value] of Object.entries(chartInfo.data)) chartInfoData[key] = String(value);
      expect(runRuncheckOffline(runcheck, env, chartInfoData).exitCode).toBe(0);
    },
    { timeout: 120_000 },
  );
});
