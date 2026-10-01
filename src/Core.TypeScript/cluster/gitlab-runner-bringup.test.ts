/**
 * gitlab-runner-bringup.test.ts -- falsifiers for the runner half of a fresh GitLab install:
 * does the runner get a token, does it survive a slow GitLab, does CI pick up a normal
 * pipeline, and is nothing in the roster BestEffort.
 *
 * Sibling of gitlab-exposure.test.ts (which pins HOW GitLab is reached and THAT a token Job
 * exists ahead of the runner). This file pins what that Job DOES when the world is not ideal.
 *
 *   A. SYNTHETIC -- the analyzer, no `helm`, no `bash`.
 *   B. THE RENDER -- requires `helm` (skipped loudly otherwise):
 *        (a) no long-lived container in the render is BestEffort -- redis (the Sidekiq queue and
 *            session store) and the runner manager shipped `resources: {}`;
 *        (b) job pods carry requests and the runner's concurrency is bounded for ONE node;
 *        (c) the runner is created to take UNTAGGED jobs (a tags-only runner leaves the first
 *            tag-less `.gitlab-ci.yml` Pending forever behind a healthy runner);
 *        (h) the chart's four HPAs (floor 2 / ceiling 10) are bounded to what ONE node holds --
 *            sidekiq scaling toward ten 2 GiB pods on a first-boot CPU spike is an OOM, not scale.
 *   C. THE SCRIPT, EXECUTED -- requires `helm` AND `bash`. The token Job's own script is pulled
 *      out of the render and RUN against a stub `kubectl`/`sleep`:
 *        (d) a token already in the Secret is left alone (idempotent re-sync);
 *        (e) a Rails call that fails twice and then succeeds still ends with the token written --
 *            the pre-fix script made ONE attempt, so a single cold-start blip left the runner
 *            crash-looping on an empty token for good;
 *        (f) a Rails call that never succeeds exits 0 with the operator step printed (a failed
 *            Sync hook would block every later sync) and writes nothing;
 *        (g) the token reaches the Secret and nothing else (exact pin on the Job output).
 *
 * WHAT THIS CANNOT PROVE (recorded, not implied): that `Ci::Runners::CreateRunnerService`
 * accepts these params in GitLab 17.7's Rails, that `runner.token` decrypts for an existing
 * runner, or that the runner pod registers with the minted token. The stub stands in for the
 * toolbox's Rails; only a live node answers those.
 */

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { readAppSource } from "./crd-provider-consumer-order.ts";
import { nameOf, ofKind, type Doc } from "./gitlab-exposure.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const GITLAB_APP = resolve(REPO_ROOT, "full-ai-cluster/k8s/applications/gitlab/Application.yaml");

// ---------------------------------------------------------------------------
// The analyzer under test
// ---------------------------------------------------------------------------

/**
 * Regular containers of long-lived workloads (Deployment / StatefulSet) that request no memory.
 * A pod whose every container is like this is BestEffort: first evicted under node pressure and
 * invisible to the scheduler. Init containers are exempt (they run to completion and the pod's
 * floor is the max of them, not their sum); Jobs are exempt (finite, not eviction-ranked in the
 * way a daemon is).
 */
function requestlessContainers(docs: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const kind of ["Deployment", "StatefulSet"]) {
    for (const w of ofKind(docs, kind)) {
      const spec = (((w["spec"] as Doc | undefined)?.["template"] as Doc | undefined)?.["spec"] ?? {}) as Doc;
      for (const c of ((spec["containers"] ?? []) as Doc[])) {
        const req = ((c["resources"] as Doc | undefined)?.["requests"] ?? {}) as Doc;
        if (req["memory"] === undefined || req["memory"] === null) out.push(`${kind}/${nameOf(w)} ${String(c["name"])}`);
      }
    }
  }
  return out.sort();
}

describe("analyzer", () => {
  test("requestlessContainers names a container with no memory request and nothing else", () => {
    const sts = (name: string, resources: unknown) => ({
      kind: "StatefulSet",
      metadata: { name },
      spec: { template: { spec: { containers: [{ name: "c", resources }] } } },
    });
    const docs = [sts("bare", {}), sts("nores", undefined), sts("ok", { requests: { cpu: "10m", memory: "16Mi" } })];
    expect(requestlessContainers(docs)).toEqual(["StatefulSet/bare c", "StatefulSet/nores c"]);
    expect(requestlessContainers([{ kind: "ConfigMap", metadata: { name: "x" } }])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// B. The render
// ---------------------------------------------------------------------------

function probe(cmd: string[]): boolean {
  try {
    return Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
  } catch {
    return false;
  }
}
const HELM = probe(["helm", "version", "--short"]);
const BASH = probe(["bash", "-c", "exit 0"]);
if (!HELM) console.warn("gitlab-runner-bringup.test: helm not on PATH -- the render halves are SKIPPED, not passed");
if (HELM && !BASH) console.warn("gitlab-runner-bringup.test: bash not on PATH -- the script-execution half is SKIPPED, not passed");

let cached: { docs: Doc[] } | null = null;
function renderGitlab(): { docs: Doc[] } {
  if (cached !== null) return cached;
  const source = readAppSource(readFileSync(GITLAB_APP, "utf8"));
  const dir = mkdtempSync(join(tmpdir(), "gitlab-runner-bringup-"));
  try {
    const valuesFile = join(dir, "values.yaml");
    writeFileSync(valuesFile, stringifyYaml(source.valuesObject ?? {}), "utf8");
    const result = Bun.spawnSync(
      [
        "helm", "template", source.releaseName ?? "gitlab", source.chart ?? "", "--repo", source.repoURL ?? "",
        "--version", source.version ?? "", "--namespace", source.namespace ?? "default", "--values", valuesFile,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (result.exitCode !== 0) throw new Error(`helm template gitlab failed: ${result.stderr.toString()}`);
    cached = { docs: parseAllDocuments(result.stdout.toString()).map((d) => d.toJS({ maxAliasCount: -1 }) as Doc).filter(Boolean) };
    return cached;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const T = { timeout: 180_000 };

describe.skipIf(!HELM)("gitlab render -- runner and QoS", () => {
  test("(a) no long-lived container requests nothing -- redis and the runner manager used to", () => {
    expect(requestlessContainers(renderGitlab().docs)).toEqual([]);
  }, T);

  test("(b) job pods carry requests, and concurrency is bounded for a single node", () => {
    const cm = ofKind(renderGitlab().docs, "ConfigMap").find((c) => nameOf(c) === "gitlab-gitlab-runner");
    const data = (cm?.["data"] ?? {}) as Record<string, string>;
    const template = String(data["config.template.toml"] ?? "");
    for (const key of ["cpu_request", "memory_request", "helper_cpu_request", "helper_memory_request"]) {
      expect(template).toMatch(new RegExp(`^\\s*${key}\\s*=`, "m"));
    }
    const concurrent = /^concurrent\s*=\s*(\d+)/m.exec(String(data["config.toml"] ?? ""));
    expect(concurrent).not.toBeNull();
    expect(Number(concurrent![1])).toBeLessThanOrEqual(4);
  }, T);

  test("(h) no HPA can scale a GitLab tier past what one node holds: floor 1, ceiling 2", () => {
    const hpas = ofKind(renderGitlab().docs, "HorizontalPodAutoscaler");
    // Not vacuous: the chart renders four (webservice, sidekiq, registry, gitlab-shell).
    expect(hpas.map(nameOf).sort()).toEqual([
      "gitlab-gitlab-shell",
      "gitlab-registry",
      "gitlab-sidekiq-all-in-1-v2",
      "gitlab-webservice-default",
    ]);
    const bounds = hpas.map((h) => {
      const spec = (h["spec"] ?? {}) as Doc;
      return `${nameOf(h)} ${String(spec["minReplicas"])}..${String(spec["maxReplicas"])}`;
    });
    for (const b of bounds) {
      const [, min, max] = /(\d+)\.\.(\d+)$/.exec(b) ?? [];
      expect(Number(min), b).toBe(1);
      expect(Number(max), b).toBeLessThanOrEqual(2);
    }
  }, T);

  test("(c) the runner is created to take untagged jobs, so a tag-less .gitlab-ci.yml does not sit Pending", () => {
    const script = mintScript(renderGitlab().docs);
    expect(script).toContain("run_untagged: true");
    expect(script).not.toContain("run_untagged: false");
  }, T);
});

function mintScript(docs: readonly unknown[]): string {
  const job = ofKind(docs, "Job").find((j) => nameOf(j) === "gitlab-runner-token");
  const containers = ((((job?.["spec"] as Doc | undefined)?.["template"] as Doc | undefined)?.["spec"] as Doc | undefined)?.[
    "containers"
  ] ?? []) as Doc[];
  const args = (containers[0]?.["args"] ?? []) as string[];
  if (typeof args[0] !== "string") throw new Error("Job/gitlab-runner-token has no script in containers[0].args[0]");
  return args[0];
}

// ---------------------------------------------------------------------------
// C. The script, executed against stubs
// ---------------------------------------------------------------------------

const TOKEN = "glrt-t3_aBcD-123_xyz";

interface Scenario {
  /** Value `kubectl get secret -o jsonpath` prints for .data.runner-token. */
  existing?: string;
  /** The first N `kubectl exec` calls fail (non-zero, stderr noise). Infinity = always. */
  execFailures?: number;
}
interface Outcome {
  exitCode: number;
  stdout: string;
  execCalls: number;
  patch: Record<string, unknown> | null;
}

const KUBECTL_STUB = `#!/usr/bin/env bash
state="$STUB_DIR"
echo "$*" >> "$state/calls.log"
case " $* " in
  *" get secret "*) printf '%s' "$(cat "$state/existing" 2>/dev/null)"; exit 0 ;;
  *" exec "*)
    n=$(cat "$state/exec-count" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "$state/exec-count"
    fails=$(cat "$state/exec-failures" 2>/dev/null || echo 0)
    if [ "$fails" = "inf" ] || [ "$n" -le "$fails" ]; then echo "error: toolbox not answering (attempt $n)" >&2; exit 1; fi
    printf 'DEPRECATION WARNING: noise before the token\\n\\n%s' "$STUB_TOKEN"
    exit 0 ;;
  *" patch "*)
    prev=""
    for a in "$@"; do if [ "$prev" = "--patch-file" ]; then cp "$a" "$state/patch.json"; fi; prev="$a"; done
    exit 0 ;;
esac
echo "stub kubectl: unexpected invocation: $*" >&2
exit 99
`;

/** One syscall, one answer: ENOENT is "the stub never wrote it", not a race to guard. */
function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

function runScript(script: string, scenario: Scenario, extraEnv: Record<string, string> = {}): Outcome {
  const dir = mkdtempSync(join(tmpdir(), "mint-stub-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    for (const [name, body] of [["kubectl", KUBECTL_STUB], ["sleep", "#!/usr/bin/env bash\nexit 0\n"]] as const) {
      writeFileSync(join(bin, name), body, { encoding: "utf8" });
      chmodSync(join(bin, name), 0o755);
    }
    writeFileSync(join(dir, "existing"), scenario.existing ?? "", "utf8");
    writeFileSync(join(dir, "exec-failures"), scenario.execFailures === Infinity ? "inf" : String(scenario.execFailures ?? 0), "utf8");
    writeFileSync(join(dir, "script.sh"), script, "utf8");
    const toPosix = (p: string) => p.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
    const onWindows = process.platform === "win32";
    const env: Record<string, string | undefined> = { ...process.env };
    const inheritedPath = process.env["PATH"] ?? process.env["Path"] ?? "";
    for (const k of Object.keys(env)) if (k.toLowerCase() === "path") delete env[k];
    const run = Bun.spawnSync(["bash", onWindows ? toPosix(join(dir, "script.sh")) : join(dir, "script.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...env,
        PATH: `${bin}${delimiter}${inheritedPath}`,
        STUB_DIR: onWindows ? toPosix(dir) : dir,
        STUB_TOKEN: TOKEN,
        ...extraEnv,
      },
    });
    const countFile = join(dir, "exec-count");
    const patchFile = join(dir, "patch.json");
    return {
      exitCode: run.exitCode ?? -1,
      stdout: run.stdout.toString() + run.stderr.toString(),
      execCalls: Number(readIfPresent(countFile)?.trim() ?? "0"),
      patch: ((t) => (t === null ? null : (JSON.parse(t) as Record<string, unknown>)))(readIfPresent(patchFile)),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!HELM || !BASH)("token Job script, executed", () => {
  const FAST = { MINT_MAX_ATTEMPTS: "5" };

  test("(d) a token already in the Secret is left alone: no Rails call, no patch", () => {
    const out = runScript(mintScript(renderGitlab().docs), { existing: "Z2xydC1zb21ldGhpbmc=" }, FAST);
    expect(out.exitCode).toBe(0);
    expect(out.execCalls).toBe(0);
    expect(out.patch).toBeNull();
    expect(out.stdout).toContain("already present");
  }, T);

  test("(e) a Rails call that fails twice and then succeeds still writes the token", () => {
    const out = runScript(mintScript(renderGitlab().docs), { execFailures: 2 }, FAST);
    expect(out.exitCode).toBe(0);
    expect(out.execCalls).toBe(3);
    const data = (out.patch?.["data"] ?? {}) as Record<string, string>;
    expect(Buffer.from(data["runner-token"] ?? "", "base64").toString("utf8")).toBe(TOKEN);
    // The registration token is blanked in the same patch: with both set the runner would try
    // the removed registration-token flow beside the glrt- one.
    expect(data["runner-registration-token"]).toBe("");
  }, T);

  test("(f) a Rails call that never succeeds exits 0, prints the operator step, writes nothing", () => {
    const out = runScript(mintScript(renderGitlab().docs), { execFailures: Infinity }, FAST);
    expect(out.exitCode).toBe(0);
    expect(out.execCalls).toBe(5);
    expect(out.patch).toBeNull();
    expect(out.stdout).toContain("Operator step");
  }, T);

  test("(g) the token reaches the Secret and nothing else: the Job's whole output is two known lines", () => {
    const out = runScript(mintScript(renderGitlab().docs), { execFailures: 1 }, FAST);
    expect(out.patch).not.toBeNull();
    // An EXACT pin on the whole output, so a leaked token (or any new line) is a diff rather
    // than a negative assertion that witnesses one rendering of the leak.
    expect(out.stdout).toBe(
      "attempt 1: no glrt- token yet; retrying\nminted a glrt- runner token into gitlab-gitlab-runner-secret\n",
    );
  }, T);
});
