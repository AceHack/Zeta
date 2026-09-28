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
import { readFileSync } from "node:fs";
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

function kubeReservedMemory(role: string): string {
  const m = /--kubelet-arg=kube-reserved=cpu=[0-9]+m,memory=([0-9]+[KMG]i)"/.exec(role);
  if (m === null || m[1] === undefined) throw new Error("no kube-reserved memory flag");
  return m[1];
}

function memoryLowSetting(role: string): string {
  const m = /zeta\.k3sProcessProtection\.memoryLow\s*=\s*(?:lib\.mkDefault\s+)?"([0-9]+[KMG])"/.exec(role);
  if (m === null || m[1] === undefined) throw new Error("role does not set zeta.k3sProcessProtection.memoryLow");
  return m[1];
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
    expect(unit).toMatch(/\bMemoryLow\s*=\s*cfg\.memoryLow\s*;/);
    expect(slice).toMatch(/\bMemoryLow\s*=\s*cfg\.memoryLow\s*;/);
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

    test(`${name}: MemoryLow equals kube-reserved memory (accounting and enforcement name the same bytes)`, () => {
      expect(bytes(memoryLowSetting(role))).toBe(bytes(kubeReservedMemory(role)));
    });
  }

  test("server kube-reserved memory is at least 2Gi (measured: k3s-server 3.1 GiB RSS on metal, 1Gi under-promised)", () => {
    expect(bytes(kubeReservedMemory(SERVER))).toBeGreaterThanOrEqual(bytes("2Gi"));
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
    const soft = /--kubelet-arg=eviction-soft=memory\.available<([0-9]+[KMG]i)"/.exec(flags);
    expect(soft).not.toBeNull();
    expect(flags).toMatch(/--kubelet-arg=eviction-soft-grace-period=memory\.available=[0-9]+[ms]"/);
    const hard = /eviction-hard=memory\.available<([0-9]+[KMG]i)/.exec(SERVER);
    expect(bytes(soft?.[1] ?? "0K")).toBeGreaterThan(bytes(hard?.[1] ?? "0K"));
  });
});
