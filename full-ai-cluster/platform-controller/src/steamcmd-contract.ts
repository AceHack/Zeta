// full-ai-cluster/platform-controller/src/steamcmd-contract.ts
//
// Pure, TEST-ONLY checks shared by blueprint.test.ts (the shipped Blueprint
// library) and portal/src/blueprint-agent.test.ts (the AI draft generator), so
// the two cannot drift: both render through renderDeployable() and ask the same
// questions of the resulting pod. Each check returns a list of violations
// (empty = pass) instead of asserting, so it carries no test-runner dependency.
//
// THE ich777 CONTRACT (workitem 081M0QB1ZCV087G0R001P9YCPX, PR #17729). Read
// 2026-09-28 from the registry config + layers of ghcr.io/ich777/steamcmd
// {garrysmod, unturned} and the config of {valheim, rust}: Entrypoint
// `/opt/scripts/start.sh`, no Cmd, no User, SERVER_DIR=/serverdata/serverfiles,
// STEAMCMD_DIR=/serverdata/steamcmd (an EMPTY directory in the image), UID=99
// GID=100. There is no `/opt/steamcmd`. start.sh (as root) chowns DATA_DIR,
// drops to `steam`, and start-server.sh downloads steamcmd into STEAMCMD_DIR
// (no mkdir), `app_update ${GAME_ID}` into SERVER_DIR, then execs the server.
// So a correct pod: overrides no command/args, has no install initContainer,
// never names /opt/steamcmd, sets GAME_ID (never the image's `template`),
// mounts its PVC at SERVER_DIR (a volume over /serverdata would hide the empty
// steamcmd dir), and imposes no process identity beyond fsGroup (PR #17721).
//
// THE SFTP GATE (workitem 081M3K57P0A087G0R000AZ486D, PR #17736). atmoz/sftp's
// create-sftp-user needs a user spec and, for a key-only user, runs
// `cat /home/<user>/.ssh/keys/*` under `set -Eeo pipefail`, which fails on an
// empty dir -> crash-loop. The opt-in sidecar mounts the OPTIONAL ConfigMap
// `<resource>-sftp-keys` at /home/zeta/.ssh/keys, idles while it holds no key
// (ConfigMap `..data` is a dotfile and not matched by `*`), then
// `exec /entrypoint zeta::<uid>:<gid>`. The runner below EXECUTES the rendered
// script under `sh`, with atmoz's /entrypoint replaced by a stub that fails the
// way atmoz does and the poll `sleep` replaced by a marker that ends the run.

import { mkdirSync, writeFileSync } from "node:fs";

export const ICH777_IMAGE_PREFIX = "ghcr.io/ich777/steamcmd:";
export const ICH777_SERVER_DIR = "/serverdata/serverfiles";
export const SFTP_KEYS_DIR = "/home/zeta/.ssh/keys";
export const SFTP_DATA_DIR = "/home/zeta/data";

// biome-ignore lint/suspicious/noExplicitAny: a rendered pod spec is untyped JSON
type Json = any;

/** Violations of the ich777 steamcmd image contract for one rendered pod. */
export function ich777ContractViolations(podSpec: Json, expect: { appId: string; gamePort: string }): string[] {
  const v: string[] = [];
  const main = (podSpec.containers ?? []).find((c: Json) => c.name === "main");
  if (!main) return ["no `main` container"];
  if (main.command !== undefined) v.push("main overrides `command` — the image's /opt/scripts/start.sh would never run");
  if (main.args !== undefined) v.push("main overrides `args`");
  if (podSpec.initContainers !== undefined) v.push("pod has initContainers — the image installs the game itself");
  if (JSON.stringify(podSpec).includes("/opt/steamcmd")) v.push("pod names /opt/steamcmd, a path no ich777 image ships");
  const env: Record<string, string> = Object.fromEntries((main.env ?? []).map((e: Json) => [e.name, e.value]));
  if (env.GAME_ID !== expect.appId) v.push(`GAME_ID is ${JSON.stringify(env.GAME_ID)}, expected the Steam appid ${expect.appId}`);
  if (env.GAME_PORT !== expect.gamePort) v.push(`GAME_PORT is ${JSON.stringify(env.GAME_PORT)}, expected ${expect.gamePort}`);
  if (env.GAME_PARAMS === undefined || env.GAME_PARAMS === "template") v.push("GAME_PARAMS unset or the image's `template` placeholder");
  if (JSON.stringify(main.volumeMounts) !== JSON.stringify([{ name: "data", mountPath: ICH777_SERVER_DIR }]))
    v.push(`main mounts ${JSON.stringify(main.volumeMounts)}, expected the PVC at ${ICH777_SERVER_DIR} only`);
  if (JSON.stringify(podSpec.securityContext) !== JSON.stringify({ fsGroup: 1000 }))
    v.push(`pod securityContext is ${JSON.stringify(podSpec.securityContext)}, expected exactly { fsGroup: 1000 }`);
  for (const c of [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])])
    if (c.securityContext !== undefined) v.push(`container ${c.name} imposes a securityContext`);
  return v;
}

/** The shell the sidecar actually runs: its own `sh -c` script, or atmoz's entrypoint with its args. */
function effectiveScript(c: Json): string {
  if (!c.command) return `exec /entrypoint ${(c.args ?? []).join(" ")}`;
  return c.command[c.command.length - 1] === "-c" ? (c.args?.[0] ?? "") : `exec ${[...c.command, ...(c.args ?? [])].join(" ")}`;
}

async function runGate(script: string, keysDir: string, root: string): Promise<{ code: number | null; out: string }> {
  const stub = `${root}/entrypoint-${Math.random().toString(36).slice(2)}`;
  writeFileSync(
    stub,
    `#!/bin/sh\n[ $# -gt 0 ] || { echo "atmoz: no users"; exit 1; }\ncat ${keysDir}/* >/dev/null 2>&1 || { echo "create-sftp-user: Error"; exit 1; }\necho "ATMOZ-STARTED $*"\n`,
    { mode: 0o755 },
  );
  const s = script.replaceAll(SFTP_KEYS_DIR, keysDir).replaceAll("/entrypoint", `sh ${stub}`).replaceAll(/sleep \d+/g, "{ echo IDLE-POLL; exit 0; }");
  const p = Bun.spawn(["sh", "-c", s], { stdout: "pipe", stderr: "pipe" });
  const out = (await new Response(p.stdout).text()) + (await new Response(p.stderr).text());
  await p.exited;
  return { code: p.exitCode, out };
}

/**
 * Violations of the opt-in atmoz/sftp sidecar pattern for one rendered pod.
 * `root` is a scratch dir the caller owns (forward slashes); `userSpec` is the
 * expected `zeta::<uid>:<gid>`.
 */
export async function sftpGateViolations(podSpec: Json, resourceName: string, userSpec: string, root: string): Promise<string[]> {
  const v: string[] = [];
  const sftp = (podSpec.containers ?? []).find((c: Json) => typeof c.image === "string" && c.image.startsWith("atmoz/sftp"));
  if (!sftp) return ["no atmoz/sftp sidecar"];
  const keysMount = (sftp.volumeMounts ?? []).find((m: Json) => m.mountPath === SFTP_KEYS_DIR);
  if (!keysMount) v.push(`no keys mount at ${SFTP_KEYS_DIR}`);
  else {
    if (keysMount.readOnly !== true) v.push("keys mount is not readOnly");
    const vol = (podSpec.volumes ?? []).find((x: Json) => x.name === keysMount.name);
    if (JSON.stringify(vol?.configMap) !== JSON.stringify({ name: `${resourceName}-sftp-keys`, optional: true }))
      v.push(`keys volume is ${JSON.stringify(vol)}, expected the OPTIONAL ConfigMap ${resourceName}-sftp-keys`);
  }
  if (!(sftp.volumeMounts ?? []).some((m: Json) => m.name === "data" && m.mountPath === SFTP_DATA_DIR)) v.push(`data not served at ${SFTP_DATA_DIR}`);

  const script = effectiveScript(sftp);
  const tag = Math.random().toString(36).slice(2);
  const empty = `${root}/${tag}-empty`;
  mkdirSync(empty, { recursive: true });
  const e = await runGate(script, empty, root);
  if (!e.out.includes("IDLE-POLL") || e.code !== 0 || /Error|no users|ATMOZ-STARTED/.test(e.out))
    v.push(`empty keys dir: expected the sidecar to idle, got exit ${e.code}: ${e.out.trim()}`);
  const dot = `${root}/${tag}-dotonly`;
  mkdirSync(`${dot}/..data`, { recursive: true });
  const d = await runGate(script, dot, root);
  if (!d.out.includes("IDLE-POLL") || d.out.includes("ATMOZ-STARTED")) v.push(`..data only: expected idle, got: ${d.out.trim()}`);
  const withKey = `${root}/${tag}-withkey`;
  mkdirSync(withKey, { recursive: true });
  writeFileSync(`${withKey}/operator.pub`, "ssh-ed25519 AAAAtest operator\n");
  const k = await runGate(script, withKey, root);
  if (k.code !== 0 || !k.out.includes(`ATMOZ-STARTED ${userSpec}`) || k.out.includes("IDLE-POLL"))
    v.push(`key present: expected atmoz started as ${userSpec}, got exit ${k.code}: ${k.out.trim()}`);
  return v;
}
