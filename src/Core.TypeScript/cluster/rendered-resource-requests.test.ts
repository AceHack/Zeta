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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  claimIsInsideGitPath,
  unreachableGitPathRequests,
  gitPathReachabilityFindings,
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
import { discoverApplications, renderApplication, type ApplicationSource } from "./rendered-storage-claims.ts";

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

  // WAS `governed: false` UNTIL 2026-08-23, and the flip is the whole point of
  // this change. `declaredAppTotal` reports `governed` from where the number
  // came: an `ungovernedRequests` row (a measurement nobody can act on) or a
  // `resourceClaim` (a coordinate a rung writes into). gmod's 1000m sat in the
  // first bucket, so every rung priced the same number.
  test("gmod is GOVERNED now — the same app, priced differently at each rung", () => {
    const catalogue = loadResourceCatalogue();
    expect(declaredAppTotal(catalogue, "dev", "game-hosting/gmod")).toEqual({
      cpuMillis: 100,
      memoryMib: 2048,
      governed: true,
    });
    expect(declaredAppTotal(catalogue, "metal", "game-hosting/gmod")).toEqual({
      cpuMillis: 1000,
      memoryMib: 2048,
      governed: true,
    });
    // METAL IS THE UNTOUCHED NUMBER. 1000m is the literal that has been in
    // statefulset.yaml since it was written; the row reproduces it rather than
    // re-deciding it, which is why `--resource-profile metal --verify` is clean.
    expect(verifyResourceProfileApplied(catalogue, "metal")).toEqual([]);
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

  // 30s, not the 5s default: the audit now also walks every `git-path`
  // Application's own manifests (the reachability check reads the TREE rather
  // than the snapshot, on purpose — see `unreachableGitPathRequests`). That is
  // real work and it pushed this control past 5s on 2026-08-23. Raising the
  // budget is the honest fix; making the check snapshot-dependent to stay fast
  // would have made it miss the case it exists for.
  test(
    "CONTROL: the live snapshot and baseline audit exit 0",
    () => {
      const { result } = auditRenderedResourceRequests({});
      expect(result.snapshot).not.toBeNull();
      expect(auditExitCode(result)).toBe(0);
    },
    30_000,
  );

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
    // THE DECLARED BOUND IS PINNED HERE ON PURPOSE, AND IT IS 70 SINCE
    // 2026-08-23. This is the tripwire in test form: the field oscillated
    // 70/14/70/14 across four PRs in under three hours on 2026-08-22 with no
    // human decision recorded either way, so an assertion that names the exact
    // value is what forces the next change to be deliberate. Aaron took the 70
    // explicitly ("take the 70, unlock hindsight and vllm on hosted runners"),
    // and the authorization is recorded in the artifact itself —
    // `runnerEnvelope.measuredFreeDiskEvidence` in storage-profiles.json.
    //
    // 70 is a FLOOR beneath both measured runners (77.06 GiB x64, 99.02 GiB
    // arm), not a transcription of either. The measurement stays beside it as
    // `measuredFreeDiskGib`, so the declaration and the observation remain two
    // separate things.
    expect(recorded.freeDiskGib).toBe(70);
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

  // THE REGISTER IS EMPTY AS OF 2026-08-23. Its one entry -- `dev cpu
  // 2906>2500` -- was retired by the arithmetic moving, not by a deletion:
  // governing the three git-path Applications we own took the dev lane to 2006m,
  // and flooring 18 governed `cpuMillis.dev` rows at 25m took it to 1081m.
  //
  // An empty register is the easiest thing in this file to fake, so the
  // mutation now runs in the other direction: it re-adds an acknowledgement and
  // requires it to be convicted as STALE. A gate that accepts a debt entry for
  // a debt that no longer exists would let the next real one hide behind it.
  test("7 the lane register is empty, and a revived acknowledgement is convicted STALE", () => {
    expect(liveCatalogue.acknowledgedLaneBudgetShortfall).toEqual([]);
    expect(auditRunnerBudget(liveCatalogue, "dev")).toEqual([]);
    const revived = {
      ...liveCatalogue,
      acknowledgedLaneBudgetShortfall: [
        { key: "dev cpu 2906>2500", reason: "r".repeat(60), liftsWhen: "LIFTS WHEN: never" },
      ],
    };
    const stale = auditRunnerBudget(revived, "dev");
    expect(stale.some((finding) => finding.problem.includes("outlived"))).toBe(true);
    expect(stale.some((finding) => finding.problem.includes("dev cpu 2906>2500"))).toBe(true);
    // And `metal` still convicts, unacknowledged — the rung that does not fit
    // must go on saying so.
    expect(auditRunnerBudget(liveCatalogue, "metal").length).toBeGreaterThan(0);
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

// ---------------------------------------------------------------------------
// THE FALSIFIER — a git-path Application's RENDERED request must move with the rung
// ---------------------------------------------------------------------------
//
// This whole describe fails on the commit before it. Not "would be weaker" —
// FAILS, and it was RUN that way rather than reasoned about: a worktree at
// origin/main (ba965f8636) rendering gmod at both rungs reported
//
//     gmod rendered CPU at "dev"   = 1000m
//     gmod rendered CPU at "metal" = 1000m
//     overlayRung has manifestOverlays? false
//
// because `renderGitPath` read the committed YAML verbatim and nothing was
// written into it. 1000m — a sixth of the whole tree's CPU — was outside the
// override mechanism entirely.
//
// It is stated three ways on purpose: hermetically (so it keeps testing the
// MECHANISM after the tree moves on), against the live tree (so it keeps
// testing the 1000m that was actually found), and as a refusal (so a coordinate
// that misses cannot render the committed value and look like a rung).
describe("a rung reaches a raw in-repo manifest", () => {
  const catalogue = loadResourceCatalogue();

  function gitPathSource(appId: string): ApplicationSource {
    const found = discoverApplications().find((source) => source.appId === appId);
    if (found === undefined) throw new Error(`no Application ${appId}`);
    return found;
  }

  function renderedCpu(appId: string, rung: string): number {
    const source = gitPathSource(appId);
    const overlay = overlayRung(source, catalogue, rung);
    const rendered = renderApplication(overlay.source, { manifestOverlays: overlay.manifestOverlays });
    if (!rendered.ok) throw new Error(`${appId} @ ${rung}: ${rendered.reason} ${rendered.detail}`);
    let cpu = 0;
    for (const spec of extractRenderedRequests(appId, rendered.documents)) cpu += spec.cpuMillis * spec.replicas;
    return cpu;
  }

  // THE ONE THAT WAS ASKED FOR.
  test("gmod renders 100m at dev and 1000m at metal — the SAME manifest", () => {
    expect(renderedCpu("full-ai-cluster/game-hosting/gmod", "dev")).toBe(100);
    expect(renderedCpu("full-ai-cluster/game-hosting/gmod", "metal")).toBe(1000);
  });

  // METAL IS THE CONSTRAINT, so it gets its own assertion rather than riding
  // along inside another test: every governed git-path app must render at
  // `metal` exactly what the committed manifest says, because that hardware is
  // where these numbers are load-bearing.
  test("metal renders the committed literal, unchanged, for every governed git-path app", () => {
    expect(renderedCpu("full-ai-cluster/game-hosting/gmod", "metal")).toBe(1000);
    expect(renderedCpu("full-ai-cluster/agent-memory", "metal")).toBe(50);
    expect(renderedCpu("full-ai-cluster/platform", "metal")).toBe(100);
    // ...and the tree itself still IS `metal`, byte for byte.
    expect(verifyResourceProfileApplied(catalogue, "metal")).toEqual([]);
  });

  // THE REFUSAL, PINNED. `cdi` and `kubevirt` ARE reachable by this mechanism —
  // both were governed for one draft — and are deliberately left ungoverned
  // because their manifests are vendored byte-for-byte from upstream and
  // `--apply` would rewrite them. 120m was available there and refused. This
  // asserts the refusal rather than leaving it as prose, so a later
  // "finish the job" edit has to argue with a test.
  test("the vendored manifests are reachable and deliberately NOT governed", () => {
    for (const dir of ["cdi", "kubevirt"]) {
      expect(catalogue.claims.some((claim) => claim.dir === dir)).toBe(false);
      expect(catalogue.ungoverned.some((app) => app.dir === dir)).toBe(true);
    }
    // Unchanged at both rungs, because nothing writes into them.
    expect(renderedCpu("full-ai-cluster/cdi", "dev")).toBe(renderedCpu("full-ai-cluster/cdi", "metal"));
    expect(renderedCpu("full-ai-cluster/kubevirt", "dev")).toBe(renderedCpu("full-ai-cluster/kubevirt", "metal"));
  });

  test("every governed git-path app moves at dev, and none of them is unoverlayable", () => {
    for (const appId of [
      "full-ai-cluster/game-hosting/gmod",
      "full-ai-cluster/agent-memory",
      "full-ai-cluster/platform",
    ]) {
      const overlay = overlayRung(gitPathSource(appId), catalogue, "dev");
      expect(overlay.unoverlayable).toEqual([]);
      expect(overlay.manifestOverlays.length).toBeGreaterThan(0);
      expect(renderedCpu(appId, "dev")).toBeLessThan(renderedCpu(appId, "metal"));
    }
  });

  // HERMETIC. Builds a two-file tree from scratch — an Application syncing a
  // raw path plus a Deployment with a literal request — so the mechanism stays
  // pinned even if every real app is later converted to a chart.
  test("hermetic: a synthetic git-path app renders two different numbers", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-gitpath-"));
    try {
      const appDir = join(root, "full-ai-cluster/k8s/applications/toy");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "Application.yaml"),
        [
          "apiVersion: argoproj.io/v1alpha1",
          "kind: Application",
          "metadata: { name: toy }",
          "spec:",
          "  source:",
          "    repoURL: https://example.invalid/repo",
          "    targetRevision: main",
          "    path: full-ai-cluster/k8s/applications/toy",
          "    directory: { include: '{deployment}.yaml' }",
          "  destination: { namespace: toy }",
          "",
        ].join("\n"),
        "utf8",
      );
      writeFileSync(
        join(appDir, "deployment.yaml"),
        [
          "apiVersion: apps/v1",
          "kind: Deployment",
          "metadata: { name: toy }",
          "spec:",
          "  replicas: 1",
          "  template:",
          "    spec:",
          "      containers:",
          "        - name: toy",
          "          resources:",
          '            requests: { cpu: "800m", memory: "256Mi" }',
          "",
        ].join("\n"),
        "utf8",
      );
      const source = discoverApplications(root).find((entry) => entry.appId === "full-ai-cluster/toy");
      expect(source).toBeDefined();
      if (source === undefined) return;
      expect(source.kind).toBe("git-path");

      const toyClaim = {
        id: "full-ai-cluster/toy/toy",
        dir: "toy",
        path: "full-ai-cluster/k8s/applications/toy/deployment.yaml",
        docIndex: 0,
        requestsField: "spec.template.spec.containers[0].resources.requests",
        pods: 1,
        metalSource: "manifest" as const,
        evidence: "hermetic fixture",
        consequence: "hermetic fixture",
        cpuMillis: { dev: 50, metal: 800 },
        memoryMib: { dev: 256, metal: 256 },
      };
      const toyCatalogue: ResourceCatalogue = { ...catalogue, claims: [toyClaim], ungoverned: [] };

      const at = (rung: string): number => {
        const overlay = overlayRung(source, toyCatalogue, rung);
        expect(overlay.unoverlayable).toEqual([]);
        const rendered = renderApplication(overlay.source, {
          repoRoot: root,
          manifestOverlays: overlay.manifestOverlays,
        });
        if (!rendered.ok) throw new Error(`${rung}: ${rendered.reason} ${rendered.detail}`);
        let cpu = 0;
        for (const spec of extractRenderedRequests("full-ai-cluster/toy", rendered.documents)) {
          cpu += spec.cpuMillis * spec.replicas;
        }
        return cpu;
      };
      expect(at("dev")).toBe(50);
      expect(at("metal")).toBe(800);

      // AND A ROW THAT MISSES IS NOT SILENTLY IGNORED. A coordinate whose
      // container index does not exist must FAIL the render, not render the
      // committed value and look like a rung that was applied — that is the
      // vacuity class, and it would agree with every rung equally.
      const wrong = overlayRung(
        source,
        {
          ...toyCatalogue,
          claims: [{ ...toyClaim, requestsField: "spec.template.spec.containers[7].resources.requests" }],
        },
        "dev",
      );
      const missed = renderApplication(source, { repoRoot: root, manifestOverlays: wrong.manifestOverlays });
      expect(missed.ok).toBe(false);
      if (!missed.ok) expect(missed.reason).toBe("manifest-overlay-missed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // Segment-boundary, not `startsWith`: `.../orleans` must not claim
  // `.../orleans-legacy/x.yaml`.
  test("claimIsInsideGitPath is segment-bounded", () => {
    expect(claimIsInsideGitPath("a/b/c.yaml", "a/b")).toBe(true);
    expect(claimIsInsideGitPath("a/b-legacy/c.yaml", "a/b")).toBe(false);
    expect(claimIsInsideGitPath("a/b.yaml", "")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// THE CLASS-CLOSER — a new raw manifest with a request nothing governs
// ---------------------------------------------------------------------------
describe("unreachable git-path requests", () => {
  const catalogue = loadResourceCatalogue();

  // SIX remain, in TWO classes, and the classes are different refusals:
  //   - four are `replicas: 0` and CANNOT be governed (`pods >= 1` in the schema)
  //   - two are vendored byte-for-byte and are DELIBERATELY not governed
  // The set is asserted whole, so a seventh appearing fails here even if
  // somebody also remembers to baseline it.
  test("exactly six remain, in two named classes, all acknowledged", () => {
    const open = unreachableGitPathRequests(catalogue);
    expect(open.map((entry) => entry.appId).sort()).toEqual([
      "full-ai-cluster/cdi",
      "full-ai-cluster/hat-system",
      "full-ai-cluster/kubevirt",
      "full-ai-cluster/orleans",
      "full-ai-cluster/vllm",
      "infra/orleans",
    ]);
    expect(
      open
        .filter((entry) => entry.replicas === 0)
        .map((entry) => entry.appId)
        .sort(),
    ).toEqual([
      "full-ai-cluster/hat-system",
      "full-ai-cluster/orleans",
      "full-ai-cluster/vllm",
      "infra/orleans",
    ]);
    expect(
      open
        .filter((entry) => entry.replicas > 0)
        .map((entry) => entry.appId)
        .sort(),
    ).toEqual(["full-ai-cluster/cdi", "full-ai-cluster/kubevirt"]);

    const keys = new Set(loadBaseline().entries.map((entry) => entry.key));
    for (const finding of gitPathReachabilityFindings(catalogue)) {
      expect(keys.has(findingKey(finding))).toBe(true);
    }
  });

  test("the zero-replica four carry 5100m of LATENT request; the vendored two cost 120m TODAY", () => {
    const open = unreachableGitPathRequests(catalogue);
    // LATENT: schedules nothing while `replicas: 0`. 4000 (vllm) + 500
    // (orleans) + 500 (infra/orleans) + 100 (hat-system).
    //
    // The first draft of this assertion said 5000m / 17408Mi -- I added that
    // list by hand and dropped hat-system. The check caught it, which is the
    // only reason the number here is measured rather than asserted.
    const latent = open.filter((entry) => entry.replicas === 0);
    expect(latent.reduce((sum, entry) => sum + entry.cpuMillis, 0)).toBe(5100);
    expect(latent.reduce((sum, entry) => sum + entry.memoryMib, 0)).toBe(17536);
    expect(open.find((entry) => entry.appId === "full-ai-cluster/vllm")?.cpuMillis).toBe(4000);

    // SCHEDULED: the vendored pair reserves this today, at every rung, and no
    // rung may move it. 100m (cdi x1) + 10m x 2 replicas (kubevirt).
    const scheduled = open.filter((entry) => entry.replicas > 0);
    expect(scheduled.reduce((sum, entry) => sum + entry.cpuMillis * entry.replicas, 0)).toBe(120);
  });

  // THE ACKNOWLEDGEMENT EXPIRES ON ITS OWN. Scaling a zero-replica workload up
  // changes the finding key, so the baseline entry stops matching (the new key
  // is OPEN) and simultaneously matches nothing (the old key is STALE).
  test("scaling a baselined workload to 1 replica breaks its acknowledgement both ways", () => {
    const vllm = gitPathReachabilityFindings(catalogue).find((finding) => finding.claimId.includes("/vllm/"));
    expect(vllm).toBeDefined();
    if (vllm === undefined) return;
    const baseline = loadBaseline();
    expect(adjudicate([vllm], baseline).open).toEqual([]);

    const scaled = { ...vllm, claimId: vllm.claimId.replace("@x0", "@x1") };
    const verdict = adjudicate([scaled], baseline);
    expect(verdict.open.length).toBe(1);
    expect(verdict.stale).toContain(findingKey(vllm));
  });

  // The red case for the check itself: a governed coordinate that stops being
  // governed must be reported.
  test("dropping gmod's row makes its 1000m unreachable again", () => {
    const ungoverned: ResourceCatalogue = {
      ...catalogue,
      claims: catalogue.claims.filter((claim) => claim.dir !== "game-hosting/gmod"),
    };
    const gmod = unreachableGitPathRequests(ungoverned).find(
      (entry) => entry.appId === "full-ai-cluster/game-hosting/gmod",
    );
    expect(gmod).toBeDefined();
    expect(gmod?.cpuMillis).toBe(1000);
    expect(gmod?.replicas).toBe(1);
    // and it is NOT in the baseline, so it convicts
    expect(adjudicate(gitPathReachabilityFindings(ungoverned), loadBaseline()).open.length).toBeGreaterThan(0);
  });
});
