/**
 * gitlab-valkey-aof-self-heal.test.ts -- falsifiers for "a hard shutdown must never leave the GitLab Valkey
 * unable to start" (full-ai-cluster/k8s/applications/gitlab/Application.yaml, StatefulSet gitlab-valkey).
 *
 * THE FAILURE (measured 2026-11-24, power cut): the append-only file ended in NUL bytes -- the filesystem had
 * extended the file but not written its data -- and Valkey 7.2 refuses to start on that ("Bad file format reading
 * the append only file"). `aof-load-truncated yes` forgives only a cut-off final COMMAND, not padding after a
 * complete one. Nothing in the pod repaired it, so GitLab stayed down until a human ran `valkey-check-aof --fix`.
 *
 *   A. DECLARED SHAPE -- no tools. The repair is the server container's own startup script (it runs on EVERY
 *      container start, not once at pod creation), there is no separate init container, the container is locked
 *      down, and the durability flags are pinned.
 *   B. THE SCRIPT, EXECUTED -- needs `sh` only. The repair text (everything above the marker line in the server
 *      container's startup command) is pulled out of the Application and RUN against a stub `valkey-check-aof` (same contract: exit 1 on a NUL tail or a broken base, `--fix` cuts the
 *      tail after a `y` on stdin) and a counting `date`, over every state the volume can be in:
 *        (a) no AOF yet                 -> nothing created, exit 0;
 *        (b) healthy AOF                -> byte-identical, no backup directory (idempotent no-op);
 *        (c) NUL tail                   -> repaired, and the backup holds the exact pre-repair bytes;
 *        (d) repair, then run again     -> the second run changes nothing (idempotence);
 *        (e) a base `--fix` cannot mend -> backup kept, AOF moved aside, exit 0 (the server can start);
 *        (f) many repairs               -> only the newest KEEP_BACKUPS backups remain, nothing else is touched;
 *        (g) the backup cannot be made  -> exit non-zero and the AOF is untouched (never repair with no copy);
 *        (j) files but NO manifest      -> the dataset is abandoned by the server, so it is backed up and moved aside;
 *        (k) an existing but empty dir  -> a fresh volume: untouched, no backup;
 *        (o) the whole startup command  -> execs the server after a repair, and never when the backup fails.
 *   C. THE REAL IMAGE -- needs `docker`. A real Valkey 7.2.14 writes a real AOF, the tail is NUL-padded, and:
 *        (h) the server WITHOUT the repair refuses to start with the measured message (the fixture is the failure);
 *        (i) the script as the pod runs it (uid 999) makes the same volume load every key;
 *        (l) real files but the manifest missing -> backed up byte-for-byte, moved aside, the server starts.
 *   D. THE LIFECYCLE -- needs `docker`. The kubelet restarts a crashed app container IN PLACE and does not rerun
 *      completed init containers; `docker start` of the same container models that:
 *        (m) the real startup command over a killed, NUL-padded volume -> serving again, every key back, a backup kept;
 *        (n) control: the server command alone (what a restart ran under the old init-container layout) refuses it.
 *
 * WHAT THIS CANNOT PROVE: that a particular filesystem produces NUL padding on a given power cut (the live file did;
 * the same repair also covers any garbage tail `valkey-check-aof` can cut), nor that the kubelet restarts the app
 * container in place the way `docker start` does (a platform guarantee). The first live restart after this lands is
 * the proof of the rollout.
 */

import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { waitUntil } from "../testing/deterministic-async";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const GITLAB_APP = resolve(REPO_ROOT, "full-ai-cluster/k8s/applications/gitlab/Application.yaml");

const Declared = {
  statefulSet: "gitlab-valkey",
  serverContainer: "valkey",
  repairEndMarker: "# aof-repair:end",
  dataVolume: "data",
  dataDirEnv: "DATA_DIR",
  keepBackupsEnv: "KEEP_BACKUPS",
  minGraceSeconds: 60,
} as const;

const OnDisk = {
  aofDir: "appendonlydir",
  manifest: "appendonly.aof.manifest",
  backupRoot: "aof-repair-backups",
  base: "appendonly.aof.1.base.rdb",
  incr: "appendonly.aof.1.incr.aof",
} as const;

/** What the server must be started with, name -> value, whatever the image's defaults become. */
const PinnedServerFlags: Readonly<Record<string, string>> = {
  appendonly: "yes",
  appendfsync: "everysec",
  "aof-use-rdb-preamble": "yes",
  "aof-load-truncated": "yes",
  "no-appendfsync-on-rewrite": "no",
  "auto-aof-rewrite-percentage": "100",
  "auto-aof-rewrite-min-size": "64mb",
  save: "3600 1 300 100 60 10000",
};

type Doc = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Reading the declaration
// ---------------------------------------------------------------------------

const dig = (v: unknown, ...path: Array<string | number>): unknown =>
  path.reduce<unknown>((acc, key) => (acc === null || typeof acc !== "object" ? undefined : (acc as Record<string | number, unknown>)[key]), v);

function valkeyStatefulSet(): Doc {
  const app = parseYaml(readFileSync(GITLAB_APP, "utf8")) as unknown;
  const extra = dig(app, "spec", "source", "helm", "valuesObject", "gitlab-runner", "extraObjects") as Doc[];
  const sts = extra.find((o) => o["kind"] === "StatefulSet" && dig(o, "metadata", "name") === Declared.statefulSet);
  if (sts === undefined) throw new Error(`StatefulSet/${Declared.statefulSet} is not in gitlab-runner.extraObjects`);
  return sts;
}

function podSpec(): Doc {
  return dig(valkeyStatefulSet(), "spec", "template", "spec") as Doc;
}

function containerNamed(name: string): Doc {
  const found = ((podSpec()["containers"] ?? []) as Doc[]).find((c) => c["name"] === name);
  if (found === undefined) throw new Error(`no container named ${name} in StatefulSet/${Declared.statefulSet}`);
  return found;
}

const envOf = (container: Doc): Record<string, string> =>
  Object.fromEntries(((container["env"] ?? []) as Doc[]).filter((e) => typeof e["value"] === "string").map((e) => [String(e["name"]), String(e["value"])]));

/** `--name value` / `--name "quoted value"` pairs of the server command line. */
function serverFlags(commandLine: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of commandLine.matchAll(/--([a-z0-9-]+)\s+(?:"([^"]*)"|(\S+))/g)) out[m[1]!] = m[2] ?? m[3]!;
  return out;
}

const serverContainer = (): Doc => containerNamed(Declared.serverContainer);

/** The server container's whole startup command: the repair, then the server. */
const startupScript = (): string => String((serverContainer()["args"] as unknown[])[0]);

/** The startup command split at the one marker line that is itself part of the manifest text: the real text, never a copy. */
function splitStartup(): { repair: string; server: string } {
  const lines = startupScript().split("\n");
  const at = lines.flatMap((l, i) => (l.trim() === Declared.repairEndMarker ? [i] : []));
  if (at.length !== 1) throw new Error(`the startup command must hold exactly one "${Declared.repairEndMarker}" line, found ${at.length}`);
  return { repair: `${lines.slice(0, at[0]).join("\n")}\n`, server: lines.slice(at[0]! + 1).join("\n") };
}
const repairScript = (): string => splitStartup().repair;
const serverCommand = (): string => splitStartup().server;
const keepBackups = (): string => envOf(serverContainer())[Declared.keepBackupsEnv]!;

// ---------------------------------------------------------------------------
// A. Declared shape
// ---------------------------------------------------------------------------

describe("gitlab-valkey declares its own repair", () => {
  test("the repair is the server container's own startup, not an init container that a restart would skip", () => {
    expect(podSpec()["initContainers"]).toBeUndefined();
    const server = serverContainer();
    const mountPath = ((server["volumeMounts"] ?? []) as Doc[]).find((m) => m["name"] === Declared.dataVolume)?.["mountPath"];
    expect(mountPath).toBeDefined();
    expect(envOf(server)[Declared.dataDirEnv]).toBe(mountPath as string);
    expect(serverCommand().trimStart()).toStartWith("exec valkey-server ");
    expect(serverCommand()).toContain(`--dir "$${Declared.dataDirEnv}"`);
    expect(repairScript()).toContain("set -eu");
    // a failing repair must never fall through to the server: nothing may soak up the exit status of the call
    expect(repairScript()).not.toMatch(/heal_aof\s*(\|\||;|&&)/);
  });

  test("the container is locked down: non-root, read-only root, no capabilities, bounded", () => {
    const sc = serverContainer()["securityContext"] as Doc;
    expect(sc["allowPrivilegeEscalation"]).toBe(false);
    expect(sc["readOnlyRootFilesystem"]).toBe(true);
    expect(dig(sc, "capabilities", "drop")).toEqual(["ALL"]);
    expect(dig(podSpec(), "securityContext", "runAsNonRoot")).toBe(true);
    expect(dig(serverContainer(), "resources", "requests", "memory")).toBeDefined();
    expect(dig(serverContainer(), "resources", "limits", "memory")).toBeDefined();
    expect(Number(keepBackups())).toBeGreaterThan(0);
  });

  test("the script carries no Helm template syntax (extraObjects pass through `tpl`)", () => {
    expect(startupScript()).not.toContain("{{");
  });

  test("the durability flags are pinned, not left to the image's defaults", () => {
    const flags = serverFlags(serverCommand());
    for (const [name, value] of Object.entries(PinnedServerFlags)) expect(flags[name]).toBe(value);
  });

  test("a graceful stop has time to flush", () => {
    expect(Number(podSpec()["terminationGracePeriodSeconds"])).toBeGreaterThanOrEqual(Declared.minGraceSeconds);
  });
});

// ---------------------------------------------------------------------------
// B. The script, executed against a stub with the real tool's contract
// ---------------------------------------------------------------------------

const GOOD_AOF = "*3\r\n$3\r\nSET\r\n$1\r\na\r\n$1\r\n1\r\n*3\r\n$3\r\nSET\r\n$1\r\nb\r\n$1\r\n2\r\n";
const NUL_TAIL = "\0".repeat(682);
const MANIFEST_TEXT = `file ${OnDisk.base} seq 1 type b\nfile ${OnDisk.incr} seq 1 type i\n`;
const BROKEN_BASE = "REDIS-BASE-THAT-NO-FIX-CAN-MEND";

/** valkey-check-aof's contract as far as the script depends on it: 0 valid / 1 invalid; `--fix` reads `y`, cuts NULs. */
const STUB_CHECK_AOF = `#!/bin/sh
fix=0; [ "\${1:-}" = "--fix" ] && { fix=1; shift; }
manifest="$1"
bad=0
for f in $(sed -n 's/^file \\([^ ]*\\) .*/\\1/p' "$manifest"); do
  case "$f" in
    *.rdb) grep -q 'NO-FIX-CAN-MEND' "$f" && bad=1 ;;
    *.aof) [ "$(tr -d '\\000' < "$f" | wc -c)" -ne "$(wc -c < "$f")" ] && bad=1 ;;
  esac
done
[ "$fix" -eq 0 ] && exit $bad
read -r answer
[ "$answer" = "y" ] || exit 1
for f in $(sed -n 's/^file \\([^ ]*\\.aof\\) .*/\\1/p' "$manifest"); do
  tr -d '\\000' < "$f" > "$f.cut" && mv "$f.cut" "$f"
done
`;

/** A `date` that ignores the wall clock: each call is one second later, so stamps are unique and ordered. */
const STUB_DATE = `#!/bin/sh
n=$(cat "$STUB_DATE_STATE" 2>/dev/null || echo 0)
n=$((n + 1))
echo "$n" > "$STUB_DATE_STATE"
printf '20261124T%06dZ\\n' "$n"
`;

/** A server that only records it was exec'd: the startup command's `exec valkey-server` lands here. */
const SERVER_STARTED_FILE = "server-started";
const STUB_SERVER = `#!/bin/sh
echo started > "$DATA_DIR/${SERVER_STARTED_FILE}"
`;

interface Sandbox {
  dataDir: string;
  bin: string;
  dispose: () => void;
}

function sandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), "valkey-aof-heal-"));
  const dataDir = join(root, "data");
  const bin = join(root, "bin");
  mkdirSync(dataDir);
  mkdirSync(bin);
  for (const [name, body] of [["valkey-check-aof", STUB_CHECK_AOF], ["date", STUB_DATE], ["valkey-server", STUB_SERVER]] as const) {
    writeFileSync(join(bin, name), body, "utf8");
    chmodSync(join(bin, name), 0o755);
  }
  return { dataDir, bin, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

function seedAof(s: Sandbox, opts: { incr?: string; base?: string; manifest?: boolean } = {}): string {
  const dir = join(s.dataDir, OnDisk.aofDir);
  mkdirSync(dir);
  if (opts.manifest !== false) writeFileSync(join(dir, OnDisk.manifest), MANIFEST_TEXT, "utf8");
  writeFileSync(join(dir, OnDisk.base), opts.base ?? "REDIS-BASE", "utf8");
  writeFileSync(join(dir, OnDisk.incr), opts.incr ?? GOOD_AOF, "utf8");
  return dir;
}

function runRepair(s: Sandbox, script: string = repairScript()): { code: number; out: string } {
  const keep = keepBackups();
  const r = Bun.spawnSync(["sh", "-c", script], {
    env: {
      PATH: `${s.bin}${delimiter}${process.env["PATH"] ?? ""}`,
      [Declared.dataDirEnv]: s.dataDir,
      [Declared.keepBackupsEnv]: keep,
      REDIS_PASSWORD: "stub",
      STUB_DATE_STATE: join(s.dataDir, "..", "date-state"),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString() };
}

const read = (...p: string[]): string => readFileSync(join(...p), "utf8");
const backupsOf = (s: Sandbox): string[] => {
  const root = join(s.dataDir, OnDisk.backupRoot);
  try {
    return readdirSync(root).sort();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
};

function withSandbox(body: (s: Sandbox) => void): () => void {
  return () => {
    const s = sandbox();
    try {
      body(s);
    } finally {
      s.dispose();
    }
  };
}

describe("the repair script, executed", () => {
  test("(a) a volume with no AOF yet is left alone", withSandbox((s) => {
    const r = runRepair(s);
    expect(r.code).toBe(0);
    expect(readdirSync(s.dataDir)).toEqual([]);
  }));

  test("(b) a healthy AOF is byte-identical afterwards and no backup directory appears", withSandbox((s) => {
    const dir = seedAof(s);
    const r = runRepair(s);
    expect(r.code).toBe(0);
    expect(read(dir, OnDisk.incr)).toBe(GOOD_AOF);
    expect(read(dir, OnDisk.manifest)).toBe(MANIFEST_TEXT);
    expect(readdirSync(s.dataDir)).toEqual([OnDisk.aofDir]);
  }));

  test("(c) a NUL tail is cut, and the backup holds the exact bytes the volume had", withSandbox((s) => {
    const dir = seedAof(s, { incr: GOOD_AOF + NUL_TAIL });
    const r = runRepair(s);
    expect(r.code).toBe(0);
    expect(read(dir, OnDisk.incr)).toBe(GOOD_AOF);
    const [stamp, ...rest] = backupsOf(s);
    expect(rest).toEqual([]);
    expect(read(s.dataDir, OnDisk.backupRoot, stamp!, OnDisk.incr)).toBe(GOOD_AOF + NUL_TAIL);
    expect(read(s.dataDir, OnDisk.backupRoot, stamp!, OnDisk.manifest)).toBe(MANIFEST_TEXT);
  }));

  test("(d) a second run after a repair changes nothing", withSandbox((s) => {
    const dir = seedAof(s, { incr: GOOD_AOF + NUL_TAIL });
    expect(runRepair(s).code).toBe(0);
    const after = { incr: read(dir, OnDisk.incr), backups: backupsOf(s) };
    expect(runRepair(s).code).toBe(0);
    expect(read(dir, OnDisk.incr)).toBe(after.incr);
    expect(backupsOf(s)).toEqual(after.backups);
  }));

  test("(e) an AOF `--fix` cannot mend is moved aside with its copy kept, and the script still exits 0", withSandbox((s) => {
    seedAof(s, { base: BROKEN_BASE, incr: GOOD_AOF + NUL_TAIL });
    const r = runRepair(s);
    expect(r.code).toBe(0);
    expect(existsSync(join(s.dataDir, OnDisk.aofDir))).toBe(false);
    const [stamp] = backupsOf(s);
    expect(read(s.dataDir, OnDisk.backupRoot, stamp!, OnDisk.base)).toBe(BROKEN_BASE);
    expect(read(s.dataDir, OnDisk.backupRoot, stamp!, OnDisk.incr)).toBe(GOOD_AOF + NUL_TAIL);
  }));

  test("(f) only the newest KEEP_BACKUPS backups remain, and files outside the backup root are untouched", withSandbox((s) => {
    const keep = Number(keepBackups());
    const foreign = join(s.dataDir, "aof-backup-by-hand");
    mkdirSync(foreign);
    writeFileSync(join(foreign, "keep-me"), "x", "utf8");
    const dir = seedAof(s, { incr: GOOD_AOF + NUL_TAIL });
    const repairs = keep + 2;
    for (let i = 0; i < repairs; i++) {
      expect(runRepair(s).code).toBe(0);
      writeFileSync(join(dir, OnDisk.incr), GOOD_AOF + NUL_TAIL, "utf8"); // the next hard shutdown
    }
    const kept = backupsOf(s);
    expect(kept).toHaveLength(keep);
    // stamps count up one per repair, so the newest `keep` are the last `keep` stamps
    expect(kept[kept.length - 1]).toBe(`20261124T${String(repairs).padStart(6, "0")}Z`);
    expect(read(foreign, "keep-me")).toBe("x");
  }));

  test("(g) when the backup cannot be made, the AOF is left exactly as found and the script fails", withSandbox((s) => {
    const dir = seedAof(s, { incr: GOOD_AOF + NUL_TAIL });
    writeFileSync(join(s.dataDir, OnDisk.backupRoot), "a file where the directory belongs", "utf8");
    const r = runRepair(s);
    expect(r.code).not.toBe(0);
    expect(read(dir, OnDisk.incr)).toBe(GOOD_AOF + NUL_TAIL);
  }));

  test("(o) the whole startup command execs the server after a repair, and never when the backup cannot be made", withSandbox((s) => {
    seedAof(s, { incr: GOOD_AOF + NUL_TAIL });
    expect(runRepair(s, startupScript()).code).toBe(0);
    expect(read(s.dataDir, SERVER_STARTED_FILE)).toBe("started\n");
    rmSync(join(s.dataDir, SERVER_STARTED_FILE));
    rmSync(join(s.dataDir, OnDisk.backupRoot), { recursive: true });
    writeFileSync(join(s.dataDir, OnDisk.backupRoot), "a file where the directory belongs", "utf8");
    writeFileSync(join(s.dataDir, OnDisk.aofDir, OnDisk.incr), GOOD_AOF + NUL_TAIL, "utf8");
    expect(runRepair(s, startupScript()).code).not.toBe(0);
    expect(existsSync(join(s.dataDir, SERVER_STARTED_FILE))).toBe(false);
  }));

  test("(j) base and incr files with no manifest are backed up and moved aside, never left for the server to abandon", withSandbox((s) => {
    seedAof(s, { manifest: false });
    const r = runRepair(s);
    expect(r.code).toBe(0);
    expect(existsSync(join(s.dataDir, OnDisk.aofDir))).toBe(false);
    const [stamp, ...rest] = backupsOf(s);
    expect(rest).toEqual([]);
    expect(read(s.dataDir, OnDisk.backupRoot, stamp!, OnDisk.base)).toBe("REDIS-BASE");
    expect(read(s.dataDir, OnDisk.backupRoot, stamp!, OnDisk.incr)).toBe(GOOD_AOF);
    // the volume is now fresh: a second run changes nothing
    expect(runRepair(s).code).toBe(0);
    expect(backupsOf(s)).toEqual([stamp!]);
  }));

  test("(k) an existing but empty AOF directory is a fresh volume: untouched, no backup", withSandbox((s) => {
    const dir = join(s.dataDir, OnDisk.aofDir);
    mkdirSync(dir);
    const r = runRepair(s);
    expect(r.code).toBe(0);
    expect(readdirSync(dir)).toEqual([]);
    expect(readdirSync(s.dataDir)).toEqual([OnDisk.aofDir]);
  }));
});

// ---------------------------------------------------------------------------
// C. The real image
// ---------------------------------------------------------------------------

function dockerAndImage(image: string): boolean {
  try {
    if (Bun.spawnSync(["docker", "version", "--format", "{{.Server.Version}}"], { stdout: "pipe", stderr: "pipe" }).exitCode !== 0) return false;
    if (Bun.spawnSync(["docker", "image", "inspect", image], { stdout: "pipe", stderr: "pipe" }).exitCode === 0) return true;
    return Bun.spawnSync(["docker", "pull", "--quiet", image], { stdout: "pipe", stderr: "pipe", timeout: 90_000 }).exitCode === 0;
  } catch {
    return false;
  }
}

const IMAGE = String(serverContainer()["image"]);
const DOCKER = dockerAndImage(IMAGE);
if (!DOCKER) console.warn(`gitlab-valkey-aof-self-heal.test: docker or ${IMAGE} unavailable -- the real-image half is SKIPPED, not passed`);

const POD_UID_GID = "999:1000";
const KEY_COUNT = 200;
const CONTAINER_DATA_DIR = "/data";
const CONTAINER_SCRIPT = "/aof-repair.sh";

/** One container session as the pod's user: write a real AOF, pad its tail, try the server, repair, try again. */
const REAL_SESSION = `
set -u
start() { valkey-server --daemonize yes --appendonly yes --dir "$DATA_DIR" --logfile "$DATA_DIR/server.log" >/dev/null; }
wait_up() { i=0; until valkey-cli ping >/dev/null 2>&1; do i=$((i+1)); [ $i -gt 50 ] && return 1; sleep 0.1; done; }
start; wait_up || { echo "FIXTURE_SERVER_DID_NOT_START"; exit 3; }
i=0; while [ $i -lt ${KEY_COUNT} ]; do i=$((i+1)); echo "SET key$i value$i"; done | valkey-cli >/dev/null
valkey-cli shutdown nosave >/dev/null 2>&1; sleep 0.5
INCR=$(ls "$DATA_DIR"/appendonlydir/*.incr.aof); head -c 700 /dev/zero >> "$INCR"
: > "$DATA_DIR/server.log"
start; sleep 1
if grep -q "Bad file format reading the append only file" "$DATA_DIR/server.log"; then echo "UNREPAIRED_SERVER_REFUSED"; else echo "UNREPAIRED_SERVER_STARTED"; valkey-cli shutdown nosave >/dev/null 2>&1; fi
sh ${CONTAINER_SCRIPT}; echo "REPAIR_EXIT=$?"
start; wait_up || { echo "REPAIRED_SERVER_DID_NOT_START"; exit 4; }
echo "DBSIZE=$(valkey-cli dbsize | tr -dc '0-9')"
valkey-cli shutdown nosave >/dev/null 2>&1
echo "BACKUPS=$(ls "$DATA_DIR/${OnDisk.backupRoot}" | wc -l | tr -dc '0-9')"
`;

/** The AOF files as `cksum` sees them, name-sorted: byte-for-byte identity as one comparable string. */
const REAL_SESSION_FILE_SUMS = `sums() { (cd "$1" && cksum * | sort); }`;

/** Same, but the manifest is deleted before the repair: base and incr files remain, nothing names them. */
const REAL_SESSION_NO_MANIFEST = `
set -u
${REAL_SESSION_FILE_SUMS}
start() { valkey-server --daemonize yes --appendonly yes --dir "$DATA_DIR" --logfile "$DATA_DIR/server.log" >/dev/null; }
wait_up() { i=0; until valkey-cli ping >/dev/null 2>&1; do i=$((i+1)); [ $i -gt 50 ] && return 1; sleep 0.1; done; }
start; wait_up || { echo "FIXTURE_SERVER_DID_NOT_START"; exit 3; }
i=0; while [ $i -lt ${KEY_COUNT} ]; do i=$((i+1)); echo "SET key$i value$i"; done | valkey-cli >/dev/null
valkey-cli shutdown nosave >/dev/null 2>&1; sleep 0.5
AOF="$DATA_DIR/${OnDisk.aofDir}"
rm "$AOF/${OnDisk.manifest}"
BEFORE=$(sums "$AOF")
echo "FILES_BEFORE=$(echo "$BEFORE" | wc -l | tr -dc '0-9')"
sh ${CONTAINER_SCRIPT}; echo "REPAIR_EXIT=$?"
echo "LIVE_AOF_ENTRIES=$(ls -A "$AOF" 2>/dev/null | wc -l | tr -dc '0-9')"
echo "BACKUPS=$(ls "$DATA_DIR/${OnDisk.backupRoot}" | wc -l | tr -dc '0-9')"
BACKUP=$(ls -d "$DATA_DIR/${OnDisk.backupRoot}"/*)
[ "$(sums "$BACKUP")" = "$BEFORE" ] && echo "BACKUP_BYTE_IDENTICAL" || echo "BACKUP_DIFFERS"
start; wait_up || { echo "SERVER_DID_NOT_START"; exit 4; }
echo "DBSIZE=$(valkey-cli dbsize | tr -dc '0-9')"
valkey-cli shutdown nosave >/dev/null 2>&1
`;

/** Runs one session script as the pod's user in the real image with the repair script mounted; returns its output. */
function runInPodContainer(session: string): string {
  const dir = mkdtempSync(join(tmpdir(), "valkey-aof-real-"));
  try {
    const data = join(dir, "data");
    mkdirSync(data);
    chmodSync(data, 0o777);
    const scriptFile = join(dir, "aof-repair.sh");
    writeFileSync(scriptFile, repairScript(), "utf8");
    const r = Bun.spawnSync(
      [
        "docker", "run", "--rm", "--user", POD_UID_GID,
        "-e", `${Declared.dataDirEnv}=${CONTAINER_DATA_DIR}`,
        "-e", `${Declared.keepBackupsEnv}=${keepBackups()}`,
        "-v", `${data}:${CONTAINER_DATA_DIR}`, "-v", `${scriptFile}:${CONTAINER_SCRIPT}:ro`,
        IMAGE, "sh", "-c", session,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    return r.stdout.toString() + r.stderr.toString();
  } finally {
    // The container wrote as the pod's uid, which the runner's uid cannot delete: empty the data
    // directory as that same uid first, then the host-owned remainder removes cleanly.
    Bun.spawnSync(
      ["docker", "run", "--rm", "--user", POD_UID_GID, "-v", `${join(dir, "data")}:${CONTAINER_DATA_DIR}`,
        IMAGE, "sh", "-c", `find ${CONTAINER_DATA_DIR} -mindepth 1 -delete`],
      { stdout: "pipe", stderr: "pipe" },
    );
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!DOCKER)("the repair script on a real Valkey 7.2 AOF", () => {
  test("(h)(i) the unrepaired server refuses the padded AOF; after the repair every key loads", () => {
    const out = runInPodContainer(REAL_SESSION);
    expect(out).toContain("UNREPAIRED_SERVER_REFUSED");
    expect(out).toContain("REPAIR_EXIT=0");
    expect(out).toContain(`DBSIZE=${KEY_COUNT}`);
    // Counted inside the container: the backup root belongs to the pod's uid, which the host's cannot read.
    expect(out).toContain("BACKUPS=1");
  }, { timeout: 120_000 });

  test("(l) real AOF files with the manifest missing are backed up byte-for-byte and moved aside; the server starts", () => {
    const out = runInPodContainer(REAL_SESSION_NO_MANIFEST);
    expect(Number(/FILES_BEFORE=(\d+)/.exec(out)?.[1])).toBeGreaterThanOrEqual(2);
    expect(out).toContain("REPAIR_EXIT=0");
    expect(out).toContain("BACKUPS=1");
    expect(out).toContain("BACKUP_BYTE_IDENTICAL");
    expect(out).toContain("LIVE_AOF_ENTRIES=0");
    expect(out).toContain("DBSIZE=0");
  }, { timeout: 120_000 });
});

// ---------------------------------------------------------------------------
// D. The lifecycle: the app container restarts INSIDE a retained pod
// ---------------------------------------------------------------------------

const LIFECYCLE_PASSWORD = "lifecycle-password";
// An upper bound on PATIENCE (150 x 200ms of the old fixed-interval poll), never a synchronization step.
const LIFECYCLE_PATIENCE_MS = 30_000;
const AUTH_ENV = `REDISCLI_AUTH=${LIFECYCLE_PASSWORD}`;

function docker(...args: string[]): { code: number; out: string } {
  const r = Bun.spawnSync(["docker", ...args], { stdout: "pipe", stderr: "pipe" });
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString() };
}

/** True once `done` holds; false if the container never gets there within the patience bound (control cases expect that). */
async function pollUntil(done: () => boolean, describe: string): Promise<boolean> {
  try {
    await waitUntil(done, { timeoutMs: LIFECYCLE_PATIENCE_MS, describe });
    return true;
  } catch {
    return false;
  }
}

/** Runs `body` over a fresh pod-owned data dir, then empties it as the pod uid before the host removes it. */
async function withPodDataDir<T>(body: (dataDir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "valkey-aof-real-"));
  try {
    const data = join(dir, "data");
    mkdirSync(data);
    chmodSync(data, 0o777);
    return await body(data);
  } finally {
    docker("run", "--rm", "--user", POD_UID_GID, "-v", `${join(dir, "data")}:${CONTAINER_DATA_DIR}`,
      IMAGE, "sh", "-c", `find ${CONTAINER_DATA_DIR} -mindepth 1 -delete`);
    rmSync(dir, { recursive: true, force: true });
  }
}

interface Lifecycle {
  servedAfterRestart: boolean;
  dbsizeAfterRestart: string;
  backupsAfterRestart: string;
  logsAfterRestart: string;
}

/**
 * The kubelet restarts a crashed app container in place and does NOT rerun a completed init container. Model that:
 * start a container with `startup` as its command over a valid AOF, kill it hard, NUL-pad the AOF tail as the pod
 * uid, then `docker start` THE SAME container again and report what the second start did.
 */
async function inPlaceRestartAfterNulTail(startup: string): Promise<Lifecycle> {
  return withPodDataDir(async (data) => {
    const name = `zeta-valkey-lifecycle-${process.pid}-${Date.now()}`;
    const ping = () => docker("exec", "-e", AUTH_ENV, name, "valkey-cli", "ping").out.includes("PONG");
    const sh = (script: string) => docker("exec", "-e", AUTH_ENV, name, "sh", "-c", script).out.trim();
    try {
      docker("run", "-d", "--name", name, "--user", POD_UID_GID,
        "-e", `${Declared.dataDirEnv}=${CONTAINER_DATA_DIR}`,
        "-e", `${Declared.keepBackupsEnv}=${keepBackups()}`,
        "-e", `REDIS_PASSWORD=${LIFECYCLE_PASSWORD}`,
        "-v", `${data}:${CONTAINER_DATA_DIR}`, IMAGE, "sh", "-c", startup);
      expect(await pollUntil(ping, "the first start answering PING")).toBe(true);
      sh(`i=0; while [ $i -lt ${KEY_COUNT} ]; do i=$((i+1)); echo "SET key$i value$i"; done | valkey-cli >/dev/null; sleep 2`);
      docker("kill", name);
      // the next hard shutdown: the filesystem extended the incr file but never wrote its data
      docker("run", "--rm", "--user", POD_UID_GID, "-v", `${data}:${CONTAINER_DATA_DIR}`, IMAGE, "sh", "-c",
        `INCR=$(ls ${CONTAINER_DATA_DIR}/${OnDisk.aofDir}/*.incr.aof); head -c 700 /dev/zero >> "$INCR"`);
      docker("start", name);
      const served = await pollUntil(ping, "the in-place restart answering PING");
      return {
        servedAfterRestart: served,
        dbsizeAfterRestart: served ? sh("valkey-cli dbsize | tr -dc '0-9'") : "",
        backupsAfterRestart: served ? sh(`ls ${CONTAINER_DATA_DIR}/${OnDisk.backupRoot} | wc -l | tr -dc '0-9'`) : "",
        logsAfterRestart: docker("logs", name).out,
      };
    } finally {
      docker("rm", "-f", name);
    }
  });
}

describe.skipIf(!DOCKER)("the Valkey container restarting in place inside a retained pod", () => {
  test("(m) the startup command repairs a NUL-padded AOF on the in-place restart: serving, every key back, a backup kept", async () => {
    const r = await inPlaceRestartAfterNulTail(startupScript());
    expect(r.servedAfterRestart).toBe(true);
    expect(r.dbsizeAfterRestart).toBe(String(KEY_COUNT));
    expect(r.backupsAfterRestart).toBe("1");
  }, { timeout: 180_000 });

  test("(n) control: the server command alone refuses the same volume on the in-place restart", async () => {
    const r = await inPlaceRestartAfterNulTail(serverCommand());
    expect(r.servedAfterRestart).toBe(false);
    expect(r.logsAfterRestart).toContain("Bad file format reading the append only file");
  }, { timeout: 180_000 });
});
