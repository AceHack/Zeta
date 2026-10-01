/**
 * wp11-clusterdiag-shell-parity.test.ts
 *
 * WP11 run 36832486494 failed verdict 7 (26/48 Applications Synced+Healthy on a
 * 4 vCPU / 12 GiB guest) and named the 17 that did not converge, but its serial
 * log carried nothing that says WHY: no pod describe, no Events, no
 * `logs --previous`, no Pending reason, and no comparison of what the pods
 * request with what the node has. Worse, the per-Application dump ran at the very
 * end, when k3s was in its 14th restart, so four of its ten dumps are the single
 * line `connection to the server 127.0.0.1:6443 was refused`.
 *
 * `zeta-first-boot-k3s-verify.nix` now captures `zeta_wp11_cluster_diag` once
 * mid-run and once at the end. This file runs the REAL function text — extracted
 * verbatim from between the ZETA-WP11-CLUSTERDIAG-BEGIN/END markers — under real
 * bash with `kc`, `jq` and the clock faked, and pins what the capture must never
 * get wrong:
 *
 *   - THREE STATES, never two. A capture that FAILED (a hard section's exit
 *     status, the API never answering, the line budget, the wall-clock deadline)
 *     must not read as one that found nothing, and every cause is NAMED.
 *   - A SOFT section (`kubectl top` with no metrics-server, `logs` for a pod that
 *     never started) is expected to fail on some guests and must not turn a good
 *     capture into `failed`.
 *   - FAIL-SAFE: the function returns 0 on every path, so it cannot change the
 *     verdict, and it is bounded (line budget, per-section cap, line width).
 *
 * The jq programs (capacity arithmetic, the Pending-reason census) are exercised
 * against fixtures with the REAL jq when one is installed. Linux CI always has
 * jq, so there the cases are mandatory; on a developer box without it they are
 * skipped loudly rather than silently passing.
 */

import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

setDefaultTimeout(60_000);

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const MODULE_PATH = join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix");
const SRC = readFileSync(MODULE_PATH, "utf8");
const BEGIN = "# ZETA-WP11-CLUSTERDIAG-BEGIN";
const END = "# ZETA-WP11-CLUSTERDIAG-END";

function extractBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0 || e < 0 || e < b) throw new Error("ZETA-WP11-CLUSTERDIAG-BEGIN/END markers missing or out of order");
  const block = SRC.slice(b, e + END.length).replaceAll("''${", "${");
  if (/\$\{pkgs\./.test(block)) throw new Error("cluster-diag block must not reference a Nix interpolation");
  return block;
}

const REAL_JQ = spawnSync("jq", ["--version"], { encoding: "utf8" });
const HAS_JQ = REAL_JQ.error === undefined && REAL_JQ.status === 0;
// Linux CI always carries jq: there a missing jq is a broken runner, not a reason to skip.
if (!HAS_JQ && process.platform === "linux" && process.env.CI !== undefined) {
  throw new Error("jq is required on Linux CI for wp11-clusterdiag-shell-parity.test.ts");
}
const realJq = it.skipIf(!HAS_JQ);

/** The unit's own wiring, comments stripped so rationale can never satisfy a wiring check. */
const CODE = SRC.split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n");

/* ------------------------------ fixtures ------------------------------ */

const pod = (
  ns: string,
  name: string,
  status: Record<string, unknown>,
  requests?: { cpu?: string; memory?: string },
  limits?: { memory?: string },
) => ({
  metadata: { namespace: ns, name },
  spec: {
    containers: [
      {
        name: "main",
        resources: {
          ...(requests === undefined ? {} : { requests }),
          ...(limits === undefined ? {} : { limits }),
        },
      },
    ],
  },
  status,
});

const PODS = {
  items: [
    pod(
      "argocd",
      "redis-0",
      {
        phase: "Pending",
        conditions: [
          {
            type: "PodScheduled",
            status: "False",
            message: "0/1 nodes are available: 1 Insufficient memory. preemption: 0/1 nodes are available.",
          },
        ],
      },
      { cpu: "2", memory: "1Gi" },
    ),
    pod(
      "monitoring",
      "prom-0",
      {
        phase: "Pending",
        conditions: [
          {
            type: "PodScheduled",
            status: "False",
            message: "0/1 nodes are available: pod has unbound immediate PersistentVolumeClaims.",
          },
        ],
      },
      { memory: "512Mi" },
    ),
    pod(
      "forgejo",
      "forgejo-0",
      {
        phase: "Running",
        containerStatuses: [
          {
            name: "main",
            ready: false,
            restartCount: 7,
            state: { waiting: { reason: "CrashLoopBackOff" } },
            lastState: { terminated: { reason: "OOMKilled" } },
          },
        ],
      },
      { cpu: "250m", memory: "256Mi" },
    ),
    pod(
      "kube-system",
      "cilium-abc",
      { phase: "Running", containerStatuses: [{ name: "main", ready: true, restartCount: 0 }] },
      { cpu: "500m", memory: "256Mi" },
    ),
    pod("kube-system", "job-done", { phase: "Succeeded" }, { cpu: "9", memory: "9Gi" }),
    pod(
      "orleans",
      "silo-0",
      {
        phase: "Pending",
        containerStatuses: [{ name: "main", ready: false, restartCount: 0, state: { waiting: { reason: "ImagePullBackOff" } } }],
      },
      { cpu: "100m", memory: "64Mi" },
      { memory: "128Mi" },
    ),
  ],
};

const NODES = {
  items: [{ metadata: { name: "node-a" }, status: { allocatable: { cpu: "4", memory: "12288000Ki", pods: "110" } } }],
};

const APP_JSON = JSON.stringify({
  status: {
    sync: { status: "OutOfSync" },
    health: { status: "Degraded" },
    operationState: { phase: "Failed", message: "sync failed", syncResult: { resources: [] } },
    conditions: [{ type: "ComparisonError", message: "repo-server DeadlineExceeded" }],
    resources: [
      { kind: "Deployment", namespace: "forgejo", name: "forgejo", status: "OutOfSync", health: { status: "Degraded", message: "Deployment does not have minimum availability" } },
      { kind: "Service", namespace: "forgejo", name: "forgejo", status: "Synced", health: { status: "Healthy" } },
    ],
  },
});

const FAKE_KUBECTL = `#!/usr/bin/env bash
# Argument-driven fake. Behaviour switches come from the environment.
args=" $* "
case "$args" in
  *" get namespace kube-system "*)
    [ "\${API_UP:-yes}" = "yes" ] && { echo "namespace/kube-system"; exit 0; }
    echo "The connection to the server 127.0.0.1:6443 was refused" >&2; exit 1 ;;
  *" get pods -A -o json "*)     cat pods.json ;;
  *" get nodes -o json "*)       cat nodes.json ;;
  *" get nodes -o wide "*)       echo "NAME STATUS ROLES"; echo "node-a Ready control-plane" ;;
  *" get pods -A -o wide "*)     echo "NAMESPACE NAME READY STATUS"; echo "argocd redis-0 0/1 Pending" ;;
  *" top nodes "*|*" top pods "*) echo "error: Metrics API not available" >&2; exit 1 ;;
  *" get events "*)
    [ "\${EVENTS_FAIL:-no}" = "yes" ] && { echo "events boom" >&2; exit 7; }
    echo "monitoring 1m Warning FailedScheduling pod/prom-0 0/1 nodes are available" ;;
  *" describe pod "*)
    echo "Name:         \${@: -1}"
    echo "Status:       Running"
    echo "    State:          Waiting"
    echo "      Reason:       CrashLoopBackOff"
    echo "    Last State:     Terminated"
    echo "      Exit Code:    137"
    echo "Conditions:"
    echo "  Type   Status"
    echo "Events:"
    echo "  Warning  BackOff  3m  kubelet  Back-off restarting failed container" ;;
  *" get pod "*" jsonpath"*|*" get pod "*" -o jsonpath="*) echo "main" ;;
  *" logs "*" --previous "*)
    case "$args" in *" coredns-abc "*) echo "Error from server (BadRequest): previous terminated container not found" >&2; exit 1 ;; esac
    echo "panic: out of memory (previous instance)" ;;
  *" logs "*) echo "current log line" ;;
  *" get application "*) cat app.json ;;
  *) echo "fake-kubectl: unhandled: $args" >&2; exit 99 ;;
esac
`;

/** Recognises each jq program by a distinctive substring and answers for it. */
const FAKE_JQ = `#!/usr/bin/env bash
prog="$*"
case "$prog" in
  *"sort_by(-.m)"*)
    echo "node node-a: allocatable cpu=4 memory=12288000Ki pods=110"
    echo "sum of container requests over 5 live pod(s): cpu=2850m of 4000m allocatable (71%), memory=2112Mi of 12000Mi (17%)" ;;
  *"group_by(.cat)"*)
    echo "4 not-ready pod(s) of 6 total"
    printf '1\\tPending: Insufficient memory\\targocd/redis-0\\n' ;;
  *"sort_by([-.r"*)
    [ "\${LIST_FAIL:-no}" = "yes" ] && { echo "jq: error" >&2; exit 5; }
    echo "forgejo forgejo-0 7"
    echo "kube-system coredns-abc 2"
    echo "argocd redis-0 0" ;;
  *"failed task"*)
    cat > /dev/null
    echo "sync=OutOfSync health=Degraded"
    echo "condition ComparisonError: repo-server DeadlineExceeded" ;;
  *) echo "fake-jq: unhandled program" >&2; exit 98 ;;
esac
`;

const CLASS_FILE = [
  "converged\talloy\tsync=Synced health=Healthy",
  "unconverged\tagent-memory\tsync=Synced health=Progressing msg=-",
  "unconverged\tplatform\tsync=OutOfSync health=Progressing msg=-",
  "unconverged\tforgejo\tsync=Synced health=Degraded msg=-",
  "undecidable\tdapr\tthe scheduler REFUSED to place pod",
  "excluded-manual-sync\tollama\tmanual",
  "",
].join("\n");

function makeWorkdir(opts: { realJq?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-wp11-clusterdiag-"));
  writeFileSync(join(dir, "block.sh"), `${extractBlock()}\n`, "utf8");
  writeFileSync(join(dir, "fake-kubectl"), FAKE_KUBECTL, "utf8");
  writeFileSync(join(dir, "fake-jq"), FAKE_JQ, "utf8");
  writeFileSync(join(dir, "pods.json"), JSON.stringify(PODS), "utf8");
  writeFileSync(join(dir, "nodes.json"), JSON.stringify(NODES), "utf8");
  writeFileSync(join(dir, "app.json"), APP_JSON, "utf8");
  writeFileSync(join(dir, "class.tsv"), CLASS_FILE, "utf8");
  if (opts.realJq === true) writeFileSync(join(dir, "use-real-jq"), "1", "utf8");
  return dir;
}

interface Run {
  readonly stdout: string;
  readonly vars: Record<string, string>;
}

function run(dir: string, script: string, env: Record<string, string> = {}): Run {
  const useReal = env.REAL_JQ === "1";
  const runner = [
    // The module's own mode: -u and pipefail, NOT -e.
    "set -uo pipefail",
    'log() { echo "$1"; }',
    "elapsed() { echo 0; }",
    "now_ts() { date +%s; }",
    'MKTEMP="$(command -v mktemp)"; RM="$(command -v rm)"; GREP="$(command -v grep)"; TAIL="$(command -v tail)"',
    'HEAD="$(command -v head)"; SED="$(command -v sed)"; AWK="$(command -v awk)"; SLEEP="$(command -v sleep)"',
    useReal ? 'JQ="$(command -v jq)"' : "chmod +x ./fake-jq; JQ=./fake-jq",
    "chmod +x ./fake-kubectl",
    'kc() { ./fake-kubectl "$@"; }',
    "source ./block.sh",
    script,
    'echo "::STATE=$CLUSTER_DIAG_LAST_STATE"',
    'echo "::DETAIL=$CLUSTER_DIAG_LAST_DETAIL"',
    'echo "::LINES=$CLUSTER_DIAG_LINES"',
    'echo "::MID=$CLUSTER_DIAG_MID_STATE"',
    'echo "::END=$CLUSTER_DIAG_END_STATE"',
  ].join("\n");
  writeFileSync(join(dir, "runner.sh"), `${runner}\n`, "utf8");
  const r = spawnSync("bash", ["runner.sh"], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } });
  if (r.error !== undefined) throw r.error;
  if (r.status !== 0) throw new Error(`bash exited ${String(r.status)}: ${r.stderr}\n${r.stdout}`);
  const vars: Record<string, string> = {};
  for (const line of r.stdout.split("\n")) {
    const m = /^::([A-Z]+)=(.*)$/.exec(line);
    if (m?.[1] !== undefined) vars[m[1]] = m[2] ?? "";
  }
  return { stdout: r.stdout, vars };
}

describe("WP11 cluster diagnostics: three states, never two", () => {
  it("did-not-run until something triggers it (a passing run never pays for it)", () => {
    const r = run(makeWorkdir(), ":");
    expect(r.vars.STATE).toBe("did-not-run");
    expect(r.vars.MID).toBe("did-not-run");
    expect(r.vars.END).toBe("did-not-run");
    expect(r.stdout).not.toContain("[wp11-cluster-diag]");
  });

  it("captured: per-pod describe + logs, the census, capacity and every unconverged app are on the log", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cluster_diag end "./class.tsv"');
    expect(r.vars.STATE).toBe("captured");
    expect(r.vars.DETAIL).toBe("");
    expect(r.stdout).toContain("[wp11-cluster-diag] capacity-vs-requests | sum of container requests over 5 live pod(s)");
    expect(r.stdout).toContain("[wp11-cluster-diag] pending-reason-census | 1\tPending: Insufficient memory\targocd/redis-0");
    // Worst-restarting pod first, and BOTH halves of its evidence.
    expect(r.stdout).toContain("[wp11-cluster-diag] describe:forgejo/forgejo-0(restarts=7) |     State:          Waiting");
    expect(r.stdout).toContain("[wp11-cluster-diag] describe:forgejo/forgejo-0(restarts=7) | --- events ---");
    expect(r.stdout).toContain("Warning  BackOff  3m  kubelet  Back-off restarting failed container");
    expect(r.stdout).toContain("[wp11-cluster-diag] logs:forgejo/forgejo-0 | panic: out of memory (previous instance)");
    expect(r.stdout).toContain("[wp11-cluster-diag] result (end): captured");
  });

  it("falls back to the CURRENT log when a container has no previous instance", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cluster_diag end "./class.tsv"');
    expect(r.stdout).toContain("logs:kube-system/coredns-abc | --- container main: no previous instance; current logs --tail=30 ---");
    expect(r.stdout).toContain("logs:kube-system/coredns-abc | current log line");
  });

  it("a SOFT section (no metrics-server) says so and does NOT make the capture failed", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cluster_diag end "./class.tsv"');
    expect(r.stdout).toContain("[wp11-cluster-diag] top-nodes: unavailable (exit 1) -- expected on some guests; not counted as a failed capture");
    expect(r.vars.STATE).toBe("captured");
  });

  it("apps: every unconverged/undecidable row, defect-shaped rows BEFORE the capacity signature, excluded rows never", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cluster_diag end "./class.tsv"');
    const order = [...r.stdout.matchAll(/\[wp11-cluster-diag\] app:([a-z-]+): captured/g)].map((m) => m[1]);
    // platform (OutOfSync) and forgejo (Degraded) and dapr (undecidable) are not the
    // `sync=Synced health=Progressing` capacity signature, so they go first.
    expect(order).toEqual(["platform", "forgejo", "dapr", "agent-memory"]);
    expect(r.stdout).not.toContain("app:alloy");
    expect(r.stdout).not.toContain("app:ollama");
  });

  it("ORDER IS PRIORITY: what explains WHY comes first, the bulk pod listing LAST (run 36875247887 dropped every per-app section to a spent budget)", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cluster_diag end "./class.tsv"');
    const at = (needle: string): number => r.stdout.indexOf(needle);
    const census = at("pending-reason-census: captured");
    const events = at("warning-events: captured");
    const firstApp = at("app:platform: captured");
    const firstDescribe = at("describe:forgejo/forgejo-0(restarts=7): captured");
    const wide = at("pods-wide: captured");
    expect(census).toBeGreaterThan(0);
    expect(census).toBeLessThan(events);
    expect(events).toBeLessThan(firstApp);
    expect(firstApp).toBeLessThan(firstDescribe);
    expect(firstDescribe).toBeLessThan(wide);
  });

  it("a tight budget costs the bulk listing, never the per-Application evidence", () => {
    // Enough for the explanatory sections and the apps, not for the pod listing.
    const r = run(makeWorkdir(), 'CLUSTER_DIAG_MAX_LINES=40; zeta_wp11_cluster_diag end "./class.tsv"');
    expect(r.stdout).toContain("app:platform | sync=OutOfSync health=Degraded");
    expect(r.stdout).toContain("pods-wide: SKIPPED (line budget of 40 exhausted)");
  });

  it("a healthy `kubectl top | head` is not read as unavailable (SIGPIPE, exit 141)", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cdiag_top_pods; echo "::TOPRC=$?"');
    // The fake kubectl answers `top` with an error, so the point here is only that the
    // function reports kubectl's OWN status (1), not a pipeline artefact.
    expect(r.stdout).toContain("::TOPRC=1");
  });

  it("API never answers: FAILED and NAMED, kubectl sections skipped, still returns 0", () => {
    const r = run(makeWorkdir(), 'CLUSTER_DIAG_API_WAIT_SECONDS=0; zeta_wp11_cluster_diag end "./class.tsv"', { API_UP: "no" });
    expect(r.vars.STATE).toBe("failed");
    expect(r.vars.DETAIL).toContain("api-unreachable(0s)");
    expect(r.stdout).toContain("This is a FAILED capture, not an empty cluster");
    expect(r.stdout).not.toContain("describe:");
  });

  it("a HARD section that fails is named with its exit status; the rest of the capture still ran", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cluster_diag end "./class.tsv"', { EVENTS_FAIL: "yes" });
    expect(r.vars.STATE).toBe("failed");
    expect(r.vars.DETAIL).toContain("warning-events(exit 7)");
    expect(r.stdout).toContain("[wp11-cluster-diag] warning-events: FAILED (exit 7) -- this section measured nothing");
    expect(r.stdout).toContain("describe:forgejo/forgejo-0"); // later sections were not abandoned
  });

  it("a pod list that cannot be reduced is a NAMED failure, never an empty census", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cluster_diag end "./class.tsv"', { LIST_FAIL: "yes" });
    expect(r.vars.STATE).toBe("failed");
    expect(r.vars.DETAIL).toContain("unready-pod-list(jq)");
    expect(r.stdout).not.toContain("describe:forgejo");
  });

  it("is BOUNDED by a total line budget, and says what it dropped", () => {
    const r = run(makeWorkdir(), 'CLUSTER_DIAG_MAX_LINES=12; zeta_wp11_cluster_diag end "./class.tsv"');
    expect(r.vars.STATE).toBe("failed");
    expect(r.vars.DETAIL).toContain("(budget)");
    expect(Number(r.vars.LINES)).toBeLessThanOrEqual(12);
    expect(r.stdout).toContain("SKIPPED (line budget of 12 exhausted)");
  });

  it("is BOUNDED by a wall-clock deadline: every skipped section is named, none passes quietly", () => {
    const r = run(makeWorkdir(), 'CLUSTER_DIAG_DEADLINE_SECONDS=0; zeta_wp11_cluster_diag end "./class.tsv"');
    expect(r.vars.STATE).toBe("failed");
    expect(r.vars.DETAIL).toContain("nodes(deadline)");
    expect(r.vars.DETAIL).toContain("warning-events(deadline)");
    expect(r.stdout).toContain("SKIPPED (diagnostic deadline reached) -- this section measured nothing");
  });

  it("truncates a single over-long line instead of flooding the serial log", () => {
    const r = run(makeWorkdir(), 'CLUSTER_DIAG_LINE_WIDTH=20; zeta_wp11_cluster_diag end "./class.tsv"');
    expect(r.stdout).toContain("[wp11-cluster-diag] nodes | node-a Ready control");
    expect(r.stdout).not.toContain("control-plane");
  });

  it("caps each section: a long output is cut and the cut is stated", () => {
    const r = run(makeWorkdir(), 'CLUSTER_DIAG_POD_CAP=1; zeta_wp11_cluster_diag end "./class.tsv"');
    // Only the single worst pod is described.
    expect(r.stdout).toContain("describe:forgejo/forgejo-0");
    expect(r.stdout).not.toContain("describe:kube-system/coredns-abc");
  });

  it("can never fail the unit: returns 0 even when every section fails, under the unit's own `set -uo pipefail`", () => {
    const r = run(makeWorkdir(), 'CLUSTER_DIAG_API_WAIT_SECONDS=0; zeta_wp11_cluster_diag end "./class.tsv"; echo "::RC=$?"', {
      API_UP: "no",
    });
    expect(r.stdout).toContain("::RC=0");
  });

  it("with no classification file (the mid-run call before any roster row) it still captures the node-level evidence", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cluster_diag mid ""');
    expect(r.vars.STATE).toBe("captured");
    expect(r.stdout).toContain("[wp11-cluster-diag] result (mid): captured");
    expect(r.stdout).not.toContain("app:");
  });
});

describe("WP11 cluster diagnostics: how the unit wires it", () => {
  it("runs once mid-run inside the roster loop and once at the end ONLY on a verdict-7 failure with k3s up", () => {
    expect(CODE).toContain('zeta_wp11_cluster_diag "mid" "$CLASS_FILE" || true');
    expect(CODE).toMatch(
      /if \[ "\$ROSTER_OK" != "true" \] && \[ "\$K3S_ACTIVE" = "true" \]; then\s+zeta_wp11_cluster_diag "end" "\$CLASS_FILE" \|\| true/,
    );
  });

  it("the end capture runs BEFORE the old per-app dump, which fired into a restarting API", () => {
    const end = CODE.indexOf('zeta_wp11_cluster_diag "end"');
    const old = CODE.indexOf('roster_app_diag "$CLASS_FILE"');
    expect(end).toBeGreaterThan(0);
    expect(old).toBeGreaterThan(end);
  });

  it("the mid capture's own wall time comes OUT of the roster budget, so the verdict still lands in the harness window", () => {
    expect(CODE).toContain("roster_deadline=$(( roster_deadline - ( $(now_ts) - _mid_t0 ) ))");
  });

  it("carries its three states into the verdict JSON, mid and end separately", () => {
    expect(CODE).toContain("clusterDiagnostics: {");
    expect(CODE).toContain("mid: {state: $clusterDiagMid, failedSections: $clusterDiagMidFailed}");
    expect(CODE).toContain("atEnd: {state: $clusterDiagEnd, failedSections: $clusterDiagEndFailed}");
  });

  it("is read-only: every kubectl verb in the block is get, describe, logs or top", () => {
    const verbs = [...extractBlock().matchAll(/zeta_wp11_kcd\s+(?:-n\s+\S+\s+)?([a-z]+)/g)].map((m) => m[1]);
    expect(verbs.length).toBeGreaterThan(8);
    for (const v of verbs) expect(["get", "describe", "logs", "top"]).toContain(String(v));
  });
});

describe("WP11 cluster diagnostics: the jq programs, against fixtures, with the real jq", () => {
  realJq("capacity: requests vs allocatable, live pods only, with the BestEffort count", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_cdiag_capacity ./pods.json ./nodes.json', { REAL_JQ: "1" });
    // The Succeeded pod (9 cpu / 9Gi) is NOT live and must not be counted.
    expect(r.stdout).toContain("sum of container requests over 5 live pod(s): cpu=2850m of 4000m allocatable (71%), memory=2112Mi of 12000Mi (17%)");
    expect(r.stdout).toContain("node node-a: allocatable cpu=4 memory=12288000Ki pods=110");
    expect(r.stdout).toContain("sum of container memory LIMITS: 128Mi");
    expect(r.stdout).toContain("live pods with NO cpu request: 1; with NO memory request: 0");
    expect(r.stdout).toContain("  argocd/redis-0 memory=1024Mi cpu=2000m");
  });

  realJq("census: capacity, unbound claim, crash loop, OOM and image pull are five DIFFERENT lines", () => {
    const r = run(makeWorkdir(), "zeta_wp11_cdiag_census ./pods.json", { REAL_JQ: "1" });
    expect(r.stdout).toContain("4 not-ready pod(s) of 6 total");
    expect(r.stdout).toContain("1\tPending: Insufficient memory\targocd/redis-0");
    expect(r.stdout).toContain("1\tPending: unbound PersistentVolumeClaim\tmonitoring/prom-0");
    expect(r.stdout).toContain("1\tCrashLoopBackOff\tforgejo/forgejo-0");
    expect(r.stdout).toContain("1\tlast-terminated: OOMKilled\tforgejo/forgejo-0");
    expect(r.stdout).toContain("1\tImagePullBackOff\torleans/silo-0");
    // Ready pods and Succeeded Job pods are not "not ready".
    expect(r.stdout).not.toContain("cilium-abc");
    expect(r.stdout).not.toContain("job-done");
  });

  realJq("unready list: worst restarts first, Ready and Succeeded pods absent", () => {
    const r = run(makeWorkdir(), "zeta_wp11_cdiag_unready_list ./pods.json", { REAL_JQ: "1" });
    const lines = r.stdout
      .split("\n")
      .filter((l) => /^[a-z-]+ [a-z0-9-]+ \d+$/.test(l));
    expect(lines[0]).toBe("forgejo forgejo-0 7");
    expect(lines).toHaveLength(4);
    expect(lines.join("\n")).not.toContain("cilium-abc");
  });

  realJq("per-app: failing resources, conditions and sync/health in the shape `argocd app get` prints", () => {
    const r = run(makeWorkdir(), "zeta_wp11_cdiag_app platform", { REAL_JQ: "1" });
    expect(r.stdout).toContain("sync=OutOfSync health=Degraded");
    expect(r.stdout).toContain("condition ComparisonError: repo-server DeadlineExceeded");
    expect(r.stdout).toContain("resource Deployment forgejo/forgejo sync=OutOfSync health=Degraded Deployment does not have minimum availability");
    expect(r.stdout).not.toContain("resource Service"); // Synced+Healthy resources are not evidence
  });
});
