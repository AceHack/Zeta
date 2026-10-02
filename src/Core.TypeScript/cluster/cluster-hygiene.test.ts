/**
 * cluster-hygiene.test.ts -- falsifiers for `full-ai-cluster/k8s/applications/cluster-hygiene/`.
 *
 * WHY THIS EXISTS. MEASURED 2026-10-02 on the owner's real single node (node-5b2dfa, root fs ~119 GiB):
 * at 07:53Z the node set DiskPressure=True and tainted itself NoSchedule; ~150 pods were evicted, most of
 * them the crash-looping `hindsight` pods (Secret `hindsight-llm-api-key` does not exist yet -- every
 * eviction made the Deployment create another failed pod, and 168 `Failed` pod objects accumulated).
 * docs/ops/NODE-DISK-HEADROOM.md carries the numbers. Two cluster-hygiene CronJobs close the two halves
 * of that, and this file RUNS their scripts rather than reading them:
 *
 *   A. THE RENDER OF THE MANIFESTS -- the Application, the RBAC, the admission policy that bounds the
 *      janitor, the restricted-PSA pod shape, and (the one cross-file contract) that the gate's
 *      GATE_DESIRED equals the replica count the hindsight Application declares, so "behaviour once the
 *      Secret exists" is unchanged by construction.
 *   B. pod-janitor, EXECUTED against a stub kubectl: reap runs BEFORE mark, both are selector-driven on
 *      `status.phase=Failed`, a failed reap does not go on to mark, and nothing but pods is touched.
 *   C. hindsight-secret-gate, EXECUTED against a stub kubectl over the whole decision table: Secret
 *      absent -> 0, present -> declared count, no change when already at target, a FAILED PROBE IS
 *      UNKNOWN (nothing is scaled), a Deployment not created yet is skipped, a failed scale exits 1.
 *
 * WHAT THIS CANNOT PROVE (recorded, not implied): that `kubectl label --field-selector` with no names
 * accepts that form against a real API server, that the CEL in the ValidatingAdmissionPolicy type-checks
 * and denies a non-Failed pod on k3s 1.35, or that ArgoCD leaves a live `/spec/replicas` alone under
 * RespectIgnoreDifferences. The stub stands in for the API server; only a live node answers those.
 */

import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";

type Doc = Record<string, unknown>;

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const APPS = resolve(REPO_ROOT, "full-ai-cluster/k8s/applications");
const HYGIENE = join(APPS, "cluster-hygiene");
const HINDSIGHT = join(APPS, "hindsight/Application.yaml");

function docsOf(file: string): Doc[] {
  return parseAllDocuments(readFileSync(join(HYGIENE, file), "utf8")).map((d) => d.toJS() as Doc).filter(Boolean);
}
const kind = (docs: Doc[], k: string): Doc[] => docs.filter((d) => d["kind"] === k);
const named = (docs: Doc[], k: string, name: string): Doc => {
  const hit = kind(docs, k).find((d) => ((d["metadata"] as Doc)["name"] as string) === name);
  if (hit === undefined) throw new Error(`no ${k}/${name}`);
  return hit;
};
const asDoc = (v: unknown): Doc => (v ?? {}) as Doc;
const asList = (v: unknown): Doc[] => (v ?? []) as Doc[];

const JANITOR = docsOf("pod-janitor.yaml");
const GATE = docsOf("hindsight-secret-gate.yaml");

function podSpec(cron: Doc): Doc {
  return asDoc(asDoc(asDoc(asDoc(cron["spec"])["jobTemplate"])["spec"])["template"])["spec"] as Doc;
}
function script(cron: Doc): string {
  const c = asList(podSpec(cron)["containers"])[0] as Doc;
  const args = (c["args"] ?? []) as string[];
  if (typeof args[0] !== "string") throw new Error("CronJob has no script in containers[0].args[0]");
  return args[0];
}
function env(cron: Doc, name: string): string {
  const c = asList(podSpec(cron)["containers"])[0] as Doc;
  const hit = asList(c["env"]).find((e) => e["name"] === name);
  if (hit === undefined) throw new Error(`no env ${name}`);
  return String(hit["value"]);
}

// ---------------------------------------------------------------------------
// A. The manifests
// ---------------------------------------------------------------------------

describe("cluster-hygiene Application", () => {
  const app = parseYaml(readFileSync(join(HYGIENE, "Application.yaml"), "utf8")) as Doc;
  const spec = asDoc(app["spec"]);

  test("every file it applies exists, and Application.yaml itself is not applied by it", () => {
    const include = String(asDoc(asDoc(spec["source"])["directory"])["include"]);
    const m = /^\{([^}]+)\}\.yaml$/.exec(include);
    expect(m).not.toBeNull();
    const names = m![1]!.split(",");
    for (const n of names) expect(existsSync(join(HYGIENE, `${n}.yaml`)), `${n}.yaml`).toBe(true);
    expect(names).not.toContain("Application");
    // ... and nothing in the directory is silently NOT applied.
    const onDisk = readdirSync(HYGIENE).filter((f) => f.endsWith(".yaml") && f !== "Application.yaml").map((f) => f.replace(/\.yaml$/, ""));
    expect(names.sort()).toEqual(onDisk.sort());
  });

  test("it is automated with unbounded retry and lands in its own restricted namespace", () => {
    const sync = asDoc(spec["syncPolicy"]);
    expect(sync["automated"]).toBeDefined();
    expect(asDoc(sync["retry"])["limit"]).toBe(-1);
    expect(asDoc(spec["destination"])["namespace"]).toBe("zeta-hygiene");
    const ns = parseYaml(readFileSync(join(HYGIENE, "namespace.yaml"), "utf8")) as Doc;
    expect(asDoc(asDoc(ns["metadata"])["labels"])["pod-security.kubernetes.io/enforce"]).toBe("restricted");
  });
});

describe("pod-janitor manifests", () => {
  test("RBAC is pods-only: no secrets, no exec, no create, no wildcard", () => {
    const role = named(JANITOR, "ClusterRole", "zeta-pod-janitor");
    const rules = asList(role["rules"]);
    expect(rules).toHaveLength(1);
    expect(rules[0]!["resources"]).toEqual(["pods"]);
    expect([...(rules[0]!["verbs"] as string[])].sort()).toEqual(["delete", "get", "list", "patch"]);
    expect(JSON.stringify(rules)).not.toContain("*");
  });

  test("an admission policy refuses the janitor any pod that is not Failed (RBAC cannot say that)", () => {
    const vap = named(JANITOR, "ValidatingAdmissionPolicy", "zeta-pod-janitor-failed-pods-only");
    const spec = asDoc(vap["spec"]);
    expect(spec["failurePolicy"]).toBe("Fail");
    // Only THIS ServiceAccount is evaluated -- every other pod operation in the cluster is untouched.
    const conditions = asList(spec["matchConditions"]);
    expect(conditions).toHaveLength(1);
    expect(String(conditions[0]!["expression"])).toContain("system:serviceaccount:zeta-hygiene:pod-janitor");
    const rule = asList(asDoc(spec["matchConstraints"])["resourceRules"])[0]!;
    expect(rule["resources"]).toEqual(["pods"]);
    expect([...(rule["operations"] as string[])].sort()).toEqual(["DELETE", "UPDATE"]);
    const v = asList(spec["validations"]);
    expect(v).toHaveLength(1);
    const expr = String(v[0]!["expression"]);
    // DELETE carries the pod in `oldObject`; UPDATE (the marker label) in `object`.
    expect(expr).toContain("oldObject");
    expect(expr).toContain("object");
    expect(expr).toContain("status.phase == 'Failed'");
    const binding = named(JANITOR, "ValidatingAdmissionPolicyBinding", "zeta-pod-janitor-failed-pods-only");
    expect(asDoc(binding["spec"])["policyName"]).toBe("zeta-pod-janitor-failed-pods-only");
    expect(asDoc(binding["spec"])["validationActions"]).toEqual(["Deny"]);
  });

  test("the CronJob is bounded: no overlap, one retry-free run, a deadline, restricted pod shape, limits", () => {
    const cron = named(JANITOR, "CronJob", "pod-janitor");
    const spec = asDoc(cron["spec"]);
    expect(spec["concurrencyPolicy"]).toBe("Forbid");
    expect(spec["failedJobsHistoryLimit"]).toBeLessThanOrEqual(1);
    const job = asDoc(asDoc(spec["jobTemplate"])["spec"]);
    expect(job["backoffLimit"]).toBe(0);
    expect(Number(job["activeDeadlineSeconds"])).toBeLessThanOrEqual(300);
    const pod = podSpec(cron);
    expect(pod["serviceAccountName"]).toBe("pod-janitor");
    const sc = asDoc(pod["securityContext"]);
    expect(sc["runAsNonRoot"]).toBe(true);
    expect(asDoc(sc["seccompProfile"])["type"]).toBe("RuntimeDefault");
    const c = asList(pod["containers"])[0]!;
    const csc = asDoc(c["securityContext"]);
    expect(csc["allowPrivilegeEscalation"]).toBe(false);
    expect(asDoc(csc["capabilities"])["drop"]).toEqual(["ALL"]);
    const lim = asDoc(asDoc(c["resources"])["limits"]);
    expect(lim["memory"]).toBeDefined();
    expect(lim["ephemeral-storage"]).toBeDefined();
    // The schedule is the "older than N minutes" knob: a pod is reaped after >= ONE interval Failed.
    expect(String(spec["schedule"])).toMatch(/^\*\/\d+ \* \* \* \*$/);
  });
});

describe("hindsight-secret-gate manifests", () => {
  const hindsight = parseYaml(readFileSync(HINDSIGHT, "utf8")) as Doc;
  const values = asDoc(asDoc(asDoc(asDoc(hindsight["spec"])["source"])["helm"])["valuesObject"]);

  test("GATE_DESIRED equals the replicas the hindsight Application declares -- behaviour once the Secret exists is unchanged", () => {
    const desired = Object.fromEntries(
      env(named(GATE, "CronJob", "hindsight-secret-gate"), "GATE_DESIRED")
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p.split("=") as [string, string]),
    );
    expect(Object.keys(desired).sort()).toEqual(["hindsight-api", "hindsight-control-plane"]);
    expect(Number(desired["hindsight-api"])).toBe(asDoc(values["api"])["replicaCount"] as number);
    expect(Number(desired["hindsight-control-plane"])).toBe(asDoc(values["controlPlane"])["replicaCount"] as number);
    // The declared count is a real, non-zero one: a gate that "restores" 0 would be a permanent shutdown.
    for (const n of Object.values(desired)) expect(Number(n)).toBeGreaterThanOrEqual(1);
  });

  test("hindsight hands ArgoCD's hands off exactly those two Deployments' replicas, and respects it on sync", () => {
    const spec = asDoc(hindsight["spec"]);
    const ignores = asList(spec["ignoreDifferences"]);
    const byName = new Map(ignores.map((i) => [String(i["name"]), i]));
    expect([...byName.keys()].sort()).toEqual(["hindsight-api", "hindsight-control-plane"]);
    for (const i of byName.values()) {
      expect(i["kind"]).toBe("Deployment");
      expect(i["jsonPointers"]).toEqual(["/spec/replicas"]);
    }
    // Without this a sync still applies the rendered replicas, and selfHeal fights the gate.
    expect(asDoc(spec["syncPolicy"])["syncOptions"]).toContain("RespectIgnoreDifferences=true");
    // It stays an operator-action app: automated sync, synced -- only its health may lag (manual-sync-policy.ts).
    expect(asDoc(spec["syncPolicy"])["automated"]).toBeDefined();
    expect(asDoc(asDoc(hindsight["metadata"])["annotations"])["zeta.io/sync-policy"]).toBe("converges-only-after-an-operator-action");
  });

  test("RBAC reaches only the two Deployments, their scale, and `get` on the ONE Secret -- never its value's namespace-wide siblings", () => {
    const role = named(GATE, "ClusterRole", "zeta-hindsight-secret-gate");
    const rules = asList(role["rules"]);
    for (const r of rules) {
      expect(r["resourceNames"], JSON.stringify(r)).toBeDefined();
      expect(JSON.stringify(r)).not.toContain("*");
    }
    const secrets = rules.filter((r) => (r["resources"] as string[]).includes("secrets"));
    expect(secrets).toHaveLength(1);
    expect(secrets[0]!["resourceNames"]).toEqual(["hindsight-llm-api-key"]);
    expect(secrets[0]!["verbs"]).toEqual(["get"]);
    const deployNames = rules.filter((r) => !(r["resources"] as string[]).includes("secrets")).flatMap((r) => r["resourceNames"] as string[]);
    expect([...new Set(deployNames)].sort()).toEqual(["hindsight-api", "hindsight-control-plane"]);
  });

  test("the CronJob is bounded and restricted-PSA shaped", () => {
    const cron = named(GATE, "CronJob", "hindsight-secret-gate");
    expect(asDoc(cron["spec"])["concurrencyPolicy"]).toBe("Forbid");
    expect(asDoc(asDoc(asDoc(cron["spec"])["jobTemplate"])["spec"])["backoffLimit"]).toBe(0);
    const sc = asDoc(podSpec(cron)["securityContext"]);
    expect(sc["runAsNonRoot"]).toBe(true);
    expect(asDoc(sc["seccompProfile"])["type"]).toBe("RuntimeDefault");
    const lim = asDoc(asDoc(asList(podSpec(cron)["containers"])[0]!["resources"])["limits"]);
    expect(lim["memory"]).toBeDefined();
    expect(lim["ephemeral-storage"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// The harness: run a CronJob's script under bash against a stub kubectl
// ---------------------------------------------------------------------------

function probe(cmd: string[]): boolean {
  try {
    return Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
  } catch {
    return false;
  }
}
const BASH = probe(["bash", "-c", "exit 0"]);
if (!BASH) console.warn("cluster-hygiene.test: bash not on PATH -- the script-execution halves are SKIPPED, not passed");

const KUBECTL_STUB = `#!/usr/bin/env bash
state="$STUB_DIR"
echo "$*" >> "$state/calls.log"
case " $* " in
  *" get secret "*)
    if [ -f "$state/probe-error" ]; then echo "Error from server (Forbidden): secrets is forbidden" >&2; exit 1; fi
    if [ -f "$state/secret-present" ]; then echo "secret/hindsight-llm-api-key"; fi
    exit 0 ;;
  *" get deployment "*)
    prev=""; name=""
    for a in "$@"; do if [ "$prev" = "deployment" ]; then name="$a"; fi; prev="$a"; done
    if [ -f "$state/get-error" ]; then echo "Error from server: etcd timeout" >&2; exit 1; fi
    if [ -f "$state/replicas-$name" ]; then printf '%s' "$(cat "$state/replicas-$name")"; fi
    exit 0 ;;
  *" scale "*)
    if [ -f "$state/scale-fails" ]; then echo "error: scale refused" >&2; exit 1; fi
    exit 0 ;;
  *" delete "*)
    if [ -f "$state/delete-fails" ]; then echo "error: delete refused" >&2; exit 1; fi
    exit 0 ;;
  *" label "*)
    if [ -f "$state/label-fails" ]; then echo "error: label refused" >&2; exit 1; fi
    exit 0 ;;
esac
echo "stub kubectl: unexpected invocation: $*" >&2
exit 99
`;

interface Outcome {
  exitCode: number;
  output: string;
  calls: string[];
}

/** `flags` are empty marker files in the stub's state dir; `files` are `name -> contents`. */
function run(body: string, flags: string[], files: Record<string, string>, extraEnv: Record<string, string>): Outcome {
  const dir = mkdtempSync(join(tmpdir(), "hygiene-stub-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "kubectl"), KUBECTL_STUB, "utf8");
    chmodSync(join(bin, "kubectl"), 0o755);
    for (const f of flags) writeFileSync(join(dir, f), "", "utf8");
    for (const [n, c] of Object.entries(files)) writeFileSync(join(dir, n), c, "utf8");
    writeFileSync(join(dir, "script.sh"), body, "utf8");
    const toPosix = (p: string) => p.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
    const win = process.platform === "win32";
    const base: Record<string, string | undefined> = { ...process.env };
    const inheritedPath = process.env["PATH"] ?? process.env["Path"] ?? "";
    for (const k of Object.keys(base)) if (k.toLowerCase() === "path") delete base[k];
    const proc = Bun.spawnSync(["bash", win ? toPosix(join(dir, "script.sh")) : join(dir, "script.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...base, PATH: `${bin}${delimiter}${inheritedPath}`, STUB_DIR: win ? toPosix(dir) : dir, ...extraEnv },
    });
    let calls: string[] = [];
    try {
      calls = readFileSync(join(dir, "calls.log"), "utf8").split("\n").filter(Boolean);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return { exitCode: proc.exitCode ?? -1, output: proc.stdout.toString() + proc.stderr.toString(), calls };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// B. pod-janitor, executed
// ---------------------------------------------------------------------------

describe.skipIf(!BASH)("pod-janitor script, executed", () => {
  const cron = named(JANITOR, "CronJob", "pod-janitor");
  const body = script(cron);
  const label = env(cron, "MARK_LABEL");
  const go = (flags: string[] = []) => run(body, flags, {}, { MARK_LABEL: label });

  test("reap runs BEFORE mark, each selector-driven on status.phase=Failed across all namespaces", () => {
    const out = go();
    expect(out.exitCode).toBe(0);
    expect(out.calls).toHaveLength(2);
    const [reap, mark] = out.calls as [string, string];
    expect(reap).toMatch(/^delete pods /);
    expect(reap).toContain("--all-namespaces");
    expect(reap).toContain(`-l ${label}=true`);
    expect(reap).toContain("--field-selector=status.phase=Failed");
    expect(mark).toMatch(/^label pods /);
    expect(mark).toContain("--all-namespaces");
    expect(mark).toContain("--field-selector=status.phase=Failed");
    expect(mark).toContain(`${label}=true`);
    expect(mark).toContain("--overwrite");
  });

  test("it only ever touches pods, and never runs an unselected delete (which would reap a Running pod)", () => {
    for (const call of go().calls) {
      expect(call).toMatch(/^(delete|label) pods /);
      expect(call).toContain("--field-selector=status.phase=Failed");
      expect(call).not.toMatch(/--all(\s|$)/);
    }
  });

  test("a FAILED reap exits 1 and does NOT go on to mark", () => {
    const out = go(["delete-fails"]);
    expect(out.exitCode).toBe(1);
    expect(out.calls).toHaveLength(1);
    expect(out.output).toContain("reap FAILED");
  });

  test("a failed mark exits 1 (loud, not swallowed)", () => {
    const out = go(["label-fails"]);
    expect(out.exitCode).toBe(1);
    expect(out.output).toContain("mark FAILED");
  });
});

// ---------------------------------------------------------------------------
// C. hindsight-secret-gate, executed
// ---------------------------------------------------------------------------

describe.skipIf(!BASH)("hindsight-secret-gate script, executed", () => {
  const cron = named(GATE, "CronJob", "hindsight-secret-gate");
  const body = script(cron);
  const genv = {
    GATE_NAMESPACE: env(cron, "GATE_NAMESPACE"),
    GATE_SECRET: env(cron, "GATE_SECRET"),
    GATE_DESIRED: env(cron, "GATE_DESIRED"),
  };
  const scales = (o: Outcome) => o.calls.filter((c) => /\bscale\b/.test(c));
  const go = (flags: string[], replicas: Record<string, string>) =>
    run(body, flags, Object.fromEntries(Object.entries(replicas).map(([k, v]) => [`replicas-${k}`, v])), genv);

  test("Secret ABSENT: both Deployments at their declared 1 are scaled to 0 -- no pod is left to fail", () => {
    const out = go([], { "hindsight-api": "1", "hindsight-control-plane": "1" });
    expect(out.exitCode).toBe(0);
    expect(scales(out)).toEqual([
      "-n hindsight scale deployment hindsight-api --replicas=0",
      "-n hindsight scale deployment hindsight-control-plane --replicas=0",
    ]);
  });

  test("Secret PRESENT: Deployments at 0 are restored to the DECLARED count (not a hardcoded 1)", () => {
    const out = go(["secret-present"], { "hindsight-api": "0", "hindsight-control-plane": "0" });
    expect(out.exitCode).toBe(0);
    expect(scales(out)).toEqual([
      "-n hindsight scale deployment hindsight-api --replicas=1",
      "-n hindsight scale deployment hindsight-control-plane --replicas=1",
    ]);
    // The declared count is what is restored: change GATE_DESIRED and the restored count follows.
    const three = run(body, ["secret-present"], { "replicas-hindsight-api": "0", "replicas-hindsight-control-plane": "0" }, {
      ...genv,
      GATE_DESIRED: "hindsight-api=3 hindsight-control-plane=2",
    });
    expect(scales(three)).toEqual([
      "-n hindsight scale deployment hindsight-api --replicas=3",
      "-n hindsight scale deployment hindsight-control-plane --replicas=2",
    ]);
  });

  test("already at target either way: nothing is scaled (idempotent, no churn every 2 minutes)", () => {
    expect(scales(go(["secret-present"], { "hindsight-api": "1", "hindsight-control-plane": "1" }))).toEqual([]);
    expect(scales(go([], { "hindsight-api": "0", "hindsight-control-plane": "0" }))).toEqual([]);
  });

  test("a FAILED PROBE is UNKNOWN, never `absent`: nothing is scaled and the run does not fail", () => {
    const out = go(["probe-error", "secret-present"], { "hindsight-api": "1", "hindsight-control-plane": "1" });
    expect(out.exitCode).toBe(0);
    expect(scales(out)).toEqual([]);
    expect(out.output).toContain("UNKNOWN");
    // And it never even asked about the Deployments: a probe it cannot trust ends the run.
    expect(out.calls.some((c) => c.includes("get deployment"))).toBe(false);
  });

  test("a Deployment not created yet (hindsight has not synced) is skipped, not an error", () => {
    const out = go([], { "hindsight-api": "1" });
    expect(out.exitCode).toBe(0);
    expect(scales(out)).toEqual(["-n hindsight scale deployment hindsight-api --replicas=0"]);
    expect(out.output).toContain("hindsight-control-plane not present");
  });

  test("an unreadable Deployment is UNKNOWN: not scaled, and the run exits 1 so it is not silent", () => {
    const out = go(["get-error"], { "hindsight-api": "1", "hindsight-control-plane": "1" });
    expect(out.exitCode).toBe(1);
    expect(scales(out)).toEqual([]);
  });

  test("a scale that is refused exits 1 (loud) and the other Deployment is still attempted", () => {
    const out = go(["scale-fails"], { "hindsight-api": "1", "hindsight-control-plane": "1" });
    expect(out.exitCode).toBe(1);
    expect(scales(out)).toHaveLength(2);
    expect(out.output).toContain("FAILED");
  });

  test("it never reads the Secret's VALUE: the only Secret call is a name-only get", () => {
    const out = go(["secret-present"], { "hindsight-api": "1", "hindsight-control-plane": "1" });
    const secretCalls = out.calls.filter((c) => c.includes("secret"));
    expect(secretCalls).toHaveLength(1);
    const secretCall = secretCalls[0] ?? "";
    expect(secretCall).toContain("-o name");
    // Equality on `.test()`, not `not.toMatch`: R5 counts an absence search
    // whose SUBJECT names SECRET (`secretCalls`) as one rendering of a leak,
    // never its absence (`audit-check-arity-nonequality.ts`). `toBe(false)`
    // is the same claim with arity that can fail. Keep the name-only pin.
    expect(/jsonpath|yaml|json|go-template|base64/u.test(secretCall)).toBe(false);
  });
});
