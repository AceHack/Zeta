/**
 * rendered-resource-requests.test.ts — the falsifiers.
 *
 * Every check in the module has a red case here, and the two that were found by
 * running the thing rather than by reasoning about it are called out by name:
 *
 *   THE INIT-CONTAINER FORMULA. `Deployment/gitlab-gitlab-shell` requests 0m
 *   across its regular containers and 50m in each of two init containers. A sum
 *   over regular containers reserves nothing for that pod; the scheduler
 *   reserves 50m. The catalogue's hand-measured gitlab total was 2475m and the
 *   render is 2525m, and the memory column matched to the MEBIBYTE — which is
 *   what identifies the cause, because every init container in that chart
 *   requests 0 memory. A formula that summed everything instead would have been
 *   wrong in the other direction and just as invisible.
 *
 *   THE CROSS-TREE COLLISION. `discoverApplications` walks
 *   `full-ai-cluster/k8s/applications` AND `infra/k8s/applications`, and each has
 *   an Application called `gitlab` and one called `cockroachdb`. Splitting an
 *   appId on the first slash attributed `infra/gitlab`'s render to
 *   `full-ai-cluster`'s row and reported a disagreement about an app the row has
 *   never described. A checker that manufactures its own findings is worse than
 *   no checker, so `appTreeOf` is pinned here.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cpuToMillis,
  memoryToMib,
  podEffectiveRequest,
  extractRenderedRequests,
  overlayRung,
  appTreeOf,
  appDirOf,
  declaredAppTotal,
  snapshotCoverageDrift,
  compareRenderedToDeclared,
  adjudicate,
  findingKey,
  formatCpuQuantity,
  auditRenderedResourceRequests,
  auditExitCode,
  loadSnapshot,
  loadBaseline,
  type RenderSnapshot,
  type Baseline,
  type ContainerRequest,
} from "./rendered-resource-requests.ts";
import {
  loadResourceCatalogue,
  applicationDirs,
  devLaneAppliedDirs,
  auditRunnerBudget,
  verifyResourceProfileApplied,
  type ResourceCatalogue,
} from "./storage-profiles.ts";
import { envelopeOverstatements, loadRecordedEnvelope } from "./assert-runner-envelope.ts";
import type { ApplicationSource } from "./rendered-storage-claims.ts";

const container = (
  role: ContainerRequest["role"],
  cpuMillis: number,
  memoryMib: number,
  name: string = role,
): ContainerRequest => ({ workload: "Deployment/x", container: name, role, cpuMillis, memoryMib });

describe("quantity parsing", () => {
  test("cpu accepts millicores, whole cores and fractions", () => {
    expect(cpuToMillis("250m")).toBe(250);
    expect(cpuToMillis("1")).toBe(1000);
    expect(cpuToMillis("0.5")).toBe(500);
  });

  test("cpu REFUSES what it cannot read rather than returning zero", () => {
    // Zero would be indistinguishable from "no reservation", which is how an
    // unparsable value becomes a silent discount on a budget.
    expect(cpuToMillis("1Gi")).toBeNull();
    expect(cpuToMillis("")).toBeNull();
    expect(cpuToMillis("lots")).toBeNull();
  });

  test("memory is binary for Mi/Gi and decimal for bare M/G", () => {
    expect(memoryToMib("512Mi")).toBe(512);
    expect(memoryToMib("1Gi")).toBe(1024);
    expect(memoryToMib("100M")).toBeCloseTo(95.367, 2);
    expect(memoryToMib("nope")).toBeNull();
  });

  test("formatCpuQuantity writes whole cores as cores", () => {
    expect(formatCpuQuantity(1000)).toBe("1");
    expect(formatCpuQuantity(250)).toBe("250m");
  });
});

describe("the scheduler's per-pod formula", () => {
  test("init containers are a MAX, not a sum — the gitlab-shell shape", () => {
    // 0m of regular containers, 50m in each of two inits. The scheduler
    // reserves 50m; summing regular containers reserves 0m; summing everything
    // reserves 100m. Only one of those three numbers is the pod's request.
    const pod = [
      container("regular", 0, 6),
      container("init", 50, 0, "certificates"),
      container("init", 50, 0, "configure"),
    ];
    expect(podEffectiveRequest(pod).cpuMillis).toBe(50);
  });

  test("a sidecar (restartPolicy: Always) is SUMMED with the regular containers", () => {
    const pod = [container("regular", 100, 128), container("sidecar", 50, 64)];
    expect(podEffectiveRequest(pod).cpuMillis).toBe(150);
  });

  test("regular containers dominate when they exceed every init", () => {
    const pod = [container("regular", 300, 2384), container("regular", 100, 95), container("init", 50, 0)];
    expect(podEffectiveRequest(pod)).toEqual({ cpuMillis: 400, memoryMib: 2479 });
  });
});

describe("extraction", () => {
  const workload = (kind: string, name: string, replicas: number | undefined, cpu: string) => ({
    kind,
    metadata: { name },
    spec: {
      ...(replicas === undefined ? {} : { replicas }),
      template: { spec: { containers: [{ name: "app", resources: { requests: { cpu, memory: "64Mi" } } }] } },
    },
  });

  test("replicas multiply, and an absent replicas is one", () => {
    const specs = extractRenderedRequests("t/a", [
      workload("StatefulSet", "s", 3, "100m"),
      workload("Deployment", "d", undefined, "50m"),
    ]);
    expect(specs.map((spec) => [spec.workload, spec.replicas, spec.cpuMillis])).toEqual([
      ["Deployment/d", 1, 50],
      ["StatefulSet/s", 3, 100],
    ]);
  });

  test("a DaemonSet counts as ONE, and its own replicas field is ignored", () => {
    // Its real count is the node count, which is a property of the cluster and
    // not of the render. Stated, not silently assumed.
    const specs = extractRenderedRequests("t/a", [workload("DaemonSet", "ds", 9, "100m")]);
    expect(specs[0]?.replicas).toBe(1);
  });

  test("a CronJob's pod template is found under jobTemplate", () => {
    const specs = extractRenderedRequests("t/a", [
      {
        kind: "CronJob",
        metadata: { name: "c" },
        spec: {
          jobTemplate: {
            spec: { template: { spec: { containers: [{ name: "x", resources: { requests: { cpu: "30m" } } }] } } },
          },
        },
      },
    ]);
    expect(specs[0]?.cpuMillis).toBe(30);
  });

  test("a kind with no pod template contributes nothing rather than throwing", () => {
    expect(extractRenderedRequests("t/a", [{ kind: "ConfigMap", metadata: { name: "c" } }])).toEqual([]);
  });
});

describe("overlaying a rung", () => {
  const catalogue = {
    profiles: ["dev", "metal"],
    claims: [
      {
        id: "t/app/api",
        dir: "app",
        path: "p",
        docIndex: 0,
        requestsField: "spec.source.helm.valuesObject.api.resources.requests",
        pods: 1,
        metalSource: "chart-default" as const,
        evidence: "e",
        consequence: "c",
        cpuMillis: { dev: 200, metal: 500 },
        memoryMib: { dev: 512, metal: 1024 },
      },
      {
        id: "t/app/off-values",
        dir: "app",
        path: "p",
        docIndex: 0,
        requestsField: "spec.template.spec.containers[0].resources.requests",
        pods: 1,
        metalSource: "manifest" as const,
        evidence: "e",
        consequence: "c",
        cpuMillis: { dev: 0, metal: 0 },
        memoryMib: { dev: 0, metal: 0 },
      },
    ],
    ungoverned: [],
    acknowledgedUnmeasured: [],
    envelope: {} as never,
  } as unknown as ResourceCatalogue;

  const source = { appId: "t/app", valuesObject: { api: { image: "x" } } } as unknown as ApplicationSource;

  test("writes the rung's numbers at the coordinate the catalogue names", () => {
    const overlaid = overlayRung(source, catalogue, "dev").source.valuesObject as Record<string, never>;
    expect(overlaid).toEqual({
      api: { image: "x", resources: { requests: { cpu: "200m", memory: "512Mi" } } },
    } as never);
  });

  test("zero is written as an ABSENT key, never as `cpu: 0`", () => {
    const zeroed = {
      ...catalogue,
      claims: [{ ...catalogue.claims[0], cpuMillis: { dev: 0, metal: 0 }, memoryMib: { dev: 0, metal: 0 } }],
    } as ResourceCatalogue;
    const withKey = {
      appId: "t/app",
      valuesObject: { api: { resources: { requests: { cpu: "1", memory: "1Gi" } } } },
    } as unknown as ApplicationSource;
    const out = overlayRung(withKey, zeroed, "dev").source.valuesObject as {
      api: { resources: { requests: Record<string, unknown> } };
    };
    expect(out.api.resources.requests).toEqual({});
  });

  test("a coordinate outside valuesObject is REPORTED, never silently skipped", () => {
    // A rung the render never sees would agree with every rung equally, which
    // is the vacuity class this whole module exists to refuse.
    expect(overlayRung(source, catalogue, "dev").unoverlayable).toEqual(["t/app/off-values"]);
  });

  test("the source's own valuesObject is not mutated", () => {
    overlayRung(source, catalogue, "metal");
    expect(source.valuesObject).toEqual({ api: { image: "x" } } as never);
  });
});

describe("cross-tree attribution", () => {
  test("appTreeOf and appDirOf split an id at the FIRST slash only", () => {
    expect(appTreeOf("infra/gitlab")).toBe("infra");
    expect(appDirOf("full-ai-cluster/game-hosting/gmod")).toBe("game-hosting/gmod");
  });

  test("a row in the governed tree is NEVER attributed to another tree's app", () => {
    const catalogue = loadResourceCatalogue();
    const governed = declaredAppTotal(catalogue, "metal", "gitlab", "full-ai-cluster");
    const foreign = declaredAppTotal(catalogue, "metal", "gitlab", "infra");
    expect(governed).not.toBeNull();
    expect(foreign).toBeNull();
  });
});

describe("snapshot coverage", () => {
  const snapshot: RenderSnapshot = {
    measuredOn: "2026-08-22",
    appsDiscovered: ["t/a"],
    profiles: [
      {
        profile: "dev",
        apps: [{ appId: "t/a", cpuMillis: 0, memoryMib: 0, pods: 0, workloads: [], overlaid: [] }],
        unrenderable: [],
        unoverlayable: [],
      },
    ],
  };

  test("an app in the tree and absent from the snapshot is DRIFT, not agreement", () => {
    expect(snapshotCoverageDrift(snapshot, ["t/a", "t/b"], ["dev"])[0]).toContain("t/b");
  });

  test("an app in the snapshot and gone from the tree is stale", () => {
    expect(snapshotCoverageDrift(snapshot, [], ["dev"]).join(" ")).toContain("no longer in the tree");
  });

  test("a rung the snapshot never measured is drift", () => {
    expect(snapshotCoverageDrift(snapshot, ["t/a"], ["dev", "metal"]).join(" ")).toContain('rung "metal"');
  });

  test("an app neither measured NOR named unrenderable at a rung is drift", () => {
    const holed: RenderSnapshot = { ...snapshot, appsDiscovered: ["t/a", "t/c"], profiles: snapshot.profiles };
    expect(snapshotCoverageDrift(holed, ["t/a", "t/c"], ["dev"]).join(" ")).toContain(
      "neither measured nor named unrenderable",
    );
  });
});

describe("adjudication", () => {
  const finding = { kind: "uncovered-application" as const, profile: "dev", claimId: "t/x", problem: "p" };

  test("a baselined finding is not open, and an unmatched entry is stale", () => {
    const adjudicated = adjudicate([finding], {
      entries: [
        { key: findingKey(finding), reason: "r", liftsWhen: "LIFTS WHEN: x" },
        { key: "gone", reason: "r", liftsWhen: "LIFTS WHEN: x" },
      ],
    });
    expect(adjudicated.open).toEqual([]);
    expect(adjudicated.baselined).toHaveLength(1);
    expect(adjudicated.stale).toEqual(["gone"]);
  });
});

describe("the live tree", () => {
  test("applicationDirs reaches DEPTH 2 — the 1000m that hid there", () => {
    // ArgoCD's include glob is not path-segment bounded (established against a
    // live cluster in app-of-apps-discovery.ts), so a depth-2 Application IS
    // applied. game-hosting/gmod requests a literal cpu: "1".
    expect(applicationDirs()).toContain("game-hosting/gmod");
    expect(devLaneAppliedDirs()).toContain("game-hosting/gmod");
  });

  test("the exclude glob is a PREFIX match, so `x/**` drops everything under x", () => {
    expect(devLaneAppliedDirs(undefined, "{game-hosting/**}")).not.toContain("game-hosting/gmod");
  });

  test("the catalogue covers gmod, so no rung total omits it", () => {
    const catalogue = loadResourceCatalogue();
    expect(declaredAppTotal(catalogue, "dev", "game-hosting/gmod")).toEqual({
      cpuMillis: 1000,
      memoryMib: 2048,
      governed: false,
    });
  });
});

describe("comparison", () => {
  const catalogue = loadResourceCatalogue();

  const snapshotWith = (devCpu: number, metalCpu: number): RenderSnapshot => ({
    measuredOn: "2026-08-22",
    appsDiscovered: ["full-ai-cluster/mimir"],
    profiles: [
      {
        profile: "dev",
        apps: [
          { appId: "full-ai-cluster/mimir", cpuMillis: devCpu, memoryMib: 2272, pods: 1, workloads: [], overlaid: [] },
        ],
        unrenderable: [],
        unoverlayable: [],
      },
      {
        profile: "metal",
        apps: [
          {
            appId: "full-ai-cluster/mimir",
            cpuMillis: metalCpu,
            memoryMib: 4672,
            pods: 1,
            workloads: [],
            overlaid: [],
          },
        ],
        unrenderable: [],
        unoverlayable: [],
      },
    ],
  });

  test("a rendered total that disagrees with the rung is a finding", () => {
    const findings = compareRenderedToDeclared({ catalogue, snapshot: snapshotWith(999, 1610) });
    expect(findings.some((finding) => finding.kind === "declared-total-mismatch")).toBe(true);
  });

  test("rungs that cut, against a render that does not move, is INERT", () => {
    const findings = compareRenderedToDeclared({ catalogue, snapshot: snapshotWith(1610, 1610) });
    expect(findings.some((finding) => finding.kind === "inert-rung")).toBe(true);
  });

  test("an unrenderable app is a finding, never a skip", () => {
    const snapshot: RenderSnapshot = {
      measuredOn: "2026-08-22",
      appsDiscovered: ["full-ai-cluster/mimir"],
      profiles: [
        {
          profile: "dev",
          apps: [],
          unrenderable: [{ appId: "full-ai-cluster/mimir", reason: "helm-pull-failed", detail: "d" }],
          unoverlayable: [],
        },
      ],
    };
    expect(compareRenderedToDeclared({ catalogue, snapshot })[0]?.kind).toBe("unrenderable");
  });
});

/**
 * Eight load-bearing mutations against the real validate functions.
 *
 * The PR body claimed these as a one-off CLI harness (`cmp` then restore).
 * A comment is not a mutation. Each case here writes the mutated snapshot /
 * baseline (or calls the live catalogue / envelope / --check function) and
 * asserts the validator exits 1 / returns findings. Dropping a check, or
 * making the mutation a no-op, turns the test red.
 *
 * Mutations 6–8 used to target the withdrawn `resource-substrates.ts`. They
 * are retargeted at the landed functions that now own those questions —
 * `envelopeOverstatements` (#13784), `auditRunnerBudget` (this PR's 2906
 * debt), `verifyResourceProfileApplied` (the tree's carried rung). The
 * withdrawn module is not restored beside them.
 */
describe("eight mutations against the live validators", () => {
  const liveSnapshot = loadSnapshot();
  const liveBaseline = loadBaseline();
  const liveCatalogue = loadResourceCatalogue();

  function auditMutated(
    mutate: (snapshot: RenderSnapshot, baseline: Baseline) => {
      snapshot: RenderSnapshot;
      baseline: Baseline;
    },
  ): { exit: number; result: ReturnType<typeof auditRenderedResourceRequests>["result"] } {
    if (liveSnapshot === null) throw new Error("checked-in snapshot missing");
    const dir = mkdtempSync(join(tmpdir(), "zeta-rrr-mut-"));
    try {
      const { snapshot, baseline } = mutate(liveSnapshot, liveBaseline);
      const snapshotPath = join(dir, "snapshot.json");
      const baselinePath = join(dir, "baseline.json");
      writeFileSync(snapshotPath, `${JSON.stringify(snapshot)}\n`);
      writeFileSync(baselinePath, `${JSON.stringify(baseline)}\n`);
      const { result } = auditRenderedResourceRequests({ snapshotPath, baselinePath });
      return { exit: auditExitCode(result), result };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("CONTROL: the live snapshot and baseline audit exit 0", () => {
    const { result } = auditRenderedResourceRequests({});
    expect(result.snapshot).not.toBeNull();
    expect(auditExitCode(result)).toBe(0);
  });

  test("1 snapshot total bumped — declared-total-mismatch, exit 1", () => {
    const { exit, result } = auditMutated((snapshot, baseline) => ({
      snapshot: {
        ...snapshot,
        profiles: snapshot.profiles.map((profile) =>
          profile.profile !== "metal"
            ? profile
            : {
                ...profile,
                apps: profile.apps.map((app) =>
                  app.appId === "full-ai-cluster/mimir" ? { ...app, cpuMillis: app.cpuMillis + 1 } : app,
                ),
              },
        ),
      },
      baseline,
    }));
    expect(exit).toBe(1);
    expect(result.findings.some((finding) => finding.kind === "declared-total-mismatch")).toBe(true);
  });

  test("2 snapshot app deleted — coverage drift, not silent agreement, exit 1", () => {
    const { exit, result } = auditMutated((snapshot, baseline) => ({
      snapshot: {
        ...snapshot,
        appsDiscovered: snapshot.appsDiscovered.filter((id) => id !== "full-ai-cluster/mimir"),
        profiles: snapshot.profiles.map((profile) => ({
          ...profile,
          apps: profile.apps.filter((app) => app.appId !== "full-ai-cluster/mimir"),
        })),
      },
      baseline,
    }));
    expect(exit).toBe(1);
    expect(result.coverageDrift.join(" ")).toContain("full-ai-cluster/mimir");
  });

  test("3 a rung made inert — both renders agree while the catalogue cuts, exit 1", () => {
    const { exit, result } = auditMutated((snapshot, baseline) => {
      const low = snapshot.profiles
        .find((entry) => entry.profile === "dev")
        ?.apps.find((app) => app.appId === "full-ai-cluster/mimir");
      if (low === undefined) throw new Error("mimir missing from the live dev snapshot");
      return {
        snapshot: {
          ...snapshot,
          profiles: snapshot.profiles.map((profile) =>
            profile.profile !== "metal"
              ? profile
              : {
                  ...profile,
                  apps: profile.apps.map((app) =>
                    app.appId === "full-ai-cluster/mimir"
                      ? { ...app, cpuMillis: low.cpuMillis, memoryMib: low.memoryMib }
                      : app,
                  ),
                },
          ),
        },
        baseline,
      };
    });
    expect(exit).toBe(1);
    expect(result.findings.some((finding) => finding.kind === "inert-rung")).toBe(true);
  });

  test("4 a baseline entry deleted — a known finding becomes open, exit 1", () => {
    expect(liveBaseline.entries.length).toBeGreaterThan(0);
    const { exit, result } = auditMutated((snapshot, baseline) => ({
      snapshot,
      baseline: { entries: baseline.entries.slice(1) },
    }));
    expect(exit).toBe(1);
    expect(result.adjudicated.open.length).toBeGreaterThan(0);
  });

  test("5 a stale baseline entry added — acknowledgement outlives its defect, exit 1", () => {
    const { exit, result } = auditMutated((snapshot, baseline) => ({
      snapshot,
      baseline: {
        entries: [
          ...baseline.entries,
          {
            key: "gone|dev|full-ai-cluster/not-an-app",
            reason: "a mutation that must not be ignored as agreement",
            liftsWhen: "LIFTS WHEN: this key matches no finding",
          },
        ],
      },
    }));
    expect(exit).toBe(1);
    expect(result.adjudicated.stale).toContain("gone|dev|full-ai-cluster/not-an-app");
  });

  test("6 recorded envelope inflated past the measured machine — overstatement, not a pass", () => {
    // Retarget of "metal envelope inflated past the summed nodes". The
    // withdrawn substrate module declared a metal envelope and falsified it
    // against ClusterNode registrations. Main's landed form is the runner
    // envelope against the machine (`envelopeOverstatements`, armed as
    // `runner-disk.ts --check-envelope` by leftover-on-main #13784). Inflating
    // the recorded axis past a machine that matches the live record is the
    // same defect class: a claimed machine larger than the one that exists.
    const recorded = loadRecordedEnvelope();
    // 14, not 70: the 14 -> 70 correction is written down in storage-profiles.json
    // and deliberately left for a human to take or refuse. See the pin in
    // lane-partition.test.ts, which is where that decision is guarded.
    //
    // NOTE, because it is a real cost of pinning it here too: this assertion is
    // incidental to the mutation being proven. What proves mutation 6 is that
    // `envelopeOverstatements` returns [] when recorded == measured and convicts
    // when recorded exceeds it, and both of those read the value symbolically.
    // So taking the correction reddens this test as well as the three that
    // storage-profiles.json names -- a coupling worth removing, but removing an
    // assertion from a mutation proof is a separate call and is not folded in here.
    expect(recorded.freeDiskGib).toBe(14);
    const measured = {
      cpuMillis: recorded.cpuMillis,
      memoryMib: recorded.memoryMib,
      freeDiskGib: recorded.freeDiskGib,
    };
    expect(envelopeOverstatements(recorded, measured)).toEqual([]);
    const inflated = { ...recorded, freeDiskGib: recorded.freeDiskGib + 1 };
    const bad = envelopeOverstatements(inflated, measured);
    expect(bad.length).toBeGreaterThan(0);
    expect(bad.join(" ")).toContain(String(recorded.freeDiskGib));
  });

  test("7 acknowledgement key detuned by 1m — STALE, and dropping it convicts", () => {
    expect(liveCatalogue.acknowledgedLaneBudgetShortfall.map((entry) => entry.key)).toEqual(["dev cpu 2906>2500"]);
    expect(auditRunnerBudget(liveCatalogue, "dev")).toEqual([]);
    const detuned = {
      ...liveCatalogue,
      acknowledgedLaneBudgetShortfall: liveCatalogue.acknowledgedLaneBudgetShortfall.map((entry) =>
        entry.key === "dev cpu 2906>2500" ? { ...entry, key: "dev cpu 2905>2500" } : entry,
      ),
    };
    const stale = auditRunnerBudget(detuned, "dev");
    expect(stale.some((finding) => finding.problem.includes("outlived"))).toBe(true);
    expect(stale.some((finding) => finding.problem.includes("dev cpu 2906>2500"))).toBe(true);
    const dropped = { ...liveCatalogue, acknowledgedLaneBudgetShortfall: [] };
    const convicted = auditRunnerBudget(dropped, "dev");
    expect(convicted.length).toBeGreaterThan(0);
    expect(convicted[0]?.problem).toContain("dev cpu 2906>2500");
  });

  test("8 activeResourceProfile flipped to a rung the tree does not carry", () => {
    // The tree carries `metal`. `dev` is a real rung of the catalogue and a
    // rung the manifests do not carry — 54 drifts, MEASURED. Flipping the
    // declared carried-rung to `dev` must not read as applied. The withdrawn
    // substrate module owned `activeResourceProfile` in storage-profiles.json;
    // the landed check is `verifyResourceProfileApplied`.
    expect(verifyResourceProfileApplied(liveCatalogue, "metal")).toEqual([]);
    const flipped = verifyResourceProfileApplied(liveCatalogue, "dev");
    expect(flipped.length).toBeGreaterThan(0);
  });
});
