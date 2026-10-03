// lint-local-storage-placement.test.ts
//
// EXECUTES `full-ai-cluster/nixos/modules/local-storage-placement.sh` over fixture directories with
// stubbed `mountpoint` / `df` / `mount`, rather than reading it.
//
// WHAT IT IS FOR. On the measured node (2026-10-02) `rancher.io/local-path` -- which has NO QUOTA --
// stored every default-class PVC (GitLab's repositories, the blob store behind the registry and the
// database backups, the PostgreSQL clusters) under /var/lib/zeta-local-storage, a directory on a
// 120 GB root that also held 39 GB of container images; the kubelet evicts pods from that filesystem.
// The two Longhorn data disks (1.7 TB) were ~98% free. The placement unit bind-mounts the largest
// data disk's directory onto that path, so a fresh install does not repeat it.
//
// THE PROPERTIES THAT MATTER, in order:
//   1. it never deletes or moves anything (every fixture is inventoried before and after);
//   2. it never shadows existing volumes with a mount (a populated directory STAYS on root);
//   3. it never fails a boot that is safe to complete -- every stay-on-root branch exits 0;
//   4. the ONE exit 1: a node that was placed before whose data disk is gone. Falling back to root
//      there would give the PVs' hostPath fields empty directories over data that is still on the disk.
//
// WHY IT LIVES HERE AND NOT ONLY IN NIX: no workflow runs `nix flake check` on full-ai-cluster/flake.nix,
// so a Nix-only check would be one nothing executes. NOT PROVEN: that systemd honours the ordering
// on a booted guest, and that `mount --bind` of a longhorn-disk subdirectory behaves under the real
// local-path helper pods. Neither has been run on hardware.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "full-ai-cluster/nixos/modules/local-storage-placement.sh");
const MODULE = join(REPO_ROOT, "full-ai-cluster/nixos/modules/local-storage.nix");

const GIB = 1024 * 1024 * 1024;

/** MSYS bash wants /c/Users/..., not C:\Users\...; a no-op on POSIX. */
function posix(p: string): string {
  if (process.platform !== "win32") return p;
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d: string) => `/${d.toLowerCase()}`);
}

interface Fixture {
  readonly root: string;
  readonly dst: string;
  readonly sentinel: string;
  readonly mountsFile: string;
  readonly mountLog: string;
  readonly env: Record<string, string>;
}

/**
 * Build a fixture. `disks` maps a mount-point NAME (longhorn-disk1...) to its size in GiB; every disk
 * listed is a directory AND (unless `unmounted`) a mount point. `dstMounted` marks the target already mounted.
 */
function fixture(opts: {
  readonly disks: Readonly<Record<string, number>>;
  readonly unmounted?: readonly string[];
  readonly dstMounted?: boolean;
  readonly dstFiles?: readonly string[];
  readonly sentinelPointsTo?: string;
  readonly mountFails?: boolean;
  readonly minGib?: string;
}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "zeta-lsp-"));
  const lib = join(root, "var/lib");
  const dst = join(lib, "zeta-local-storage");
  mkdirSync(dst, { recursive: true });
  const sentinel = join(lib, "zeta-local-storage.placed");
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });

  const mounts: string[] = [];
  const sizes: string[] = [];
  for (const [name, gib] of Object.entries(opts.disks)) {
    const mp = join(lib, name);
    mkdirSync(mp, { recursive: true });
    sizes.push(`${posix(mp)} ${String(gib * GIB)}`);
    if (!(opts.unmounted ?? []).includes(name)) mounts.push(posix(mp));
  }
  if (opts.dstMounted === true) mounts.push(posix(dst));
  for (const f of opts.dstFiles ?? []) writeFileSync(join(dst, f), "volume data\n");
  if (opts.sentinelPointsTo !== undefined) writeFileSync(sentinel, `${posix(join(lib, opts.sentinelPointsTo))}\n`);

  const mountsFile = join(root, "mounts.txt");
  const sizesFile = join(root, "sizes.txt");
  const mountLog = join(root, "mount.log");
  writeFileSync(mountsFile, mounts.join("\n") + "\n");
  writeFileSync(sizesFile, sizes.join("\n") + "\n");
  writeFileSync(mountLog, "");

  // Stubs. `mountpoint -q P` -> 0 iff P is listed in mounts.txt (and `mount --bind` appends to it).
  writeFileSync(join(bin, "mountpoint"), `#!/usr/bin/env bash\ngrep -qxF "$2" "${posix(mountsFile)}"\n`);
  writeFileSync(
    join(bin, "df"),
    // df -P -B1 <path>  ->  header + one line whose 2nd column is the filesystem size in bytes.
    `#!/usr/bin/env bash\nsize="$(awk -v p="$3" '$1==p {print $2}' "${posix(sizesFile)}")"\necho "Filesystem 1-blocks Used Available Capacity Mounted"\necho "stub $size 0 $size 0% $3"\n`,
  );
  writeFileSync(
    join(bin, "mount"),
    opts.mountFails === true
      ? `#!/usr/bin/env bash\nexit 32\n`
      : `#!/usr/bin/env bash\necho "$1 $2 $3" >> "${posix(mountLog)}"\necho "$3" >> "${posix(mountsFile)}"\n`,
  );
  for (const n of ["mountpoint", "df", "mount"]) chmodSync(join(bin, n), 0o755);

  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    LC_ALL: "C",
    ZETA_LOCAL_STORAGE_DIR: posix(dst),
    ZETA_LONGHORN_DISK_GLOB: `${posix(lib)}/longhorn-disk*`,
    ZETA_LOCAL_STORAGE_SENTINEL: posix(sentinel),
    ZETA_MOUNTPOINT_BIN: posix(join(bin, "mountpoint")),
    ZETA_DF_BIN: posix(join(bin, "df")),
    ZETA_MOUNT_BIN: posix(join(bin, "mount")),
    ZETA_LOCAL_STORAGE_MIN_GIB: opts.minGib ?? "200",
  };
  return { root, dst, sentinel, mountsFile, mountLog, env };
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

function run(f: Fixture): { readonly status: number; readonly out: string } {
  const r = spawnSync("bash", [posix(SCRIPT)], { env: f.env, encoding: "utf8", maxBuffer: 64 * 1024 });
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

const mountCalls = (f: Fixture): readonly string[] =>
  readFileSync(f.mountLog, "utf8").split("\n").filter((l) => l.length > 0);

describe("local-storage placement -- the happy path", () => {
  test("the LARGEST mounted data disk wins, a bind mount is made, and the choice is recorded", () => {
    const f = fixture({ disks: { "longhorn-disk1": 810, "longhorn-disk2": 931 } });
    const r = run(f);
    expect(r.status).toBe(0);
    expect(r.out).toContain("PLACED:");
    const calls = mountCalls(f);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("--bind");
    expect(calls[0]).toContain("longhorn-disk2/zeta-local-storage");
    expect(calls[0]).not.toContain("longhorn-disk1");
    expect(existsSync(join(f.root, "var/lib/longhorn-disk2/zeta-local-storage"))).toBe(true);
    expect(readFileSync(f.sentinel, "utf8")).toContain("longhorn-disk2/zeta-local-storage");
  });

  test("a tie is broken by the LOWEST number, so the answer does not depend on directory order", () => {
    const f = fixture({ disks: { "longhorn-disk1": 500, "longhorn-disk2": 500 } });
    const r = run(f);
    expect(r.status).toBe(0);
    expect(mountCalls(f)[0]).toContain("longhorn-disk1/zeta-local-storage");
  });

  test("on a single-disk install the longhorn1 tail is used when it is big enough", () => {
    const f = fixture({ disks: { "longhorn-disk1": 810 } });
    expect(run(f).status).toBe(0);
    expect(mountCalls(f)[0]).toContain("longhorn-disk1/zeta-local-storage");
  });

  test("it is idempotent: when the target is already a mount point nothing is mounted again", () => {
    const f = fixture({ disks: { "longhorn-disk1": 810 }, dstMounted: true });
    const r = run(f);
    expect(r.status).toBe(0);
    expect(r.out).toContain("ALREADY-PLACED");
    expect(mountCalls(f)).toHaveLength(0);
  });
});

describe("local-storage placement -- it stays on root, and exits 0, whenever placing would be worse", () => {
  test("a data disk under the threshold (the QEMU lanes' 1G tail) is NOT used", () => {
    const f = fixture({ disks: { "longhorn-disk1": 1 } });
    const r = run(f);
    expect(r.status).toBe(0);
    expect(r.out).toContain("STAYS-ON-ROOT");
    expect(r.out).toContain("200 GiB threshold");
    expect(mountCalls(f)).toHaveLength(0);
  });

  test("the threshold is inclusive and is the configured number, not a constant in the script", () => {
    const exact = fixture({ disks: { "longhorn-disk1": 200 } });
    expect(run(exact).out).toContain("PLACED:");
    const below = fixture({ disks: { "longhorn-disk1": 199 } });
    expect(run(below).out).toContain("STAYS-ON-ROOT");
    const lowered = fixture({ disks: { "longhorn-disk1": 50 }, minGib: "40" });
    expect(run(lowered).out).toContain("PLACED:");
  }, 60_000); // three bash spawns; MSYS process creation is ~2 s each on Windows

  test("a data-disk DIRECTORY that is not a mount point is never placed on (the unmounted-disk case)", () => {
    // The directory exists on root. Placing there would be root with extra steps.
    const f = fixture({ disks: { "longhorn-disk1": 810, "longhorn-disk2": 931 }, unmounted: ["longhorn-disk1", "longhorn-disk2"] });
    const r = run(f);
    expect(r.status).toBe(0);
    expect(r.out).toContain("no mounted data-disk filesystem");
    expect(mountCalls(f)).toHaveLength(0);
  });

  test("an unmounted bigger disk is skipped in favour of the mounted smaller one", () => {
    const f = fixture({ disks: { "longhorn-disk1": 810, "longhorn-disk2": 931 }, unmounted: ["longhorn-disk2"] });
    expect(run(f).status).toBe(0);
    expect(mountCalls(f)[0]).toContain("longhorn-disk1/zeta-local-storage");
  });

  test("a failing `mount` is not a failed boot: stays on root, exit 0, and NO sentinel is written", () => {
    const f = fixture({ disks: { "longhorn-disk1": 810 }, mountFails: true });
    const r = run(f);
    expect(r.status).toBe(0);
    expect(r.out).toContain("bind mount");
    expect(existsSync(f.sentinel)).toBe(false);
  });

  test("RED: a populated target is NEVER shadowed -- the volumes already on root stay visible and untouched", () => {
    const f = fixture({ disks: { "longhorn-disk1": 810, "longhorn-disk2": 931 }, dstFiles: ["pvc-1_postgres-shared_postgres-shared-1"] });
    const before = inventory(f.root);
    const r = run(f);
    expect(r.status).toBe(0);
    expect(r.out).toContain("already holds data");
    expect(mountCalls(f)).toHaveLength(0);
    expect(existsSync(f.sentinel)).toBe(false);
    expect(inventory(f.root)).toEqual(before);
  });

  test("a hidden file in the target counts as data (ls -A, not ls)", () => {
    const f = fixture({ disks: { "longhorn-disk1": 810 }, dstFiles: [".keep"] });
    expect(run(f).out).toContain("already holds data");
    expect(mountCalls(f)).toHaveLength(0);
  });
});

describe("local-storage placement -- the ONE refusal: placed before, disk gone now", () => {
  test("RED: sentinel present, the data disk not mounted -> exit 1, nothing mounted, nothing deleted", () => {
    const f = fixture({
      disks: { "longhorn-disk2": 931 },
      unmounted: ["longhorn-disk2"],
      sentinelPointsTo: "longhorn-disk2/zeta-local-storage",
    });
    mkdirSync(join(f.root, "var/lib/longhorn-disk2/zeta-local-storage"), { recursive: true });
    const before = inventory(f.root);
    const r = run(f);
    expect(r.status).toBe(1);
    expect(r.out).toContain("REFUSED");
    expect(r.out).toContain("EMPTY directory");
    expect(mountCalls(f)).toHaveLength(0);
    expect(inventory(f.root)).toEqual(before);
  });

  test("sentinel present and the disk is back -> the same directory is bound again (exit 0)", () => {
    const f = fixture({ disks: { "longhorn-disk2": 931 }, sentinelPointsTo: "longhorn-disk2/zeta-local-storage" });
    mkdirSync(join(f.root, "var/lib/longhorn-disk2/zeta-local-storage"), { recursive: true });
    const r = run(f);
    expect(r.status).toBe(0);
    expect(r.out).toContain("RE-PLACED");
    expect(mountCalls(f)[0]).toContain("longhorn-disk2/zeta-local-storage");
  });

  test("sentinel present, the disk is mounted but the directory on it is gone -> exit 1 (it will not invent an empty one)", () => {
    const f = fixture({ disks: { "longhorn-disk2": 931 }, sentinelPointsTo: "longhorn-disk2/zeta-local-storage" });
    const r = run(f);
    expect(r.status).toBe(1);
    expect(mountCalls(f)).toHaveLength(0);
  });
});

describe("local-storage placement -- a typo must not silently change the policy", () => {
  for (const bad of ["", "abc", "20.5", "-1", "2e2"]) {
    test(`ZETA_LOCAL_STORAGE_MIN_GIB='${bad}' is refused with exit 2 before anything is touched`, () => {
      const f = fixture({ disks: { "longhorn-disk1": 810 }, minGib: bad });
      const before = inventory(f.root);
      const r = run(f);
      expect(r.status).toBe(2);
      expect(mountCalls(f)).toHaveLength(0);
      expect(inventory(f.root)).toEqual(before);
    });
  }
});

describe("the Nix wiring (read, not executed -- `nix flake check` runs in no workflow)", () => {
  const nix = readFileSync(MODULE, "utf8");

  test("the unit runs BEFORE k3s and is required by it (the script's single exit 1 must hold k3s down)", () => {
    expect(nix).toMatch(/systemd\.services\.zeta-local-storage-placement\s*=\s*\{/);
    expect(nix).toMatch(/before\s*=\s*\[\s*"k3s\.service"\s*\]/);
    expect(nix).toMatch(/requiredBy\s*=\s*\[\s*"k3s\.service"\s*\]/);
  });

  test("it executes the script this test executes", () => {
    expect(nix).toContain("${./local-storage-placement.sh}");
  });

  test("the path it places is the path the provisioner, the tmpfiles rule and the setup guard all use", () => {
    const dir = "/var/lib/zeta-local-storage";
    expect(nix).toContain(`ZETA_LOCAL_STORAGE_DIR = "${dir}"`);
    expect(nix).toContain(`"d ${dir} 0755 root root - -"`);
    expect(nix).toContain(`"paths": ["${dir}"]`);
    expect(nix).toContain(`case "$path" in ${dir}/*)`);
  });

  test("the unit's threshold and glob are the script's own defaults (one number, two readers)", () => {
    const script = readFileSync(SCRIPT, "utf8");
    expect(nix).toContain('ZETA_LOCAL_STORAGE_MIN_GIB = "200"');
    expect(script).toContain('ZETA_LOCAL_STORAGE_MIN_GIB-200');
    expect(nix).toContain('ZETA_LONGHORN_DISK_GLOB = "/var/lib/longhorn-disk*"');
    expect(script).toContain('ZETA_LONGHORN_DISK_GLOB:-/var/lib/longhorn-disk*');
  });
});
