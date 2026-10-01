// Falsifier: the one-shot `gitlab-lan-address` Job does not decide the LB pool Application's health.
//
// `k8s/lb-ipam/` is the kustomize base of the install-time `cilium-lb-ipam-pool` Application. Its
// Job waits for the `gitlab` Application to exist. Where GitLab is not deployed that never happens,
// the Job runs for its whole 24h wait, and ArgoCD reads a running Job as Progressing -- so the
// Application that hands every LoadBalancer Service an address stayed Progressing/Degraded while its
// pool object was applied and listing the range (WP11 run 36858893664: lbPool verdict PASS, same
// Application Degraded). The annotation below is Argo CD's documented way to drop ONE child
// resource's health from its Application (docs/operator-manual/health.md).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";

const FILE = join(import.meta.dir, "..", "..", "..", "full-ai-cluster/k8s/lb-ipam/gitlab-lan-address.yaml");

type Json = Record<string, unknown>;
const docs = parseAllDocuments(readFileSync(FILE, "utf8")).map((d) => d.toJS() as Json | null);
const meta = (d: Json | null): Json => ((d?.["metadata"] ?? {}) as Json);

describe("k8s/lb-ipam/gitlab-lan-address.yaml", () => {
  const jobs = docs.filter((d) => d?.["kind"] === "Job");

  test("not vacuous: exactly one Job, and it is the gitlab-lan-address one", () => {
    expect(jobs.map((j) => meta(j)["name"])).toEqual(["gitlab-lan-address"]);
  });

  test("every Job opts out of the Application's health computation", () => {
    for (const job of jobs) {
      expect((meta(job)["annotations"] as Json | undefined)?.["argocd.argoproj.io/ignore-healthcheck"]).toBe("true");
    }
  });

  test("the opt-out is not applied to anything that is not a waiting one-shot Job", () => {
    const others = docs.filter((d) => d !== null && d["kind"] !== "Job");
    for (const doc of others) {
      expect((meta(doc)["annotations"] as Json | undefined)?.["argocd.argoproj.io/ignore-healthcheck"]).toBeUndefined();
    }
  });
});
