// lint-containerd-move.test.ts
//
// EXECUTES `full-ai-cluster/scripts/move-containerd-to-data-disk.sh` -- the live-node cut-over kit -- against a
// FAKE WORLD: real fixture directory trees for the old store, the data disk and the state directory, and stubs for
// every command that touches the machine (systemctl, mount, umount, rsync, k3s/kubectl/crictl, killall, nixos-rebuild,
// switch-to-configuration, curl, pgrep, kill, df, du, findmnt, mountpoint). The stubs keep a tiny world (which mounts
// exist, whether k3s is active, which processes run) and log every call, so a test can assert both the ORDER of the
// steps and what was NOT done.
//
// THE SCRIPT HAS NEVER RUN ON A NODE. This file is the only thing that has exercised it. It proves the logic -- the
// preflight refusals, the pre-copy loop, the cut-over order, every rollback path, the reclaim device guard, the dry-run
// promise -- NOT that systemd, mount(8), rsync(1), k3s-killall.sh, Longhorn or nixos-rebuild behave on the node as the
// stubs say they do. Those were READ from the live node (see docs/ops/CONTAINERD-ON-BIG-DISK.md), not run.
//
// THE PROPERTIES THAT MATTER, in order:
//   1. NOTHING IS DELETED before `reclaim`. The old root copy is the rollback source (the tree is inventoried).
//   2. A failure before the core checks pass ROLLS BACK: bind unmounted, previous generation restored, k3s started on
//      the ORIGINAL directory, node uncordoned. A failure BEFORE k3s was stopped only uncordons -- it must not stop a
//      healthy cluster to "roll back" a drain that never took it down.
//   3. The dry run changes nothing: every mutating command is only printed.
//   4. Docker's containerd (docker.service runs on this node) is never killed: k3s's processes are told apart by
//      their executable, not by the name.
//   5. `reclaim` refuses unless the directory it would empty is provably on the root device and not a mount.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Each case forks many short-lived bash stubs; on Windows that is tens of ms each. Linux CI is far faster.
setDefaultTimeout(240_000);

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "full-ai-cluster/scripts/move-containerd-to-data-disk.sh");
const GIB = 1024 * 1024 * 1024;

/** MSYS bash wants /c/Users/..., not C:\Users\...; a no-op on POSIX. */
function posix(p: string): string {
  if (process.platform !== "win32") return p;
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d: string) => `/${d.toLowerCase()}`);
}

// ---------------------------------------------------------------------------------------------------------------
// The stub dispatcher. ONE bash file; each command name is a two-line wrapper that execs it. No `${` appears here:
// String.raw would interpolate it.
// ---------------------------------------------------------------------------------------------------------------
const DISPATCHER = String.raw`#!/usr/bin/env bash
W="$ZW"
cmd="$1"; shift
echo "$cmd $*" >> "$W/calls.log"
flag() { [ -n "$(eval echo \$$1)" ]; }
case "$cmd" in
  rsync)
    n=$(cat "$W/rsync.n" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "$W/rsync.n"
    if [ "$W_RSYNC_FAIL_ON" = "$n" ]; then echo "rsync: simulated failure" >&2; exit 23; fi
    args=("$@"); cnt=$#
    dst="$(eval echo \$$cnt)"; src="$(eval echo \$$((cnt - 1)))"
    dry=0; itemize=0; del=0
    for a in "$@"; do
      case "$a" in --dry-run) dry=1 ;; --itemize-changes) itemize=1 ;; --delete) del=1 ;; esac
    done
    if [ $dry = 1 ] && [ $itemize = 1 ]; then
      if [ -n "$W_DIFF_AFTER_FINAL" ]; then echo "*deleting   blobs/sha256/leftover"; fi
      exit 0
    fi
    if [ $dry = 0 ] && [ -n "$W_RSYNC_HANG" ]; then
      while :; do sleep 1; done
    fi
    bytes=12345
    if [ $dry = 0 ]; then
      k=$(cat "$W/copy.n" 2>/dev/null || echo 0); k=$((k + 1)); echo "$k" > "$W/copy.n"
      if [ -n "$W_PASS_BYTES_SEQ" ]; then bytes="$(echo $W_PASS_BYTES_SEQ | awk -v k=$k '{print (k <= NF ? $k : $NF)}')"; fi
      mkdir -p "$dst"
      if [ $del = 1 ]; then find "$dst" -mindepth 1 -delete; fi
      cp -a "$src"/. "$dst"/
    fi
    echo "Number of files: 3"
    echo "Total transferred file size: $bytes bytes"
    exit 0 ;;
  mountpoint)
    grep -qxF "$2" "$W/mounts.txt" ;;
  findmnt)
    target=""; useT=0
    for a in "$@"; do
      if [ "$prev" = "-T" ]; then target="$a"; useT=1; fi
      prev="$a"
    done
    if [ $useT = 0 ]; then target="$(eval echo \$$#)"; fi
    if [ "$target" = "/" ]; then echo "/dev/nvme0n1p2"; exit 0; fi
    best=""; bestsrc=""
    while IFS="$(printf '\t')" read -r t s; do
      [ -n "$t" ] || continue
      if [ $useT = 1 ]; then
        case "$target" in "$t" | "$t"/*) if [ "$(echo -n "$t" | wc -c)" -gt "$(echo -n "$best" | wc -c)" ]; then best="$t"; bestsrc="$s"; fi ;; esac
      else
        if [ "$target" = "$t" ]; then best="$t"; bestsrc="$s"; fi
      fi
    done < "$W/sources.txt"
    if [ -z "$best" ]; then exit 1; fi
    echo "$bestsrc"; exit 0 ;;
  mount)
    if [ -n "$W_MOUNT_FAIL" ] && [ "$2" != "/" ]; then exit 32; fi
    src="$2"; dst="$3"
    echo "$dst" >> "$W/mounts.txt"
    if [ "$src" = "/" ]; then
      if [ -n "$W_ROOTVIEW_ON_DISK" ]; then
        printf '%s\t%s\n' "$dst" "/dev/nvme1n1p1" >> "$W/sources.txt"
      else
        printf '%s\t%s\n' "$dst" "/dev/nvme0n1p2" >> "$W/sources.txt"
      fi
      mkdir -p "$dst$ZOLD"; cp -a "$W/hidden-old"/. "$dst$ZOLD"/
    else
      printf '%s\t%s\n' "$dst" "/dev/nvme1n1p1[/containerd]" >> "$W/sources.txt"
    fi
    exit 0 ;;
  umount)
    if [ -n "$W_UMOUNT_FAIL" ]; then exit 32; fi
    t="$(eval echo \$$#)"
    grep -vxF "$t" "$W/mounts.txt" > "$W/mounts.tmp"; mv "$W/mounts.tmp" "$W/mounts.txt"
    tab="$(printf '\t')"; grep -v "^$t$tab" "$W/sources.txt" > "$W/sources.tmp"; mv "$W/sources.tmp" "$W/sources.txt"
    exit 0 ;;
  df)
    p="$(eval echo \$$#)"
    line="$(grep "^$p " "$W/sizes.txt" | head -n 1)"
    if [ -z "$line" ]; then exit 1; fi
    echo "Filesystem 1-blocks Used Available Capacity Mounted"
    echo "$line" | awk '{print "stub", $2, 0, $3, "0%", $1}'
    exit 0 ;;
  du)
    echo "$W_STORE_BYTES stub"; exit 0 ;;
  systemctl)
    case "$1" in
      cat) echo "[Service]"; echo "ExecStart=$ZK3S server \\"; exit 0 ;;
      is-active)
        unit="$(eval echo \$$#)"
        case "$unit" in
          k3s.service) [ -f "$W/k3s.active" ] ;;
          zeta-containerd-move-*) [ -n "$W_LAUNCH_ACTIVE" ] ;;
          *) exit 3 ;;
        esac ;;
      stop) rm -f "$W/k3s.active" "$W/node.ready"; exit 0 ;;
      start)
        if [ -n "$W_K3S_START_FAIL" ] && [ -f "$W/switched.once" ]; then exit 1; fi
        touch "$W/k3s.active"
        if [ -z "$W_NODE_NEVER_READY" ] || [ ! -f "$W/switched.once" ]; then touch "$W/node.ready"; fi
        if [ -n "$W_IMAGES_AFTER" ] && [ -f "$W/switched.once" ]; then echo "$W_IMAGES_AFTER" > "$W/images.count"; fi
        exit 0 ;;
      *) exit 0 ;;
    esac ;;
  k3s)
    sub="$1"; shift
    case "$sub" in
      crictl) n=$(cat "$W/images.count"); i=0; while [ $i -lt $n ]; do echo "sha256:img$i"; i=$((i + 1)); done; exit 0 ;;
      kubectl)
        if [ -n "$W_API_DOWN" ] && [ ! -f "$W/k3s.active" ]; then exit 1; fi
        case "$*" in
          *DiskPressure*)
            q=$(cat "$W/pressure.q" 2>/dev/null || echo 0); q=$((q + 1)); echo "$q" > "$W/pressure.q"
            if [ -n "$W_API_DOWN" ]; then exit 1; fi
            if [ -n "$W_PRESSURE_AFTER" ] && [ "$q" -gt "$W_PRESSURE_AFTER" ]; then echo True; exit 0; fi
            if [ -n "$W_PRESSURE" ]; then echo True; else echo False; fi; exit 0 ;;
          *'type=="Ready"'*) if [ -f "$W/node.ready" ] && [ -f "$W/k3s.active" ]; then echo True; else echo False; fi; exit 0 ;;
          *"get namespaces"*)
            echo kube-system; echo longhorn-system; echo flowdent-prod; echo postgres-shared; echo gitlab; exit 0 ;;
          *"jsonpath={.items[0].metadata.name}"*) echo node-1; exit 0 ;;
          cordon*|uncordon*) exit 0 ;;
          drain*) echo "UNEXPECTED kubectl drain" >> "$W/calls.log"; exit 0 ;;
          *"get namespaces"*)
            echo kube-system; echo longhorn-system; echo flowdent-prod; echo postgres-shared; echo gitlab; exit 0 ;;
          delete*) touch "$W/pods.deleted"; exit 0 ;;
          *"custom-columns=NS:"*)
            echo "kube-system coredns-1 ReplicaSet"; echo "kube-system cilium-1 DaemonSet"; echo "longhorn-system manager-1 DaemonSet"
            echo "monitoring node-exporter-1 DaemonSet"
            if [ ! -f "$W/pods.deleted" ] || [ -n "$W_PODS_STUCK" ]; then
              echo "flowdent-prod api-1 ReplicaSet"; echo "postgres-shared pg-1 Cluster"; echo "windows-vms virt-launcher-win11 VirtualMachineInstance"
            fi
            if { [ ! -f "$W/pods.deleted" ] || [ -n "$W_PODS_STUCK" ]; } && [ -n "$W_BARE_POD" ]; then echo "gitlab runner-job-1 <none>"; fi
            exit 0 ;;
          *"get volumes.longhorn.io"*)
            if [ -n "$W_VOL_ATTACHED" ]; then echo attached; else echo detached; fi; echo detached; exit 0 ;;
          *--raw=/readyz*) [ -f "$W/k3s.active" ]; exit $? ;;
          *"-n "*"get pods"*)
            ns="$2"
            case "$ns" in
              flowdent-prod) echo "api-1 1/1 Running 0 5m"; echo "api-2 1/1 Running 0 5m" ;;
              postgres-shared) echo "pg-1 2/2 Running 0 5m"; echo "pg-2 2/2 Running 0 5m"; echo "pg-3 2/2 Running 0 5m" ;;
              gitlab) echo "web-1 2/2 Running 0 5m" ;;
            esac
            exit 0 ;;
          *"get pods -A"*)
            echo "ns a 1/1 Running 0 5m"
            if [ -n "$W_PODS_BAD" ]; then echo "ns b 0/1 ImagePullBackOff 0 5m"; fi
            exit 0 ;;
        esac
        exit 0 ;;
    esac ;;
  killall)
    rm -f "$W/k3s.active" "$W/node.ready"
    if [ -z "$W_HOLDER_AFTER_KILLALL" ]; then : > "$W/procs.keep"; grep -v "k3s" "$W/procs.txt" > "$W/procs.tmp"; mv "$W/procs.tmp" "$W/procs.txt"; fi
    exit 0 ;;
  pgrep) awk '{print $1}' "$W/procs.txt"; exit 0 ;;
  procexe) grep "^$1 " "$W/procs.txt" | awk '{print $2}'; exit 0 ;;
  kill)
    pid="$(eval echo \$$#)"
    if grep -q "^$pid " "$W/procs.txt"; then
      if [ -z "$W_UNKILLABLE" ]; then grep -v "^$pid " "$W/procs.txt" > "$W/procs.tmp"; mv "$W/procs.tmp" "$W/procs.txt"; fi
      exit 0
    fi
    command kill "$@"; exit $? ;;
  curl)
    if [ -n "$W_HEALTH_FAIL" ]; then echo 502; else echo 200; fi; exit 0 ;;
  iscsiadm)
    case "$*" in
      "-m session") i=0; lim="$W_ISCSI"; [ -n "$lim" ] || lim=0; while [ $i -lt "$lim" ]; do echo "tcp: [$i] 10.0.0.1:3260,1 iqn.2019-10.io.longhorn:pvc-$i (non-flash)"; i=$((i + 1)); done ;;
    esac
    exit 0 ;;
  systemd-run) exit 0 ;;
  nixos-rebuild)
    mkdir -p result/bin result/etc/systemd/system
    printf '#!/usr/bin/env bash\nexec bash "%s" switch-to-configuration "$@"\n' "$ZSTUB" > result/bin/switch-to-configuration
    chmod +x result/bin/switch-to-configuration
    if [ -z "$W_BUILD_NO_UNIT" ]; then
      printf '[Mount]\nWhat=%s/containerd\nWhere=%s\n' "$ZDISK" "$ZOLD" > "result/etc/systemd/system/$ZUNIT"
    fi
    echo "zeta-containerd-store-assert" > result/etc/systemd/system/k3s.service
    [ -n "$W_BUILD_FAIL" ] && exit 1
    exit 0 ;;
  switch-to-configuration)
    touch "$W/switched.once"
    if [ -n "$W_SWITCH_FAIL" ]; then exit 4; fi
    touch "$W/k3s.active"
    if [ -z "$W_NODE_NEVER_READY" ]; then touch "$W/node.ready"; fi
    if [ -n "$W_IMAGES_AFTER" ]; then echo "$W_IMAGES_AFTER" > "$W/images.count"; fi
    exit 0 ;;
esac
exit $?
`;

interface World {
  readonly root: string;
  readonly old: string;
  readonly disk: string;
  readonly newDir: string;
  readonly state: string;
  readonly w: string;
  readonly lock: string;
  readonly rootview: string;
  readonly injected: string;
  readonly cursys: string;
  readonly unit: string;
  readonly env: Record<string, string>;
}

interface WorldOpts {
  readonly diskMounted?: boolean;
  readonly oldMounted?: boolean;
  readonly oldMissing?: boolean;
  readonly storeGiB?: number;
  readonly diskGiB?: number;
  readonly diskAvailGiB?: number;
  readonly diskOnRoot?: boolean;
  readonly k3sActive?: boolean;
  readonly built?: boolean;
  readonly state?: string;
  readonly newSeeded?: boolean;
  readonly env?: Record<string, string>;
  readonly euid?: string;
}

const cleanups: string[] = [];
afterAll(() => {
  if (process.env.DEBUG_MOVE !== undefined) return; // keep the fake worlds for inspection
  for (const d of cleanups) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

function wrapper(bin: string, name: string, dispatcher: string, as: string): void {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\nexec bash "${dispatcher}" ${as} "$@"\n`);
  chmodSync(join(bin, name), 0o755);
}

function world(o: WorldOpts = {}): World {
  const root = mkdtempSync(join(tmpdir(), "zeta-move-"));
  cleanups.push(root);
  const old = join(root, "var/lib/rancher/k3s/agent/containerd");
  const disk = join(root, "var/lib/longhorn-disk2");
  const newDir = join(disk, "containerd");
  const state = join(root, "state");
  const w = join(root, "w");
  const bin = join(root, "bin");
  const hidden = join(w, "hidden-old");
  for (const d of [old, disk, w, bin, join(old, "blobs/sha256"), join(old, "snapshots/1/fs"), hidden]) mkdirSync(d, { recursive: true });
  if (o.oldMissing === true) rmSync(old, { recursive: true, force: true });
  else {
    writeFileSync(join(old, "meta.db"), "bolt metadata v1\n");
    writeFileSync(join(old, "blobs/sha256/aaa"), "x".repeat(4096));
    writeFileSync(join(old, "blobs/sha256/bbb"), "y".repeat(8192));
    writeFileSync(join(old, "snapshots/1/fs/hello"), "layer\n");
  }
  writeFileSync(join(hidden, "meta.db"), "bolt metadata v1\n");
  writeFileSync(join(hidden, "stale-blob"), "z".repeat(2048));
  if (o.newSeeded === true) {
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(newDir, "meta.db"), "bolt metadata v1\n");
  }

  const cursys = join(w, "cursys");
  mkdirSync(join(cursys, "bin"), { recursive: true });
  mkdirSync(join(cursys, "etc/systemd/system"), { recursive: true });
  const dispatcher = join(w, "stub.sh");
  writeFileSync(dispatcher, DISPATCHER);
  const pd = posix(dispatcher);
  writeFileSync(join(cursys, "bin/switch-to-configuration"), `#!/usr/bin/env bash\nexec bash "${pd}" switch-to-configuration "$@"\n`);
  chmodSync(join(cursys, "bin/switch-to-configuration"), 0o755);
  writeFileSync(join(cursys, "etc/systemd/system/k3s.service"), "old\n");

  for (const [n, as] of [
    ["rsync", "rsync"], ["mountpoint", "mountpoint"], ["findmnt", "findmnt"], ["mount", "mount"], ["umount", "umount"],
    ["df", "df"], ["du", "du"], ["systemctl", "systemctl"], ["k3s", "k3s"], ["k3s-killall.sh", "killall"], ["pgrep", "pgrep"],
    ["procexe", "procexe"], ["kill", "kill"], ["curl", "curl"], ["iscsiadm", "iscsiadm"], ["systemd-run", "systemd-run"],
    ["nixos-rebuild", "nixos-rebuild"], ["nosleep", "nosleep"],
  ] as const) wrapper(bin, n, pd, as);
  writeFileSync(join(bin, "nosleep"), "#!/usr/bin/env bash\nexit 0\n");

  const mounts: string[] = [];
  const sources: string[] = [];
  if (o.diskMounted !== false) {
    mounts.push(posix(disk));
    sources.push(`${posix(disk)}\t${o.diskOnRoot === true ? "/dev/nvme0n1p2" : "/dev/nvme1n1p1"}`);
  }
  if (o.oldMounted === true) {
    mounts.push(posix(old));
    sources.push(`${posix(old)}\t/dev/nvme1n1p1[/containerd]`);
  }
  writeFileSync(join(w, "mounts.txt"), mounts.join("\n") + "\n");
  writeFileSync(join(w, "sources.txt"), sources.join("\n") + "\n");
  const diskGiB = o.diskGiB ?? 916;
  writeFileSync(join(w, "sizes.txt"), `${posix(disk)} ${String(diskGiB * GIB)} ${String((o.diskAvailGiB ?? 766) * GIB)}\n`);
  writeFileSync(join(w, "calls.log"), "");
  writeFileSync(join(w, "images.count"), "150\n");
  // pid exe — k3s's containerd (the k3s binary), two shims, k3s itself, and DOCKER's containerd, which must never be killed
  writeFileSync(
    join(w, "procs.txt"),
    [
      "1549 " + posix(join(bin, "k3s")),
      "1752 /var/lib/rancher/k3s/data/9a136a1b8ffd/bin/k3s", // as read live: k3s's containerd daemon is the unpacked k3s binary, not the store path
      "87704 /nix/store/abc-k3s-containerd-2.2.5-k3s2/bin/containerd-shim-runc-v2",
      "87705 /nix/store/abc-k3s-containerd-2.2.5-k3s2/bin/containerd-shim-runc-v2",
      "777 /nix/store/def-docker-containerd-29.7.2/bin/containerd",
    ].join("\n") + "\n",
  );
  if (o.k3sActive !== false) {
    writeFileSync(join(w, "k3s.active"), "");
    writeFileSync(join(w, "node.ready"), "");
  }

  const unit = `${posix(old).replace(/^\//, "").replace(/\//g, "-")}.mount`;
  const lock = join(root, "lock");
  const rootview = join(root, "mnt/rootview");
  const injected = join(root, "etc/zeta/containerd-data-disk");
  mkdirSync(join(root, "etc/zeta"), { recursive: true });
  mkdirSync(state, { recursive: true });
  if (o.state !== undefined) writeFileSync(join(state, "state"), o.state + "\n");
  if (o.built === true) {
    const sys = join(w, "builtsys");
    mkdirSync(join(sys, "bin"), { recursive: true });
    mkdirSync(join(sys, "etc/systemd/system"), { recursive: true });
    writeFileSync(join(sys, "bin/switch-to-configuration"), `#!/usr/bin/env bash\nexec bash "${pd}" switch-to-configuration "$@"\n`);
    chmodSync(join(sys, "bin/switch-to-configuration"), 0o755);
    writeFileSync(join(state, "new-system"), posix(sys) + "\n");
  }

  const env: Record<string, string> = {
    PATH: `${posix(bin)}:${process.env.PATH ?? "/usr/bin:/bin"}`,
    LC_ALL: "C",
    ZETA_MOVE_KEEP_PATH: "1",
    ZW: posix(w),
    ZOLD: posix(old),
    ZDISK: posix(disk),
    ZUNIT: unit,
    ZK3S: posix(join(bin, "k3s")),
    ZSTUB: pd,
    ZETA_MOVE_EUID: o.euid ?? "0",
    ZETA_MOVE_STATE_DIR: posix(state),
    ZETA_MOVE_LOCK_DIR: posix(lock),
    ZETA_MOVE_OLD: posix(old),
    ZETA_MOVE_ROOTVIEW: posix(rootview),
    ZETA_MOVE_INJECTED_FILE: posix(injected),
    ZETA_MOVE_MOUNTINFO: posix(join(w, "mountinfo.txt")),
    ZETA_MOVE_CURRENT_SYSTEM: posix(cursys),
    ZETA_MOVE_K3S_BIN: posix(join(bin, "k3s")),
    ZETA_MOVE_KILLALL: posix(join(bin, "k3s-killall.sh")),
    ZETA_MOVE_PROC_EXE: posix(join(bin, "procexe")),
    ZETA_MOVE_KILL: posix(join(bin, "kill")),
    ZETA_MOVE_SLEEP: posix(join(bin, "nosleep")),
    ZETA_MOVE_POLL_SECS: "0",
    ZETA_MOVE_TERM_WAIT: "0",
    ZETA_MOVE_READY_TIMEOUT: "0",
    ZETA_MOVE_PODS_TIMEOUT: "0",
    ZETA_MOVE_FLAKE: "/fake/flake",
    W_STORE_BYTES: String((o.storeGiB ?? 48) * GIB),
    ...(o.env ?? {}),
  };
  writeFileSync(join(w, "mountinfo.txt"), "");
  return { root, old, disk, newDir, state, w, lock, rootview, injected, cursys, unit, env };
}

function inventory(dir: string): readonly string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        out.push(`${p}/`);
        walk(p);
      } else {
        out.push(`${p}:${String(statSync(p).size)}`);
      }
    }
  };
  walk(dir);
  return out.sort();
}

interface Result {
  readonly status: number;
  readonly out: string;
  readonly calls: readonly string[];
}

function run(wd: World, args: readonly string[], extraEnv: Record<string, string> = {}): Result {
  const r = spawnSync("bash", [posix(SCRIPT), ...args], { env: { ...wd.env, ...extraEnv }, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (process.env.DEBUG_MOVE !== undefined) console.error(`---- ${args.join(" ")} -> ${String(r.status)}\n${r.stdout}${r.stderr}\nCALLS:\n${calls(wd).join("\n")}`);
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}`, calls: calls(wd) };
}

function calls(wd: World): readonly string[] {
  return readFileSync(join(wd.w, "calls.log"), "utf8").split("\n").filter((l) => l.length > 0);
}

/** Index of the first call (after `from`) that starts with `prefix` and satisfies `also`; -1 if none. */
function idx(cs: readonly string[], prefix: string, from = 0, also: (l: string) => boolean = () => true): number {
  for (let i = from; i < cs.length; i++) if (cs[i]?.startsWith(prefix) === true && also(cs[i] ?? "")) return i;
  return -1;
}
const has = (cs: readonly string[], prefix: string, also: (l: string) => boolean = () => true): boolean => idx(cs, prefix, 0, also) >= 0;
const state = (wd: World, key: string): string => {
  // One syscall, one answer, no check-then-use window: read and interpret ENOENT as "no state yet" (CWE-367).
  try {
    return readFileSync(join(wd.state, key), "utf8").trim();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw e;
  }
};
const isActive = (wd: World): boolean => existsSync(join(wd.w, "k3s.active"));
const procs = (wd: World): string => readFileSync(join(wd.w, "procs.txt"), "utf8");

const D = "--disk";

// ---------------------------------------------------------------------------------------------------------------
describe("preflight -- read-only, and it names every reason it refuses", () => {
  test("the happy fixture passes and changes nothing", () => {
    const wd = world();
    const before = inventory(join(wd.root, "var"));
    const r = run(wd, ["preflight", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("PREFLIGHT PASSED");
    expect(r.out).toContain(">= 1.5 x the store");
    expect(r.out).toContain("keeps");
    expect(r.calls.filter((c) => /^(mount --|umount|rsync|systemctl (stop|start)|killall|kill )/.test(c))).toEqual([]);
    expect(inventory(join(wd.root, "var"))).toEqual(before);
  });

  const refusals: ReadonlyArray<readonly [string, WorldOpts, string]> = [
    ["the data disk is not mounted", { diskMounted: false }, "is not a mount point"],
    ["the data disk is the ROOT device", { diskOnRoot: true }, "ROOT device"],
    ["there is no store to move", { oldMissing: true }, "does not exist"],
    ["free space is under 1.5x the store", { diskAvailGiB: 60 }, "under 1.5 x the store"],
    ["Longhorn would be left under its headroom (1.5x passes, 35% free does not)", { diskGiB: 400, diskAvailGiB: 120 }, "Longhorn stops scheduling replicas"],
    ["the node already has DiskPressure", { env: { W_PRESSURE: "1" } }, "DiskPressure=True"],
    ["the API is down (the pre-copy and drain need it)", { env: { W_API_DOWN: "1" }, k3sActive: false }, "cannot read the node's DiskPressure"],
    ["it is not root", { euid: "1000" }, "not root"],
    ["the store is already a mount of something else", { oldMounted: true, env: {} }, ""],
    ["the move already completed", { state: "reclaimed" }, "already complete"],
  ];
  for (const [name, opts, needle] of refusals) {
    test(`REFUSED: ${name}`, () => {
      const wd = world(opts);
      if (name.startsWith("the store is already a mount of something else")) {
        writeFileSync(join(wd.w, "sources.txt"), `${posix(wd.disk)}\t/dev/nvme1n1p1\n${posix(wd.old)}\t/dev/nvme0n1p3[/other]\n`);
      }
      const r = run(wd, ["preflight", D, posix(wd.disk)]);
      expect(r.status).toBe(1);
      expect(r.out).toContain("PREFLIGHT REFUSED");
      if (needle !== "") expect(r.out).toContain(needle);
      if (name.startsWith("the store is already")) expect(r.out).toContain("already a mount point, and not of");
    });
  }

  test("it WARNS (does not refuse) about what the window will kill: bare pods, and running VMs", () => {
    const wd = world({ env: { W_BARE_POD: "1" } });
    const r = run(wd, ["preflight", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("WARNING: bare pod(s) with no controller will be DELETED");
    expect(r.out).toContain("gitlab/runner-job-1");
    expect(r.out).toContain("WARNING: running VirtualMachineInstance(s)");
    expect(r.out).toContain("windows-vms/virt-launcher-win11");
  });

  test("an already-bound store (this script's own work, or an install that placed it) is accepted, not re-copied", () => {
    const wd = world({ oldMounted: true });
    const r = run(wd, ["preflight", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("already a bind mount");
  });

  test("--disk is required and must be absolute", () => {
    const wd = world();
    expect(run(wd, ["preflight"]).status).toBe(1);
    expect(run(wd, ["preflight", D, "relative/path"]).status).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("precopy -- online, throttled, converging, aborting on DiskPressure", () => {
  test("repeats until a pass moves less than the delta, then records it", () => {
    const wd = world();
    const r = run(wd, ["precopy", "--yes", D, posix(wd.disk)], { W_PASS_BYTES_SEQ: "3000000000 900000000 100" });
    expect(r.status).toBe(0);
    expect(r.out).toContain("pre-copy converged after 3 pass(es)");
    const rs = r.calls.filter((c) => c.startsWith("rsync"));
    expect(rs).toHaveLength(3);
    for (const c of rs) {
      expect(c).toContain("--bwlimit=300000"); // the throttle (ionice is a no-op on NVMe's `none` scheduler)
      expect(c).toContain("-x"); // never crosses into another filesystem
      expect(c).toContain("--numeric-ids");
      expect(c).toContain("-aHAX");
    }
    expect(state(wd, "precopy")).toContain("converged");
    expect(existsSync(join(wd.newDir, "meta.db"))).toBe(true);
    expect(inventory(wd.old).length).toBeGreaterThan(0); // the source is never touched
  });

  test("gives up after MAX_PASSES, says so, and still exits 0 (the final pass moves the rest)", () => {
    const wd = world();
    const r = run(wd, ["precopy", "--yes", D, posix(wd.disk)], { W_PASS_BYTES_SEQ: "9000000000", ZETA_MOVE_MAX_PASSES: "2" });
    expect(r.status).toBe(0);
    expect(r.out).toContain("did not converge in 2 passes");
    expect(state(wd, "precopy")).toContain("unconverged");
  });

  test("RED: DiskPressure appearing mid-copy STOPS rsync and exits 3", () => {
    const wd = world();
    const r = run(wd, ["precopy", "--yes", D, posix(wd.disk)], { W_RSYNC_HANG: "1", W_PRESSURE_AFTER: "2" });
    expect(r.status).toBe(3);
    expect(r.out).toContain("ABORT: node DiskPressure=True appeared");
  });

  test("a failing rsync is a failure, not a converged copy", () => {
    const wd = world();
    const r = run(wd, ["precopy", "--yes", D, posix(wd.disk)], { W_RSYNC_FAIL_ON: "1" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAILED rc=23");
  });

  test("dry-run: one read-only rsync pass, no directory created, nothing recorded", () => {
    const wd = world();
    const r = run(wd, ["precopy", "--dry-run", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(existsSync(wd.newDir)).toBe(false);
    expect(r.calls.filter((c) => c.startsWith("rsync")).every((c) => c.includes("--dry-run"))).toBe(true);
    expect(state(wd, "precopy")).toBe("");
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("build -- the persistent config is BUILT and PROVEN, never activated", () => {
  test("writes the injected file, builds, verifies the built system has the mount unit, records it", () => {
    const wd = world();
    const r = run(wd, ["build", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(readFileSync(wd.injected, "utf8").trim()).toBe(posix(wd.disk));
    expect(r.out).toContain("built system declares");
    expect(has(r.calls, "nixos-rebuild", (l) => l.includes("build --impure --flake /fake/flake#control-plane"))).toBe(true);
    expect(has(r.calls, "nixos-rebuild", (l) => /\b(switch|boot|test)\b/.test(l))).toBe(false); // build ONLY
    expect(has(r.calls, "switch-to-configuration")).toBe(false);
    expect(state(wd, "new-system")).toContain("result");
  });

  test("RED: a flake WITHOUT the module (no mount unit in the built system) is refused and the file restored", () => {
    const wd = world();
    const r = run(wd, ["build", "--yes", D, posix(wd.disk)], { W_BUILD_NO_UNIT: "1" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("has no mount unit binding");
    expect(existsSync(wd.injected)).toBe(false);
    expect(state(wd, "new-system")).toBe("");
  });

  test("RED: a failed build restores the injected file to what it was", () => {
    const wd = world();
    writeFileSync(wd.injected, "/var/lib/longhorn-disk1\n");
    const r = run(wd, ["build", "--yes", D, posix(wd.disk)], { W_BUILD_FAIL: "1" });
    expect(r.status).toBe(1);
    expect(readFileSync(wd.injected, "utf8").trim()).toBe("/var/lib/longhorn-disk1");
  });

  test("refuses without --yes, and a dry run writes nothing and builds nothing", () => {
    const wd = world();
    expect(run(wd, ["build", D, posix(wd.disk)]).status).toBe(1);
    const dry = run(wd, ["build", "--dry-run", D, posix(wd.disk)]);
    expect(dry.status).toBe(0);
    expect(existsSync(wd.injected)).toBe(false);
    expect(has(dry.calls, "nixos-rebuild")).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("cutover -- the order of the window", () => {
  test("a clean cutover: top-up, cordon, drain, stop, kill, final sync, verify, bind, switch, start, check, uncordon, verify", () => {
    const wd = world({ built: true });
    const before = inventory(wd.old);
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { ZETA_MOVE_PODS_TIMEOUT: "0" });
    expect(r.status).toBe(0);
    expect(r.out).toContain("DOWNTIME WINDOW BEGINS");
    expect(r.out).toContain("DOWNTIME WINDOW ENDS");
    expect(r.out).toContain("VERIFIED");
    const c = r.calls;
    const topup = idx(c, "rsync", 0, (l) => !l.includes("--dry-run"));
    const cordon = idx(c, "k3s kubectl cordon");
    const drain = idx(c, "k3s kubectl delete pods");
    const stop = idx(c, "systemctl stop k3s.service");
    const killall = idx(c, "killall");
    const final = idx(c, "rsync", killall + 1, (l) => !l.includes("--dry-run"));
    const verifyDiff = idx(c, "rsync", final + 1, (l) => l.includes("--dry-run") && l.includes("--itemize-changes"));
    const bind = idx(c, "mount --bind");
    const sw = idx(c, "switch-to-configuration");
    const uncordon = idx(c, "k3s kubectl uncordon");
    for (const [name, i] of Object.entries({ topup, cordon, drain, stop, killall, final, verifyDiff, bind, sw, uncordon })) {
      expect(i, `${name} must happen`).toBeGreaterThanOrEqual(0);
    }
    expect(topup).toBeLessThan(cordon); // the top-up is ONLINE, before the window
    expect(cordon).toBeLessThan(drain);
    expect(drain).toBeLessThan(stop);
    expect(stop).toBeLessThan(killall);
    expect(killall).toBeLessThan(final); // never copy while containerd runs
    expect(final).toBeLessThan(verifyDiff);
    expect(verifyDiff).toBeLessThan(bind); // never bind an unverified copy
    expect(bind).toBeLessThan(sw);
    expect(sw).toBeLessThan(uncordon);
    expect(c[bind]).toContain(`${posix(wd.newDir)} ${posix(wd.old)}`);
    expect(c[final]).toContain("--delete");
    // the persistent state it ends in
    expect(isActive(wd)).toBe(true);
    expect(state(wd, "state")).toBe("verified");
    expect(readFileSync(join(wd.w, "mounts.txt"), "utf8")).toContain(posix(wd.old));
    // PROPERTY 1: nothing deleted -- the old copy is exactly as it was
    expect(inventory(wd.old)).toEqual(before);
    expect(existsSync(join(wd.newDir, "meta.db"))).toBe(true);
    expect(c.some((l) => /^(rm|find|mv)\b/.test(l))).toBe(false);
    // the application pods are deleted gracefully, namespace by namespace, and the SYSTEM namespaces are left to the stop
    const deletes = c.filter((l) => l.startsWith("k3s kubectl delete pods"));
    expect(deletes.length).toBe(3); // flowdent-prod, postgres-shared, gitlab
    for (const d of deletes) {
      expect(d).not.toContain("--grace-period"); // each pod keeps ITS OWN grace (a Windows VM's virt-launcher has 330 s)
      expect(d).toContain("--wait=false");
      expect(d).not.toMatch(/-n (kube-system|longhorn-system)\b/);
    }
    // never `kubectl drain`: eviction cannot finish on a single node (PDBs with allowed=0), so it would only burn the window
    expect(c.some((l) => l.includes("kubectl drain") || l.includes("UNEXPECTED"))).toBe(false);
  });

  test("PROPERTY 4: Docker's containerd (pid 777) is never signalled; k3s's processes are", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_HOLDER_AFTER_KILLALL: "1" });
    expect(r.status).toBe(0);
    const kills = r.calls.filter((c) => c.startsWith("kill "));
    expect(kills.length).toBeGreaterThan(0);
    for (const k of kills) expect(k).not.toContain("777");
    expect(kills.some((k) => k.includes("1752"))).toBe(true); // k3s's containerd daemon (the k3s binary)
    expect(kills.some((k) => k.includes("87704"))).toBe(true); // a k3s shim
    expect(procs(wd)).toContain("777 "); // docker's survived
    expect(kills[0]).toContain("-TERM"); // graceful first: containerd flushes its metadata on TERM
  });

  test("it REFUSES without a built generation (the build is never inside the window), and without --yes", () => {
    const wd = world();
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("run the 'build' phase first");
    expect(has(r.calls, "systemctl stop")).toBe(false);
    const wd2 = world({ built: true });
    expect(run(wd2, ["cutover", D, posix(wd2.disk)]).status).toBe(1);
    expect(has(calls(wd2), "k3s kubectl cordon")).toBe(false);
  });

  test("an already cut-over node is a no-op", () => {
    const wd = world({ built: true, oldMounted: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("already cut over");
    expect(has(r.calls, "k3s kubectl cordon")).toBe(false);
  });

  test("a bare pod (a running CI job) would be lost: the cutover REFUSES before cordoning, and names it; the flag accepts the loss", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_BARE_POD: "1" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("gitlab/runner-job-1");
    expect(r.out).toContain("never re-created");
    expect(has(r.calls, "k3s kubectl cordon")).toBe(false);
    expect(has(r.calls, "systemctl stop")).toBe(false);
    const wd2 = world({ built: true });
    const ok = run(wd2, ["cutover", "--yes", D, posix(wd2.disk)], { W_BARE_POD: "1", ZETA_MOVE_ALLOW_BARE_PODS: "1" });
    expect(ok.status).toBe(0);
    expect(has(ok.calls, "k3s kubectl cordon")).toBe(true);
  });

  test("ZETA_MOVE_APP_GRACE caps a pod's grace; unset, the pod's own is used", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { ZETA_MOVE_APP_GRACE: "45" });
    expect(r.status).toBe(0);
    const deletes = r.calls.filter((c) => c.startsWith("k3s kubectl delete pods"));
    expect(deletes.length).toBe(3);
    for (const d of deletes) expect(d).toContain("--grace-period=45");
  });

  test("slow workloads are NOT a rollback: the node is up on the new store, exit 5, nothing unmounted", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_HEALTH_FAIL: "1" });
    expect(r.status).toBe(5);
    expect(r.out).toContain("VERIFY-INCOMPLETE");
    expect(r.out).toContain("NOT rolling back");
    expect(has(r.calls, "umount")).toBe(false);
    expect(readFileSync(join(wd.w, "mounts.txt"), "utf8")).toContain(posix(wd.old));
    expect(state(wd, "state")).toBe("cutover-done");
  });

  test("a non-zero switch-to-configuration does not by itself roll back (the core checks decide)", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_SWITCH_FAIL: "1", ZETA_MOVE_PODS_TIMEOUT: "0" });
    // the stub's failing switch does not start k3s, so the script starts it itself and the core checks pass
    expect(r.out).toContain("switch-to-configuration exited 4");
    expect(r.status).toBe(0);
  });
});

describe("cutover -- the dry run changes nothing", () => {
  test("every mutating command is only PRINTED; the only rsync calls are --dry-run; no state, no copy", () => {
    const wd = world({ built: true });
    const oldBefore = inventory(wd.old);
    const diskBefore = inventory(wd.disk);
    const r = run(wd, ["cutover", "--dry-run", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    for (const needle of ["cordon", "delete pods", "systemctl stop", "mount --bind", "switch-to-configuration switch"]) {
      expect(r.out).toContain(`DRY-RUN: `);
      expect(r.out).toMatch(new RegExp(`DRY-RUN: .*${needle.replace(/[-/]/g, ".")}`));
    }
    const forbidden = /^(k3s kubectl (cordon|uncordon|drain|delete)|systemctl (stop|start)|killall|mount --|umount|switch-to-configuration|kill )/;
    expect(r.calls.filter((c) => forbidden.test(c))).toEqual([]);
    const rs = r.calls.filter((c) => c.startsWith("rsync"));
    expect(rs.length).toBeGreaterThan(0);
    expect(rs.every((c) => c.includes("--dry-run"))).toBe(true);
    expect(inventory(wd.old)).toEqual(oldBefore);
    expect(inventory(wd.disk)).toEqual(diskBefore);
    expect(isActive(wd)).toBe(true);
    expect(state(wd, "state")).toBe("");
    expect(state(wd, "prev-system")).toBe("");
  });

  test("a dry run without a built generation still runs (it says a real one would refuse)", () => {
    const wd = world();
    const r = run(wd, ["cutover", "--dry-run", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("a real cutover REFUSES until 'build' has run");
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("cutover -- every failure rolls back to the ORIGINAL store", () => {
  const afterRollback = (wd: World, r: Result, opts: { readonly switched: boolean }): void => {
    expect(r.status).not.toBe(0);
    expect(r.out).toContain("ROLLBACK");
    // k3s is running again, on the original directory, and the node is schedulable
    expect(isActive(wd)).toBe(true);
    expect(readFileSync(join(wd.w, "mounts.txt"), "utf8")).not.toContain(posix(wd.old));
    expect(has(r.calls, "k3s kubectl uncordon")).toBe(true);
    expect(state(wd, "state")).toBe("rolled-back");
    expect(existsSync(join(wd.old, "meta.db"))).toBe(true); // the original store is intact
    expect(existsSync(wd.injected)).toBe(false); // the injected file is restored to absent
    if (opts.switched) {
      expect(has(r.calls, "switch-to-configuration")).toBe(true);
    }
  };

  test("application pods that will not stop: k3s is NOT stopped, so ONLY the cordon is undone", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_PODS_STUCK: "1", ZETA_MOVE_DRAIN_TIMEOUT: "0" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("did not stop cleanly");
    expect(r.out).toContain("k3s has NOT been stopped");
    expect(r.out).toContain("nothing had been stopped");
    expect(has(r.calls, "systemctl stop")).toBe(false);
    expect(has(r.calls, "killall")).toBe(false);
    expect(has(r.calls, "k3s kubectl uncordon")).toBe(true);
    expect(isActive(wd)).toBe(true);
  });

  test("a Longhorn volume that stays attached after the pods are gone: the engines would die mid-write -> refused, uncordoned", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_VOL_ATTACHED: "1", ZETA_MOVE_DETACH_TIMEOUT: "0" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("1 attached Longhorn volume");
    expect(has(r.calls, "systemctl stop")).toBe(false);
    expect(has(r.calls, "k3s kubectl uncordon")).toBe(true);
  });

  test("ZETA_MOVE_DRAIN_FAILURE=continue accepts an unclean stop, loudly", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_PODS_STUCK: "1", ZETA_MOVE_DRAIN_TIMEOUT: "0", ZETA_MOVE_DRAIN_FAILURE: "continue" });
    expect(r.out).toContain("unclean stop");
    expect(has(r.calls, "systemctl stop")).toBe(true);
  });

  test("the FINAL rsync fails: k3s was stopped, so it is started again on the original directory", () => {
    const wd = world({ built: true });
    // rsync calls: 1 = top-up, 2 = final
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_RSYNC_FAIL_ON: "2" });
    afterRollback(wd, r, { switched: false });
    expect(has(r.calls, "mount --bind")).toBe(false);
    expect(has(r.calls, "systemctl start k3s.service")).toBe(true);
  });

  test("the copy does not verify (rsync still sees a difference): never bound, rolled back", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_DIFF_AFTER_FINAL: "1" });
    afterRollback(wd, r, { switched: false });
    expect(r.out).toContain("COPY CHECK FAIL");
    expect(has(r.calls, "mount --bind")).toBe(false);
  });

  test("a k3s process that survives SIGKILL aborts BEFORE any copy, and rolls back", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_HOLDER_AFTER_KILLALL: "1", W_UNKILLABLE: "1" });
    afterRollback(wd, r, { switched: false });
    expect(r.out).toContain("survived SIGKILL");
    expect(has(r.calls, "rsync", (l) => !l.includes("--dry-run") && l.includes("--delete"))).toBe(true); // only the top-up, below
    expect(r.calls.filter((c) => c.startsWith("rsync") && !c.includes("--dry-run")).length).toBe(1);
    expect(has(r.calls, "mount --bind")).toBe(false);
  });

  test("the bind mount fails: no switch is attempted, k3s restarts on the original directory", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_MOUNT_FAIL: "1" });
    afterRollback(wd, r, { switched: false });
    expect(has(r.calls, "switch-to-configuration")).toBe(false);
  });

  test("the node never becomes Ready on the new store: unmount, switch BACK to the previous generation, start, uncordon", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_NODE_NEVER_READY: "1" });
    afterRollback(wd, r, { switched: true });
    const c = r.calls;
    const bind = idx(c, "mount --bind");
    const firstSwitch = idx(c, "switch-to-configuration");
    const umount = idx(c, "umount");
    const secondSwitch = idx(c, "switch-to-configuration", firstSwitch + 1);
    expect(bind).toBeGreaterThanOrEqual(0);
    expect(firstSwitch).toBeGreaterThan(bind);
    expect(umount).toBeGreaterThan(firstSwitch);
    expect(secondSwitch).toBeGreaterThan(umount); // the previous generation is restored AFTER the bind is gone
    expect(r.out).toContain("switching back to the previous generation");
  });

  test("containerd lists far fewer images than before: the new store is not the copy -> rolled back (no silent re-pull)", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_IMAGES_AFTER: "10" });
    afterRollback(wd, r, { switched: true });
    expect(r.out).toContain("re-pull everything onto the data disk");
  });

  test("a rollback that cannot unmount says what to do by hand and leaves the original store alone", () => {
    const wd = world({ built: true });
    const r = run(wd, ["cutover", "--yes", D, posix(wd.disk)], { W_NODE_NEVER_READY: "1", W_UMOUNT_FAIL: "1" });
    expect(r.out).toContain("is still a mount point");
    expect(existsSync(join(wd.old, "meta.db"))).toBe(true);
  });

  test("only ONE run at a time: a live lock holder -> exit 4, nothing touched", () => {
    const wd = world({ built: true });
    const script = `mkdir -p "${posix(wd.lock)}"; sleep 20 & echo $! > "${posix(wd.lock)}/pid"; exec bash "${posix(SCRIPT)}" cutover --yes --disk "${posix(wd.disk)}"`;
    // safe-io-ok: this test's contract IS a compound shell program -- background a sleep as a live lock holder, capture its pid, then exec the script under test -- which an argv vector cannot express; the command line is a constant built from posix()-escaped temp paths, no external data.
    const r = spawnSync("bash", ["-c", script], { env: wd.env, encoding: "utf8" });
    expect(r.status).toBe(4);
    expect(`${r.stdout}${r.stderr}`).toContain("holds");
    const cs = calls(wd);
    expect(cs.some((c) => /^(systemctl stop|killall|mount --|k3s kubectl (cordon|delete))/.test(c))).toBe(false);
  });

  test("a STALE lock (dead pid) is removed and the run proceeds", () => {
    const wd = world();
    mkdirSync(wd.lock, { recursive: true });
    writeFileSync(join(wd.lock, "pid"), "999999");
    const r = run(wd, ["precopy", "--yes", D, posix(wd.disk)]);
    expect(r.out).toContain("stale lock");
    expect(r.status).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("reclaim -- the only deletion, and it is guarded", () => {
  const verified = (extra: WorldOpts = {}): World => world({ built: true, oldMounted: true, newSeeded: true, state: "verified", ...extra });

  test("refuses without --yes, and before a verified cutover", () => {
    const wd = verified();
    expect(run(wd, ["reclaim", D, posix(wd.disk)]).status).toBe(1);
    expect(has(calls(wd), "mount --")).toBe(false);
    const wd2 = world({ oldMounted: true, newSeeded: true, state: "cutover-started" });
    const r = run(wd2, ["reclaim", "--yes", D, posix(wd2.disk)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("only runs after a successful cutover");
  });

  test("empties ONLY the hidden root copy, through a non-recursive bind of `/`, and leaves the live store untouched", () => {
    const wd = verified();
    const liveBefore = inventory(wd.newDir);
    const r = run(wd, ["reclaim", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("RECLAIMED");
    expect(state(wd, "state")).toBe("reclaimed");
    const bindRoot = r.calls.find((c) => c.startsWith("mount --bind / "));
    expect(bindRoot).toBeDefined();
    expect(bindRoot).not.toContain("--rbind"); // a recursive bind would expose the data disk and delete the live store
    const hidden = join(wd.rootview, posix(wd.old));
    expect(inventory(hidden)).toEqual([]); // emptied
    expect(existsSync(hidden)).toBe(true); // the directory itself stays (it is k3s's mount point)
    expect(inventory(wd.newDir)).toEqual(liveBefore); // the data is untouched
    expect(has(r.calls, "umount", (l) => l.includes(posix(wd.rootview)))).toBe(true);
  });

  test("RED: the rootview resolves to the DATA DISK -> REFUSED, nothing deleted", () => {
    const wd = verified({ env: { W_ROOTVIEW_ON_DISK: "1" } });
    const r = run(wd, ["reclaim", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("not provably the hidden directory on the ROOT device");
    expect(r.out).toContain("Nothing was deleted");
    expect(readdirSync(join(wd.rootview, posix(wd.old))).length).toBeGreaterThan(0);
    expect(state(wd, "state")).toBe("verified");
  });

  test("RED: the store is not actually bound (nothing would protect the data) -> refused before any mount", () => {
    const wd = world({ built: true, newSeeded: true, state: "verified" });
    const r = run(wd, ["reclaim", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("is not the bind mount of");
    expect(has(r.calls, "mount --bind / ")).toBe(false);
  });

  test("RED: k3s is not active/Ready on the new store -> the rollback source is kept", () => {
    const wd = verified({ k3sActive: false });
    const r = run(wd, ["reclaim", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("refusing to delete the rollback source");
  });

  test("RED: an empty new store -> refused", () => {
    const wd = world({ built: true, oldMounted: true, state: "verified" });
    mkdirSync(wd.newDir, { recursive: true });
    expect(run(wd, ["reclaim", "--yes", D, posix(wd.disk)]).status).toBe(1);
  });

  test("a second reclaim is a no-op", () => {
    const wd = world({ oldMounted: true, newSeeded: true, state: "reclaimed" });
    const r = run(wd, ["reclaim", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("already reclaimed");
  });

  test("dry-run: prints the plan, mounts nothing, deletes nothing", () => {
    const wd = verified();
    const r = run(wd, ["reclaim", "--dry-run", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(has(r.calls, "mount --")).toBe(false);
    expect(state(wd, "state")).toBe("verified");
  });

  test("the script's ONLY file deletion is the guarded `find -xdev -mindepth 1 -delete` in reclaim", () => {
    const src = readFileSync(SCRIPT, "utf8");
    const code = src.split("\n").filter((l) => !l.trimStart().startsWith("#"));
    const deletes = code.filter((l) => /^\s*find\b.*-delete\b/.test(l));
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain("-xdev -mindepth 1");
    // no rm -r anywhere except the lock directory
    for (const l of code.filter((l) => /\brm\s+-[a-z]*r/.test(l))) expect(l).toContain("LOCK_DIR");
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("manual rollback, launch, status", () => {
  test("rollback after a verified cutover (before reclaim) restores the original store", () => {
    const wd = world({ built: true, oldMounted: true, newSeeded: true, state: "verified" });
    writeFileSync(join(wd.state, "switched"), "yes\n");
    writeFileSync(join(wd.state, "prev-system"), posix(wd.cursys) + "\n");
    const r = run(wd, ["rollback", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("ROLLED BACK");
    expect(readFileSync(join(wd.w, "mounts.txt"), "utf8")).not.toContain(posix(wd.old));
    expect(has(r.calls, "switch-to-configuration")).toBe(true);
    expect(isActive(wd)).toBe(true);
  });

  test("rollback after reclaim REFUSES: there is no original left to roll back to", () => {
    const wd = world({ oldMounted: true, newSeeded: true, state: "reclaimed" });
    const r = run(wd, ["rollback", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("nothing to roll back to");
  });

  test("launch runs the phase as a DETACHED transient unit with its own log, and forwards the flags", () => {
    const wd = world();
    const r = run(wd, ["launch", "cutover", "--yes", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    const sr = r.calls.find((c) => c.startsWith("systemd-run"));
    expect(sr).toBeDefined();
    expect(sr).toContain("--unit=zeta-containerd-move-cutover");
    expect(sr).toContain("--collect");
    expect(sr).toContain("StandardOutput=append:");
    expect(sr).toContain("cutover");
    expect(sr).toContain("--yes");
    expect(sr).toContain(`--disk ${posix(wd.disk)}`);
    expect(sr).toContain("--setenv=HOME=/root"); // nix needs a HOME under a transient unit
    expect(sr).toContain("--flake /fake/flake"); // the flake travels as a flag
    expect(r.out).toContain("journalctl -u zeta-containerd-move-cutover");
  });

  test("launch forwards every ZETA_MOVE_* override into the transient unit (it does not inherit this shell's environment)", () => {
    const wd = world();
    const r = run(wd, ["launch", "cutover", "--yes", D, posix(wd.disk)], { ZETA_MOVE_DRAIN_FAILURE: "continue", ZETA_MOVE_APP_GRACE: "45" });
    const sr = r.calls.find((c) => c.startsWith("systemd-run")) ?? "";
    expect(sr).toContain("--setenv=ZETA_MOVE_DRAIN_FAILURE=continue");
    expect(sr).toContain("--setenv=ZETA_MOVE_APP_GRACE=45");
  });

  test("launch refuses a phase that is already running, an unknown phase, and a non-root caller", () => {
    const wd = world();
    expect(run(wd, ["launch", "cutover", D, posix(wd.disk)], { W_LAUNCH_ACTIVE: "1" }).status).toBe(4);
    expect(run(wd, ["launch", "explode", D, posix(wd.disk)]).status).toBe(2);
    const wd2 = world({ euid: "1000" });
    expect(run(wd2, ["launch", "cutover", D, posix(wd2.disk)]).status).toBe(1);
    expect(has(calls(wd2), "systemd-run")).toBe(false);
  });

  test("status reports the state and where the store is", () => {
    const wd = world({ state: "verified", oldMounted: true });
    const r = run(wd, ["status", D, posix(wd.disk)]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("state: verified");
    expect(r.out).toContain("is a mount point from /dev/nvme1n1p1[/containerd]");
  });

  test("usage errors are exit 2 and touch nothing", () => {
    const wd = world();
    expect(run(wd, []).status).toBe(2);
    expect(run(wd, ["frobnicate"]).status).toBe(2);
    expect(run(wd, ["precopy", "cutover"]).status).toBe(2);
  });

  test("it works on a node whose k3s unit and binary are DISCOVERED, not hard-coded", () => {
    const src = readFileSync(SCRIPT, "utf8");
    expect(src).toContain('"$SYSTEMCTL" cat "$K3S_UNIT"');
    expect(src).toContain("sed -n 's/^ExecStart=");
    expect(src).not.toMatch(/\/nix\/store\/[a-z0-9]{32}/); // no store path baked in
  });
});
