/**
 * full-ai-cluster/nixos/modules/k3s-process-protection.test.ts
 *
 * Falsifiers for 081M3K1K1SY087G0R0010A76XY: the k3s PROCESS, which holds the
 * apiserver, etcd, kubelet and containerd, must be protected by the kernel and
 * not only by the kubelet's Allocatable arithmetic.
 *
 * The arithmetic that makes this necessary is the kubelet's own, and it is
 * CHECKED against a measurement rather than asserted. The kubelet gives
 * kubepods.slice CPU shares of allocatableMillicores * 1024 / 1000, and on
 * cgroup v2 converts shares to a weight with
 *   weight = 1 + ((shares - 2) * 9999) / 262142        (integer division)
 * (kubernetes pkg/kubelet/cm: MilliCPUToShares, CpuSharesToCpuWeight). On
 * node-5b2dfa (22 cores, allocatable 22000m - 750m reserved) that predicts 830,
 * and 830 is exactly what `/sys/fs/cgroup/kubepods.slice/cpu.weight` read on
 * 2026-09-27, against system.slice = 100. So pods outweighed every system
 * service, k3s included, 8.3:1 under contention.
 *
 * Comments are stripped before every check, so the module's rationale can never
 * satisfy an assertion.
 *
 * WHAT THIS CANNOT TELL YOU: that NixOS renders these into the unit files, or
 * that the kernel honours them. Only a boot shows that; the WP11 verdict now
 * prints the live cgroup values (081M3K1K1XV087G0R002A6YFRS).
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const read = (name: string): string => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

const stripComments = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#\s.*$/, ""))
    .join("\n");

const MODULE = stripComments(read("k3s-process-protection.nix"));
const SERVER = stripComments(read("k3s-server.nix"));
const AGENT = stripComments(read("k3s-agent.nix"));

/** The kubelet's own shares -> cgroup-v2 weight conversion. */
function kubepodsCpuWeight(allocatableMillicores: number): number {
  const shares = Math.floor((allocatableMillicores * 1024) / 1000);
  return 1 + Math.floor(((shares - 2) * 9999) / 262142);
}

function intSetting(text: string, key: string): number {
  const m = new RegExp(`\\b${key}\\s*=\\s*(-?[0-9]+)\\s*;`).exec(text);
  if (m === null || m[1] === undefined) throw new Error(`${key} is not set to an integer`);
  return Number(m[1]);
}

/** Bytes of a systemd size ("2G") or a Kubernetes quantity ("2Gi"). Binary units in both. */
function bytes(q: string): number {
  const m = /^([0-9]+)([KMG])i?$/.exec(q);
  if (m === null || m[1] === undefined || m[2] === undefined) throw new Error(`unparseable size ${q}`);
  const unit = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[m[2] as "K" | "M" | "G"];
  return Number(m[1]) * unit;
}

function block(text: string, opener: string): string {
  const start = text.indexOf(opener);
  if (start < 0) throw new Error(`no \`${opener}\` block`);
  const end = text.indexOf("};", start);
  return text.slice(start, end);
}


describe("the kubelet's CPU weight formula reproduces the measured kubepods weight", () => {
  test("22-core node-5b2dfa: 830, as read from /sys/fs/cgroup/kubepods.slice/cpu.weight", () => {
    expect(kubepodsCpuWeight(22000 - 750)).toBe(830);
  });
});

describe("k3s.service is protected by the kernel, not only by Allocatable", () => {
  const unit = block(MODULE, "systemd.services.k3s.serviceConfig");
  const slice = block(MODULE, "systemd.slices.system.sliceConfig");

  test("system.slice outweighs kubepods.slice on the measured 22-core node and the 4-vCPU WP11 guest", () => {
    const sliceWeight = intSetting(slice, "CPUWeight");
    expect(sliceWeight).toBeGreaterThan(kubepodsCpuWeight(22000 - 750));
    expect(sliceWeight).toBeGreaterThan(kubepodsCpuWeight(4000 - 750));
  });

  test("k3s.service is not diluted inside system.slice", () => {
    expect(intSetting(unit, "CPUWeight")).toBeGreaterThan(100);
  });

  test("containerd (measured oom_score_adj 0) is lifted to the kubelet's own -999", () => {
    expect(intSetting(unit, "OOMScoreAdjust")).toBe(-999);
  });

  test("memory protection is set on the unit AND its parent slice (no memory_recursiveprot on the host)", () => {
    // Build-time value = the kube-reserved target; the boot generator re-sets both
    // to the kube-reserved actually granted (checked in the reservations block below).
    expect(unit).toMatch(/\bMemoryLow\s*=\s*"\$\{toString cfg\.kubeReservedMemoryMi\}M"\s*;/);
    expect(slice).toMatch(/\bMemoryLow\s*=\s*"\$\{toString cfg\.kubeReservedMemoryMi\}M"\s*;/);
    // MemoryMin is a hard floor that can push the OOM killer onto pods while k3s idles on cache.
    expect(MODULE).not.toMatch(/\bMemoryMin\s*=/);
  });
});

describe("both roles import the protection and size it to their own kube-reserved memory", () => {
  for (const [name, role] of [
    ["server", SERVER],
    ["agent", AGENT],
  ] as const) {
    test(`${name}: imports k3s-process-protection.nix`, () => {
      expect(role).toContain("./k3s-process-protection.nix");
    });

  }

  test("server kube-reserved target is at least 2Gi (measured: k3s-server 3.1 GiB RSS on metal, 1Gi under-promised)", () => {
    expect(roleTargets(SERVER).kubeReservedMemoryMi).toBeGreaterThanOrEqual(2048);
  });

  test("agent reserves less than the server: it runs no apiserver or etcd", () => {
    expect(roleTargets(AGENT).kubeReservedMemoryMi).toBeLessThan(roleTargets(SERVER).kubeReservedMemoryMi);
    expect(roleTargets(AGENT).kubeReservedCpuMillis).toBeLessThan(roleTargets(SERVER).kubeReservedCpuMillis);
  });
});

describe("first-boot image pulls and eviction", () => {
  const flags = block(MODULE, "services.k3s.extraFlags");

  test("registry pull QPS/burst raised above the kubelet defaults (5/10) that refused headlamp's pull", () => {
    const qps = /--kubelet-arg=registry-qps=([0-9]+)"/.exec(flags);
    const burst = /--kubelet-arg=registry-burst=([0-9]+)"/.exec(flags);
    expect(Number(qps?.[1])).toBeGreaterThan(5);
    expect(Number(burst?.[1])).toBeGreaterThan(10);
  });

  test("pulls stay serialized: unbounded parallel pulls have no flag-level cap in kubelet 1.35", () => {
    expect(`${MODULE}\n${SERVER}\n${AGENT}`).not.toContain("serialize-image-pulls=false");
  });

  test("a soft memory threshold above the hard one, with its grace period (kubelet rejects one without the other)", () => {
    // Written at boot, sized to the node; soft > hard at every node size is checked below.
    const t = roleTargets(SERVER);
    expect(t.evictionSoftMemoryMi).toBeGreaterThan(t.evictionHardMemoryMi);
    const script = readFileSync(fileURLToPath(new URL(`./${SCRIPT}`, import.meta.url)), "utf8");
    expect(script).toContain("eviction-soft=memory.available<");
    expect(script).toContain("eviction-soft-grace-period=memory.available=");
    expect(flags).toMatch(/--kubelet-arg=eviction-max-pod-grace-period=[0-9]+"/);
  });
});

// ── RESERVATIONS SCALE WITH THE NODE (bug 081M3KC68TK087G0R002NT64S8) ─────────
//
// The kubelet REFUSES TO START when kube-reserved + system-reserved +
// eviction-hard exceeds node memory capacity (pkg/kubelet/cm
// validateNodeAllocatable: "invalid Node Allocatable configuration"). #17728's
// static server reservation, 2Gi + 512Mi + 500Mi, did exactly that on the
// 2560 MB NixOS test VMs (build-ai-cluster-iso run 36379743833: k3s.service
// status=1/FAILURE in cluster-init, platform-fixes, agent-join, server-join,
// datastore-sentinel). These checks EXECUTE the boot-time formula under a real
// bash over node sizes this machine does not have.

const SCRIPT = "k3s-kubelet-reservations.sh";
const MIB = 1024;

/** Memory (MiB) reserved by `--kubelet-arg` flags written statically into the Nix files. */
function staticReservedMemoryMi(text: string): number {
  let total = 0;
  for (const m of text.matchAll(/--kubelet-arg=(?:kube|system)-reserved=[^"]*memory=([0-9]+[KMG]i)/g)) {
    total += bytes(m[1] ?? "0K") / MIB ** 2;
  }
  for (const m of text.matchAll(/--kubelet-arg=eviction-hard=memory\.available<([0-9]+[KMG]i)/g)) {
    total += bytes(m[1] ?? "0K") / MIB ** 2;
  }
  return total;
}

type Targets = Record<
  | "kubeReservedCpuMillis"
  | "kubeReservedMemoryMi"
  | "systemReservedCpuMillis"
  | "systemReservedMemoryMi"
  | "evictionHardMemoryMi"
  | "evictionSoftMemoryMi",
  number
>;

/** The role's targets: the role file's setting when present, else the module's option default. */
function roleTargets(role: string): Targets {
  const get = (key: keyof Targets): number => {
    const set = new RegExp(`zeta\\.k3sProcessProtection\\.${key}\\s*=\\s*(?:lib\\.mkDefault\\s+)?([0-9]+)\\s*;`).exec(role);
    if (set?.[1] !== undefined) return Number(set[1]);
    const dflt = new RegExp(`\\b${key}\\s*=\\s*target\\b[\\s\\S]*?\\s([0-9]+)\\s*;`).exec(MODULE);
    if (dflt?.[1] === undefined) throw new Error(`no ${key} option default in k3s-process-protection.nix`);
    return Number(dflt[1]);
  };
  return {
    kubeReservedCpuMillis: get("kubeReservedCpuMillis"),
    kubeReservedMemoryMi: get("kubeReservedMemoryMi"),
    systemReservedCpuMillis: get("systemReservedCpuMillis"),
    systemReservedMemoryMi: get("systemReservedMemoryMi"),
    evictionHardMemoryMi: get("evictionHardMemoryMi"),
    evictionSoftMemoryMi: get("evictionSoftMemoryMi"),
  };
}

interface Reservation {
  kubeCpu: number;
  kubeMem: number;
  sysCpu: number;
  sysMem: number;
  hard: number;
  soft: number;
  raw: string;
}

/** Execute the boot-time script as systemd would, with the node's probes overridden. */
function reserve(t: Targets, memTotalKb: number | string, nproc: number): Reservation {
  const dir = mkdtempSync(join(tmpdir(), "zeta-kubelet-reservations-"));
  try {
    copyFileSync(fileURLToPath(new URL(`./${SCRIPT}`, import.meta.url)), join(dir, SCRIPT));
    const r = spawnSync("bash", [SCRIPT], {
      cwd: dir,
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        ZETA_KUBE_RESERVED_CPU_MILLIS: String(t.kubeReservedCpuMillis),
        ZETA_KUBE_RESERVED_MEMORY_MI: String(t.kubeReservedMemoryMi),
        ZETA_SYSTEM_RESERVED_CPU_MILLIS: String(t.systemReservedCpuMillis),
        ZETA_SYSTEM_RESERVED_MEMORY_MI: String(t.systemReservedMemoryMi),
        ZETA_EVICTION_HARD_MEMORY_MI: String(t.evictionHardMemoryMi),
        ZETA_EVICTION_SOFT_MEMORY_MI: String(t.evictionSoftMemoryMi),
        ZETA_K3S_RESERVATION_CONFIG: "out.yaml",
        ZETA_MEMTOTAL_KB: String(memTotalKb),
        ZETA_NPROC: String(nproc),
        ZETA_APPLY_MEMORY_LOW: "0",
      },
    });
    if (r.status !== 0) throw new Error(`${SCRIPT} exited ${r.status}: ${r.stderr}`);
    const raw = readFileSync(join(dir, "out.yaml"), "utf8");
    const num = (re: RegExp): number => Number(re.exec(raw)?.[1] ?? Number.NaN);
    return {
      kubeCpu: num(/"kube-reserved=cpu=([0-9]+)m,/),
      kubeMem: num(/"kube-reserved=cpu=[0-9]+m,memory=([0-9]+)Mi"/),
      sysCpu: num(/"system-reserved=cpu=([0-9]+)m,/),
      sysMem: num(/"system-reserved=cpu=[0-9]+m,memory=([0-9]+)Mi"/),
      hard: num(/"eviction-hard=memory\.available<([0-9]+)Mi,/),
      soft: num(/"eviction-soft=memory\.available<([0-9]+)Mi"/),
      raw,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// [MemTotal MiB, cores]: 2 GiB, the 2560 MB NixOS test VMs, 4 GiB, the 12 GiB
// WP11 guest, node-5b2dfa (62 GiB / 22 cores), and a 256 GiB box.
const NODES: readonly (readonly [number, number])[] = [
  [2048, 2],
  [2560, 2],
  [4096, 4],
  [12288, 4],
  [62 * 1024, 22],
  [256 * 1024, 64],
];

describe("kubelet reservations scale with the node and never make the kubelet refuse to start", () => {
  for (const [name, role] of [
    ["server", SERVER],
    ["agent", AGENT],
  ] as const) {
    for (const [memMi, cores] of NODES) {
      test(`${name} @ ${memMi} MiB / ${cores} cores: reserved + hard eviction stays under half the node`, () => {
        const r = reserve(roleTargets(role), memMi * 1024, cores);
        const total = staticReservedMemoryMi(`${MODULE}\n${role}`) + r.kubeMem + r.sysMem + r.hard;
        // The kubelet's refusal is total > capacity; keep a wide margin below it.
        expect(total).toBeLessThan(memMi / 2);
        expect(total).toBeLessThanOrEqual(Math.ceil(memMi * 0.3));
        expect(r.soft).toBeGreaterThan(r.hard);
        expect(r.kubeCpu + r.sysCpu).toBeLessThanOrEqual((cores * 1000) / 4);
      });
    }
  }

  test("62 GiB server keeps #17728's reservations exactly: 500m/2Gi kube, 250m/512Mi system, 500Mi hard, 1Gi soft", () => {
    const r = reserve(roleTargets(SERVER), 62 * 1024 * 1024, 22);
    expect([r.kubeCpu, r.kubeMem, r.sysCpu, r.sysMem, r.hard, r.soft]).toEqual([500, 2048, 250, 512, 500, 1024]);
  });

  test("12 GiB WP11 guest keeps #17728's reservations too (they fit in 25% there)", () => {
    const r = reserve(roleTargets(SERVER), 12288 * 1024, 4);
    expect([r.kubeCpu, r.kubeMem, r.sysCpu, r.sysMem, r.hard]).toEqual([500, 2048, 250, 512, 500]);
  });

  test("the eviction-hard map restates the kubelet's three non-memory defaults (it replaces, never merges)", () => {
    const r = reserve(roleTargets(SERVER), 2560 * 1024, 2);
    expect(r.raw).toContain("nodefs.available<10%,imagefs.available<15%,nodefs.inodesFree<5%");
    expect(r.raw).toContain('"eviction-soft-grace-period=memory.available=1m"');
  });

  test("an unreadable node size writes no reservations and still exits 0 (never blocks k3s)", () => {
    const r = reserve(roleTargets(SERVER), "garbage", 0);
    expect(r.raw).not.toContain("kube-reserved");
    expect(r.raw).not.toContain("eviction-hard");
  });

  test("no reservation is left as a static --kubelet-arg a small node cannot fit", () => {
    expect(staticReservedMemoryMi(`${MODULE}\n${SERVER}\n${AGENT}`)).toBe(0);
    expect(`${MODULE}\n${SERVER}\n${AGENT}`).not.toContain("--kubelet-arg=eviction-soft=");
  });

  test("the generator runs before k3s, is wanted (never required) by it, and k3s reads the file it writes", () => {
    const unit = block(MODULE, "systemd.services.zeta-k3s-kubelet-reservations");
    expect(unit).toMatch(/before\s*=\s*\[\s*"k3s\.service"\s*\]/);
    expect(unit).toMatch(/wantedBy\s*=\s*\[\s*"k3s\.service"\s*\]/);
    expect(MODULE).not.toMatch(/requiredBy\s*=\s*\[\s*"k3s\.service"\s*\]/);
    expect(MODULE).toContain(`ExecStart = "\${pkgs.bash}/bin/bash \${./${SCRIPT}}";`);
    expect(unit).toMatch(/ZETA_K3S_RESERVATION_CONFIG\s*=\s*reservationConfig\s*;/);
    expect(unit).toMatch(/ZETA_APPLY_MEMORY_LOW\s*=\s*"1"\s*;/);
    expect(MODULE).toMatch(/systemd\.services\.k3s\.environment\.K3S_CONFIG_FILE\s*=\s*reservationConfig\s*;/);
    expect(existsSync(fileURLToPath(new URL(`./${SCRIPT}`, import.meta.url)))).toBe(true);
  });
});
