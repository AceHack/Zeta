// kube-prometheus-stack must not scrape control-plane components this cluster does not run
// as scrapeable pods.
//
// The chart renders a Service + ServiceMonitor + default "...Down" alert for kube-scheduler,
// kube-controller-manager, kube-etcd and kube-proxy. On k3s the first three run INSIDE the
// k3s server process and kube-proxy is disabled outright (Cilium replaces it), so the Services
// select nothing, the jobs are absent, and four alerts fire from the first minute. Measured
// with `helm template` at 88.6.3: disabling the four removes every one of those
// (KubeSchedulerDown / KubeControllerManagerDown / KubeProxyDown / etcdMembersDown: 4 -> 0).
//
// Hermetic. The premise is asserted from the node module that decides it, so a future change
// that starts running kube-proxy (or moves off k3s) turns this red instead of leaving four
// disabled monitors behind a premise that no longer holds.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

const dig = (o: unknown, ...path: string[]): unknown => {
  let cur: unknown = o;
  for (const k of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
};

describe("kube-prometheus-stack: no scrape target for a component that is not a pod here", () => {
  const app = parse(readFileSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications/kube-prometheus-stack/Application.yaml"), "utf8")) as unknown;
  const values = dig(app, "spec", "source", "helm", "valuesObject");
  const k3s = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-server.nix"), "utf8");

  test("the premise: the k3s server disables kube-proxy (Cilium replaces it)", () => {
    expect(k3s).toContain('"--disable-kube-proxy"');
  });

  for (const key of ["kubeScheduler", "kubeControllerManager", "kubeEtcd", "kubeProxy"]) {
    test(`${key}.enabled is false`, () => {
      expect(dig(values, key, "enabled")).toBe(false);
    });
  }
});
