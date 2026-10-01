// No BestEffort workload in the observability + messaging group.
//
// An unset request is not a small request: it is QoS BestEffort and cgroup cpu.weight 2
// (the floor), so on a contended first boot the pod is the first the kubelet evicts and the
// last the CPU scheduler feeds -- the measured mechanism in
// docs/trajectories/usb-installer-first-boot-reliability/RESUME.md section 1 (pressure ->
// slow -> liveness timeout -> SIGKILL). `missing-resource-requests.ts` REPORTS Applications
// that request nothing at all, but it is a report, not a gate, and it only sees an
// Application whose WHOLE total is zero: alloy (one sidecar priced, the collector not) and
// every app with a single priced container passed straight through it. And it cannot see
// the two biggest pods in the monitoring stack at all -- Prometheus and Alertmanager are
// custom resources whose pods the operator creates, so no `helm template` census contains
// them. This file closes both holes for the apps this group owns.
//
// Hermetic: reads the committed render census and the Application manifests, no helm, no
// network. The census is itself re-measured and diffed elsewhere, so it cannot rot silently.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const SNAPSHOT = join(REPO_ROOT, "src/Core.TypeScript/cluster/rendered-resource-requests.snapshot.json");
const APPS_DIR = join(REPO_ROOT, "full-ai-cluster/k8s/applications");

/** Applications whose every rendered workload must reserve CPU and memory. */
const GROUP = ["alloy", "kube-prometheus-stack", "loki", "mimir", "nats", "tempo"] as const;

interface Workload { readonly workload: string; readonly cpuMillis: number; readonly memoryMib: number }
interface Snap {
  readonly profiles: readonly { readonly profile: string; readonly apps: readonly { readonly appId: string; readonly workloads?: readonly Workload[] }[] }[];
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Snap;

/**
 * Rendered workloads that are NOT pods this group's budget can govern. Helm hook Jobs
 * (admission webhook cert create/patch) and test Pods run once and are gone; they are
 * not the steady-state footprint, and the chart gives them no coordinate worth setting.
 */
const TRANSIENT = /^(Job|Pod)\//;

describe("observability + messaging group: nothing renders BestEffort", () => {
  for (const profile of snapshot.profiles) {
    for (const dir of GROUP) {
      test(`${dir} @ ${profile.profile}: every long-running workload requests CPU and memory`, () => {
        const app = profile.apps.find((a) => a.appId === `full-ai-cluster/${dir}`);
        expect(app).toBeDefined();
        const bare = (app?.workloads ?? [])
          .filter((w) => !TRANSIENT.test(w.workload))
          .filter((w) => w.cpuMillis <= 0 || w.memoryMib <= 0)
          .map((w) => w.workload);
        expect(bare).toEqual([]);
      });
    }
  }

  test("the group is not vacuous: each Application renders at least one long-running workload", () => {
    for (const dir of GROUP) {
      const app = snapshot.profiles[0]?.apps.find((a) => a.appId === `full-ai-cluster/${dir}`);
      const longRunning = (app?.workloads ?? []).filter((w) => !TRANSIENT.test(w.workload));
      expect(longRunning.length).toBeGreaterThan(0);
    }
  });
});

describe("operator-created pods the render census cannot see", () => {
  const kps = parse(readFileSync(join(APPS_DIR, "kube-prometheus-stack/Application.yaml"), "utf8")) as {
    spec: { source: { helm: { valuesObject: unknown } } };
  };
  const values = kps.spec.source.helm.valuesObject;

  const dig = (o: unknown, ...path: string[]): unknown => {
    let cur: unknown = o;
    for (const k of path) {
      if (typeof cur !== "object" || cur === null) return undefined;
      cur = (cur as Record<string, unknown>)[k];
    }
    return cur;
  };
  const requests = (r: unknown): { cpu?: unknown; memory?: unknown } => (dig(r, "requests") as { cpu?: unknown; memory?: unknown } | undefined) ?? {};

  test("Prometheus (a Prometheus CR, its pod is made by the operator) declares CPU and memory requests", () => {
    const r = requests(dig(values, "prometheus", "prometheusSpec", "resources"));
    expect(r.cpu).toBeDefined();
    expect(r.memory).toBeDefined();
  });

  test("Alertmanager (an Alertmanager CR) declares CPU and memory requests", () => {
    const r = requests(dig(values, "alertmanager", "alertmanagerSpec", "resources"));
    expect(r.cpu).toBeDefined();
    expect(r.memory).toBeDefined();
  });
});

describe("a sidecar's request hides an unpriced main container from a per-workload census", () => {
  // alloy's config-reloader sidecar ships a chart-default request (10m / 50Mi), so the
  // DaemonSet's workload total was NON-ZERO while the `alloy` container itself -- the one
  // tailing every pod's logs -- requested nothing. The workload-level test above cannot see
  // that, so the coordinate is asserted on the values.
  test("alloy: the collector container itself declares CPU and memory requests", () => {
    const alloy = parse(readFileSync(join(APPS_DIR, "alloy/Application.yaml"), "utf8")) as {
      spec: { source: { helm: { valuesObject: { alloy?: { resources?: { requests?: { cpu?: unknown; memory?: unknown } } } } } } };
    };
    const r = alloy.spec.source.helm.valuesObject.alloy?.resources?.requests ?? {};
    expect(r.cpu).toBeDefined();
    expect(r.memory).toBeDefined();
  });
});
