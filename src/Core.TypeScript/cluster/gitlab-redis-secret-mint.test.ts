/**
 * gitlab-redis-secret-mint.test.ts -- falsifiers for "on a FRESH install something mints the Redis password the
 * GitLab release's Valkey and `global.redis.auth` both read" (full-ai-cluster/k8s/applications/gitlab/Application.yaml).
 *
 * THE FAILURE (measured every `gitlab-live-proof` run since #17875 merged, 2026-10-02; workitem
 * 081M48Z8EFR087G0R0036W46S4): `gitlab-valkey-0` sits in CreateContainerConfigError, `secret "gitlab-redis-secret"
 * not found`, for the whole 45-minute wait, the ArgoCD operation never leaves wave -2, and the (a) checks report "no
 * Deployment/StatefulSet labelled app=webservice exists yet". Chart 10.4.1's shared-secrets Job has no redis branch
 * (the bundled Redis it used to mint for is gone), so the Secret only ever existed on a node that inherited it from
 * the bundled-Redis era. A rebuilt node, a disaster recovery and the proof lane all have no such leftover.
 *
 * The password has ONE owner now: the release's own wave -3 Sync hook Job, named after the Secret it ensures, which
 * runs before the Valkey StatefulSet (wave -2) and before anything that reads the Secret.
 *
 *   A. THE RENDER -- requires `helm` (skipped loudly otherwise). The Secret name and key come from
 *      `global.redis.auth`: the Valkey container, the Job and its Role must all agree with it.
 *        (a) the Job exists, is a Sync hook, and runs in an earlier wave than the Valkey StatefulSet;
 *        (b) its ServiceAccount, Role and RoleBinding are applied in an earlier wave than the Job;
 *        (c) the Valkey container and the Job's own SECRET_NAME / SECRET_KEY read exactly the Secret and key
 *            `global.redis.auth` names (the secret-reference audits read the manifest unrendered, so these stay
 *            literals and this test is what pins every copy to the one owner);
 *        (d) the Job may read ONLY that Secret and may create Secrets -- it can neither list nor overwrite.
 *   B. THE SCRIPT, EXECUTED -- requires `helm` AND `bash`. The Job's own script is pulled out of the render and RUN
 *      against a stub `kubectl` backed by a directory standing in for the namespace's Secrets:
 *        (e) no Secret yet            -> one is created with a long random value under the declared key;
 *        (f) a Secret already exists  -> it is left byte-identical (the live node's inherited password survives);
 *        (g) run twice                -> the second run changes nothing (idempotence);
 *        (h) an existing Secret that lacks the key -> the Job FAILS (Valkey would not start; say so at the source);
 *        (i) create is refused and no Secret exists -> the Job FAILS, never reports success.
 *
 * WHAT THIS CANNOT PROVE: that the ArgoCD sync really finishes a wave -3 hook before it creates wave -2 objects
 * (a documented ArgoCD guarantee) or that the CNG kubectl image carries `od` and `tr` (coreutils; the image's own
 * shared-secrets script uses `tr`, `head`, `base64`). The first live-proof run after this lands is the proof.
 */

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { nameOf, ofKind, type Doc } from "./gitlab-exposure.ts";
import { gitlabApplicationValues, renderGitlabRelease } from "./gitlab-render.ts";

const SYNC_WAVE = "argocd.argoproj.io/sync-wave";
const HOOK = "argocd.argoproj.io/hook";
const VALKEY = { statefulSet: "gitlab-valkey", container: "valkey" } as const;
const PASSWORD_ENV = "REDIS_PASSWORD";

const T = { timeout: 180_000 };

function probe(cmd: string[]): boolean {
  try {
    return Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
  } catch {
    return false;
  }
}
const HELM = probe(["helm", "version", "--short"]);
const BASH = probe(["bash", "-c", "exit 0"]);
if (!HELM) console.warn("gitlab-redis-secret-mint.test: helm not on PATH -- the render halves are SKIPPED, not passed");
if (HELM && !BASH) console.warn("gitlab-redis-secret-mint.test: bash not on PATH -- the script-execution half is SKIPPED, not passed");

// ---------------------------------------------------------------------------
// Reading the render
// ---------------------------------------------------------------------------

const dig = (v: unknown, ...path: Array<string | number>): unknown =>
  path.reduce<unknown>((acc, key) => (acc === null || typeof acc !== "object" ? undefined : (acc as Record<string | number, unknown>)[key]), v);

/** The one owner of the contract: what `global.redis.auth` says the chart's consumers read. */
function authContract(): { secret: string; key: string } {
  const auth = dig(gitlabApplicationValues(), "global", "redis", "auth") as { secret?: string; key?: string } | undefined;
  if (typeof auth?.secret !== "string" || typeof auth.key !== "string") throw new Error("global.redis.auth carries no secret/key");
  return { secret: auth.secret, key: auth.key };
}

interface Script {
  readonly text: string;
  readonly env: Readonly<Record<string, string>>;
}

const waveOf = (d: unknown): number => Number(dig(d, "metadata", "annotations", SYNC_WAVE) ?? 0);
const named = (docs: readonly unknown[], kind: string, name: string): Doc | undefined => ofKind(docs, kind).find((d) => nameOf(d) === name);

function mintJob(docs: readonly unknown[]): Doc {
  const job = named(docs, "Job", authContract().secret);
  if (job === undefined) throw new Error(`no Job named ${authContract().secret} in the gitlab render`);
  return job;
}

const mintContainer = (docs: readonly unknown[]): Doc => dig(mintJob(docs), "spec", "template", "spec", "containers", 0) as Doc;

/** The Job container's script and the literal env the kubelet would hand it. */
function mintScript(docs: readonly unknown[]): Script {
  const container = mintContainer(docs);
  const args = container["args"] as unknown[] | undefined;
  if (typeof args?.[0] !== "string") throw new Error("the mint Job has no script in containers[0].args[0]");
  const env = Object.fromEntries(((container["env"] ?? []) as Doc[]).map((e) => [String(e["name"]), String(e["value"])]));
  return { text: args[0], env };
}

// ---------------------------------------------------------------------------
// A. The render
// ---------------------------------------------------------------------------

describe.skipIf(!HELM)("gitlab render -- who mints the Redis password", () => {
  test("(a) a Sync-hook Job named after the Secret runs in an earlier wave than the Valkey StatefulSet", () => {
    const { docs } = renderGitlabRelease();
    const job = mintJob(docs);
    expect(dig(job, "metadata", "annotations", HOOK)).toBe("Sync");
    const valkey = named(docs, "StatefulSet", VALKEY.statefulSet);
    expect(valkey).toBeDefined();
    expect(waveOf(job)).toBeLessThan(waveOf(valkey));
  }, T);

  test("(b) the Job's ServiceAccount, Role and RoleBinding exist before the Job runs", () => {
    const { docs } = renderGitlabRelease();
    const job = mintJob(docs);
    const sa = String(dig(job, "spec", "template", "spec", "serviceAccountName"));
    for (const kind of ["ServiceAccount", "Role", "RoleBinding"]) {
      const d = named(docs, kind, sa);
      expect(d, `${kind}/${sa}`).toBeDefined();
      expect(waveOf(d), `${kind}/${sa} wave`).toBeLessThan(waveOf(job));
    }
  }, T);

  test("(c) the Valkey container and the Job read exactly the Secret and key global.redis.auth names", () => {
    const { docs } = renderGitlabRelease();
    const { secret, key } = authContract();
    const container = (dig(named(docs, "StatefulSet", VALKEY.statefulSet), "spec", "template", "spec", "containers") as Doc[]).find(
      (c) => c["name"] === VALKEY.container,
    );
    const env = ((container?.["env"] ?? []) as Doc[]).find((e) => e["name"] === PASSWORD_ENV);
    expect(dig(env, "valueFrom", "secretKeyRef")).toEqual({ name: secret, key });
    expect({ SECRET_NAME: mintScript(docs).env["SECRET_NAME"], SECRET_KEY: mintScript(docs).env["SECRET_KEY"] }).toEqual({
      SECRET_NAME: secret,
      SECRET_KEY: key,
    });
  }, T);

  test("(d) the Job reads only that Secret and can create Secrets: it cannot list or overwrite any", () => {
    const { docs } = renderGitlabRelease();
    const job = mintJob(docs);
    const role = named(docs, "Role", String(dig(job, "spec", "template", "spec", "serviceAccountName")));
    const rules = (dig(role, "rules") ?? []) as Array<{ resources: string[]; verbs: string[]; resourceNames?: string[] }>;
    const grants = rules.flatMap((r) => r.verbs.map((verb) => `${verb}:${(r.resourceNames ?? ["*"]).join(",")}`)).sort();
    expect(grants).toEqual([`create:*`, `get:${authContract().secret}`]);
  }, T);
});

// ---------------------------------------------------------------------------
// B. The script, executed against a stub kubectl
// ---------------------------------------------------------------------------

/**
 * A directory of one file per Secret (`<name>.<key>` = base64 value) stands in for the namespace. `create` is
 * all-or-nothing and refuses an existing name, as the API server does; `get -o jsonpath={.data.<key>}` prints the
 * stored value or fails when the Secret is absent. Anything else is a defect in the script under test.
 */
const KUBECTL_STUB = `#!/usr/bin/env bash
store="$STUB_DIR/secrets"
echo "$*" >> "$STUB_DIR/calls.log"
case " $* " in
  *" create secret generic "*)
    if [ -n "\${STUB_REFUSE_CREATE:-}" ]; then echo 'Error from server (Forbidden): secrets is forbidden' >&2; exit 1; fi
    name=""; lit=""
    for a in "$@"; do
      case "$a" in
        --from-literal=*) lit="\${a#--from-literal=}" ;;
        create|secret|generic|-n|gitlab|--*) ;;
        *) [ -z "$name" ] && name="$a" ;;
      esac
    done
    if [ -e "$store/$name" ]; then echo "Error from server (AlreadyExists): secrets \\"$name\\" already exists" >&2; exit 1; fi
    mkdir -p "$store/$name"
    printf '%s' "\${lit#*=}" | base64 | tr -d '\\n' > "$store/$name/\${lit%%=*}"
    echo "$name" >> "$STUB_DIR/creations.log"
    echo "secret/$name created"; exit 0 ;;
  *" get secret "*)
    name=""; key=""
    for a in "$@"; do
      case "$a" in
        -o) ;;
        jsonpath=*) key="\${a#jsonpath=\\{.data.}"; key="\${key%\\}}" ;;
        get|secret|-n|gitlab|--*) ;;
        *) [ -z "$name" ] && name="$a" ;;
      esac
    done
    [ -d "$store/$name" ] || { echo "Error from server (NotFound): secrets \\"$name\\" not found" >&2; exit 1; }
    [ -f "$store/$name/$key" ] && cat "$store/$name/$key"
    exit 0 ;;
esac
echo "stub kubectl: unexpected invocation: $*" >&2
exit 99
`;

interface Scenario {
  /** Secrets present before the run: name -> { key -> plain value }. */
  existing?: Record<string, Record<string, string>>;
  refuseCreate?: boolean;
}

interface Outcome {
  exitCode: number;
  output: string;
  /** How many `create` calls the stub ACCEPTED (the API server refuses an existing name). */
  creations: number;
  /** name -> key -> base64 value, after the run(s). */
  secrets: Record<string, Record<string, string>>;
}

/** One syscall, one answer: ENOENT is "the stub never wrote it", not a race to guard. */
function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

function readdirIfPresent(path: string): string[] {
  try {
    return readdirSync(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

function runScript(script: Script, scenario: Scenario, runs = 1): Outcome {
  const dir = mkdtempSync(join(tmpdir(), "redis-mint-stub-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "kubectl"), KUBECTL_STUB, "utf8");
    chmodSync(join(bin, "kubectl"), 0o755);
    for (const [name, keys] of Object.entries(scenario.existing ?? {})) {
      mkdirSync(join(dir, "secrets", name), { recursive: true });
      for (const [k, v] of Object.entries(keys)) writeFileSync(join(dir, "secrets", name, k), Buffer.from(v).toString("base64"), "utf8");
    }
    writeFileSync(join(dir, "script.sh"), script.text, "utf8");
    const toPosix = (p: string) => p.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
    const onWindows = process.platform === "win32";
    const env: Record<string, string | undefined> = { ...process.env };
    const inheritedPath = process.env["PATH"] ?? process.env["Path"] ?? "";
    for (const k of Object.keys(env)) if (k.toLowerCase() === "path") delete env[k];
    let exitCode = 0;
    let output = "";
    for (let i = 0; i < runs; i++) {
      const run = Bun.spawnSync(["bash", onWindows ? toPosix(join(dir, "script.sh")) : join(dir, "script.sh")], {
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...env,
          ...script.env,
          PATH: `${bin}${delimiter}${inheritedPath}`,
          STUB_DIR: onWindows ? toPosix(dir) : dir,
          ...(scenario.refuseCreate ? { STUB_REFUSE_CREATE: "1" } : {}),
        },
      });
      exitCode = run.exitCode ?? -1;
      output += run.stdout.toString() + run.stderr.toString();
    }
    const secrets: Record<string, Record<string, string>> = {};
    for (const name of readdirIfPresent(join(dir, "secrets"))) {
      secrets[name] = Object.fromEntries(
        readdirIfPresent(join(dir, "secrets", name)).map((k) => [k, readFileSync(join(dir, "secrets", name, k), "utf8")]),
      );
    }
    const creations = (readIfPresent(join(dir, "creations.log")) ?? "").split("\n").filter((l) => l !== "").length;
    return { exitCode, output, creations, secrets };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const decode = (b64: string | undefined): string => Buffer.from(b64 ?? "", "base64").toString("utf8");

describe.skipIf(!HELM || !BASH)("mint Job script, executed", () => {
  const { secret, key } = authContract();

  test("(e) with no Secret it creates one with a long random value under the declared key", () => {
    const out = runScript(mintScript(renderGitlabRelease().docs), {});
    expect(out.exitCode, out.output).toBe(0);
    expect(Object.keys(out.secrets)).toEqual([secret]);
    expect(Object.keys(out.secrets[secret]!)).toEqual([key]);
    expect(decode(out.secrets[secret]![key])).toMatch(/^[0-9a-f]{64}$/);
  }, T);

  test("(f) an existing Secret is left byte-identical: the live node's inherited password survives", () => {
    const inherited = { [secret]: { [key]: "inherited-from-the-bundled-redis-era" } };
    const out = runScript(mintScript(renderGitlabRelease().docs), { existing: inherited });
    expect(out.exitCode, out.output).toBe(0);
    expect(decode(out.secrets[secret]![key])).toBe("inherited-from-the-bundled-redis-era");
  }, T);

  test("(g) run twice against the same namespace: one creation, and the value of the first run survives the second", () => {
    const script = mintScript(renderGitlabRelease().docs);
    const first = runScript(script, {}, 1);
    const twice = runScript(script, {}, 2);
    expect(twice.exitCode, twice.output).toBe(0);
    expect(twice.creations).toBe(1);
    expect(decode(twice.secrets[secret]![key])).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(twice.secrets)).toEqual(Object.keys(first.secrets));
  }, T);

  test("(h) an existing Secret that lacks the key fails the Job, loudly, at the source", () => {
    const out = runScript(mintScript(renderGitlabRelease().docs), { existing: { [secret]: { "some-other-key": "x" } } });
    expect(out.exitCode).not.toBe(0);
    expect(out.output).toContain(secret);
  }, T);

  test("(i) when create is refused and no Secret exists the Job fails and never reports success", () => {
    const out = runScript(mintScript(renderGitlabRelease().docs), { refuseCreate: true });
    expect(out.exitCode).not.toBe(0);
    expect(out.secrets).toEqual({});
  }, T);
});
