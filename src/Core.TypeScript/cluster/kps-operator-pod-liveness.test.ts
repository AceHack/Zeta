// The Prometheus and Alertmanager pods are built by the prometheus-operator, not by the chart, so
// the liveness stall-tolerance census (liveness-kill-budget.ts, which reads `helm template`) never
// sees them. `helm template` yields a `Prometheus` and an `Alertmanager` custom resource; the
// StatefulSets, and the probes on their containers, appear only in a live cluster.
//
// MEASURED in the constrained first-boot replica (run 36831938019, main@15bbbc3433, 4 vCPU / 12 GiB,
// dev rung), `kubectl describe` of the operator-created pods:
//
//   prometheus-kube-prometheus-stack-prometheus-0
//     prometheus:   Liveness  http-get /-/healthy  timeout=3s period=5s  #failure=6   Restart Count: 6
//   alertmanager-kube-prometheus-stack-alertmanager-0
//     alertmanager: Liveness  http-get /-/healthy  timeout=3s period=10s #failure=10  Restart Count: 6
//
// Both containers showed `Last State: Terminated / Completed / Exit Code: 0`: Prometheus and
// Alertmanager exit 0 on the kubelet's SIGTERM, so a liveness kill is indistinguishable from a clean
// stop unless you read the `Unhealthy ... Liveness probe failed` events beside it -- which were there.
// Stall tolerance is `(failureThreshold - 1) * periodSeconds + timeoutSeconds`: 28s and 93s. The other
// pods of this chart were widened to 115s for the same measured mechanism (pressure -> slow -> probe
// timeout -> kill); these two were not, because nothing could see them.
//
// The CRDs have no probe field (asserted below, from the chart, rather than remembered). The operator's
// extension point is `spec.containers`: an entry whose name matches an operator-generated container is
// strategic-merge patched onto it (prometheus-operator v0.93.1, pkg/k8s/merge.go MergePatchContainers),
// and an entry whose name matches NONE is appended as a SECOND container -- a silent no-op on the probe
// plus a malformed pod. So the container names here are part of the contract and are pinned.
//
// Hermetic: reads the Application manifest only.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { probeStallToleranceSeconds } from "./liveness-kill-budget.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const APP_PATH = join(REPO_ROOT, "full-ai-cluster/k8s/applications/kube-prometheus-stack/Application.yaml");

/** Same floor liveness-kill-budget.ts holds the chart-rendered kps containers to. */
const FLOOR_SECONDS = 100;

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : {});
const dig = (o: unknown, ...path: string[]): unknown => {
  let cur: unknown = o;
  for (const k of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Rec)[k];
  }
  return cur;
};

/**
 * What the operator generates, as measured in run 36831938019. These are NOT read from the manifest:
 * the whole point is that they live in the operator, not in this repo.
 */
const OPERATOR_DEFAULT: Readonly<Record<string, Rec>> = {
  prometheus: { timeoutSeconds: 3, periodSeconds: 5, failureThreshold: 6 },
  alertmanager: { timeoutSeconds: 3, periodSeconds: 10, failureThreshold: 10 },
};

const app = parse(readFileSync(APP_PATH, "utf8")) as unknown;
const values = dig(app, "spec", "source", "helm", "valuesObject");

const SITES = [
  { container: "prometheus", path: ["prometheus", "prometheusSpec", "containers"] },
  { container: "alertmanager", path: ["alertmanager", "alertmanagerSpec", "containers"] },
] as const;

/** The liveness probe the pod ends up with: operator default, field-merged with our patch. */
function effectiveLiveness(container: string, patches: unknown): Rec {
  const patch = (Array.isArray(patches) ? patches : [])
    .map(rec)
    .find((c) => c.name === container);
  return { ...OPERATOR_DEFAULT[container], ...rec(patch?.livenessProbe) };
}

describe("kube-prometheus-stack: operator-created pods are not killed by a short stall", () => {
  for (const site of SITES) {
    test(`${site.container}: effective liveness stall tolerance >= ${String(FLOOR_SECONDS)}s`, () => {
      const tolerance = probeStallToleranceSeconds(effectiveLiveness(site.container, dig(values, ...site.path)));
      expect(tolerance).not.toBeNull();
      expect(tolerance ?? 0).toBeGreaterThanOrEqual(FLOOR_SECONDS);
    });

    test(`${site.container}: the patch names the operator's container exactly and replaces no handler`, () => {
      const patches = dig(values, ...site.path);
      expect(Array.isArray(patches)).toBe(true);
      const list = (patches as unknown[]).map(rec);
      // exactly one entry, and it is the operator-generated container: any other name APPENDS a
      // second container instead of patching, which leaves the probe unchanged and the pod malformed
      expect(list.map((c) => c.name)).toEqual([site.container]);
      const probe = rec(list[0]?.livenessProbe);
      // timing fields only: naming httpGet/exec/tcpSocket/grpc here would fight the operator's handler
      for (const handler of ["httpGet", "exec", "tcpSocket", "grpc"]) expect(probe[handler]).toBeUndefined();
      // nothing but the probe is patched: no image, args or resources riding along on the entry
      expect(Object.keys(list[0] ?? {}).sort()).toEqual(["livenessProbe", "name"]);
    });
  }

  // THE NEGATIVE CONTROL. Without the patch, the same arithmetic must come out BELOW the floor --
  // otherwise the assertions above would pass on a manifest that did nothing, which is the vacuity
  // class this repo names its worst. These are the measured 28s and 93s.
  test("negative control: the operator's own probes, unpatched, are below the floor", () => {
    expect(probeStallToleranceSeconds(effectiveLiveness("prometheus", undefined))).toBe(28);
    expect(probeStallToleranceSeconds(effectiveLiveness("alertmanager", undefined))).toBe(93);
    for (const site of SITES) {
      expect(probeStallToleranceSeconds(effectiveLiveness(site.container, undefined)) ?? 0).toBeLessThan(FLOOR_SECONDS);
    }
  });

  test("a patch naming the wrong container does not count (it would append a second container)", () => {
    const misnamed = [{ name: "prometheus-server", livenessProbe: { timeoutSeconds: 5, periodSeconds: 10, failureThreshold: 12 } }];
    expect(probeStallToleranceSeconds(effectiveLiveness("prometheus", misnamed)) ?? 0).toBeLessThan(FLOOR_SECONDS);
  });
});

describe("the premise: the CRDs offer no other lever", () => {
  // `helm template` is not run here (hermetic); the premise is recorded where it was measured, and the
  // test below pins the one thing in THIS repo that depends on it -- that nobody replaced the
  // `containers` patch with a `livenessProbe` key the Prometheus/Alertmanager CRs would reject or ignore.
  test("no `livenessProbe` key sits directly on either spec", () => {
    expect(dig(values, "prometheus", "prometheusSpec", "livenessProbe")).toBeUndefined();
    expect(dig(values, "alertmanager", "alertmanagerSpec", "livenessProbe")).toBeUndefined();
  });
});
