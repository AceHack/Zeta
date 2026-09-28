// Falsifier: the gmod SFTP sidecar must not crash-loop on a fresh install.
//
// atmoz/sftp's create-sftp-user runs `cat /home/<user>/.ssh/keys/*` and exits 1
// when that dir holds no key. The keys come from the OPTIONAL `gmod-sftp-keys`
// ConfigMap, which a fresh install does not have — so the mount is an empty dir
// and the sidecar died on every restart, holding gmod-0 at 1/2 and the
// StatefulSet unready (live, 2026-09-27 bare-metal install).
//
// This test RUNS the sidecar's effective start command (its `command`/`args`, or
// the image entrypoint when none is set) under `sh`, with the keys path pointed
// at a temp dir and atmoz's /entrypoint replaced by a stub that fails exactly
// the way atmoz does on an empty keys dir. The poll's `sleep` is replaced by a
// marker that ends the run, so "the sidecar chose to wait" is observed as an
// event rather than inferred from elapsed time (no timers in the test).
// Invariant: empty dir => the sidecar idles (SFTP off, pod Ready) and never
// reaches atmoz; a key present => atmoz is started with the same user spec.

import { test, expect, describe, afterAll } from "bun:test";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";

const REPO = join(import.meta.dir, "..", "..", "..");
const GMOD = join(REPO, "full-ai-cluster", "k8s", "applications", "game-hosting", "gmod", "statefulset.yaml");
const USER_SPEC = "gmod::1000:1000";

// biome-ignore lint/suspicious/noExplicitAny: parsed manifest
const sts: any = parseAllDocuments(readFileSync(GMOD, "utf8"))
  .map((d) => d.toJS())
  .find((d) => d?.kind === "StatefulSet");
const pod = sts.spec.template.spec;
// biome-ignore lint/suspicious/noExplicitAny: parsed manifest
const sftp = pod.containers.find((c: any) => c.name === "sftp");
// biome-ignore lint/suspicious/noExplicitAny: parsed manifest
const keysMount = sftp.volumeMounts.find((m: any) => m.name === "sftp-keys");
// biome-ignore lint/suspicious/noExplicitAny: parsed manifest
const keysVolume = pod.volumes.find((v: any) => v.name === "sftp-keys");

/** The shell the container actually runs: its own `sh -c` script, or the image
 *  entrypoint (`/entrypoint <args>`) when the manifest sets no command. */
function effectiveScript(): string {
  const cmd: string[] | undefined = sftp.command;
  const args: string[] = sftp.args ?? [];
  if (!cmd) return `exec /entrypoint ${args.join(" ")}`;
  expect(cmd.slice(-1)[0]).toBe("-c");
  return args[0] ?? "";
}

const ROOT = mkdtempSync(join(tmpdir(), "gmod-sftp-keys-")).replaceAll("\\", "/");
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

/** Run the sidecar script with KEYS -> `keysDir`. The stub mimics atmoz: exit 1
 *  on an empty keys dir, else print the user spec it was started with. The first
 *  poll sleep becomes `IDLE-POLL` + exit 0: reaching it means the script chose to
 *  wait for a key instead of starting (and crashing) atmoz. */
async function run(keysDir: string): Promise<{ code: number | null; out: string }> {
  const stub = `${ROOT}/entrypoint-${Math.random().toString(36).slice(2)}`;
  writeFileSync(
    stub,
    `#!/bin/sh
cat ${keysDir}/* >/dev/null 2>&1 || { echo "create-sftp-user: Error"; exit 1; }
echo "ATMOZ-STARTED $*"
`,
    { mode: 0o755 },
  );
  const script = effectiveScript()
    .replaceAll(keysMount.mountPath, keysDir)
    .replaceAll("/entrypoint", `sh ${stub}`)
    .replaceAll(/sleep \d+/g, "{ echo IDLE-POLL; exit 0; }");
  const p = Bun.spawn(["sh", "-c", script], { stdout: "pipe", stderr: "pipe" });
  const out = (await new Response(p.stdout).text()) + (await new Response(p.stderr).text());
  await p.exited;
  return { code: p.exitCode, out };
}

describe("gmod sftp sidecar on a fresh install (no gmod-sftp-keys)", () => {
  test("the keys source is optional, so a fresh install mounts an empty dir", () => {
    expect(keysVolume.configMap?.name).toBe("gmod-sftp-keys");
    expect(keysVolume.configMap?.optional).toBe(true);
  });

  test("empty keys dir: the sidecar waits for a key instead of crashing atmoz (no crash-loop)", async () => {
    const dir = `${ROOT}/empty`;
    mkdirSync(dir);
    const r = await run(dir);
    expect(r.out).not.toContain("create-sftp-user: Error");
    expect(r.out).toContain("IDLE-POLL");
    expect(r.code).toBe(0);
  });

  test("ConfigMap bookkeeping entries (..data) alone do not count as a key", async () => {
    const dir = `${ROOT}/dotonly`;
    mkdirSync(`${dir}/..data`, { recursive: true });
    const r = await run(dir);
    expect(r.out).toContain("IDLE-POLL");
    expect(r.out).not.toContain("ATMOZ-STARTED");
  });

  test("a key present: atmoz is started with the same key-only user spec", async () => {
    const dir = `${ROOT}/withkey`;
    mkdirSync(dir);
    writeFileSync(`${dir}/operator.pub`, "ssh-ed25519 AAAAtest operator\n");
    const r = await run(dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`ATMOZ-STARTED ${USER_SPEC}`);
    expect(r.out).not.toContain("IDLE-POLL");
  });
});
