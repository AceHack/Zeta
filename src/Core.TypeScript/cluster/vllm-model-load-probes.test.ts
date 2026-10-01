// Falsifier: the vLLM Deployment can be ENABLED without a perpetual Progressing, a
// premature Service route, or a liveness kill during model load.
//
// vllm ships `replicas: 0` and manual-sync (the local-models phase is deferred), so
// none of this shows today -- which is exactly why it is checked: the day a
// maintainer sets `replicas: 1` on a node with a GPU is the first time any of it runs,
// and it is the worst moment to learn the Deployment had no probes. Three defects, each
// provable from the manifest alone:
//
//   1. NO PROBES. The container declared none, so the Service routed to the pod the
//      instant it started although vLLM does not listen until the weights are
//      downloaded AND loaded -- minutes to an hour for a 33B model on a cold cache.
//   2. A LIVENESS PROBE WITHOUT A STARTUP PROBE WOULD BE WORSE, and is the shape the
//      first-boot trajectory measured killing slow containers
//      (docs/trajectories/usb-installer-first-boot-reliability/RESUME.md): the probe
//      fires before there is anything to answer. So liveness and startup are asserted
//      TOGETHER, and the startup budget is asserted to cover a cold-cache model load.
//   3. ROLLING UPDATE ON A GPU + ReadWriteOnce POD. The surge pod asks for the same
//      single GPU and the same RWO claim, so it sits Pending while the old pod -- which
//      the rollout will not retire until the new one is Ready -- holds both. Any edit
//      (a new `--model`) hangs as perpetual Progressing. `Recreate` is the answer; the
//      ollama chart ships it for the same reason.
//
// The Recreate rule is stated GENERALLY (any git-path Deployment that mounts a
// ReadWriteOnce claim), not just for vllm, so the next workload shaped like this one is
// caught without anyone remembering this file.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";
import { probeKillBudgetSeconds } from "./liveness-kill-budget.ts";
import { discoverApplications, renderApplication } from "./rendered-storage-claims.ts";

const REPO = join(import.meta.dir, "..", "..", "..");
const DEPLOYMENT_PATH = join(REPO, "full-ai-cluster", "k8s", "applications", "vllm", "deployment.yaml");

type Doc = Record<string, unknown>;
const docs: Doc[] = parseAllDocuments(readFileSync(DEPLOYMENT_PATH, "utf8")).map((d) => d.toJS() as Doc);

function rec(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

const deployment = docs.find((d) => d["kind"] === "Deployment");
const podSpec = rec(rec(rec(deployment?.["spec"])["template"])["spec"]);
const container = list(podSpec["containers"]).find((c) => c["name"] === "vllm") ?? {};

/** A model that does not fit in a node's RAM-and-GPU shape must still get an hour to load on a cold cache. */
const MIN_MODEL_LOAD_BUDGET_SECONDS = 1800;

describe("vllm Deployment: startup, readiness and liveness are declared together", () => {
  test("the Deployment and its container were found (an empty read would pass vacuously)", () => {
    expect(deployment).toBeDefined();
    expect(container["name"]).toBe("vllm");
  });

  test("all three probes exist and check the port the container actually declares", () => {
    const declared = list(container["ports"]).map((p) => p["name"]);
    for (const key of ["startupProbe", "readinessProbe", "livenessProbe"] as const) {
      const probe = rec(container[key]);
      expect(Object.keys(probe).length, `${key} is missing`).toBeGreaterThan(0);
      const httpGet = rec(probe["httpGet"]);
      expect(httpGet["path"], `${key} path`).toBe("/health");
      expect(declared, `${key} targets a port the container does not declare`).toContain(httpGet["port"]);
    }
  });

  test("the startup probe budget covers a cold-cache model download and load", () => {
    const budget = probeKillBudgetSeconds(container["startupProbe"]);
    expect(budget, "startupProbe is missing or malformed").not.toBeNull();
    expect(budget ?? 0).toBeGreaterThanOrEqual(MIN_MODEL_LOAD_BUDGET_SECONDS);
  });

  test("liveness never exists without startup (it would fire before there is anything to answer)", () => {
    if (container["livenessProbe"] !== undefined) expect(container["startupProbe"]).toBeDefined();
  });

  test("/dev/shm is a Memory emptyDir, not the 64Mi runtime default", () => {
    const mount = list(container["volumeMounts"]).find((m) => m["mountPath"] === "/dev/shm");
    expect(mount, "no /dev/shm mount").toBeDefined();
    const volume = list(podSpec["volumes"]).find((v) => v["name"] === mount?.["name"]);
    expect(rec(rec(volume)["emptyDir"])["medium"]).toBe("Memory");
  });
});

describe("a Deployment that mounts a ReadWriteOnce claim uses Recreate", () => {
  // Rendered offline with the repo's own renderer: what ArgoCD applies is what is on disk.
  const violations: string[] = [];
  const inspected: string[] = [];
  for (const source of discoverApplications(REPO).filter((s) => s.kind === "git-path")) {
    const rendered = renderApplication(source, { repoRoot: REPO });
    if (!rendered.ok) continue;
    const rwoClaims = new Set(
      rendered.documents
        .filter((d) => d["kind"] === "PersistentVolumeClaim")
        .filter((d) => (list(rec(d["spec"])["accessModes"]) as unknown as string[]).includes("ReadWriteOnce"))
        .map((d) => String(rec(d["metadata"])["name"])),
    );
    for (const d of rendered.documents.filter((x) => x["kind"] === "Deployment")) {
      const pod = rec(rec(rec(d["spec"])["template"])["spec"]);
      const mounted = list(pod["volumes"])
        .map((v) => rec(v["persistentVolumeClaim"])["claimName"])
        .filter((n): n is string => typeof n === "string");
      if (!mounted.some((claim) => rwoClaims.has(claim))) continue;
      const name = `${source.appId} Deployment/${String(rec(d["metadata"])["name"])}`;
      inspected.push(name);
      if (rec(rec(d["spec"])["strategy"])["type"] !== "Recreate") violations.push(name);
    }
  }

  test("the rule inspects at least vllm (not vacuous)", () => {
    expect(inspected).toContain("full-ai-cluster/vllm Deployment/vllm");
  });

  test("every such Deployment declares strategy.type: Recreate", () => {
    expect(violations).toEqual([]);
  });
});
