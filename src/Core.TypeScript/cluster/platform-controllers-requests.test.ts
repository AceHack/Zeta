/**
 * Falsifier for 081M3TS67PE087G0R002ZZ1XYT (second half): the platform controllers that
 * `missing-resource-requests.ts` listed ACTIONABLE render pods that request SOMETHING, at
 * BOTH rungs.
 *
 * WHY A WORKLOAD-LEVEL CHECK. `missing-resource-requests.ts` is app-level: an Application
 * with one priced pod and four BestEffort ones does not appear in its list, so it cannot
 * tell "all priced" from "one priced". This reads the same checked-in snapshot
 * (`rendered-resource-requests.snapshot.json`, which `rendered-resource-requests.ts` keeps
 * equal to the render) and fails on any non-hook workload of the named Applications whose
 * requests are zero -- a BestEffort pod, the first thing the kubelet reclaims and the one
 * with cgroup cpu.weight 1.
 *
 * Measured motive: the constrained first-boot replica on main (2026-09-30, run
 * 36685251210) had 19 of 38 Applications FAIL where the unconstrained lane had them
 * Healthy. Hook Jobs are exempt: they run once to completion and are not what starves.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

interface SnapshotWorkload {
  readonly workload: string;
  readonly replicas?: number;
  readonly cpuMillis: number;
  readonly memoryMib: number;
}
interface SnapshotApp {
  readonly appId: string;
  readonly workloads?: readonly SnapshotWorkload[];
}
interface Snapshot {
  readonly profiles: readonly { readonly profile: string; readonly apps: readonly SnapshotApp[] }[];
}

/** The Applications priced by this change. Each name is also a directory under applications/. */
export const PRICED_PLATFORM_CONTROLLERS = [
  "argo-rollouts",
  "argo-workflows",
  "cert-manager",
  "dapr",
  "external-secrets",
  "headlamp",
  "sealed-secrets",
  "spire",
  "trust-manager",
] as const;

/** `Kind/name` workloads of `dirs` that request nothing, per profile. Jobs and Pods are hook/test shaped. */
export function bestEffortWorkloads(snapshot: Snapshot, dirs: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const p of snapshot.profiles) {
    for (const app of p.apps) {
      const dir = app.appId.slice(app.appId.lastIndexOf("/") + 1);
      if (!dirs.includes(dir)) continue;
      for (const w of app.workloads ?? []) {
        if (w.workload.startsWith("Job/") || w.workload.startsWith("Pod/")) continue;
        if (w.cpuMillis <= 0 || w.memoryMib <= 0) out.push(`${p.profile}: ${app.appId} ${w.workload}`);
      }
    }
  }
  return out;
}

describe("platform controllers are priced, not BestEffort (081M3TS67PE087G0R002ZZ1XYT)", () => {
  test("a workload that requests nothing is reported (the defect, on a synthetic snapshot)", () => {
    const before: Snapshot = {
      profiles: [
        {
          profile: "dev",
          apps: [
            {
              appId: "full-ai-cluster/sealed-secrets",
              workloads: [{ workload: "Deployment/sealed-secrets-controller", replicas: 1, cpuMillis: 0, memoryMib: 0 }],
            },
          ],
        },
      ],
    };
    expect(bestEffortWorkloads(before, PRICED_PLATFORM_CONTROLLERS)).toEqual([
      "dev: full-ai-cluster/sealed-secrets Deployment/sealed-secrets-controller",
    ]);
  });

  test("a hook Job with no request is exempt -- it is not what starves", () => {
    const withJob: Snapshot = {
      profiles: [
        {
          profile: "dev",
          apps: [
            {
              appId: "full-ai-cluster/cert-manager",
              workloads: [{ workload: "Job/cert-manager-startupapicheck", replicas: 1, cpuMillis: 0, memoryMib: 0 }],
            },
          ],
        },
      ],
    };
    expect(bestEffortWorkloads(withJob, PRICED_PLATFORM_CONTROLLERS)).toEqual([]);
  });

  test("the checked-in snapshot: every priced controller requests something at BOTH rungs", () => {
    const snapshot = JSON.parse(
      readFileSync(new URL("./rendered-resource-requests.snapshot.json", import.meta.url), "utf8"),
    ) as Snapshot;
    // It must have SEEN the apps -- a name that matches nothing would pass vacuously.
    for (const profile of snapshot.profiles) {
      const dirs = new Set(profile.apps.map((a) => a.appId.slice(a.appId.lastIndexOf("/") + 1)));
      for (const dir of PRICED_PLATFORM_CONTROLLERS) expect(dirs.has(dir)).toBe(true);
    }
    expect(bestEffortWorkloads(snapshot, PRICED_PLATFORM_CONTROLLERS)).toEqual([]);
  });
});
