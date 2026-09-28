/**
 * Falsifiers for `gitlab-upgrade-path-guard.ts` -- the PR-time replacement for
 * the gitlab chart's in-cluster upgrade check, which is disabled on the
 * Application because it deadlocks ArgoCD's first sync (see
 * `upgrade-only-hook-first-sync.test.ts`).
 *
 *   A. PURE -- applicability, version comparison, pin reading. No helm.
 *   B. THE CHART'S OWN SCRIPT -- requires `helm` on PATH (skipped LOUDLY
 *      otherwise, never passed). Every fixture is the real
 *      `full-ai-cluster/k8s/applications/gitlab/Application.yaml` with only
 *      `targetRevision` rewritten, and the verdict is whatever the NEW chart's
 *      own `runcheck` says when handed the OLD release's chart-info:
 *
 *        (a) 8.7.0 (GitLab 17.7) -> 8.11.0 (GitLab 17.11): FAILED -- 8.11.0's
 *            script requires the previous release to be >= 17.8 / chart 8.8,
 *            i.e. it refuses to skip the 17.8 required stop.
 *        (a') 8.7.0 -> 9.0.0 (GitLab 18.0): FAILED -- the major jump, requires 17.11 / 8.11.
 *        (b) 8.7.0 -> 8.8.0 (GitLab 17.8): PASSED -- 8.8.0 requires >= 17.5 / 8.5.
 *        (c) unchanged: NOT APPLICABLE, and helm is never invoked.
 *        (d) 8.7.0 -> 8.6.0 (GitLab 17.6): FAILED as a downgrade. MEASURED: the
 *            chart's own script does NOT refuse this (8.6.0 only requires >= 17.5,
 *            which 17.7 satisfies), so the guard's downgrade check is the only
 *            thing that catches it -- asserted below so the gap stays visible.
 *
 *   Chart archives are pulled once into `<repo>/.helm-render-cache/` (the same
 *   cache `rendered-storage-claims.ts` uses); re-runs are offline.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  compareVersions,
  evaluateUpgrade,
  GITLAB_APPLICATION_PATH,
  pinsDiffer,
  readGitlabPin,
  renderUpgradeCheck,
  runRuncheckOffline,
  type Renderer,
} from "./gitlab-upgrade-path-guard.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const APP_TEXT = readFileSync(resolve(REPO_ROOT, GITLAB_APPLICATION_PATH), "utf8");
const SHIPPED_REVISION = /targetRevision:\s*(\S+)/.exec(APP_TEXT)?.[1] ?? "";

function withRevision(revision: string): string {
  return APP_TEXT.replace(/targetRevision:\s*\S+/, `targetRevision: ${revision}`);
}

// ---------------------------------------------------------------------------
// A. Pure
// ---------------------------------------------------------------------------

describe("compareVersions", () => {
  test("numeric, not lexical; a leading v is ignored", () => {
    expect(compareVersions("8.11.0", "8.8.0")).toBe(1);
    expect(compareVersions("v17.7.0", "17.7.0")).toBe(0);
    expect(compareVersions("17.6.0", "v17.7.0")).toBe(-1);
    expect(compareVersions("9.0.0", "8.11.4")).toBe(1);
  });
});

describe("readGitlabPin / pinsDiffer", () => {
  test("reads the shipped Application's chart pin", () => {
    const pin = readGitlabPin(APP_TEXT);
    expect(pin?.chart).toBe("gitlab");
    expect(pin?.repoURL).toBe("https://charts.gitlab.io/");
    expect(pin?.version).toBe(SHIPPED_REVISION);
  });
  test("a comment-only edit is not an upgrade; a revision or global.gitlabVersion change is", () => {
    const base = readGitlabPin(APP_TEXT);
    expect(pinsDiffer(base, readGitlabPin(`${APP_TEXT}\n# a comment\n`))).toBe(false);
    expect(pinsDiffer(base, readGitlabPin(withRevision("8.8.0")))).toBe(true);
    const pinned = APP_TEXT.replace("          edition: ce", "          edition: ce\n          gitlabVersion: 17.8.1");
    expect(readGitlabPin(pinned)?.gitlabVersion).toBe("17.8.1");
    expect(pinsDiffer(base, readGitlabPin(pinned))).toBe(true);
  });
});

describe("evaluateUpgrade applicability (no helm)", () => {
  const exploding: Renderer = () => {
    throw new Error("renderer must not be called when the upgrade does not apply");
  };
  test("(c) unchanged -> not-applicable, without rendering anything", () => {
    expect(evaluateUpgrade(APP_TEXT, APP_TEXT, { render: exploding }).state).toBe("not-applicable");
  });
  test("Application absent at base (first install) -> not-applicable", () => {
    expect(evaluateUpgrade(null, APP_TEXT, { render: exploding }).state).toBe("not-applicable");
  });
  test("Application removed at head -> not-applicable", () => {
    expect(evaluateUpgrade(APP_TEXT, null, { render: exploding }).state).toBe("not-applicable");
  });
});

// ---------------------------------------------------------------------------
// B. The chart's own runcheck
// ---------------------------------------------------------------------------

function onPath(bin: string): boolean {
  return Bun.spawnSync(["sh", "-c", `command -v ${bin}`], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
}
const HELM = onPath("helm");
if (!HELM) console.warn("gitlab-upgrade-path-guard.test: helm not on PATH -- the chart-script half is SKIPPED, not passed");

describe.skipIf(!HELM)("gitlab upgrade path -- the chart's own runcheck decides", () => {
  test("the fixtures start from the shipped pin (8.7.0); if it moves, re-pick the fixture versions", () => {
    expect(SHIPPED_REVISION).toBe("8.7.0");
  });

  test(
    "(a) 8.7.0 -> 8.11.0 skips the 17.8 required stop -> FAILED with the chart's own message",
    () => {
      const v = evaluateUpgrade(APP_TEXT, withRevision("8.11.0"));
      expect(v.state).toBe("failed");
      expect(v.detail).toContain("It is required to upgrade to the latest 8.8.x version first");
    },
    { timeout: 180_000 },
  );

  test(
    "(a') 8.7.0 -> 9.0.0 (GitLab 18.0) skips 17.8 and 17.11 -> FAILED",
    () => {
      const v = evaluateUpgrade(APP_TEXT, withRevision("9.0.0"));
      expect(v.state).toBe("failed");
      expect(v.detail).toContain("It is required to upgrade to the latest 8.11.x version first");
    },
    { timeout: 180_000 },
  );

  test(
    "(b) 8.7.0 -> 8.8.0 is on the documented path -> PASSED",
    () => {
      const v = evaluateUpgrade(APP_TEXT, withRevision("8.8.0"));
      expect({ state: v.state, detail: v.detail }).toMatchObject({ state: "passed" });
    },
    { timeout: 180_000 },
  );

  test(
    "(d) 8.7.0 -> 8.6.0 is a downgrade -> FAILED, even though the chart's own script would allow it",
    () => {
      const v = evaluateUpgrade(APP_TEXT, withRevision("8.6.0"));
      expect(v.state).toBe("failed");
      expect(v.detail).toContain("downgrade");

      // The measured gap the guard's own check closes: 8.6.0's runcheck, handed
      // 8.7.0's chart-info, exits 0.
      const oldSide = renderUpgradeCheck(readGitlabPin(APP_TEXT)!);
      const newSide = renderUpgradeCheck(readGitlabPin(withRevision("8.6.0"))!);
      expect(runRuncheckOffline(newSide.runcheck, newSide.env, oldSide.chartInfo).exitCode).toBe(0);
    },
    { timeout: 180_000 },
  );

  test(
    "control: the new chart's runcheck with NO chart-info fails closed (it is a real check, not a no-op)",
    () => {
      const side = renderUpgradeCheck(readGitlabPin(withRevision("8.8.0"))!);
      const run = runRuncheckOffline(side.runcheck, side.env, null);
      expect(run.exitCode).toBe(1);
      expect(run.stdout).toContain("unsupported upgrade path");
    },
    { timeout: 180_000 },
  );
});

// ---------------------------------------------------------------------------
// C. Wiring -- a guard CI never runs is a check that did not run
// ---------------------------------------------------------------------------

describe("CI wiring", () => {
  test("helm-validate.yml runs the guard on pull requests, in the job that has helm", () => {
    const workflow = readFileSync(resolve(REPO_ROOT, ".github/workflows/helm-validate.yml"), "utf8");
    const charts = workflow.slice(workflow.indexOf("\n  charts:"));
    expect(charts).toContain("bun src/Core.TypeScript/cluster/gitlab-upgrade-path-guard.ts");
    expect(charts).toContain("bun test src/Core.TypeScript/cluster/gitlab-upgrade-path-guard.test.ts");
  });
  test("the Application's comment points at this guard instead of a manual caveat", () => {
    expect(APP_TEXT).toContain("gitlab-upgrade-path-guard.ts");
  });
});
