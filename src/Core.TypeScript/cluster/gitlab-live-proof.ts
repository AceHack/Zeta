// GitLab LIVE proof -- the first lane that deploys GitLab on a real cluster and asserts that it WORKS.
//
// WHY THIS EXISTS
// ---------------
// GitLab was repaired on paper four times (#17711, #17737, #17763, #17796: the retrying runner-token
// mint Job, `run_untagged`, requests, autoscaler caps, the LAN-address pin) and had never once been
// deployed by any CI lane. The WP11 installed-disk guest excludes `gitlab/**` (wp11-ci-envelope.json),
// the kind lanes exclude it (DEFAULT_ROOT_DEV_CATALOG), and the docs say it was "never asserted
// Healthy anywhere". Every one of those four fixes is a claim about a running system that nothing
// had run. This module is what runs it.
//
// WHAT IT ASSERTS -- each a separately named check that ends `passed`, `failed` or `did-not-run`:
//   (a) webservice / sidekiq / gitaly / registry / shell are each Ready;
//   (b) the root admin can log in (OAuth password flow against the live API, then `GET /user`);
//   (c) Job `gitlab-runner-token` completed AND Secret `gitlab-gitlab-runner-secret` holds a glrt- token
//       (the Job exits 0 on its own failure by design, so `Complete` alone proves nothing);
//   (d) the runner pod is Running, has NOT restarted, and `GET /runners/all` reports it `online`;
//   (e) an UNTAGGED `.gitlab-ci.yml` pipeline runs to `success` on that runner, in a Kubernetes executor
//       job pod;
//   (f) the Gateway is Programmed at the pinned address and the external URL + registry route answer
//       from OUTSIDE the pod network (the runner host, over the docker bridge).
//
// `did-not-run` IS A THIRD ANSWER, NEVER A PASS. A check whose prerequisite failed is reported as
// did-not-run with the prerequisite named, so a red (a) cannot be read as "(e) is fine".
//
// REUSE, NOT A PARALLEL FRAMEWORK. The cluster comes from `bootstrapKindClusterInProcess` (kind +
// the SHIPPED Cilium, ArgoCD, the dev StorageClass aliases, the dev-minted Secrets incl.
// `gitlab-initial-root-password` and `zeta-blob-store`, the served dev-rung tree). Only the roster is
// different: the root catalogue applies `seaweedfs` (GitLab's object store) and the `gitlab`
// Application is applied directly, because `gitlab/**` is in DEFAULT_ROOT_DEV_CATALOG.excludeGlob and
// that deferral is a statement about the SHARED lanes' memory budget, not about this lane.
//
// THE LAN ADDRESS IS PINNED THE WAY THE INSTALLER PINS IT. On metal `gitlab-lan-address` merge-patches
// three leaves of the Application's valuesObject to the LAST address of the resolved LB pool. This lane
// reads that SAME patch out of `k8s/lb-ipam/argocd-application.yaml.in` and applies it with the kind
// pool's last address, so the install-time patch shape is exercised against the real Application
// instead of being restated here.
//
// USAGE
//   bun src/Core.TypeScript/cluster/gitlab-live-proof.ts --dry-run
//   bun src/Core.TypeScript/cluster/gitlab-live-proof.ts --run --cluster-name zeta-ci-gitlab \
//       --git-ref <sha> --report out.json --summary $GITHUB_STEP_SUMMARY
//   ... --existing   # reuse the current kubectl context instead of creating a kind cluster

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse, parseAllDocuments, stringify } from "yaml";
import { bootstrapKindClusterInProcess, defaultKindCiliumConfigPath } from "./harness/bootstrap.ts";
import { buildLaneTreeForProfile } from "./argocd-health-test.ts";
import { liveDevClusterPorts } from "./dev-cluster/deps.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const GITLAB_APPLICATION_PATH = "full-ai-cluster/k8s/applications/gitlab/Application.yaml";
export const KIND_LB_POOL_MANIFEST_PATH = "full-ai-cluster/dev-cluster/manifests/cilium-lb-ipam.kind.yaml";
export const INSTALL_TIME_LB_APPLICATION_PATH = "full-ai-cluster/k8s/lb-ipam/argocd-application.yaml.in";
export const GITLAB_NAMESPACE = "gitlab";
export const RUNNER_SECRET = "gitlab-gitlab-runner-secret";
export const RUNNER_TOKEN_JOB = "gitlab-runner-token";
export const ROOT_PASSWORD_SECRET = "gitlab-initial-root-password";
export const RUNNER_DESCRIPTION = "zeta-cluster";
/** The roster the lane's ROOT catalogue applies: GitLab's object store only. The Application itself is applied directly. */
export const LANE_ROOT_DIRS: readonly string[] = ["seaweedfs"];

// ---------------------------------------------------------------- results ---

export type CheckStatus = "passed" | "failed" | "did-not-run";

export interface CheckResult {
  readonly id: string;
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail: string;
  /** False = reported but does not decide the verdict. */
  readonly blocking: boolean;
}

export interface CheckSpec {
  readonly id: string;
  readonly name: string;
  /** Check ids that must have `passed` for this one to be run at all. */
  readonly dependsOn: readonly string[];
  readonly blocking: boolean;
}

/**
 * The checks, in report order. THE ID PREFIX IS THE LETTER of the owner's list, so the report reads
 * (a)..(f) without a legend. A reachable `did-not-run` needs the dependency edges to be real, which
 * `gitlab-live-proof.test.ts` pins.
 */
export const CHECKS: readonly CheckSpec[] = [
  { id: "a0-lane-up", name: "(lane) kind + Cilium + ArgoCD + object store up, gitlab Application applied", dependsOn: [], blocking: true },
  { id: "a1-webservice-ready", name: "(a) webservice Ready", dependsOn: ["a0-lane-up"], blocking: true },
  { id: "a2-sidekiq-ready", name: "(a) sidekiq Ready", dependsOn: ["a0-lane-up"], blocking: true },
  { id: "a3-gitaly-ready", name: "(a) gitaly Ready", dependsOn: ["a0-lane-up"], blocking: true },
  { id: "a4-registry-ready", name: "(a) registry Ready", dependsOn: ["a0-lane-up"], blocking: true },
  { id: "a5-shell-ready", name: "(a) gitlab-shell Ready", dependsOn: ["a0-lane-up"], blocking: true },
  { id: "a6-argocd-application", name: "(a+) ArgoCD Application gitlab Synced and Healthy (judged last)", dependsOn: ["a0-lane-up"], blocking: false },
  { id: "b1-root-login", name: "(b) root admin login (OAuth password flow) and GET /user is_admin", dependsOn: ["a1-webservice-ready"], blocking: true },
  { id: "c1-token-job-complete", name: "(c) Job gitlab-runner-token completed", dependsOn: ["a1-webservice-ready"], blocking: true },
  { id: "c2-runner-secret-token", name: "(c) Secret gitlab-gitlab-runner-secret holds a glrt- token", dependsOn: ["c1-token-job-complete"], blocking: true },
  { id: "d1-runner-pod-running", name: "(d) runner pod Running and Ready", dependsOn: ["c2-runner-secret-token"], blocking: true },
  { id: "d2-runner-api-online", name: "(d) GET /api/v4/runners/all shows the runner online", dependsOn: ["d1-runner-pod-running", "b1-root-login"], blocking: true },
  { id: "e1-pipeline-success", name: "(e) untagged pipeline succeeds on the runner", dependsOn: ["d2-runner-api-online"], blocking: true },
  { id: "e2-kubernetes-executor-pod", name: "(e) the job ran in a Kubernetes executor pod", dependsOn: ["e1-pipeline-success"], blocking: true },
  { id: "d3-runner-not-crash-looping", name: "(d) runner container never restarted (checked after the pipeline and a soak)", dependsOn: ["d1-runner-pod-running"], blocking: true },
  { id: "f1-gateway-programmed", name: "(f) Gateway gitlab-lan Programmed at the pinned address, routes Accepted", dependsOn: ["a0-lane-up"], blocking: true },
  { id: "f2-external-url-from-host", name: "(f) external URL answers from outside the pod network and advertises itself", dependsOn: ["f1-gateway-programmed", "a1-webservice-ready"], blocking: true },
  { id: "f3-registry-route-from-host", name: "(f) /v2/ routes to the registry from outside the pod network", dependsOn: ["f1-gateway-programmed", "a4-registry-ready"], blocking: true },
];

export class ProofReport {
  private readonly results = new Map<string, CheckResult>();

  /** Record a result for a known check. An unknown id THROWS: a typo would otherwise create a check nothing reads. */
  record(id: string, status: CheckStatus, detail: string): CheckResult {
    const spec = CHECKS.find((c) => c.id === id);
    if (spec === undefined) throw new Error(`unknown check id: ${id}`);
    const result: CheckResult = { id, name: spec.name, status, detail, blocking: spec.blocking };
    this.results.set(id, result);
    return result;
  }

  statusOf(id: string): CheckStatus | "unrecorded" {
    return this.results.get(id)?.status ?? "unrecorded";
  }

  /** The first dependency of `id` that has not passed, or null when every dependency passed. */
  blockedBy(id: string): { readonly id: string; readonly status: CheckStatus | "unrecorded" } | null {
    const spec = CHECKS.find((c) => c.id === id);
    if (spec === undefined) throw new Error(`unknown check id: ${id}`);
    for (const dep of spec.dependsOn) {
      const status = this.statusOf(dep);
      if (status !== "passed") return { id: dep, status };
    }
    return null;
  }

  /**
   * Resolve every unrecorded check: one whose dependency did not pass is `did-not-run` naming it; one
   * with all dependencies passed that was simply never reached is ALSO `did-not-run` (the lane ended
   * first) and says so. Nothing is ever defaulted to `passed`.
   */
  finalize(): readonly CheckResult[] {
    for (const spec of CHECKS) {
      const existing = this.results.get(spec.id);
      if (existing !== undefined) {
        const blocker = this.blockedBy(spec.id);
        if (existing.status === "passed" && blocker !== null) {
          // A pass that stands on a failed prerequisite is not a pass this report can vouch for.
          this.record(spec.id, "did-not-run", `recorded passed but prerequisite ${blocker.id} is ${blocker.status}`);
        }
        continue;
      }
      const blocker = this.blockedBy(spec.id);
      this.record(
        spec.id,
        "did-not-run",
        blocker === null ? "the run ended before this check was reached" : `prerequisite ${blocker.id} is ${blocker.status}`,
      );
    }
    return CHECKS.map((c) => this.results.get(c.id) as CheckResult);
  }

  /** True only when every BLOCKING check passed. `did-not-run` is not a pass. */
  verdictPassed(): boolean {
    return this.finalize().every((r) => !r.blocking || r.status === "passed");
  }

  toMarkdown(extra: readonly string[] = []): string {
    const rows = this.finalize();
    const icon = (s: CheckStatus): string => (s === "passed" ? "PASSED" : s === "failed" ? "FAILED" : "DID-NOT-RUN");
    const lines = [
      "## GitLab live proof",
      "",
      `Verdict: **${this.verdictPassed() ? "ALL BLOCKING CHECKS PASSED" : "NOT PROVEN"}**`,
      "",
      "| check | status | detail |",
      "| --- | --- | --- |",
      ...rows.map((r) => `| ${r.name}${r.blocking ? "" : " (informational)"} | ${icon(r.status)} | ${r.detail.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`),
      ...extra,
    ];
    return lines.join("\n") + "\n";
  }

  toJSON(): { readonly passed: boolean; readonly checks: readonly CheckResult[] } {
    const checks = this.finalize();
    return { passed: this.verdictPassed(), checks };
  }
}

// ------------------------------------------------------- lane address pin ---

/** Last address of the kind LB-IPAM pool -- the address the installer's `gitlab-lan-address` Job would pin. */
export function kindPoolLanAddress(poolManifestText: string): string {
  for (const doc of parseAllDocuments(poolManifestText)) {
    const obj = doc.toJS() as { kind?: string; spec?: { blocks?: { start?: string; stop?: string }[] } } | null;
    if (obj?.kind !== "CiliumLoadBalancerIPPool") continue;
    const blocks = obj.spec?.blocks ?? [];
    const last = blocks[blocks.length - 1];
    if (last?.stop === undefined) throw new Error("the kind CiliumLoadBalancerIPPool carries no block with a stop address");
    return last.stop;
  }
  throw new Error("no CiliumLoadBalancerIPPool in the kind LB-IPAM manifest");
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** RFC 7386 JSON merge patch -- the semantics `kubectl patch --type merge` applies in the install-time Job. */
export function jsonMergePatch(target: Json, patch: Json): Json {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const base: { [k: string]: Json } =
    target !== null && typeof target === "object" && !Array.isArray(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete base[k];
    else base[k] = jsonMergePatch(base[k] ?? null, v);
  }
  return base;
}

/**
 * The merge-patch document the install-time Job applies to the `gitlab` Application, READ FROM THE
 * INSTALLER'S OWN TEMPLATE (`k8s/lb-ipam/argocd-application.yaml.in`) and given the pool's last
 * address. THROWS when the template no longer carries the patch -- a lane that quietly pinned nothing
 * would assert the sentinel address and report on a Gateway nobody can reach.
 */
export function installTimeGitlabPatch(templateText: string, address: string): Json {
  const app = parse(templateText) as {
    spec?: { source?: { kustomize?: { patches?: { target?: { name?: string }; patch?: string }[] } } };
  };
  const patches = app.spec?.source?.kustomize?.patches ?? [];
  const entry = patches.find((p) => p.target?.name === "gitlab-lan-address");
  if (entry?.patch === undefined) {
    throw new Error("the install-time lb-ipam Application carries no gitlab-lan-address patch; nothing to pin the address with");
  }
  const jsonPatch = JSON.parse(entry.patch.replaceAll("@ZETA_LB_POOL_STOP@", address)) as { op: string; path: string; value: string }[];
  const add = jsonPatch.find((op) => op.path === "/data/patch.json");
  if (add === undefined) throw new Error("the gitlab-lan-address patch does not write /data/patch.json");
  return JSON.parse(add.value) as Json;
}

/** The leaves the pin writes; the dry-run and the tests assert the Application actually carries them AFTER the patch. */
export const PINNED_LEAVES: readonly (readonly string[])[] = [
  ["global", "hosts", "gitlab", "name"],
  ["global", "hosts", "registry", "name"],
  ["global", "zeta", "lanAddress"],
];

export function getLeaf(root: unknown, path: readonly string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * The committed `gitlab` Application with the install-time address pin applied. Returns the manifest text
 * to `kubectl apply`. Every pinned leaf is verified to equal the address, so a patch that targets a path
 * the Application does not read (the chart ignoring it silently) throws here rather than in a live lane.
 */
export function buildGitlabLaneApplication(applicationText: string, patch: Json, address: string): string {
  const app = parse(applicationText) as Json;
  const patchedSpec = jsonMergePatch(app, patch);
  const values = getLeaf(patchedSpec, ["spec", "source", "helm", "valuesObject"]);
  for (const leaf of PINNED_LEAVES) {
    const got = getLeaf(values, leaf);
    if (got !== address) throw new Error(`after the install-time patch ${leaf.join(".")} is ${JSON.stringify(got)}, not ${address}`);
  }
  return stringify(patchedSpec);
}

// ------------------------------------------------------ readiness (pure) ---

export interface WorkloadItem {
  readonly kind: string;
  readonly metadata: { readonly name: string; readonly labels?: Record<string, string> };
  readonly spec?: { readonly replicas?: number };
  readonly status?: { readonly readyReplicas?: number; readonly availableReplicas?: number; readonly replicas?: number };
}

/** The `app=` label values the GitLab chart puts on each component. */
export const COMPONENT_LABELS = {
  webservice: "webservice",
  sidekiq: "sidekiq",
  gitaly: "gitaly",
  registry: "registry",
  shell: "gitlab-shell",
} as const;

export interface Readiness {
  readonly ready: boolean;
  readonly detail: string;
}

/**
 * Is the component Ready? Found by its `app` label rather than by workload name -- sidekiq's Deployment is
 * `gitlab-sidekiq-all-in-1-v2`, and a name match would have to be edited with every chart bump. NO match is
 * `ready: false` (an absent workload is not a Ready one), and ready requires at least one ready replica AND
 * ready == desired, so a rollout still scaling up is not reported Ready.
 */
export function componentReadiness(items: readonly WorkloadItem[], appLabel: string): Readiness {
  const matches = items.filter(
    (i) => (i.kind === "Deployment" || i.kind === "StatefulSet") && i.metadata.labels?.["app"] === appLabel,
  );
  if (matches.length === 0) return { ready: false, detail: `no Deployment/StatefulSet labelled app=${appLabel} exists yet` };
  const parts: string[] = [];
  let all = true;
  for (const m of matches) {
    const want = m.spec?.replicas ?? 1;
    const have = m.status?.readyReplicas ?? 0;
    const ok = want >= 1 && have >= 1 && have >= want;
    if (!ok) all = false;
    parts.push(`${m.kind}/${m.metadata.name} ready ${String(have)}/${String(want)}`);
  }
  return { ready: all, detail: parts.join("; ") };
}

export interface PodItem {
  readonly metadata: { readonly name: string; readonly labels?: Record<string, string> };
  readonly status?: {
    readonly phase?: string;
    readonly conditions?: readonly { readonly type: string; readonly status: string }[];
    readonly containerStatuses?: readonly { readonly name: string; readonly restartCount?: number; readonly ready?: boolean }[];
  };
}

export function podReady(pod: PodItem): boolean {
  return pod.status?.phase === "Running" && (pod.status.conditions ?? []).some((c) => c.type === "Ready" && c.status === "True");
}

export function totalRestarts(pod: PodItem): number {
  return (pod.status?.containerStatuses ?? []).reduce((a, c) => a + (c.restartCount ?? 0), 0);
}

export interface JobItem {
  readonly status?: { readonly succeeded?: number; readonly failed?: number; readonly conditions?: readonly { readonly type: string; readonly status: string }[] };
}

export function jobComplete(job: JobItem): boolean {
  return (job.status?.conditions ?? []).some((c) => c.type === "Complete" && c.status === "True");
}

/**
 * Does base64 Secret data decode to a GitLab runner AUTHENTICATION token? Only the 5-char prefix is ever
 * returned for display -- the token is a credential and never goes into a log.
 */
export function runnerTokenPrefix(b64: string | undefined): { readonly isAuthToken: boolean; readonly shown: string } {
  if (b64 === undefined || b64 === "") return { isAuthToken: false, shown: "<empty>" };
  const decoded = Buffer.from(b64, "base64").toString("utf8");
  return decoded.startsWith("glrt-") && decoded.length > 10
    ? { isAuthToken: true, shown: "glrt-<redacted>" }
    : { isAuthToken: false, shown: decoded.length === 0 ? "<empty>" : `non-glrt value (length ${String(decoded.length)})` };
}

export interface ApiRunner {
  readonly id: number;
  readonly description?: string;
  readonly status?: string;
  readonly online?: boolean;
  readonly runner_type?: string;
  readonly tag_list?: readonly string[];
  readonly run_untagged?: boolean;
}

/** The named runner from `GET /runners/all`, and whether it is online. A missing runner is not online. */
export function runnerOnline(runners: readonly ApiRunner[], description: string): { readonly online: boolean; readonly detail: string } {
  const r = runners.find((x) => x.description === description);
  if (r === undefined) {
    return { online: false, detail: `no runner named ${description}; the API lists ${String(runners.length)} runner(s): ${runners.map((x) => String(x.description)).join(", ") || "none"}` };
  }
  const online = r.status === "online" || r.online === true;
  return { online, detail: `runner ${description} id=${String(r.id)} status=${String(r.status)} type=${String(r.runner_type)} run_untagged=${String(r.run_untagged)} tags=${(r.tag_list ?? []).join(",")}` };
}

/**
 * The pipeline file. NO `tags:` -- the first file anyone writes has none, and a tags-only runner leaves it Pending forever.
 *
 * NO `: ` (colon-space) INSIDE A PLAIN SCALAR. The first version had `- echo "zeta live proof: running in ..."`,
 * which YAML reads as a one-key MAPPING (`echo "zeta live proof` => `running in ...`) -- still a list item, so a
 * check that only asked "is `script` an array" passed it -- and GitLab refused the whole file: the pipeline
 * `failed` with ZERO jobs (run 36860368378). `ciScriptProblems` is the check that would have caught it.
 */
export const PROOF_CI_YAML = [
  "# Written by gitlab-live-proof.ts. Deliberately NO `tags:` -- see PROOF_CI_YAML.",
  "stages: [test]",
  "zeta-live-proof:",
  "  stage: test",
  "  script:",
  "    - echo \"zeta live proof is running in $(hostname)\"",
  "    - head -n 2 /etc/os-release",
  "    - test -n \"$CI_JOB_ID\"",
  "",
].join("\n");

/** What is wrong with a `.gitlab-ci.yml`, as GitLab would read it: every `script` entry must be a STRING, and a tagged job is not the untagged case. */
export function ciScriptProblems(yamlText: string): readonly string[] {
  const problems: string[] = [];
  let doc: unknown;
  try {
    doc = parse(yamlText);
  } catch (e) {
    return [`not valid YAML: ${e instanceof Error ? e.message : String(e)}`];
  }
  if (doc === null || typeof doc !== "object") return ["the document is not a mapping"];
  for (const [name, job] of Object.entries(doc as Record<string, unknown>)) {
    if (name === "stages" || typeof job !== "object" || job === null) continue;
    const j = job as Record<string, unknown>;
    if (j["tags"] !== undefined) problems.push(`job ${name} carries tags`);
    const script = j["script"];
    if (!Array.isArray(script)) {
      problems.push(`job ${name}: script is not a list`);
      continue;
    }
    script.forEach((entry, i) => {
      if (typeof entry !== "string") problems.push(`job ${name}: script[${String(i)}] is a ${Array.isArray(entry) ? "list" : typeof entry}, not a string (an unquoted \`: \` makes it a mapping)`);
    });
  }
  return problems;
}

export type PipelineVerdict = "success" | "failed" | "pending";

export function pipelineVerdict(status: string): PipelineVerdict {
  if (status === "success") return "success";
  if (["failed", "canceled", "cancelled", "skipped", "manual"].includes(status)) return "failed";
  return "pending";
}

/** Does a job trace show the Kubernetes executor ran it? */
export function traceShowsKubernetesExecutor(trace: string): boolean {
  return /Using Kubernetes executor/i.test(trace);
}

/** The pod name the Kubernetes executor reports in the trace ("Running on runner-xxxx... via <host>"), or null. */
export function tracePodName(trace: string): string | null {
  const m = /Running on (runner-[a-z0-9-]+) via/.exec(trace);
  return m?.[1] ?? null;
}

export interface GatewayItem {
  readonly status?: {
    readonly addresses?: readonly { readonly type?: string; readonly value?: string }[];
    readonly conditions?: readonly { readonly type: string; readonly status: string; readonly reason?: string; readonly message?: string }[];
  };
}

export function gatewayProgrammedAt(gw: GatewayItem, address: string): { readonly ok: boolean; readonly detail: string } {
  const conds = gw.status?.conditions ?? [];
  const programmed = conds.find((c) => c.type === "Programmed");
  const accepted = conds.find((c) => c.type === "Accepted");
  const addrs = (gw.status?.addresses ?? []).map((a) => a.value ?? "");
  const detail = `Accepted=${accepted?.status ?? "?"} Programmed=${programmed?.status ?? "?"}${programmed?.status === "True" ? "" : ` (${programmed?.reason ?? "no condition"}: ${programmed?.message ?? ""})`} addresses=[${addrs.join(",")}] pinned=${address}`;
  return { ok: programmed?.status === "True" && accepted?.status === "True" && addrs.includes(address), detail };
}

export function routeAccepted(route: { readonly status?: { readonly parents?: readonly { readonly conditions?: readonly { readonly type: string; readonly status: string }[] }[] } }): boolean {
  const parents = route.status?.parents ?? [];
  return parents.length > 0 && parents.every((p) => (p.conditions ?? []).some((c) => c.type === "Accepted" && c.status === "True"));
}

// ------------------------------------------------------------------- IO ---

interface Run {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

function run(cmd: string, args: readonly string[], opts: { input?: string; timeoutMs?: number } = {}): Run {
  const p = Bun.spawnSync([cmd, ...args], {
    stdin: opts.input === undefined ? "ignore" : new TextEncoder().encode(opts.input),
    stdout: "pipe",
    stderr: "pipe",
    ...(opts.timeoutMs === undefined ? {} : { timeout: opts.timeoutMs }),
  });
  return { code: p.exitCode ?? -1, stdout: p.stdout.toString(), stderr: p.stderr.toString() };
}

function kubectl(args: readonly string[], opts: { input?: string; timeoutMs?: number } = {}): Run {
  return run("kubectl", args, { timeoutMs: 120_000, ...opts });
}

/** `kubectl get -o json`, or null when the call failed. A failed read is UNKNOWN, never an empty list. */
function kubectlJson<T>(args: readonly string[]): T | null {
  const r = kubectl([...args, "-o", "json"]);
  if (r.code !== 0) return null;
  try {
    return JSON.parse(r.stdout) as T;
  } catch {
    return null;
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Poll `probe` until it returns a value or the deadline passes. Returns the last probe's detail either way. */
async function pollUntil(
  deadlineMs: number,
  intervalMs: number,
  probe: () => Promise<{ done: boolean; detail: string }> | { done: boolean; detail: string },
): Promise<{ done: boolean; detail: string }> {
  let last = { done: false, detail: "never probed" };
  for (;;) {
    try {
      last = await probe();
    } catch (e) {
      last = { done: false, detail: `probe threw: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (last.done) return last;
    if (Date.now() + intervalMs > deadlineMs) return last;
    await sleep(intervalMs);
  }
}

/**
 * `kubectl port-forward` to the webservice Service (Workhorse, :8181): arbitrary methods AND headers, no
 * Gateway, no DNS, so (b)/(d)/(e) do not depend on (f).
 *
 * NOT `kubectl proxy`. The first run used it and measured the defect: the apiserver consumes the
 * `Authorization` header for ITS OWN authentication and does not forward it, so GitLab saw an anonymous
 * request -- `POST /oauth/token` returned a token and the next call, carrying it, was `401`. A port-forward
 * is a plain TCP tunnel to the pod and forwards every header untouched.
 */
class ApiForward {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private port = 0;

  private async open(): Promise<void> {
    this.proc?.kill();
    this.port = 18000 + Math.floor(Math.random() * 1000);
    this.proc = Bun.spawn(
      ["kubectl", "port-forward", "-n", GITLAB_NAMESPACE, "svc/gitlab-webservice-default", `${String(this.port)}:8181`, "--address", "127.0.0.1"],
      { stdout: "ignore", stderr: "ignore" },
    );
    const up = await pollUntil(Date.now() + 60_000, 1000, async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${String(this.port)}/users/sign_in`, { signal: AbortSignal.timeout(10_000) });
        return { done: r.status === 200, detail: `status ${String(r.status)}` };
      } catch (e) {
        return { done: false, detail: String(e) };
      }
    });
    if (!up.done) throw new Error(`port-forward to gitlab-webservice-default never answered: ${up.detail}`);
  }

  async start(): Promise<void> {
    await this.open();
  }

  stop(): void {
    this.proc?.kill();
  }

  async request(method: string, path: string, opts: { token?: string; form?: Record<string, string>; json?: unknown } = {}): Promise<{ status: number; text: string; json: unknown }> {
    const headers: Record<string, string> = {};
    let body: string | undefined;
    if (opts.token !== undefined) headers["Authorization"] = `Bearer ${opts.token}`;
    if (opts.form !== undefined) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(opts.form).toString();
    } else if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const send = (): Promise<Response> =>
      fetch(`http://127.0.0.1:${String(this.port)}${path}`, { method, headers, ...(body === undefined ? {} : { body }), signal: AbortSignal.timeout(60_000) });
    let r: Response;
    try {
      r = await send();
    } catch {
      // A port-forward dies when the pod behind it is replaced; re-open once and retry.
      await this.open();
      r = await send();
    }
    const text = await r.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: r.status, text, json };
  }
}

function log(msg: string): void {
  console.log(`[gitlab-live-proof ${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

export interface ProofOptions {
  readonly clusterName: string;
  readonly gitRef: string;
  readonly existing: boolean;
  /** Seconds to wait for the five components to be Ready, measured from the Application being applied. */
  readonly readySec: number;
  /** Seconds each of the later phases (token, runner, pipeline) may take once its prerequisite passed. */
  readonly phaseSec: number;
  readonly soakSec: number;
  readonly reportPath: string | null;
  readonly summaryPath: string | null;
}

function snapshotLine(): string {
  const pods = kubectlJson<{ items: PodItem[] }>(["get", "pods", "-n", GITLAB_NAMESPACE]);
  if (pods === null) return "pods: <unreadable>";
  return pods.items
    .map((p) => `${p.metadata.name}:${p.status?.phase ?? "?"}${podReady(p) ? "+ready" : ""}${totalRestarts(p) > 0 ? ` r=${String(totalRestarts(p))}` : ""}`)
    .join(" ");
}

/** metrics-server chart, pinned to the app version k3s vendors (`k8s/bootstrap/k3s-metrics-server.yaml`: v0.9.0). */
export const METRICS_SERVER_CHART = { repo: "https://kubernetes-sigs.github.io/metrics-server/", chart: "metrics-server/metrics-server", version: "3.14.0" } as const;

/**
 * The resource-metrics API a k3s node ships and a kind node does not.
 *
 * GitLab's chart renders HorizontalPodAutoscalers for webservice, sidekiq, registry and gitlab-shell. With no
 * `metrics.k8s.io` backend each reports `ScalingActive=False` (FailedGetResourceMetric), which ArgoCD reads as a
 * DEGRADED resource -- and a Degraded resource in sync-wave 0 holds back every later wave. That is the runner
 * token Job (wave 5) and the runner Deployment (wave 10), so without this the runner is never even created.
 * Metal does not have the problem: k3s packages metrics-server (`k8s/bootstrap/k3s-metrics-server.yaml`). The
 * kind lane is the substrate that was missing it, and `--kubelet-insecure-tls` is the kind-only departure
 * (kubelet serving certs on kind are self-signed).
 */
function installMetricsApi(): string {
  const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
  if (!ports.packages.releaseInstalled("kube-system", "metrics-server")) {
    ports.packages.addRepo("metrics-server", METRICS_SERVER_CHART.repo);
    ports.packages.updateRepo("metrics-server");
    ports.packages.install({
      release: "metrics-server",
      chart: METRICS_SERVER_CHART.chart,
      version: METRICS_SERVER_CHART.version,
      namespace: "kube-system",
      setValues: ["args[0]=--kubelet-insecure-tls"],
      wait: true,
    });
  }
  const avail = kubectl(["wait", "--for=condition=Available", "--timeout=180s", "apiservice/v1beta1.metrics.k8s.io"]);
  return avail.code === 0 ? "metrics.k8s.io Available (metrics-server, as k3s ships it on metal)" : `metrics.k8s.io NOT Available: ${avail.stderr.trim().slice(0, 160)}`;
}

/** What ArgoCD thinks of the gitlab Application, in enough detail to name the resource that holds a sync. */
export function describeArgoApplication(app: ArgoApp | null): readonly string[] {
  if (app === null) return ["application gitlab: <unreadable>"];
  const out: string[] = [`application gitlab: sync=${app.status?.sync?.status ?? "?"} health=${app.status?.health?.status ?? "?"}`];
  const op = app.status?.operationState;
  if (op !== undefined) out.push(`  operation: phase=${op.phase ?? "?"} message=${(op.message ?? "").slice(0, 400)}`);
  for (const c of app.status?.conditions ?? []) out.push(`  condition ${c.type}: ${(c.message ?? "").slice(0, 400)}`);
  for (const r of op?.syncResult?.resources ?? []) {
    if (r.status !== "Synced" || (r.message ?? "") !== "" && !/created|configured|unchanged/.test(r.message ?? "")) {
      out.push(`  syncResult ${r.kind}/${r.name}: ${r.status ?? "?"} ${r.hookPhase ?? ""} ${(r.message ?? "").slice(0, 300)}`);
    }
  }
  for (const r of app.status?.resources ?? []) {
    const healthy = (r.health?.status ?? "Healthy") === "Healthy";
    if (r.status !== "Synced" || !healthy) {
      out.push(`  resource ${r.kind}/${r.name}: sync=${r.status ?? "-"} health=${r.health?.status ?? "-"} ${(r.health?.message ?? "").slice(0, 300)}`);
    }
  }
  return out;
}

export interface ArgoApp {
  readonly status?: {
    readonly sync?: { readonly status?: string };
    readonly health?: { readonly status?: string };
    readonly conditions?: readonly { readonly type: string; readonly message?: string }[];
    readonly operationState?: {
      readonly phase?: string;
      readonly message?: string;
      readonly syncResult?: { readonly resources?: readonly { readonly kind?: string; readonly name?: string; readonly status?: string; readonly hookPhase?: string; readonly message?: string }[] };
    };
    readonly resources?: readonly { readonly kind?: string; readonly name?: string; readonly status?: string; readonly health?: { readonly status?: string; readonly message?: string } }[];
  };
}

function dumpArgoState(): void {
  const app = kubectlJson<ArgoApp>(["get", "application.argoproj.io/gitlab", "-n", "argocd"]);
  for (const line of describeArgoApplication(app)) log(line);
  const hpas = kubectlJson<{ items: { metadata: { name: string }; status?: { conditions?: { type: string; status: string; reason?: string; message?: string }[] } }[] }>(["get", "hpa", "-n", GITLAB_NAMESPACE]);
  for (const h of hpas?.items ?? []) {
    log(`  hpa ${h.metadata.name}: ${(h.status?.conditions ?? []).map((c) => `${c.type}=${c.status}${c.status === "True" ? "" : `(${c.reason ?? ""})`}`).join(" ")}`);
  }
}

async function runProof(opts: ProofOptions, report: ProofReport): Promise<void> {
  const address = kindPoolLanAddress(readFileSync(join(REPO_ROOT, KIND_LB_POOL_MANIFEST_PATH), "utf8"));
  const patch = installTimeGitlabPatch(readFileSync(join(REPO_ROOT, INSTALL_TIME_LB_APPLICATION_PATH), "utf8"), address);
  const application = buildGitlabLaneApplication(readFileSync(join(REPO_ROOT, GITLAB_APPLICATION_PATH), "utf8"), patch, address);
  log(`lane LAN address (last address of the kind LB pool, as the installer pins it): ${address}`);

  if (!opts.existing) {
    const laneTree = buildLaneTreeForProfile("dev", opts.gitRef);
    log("bringing up kind + shipped Cilium + ArgoCD + the dev-rung tree (root catalogue = seaweedfs only) ...");
    bootstrapKindClusterInProcess({
      configPath: defaultKindCiliumConfigPath(),
      clusterName: opts.clusterName,
      gitRef: opts.gitRef,
      containerRuntime: "docker",
      cni: "cilium",
      ...(laneTree === null ? {} : { laneTree }),
      laneDirs: LANE_ROOT_DIRS,
    });
  } else {
    kubectl(["config", "use-context", `kind-${opts.clusterName}`]);
  }

  const metrics = installMetricsApi();
  log(metrics);

  log("applying the gitlab Application (committed manifest + install-time address pin) ...");
  const applied = kubectl(["apply", "-n", "argocd", "-f", "-"], { input: application });
  if (applied.code !== 0) {
    report.record("a0-lane-up", "failed", `could not apply the gitlab Application: ${applied.stderr.trim().slice(0, 300)}`);
    return;
  }
  report.record("a0-lane-up", "passed", `cluster ${opts.clusterName} up; ${metrics}; gitlab Application applied with LAN address ${address}`);

  const appliedAt = Date.now();
  const readyDeadline = appliedAt + opts.readySec * 1000;

  // ---- (a) components Ready -------------------------------------------------------------------
  const comps: readonly [string, string][] = [
    ["a1-webservice-ready", COMPONENT_LABELS.webservice],
    ["a2-sidekiq-ready", COMPONENT_LABELS.sidekiq],
    ["a3-gitaly-ready", COMPONENT_LABELS.gitaly],
    ["a4-registry-ready", COMPONENT_LABELS.registry],
    ["a5-shell-ready", COMPONENT_LABELS.shell],
  ];
  const pending = new Map<string, string>(comps);
  const lastDetail = new Map<string, string>();
  let tick = 0;
  await pollUntil(readyDeadline, 15_000, () => {
    const items = kubectlJson<{ items: WorkloadItem[] }>(["get", "deploy,sts", "-n", GITLAB_NAMESPACE]);
    for (const [id, label] of [...pending]) {
      if (items === null) {
        lastDetail.set(id, "kubectl get deploy,sts failed (unknown)");
        continue;
      }
      const r = componentReadiness(items.items, label);
      lastDetail.set(id, r.detail);
      if (r.ready) {
        report.record(id, "passed", r.detail);
        pending.delete(id);
        log(`${id} PASSED after ${String(Math.round((Date.now() - appliedAt) / 1000))}s: ${r.detail}`);
      }
    }
    if (tick % 4 === 0) log(`waiting on ${[...pending.keys()].join(",") || "nothing"} | ${snapshotLine()}`);
    if (tick % 16 === 8) dumpArgoState();
    tick++;
    return { done: pending.size === 0, detail: "" };
  });
  for (const [id] of pending) report.record(id, "failed", `not Ready within ${String(opts.readySec)}s: ${lastDetail.get(id) ?? "no observation"}`);

  // ---- (f1) Gateway --------------------------------------------------------------------------
  {
    const r = await pollUntil(Date.now() + opts.phaseSec * 1000, 10_000, () => {
      const gw = kubectlJson<GatewayItem>(["get", "gateway.gateway.networking.k8s.io/gitlab-lan", "-n", GITLAB_NAMESPACE]);
      if (gw === null) return { done: false, detail: "Gateway gitlab-lan not readable" };
      const g = gatewayProgrammedAt(gw, address);
      const routes = kubectlJson<{ items: { metadata: { name: string }; status?: { parents?: { conditions?: { type: string; status: string }[] }[] } }[] }>(["get", "httproute.gateway.networking.k8s.io", "-n", GITLAB_NAMESPACE]);
      const names = (routes?.items ?? []).map((i) => `${i.metadata.name}:${routeAccepted(i) ? "Accepted" : "NOT-accepted"}`);
      const accepted = routes !== null && routes.items.length >= 2 && routes.items.every(routeAccepted);
      return { done: g.ok && accepted, detail: `${g.detail}; routes=[${names.join(",")}]` };
    });
    report.record("f1-gateway-programmed", r.done ? "passed" : "failed", r.detail);
  }

  // ---- shared API proxy -----------------------------------------------------------------------
  const proxy = new ApiForward();
  let accessToken: string | null = null;
  try {
    // Only worth opening when the webservice is Ready: a forward to a Service with no ready pod would
    // throw here and take (f2)/(f3), which do not need it, down with it.
    let forwardError: string | null = null;
    if (report.statusOf("a1-webservice-ready") === "passed") {
      try {
        await proxy.start();
      } catch (e) {
        forwardError = e instanceof Error ? e.message : String(e);
        log(`the API forward did not open: ${forwardError}`);
      }
    }
    if (forwardError !== null) report.record("b1-root-login", "failed", `no route to the GitLab API from the runner host: ${forwardError}`);

    // ---- (b) root login ----------------------------------------------------------------------
    if (report.statusOf("b1-root-login") === "unrecorded" && report.blockedBy("b1-root-login") === null) {
      const secret = kubectlJson<{ data?: Record<string, string> }>(["get", "secret", ROOT_PASSWORD_SECRET, "-n", GITLAB_NAMESPACE]);
      const pw = secret?.data?.["password"] === undefined ? null : Buffer.from(secret.data["password"], "base64").toString("utf8");
      if (pw === null) {
        report.record("b1-root-login", "failed", `Secret ${ROOT_PASSWORD_SECRET} is missing or has no password key`);
      } else {
        const r = await pollUntil(Date.now() + opts.phaseSec * 1000, 15_000, async () => {
          const t = await proxy.request("POST", "/oauth/token", { form: { grant_type: "password", username: "root", password: pw } });
          const token = (t.json as { access_token?: string } | null)?.access_token;
          if (t.status !== 200 || token === undefined) return { done: false, detail: `POST /oauth/token -> ${String(t.status)} ${t.text.slice(0, 160)}` };
          const u = await proxy.request("GET", "/api/v4/user", { token });
          const me = u.json as { username?: string; is_admin?: boolean; admin?: boolean } | null;
          if (u.status !== 200 || me?.username !== "root") return { done: false, detail: `GET /api/v4/user -> ${String(u.status)} ${u.text.slice(0, 160)}` };
          if (me.is_admin !== true && me.admin !== true) return { done: false, detail: "logged in as root but the account is not an administrator" };
          accessToken = token;
          return { done: true, detail: "OAuth password grant accepted; GET /api/v4/user => root, is_admin" };
        });
        report.record("b1-root-login", r.done ? "passed" : "failed", r.detail);
      }
    }

    // ---- (c) token job + secret --------------------------------------------------------------
    if (report.blockedBy("c1-token-job-complete") === null) {
      const r = await pollUntil(Date.now() + opts.phaseSec * 1000, 15_000, () => {
        const job = kubectlJson<JobItem>(["get", `job/${RUNNER_TOKEN_JOB}`, "-n", GITLAB_NAMESPACE]);
        if (job === null) return { done: false, detail: `Job ${RUNNER_TOKEN_JOB} does not exist (ArgoCD runs it as a wave-5 Sync hook after wave 0 is Healthy)` };
        return { done: jobComplete(job), detail: `Job ${RUNNER_TOKEN_JOB} succeeded=${String(job.status?.succeeded ?? 0)} failed=${String(job.status?.failed ?? 0)}` };
      });
      report.record("c1-token-job-complete", r.done ? "passed" : "failed", r.detail);
      if (!r.done) dumpArgoState();
    }
    if (report.blockedBy("c2-runner-secret-token") === null) {
      const secret = kubectlJson<{ data?: Record<string, string> }>(["get", "secret", RUNNER_SECRET, "-n", GITLAB_NAMESPACE]);
      const tok = runnerTokenPrefix(secret?.data?.["runner-token"]);
      const logs = kubectl(["logs", `job/${RUNNER_TOKEN_JOB}`, "-n", GITLAB_NAMESPACE, "--tail=15"]);
      const logTail = logs.stdout.split("\n").filter((l) => !/glrt-/.test(l)).slice(-4).join(" / ");
      report.record("c2-runner-secret-token", tok.isAuthToken ? "passed" : "failed", `runner-token in ${RUNNER_SECRET}: ${tok.shown}; job log tail: ${logTail}`);
    }

    // ---- (d1) runner pod ---------------------------------------------------------------------
    let runnerPodName: string | null = null;
    if (report.blockedBy("d1-runner-pod-running") === null) {
      const r = await pollUntil(Date.now() + opts.phaseSec * 1000, 10_000, () => {
        const pods = kubectlJson<{ items: PodItem[] }>(["get", "pods", "-n", GITLAB_NAMESPACE, "-l", "app=gitlab-gitlab-runner"]);
        const pod = pods?.items.find((p) => !p.metadata.name.startsWith("runner-"));
        if (pod === undefined) return { done: false, detail: "no pod labelled app=gitlab-gitlab-runner" };
        runnerPodName = pod.metadata.name;
        return { done: podReady(pod), detail: `${pod.metadata.name} phase=${pod.status?.phase ?? "?"} ready=${String(podReady(pod))} restarts=${String(totalRestarts(pod))}` };
      });
      report.record("d1-runner-pod-running", r.done ? "passed" : "failed", r.detail);
    }

    // ---- (d2) runner online per API ----------------------------------------------------------
    let runnerId: number | null = null;
    if (report.blockedBy("d2-runner-api-online") === null && accessToken !== null) {
      const token = accessToken;
      const r = await pollUntil(Date.now() + opts.phaseSec * 1000, 10_000, async () => {
        const res = await proxy.request("GET", "/api/v4/runners/all?per_page=100", { token });
        if (res.status !== 200 || !Array.isArray(res.json)) return { done: false, detail: `GET /runners/all -> ${String(res.status)} ${res.text.slice(0, 160)}` };
        const list = res.json as ApiRunner[];
        const o = runnerOnline(list, RUNNER_DESCRIPTION);
        if (!o.online) return { done: false, detail: o.detail };
        runnerId = list.find((x) => x.description === RUNNER_DESCRIPTION)?.id ?? null;
        // The LIST endpoint omits run_untagged and tag_list; the single-runner endpoint carries them. An
        // online runner that refuses untagged jobs is the failure #17737 fixed, and it reads as healthy.
        const one = await proxy.request("GET", `/api/v4/runners/${String(runnerId)}`, { token });
        const full = one.json as ApiRunner | null;
        if (one.status !== 200 || full === null) return { done: false, detail: `${o.detail}; GET /runners/${String(runnerId)} -> ${String(one.status)}` };
        const detail = runnerOnline([full], RUNNER_DESCRIPTION).detail;
        return { done: true, detail: full.run_untagged === true ? detail : `${detail}; BUT it does not take untagged jobs` };
      });
      report.record("d2-runner-api-online", r.done && r.detail.includes("run_untagged=true") ? "passed" : "failed", r.detail);
    }

    // ---- (e) pipeline ------------------------------------------------------------------------
    if (report.blockedBy("e1-pipeline-success") === null && accessToken !== null) {
      const token = accessToken;
      const name = `zeta-live-proof-${String(Date.now())}`;
      const created = await proxy.request("POST", "/api/v4/projects", { token, json: { name, visibility: "private", initialize_with_readme: true, default_branch: "main" } });
      const projectId = (created.json as { id?: number } | null)?.id;
      if (created.status !== 201 || projectId === undefined) {
        report.record("e1-pipeline-success", "failed", `POST /projects -> ${String(created.status)} ${created.text.slice(0, 200)}`);
      } else {
        // Gitaly may still be settling: retry the file commit rather than blame the pipeline.
        const commit = await pollUntil(Date.now() + 5 * 60_000, 10_000, async () => {
          const res = await proxy.request("POST", `/api/v4/projects/${String(projectId)}/repository/files/${encodeURIComponent(".gitlab-ci.yml")}`, {
            token,
            json: { branch: "main", content: PROOF_CI_YAML, commit_message: "add untagged pipeline" },
          });
          return { done: res.status === 201, detail: `POST repository/files -> ${String(res.status)} ${res.text.slice(0, 160)}` };
        });
        if (!commit.done) {
          report.record("e1-pipeline-success", "failed", `could not commit .gitlab-ci.yml: ${commit.detail}`);
        } else {
          let lastJobs = "";
          const pipe = await pollUntil(Date.now() + opts.phaseSec * 1000, 10_000, async () => {
            const res = await proxy.request("GET", `/api/v4/projects/${String(projectId)}/pipelines`, { token });
            const list = Array.isArray(res.json) ? (res.json as { id: number; status: string }[]) : [];
            const p = list[0];
            if (p === undefined) return { done: false, detail: "no pipeline exists yet for the commit" };
            const jobs = await proxy.request("GET", `/api/v4/projects/${String(projectId)}/pipelines/${String(p.id)}/jobs`, { token });
            lastJobs = Array.isArray(jobs.json) ? (jobs.json as { id: number; status: string; stuck?: boolean }[]).map((j) => `job ${String(j.id)}:${j.status}${j.stuck === true ? "(stuck)" : ""}`).join(",") : "";
            const v = pipelineVerdict(p.status);
            if (v === "failed") {
              // Say WHY: GitLab's own account (yaml_errors / failure_reason) and the tail of every failed job.
              const det = await proxy.request("GET", `/api/v4/projects/${String(projectId)}/pipelines/${String(p.id)}`, { token });
              const d = det.json as { yaml_errors?: string; detailed_status?: { text?: string } } | null;
              const why = `yaml_errors=${d?.yaml_errors ?? "none"} status=${d?.detailed_status?.text ?? "?"}`;
              const traces: string[] = [];
              for (const j of Array.isArray(jobs.json) ? (jobs.json as { id: number; status: string; failure_reason?: string }[]) : []) {
                if (j.status !== "failed") continue;
                const t = await proxy.request("GET", `/api/v4/projects/${String(projectId)}/jobs/${String(j.id)}/trace`, { token });
                traces.push(`job ${String(j.id)} failure_reason=${j.failure_reason ?? "?"}: ${t.text.split("\n").filter((l) => l.trim() !== "").slice(-6).join(" / ").slice(0, 600)}`);
              }
              return { done: true, detail: `pipeline ${String(p.id)} ended ${p.status}; ${why}; ${lastJobs}${traces.length === 0 ? "" : ` | ${traces.join(" | ")}`}` };
            }
            return { done: v === "success", detail: `pipeline ${String(p.id)} ${p.status}; ${lastJobs}` };
          });
          const passed = pipe.done && /pipeline \d+ success/.test(pipe.detail);
          report.record("e1-pipeline-success", passed ? "passed" : "failed", pipe.detail);
          if (passed) {
            const jobsRes = await proxy.request("GET", `/api/v4/projects/${String(projectId)}/jobs`, { token });
            const job = Array.isArray(jobsRes.json) ? (jobsRes.json as { id: number; runner?: { description?: string } }[])[0] : undefined;
            if (job === undefined) {
              report.record("e2-kubernetes-executor-pod", "failed", "the pipeline succeeded but the project lists no job");
            } else {
              const tr = await proxy.request("GET", `/api/v4/projects/${String(projectId)}/jobs/${String(job.id)}/trace`, { token });
              const k8s = traceShowsKubernetesExecutor(tr.text);
              const pod = tracePodName(tr.text);
              const runnerName = job.runner?.description ?? "<none>";
              report.record(
                "e2-kubernetes-executor-pod",
                k8s && runnerName === RUNNER_DESCRIPTION ? "passed" : "failed",
                `job ${String(job.id)} runner=${runnerName} kubernetesExecutor=${String(k8s)} pod=${pod ?? "<not in trace>"}`,
              );
            }
          }
        }
      }
    }

    // ---- (d3) crash-loop check, after the work and a soak ------------------------------------
    if (report.blockedBy("d3-runner-not-crash-looping") === null) {
      log(`soaking ${String(opts.soakSec)}s before judging the runner for restarts ...`);
      await sleep(opts.soakSec * 1000);
      const pods = kubectlJson<{ items: PodItem[] }>(["get", "pods", "-n", GITLAB_NAMESPACE, "-l", "app=gitlab-gitlab-runner"]);
      const pod = pods?.items.find((p) => p.metadata.name === runnerPodName) ?? pods?.items.find((p) => !p.metadata.name.startsWith("runner-"));
      if (pod === undefined) report.record("d3-runner-not-crash-looping", "failed", "the runner pod is gone (unknown restarts)");
      else report.record("d3-runner-not-crash-looping", totalRestarts(pod) === 0 && podReady(pod) ? "passed" : "failed", `${pod.metadata.name} restarts=${String(totalRestarts(pod))} ready=${String(podReady(pod))} after ${String(opts.soakSec)}s soak`);
    }
    void runnerId;
  } finally {
    proxy.stop();
  }

  // ---- (f2)/(f3) from the runner host, i.e. outside the pod network ----------------------------
  if (report.blockedBy("f2-external-url-from-host") === null) {
    const net = run("docker", ["network", "inspect", "kind", "--format", "{{range .IPAM.Config}}{{.Subnet}} {{end}}"]);
    log(`docker network kind subnets: ${net.stdout.trim() || "<unreadable>"}`);
    const r = await pollUntil(Date.now() + opts.phaseSec * 1000, 10_000, () => {
      const c = run("curl", ["-sS", "-o", "/dev/null", "-D", "-", "--max-time", "15", `http://${address}/`]);
      if (c.code !== 0) return { done: false, detail: `curl http://${address}/ failed (exit ${String(c.code)}): ${c.stderr.trim().slice(0, 200)}; kind subnets: ${net.stdout.trim()}` };
      const status = /^HTTP\/[\d.]+ (\d+)/m.exec(c.stdout)?.[1] ?? "?";
      const loc = /^location:\s*(\S+)/im.exec(c.stdout)?.[1] ?? "<none>";
      // GitLab redirects an anonymous GET / to its own sign-in URL, built from the external host.
      const ok = (status === "302" || status === "200") && (status === "200" || loc.includes(address));
      return { done: ok, detail: `GET http://${address}/ -> ${status} Location=${loc}` };
    });
    report.record("f2-external-url-from-host", r.done ? "passed" : "failed", r.detail);
  }
  if (report.blockedBy("f3-registry-route-from-host") === null) {
    const r = await pollUntil(Date.now() + opts.phaseSec * 1000, 10_000, () => {
      const c = run("curl", ["-sS", "-o", "/dev/null", "-D", "-", "--max-time", "15", `http://${address}/v2/`]);
      if (c.code !== 0) return { done: false, detail: `curl http://${address}/v2/ failed (exit ${String(c.code)}): ${c.stderr.trim().slice(0, 200)}` };
      const status = /^HTTP\/[\d.]+ (\d+)/m.exec(c.stdout)?.[1] ?? "?";
      const dist = /^docker-distribution-api-version:\s*(\S+)/im.exec(c.stdout)?.[1] ?? "<absent>";
      // GitLab itself serves nothing under /v2/, so a 401 carrying the distribution header is the REGISTRY.
      return { done: status === "401" && dist !== "<absent>", detail: `GET http://${address}/v2/ -> ${status} docker-distribution-api-version=${dist}` };
    });
    report.record("f3-registry-route-from-host", r.done ? "passed" : "failed", r.detail);
  }

  // ---- (a+) ArgoCD's own verdict, judged LAST (informational) ----------------------------------
  // The runner Deployment (wave 10) and the token Job (wave 5) only exist after wave 0 is Healthy, so
  // judging the Application any earlier would read a sync that is simply not finished.
  {
    dumpArgoState();
    const app = kubectlJson<ArgoApp>(["get", "application.argoproj.io/gitlab", "-n", "argocd"]);
    const sync = app?.status?.sync?.status ?? "unreadable";
    const health = app?.status?.health?.status ?? "unreadable";
    const held = describeArgoApplication(app).filter((l) => l.startsWith("  resource ")).slice(0, 3).map((l) => l.trim()).join(" ; ");
    report.record("a6-argocd-application", sync === "Synced" && health === "Healthy" ? "passed" : "failed", `sync=${sync} health=${health}${held === "" ? "" : ` | ${held}`}`);
  }
}

// ------------------------------------------------------------------ CLI ---

function parseArgs(argv: readonly string[]): { mode: "run" | "dry-run" | "diagnose"; opts: ProofOptions } | string {
  let mode: "run" | "dry-run" | "diagnose" | null = null;
  const o = {
    clusterName: "zeta-ci-gitlab",
    gitRef: "main",
    existing: false,
    readySec: 2700,
    phaseSec: 900,
    soakSec: 120,
    reportPath: null as string | null,
    summaryPath: null as string | null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = (): string => {
      const n = argv[++i];
      if (n === undefined) throw new Error(`${a} needs a value`);
      return n;
    };
    try {
      if (a === "--run") mode = "run";
      else if (a === "--dry-run") mode = "dry-run";
      else if (a === "--diagnose") mode = "diagnose";
      else if (a === "--existing") o.existing = true;
      else if (a === "--cluster-name") o.clusterName = v();
      else if (a === "--git-ref") o.gitRef = v();
      else if (a === "--ready-sec") o.readySec = Number(v());
      else if (a === "--phase-sec") o.phaseSec = Number(v());
      else if (a === "--soak-sec") o.soakSec = Number(v());
      else if (a === "--report") o.reportPath = v();
      else if (a === "--summary") o.summaryPath = v();
      else return `unknown argument: ${String(a)}`;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }
  if (mode === null) return "usage: gitlab-live-proof.ts --run|--dry-run|--diagnose [--cluster-name N] [--git-ref REF] [--existing] [--ready-sec N] [--phase-sec N] [--soak-sec N] [--report FILE] [--summary FILE]";
  for (const [k, n] of [["--ready-sec", o.readySec], ["--phase-sec", o.phaseSec], ["--soak-sec", o.soakSec]] as const) {
    if (!Number.isFinite(n) || n < 0) return `${k} must be a non-negative number`;
  }
  return { mode, opts: o };
}

if (import.meta.main) {
  const parsed = parseArgs(process.argv.slice(2));
  if (typeof parsed === "string") {
    console.error(parsed);
    process.exit(2);
  }
  if (parsed.mode === "diagnose") {
    // Read-only: what ArgoCD thinks of the gitlab Application and what every HPA reports. For a failed lane.
    dumpArgoState();
    process.exit(0);
  }
  if (parsed.mode === "dry-run") {
    const address = kindPoolLanAddress(readFileSync(join(REPO_ROOT, KIND_LB_POOL_MANIFEST_PATH), "utf8"));
    const patch = installTimeGitlabPatch(readFileSync(join(REPO_ROOT, INSTALL_TIME_LB_APPLICATION_PATH), "utf8"), address);
    const app = buildGitlabLaneApplication(readFileSync(join(REPO_ROOT, GITLAB_APPLICATION_PATH), "utf8"), patch, address);
    console.log(`lane address ${address}; rendered Application ${String(app.length)} bytes; ${String(CHECKS.length)} checks:`);
    for (const c of CHECKS) console.log(`  ${c.id}${c.blocking ? "" : " (informational)"} <- [${c.dependsOn.join(", ")}]`);
    process.exit(0);
  }
  const t0 = Date.now();
  const opts = parsed.opts;
  const report = new ProofReport();
  try {
    await runProof(opts, report);
  } catch (e) {
    // A thrown exception is not a verdict about GitLab: the LANE broke. Say so on the lane check, and
    // every check the run never reached resolves to `did-not-run`, never `passed`.
    if (report.statusOf("a0-lane-up") === "unrecorded") {
      report.record("a0-lane-up", "failed", `the lane failed before GitLab could be judged: ${e instanceof Error ? e.message : String(e)}`);
    } else {
      console.error(`[gitlab-live-proof] the run threw after the lane came up: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    }
  }
  const md = report.toMarkdown([`\nWall time ${String(Math.round((Date.now() - t0) / 1000))}s.`]);
  console.log("\n" + md);
  if (opts.reportPath !== null) writeFileSync(opts.reportPath, JSON.stringify(report.toJSON(), null, 2));
  if (opts.summaryPath !== null) appendFileSync(opts.summaryPath, md);
  process.exit(report.verdictPassed() ? 0 : 1);
}
