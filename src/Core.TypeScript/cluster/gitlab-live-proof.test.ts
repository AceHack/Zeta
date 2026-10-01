// Offline falsifiers for the GitLab live proof. Everything here runs with no cluster; what it pins is the
// part of the proof that could be WRONG WITHOUT ANYONE NOTICING -- a check that reads green because its
// prerequisite never ran, an address pin that targets a path the Application does not read, a readiness
// predicate that treats an absent workload as Ready.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import {
  buildGitlabLaneApplication,
  CHECKS,
  ciScriptProblems,
  describeArgoApplication,
  componentReadiness,
  COMPONENT_LABELS,
  gatewayProgrammedAt,
  getLeaf,
  GITLAB_APPLICATION_PATH,
  INSTALL_TIME_LB_APPLICATION_PATH,
  installTimeGitlabPatch,
  jobComplete,
  jsonMergePatch,
  KIND_LB_POOL_MANIFEST_PATH,
  kindPoolLanAddress,
  METRICS_SERVER_CHART,
  PINNED_LEAVES,
  pipelineVerdict,
  PROOF_CI_YAML,
  podReady,
  ProofReport,
  routeAccepted,
  runnerOnline,
  runnerTokenPrefix,
  totalRestarts,
  tracePodName,
  traceShowsKubernetesExecutor,
  type WorkloadItem,
} from "./gitlab-live-proof.ts";

const ROOT = resolve(import.meta.dir, "../../..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

describe("the check roster", () => {
  test("every dependency names a real check, and the graph has no cycle", () => {
    const ids = new Set(CHECKS.map((c) => c.id));
    expect(ids.size).toBe(CHECKS.length);
    for (const c of CHECKS) for (const d of c.dependsOn) expect(ids.has(d)).toBe(true);
    // Kahn: a cycle would leave a node unvisited, and a lane with a cycle can never leave did-not-run.
    const indeg = new Map(CHECKS.map((c) => [c.id, c.dependsOn.length]));
    const queue = CHECKS.filter((c) => c.dependsOn.length === 0).map((c) => c.id);
    let seen = 0;
    while (queue.length > 0) {
      const n = queue.shift() as string;
      seen++;
      for (const c of CHECKS) {
        if (c.dependsOn.includes(n)) {
          const left = (indeg.get(c.id) ?? 0) - 1;
          indeg.set(c.id, left);
          if (left === 0) queue.push(c.id);
        }
      }
    }
    expect(seen).toBe(CHECKS.length);
  });

  test("the owner's lettered checks (a)..(f) are all present and blocking", () => {
    for (const letter of ["a1", "a2", "a3", "a4", "a5", "b1", "c1", "c2", "d1", "d2", "d3", "e1", "e2", "f1", "f2", "f3"]) {
      const spec = CHECKS.find((c) => c.id.startsWith(`${letter}-`));
      expect(spec, letter).toBeDefined();
      expect(spec?.blocking, letter).toBe(true);
    }
  });

  test("(e) and (d2) stand on the things they need: a pipeline needs login AND an online runner", () => {
    const d2 = CHECKS.find((c) => c.id === "d2-runner-api-online");
    expect(d2?.dependsOn).toContain("b1-root-login");
    expect(d2?.dependsOn).toContain("d1-runner-pod-running");
    expect(CHECKS.find((c) => c.id === "e1-pipeline-success")?.dependsOn).toContain("d2-runner-api-online");
    // The token Job completing proves nothing on its own (it exits 0 on its own failure by design):
    // the Secret check must depend on it, and the runner pod must depend on the Secret check.
    expect(CHECKS.find((c) => c.id === "d1-runner-pod-running")?.dependsOn).toContain("c2-runner-secret-token");
  });
});

describe("ProofReport -- did-not-run is a third answer, never a pass", () => {
  test("a failed prerequisite makes its dependents did-not-run and names it", () => {
    const r = new ProofReport();
    r.record("a0-lane-up", "passed", "ok");
    r.record("a1-webservice-ready", "failed", "never became ready");
    const rows = r.finalize();
    const b1 = rows.find((x) => x.id === "b1-root-login");
    expect(b1?.status).toBe("did-not-run");
    expect(b1?.detail).toContain("a1-webservice-ready");
    expect(rows.find((x) => x.id === "e1-pipeline-success")?.status).toBe("did-not-run");
  });

  test("a run that ends early leaves unreached checks did-not-run, and the verdict is NOT passed", () => {
    const r = new ProofReport();
    for (const c of CHECKS) if (c.id < "d") r.record(c.id, "passed", "ok");
    expect(r.verdictPassed()).toBe(false);
    expect(r.finalize().filter((x) => x.status === "did-not-run").length).toBeGreaterThan(0);
  });

  test("a pass recorded on top of a failed prerequisite is downgraded, not believed", () => {
    const r = new ProofReport();
    r.record("a0-lane-up", "passed", "ok");
    r.record("a1-webservice-ready", "failed", "no");
    r.record("b1-root-login", "passed", "claims to have logged in");
    const b1 = r.finalize().find((x) => x.id === "b1-root-login");
    expect(b1?.status).toBe("did-not-run");
    expect(b1?.detail).toContain("recorded passed but prerequisite");
  });

  test("an unknown check id throws instead of inventing a check nothing reads", () => {
    expect(() => new ProofReport().record("z9-typo", "passed", "x")).toThrow(/unknown check id/);
  });

  test("the verdict passes only when every BLOCKING check passed; an informational failure does not decide it", () => {
    const r = new ProofReport();
    for (const c of CHECKS) r.record(c.id, "passed", "ok");
    expect(r.verdictPassed()).toBe(true);
    r.record("a6-argocd-application", "failed", "Progressing");
    expect(r.verdictPassed()).toBe(true);
    r.record("e1-pipeline-success", "failed", "pending forever");
    expect(r.verdictPassed()).toBe(false);
  });

  test("markdown labels each status distinctly and escapes table separators", () => {
    const r = new ProofReport();
    r.record("a0-lane-up", "failed", "a | b");
    const md = r.toMarkdown();
    expect(md).toContain("FAILED");
    expect(md).toContain("DID-NOT-RUN");
    expect(md).toContain("a \\| b");
    expect(md).toContain("NOT PROVEN");
  });
});

describe("the LAN address pin follows the installer, not this lane", () => {
  const poolText = read(KIND_LB_POOL_MANIFEST_PATH);
  const template = read(INSTALL_TIME_LB_APPLICATION_PATH);
  const app = read(GITLAB_APPLICATION_PATH);

  test("the lane address is the LAST address of the kind pool, as the installer pins the last of the resolved range", () => {
    expect(kindPoolLanAddress(poolText)).toBe("172.18.255.220");
  });

  test("a pool manifest with no pool is refused, not defaulted", () => {
    expect(() => kindPoolLanAddress("kind: ConfigMap\n")).toThrow(/no CiliumLoadBalancerIPPool/);
  });

  test("the install-time patch, applied to the REAL Application, writes all three pinned leaves", () => {
    const address = "172.18.255.220";
    const patch = installTimeGitlabPatch(template, address);
    const out = parse(buildGitlabLaneApplication(app, patch, address)) as unknown;
    const values = getLeaf(out, ["spec", "source", "helm", "valuesObject"]);
    for (const leaf of PINNED_LEAVES) expect(getLeaf(values, leaf)).toBe(address);
    // And the sentinel is GONE from the three places, which is what "pinned" means.
    expect(JSON.stringify(values)).not.toContain("192.0.2.250");
  });

  test("a template whose patch is missing throws -- a lane that pinned nothing would assert the sentinel", () => {
    const stripped = template.replaceAll("gitlab-lan-address", "something-else");
    expect(() => installTimeGitlabPatch(stripped, "172.18.255.220")).toThrow(/no gitlab-lan-address patch/);
  });

  test("a patch aimed at a path the Application does not carry is refused after patching", () => {
    // Same address everywhere except the registry leaf: the verification must notice it is not pinned.
    const leaf = { global: { hosts: { gitlab: { name: "172.18.255.220" } }, zeta: { lanAddress: "172.18.255.220" } } };
    const bad = { spec: { source: { helm: { valuesObject: leaf } } } };
    expect(() => buildGitlabLaneApplication(app, bad, "172.18.255.220")).toThrow(/registry\.name/);
    // A patch rooted at the wrong place changes nothing at all, and that is refused too.
    expect(() => buildGitlabLaneApplication(app, leaf, "172.18.255.220")).toThrow(/gitlab\.name/);
  });

  test("jsonMergePatch follows RFC 7386: objects merge, scalars replace, null deletes", () => {
    expect(jsonMergePatch({ a: { b: 1, c: 2 }, d: 3 }, { a: { b: 9 }, d: null })).toEqual({ a: { b: 9, c: 2 } });
    expect(jsonMergePatch({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });
});

describe("readiness predicates do not round up", () => {
  const dep = (name: string, app: string, want: number, have: number): WorkloadItem => ({
    kind: "Deployment",
    metadata: { name, labels: { app } },
    spec: { replicas: want },
    status: { readyReplicas: have },
  });

  test("an ABSENT workload is not Ready", () => {
    expect(componentReadiness([], COMPONENT_LABELS.webservice).ready).toBe(false);
  });

  test("a rollout still scaling (1 of 2) is not Ready, and zero ready replicas is not Ready", () => {
    expect(componentReadiness([dep("w", "webservice", 2, 1)], "webservice").ready).toBe(false);
    expect(componentReadiness([dep("w", "webservice", 1, 0)], "webservice").ready).toBe(false);
    expect(componentReadiness([dep("w", "webservice", 1, 1)], "webservice").ready).toBe(true);
  });

  test("a component is found by its app label, so sidekiq's `-v2` name suffix is not load-bearing", () => {
    expect(componentReadiness([dep("gitlab-sidekiq-all-in-1-v2", "sidekiq", 1, 1)], COMPONENT_LABELS.sidekiq).ready).toBe(true);
    // ...and a DIFFERENT component's readiness is not borrowed.
    expect(componentReadiness([dep("x", "registry", 1, 1)], COMPONENT_LABELS.sidekiq).ready).toBe(false);
  });

  test("a StatefulSet counts (gitaly)", () => {
    const sts: WorkloadItem = { kind: "StatefulSet", metadata: { name: "gitlab-gitaly", labels: { app: "gitaly" } }, spec: { replicas: 1 }, status: { readyReplicas: 1 } };
    expect(componentReadiness([sts], COMPONENT_LABELS.gitaly).ready).toBe(true);
  });

  test("a Pod is Ready only when Running AND the Ready condition is True; restarts are summed", () => {
    const pod = { metadata: { name: "p" }, status: { phase: "Running", conditions: [{ type: "Ready", status: "False" }], containerStatuses: [{ name: "a", restartCount: 2 }, { name: "b", restartCount: 1 }] } };
    expect(podReady(pod)).toBe(false);
    expect(totalRestarts(pod)).toBe(3);
    expect(podReady({ metadata: { name: "p" }, status: { phase: "Pending", conditions: [{ type: "Ready", status: "True" }] } })).toBe(false);
  });

  test("a Job is complete only on the Complete condition, not on `succeeded` alone or on absence of failure", () => {
    expect(jobComplete({ status: { succeeded: 1 } })).toBe(false);
    expect(jobComplete({ status: { conditions: [{ type: "Complete", status: "True" }] } })).toBe(true);
    expect(jobComplete({})).toBe(false);
  });
});

describe("the runner token and the runner's online status", () => {
  test("only a glrt- value counts, and the token itself is never returned for display", () => {
    const good = Buffer.from("glrt-abcdefghijklmnop").toString("base64");
    const r = runnerTokenPrefix(good);
    expect(r.isAuthToken).toBe(true);
    expect(r.shown).not.toContain("abcdefgh");
    expect(runnerTokenPrefix(Buffer.from("glpat-xxxxxxxxxxxxxxxx").toString("base64")).isAuthToken).toBe(false);
    expect(runnerTokenPrefix(Buffer.from("").toString("base64")).isAuthToken).toBe(false);
    expect(runnerTokenPrefix(undefined).isAuthToken).toBe(false);
    // "glrt-" alone is not a token.
    expect(runnerTokenPrefix(Buffer.from("glrt-").toString("base64")).isAuthToken).toBe(false);
  });

  test("a runner is online only when the NAMED runner reports it; another online runner does not stand in", () => {
    expect(runnerOnline([{ id: 1, description: "other", status: "online" }], "zeta-cluster").online).toBe(false);
    expect(runnerOnline([{ id: 2, description: "zeta-cluster", status: "offline" }], "zeta-cluster").online).toBe(false);
    expect(runnerOnline([{ id: 2, description: "zeta-cluster", status: "online", run_untagged: true }], "zeta-cluster").online).toBe(true);
    expect(runnerOnline([], "zeta-cluster").online).toBe(false);
  });
});

describe("the pipeline", () => {
  test("the proof's .gitlab-ci.yml has NO tags -- the first file anyone writes has none", () => {
    const doc = parse(PROOF_CI_YAML) as Record<string, unknown>;
    const job = doc["zeta-live-proof"] as Record<string, unknown>;
    expect(job).toBeDefined();
    expect(job["tags"]).toBeUndefined();
    expect(Array.isArray(job["script"])).toBe(true);
  });

  test("every script entry is a STRING -- the first live pipeline failed with zero jobs because one entry was a one-key mapping", () => {
    expect(ciScriptProblems(PROOF_CI_YAML)).toEqual([]);
    // The exact line that shipped in run 36860368378. It is a valid YAML list item (a mapping), so
    // "script is an array" passed it while GitLab refused the file.
    const broken = PROOF_CI_YAML.replace('echo "zeta live proof is running in $(hostname)"', 'echo "zeta live proof: running in $(hostname)"');
    expect(broken).not.toBe(PROOF_CI_YAML);
    const problems = ciScriptProblems(broken);
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain("not a string");
    expect(ciScriptProblems("job:\n  tags: [x]\n  script:\n    - echo hi\n")[0]).toContain("carries tags");
    expect(ciScriptProblems("a: [")[0]).toContain("not valid YAML");
  });

  test("only `success` is success; failed/canceled/skipped are failures; the rest is still pending", () => {
    expect(pipelineVerdict("success")).toBe("success");
    for (const s of ["failed", "canceled", "skipped"]) expect(pipelineVerdict(s)).toBe("failed");
    for (const s of ["pending", "running", "created", "waiting_for_resource", "preparing"]) expect(pipelineVerdict(s)).toBe("pending");
  });

  test("the executor evidence is read from the job trace", () => {
    const trace = "Running with gitlab-runner 17.7.0\nUsing Kubernetes executor with image ubuntu:22.04 ...\nRunning on runner-abc123-project-5-concurrent-0-xyz via gitlab-gitlab-runner-1\n";
    expect(traceShowsKubernetesExecutor(trace)).toBe(true);
    expect(tracePodName(trace)).toBe("runner-abc123-project-5-concurrent-0-xyz");
    expect(traceShowsKubernetesExecutor("Using Docker executor")).toBe(false);
    expect(tracePodName("no pod here")).toBeNull();
  });
});

describe("the Gateway", () => {
  const gw = (programmed: string, accepted: string, addr: string) => ({
    status: { addresses: [{ type: "IPAddress", value: addr }], conditions: [{ type: "Accepted", status: accepted }, { type: "Programmed", status: programmed, reason: "AddressNotAssigned", message: "pending" }] },
  });

  test("Programmed at the pinned address passes; programmed at a DIFFERENT address, or not programmed, does not", () => {
    expect(gatewayProgrammedAt(gw("True", "True", "172.18.255.220"), "172.18.255.220").ok).toBe(true);
    expect(gatewayProgrammedAt(gw("True", "True", "172.18.255.201"), "172.18.255.220").ok).toBe(false);
    expect(gatewayProgrammedAt(gw("False", "True", "172.18.255.220"), "172.18.255.220").ok).toBe(false);
    expect(gatewayProgrammedAt({}, "172.18.255.220").ok).toBe(false);
  });

  test("a route with no parent status is NOT accepted", () => {
    expect(routeAccepted({})).toBe(false);
    expect(routeAccepted({ status: { parents: [{ conditions: [{ type: "Accepted", status: "True" }] }] } })).toBe(true);
    expect(routeAccepted({ status: { parents: [{ conditions: [{ type: "Accepted", status: "False" }] }] } })).toBe(false);
  });
});

describe("the ArgoCD account of a held sync", () => {
  test("the resource that holds the sync, the operation message and a failed HPA are all named", () => {
    const lines = describeArgoApplication({
      status: {
        sync: { status: "OutOfSync" },
        health: { status: "Degraded" },
        operationState: {
          phase: "Running",
          message: "waiting for healthy state of apps/Deployment/gitlab-sidekiq-all-in-1-v2 and 2 more resources",
          syncResult: { resources: [{ kind: "HorizontalPodAutoscaler", name: "gitlab-registry", status: "Synced", hookPhase: "Failed", message: "the HPA was unable to compute the replica count" }] },
        },
        resources: [{ kind: "Deployment", name: "gitlab-gitlab-runner", status: "OutOfSync" }],
      },
    }).join("\n");
    expect(lines).toContain("waiting for healthy state");
    expect(lines).toContain("HorizontalPodAutoscaler/gitlab-registry");
    expect(lines).toContain("Deployment/gitlab-gitlab-runner");
  });

  test("an unreadable Application is reported as unreadable, not as healthy", () => {
    expect(describeArgoApplication(null)[0]).toContain("unreadable");
  });
});

describe("the substrate the lane must provide before GitLab is applied", () => {
  const source = readFileSync(join(ROOT, "src/Core.TypeScript/cluster/gitlab-live-proof.ts"), "utf8");

  test("the metrics API is installed BEFORE the gitlab Application is applied, and is the version k3s vendors", () => {
    // Measured, run 36855715576: with no metrics.k8s.io the chart's HPAs read ScalingActive=False, ArgoCD
    // calls that Degraded, and the wave-5 token Job + wave-10 runner Deployment are never created.
    const install = source.indexOf("const metrics = installMetricsApi()");
    const apply = source.indexOf('kubectl(["apply", "-n", "argocd", "-f", "-"]');
    expect(install).toBeGreaterThan(0);
    expect(apply).toBeGreaterThan(install);
    const vendored = read("full-ai-cluster/k8s/bootstrap/k3s-metrics-server.yaml");
    expect(vendored).toContain("mirrored-metrics-server:v0.9.0");
    expect(METRICS_SERVER_CHART.version).toBe("3.14.0"); // chart 3.14.0 == app v0.9.0, the metal metrics-server
  });

  test("the GitLab chart really does render HPAs (so the dependency is real, not remembered)", () => {
    const app = read(GITLAB_APPLICATION_PATH);
    expect(app).toContain("minReplicas: 1");
    expect(app).toContain("maxReplicas: 2");
  });
});

describe("wiring", () => {
  test("the workflow runs these falsifiers and the proof, and is dispatchable", () => {
    const wf = read(".github/workflows/gitlab-live-proof.yml");
    expect(wf).toContain("workflow_dispatch");
    expect(wf).toContain("src/Core.TypeScript/cluster/gitlab-live-proof.test.ts");
    expect(wf).toContain("src/Core.TypeScript/cluster/gitlab-live-proof.ts");
  });
});
