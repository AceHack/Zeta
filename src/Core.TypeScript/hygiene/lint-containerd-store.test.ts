// lint-containerd-store.test.ts
//
// EXECUTES `full-ai-cluster/nixos/modules/containerd-store.sh` over fixture directories with stubbed
// `mountpoint` / `findmnt`, EXECUTES the installer's `zeta_containerd_disk_pick`, and pins the Nix wiring
// that makes k3s REFUSE to start when the container store's bind mount is missing.
//
// WHAT IT IS FOR. On the measured node (node-5b2dfa, 2026-10-05) /var/lib/rancher/k3s/agent/containerd
// held 48 GiB (35 GiB of snapshots, 14 GiB of content, 132 images) on a 120 GiB root that the kubelet evicts
// pods from at ~17.7 GiB free, while the two Longhorn data disks were 88% free. The fix is a bind mount of
// <data disk>/containerd onto that path, declared in nixos/modules/containerd-on-data-disk.nix.
//
// THE PROPERTIES THAT MATTER, in order:
//   1. FAIL CLOSED. A missing data disk, a missing directory on it, or a bind of the wrong thing keeps k3s
//      down. A k3s that starts with the mount absent silently re-pulls every image onto the root disk -- the
//      incident, delivered with no error. (RED tests below; the one place this differs from
//      local-storage-placement.sh, which fails open because ITS fallback is the old working behaviour.)
//   2. It NEVER hides a populated store behind an empty one: root populated + disk empty is a refusal that
//      changes nothing. That is "a node upgraded in place without the copy".
//   3. It never creates the store on the root filesystem: the disk must be a mount point BEFORE the
//      directory is made, or `mkdir -p <disk>/containerd` would quietly build it on root.
//   4. A misconfiguration (empty / relative disk, a subdir with a slash) is exit 2, never a guess.
//
// WHY IT LIVES HERE AND NOT ONLY IN NIX: no VM test boots this (nix is not available where it was written).
// NOT PROVEN: systemd honouring the unit ordering on a booted guest; `findmnt` printing the `[/subdir]`
// bind form is measured on the live node (`/nix/store /dev/nvme0n1p2[/nix/store]`) and is what the stub imitates.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "full-ai-cluster/nixos/modules/containerd-store.sh");
const MODULE = join(REPO_ROOT, "full-ai-cluster/nixos/modules/containerd-on-data-disk.nix");
const COMMON = join(REPO_ROOT, "full-ai-cluster/nixos/modules/common.nix");
const INSTALLER = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const PLACEMENT = join(REPO_ROOT, "full-ai-cluster/nixos/modules/local-storage-placement.sh");

const GIB = 1024 * 1024 * 1024;

/** MSYS bash wants /c/Users/..., not C:\Users\...; a no-op on POSIX. */
function posix(p: string): string {
  if (process.platform !== "win32") return p;
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d: string) => `/${d.toLowerCase()}`);
}

interface Fixture {
  readonly root: string;
  readonly disk: string;
  readonly dst: string;
  readonly src: string;
  readonly env: Record<string, string>;
}

/**
 * `mounted` lists mount points that exist as mounts (the disk, optionally the target). `sources` maps a mount
 * point to what `findmnt -n -o SOURCE` prints for it. Nothing is ever really mounted: the script only ASKS.
 */
function fixture(opts: {
  readonly diskMounted?: boolean;
  readonly dstMounted?: boolean;
  readonly diskSource?: string;
  readonly dstSource?: string;
  readonly rootFiles?: readonly string[];
  readonly diskFiles?: readonly string[];
  readonly diskDirMissing?: boolean;
  readonly dstMissing?: boolean;
  readonly subdir?: string;
}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "zeta-cstore-"));
  const lib = join(root, "var/lib");
  const disk = join(lib, "longhorn-disk2");
  const subdir = opts.subdir ?? "containerd";
  const dst = join(lib, "rancher/k3s/agent/containerd");
  const src = join(disk, subdir);
  mkdirSync(disk, { recursive: true });
  if (opts.dstMissing !== true) mkdirSync(dst, { recursive: true });
  if (opts.diskDirMissing !== true && (opts.diskFiles?.length ?? 0) > 0) mkdirSync(src, { recursive: true });
  for (const f of opts.rootFiles ?? []) writeFileSync(join(dst, f), "root store\n");
  for (const f of opts.diskFiles ?? []) writeFileSync(join(src, f), "disk store\n");

  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  const mounts: string[] = [];
  if (opts.diskMounted !== false) mounts.push(posix(disk));
  if (opts.dstMounted === true) mounts.push(posix(dst));
  const mountsFile = join(root, "mounts.txt");
  writeFileSync(mountsFile, mounts.join("\n") + "\n");

  const sources: string[] = [];
  const diskSource = opts.diskSource ?? "/dev/nvme1n1p1";
  if (opts.diskMounted !== false && diskSource !== "") sources.push(`${posix(disk)}\t${diskSource}`);
  if (opts.dstMounted === true) sources.push(`${posix(dst)}\t${opts.dstSource ?? `${diskSource}[/${subdir}]`}`);
  const sourcesFile = join(root, "sources.txt");
  writeFileSync(sourcesFile, sources.join("\n") + "\n");

  // `mountpoint -q P` -> 0 iff P is listed. `findmnt -n -o SOURCE P` -> the recorded source, or exit 1.
  writeFileSync(join(bin, "mountpoint"), `#!/usr/bin/env bash\ngrep -qxF "$2" "${posix(mountsFile)}"\n`);
  writeFileSync(
    join(bin, "findmnt"),
    `#!/usr/bin/env bash\nawk -F'\\t' -v p="$4" '$1==p {print $2; found=1} END {exit found?0:1}' "${posix(sourcesFile)}"\n`,
  );
  for (const n of ["mountpoint", "findmnt"]) chmodSync(join(bin, n), 0o755);

  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    LC_ALL: "C",
    ZETA_CONTAINERD_DISK: posix(disk),
    ZETA_CONTAINERD_DIR: posix(dst),
    ZETA_MOUNTPOINT_BIN: posix(join(bin, "mountpoint")),
    ZETA_FINDMNT_BIN: posix(join(bin, "findmnt")),
  };
  if (opts.subdir !== undefined) env.ZETA_CONTAINERD_SUBDIR = opts.subdir;
  return { root, disk, dst, src, env };
}

function inventory(dir: string): readonly string[] {
  const out: string[] = [];
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

function run(f: Fixture, mode: string, extraEnv: Record<string, string> = {}): { readonly status: number; readonly out: string } {
  const r = spawnSync("bash", [posix(SCRIPT), mode], { env: { ...f.env, ...extraEnv }, encoding: "utf8", maxBuffer: 64 * 1024 });
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

describe("containerd-store prepare -- the happy paths", () => {
  test("a mounted data disk: the directory on it is created, the mount point exists, exit 0", () => {
    const f = fixture({ dstMissing: true });
    const r = run(f, "prepare");
    expect(r.status).toBe(0);
    expect(r.out).toContain("READY");
    expect(existsSync(f.src)).toBe(true);
    expect(existsSync(f.dst)).toBe(true);
  });

  test("an EMPTY root directory is not 'populated': first boot of a fresh install proceeds", () => {
    const f = fixture({});
    expect(run(f, "prepare").status).toBe(0);
    expect(existsSync(f.src)).toBe(true);
  });

  test("the cut-over state -- root copy still there, disk copy seeded -- proceeds, loudly", () => {
    const f = fixture({ rootFiles: ["meta.db"], diskFiles: ["meta.db"] });
    const before = inventory(f.root);
    const r = run(f, "prepare");
    expect(r.status).toBe(0);
    expect(r.out).toContain("WARNING");
    expect(r.out).toContain("OLD root copy");
    expect(inventory(f.root)).toEqual(before); // nothing moved, nothing deleted
  });

  test("already bound to the RIGHT source: idempotent, nothing to do", () => {
    const f = fixture({ dstMounted: true });
    const r = run(f, "prepare");
    expect(r.status).toBe(0);
    expect(r.out).toContain("ALREADY-PLACED");
  });

  test("a custom subdir is honoured end to end", () => {
    const f = fixture({ dstMounted: true, subdir: "cstore" });
    const r = run(f, "prepare");
    expect(r.status).toBe(0);
    expect(r.out).toContain("longhorn-disk2/cstore");
  });
});

describe("containerd-store prepare -- RED: it refuses, changes nothing, and k3s stays down", () => {
  test("RED: the data disk is NOT mounted -> exit 1, and <disk>/containerd is NOT created on root", () => {
    const f = fixture({ diskMounted: false });
    const before = inventory(f.root);
    const r = run(f, "prepare");
    expect(r.status).toBe(1);
    expect(r.out).toContain("REFUSED");
    expect(r.out).toContain("ROOT filesystem");
    expect(existsSync(f.src)).toBe(false); // the mkdir that would have built the store on root never ran
    expect(inventory(f.root)).toEqual(before);
  });

  test("RED: root holds a store and the disk directory is empty -> exit 1 (a mount would HIDE it), nothing changed", () => {
    const f = fixture({ rootFiles: ["io.containerd.metadata.v1.bolt", "snapshots"] });
    const r = run(f, "prepare");
    // The disk directory is created by prepare only on the proceed path; the refusal happens after the mkdir
    // of an EMPTY dir, which is harmless. What must be untouched is the ROOT store.
    expect(r.status).toBe(1);
    expect(r.out).toContain("HIDE");
    expect(r.out).toContain("CONTAINERD-ON-BIG-DISK.md");
    expect(readdirSync(f.dst).sort()).toEqual(["io.containerd.metadata.v1.bolt", "snapshots"]);
  });

  test("a hidden file in the root store counts as data (ls -A, not ls)", () => {
    const f = fixture({ rootFiles: [".keep"] });
    expect(run(f, "prepare").status).toBe(1);
  });

  test("RED: already mounted but from the WRONG source -> exit 1 (a stray mount is not the store)", () => {
    const f = fixture({ dstMounted: true, dstSource: "/dev/nvme0n1p2[/var/lib/rancher/k3s/agent/containerd]" });
    const r = run(f, "prepare");
    expect(r.status).toBe(1);
    expect(r.out).toContain("expected '/dev/nvme1n1p1[/containerd]'");
  });
});

describe("containerd-store assert -- k3s's first ExecStartPre", () => {
  test("bound to <disk>[/containerd] -> exit 0", () => {
    const f = fixture({ dstMounted: true });
    const r = run(f, "assert");
    expect(r.status).toBe(0);
    expect(r.out).toContain("OK:");
  });

  test("RED: the target is a plain directory on root (the exact silent-fallback state) -> exit 1", () => {
    const f = fixture({ rootFiles: ["x"] });
    const r = run(f, "assert");
    expect(r.status).toBe(1);
    expect(r.out).toContain("not a mount point");
    expect(r.out).toContain("ROOT filesystem");
  });

  test("RED: even an EMPTY directory on root is refused -- empty is exactly what k3s would re-fill", () => {
    const f = fixture({});
    expect(run(f, "assert").status).toBe(1);
  });

  test("RED: mounted from another device's directory -> exit 1", () => {
    const f = fixture({ dstMounted: true, dstSource: "/dev/nvme0n1p3[/containerd]" });
    const r = run(f, "assert");
    expect(r.status).toBe(1);
    expect(r.out).toContain("/dev/nvme0n1p3[/containerd]");
  });

  test("RED: mounted from the right device but a DIFFERENT directory on it -> exit 1", () => {
    const f = fixture({ dstMounted: true, dstSource: "/dev/nvme1n1p1[/zeta-local-storage]" });
    expect(run(f, "assert").status).toBe(1);
  });

  test("RED: the data disk itself is not a mounted filesystem -> exit 1, even if the target claims a source", () => {
    const f = fixture({ dstMounted: true, diskMounted: false, dstSource: "/dev/nvme1n1p1[/containerd]" });
    expect(run(f, "assert").status).toBe(1);
  });

  test("RED: findmnt knows nothing about the target (empty source) -> exit 1, never a pass by default", () => {
    const f = fixture({ dstMounted: true, dstSource: "" });
    expect(run(f, "assert").status).toBe(1);
  });

  test("assert never writes: the inventory is identical after a refusal and after a pass", () => {
    for (const f of [fixture({ rootFiles: ["x"] }), fixture({ dstMounted: true })]) {
      const before = inventory(f.root);
      run(f, "assert");
      expect(inventory(f.root)).toEqual(before);
    }
  });
});

describe("containerd-store -- a misconfiguration is exit 2 and touches nothing", () => {
  const cases: ReadonlyArray<readonly [string, Record<string, string>]> = [
    ["an empty disk", { ZETA_CONTAINERD_DISK: "" }],
    ["a relative disk", { ZETA_CONTAINERD_DISK: "var/lib/longhorn-disk2" }],
    ["a subdir with a slash", { ZETA_CONTAINERD_SUBDIR: "a/b" }],
    ["a '..' subdir", { ZETA_CONTAINERD_SUBDIR: ".." }],
    ["an empty subdir", { ZETA_CONTAINERD_SUBDIR: "" }],
  ];
  for (const [name, env] of cases) {
    test(`${name} -> 2`, () => {
      const f = fixture({});
      const before = inventory(f.root);
      expect(run(f, "prepare", env).status).toBe(2);
      expect(run(f, "assert", env).status).toBe(2);
      expect(inventory(f.root)).toEqual(before);
    });
  }
  test("an unknown or missing mode -> 2", () => {
    const f = fixture({});
    expect(run(f, "mount").status).toBe(2);
    expect(run(f, "").status).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------------
// The Nix wiring. Read, not executed here -- tests/containerd-on-data-disk-eval-test.nix asserts the same
// edges on the RESOLVED host configuration, which is the stronger form. This is the part that runs in
// `bun test` on every platform.
// ---------------------------------------------------------------------------------------------------
describe("the Nix wiring (read; the eval test resolves it)", () => {
  const nix = readFileSync(MODULE, "utf8");
  const code = nix.split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");

  test("the unit runs the script this test executes", () => {
    expect(nix).toContain("${./containerd-store.sh}");
    expect(nix).toContain("ZETA_CONTAINERD_DISK=");
  });

  test("k3s REQUIRES the mount and RequiresMountsFor the path (two independent edges)", () => {
    expect(code).toMatch(/systemd\.services\.k3s\s*=\s*\{[^}]*requires\s*=\s*\[\s*mountUnit\s*\]/s);
    expect(code).toMatch(/unitConfig\.RequiresMountsFor\s*=\s*\[\s*containerdDir\s*\]/);
  });

  test("k3s's FIRST ExecStartPre is the assert (mkBefore), so nothing else runs on a bare directory", () => {
    expect(code).toMatch(/ExecStartPre\s*=\s*lib\.mkBefore\s*\[\s*"\$\{storeScript "assert"\}"\s*\]/);
  });

  test("the mount is ordered before k3s and required by it, and is NOT in local-fs.target (no emergency mode)", () => {
    expect(code).toMatch(/before\s*=\s*\[\s*"k3s\.service"/);
    expect(code).toMatch(/requiredBy\s*=\s*\[\s*"k3s\.service"\s*\]/);
    expect(code).not.toMatch(/local-fs\.target/);
    expect(code).not.toMatch(/fileSystems\.\$\{/); // an fstab bind would be wanted by local-fs.target
    expect(code).not.toContain("nofail");
  });

  test("the mount is a BIND of <disk>/<subdir> onto the k3s containerd path", () => {
    expect(code).toContain('containerdDir = "/var/lib/rancher/k3s/agent/containerd"');
    expect(code).toMatch(/what\s*=\s*"\$\{cfg\.dataDisk\}\/\$\{cfg\.subdir\}"/);
    expect(code).toMatch(/options\s*=\s*"bind"/);
  });

  test("the module never sets `after` on k3s: k3s-wait-for-address.nix mkForce-overrides it and would drop it silently", () => {
    // Brace-matched by hand: a nested-quantifier regex over this text is a ReDoS (CodeQL js/redos), and this is not a parser's job.
    const marker = "systemd.services.k3s = {";
    const open = code.indexOf(marker);
    expect(open).toBeGreaterThanOrEqual(0);
    let depth = 0;
    let end = -1;
    for (let i = open + marker.length - 1; i < code.length; i++) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    expect(end).toBeGreaterThan(open);
    const k3sBlock = code.slice(open, end + 1);
    expect(k3sBlock).toContain("requires = [ mountUnit ]"); // the block found is the right one
    expect(k3sBlock).not.toMatch(/\bafter\s*=/);
    const wait = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-wait-for-address.nix"), "utf8");
    expect(wait).toMatch(/after\s*=\s*lib\.mkForce/); // the reason this test exists; if it goes, so can the caveat
  });

  test("the disk must be a DECLARED filesystem (a plain directory on root would be root with extra steps)", () => {
    expect(code).toContain("builtins.hasAttr cfg.dataDisk config.fileSystems");
  });

  test("it is imported by common.nix (every k3s role), and the injected file is one path in three places", () => {
    expect(readFileSync(COMMON, "utf8")).toContain("./containerd-on-data-disk.nix");
    expect(nix).toContain('injectedFile = "/etc/zeta/containerd-data-disk"');
    const installer = readFileSync(INSTALLER, "utf8");
    expect(installer).toContain("/mnt/etc/zeta/containerd-data-disk");
    expect(installer).toContain("maybe_symlink /mnt/etc/zeta/containerd-data-disk /etc/zeta/containerd-data-disk");
  });

  test("no mutation survives: removing any ONE of the refusal edges is caught by the assertions above", () => {
    // The mutation check, as a test: for each edge, the text with that edge deleted must FAIL its own pin.
    const edges: ReadonlyArray<readonly [string, RegExp]> = [
      ["requires", /requires\s*=\s*\[\s*mountUnit\s*\]/],
      ["RequiresMountsFor", /unitConfig\.RequiresMountsFor\s*=\s*\[\s*containerdDir\s*\]/],
      ["assert ExecStartPre", /ExecStartPre\s*=\s*lib\.mkBefore\s*\[\s*"\$\{storeScript "assert"\}"\s*\]/],
      ["before k3s", /before\s*=\s*\[\s*"k3s\.service"/],
    ];
    for (const [name, re] of edges) {
      expect(re.test(code)).toBe(true);
      const mutated = code.replace(re, "");
      expect(re.test(mutated), `removing '${name}' must be detectable`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// The installer's choice of disk. The shell IS the implementation (the ISO carries no bun).
// ---------------------------------------------------------------------------------------------------
describe("zeta_containerd_disk_pick (the ZETA-CONTAINERD-DISK block of the REAL installer)", () => {
  const src = readFileSync(INSTALLER, "utf8");
  const b = src.indexOf("# ZETA-CONTAINERD-DISK-BEGIN");
  const e = src.indexOf("# ZETA-CONTAINERD-DISK-END");
  expect(b).toBeGreaterThan(0);
  expect(e).toBeGreaterThan(b);
  const region = src.slice(b, e);
  const workdir = mkdtempSync(join(tmpdir(), "zeta-cpick-"));
  writeFileSync(join(workdir, "block.sh"), region, "utf8");

  function pick(min: string, ...entries: string[]): string {
    writeFileSync(join(workdir, "run.sh"), `set -uo pipefail\nsource ./block.sh\nzeta_containerd_disk_pick "$@"\n`, "utf8");
    const r = spawnSync("bash", ["run.sh", min, ...entries], { cwd: workdir, encoding: "utf8" });
    expect(r.status).toBe(0);
    return r.stdout.trim();
  }
  const d1 = "/var/lib/longhorn-disk1";
  const d2 = "/var/lib/longhorn-disk2";

  test("the owner's two disks: the LARGER one (916 GiB beats 797 GiB), by the rule local-storage-placement uses", () => {
    expect(pick("200", `${d1}:${String(797 * GIB)}`, `${d2}:${String(916 * GIB)}`)).toBe(d2);
  });

  test("a tie keeps the LOWEST number (strictly-greater displaces)", () => {
    expect(pick("200", `${d1}:${String(500 * GIB)}`, `${d2}:${String(500 * GIB)}`)).toBe(d1);
  });

  test("a single-disk install uses longhorn1 when it is big enough (the 1 TiB boot disk's ~880 GiB tail)", () => {
    expect(pick("200", `${d1}:${String(880 * GIB)}`)).toBe(d1);
  });

  test("below the floor -> NOTHING (a QEMU lane's 1 GiB tail keeps the store on root); the floor is inclusive", () => {
    expect(pick("200", `${d1}:${String(1 * GIB)}`)).toBe("");
    expect(pick("200", `${d1}:${String(199 * GIB)}`)).toBe("");
    expect(pick("200", `${d1}:${String(200 * GIB)}`)).toBe(d1);
  });

  test("a junk size or a relative path is skipped, never trusted; a junk floor picks nothing", () => {
    expect(pick("200", `${d1}:abc`, `${d2}:${String(900 * GIB)}`)).toBe(d2);
    expect(pick("200", `${d1}:`, `${d2}:-5`)).toBe("");
    expect(pick("200", `var/lib/x:${String(900 * GIB)}`)).toBe("");
    expect(pick("abc", `${d1}:${String(900 * GIB)}`)).toBe("");
    expect(pick("200")).toBe("");
  });

  test("the installer's floor is the same number local-storage-placement.sh uses (one number, two readers)", () => {
    expect(src).toContain("ZETA_CONTAINERD_MIN_GIB=200");
    expect(readFileSync(PLACEMENT, "utf8")).toContain("ZETA_LOCAL_STORAGE_MIN_GIB-200");
  });

  test("the call site feeds the pick from df on the MOUNTED /mnt filesystems and writes the file only when chosen", () => {
    expect(src).toContain('df -P -B1 "/mnt${mp}"');
    expect(src).toMatch(/zeta_containerd_disk_pick "\$ZETA_CONTAINERD_MIN_GIB" "\$\{ZETA_CONTAINERD_ENTRIES\[@\]\}"/);
    expect(src).toMatch(/printf '%s\\n' "\$ZETA_CONTAINERD_DISK" \| sudo tee \/mnt\/etc\/zeta\/containerd-data-disk/);
    // a failing df must read as "unknown size", never abort the install under `set -e -o pipefail`
    expect(src).toMatch(/awk 'NR==2 \{print \$2\}'\)" \|\| bytes=0/);
  });
});
