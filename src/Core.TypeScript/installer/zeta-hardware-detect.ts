#!/usr/bin/env bun
/**
 * src/Core.TypeScript/installer/zeta-hardware-detect.ts
 *
 * 081KSKBP80008QG0R002J03WGA.2-extension (2026-05-27): TS module for hardware classification
 * during install. Pulls detection LOGIC out of zeta-install.sh's inline
 * lspci heuristic (PR #5635) and into testable TS per Rule 0 TS-over-bash
 * discipline (.claude/rules/rule-0-no-sh-files.md).
 *
 * USAGE:
 *
 *   bun src/Core.TypeScript/installer/zeta-hardware-detect.ts [--json | --suggested-host]
 *
 *   --json              Output full HardwareReport as JSON (default)
 *   --suggested-host    Output JUST the suggested flake host attribute
 *                       (one of: control-plane / worker-gpu / worker-template)
 *                       Suitable for bash $(...) capture:
 *                         SUGGESTED=$(bun zeta-hardware-detect.ts --suggested-host)
 *
 * The bash menu code in zeta-install.sh Step 6 currently does inline
 * lspci grepping. Once this module ships, that block can be reduced to:
 *
 *   if [ -x "$REPO_ROOT/tools/installer/zeta-hardware-detect.ts" ]; then
 *     SUGGESTED_HOST=$(bun "$REPO_ROOT/tools/installer/zeta-hardware-detect.ts" --suggested-host)
 *   fi
 *
 * (Composition into the bash menu is a follow-up commit; this commit
 * just ships the TS module + tests.)
 *
 * DETECTION SCOPE:
 *
 * GPU      — lspci shows NVIDIA / AMD VGA / AMD 3D / Intel Arc
 * Storage  — lsblk counts disks (HDD/SSD/NVMe); >=4 disks suggests
 *            storage-heavy node
 * CPU      — nproc reports core count; >=16 cores suggests CPU worker;
 *            /proc/cpuinfo for vendor (Intel/AMD/ARM)
 * Memory   — /proc/meminfo MemTotal; >=64GB suggests heavyweight worker
 *
 * SUGGESTED-HOST LOGIC (priority order):
 *
 * 1. GPU detected         -> worker-gpu  (GPU work is highest-leverage)
 * 2. >=4 disks + >=64GB   -> worker-template  (storage-heavy node;
 *                                              operator likely customizing)
 * 3. >=16 cores + >=32GB  -> worker-template  (CPU-heavy node)
 * 4. Default              -> control-plane  (small/general nodes default
 *                                            to bootstrapping the cluster)
 *
 * EXIT CODES:
 *
 *   0  success (report printed)
 *   1  unsupported OS (not Linux)
 *   2  arg parse error
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { platform } from "node:os";

/**
 * Detected GPU vendor classifier. Substrate-honest about partial info:
 * the lspci pattern detects PRESENCE of certain vendor-class hardware
 * but doesn't fully classify model / capability.
 */
export type GpuClass = "nvidia" | "amd" | "intel-arc" | "none";

/**
 * Storage shape classification. Counts physical block devices via lsblk.
 */
export interface StorageShape {
  readonly diskCount: number;
  readonly hasNvme: boolean;
  readonly hasSsd: boolean;
  readonly hasHdd: boolean;
}

/**
 * Hardware classification report.
 */
export interface HardwareReport {
  readonly gpu: GpuClass;
  readonly storage: StorageShape;
  readonly cpuCores: number;
  readonly cpuVendor: string;
  readonly memoryGb: number;
  readonly suggestedHost: "control-plane" | "worker-gpu" | "worker-template";
  readonly suggestionReason: string;
}

/**
 * Classify GPU presence via lspci output parse.
 *
 * lspci output for GPU lines typically looks like:
 *   00:02.0 VGA compatible controller: Intel Corporation ...
 *   01:00.0 VGA compatible controller: NVIDIA Corporation ...
 *   03:00.0 3D controller: NVIDIA Corporation ...
 *   05:00.0 VGA compatible controller: Advanced Micro Devices ...
 *
 * @param lspciOutput Raw stdout from `lspci`
 */
export function classifyGpu(lspciOutput: string): GpuClass {
  const lower = lspciOutput.toLowerCase();
  // Order matters — NVIDIA + AMD are the most common dedicated GPUs;
  // Intel Arc is a newer entrant; integrated Intel GPUs (UHD/Iris) are
  // intentionally NOT classified as GPU-worthy (they exist on most
  // motherboards and don't justify worker-gpu node-type).
  if (lower.match(/(vga|3d|display).*nvidia/)) return "nvidia";
  if (lower.match(/(vga|3d|display).*(amd|advanced micro devices)/)) {
    return "amd";
  }
  if (lower.match(/(vga|3d|display).*intel.*arc/)) return "intel-arc";
  return "none";
}

/**
 * Parse lsblk output for disk classification.
 *
 * lsblk -d -o NAME,ROTA,TYPE typical output:
 *   NAME    ROTA TYPE
 *   sda        1 disk    (rotational = HDD)
 *   nvme0n1    0 disk    (NVMe)
 *   sdb        0 disk    (SSD; non-rotational, non-nvme name)
 */
export function classifyStorage(lsblkOutput: string): StorageShape {
  const lines = lsblkOutput.split("\n").slice(1); // skip header
  let diskCount = 0;
  let hasNvme = false;
  let hasSsd = false;
  let hasHdd = false;
  for (const line of lines) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 3 || cols[2] !== "disk") continue;
    diskCount++;
    // Explicit-narrow per tsc strict noUncheckedIndexedAccess: array
    // destructure types as `string | undefined` even after length check.
    const name = cols[0];
    const rotaStr = cols[1];
    if (name === undefined || rotaStr === undefined) continue;
    if (name.startsWith("nvme")) {
      hasNvme = true;
    } else if (rotaStr === "0") {
      hasSsd = true;
    } else if (rotaStr === "1") {
      hasHdd = true;
    }
  }
  return { diskCount, hasNvme, hasSsd, hasHdd };
}

/**
 * CPU vendor from /proc/cpuinfo first vendor_id line.
 */
export function parseCpuVendor(procCpuinfo: string): string {
  const m = procCpuinfo.match(/^vendor_id\s*:\s*(\S+)/m);
  return m?.[1] ?? "unknown";
}

/**
 * Memory in GB from /proc/meminfo MemTotal kB value, rounded to nearest GB.
 */
export function parseMemoryGb(procMeminfo: string): number {
  const m = procMeminfo.match(/^MemTotal:\s+(\d+)\s+kB/m);
  // Capture group 1 typed as `string | undefined` per tsc strict
  // noUncheckedIndexedAccess; explicit-narrow before parseInt.
  const kbStr = m?.[1];
  if (kbStr === undefined) return 0;
  const kb = parseInt(kbStr, 10);
  return Math.round(kb / 1024 / 1024);
}

/**
 * Compute suggested host attribute from classification.
 * Priority order documented in module header comment.
 */
export function deriveSuggestedHost(report: {
  readonly gpu: GpuClass;
  readonly storage: StorageShape;
  readonly cpuCores: number;
  readonly memoryGb: number;
}): { readonly host: HardwareReport["suggestedHost"]; readonly reason: string } {
  if (report.gpu !== "none") {
    return {
      host: "worker-gpu",
      reason: `GPU detected (${report.gpu}); GPU work is highest-leverage node type`,
    };
  }
  if (report.storage.diskCount >= 4 && report.memoryGb >= 64) {
    return {
      host: "worker-template",
      reason: `storage-heavy node (${report.storage.diskCount} disks, ${report.memoryGb}GB RAM); use worker-template + customize`,
    };
  }
  if (report.cpuCores >= 16 && report.memoryGb >= 32) {
    return {
      host: "worker-template",
      reason: `CPU-heavy node (${report.cpuCores} cores, ${report.memoryGb}GB RAM); use worker-template + customize`,
    };
  }
  return {
    host: "control-plane",
    reason: `general-purpose node (${report.cpuCores} cores, ${report.memoryGb}GB RAM, ${report.storage.diskCount} disks${report.gpu === "none" ? ", no GPU" : ""}); defaults to control-plane`,
  };
}

/**
 * Build full hardware report from inputs (testable composition seam).
 */
export function buildReport(inputs: {
  readonly lspciOutput: string;
  readonly lsblkOutput: string;
  readonly procCpuinfo: string;
  readonly procMeminfo: string;
  readonly cpuCores: number;
}): HardwareReport {
  const gpu = classifyGpu(inputs.lspciOutput);
  const storage = classifyStorage(inputs.lsblkOutput);
  const cpuVendor = parseCpuVendor(inputs.procCpuinfo);
  const memoryGb = parseMemoryGb(inputs.procMeminfo);
  const { host, reason } = deriveSuggestedHost({
    gpu,
    storage,
    cpuCores: inputs.cpuCores,
    memoryGb,
  });
  return {
    gpu,
    storage,
    cpuCores: inputs.cpuCores,
    cpuVendor,
    memoryGb,
    suggestedHost: host,
    suggestionReason: reason,
  };
}

/**
 * Gather inputs from the running system (Linux-only I/O surface).
 */
function gatherInputs(): {
  readonly lspciOutput: string;
  readonly lsblkOutput: string;
  readonly procCpuinfo: string;
  readonly procMeminfo: string;
  readonly cpuCores: number;
} {
  let lspciOutput = "";
  try {
    lspciOutput = execFileSync("lspci", [], { encoding: "utf8" });
  } catch {
    // lspci absent or non-zero — treat as empty (no GPU classified)
    lspciOutput = "";
  }
  let lsblkOutput = "";
  try {
    lsblkOutput = execFileSync("lsblk", ["-d", "-o", "NAME,ROTA,TYPE"], {
      encoding: "utf8",
    });
  } catch {
    lsblkOutput = "";
  }
  const procCpuinfo = existsSync("/proc/cpuinfo")
    ? readFileSync("/proc/cpuinfo", "utf8")
    : "";
  const procMeminfo = existsSync("/proc/meminfo")
    ? readFileSync("/proc/meminfo", "utf8")
    : "";
  let cpuCores = 0;
  try {
    cpuCores = parseInt(
      execFileSync("nproc", [], { encoding: "utf8" }).trim(),
      10,
    );
  } catch {
    cpuCores = 0;
  }
  return { lspciOutput, lsblkOutput, procCpuinfo, procMeminfo, cpuCores };
}

async function main(): Promise<number> {
  const args = Bun.argv.slice(2);
  let mode: "json" | "suggested-host" = "json";
  for (const arg of args) {
    if (arg === "--json") mode = "json";
    else if (arg === "--suggested-host") mode = "suggested-host";
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: bun src/Core.TypeScript/installer/zeta-hardware-detect.ts [--json | --suggested-host]\n",
      );
      return 0;
    } else {
      process.stderr.write(`unknown arg: ${arg}\n`);
      return 2;
    }
  }
  if (platform() !== "linux") {
    process.stderr.write(
      `zeta-hardware-detect: only supported on Linux (got ${platform()})\n`,
    );
    return 1;
  }
  const inputs = gatherInputs();
  const report = buildReport(inputs);
  if (mode === "suggested-host") {
    process.stdout.write(report.suggestedHost + "\n");
  } else {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  }
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
