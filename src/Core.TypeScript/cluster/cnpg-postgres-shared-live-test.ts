#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/cnpg-postgres-shared-live-test.ts
 *
 * DOES `postgres-shared` ACTUALLY WORK -- under ArgoCD, with the real plugin, the
 * real object store, and a real backup?
 *
 * -- THE GAP THIS CLOSES ---------------------------------------------------
 * `postgres-shared`, `cnpg-barman-cloud` and `temporal/postgres` are deferred from
 * the `included` lane (argocd-health-test.ts, `DEV_EXCLUDED_REASONS`), so nothing
 * in CI had ever applied a CloudNativePG `Cluster` that archives through the Barman
 * Cloud plugin. The first thing that ran one was the owner's USB ISO (WP11,
 * run 36832486494): `postgres-shared` read `sync=OutOfSync health=Unknown` for
 * 3000 seconds. Every static check was green. This lane is the first execution.
 *
 * -- WHAT IT RUNS, AND WHY IT IS ARGOCD-DRIVEN ------------------------------
 * The owner's symptom is an ARGOCD verdict (OutOfSync/Unknown), so applying the
 * manifests with `kubectl` would prove the wrong thing: a Cluster that is healthy
 * when kubectl applies it can still read Unknown to ArgoCD, because ArgoCD's
 * built-in CNPG health script maps only the phases it knows. So the Applications
 * here are the tree's OWN `Application.yaml` files, with exactly two fields
 * rewritten -- `repoURL` / `targetRevision` of the ones that point at this
 * repository, so the run tests the commit it was dispatched from rather than
 * `main` -- and ArgoCD syncs them, in the sync-wave order the root would.
 *
 *   bootstrap (HelmChart CRs, the SAME pins k3s installs at first boot):
 *     cert-manager, argocd
 *   seeding: bootstrap/internal-secret-seeding.yaml, the real first-boot Job
 *   Applications, in wave order, each waited to Synced+Healthy:
 *     cloudnativepg (-70) -> cnpg-barman-cloud (-65) -> seaweedfs (-5) -> postgres-shared (5)
 *   prerequisite CRDs that other Applications provide in the real tree:
 *     the PodMonitor CRD (kube-prometheus-stack, wave 0) via prometheus-operator-crds
 *
 * -- WHAT IT ASSERTS --------------------------------------------------------
 *   1. Application postgres-shared reaches Synced AND Healthy (the owner's symptom)
 *   2. the Cluster's phase is "Cluster in healthy state" and every instance is ready
 *   3. a row written through the `-rw` Service reads back on a SECOND connection,
 *      authenticated with the operator-minted `postgres-shared-app` Secret
 *   4. the Cluster's ContinuousArchiving condition is True
 *   5. the immediate base Backup the ScheduledBackup requests reaches `completed`
 *   6. the bucket really holds a base backup and WAL under the Barman layout, read
 *      with the SAME credential the Postgres pods hold -- and that credential cannot
 *      read another bucket (the `pgBackup` identity's scope is real, not declared)
 *
 * NOT PROVEN HERE: node loss (one node), the nested-virt or LB paths, anything about
 * the 4-vCPU/12-GiB ISO guest's resource pressure -- this runs on a 4-vCPU/16-GiB
 * hosted runner with nothing else on it.
 *
 * SAFETY: every kubectl/helm call names `--context kind-<cluster>` explicitly and the
 * script refuses a cluster name that does not start with `zeta-ci-`. A developer
 * laptop's current kube-context is never consulted, so this can never act on it.
 *
 * Exit codes: 0 everything proved, 1 an assertion failed, 2 usage / refusal.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const K8S = join(REPO_ROOT, "full-ai-cluster/k8s");
const ZETA_REPO_MARKER = "Lucent-Financial-Group/Zeta";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in cnpg-postgres-shared-live-test.test.ts)
// ---------------------------------------------------------------------------

type Doc = Record<string, any>;

/**
 * Re-point an Application at the commit under test. ONLY a source that names this
 * repository is touched; a chart source (cloudnativepg's helm repo, seaweedfs's) is
 * returned byte-for-byte as the tree ships it, because rewriting those would test a
 * different manifest than the one the owner's ISO syncs.
 */
export function pinApplicationToRef(applicationYamlText: string, repoUrl: string, gitRef: string): Doc {
  const app = parseYaml(applicationYamlText) as Doc;
  const source = app?.spec?.source;
  if (source === undefined || source === null) throw new Error("Application has no spec.source");
  if (typeof source.repoURL === "string" && source.repoURL.includes(ZETA_REPO_MARKER)) {
    source.repoURL = repoUrl;
    source.targetRevision = gitRef;
  }
  return app;
}

export interface HelmChartCr {
  readonly name: string;
  readonly chart: string;
  readonly repo: string;
  readonly version: string;
  readonly namespace: string;
  readonly values: string;
}

/** Read a k3s `HelmChart` CR (the form the bootstrap installs use) into helm arguments. */
export function parseHelmChartCr(text: string): HelmChartCr {
  const doc = parseYaml(text) as Doc;
  if (doc?.kind !== "HelmChart") throw new Error(`expected kind HelmChart, got ${String(doc?.kind)}`);
  const spec = doc.spec ?? {};
  for (const key of ["chart", "repo", "version", "targetNamespace"] as const) {
    if (typeof spec[key] !== "string" || spec[key] === "") throw new Error(`HelmChart ${doc.metadata?.name}: spec.${key} missing`);
  }
  return {
    name: String(doc.metadata.name),
    chart: spec.chart,
    repo: spec.repo,
    version: spec.version,
    namespace: spec.targetNamespace,
    values: typeof spec.valuesContent === "string" ? spec.valuesContent : "",
  };
}

export interface ApplicationState {
  readonly sync: string;
  readonly health: string;
  readonly operation: string;
  readonly conditions: readonly string[];
}

export function readApplicationState(app: Doc): ApplicationState {
  return {
    sync: String(app?.status?.sync?.status ?? "?"),
    health: String(app?.status?.health?.status ?? "?"),
    operation: String(app?.status?.operationState?.phase ?? "none"),
    conditions: ((app?.status?.conditions ?? []) as Doc[]).map((c) => `${c.type}: ${String(c.message ?? "").slice(0, 300)}`),
  };
}

export function isSyncedAndHealthy(state: ApplicationState): boolean {
  return state.sync === "Synced" && state.health === "Healthy";
}

/** "Cluster in healthy state" AND every requested instance ready -- phase alone is not enough. */
export function clusterIsHealthy(cluster: Doc): { ok: boolean; why: string } {
  const phase = String(cluster?.status?.phase ?? "");
  const want = Number(cluster?.spec?.instances ?? 0);
  const ready = Number(cluster?.status?.readyInstances ?? 0);
  if (phase !== "Cluster in healthy state") return { ok: false, why: `phase=${JSON.stringify(phase)} reason=${JSON.stringify(cluster?.status?.phaseReason ?? "")}` };
  if (want === 0 || ready !== want) return { ok: false, why: `readyInstances=${ready} want=${want}` };
  return { ok: true, why: `phase healthy, ${ready}/${want} instances ready` };
}

export function conditionIs(obj: Doc, type: string, status: "True" | "False"): boolean {
  return ((obj?.status?.conditions ?? []) as Doc[]).some((c) => c.type === type && c.status === status);
}

/**
 * The kind config for this lane: the CI control plane (maxPods 250, as ci.kind-config.yaml) plus
 * `workers` workers, so the instance-count stage has real schedulable nodes to follow. Workers
 * rather than extra control planes: a kind control plane may carry a NoSchedule taint, a worker
 * never does, so the eligible-node count does not depend on kind's taint behaviour.
 */
export function kindConfigWithWorkers(workers: number): string {
  const nodes: Doc[] = [
    { role: "control-plane", kubeadmConfigPatches: ["kind: KubeletConfiguration\nmaxPods: 250\n"] },
    ...Array.from({ length: workers }, () => ({ role: "worker" })),
  ];
  return stringifyYaml({ kind: "Cluster", apiVersion: "kind.x-k8s.io/v1alpha4", nodes });
}

/**
 * The fields where a desired manifest disagrees with the live object, the way ArgoCD's diff
 * disagrees: MAPS are merged key by key (a field only the live object has is the operator's
 * default and is NOT a difference), but LISTS and scalars are compared whole -- a CRD has no
 * strategic-merge keys, so a defaulted field inside a list element makes the whole list differ.
 * That asymmetry is exactly what left postgres-shared OutOfSync forever (live run 36855350178),
 * and this makes the next such defect name its field instead of needing a human to diff by eye.
 */
export function desiredLiveDifferences(desired: unknown, live: unknown, path = ""): string[] {
  const isMap = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  if (isMap(desired)) {
    if (!isMap(live)) return [`${path || "/"}: desired is an object, live is ${live === undefined ? "absent" : JSON.stringify(live)}`];
    return Object.entries(desired).flatMap(([k, v]) => desiredLiveDifferences(v, live[k], `${path}/${k}`));
  }
  return canonical(desired) === canonical(live) ? [] : [`${path}: desired ${canonical(desired)} != live ${live === undefined ? "absent" : canonical(live)}`];
}

/** JSON with object keys sorted, so two lists that differ only in key ORDER compare equal (as they do to ArgoCD). */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (typeof v === "object" && v !== null) {
    return `{${Object.entries(v as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "undefined";
}

/** A Backup is only done at `completed`; `started`/`running`/`walArchiving` are not. */
export function backupIsCompleted(backup: Doc): boolean {
  return backup?.status?.phase === "completed";
}

// ---------------------------------------------------------------------------
// Process plumbing
// ---------------------------------------------------------------------------

interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

function run(cmd: string, args: readonly string[], opts: { input?: string; timeoutMs?: number; quiet?: boolean } = {}): RunResult {
  const r = spawnSync(cmd, [...args], {
    input: opts.input,
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 600_000,
    maxBuffer: 256 * 1024 * 1024,
  });
  const result: RunResult = { code: r.status ?? (r.error ? 124 : 1), stdout: r.stdout ?? "", stderr: (r.stderr ?? "") + (r.error ? `\n${String(r.error)}` : "") };
  if (!opts.quiet && result.code !== 0) {
    process.stderr.write(`$ ${cmd} ${args.join(" ")}\n  -> exit ${result.code}\n${result.stderr.split("\n").slice(-12).join("\n")}\n`);
  }
  return result;
}

class Lane {
  readonly clusterName: string;
  readonly context: string;
  constructor(clusterName: string) {
    this.clusterName = clusterName;
    this.context = `kind-${clusterName}`;
  }
  kubectl(args: readonly string[], opts: { input?: string; timeoutMs?: number; quiet?: boolean } = {}): RunResult {
    return run("kubectl", ["--context", this.context, ...args], opts);
  }
  helm(args: readonly string[], opts: { timeoutMs?: number } = {}): RunResult {
    return run("helm", ["--kube-context", this.context, ...args], opts);
  }
  json(args: readonly string[]): Doc | null {
    const r = this.kubectl([...args, "-o", "json"], { quiet: true });
    if (r.code !== 0) return null;
    try {
      return JSON.parse(r.stdout) as Doc;
    } catch {
      return null;
    }
  }
  apply(manifest: string, serverSide = true): void {
    const r = this.kubectl(["apply", ...(serverSide ? ["--server-side", "--force-conflicts"] : []), "-f", "-"], { input: manifest });
    if (r.code !== 0) throw new Error(`kubectl apply failed: ${r.stderr.slice(-600)}`);
  }
}

/** Poll until `probe` returns a string. A probe that throws or returns null is UNKNOWN, never success. */
async function waitFor(what: string, timeoutSec: number, probe: () => string | null, describeLast: () => string = () => ""): Promise<string> {
  const deadline = Date.now() + timeoutSec * 1000;
  let last = "";
  let tick = 0;
  while (Date.now() < deadline) {
    let got: string | null = null;
    try {
      got = probe();
    } catch (e) {
      last = `probe threw: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (got !== null) return got;
    const observed = describeLast();
    if (observed !== "") last = observed;
    if (tick++ % 4 === 0) console.log(`  ... ${what}: ${last || "no observation yet"}`);
    await Bun.sleep(10_000);
  }
  throw new Error(`timed out after ${timeoutSec}s waiting for ${what}; last observation: ${last || "none"}`);
}

// ---------------------------------------------------------------------------
// The lane
// ---------------------------------------------------------------------------

interface Options {
  clusterName: string;
  gitRef: string;
  repoUrl: string;
  timeoutSec: number;
  keepCluster: boolean;
  /** Worker nodes beside the control plane. >= 2 lets the instance-count stage scale the Cluster. */
  workers: number;
}

function parseArgs(argv: readonly string[]): Options {
  const o: Options = {
    clusterName: "zeta-ci-cnpg",
    gitRef: "main",
    repoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
    timeoutSec: 900,
    keepCluster: false,
    workers: 3,
  };
  const usage = (): never => {
    console.error("usage: bun cnpg-postgres-shared-live-test.ts --run [--cluster-name zeta-ci-<x>] [--git-ref SHA] [--repo-url URL] [--timeout-sec N] [--workers N] [--keep-cluster]");
    process.exit(2);
  };
  let run = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--run") run = true;
    else if (a === "--keep-cluster") o.keepCluster = true;
    else if (a === "--cluster-name") o.clusterName = argv[++i] ?? usage();
    else if (a === "--git-ref") o.gitRef = argv[++i] ?? usage();
    else if (a === "--repo-url") o.repoUrl = argv[++i] ?? usage();
    else if (a === "--timeout-sec") o.timeoutSec = Number.parseInt(argv[++i] ?? usage(), 10);
    else if (a === "--workers") o.workers = Number.parseInt(argv[++i] ?? usage(), 10);
    else usage();
  }
  if (!run) usage();
  if (!o.clusterName.startsWith("zeta-ci-")) {
    console.error(`REFUSED: cluster name ${JSON.stringify(o.clusterName)} must start with "zeta-ci-" so this can never name a real cluster`);
    process.exit(2);
  }
  if (!Number.isFinite(o.timeoutSec) || o.timeoutSec <= 0) usage();
  if (!Number.isInteger(o.workers) || o.workers < 0 || o.workers > 6) usage();
  return o;
}

function readText(rel: string): string {
  // One syscall, one answer: a missing file is reported by the read itself, not by a check that goes stale.
  return readFileSync(join(K8S, rel), "utf8");
}

function installBootstrapChart(lane: Lane, rel: string): void {
  const cr = parseHelmChartCr(readText(rel));
  const dir = mkdtempSync(join(tmpdir(), "zeta-cnpg-lane-"));
  const valuesFile = join(dir, `${cr.name}.values.yaml`);
  writeFileSync(valuesFile, cr.values);
  console.log(`helm install ${cr.name} ${cr.chart}@${cr.version} -> ${cr.namespace}`);
  const r = lane.helm(
    ["upgrade", "--install", cr.name, cr.chart, "--repo", cr.repo, "--version", cr.version, "-n", cr.namespace, "--create-namespace", "-f", valuesFile, "--wait", "--timeout", "10m"],
    { timeoutMs: 700_000 },
  );
  if (r.code !== 0) throw new Error(`helm install ${cr.name} failed`);
}

function applicationState(lane: Lane, name: string): ApplicationState | null {
  const app = lane.json(["-n", "argocd", "get", "application", name]);
  return app === null ? null : readApplicationState(app);
}

async function syncApplication(lane: Lane, opts: Options, dir: string, name: string): Promise<void> {
  const text = readText(`applications/${dir}/Application.yaml`);
  const app = pinApplicationToRef(text, opts.repoUrl, opts.gitRef);
  lane.apply(stringifyYaml(app));
  console.log(`applied Application ${name} (${dir})`);
}

async function waitSyncedHealthy(lane: Lane, name: string, timeoutSec: number): Promise<void> {
  let last: ApplicationState | null = null;
  await waitFor(
    `Application ${name} Synced+Healthy`,
    timeoutSec,
    () => {
      last = applicationState(lane, name);
      return last !== null && isSyncedAndHealthy(last) ? "ok" : null;
    },
    () => (last === null ? "Application not readable" : `sync=${last.sync} health=${last.health} op=${last.operation} ${last.conditions.join(" | ")}`),
  );
  console.log(`PROVED Application ${name} Synced+Healthy`);
}

function jobManifest(name: string, ns: string, image: string, script: string, env: Doc[] = []): string {
  return stringifyYaml({
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: { name, namespace: ns },
    spec: {
      backoffLimit: 0,
      ttlSecondsAfterFinished: 600,
      template: {
        spec: {
          restartPolicy: "Never",
          containers: [{ name: "c", image, command: ["/bin/sh", "-c"], args: [script], env }],
        },
      },
    },
  });
}

async function runJob(lane: Lane, name: string, ns: string, image: string, script: string, env: Doc[] = [], timeoutSec = 240): Promise<string> {
  lane.kubectl(["-n", ns, "delete", "job", name, "--ignore-not-found"], { quiet: true });
  lane.apply(jobManifest(name, ns, image, script, env), false);
  await waitFor(
    `Job ${ns}/${name} to finish`,
    timeoutSec,
    () => {
      const job = lane.json(["-n", ns, "get", "job", name]);
      if (job === null) return null;
      if ((job.status?.succeeded ?? 0) >= 1) return "ok";
      if ((job.status?.failed ?? 0) >= 1) return "failed";
      return null;
    },
  ).then((v) => {
    if (v === "failed") throw new Error(`Job ${ns}/${name} failed`);
  }).catch((e) => {
    const logs = lane.kubectl(["-n", ns, "logs", `job/${name}`, "--tail=60"], { quiet: true }).stdout;
    throw new Error(`${e instanceof Error ? e.message : String(e)}\n--- job logs ---\n${logs}`);
  });
  return lane.kubectl(["-n", ns, "logs", `job/${name}`], { quiet: true }).stdout;
}

function dumpDiagnostics(lane: Lane): void {
  const sh = (title: string, args: readonly string[]): void => {
    console.log(`\n===== ${title} =====`);
    const r = lane.kubectl(args, { quiet: true });
    console.log((r.stdout + (r.code !== 0 ? `\n[exit ${r.code}] ${r.stderr}` : "")).slice(-14000));
  };
  sh("Applications", ["-n", "argocd", "get", "applications.argoproj.io", "-o", "wide"]);
  for (const a of ["cloudnativepg", "cnpg-barman-cloud", "seaweedfs", "postgres-shared"]) {
    const app = lane.json(["-n", "argocd", "get", "application", a]);
    if (app !== null) {
      console.log(`\n===== Application ${a} status =====`);
      console.log(JSON.stringify({ sync: app.status?.sync, health: app.status?.health, conditions: app.status?.conditions, operationState: app.status?.operationState, resources: (app.status?.resources ?? []).map((r: Doc) => `${r.kind}/${r.name} sync=${r.status} health=${r.health?.status ?? "-"} ${r.health?.message ?? ""}`) }, null, 2).slice(-9000));
    }
  }
  try {
    const desired = parseYaml(readFileSync(join(K8S, "applications/postgres-shared/cluster.yaml"), "utf8")) as Doc;
    const live = lane.json(["-n", "postgres-shared", "get", "cluster.postgresql.cnpg.io", "postgres-shared"]);
    if (live !== null) {
      console.log("\n===== postgres-shared Cluster: fields where desired != live (ArgoCD's atomic-list reading of drift) =====");
      const diffs = desiredLiveDifferences(desired.spec, live.spec, "/spec");
      console.log(diffs.length === 0 ? "(none: every desired field equals live)" : diffs.join("\n"));
    }
  } catch (e) {
    console.log(`desired-vs-live diff could not run: ${e instanceof Error ? e.message : String(e)}`);
  }
  sh("postgres-shared Cluster (yaml)", ["-n", "postgres-shared", "get", "cluster.postgresql.cnpg.io", "postgres-shared", "-o", "yaml"]);
  sh("postgres-shared objects", ["-n", "postgres-shared", "get", "all,pvc,backup.postgresql.cnpg.io,scheduledbackup.postgresql.cnpg.io,objectstore.barmancloud.cnpg.io,secret", "-o", "wide"]);
  sh("postgres-shared events", ["-n", "postgres-shared", "get", "events", "--sort-by=.lastTimestamp"]);
  sh("cnpg-system pods", ["-n", "cnpg-system", "get", "pods", "-o", "wide"]);
  sh("cnpg operator logs", ["-n", "cnpg-system", "logs", "-l", "app.kubernetes.io/name=cloudnative-pg", "--tail=150"]);
  sh("barman plugin logs", ["-n", "cnpg-system", "logs", "-l", "app.kubernetes.io/name=plugin-barman-cloud", "--tail=150"]);
  sh("postgres pod logs (all containers)", ["-n", "postgres-shared", "logs", "-l", "cnpg.io/cluster=postgres-shared", "--all-containers=true", "--prefix=true", "--tail=120"]);
  sh("object-store pods", ["-n", "object-store", "get", "pods", "-o", "wide"]);
  sh("seaweedfs logs", ["-n", "object-store", "logs", "-l", "app.kubernetes.io/name=seaweedfs", "--all-containers=true", "--prefix=true", "--tail=80"]);
  sh("argocd application-controller logs (tail)", ["-n", "argocd", "logs", "-l", "app.kubernetes.io/name=argocd-application-controller", "--tail=120"]);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const lane = new Lane(opts.clusterName);
  const checks: string[] = [];
  const prove = (s: string): void => {
    checks.push(s);
    console.log(`PROVED ${s}`);
  };

  const existing = run("kind", ["get", "clusters"], { quiet: true }).stdout.split("\n");
  if (!existing.includes(opts.clusterName)) {
    console.log(`creating kind cluster ${opts.clusterName}`);
    const configPath = join(mkdtempSync(join(tmpdir(), "zeta-cnpg-kind-")), "kind-config.yaml");
    writeFileSync(configPath, kindConfigWithWorkers(opts.workers));
    const r = run("kind", ["create", "cluster", "--name", opts.clusterName, "--config", configPath, "--wait", "300s"], { timeoutMs: 900_000 });
    if (r.code !== 0) throw new Error("kind create failed");
  }

  try {
    // storage: the dev binding of the capability the Cluster and seaweedfs name
    lane.apply(readFileSync(join(REPO_ROOT, "full-ai-cluster/dev-cluster/manifests/zeta-block-local.yaml"), "utf8"), false);
    lane.kubectl(["annotate", "storageclass", "standard", "storageclass.kubernetes.io/is-default-class-", "--overwrite"], { quiet: true });

    installBootstrapChart(lane, "bootstrap/cert-manager-install.yaml");
    installBootstrapChart(lane, "bootstrap/argocd-install.yaml");

    // The PodMonitor CRD that kube-prometheus-stack (wave 0) provides in the real tree.
    console.log("helm install prometheus-operator-crds (stands in for kube-prometheus-stack's CRDs)");
    const crds = lane.helm(["upgrade", "--install", "prometheus-operator-crds", "prometheus-operator-crds", "--repo", "https://prometheus-community.github.io/helm-charts", "-n", "monitoring", "--create-namespace", "--wait"], { timeoutMs: 300_000 });
    if (crds.code !== 0) throw new Error("prometheus-operator-crds install failed");

    // The real first-boot seeding manifest -- the file the ISO applies before ArgoCD exists.
    const seed = lane.kubectl(["apply", "-f", join(K8S, "bootstrap/internal-secret-seeding.yaml")]);
    if (seed.code !== 0) throw new Error("applying internal-secret-seeding.yaml failed");
    await waitFor("seed-blob-store Job complete", 420, () => {
      const job = lane.json(["-n", "object-store", "get", "job", "seed-blob-store"]);
      if (job !== null && (job.status?.failed ?? 0) > 0 && (job.status?.succeeded ?? 0) === 0) throw new Error("seed-blob-store Job failed");
      return job !== null && (job.status?.succeeded ?? 0) >= 1 ? "ok" : null;
    });
    const pgSecret = lane.json(["-n", "postgres-shared", "get", "secret", "postgres-backup-s3"]);
    if (pgSecret === null) throw new Error("seeding finished but Secret postgres-shared/postgres-backup-s3 does not exist");
    prove("first-boot seeding minted postgres-shared/postgres-backup-s3");

    // Wave order, as the root app-of-apps gates it.
    await syncApplication(lane, opts, "cloudnativepg", "cloudnativepg");
    await waitSyncedHealthy(lane, "cloudnativepg", 600);
    await syncApplication(lane, opts, "cnpg-barman-cloud", "cnpg-barman-cloud");
    await waitSyncedHealthy(lane, "cnpg-barman-cloud", 600);
    await syncApplication(lane, opts, "seaweedfs", "seaweedfs");
    await waitSyncedHealthy(lane, "seaweedfs", 600);
    await syncApplication(lane, opts, "postgres-shared", "postgres-shared");

    // 1. THE OWNER'S SYMPTOM.
    await waitSyncedHealthy(lane, "postgres-shared", opts.timeoutSec);
    prove("Application postgres-shared is Synced+Healthy under ArgoCD");

    // 2. The Cluster itself.
    let clusterWhy = "";
    await waitFor("Cluster healthy", 300, () => {
      const c = lane.json(["-n", "postgres-shared", "get", "cluster.postgresql.cnpg.io", "postgres-shared"]);
      if (c === null) return null;
      const h = clusterIsHealthy(c);
      clusterWhy = h.why;
      return h.ok ? h.why : null;
    }, () => clusterWhy);
    prove(`Cluster postgres-shared: ${clusterWhy}`);

    // 3. A row through -rw, read back on a SECOND connection, with the operator-minted credential.
    const pgImage = "ghcr.io/cloudnative-pg/postgresql:17.11-minimal-trixie";
    const secretEnv = (key: string, name: string): Doc => ({ name, valueFrom: { secretKeyRef: { name: "postgres-shared-app", key } } });
    const pgEnv = [secretEnv("username", "PGUSER"), secretEnv("password", "PGPASSWORD"), secretEnv("dbname", "PGDATABASE"), { name: "PGSSLMODE", value: "require" }];
    const marker = `zeta-live-${Date.now()}`;
    const writeOut = await runJob(
      lane, "pg-write", "postgres-shared", pgImage,
      `set -eu; export PGHOST=postgres-shared-rw; psql -v ON_ERROR_STOP=1 -c "create table if not exists live_probe(k text primary key, at timestamptz default now())" -c "insert into live_probe(k) values ('${marker}')" -tAc "select 'WROTE:' || pg_is_in_recovery()::text"`,
      pgEnv,
    );
    if (!writeOut.includes("WROTE:false")) throw new Error(`write did not land on a primary: ${writeOut}`);
    const readOut = await runJob(
      lane, "pg-read", "postgres-shared", pgImage,
      `set -eu; export PGHOST=postgres-shared-rw; psql -v ON_ERROR_STOP=1 -tAc "select 'READ:' || k from live_probe where k='${marker}'"`,
      pgEnv,
    );
    if (!readOut.includes(`READ:${marker}`)) throw new Error(`row did not read back: ${readOut}`);
    prove("a row written via postgres-shared-rw reads back on a second connection with the postgres-shared-app credentials");

    // 4. WAL archiving.
    let archWhy = "";
    await waitFor("ContinuousArchiving=True", 300, () => {
      const c = lane.json(["-n", "postgres-shared", "get", "cluster.postgresql.cnpg.io", "postgres-shared"]);
      if (c === null) return null;
      archWhy = JSON.stringify(((c.status?.conditions ?? []) as Doc[]).filter((x) => x.type === "ContinuousArchiving"));
      return conditionIs(c, "ContinuousArchiving", "True") ? "ok" : null;
    }, () => archWhy);
    prove("Cluster condition ContinuousArchiving is True");

    // 5. The base backup the ScheduledBackup asked for with `immediate: true`.
    let backupWhy = "";
    await waitFor("a Backup reaches completed", 600, () => {
      const list = lane.json(["-n", "postgres-shared", "get", "backup.postgresql.cnpg.io"]);
      const items = (list?.items ?? []) as Doc[];
      backupWhy = items.map((b) => `${b.metadata.name}=${b.status?.phase ?? "?"} ${b.status?.error ?? ""}`).join("; ") || "no Backup object yet";
      return items.some(backupIsCompleted) ? "ok" : null;
    }, () => backupWhy);
    prove(`base Backup completed (${backupWhy})`);

    // 6. The bytes are in the bucket, read with the credential the Postgres pods hold.
    // (No pg_switch_wal here: the app role is deliberately not a superuser, and the completed base
    // backup above has already archived the WAL segments it needs, so `wals/` is populated.)
    const awsEnv: Doc[] = [
      { name: "AWS_ACCESS_KEY_ID", valueFrom: { secretKeyRef: { name: "postgres-backup-s3", key: "ACCESS_KEY_ID" } } },
      { name: "AWS_SECRET_ACCESS_KEY", valueFrom: { secretKeyRef: { name: "postgres-backup-s3", key: "ACCESS_SECRET_KEY" } } },
      { name: "AWS_DEFAULT_REGION", value: "us-east-1" },
    ];
    const endpoint = "http://blob-store-seaweedfs-all-in-one.object-store.svc:8333";
    const bucketOut = await runJob(
      lane, "bucket-check", "postgres-shared", "public.ecr.aws/aws-cli/aws-cli:2.22.35",
      `set -u; E=${endpoint}; n=0
       while [ $n -lt 30 ]; do
         BASE=$(aws --endpoint-url $E s3 ls s3://zeta-backups/postgres/postgres-shared/base/ --recursive 2>&1 | wc -l)
         WALS=$(aws --endpoint-url $E s3 ls s3://zeta-backups/postgres/postgres-shared/wals/ --recursive 2>&1 | wc -l)
         if [ "$BASE" -gt 0 ] && [ "$WALS" -gt 0 ]; then break; fi
         n=$((n+1)); sleep 5
       done
       echo "BASE_OBJECTS:$BASE"; echo "WAL_OBJECTS:$WALS"
       aws --endpoint-url $E s3 ls s3://zeta-backups/postgres/postgres-shared/base/ --recursive 2>&1 | head -8
       if aws --endpoint-url $E s3 ls s3://loki-chunks/ >/dev/null 2>/tmp/err; then echo "SCOPE:LEAK"; else echo "SCOPE:DENIED"; head -c 300 /tmp/err; fi`,
      awsEnv, 420,
    );
    const base = Number(/BASE_OBJECTS:(\d+)/.exec(bucketOut)?.[1] ?? "0");
    const wals = Number(/WAL_OBJECTS:(\d+)/.exec(bucketOut)?.[1] ?? "0");
    if (base === 0 || wals === 0) throw new Error(`bucket does not hold a backup + WAL: base=${base} wals=${wals}\n${bucketOut}`);
    prove(`bucket zeta-backups holds ${base} base-backup object(s) and ${wals} WAL object(s) under postgres/postgres-shared/`);
    if (!bucketOut.includes("SCOPE:DENIED")) throw new Error(`the pgBackup credential could read another bucket (loki-chunks):\n${bucketOut}`);
    prove("the pgBackup credential cannot read another bucket (scope is real)");

    // 7. THE REPLICA SET IS REAL. The committed (metal) tree runs three instances, so by now there
    //    are two replicas: prove they stream, then prove the point of having them -- lose the
    //    primary pod and the database stays up with the data intact and accepts a new write.
    const want = Number(lane.json(["-n", "postgres-shared", "get", "cluster.postgresql.cnpg.io", "postgres-shared"])?.spec?.instances ?? 0);
    if (want >= 2) {
      const placement = lane.kubectl(["-n", "postgres-shared", "get", "pods", "-l", "cnpg.io/cluster=postgres-shared", "-o", "custom-columns=POD:.metadata.name,NODE:.spec.nodeName,ROLE:.metadata.labels.cnpg\\.io/instanceRole", "--no-headers"], { quiet: true }).stdout;
      console.log(`instance placement (preferred anti-affinity, ${opts.workers} worker(s)):\n${placement}`);

      const replicaOut = await runJob(
        lane, "pg-read-replica", "postgres-shared", pgImage,
        `set -eu; export PGHOST=postgres-shared-ro; psql -v ON_ERROR_STOP=1 -tAc "select 'REPLICA:' || pg_is_in_recovery()::text || ':' || (select count(*) from live_probe where k='${marker}')::text"`,
        pgEnv,
      );
      if (!replicaOut.includes("REPLICA:true:1")) throw new Error(`the -ro Service did not reach a streaming replica holding the row: ${replicaOut}`);
      prove(`the -ro Service reaches a streaming replica (pg_is_in_recovery) holding the row, with ${want} instances`);

      const before = lane.json(["-n", "postgres-shared", "get", "cluster.postgresql.cnpg.io", "postgres-shared"]);
      const oldPrimary = String(before?.status?.currentPrimary ?? "");
      if (oldPrimary === "") throw new Error("the Cluster reports no currentPrimary");
      console.log(`deleting primary pod ${oldPrimary}`);
      const del = lane.kubectl(["-n", "postgres-shared", "delete", "pod", oldPrimary, "--wait=false"]);
      if (del.code !== 0) throw new Error(`could not delete the primary pod: ${del.stderr}`);
      let failoverWhy = "";
      const newPrimary = await waitFor("a different instance becomes primary and the Cluster is healthy again", 420, () => {
        const c = lane.json(["-n", "postgres-shared", "get", "cluster.postgresql.cnpg.io", "postgres-shared"]);
        if (c === null) return null;
        const h = clusterIsHealthy(c);
        failoverWhy = `currentPrimary=${String(c.status?.currentPrimary)} ${h.why}`;
        return h.ok && c.status?.currentPrimary !== oldPrimary ? String(c.status?.currentPrimary) : null;
      }, () => failoverWhy);
      const afterOut = await runJob(
        lane, "pg-after-failover", "postgres-shared", pgImage,
        `set -eu; export PGHOST=postgres-shared-rw; psql -v ON_ERROR_STOP=1 -c "insert into live_probe(k) values ('${marker}-after')" -tAc "select 'AFTER:' || pg_is_in_recovery()::text || ':' || (select count(*) from live_probe where k like '${marker}%')::text"`,
        pgEnv,
      );
      if (!afterOut.includes("AFTER:false:2")) throw new Error(`after losing the primary the -rw Service did not accept a write on a primary that kept the data: ${afterOut}`);
      prove(`lost the primary pod ${oldPrimary}: ${newPrimary} took over, the Cluster is healthy at ${want} instances again, the earlier row survived and a new write landed on the new primary`);
    }

    console.log(`\nALL PROVED (${checks.length}):\n  - ${checks.join("\n  - ")}`);
  } catch (error) {
    console.log(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
    dumpDiagnostics(lane);
    console.log(`\nPROVED BEFORE FAILURE (${checks.length}):\n  - ${checks.join("\n  - ")}`);
    process.exitCode = 1;
  } finally {
    if (!opts.keepCluster) run("kind", ["delete", "cluster", "--name", opts.clusterName], { quiet: true });
  }
}

if (import.meta.main) {
  await main();
}
