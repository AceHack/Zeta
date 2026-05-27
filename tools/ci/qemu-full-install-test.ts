#!/usr/bin/env bun
/**
 * tools/ci/qemu-full-install-test.ts
 *
 * QEMU full-install test (B-0831 Slice 1 starter) for the canonical
 * Zeta installer ISO.
 *
 * Sibling to `qemu-boot-test.ts` (cascade #5 boot smoke-test). This
 * extends boot-test by:
 *
 *   - Attaching a virtual hard disk (qcow2) as the install target
 *   - Booting with NAT'd internet so zeta-install can git-clone
 *     and download dependencies
 *   - Waiting for an INSTALL-PROGRESS marker (not just login prompt)
 *     that proves zeta-install completed nixos-install + iter-4.2
 *     pubkey-probe + iter-5.2 hostname-injection phases
 *
 * Per B-0831 Slice 1 acceptance criteria:
 * > Slice 1 acceptance: CI cascade #6 phase 1 step passes on PR
 * > touching `full-ai-cluster/**`. Step runs in under 10 min total
 * > (boot, install, reboot, login-verify). Captures full serial console
 * > as workflow-artifact for debug.
 *
 * SCOPE — STARTER ONLY (this PR):
 *
 *   - Boot installer ISO with virtual hard disk + NAT internet
 *   - Wait for `[iter-5.3]` marker in serial log (proves install reached
 *     iter-4.2 pubkey + iter-5.2 hostname phases; first operator-prompt
 *     gate is at iter-5.3 password)
 *   - Success = marker found within timeout
 *
 * DEFERRED to follow-up PRs (not in this Slice-1-starter):
 *
 *   - Reboot loop (boot from virtual hard disk to verify installed system
 *     comes up) — requires QEMU snapshot/restart logic
 *   - iter-5.3 password auto-confirm (requires injecting Enter via serial
 *     stdin) — bigger scope; CI-test substrate work
 *   - iter-5.4.0 gh auth completion (requires mock GH device-code
 *     endpoint per B-0833 Approach A) — separate substrate work
 *   - Cluster auto-join verification (Slice 2 of B-0831)
 *   - ArgoCD reconciliation (Slice 3 of B-0831)
 *
 * Usage:
 *   bun tools/ci/qemu-full-install-test.ts <iso-path>
 *
 * Exit codes:
 *   0 — install reached iter-5.3 marker (proves nixos-install + iter-4.2
 *       + iter-5.2 substrate phases all succeeded)
 *   1 — timeout OR install failure (check serial-log artifact)
 *   2 — usage error (bad args or missing dependencies)
 *
 * GitHub Actions context: ubuntu-24.04 runners have /dev/kvm available
 * for nested KVM acceleration; nixos-install takes ~5-10 min with KVM,
 * 20-30 min with TCG (macOS local testing fallback).
 *
 * Per Rule 0 (TS-over-bash for DST + cross-platform). Composes with
 * cascade #4 (audit-installer-iso-content.ts) + cascade #5
 * (qemu-boot-test.ts) + Layer 1-2 install-substrate sentinels
 * (audit-installer-substrate.ts + test-iter-54-install-flow.test.ts).
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Success marker: the `[iter-5.3]` prefix appears at the password-prompt
// line in zeta-install.sh. Reaching this point PROVES the install
// completed: partition + format + nixos-install + iter-4.2 SSH pubkey
// probe + iter-5.2 hostname injection. The next phase (iter-5.3 password
// prompt) requires operator-stdin which we don't provide in this starter
// — that's deferred to follow-up PR work.
const SUCCESS_MARKER = "[iter-5.3]";

// Hard-fail markers — if any of these appear, fail fast instead of
// waiting for timeout. Add more as empirical failure modes are observed.
const FAILURE_MARKERS: readonly string[] = [
  "panic", // kernel panic
  "FATAL", // generic fatal error
  "Refusing to wipe", // safety-rail abort
  "no internet", // first-boot couldn't reach DHCP/wifi
  "bail", // generic flash-usb / zeta-install bail
];

const TIMEOUT_SECONDS = 1800; // 30 min — generous for TCG fallback;
// KVM should finish in 5-10 min
const POLL_INTERVAL_MS = 2000;
const MEMORY_MB = 4096; // nixos-install needs ~2GB; 4GB gives headroom
const CPU_COUNT = 2;
const DISK_SIZE_GB = 20; // greedy-install target; minimum NixOS comfortable
const KVM_PATH = "/dev/kvm";

interface InstallResult {
  readonly exitCode: 0 | 1 | 2;
  readonly reason: string;
  readonly serialLogTail?: string;
  readonly elapsedSeconds?: number;
}

function usage(): never {
  console.error("usage: bun tools/ci/qemu-full-install-test.ts <iso-path>");
  process.exit(2);
}

function checkDependencies(): string | null {
  // qemu-system-x86_64 must be installed (apt-get install qemu-system-x86)
  try {
    const result = Bun.spawnSync(["qemu-system-x86_64", "--version"]);
    if (result.exitCode !== 0) {
      return "qemu-system-x86_64 not found or non-zero exit; install via `apt-get install -y qemu-system-x86`";
    }
  } catch {
    return "qemu-system-x86_64 not found in PATH; install via `apt-get install -y qemu-system-x86`";
  }
  // qemu-img for qcow2 disk creation
  try {
    const result = Bun.spawnSync(["qemu-img", "--version"]);
    if (result.exitCode !== 0) {
      return "qemu-img not found; install via `apt-get install -y qemu-utils`";
    }
  } catch {
    return "qemu-img not found in PATH; install via `apt-get install -y qemu-utils`";
  }
  return null;
}

function createVirtualDisk(diskPath: string): void {
  // qcow2 format with sparse allocation — 20GB virtual size but only
  // allocates blocks as written. Keeps the test artifact small for CI
  // upload (only used blocks consume actual space).
  console.log(`[qemu-full-install-test] Creating ${DISK_SIZE_GB}GB qcow2 disk at ${diskPath}`);
  execFileSync("qemu-img", ["create", "-f", "qcow2", diskPath, `${DISK_SIZE_GB}G`], {
    stdio: "inherit",
  });
}

function buildQemuArgs(isoPath: string, diskPath: string, serialLogPath: string): string[] {
  const args: string[] = [
    "-machine", "q35",
    "-m", String(MEMORY_MB),
    "-smp", String(CPU_COUNT),
    // ISO as CD-ROM, boot priority d (CD-ROM first)
    "-cdrom", isoPath,
    "-boot", "d",
    // Virtual hard disk as install target (virtio for speed)
    "-drive", `file=${diskPath},if=virtio,format=qcow2`,
    // Serial console to file — primary capture channel for pattern matching
    "-serial", `file:${serialLogPath}`,
    // No display (headless CI)
    "-display", "none",
    // Reboot on triple-fault (matches normal install behavior) — DON'T
    // use -no-reboot here because zeta-install might reboot to verify
    // installed system (though we don't currently test post-reboot)
    // -no-reboot,
    // NAT'd internet (zeta-install needs git clone + nix substitution)
    "-netdev", "user,id=net0",
    "-device", "virtio-net-pci,netdev=net0",
  ];

  // KVM acceleration when /dev/kvm is available (GitHub Actions
  // ubuntu-24.04 supports nested KVM). Falls back to TCG (slow but
  // works) when KVM unavailable (e.g., macOS local testing).
  if (existsSync(KVM_PATH)) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
    console.warn(
      `[qemu-full-install-test] ${KVM_PATH} not available; using TCG emulation (will be VERY slow; budget 30+ min for full install)`,
    );
  }

  return args;
}

async function waitForInstallProgress(serialLogPath: string): Promise<InstallResult> {
  const start = Date.now();
  const deadline = start + TIMEOUT_SECONDS * 1000;
  let lastReportedMinute = -1;

  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      console.log(`[qemu-full-install-test] ... ${elapsedMin} min elapsed; still polling for "${SUCCESS_MARKER}"`);
      lastReportedMinute = elapsedMin;
    }

    if (existsSync(serialLogPath)) {
      try {
        const content = readFileSync(serialLogPath, "utf8");
        if (content.includes(SUCCESS_MARKER)) {
          const tail = content.slice(-1000);
          return {
            exitCode: 0,
            reason: `SUCCESS — "${SUCCESS_MARKER}" observed in serial log (install reached iter-5.3 phase; nixos-install + iter-4.2 + iter-5.2 substrate all completed)`,
            serialLogTail: tail,
            elapsedSeconds: elapsedSec,
          };
        }
        // Hard-fail markers — fail fast instead of waiting full timeout
        for (const failMarker of FAILURE_MARKERS) {
          if (content.includes(failMarker)) {
            const tail = content.slice(-2000);
            return {
              exitCode: 1,
              reason: `FAILURE — hard-fail marker "${failMarker}" observed in serial log`,
              serialLogTail: tail,
              elapsedSeconds: elapsedSec,
            };
          }
        }
      } catch {
        // Log file in transit; retry on next poll
      }
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }

  const elapsedSec = Math.floor((Date.now() - start) / 1000);
  const tail = existsSync(serialLogPath)
    ? readFileSync(serialLogPath, "utf8").slice(-3000)
    : "(serial log empty or never created)";
  return {
    exitCode: 1,
    reason: `Timeout (${TIMEOUT_SECONDS}s) waiting for "${SUCCESS_MARKER}"`,
    serialLogTail: tail,
    elapsedSeconds: elapsedSec,
  };
}

async function main(): Promise<never> {
  const [isoPath] = process.argv.slice(2);
  if (!isoPath) usage();

  if (!existsSync(isoPath)) {
    console.error(`[qemu-full-install-test] ISO not found: ${isoPath}`);
    process.exit(2);
  }

  const depErr = checkDependencies();
  if (depErr) {
    console.error(`[qemu-full-install-test] ${depErr}`);
    process.exit(2);
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "zeta-qemu-full-install-test-"));
  const diskPath = join(tmpDir, "install-target.qcow2");
  const serialLogPath = join(tmpDir, "serial.log");

  console.log(`[qemu-full-install-test] ISO: ${isoPath}`);
  console.log(`[qemu-full-install-test] Virtual disk: ${diskPath} (${DISK_SIZE_GB}GB qcow2 sparse)`);
  console.log(`[qemu-full-install-test] Serial log: ${serialLogPath}`);
  console.log(`[qemu-full-install-test] Memory: ${MEMORY_MB}MB; CPUs: ${CPU_COUNT}; timeout: ${TIMEOUT_SECONDS}s`);
  console.log(`[qemu-full-install-test] Success marker: "${SUCCESS_MARKER}"`);
  console.log(`[qemu-full-install-test] Hard-fail markers: ${FAILURE_MARKERS.map((m) => `"${m}"`).join(", ")}`);

  createVirtualDisk(diskPath);

  const qemuArgs = buildQemuArgs(isoPath, diskPath, serialLogPath);
  console.log(`[qemu-full-install-test] Launching: qemu-system-x86_64 ${qemuArgs.join(" ")}`);

  const qemu = spawn("qemu-system-x86_64", qemuArgs, {
    stdio: ["ignore", "inherit", "inherit"],
  });

  let qemuExited = false;
  qemu.on("exit", (code) => {
    qemuExited = true;
    console.log(`[qemu-full-install-test] QEMU exited with code ${code}`);
  });

  const result = await waitForInstallProgress(serialLogPath);

  if (!qemuExited) {
    console.log(`[qemu-full-install-test] Killing QEMU (PID ${qemu.pid})`);
    qemu.kill("SIGTERM");
    setTimeout(() => {
      if (!qemuExited) qemu.kill("SIGKILL");
    }, 5000);
  }

  console.log("");
  console.log("=== Result ===");
  console.log(`Exit code: ${result.exitCode}`);
  console.log(`Reason: ${result.reason}`);
  if (result.elapsedSeconds !== undefined) {
    console.log(`Elapsed: ${result.elapsedSeconds}s (${Math.floor(result.elapsedSeconds / 60)}m ${result.elapsedSeconds % 60}s)`);
  }
  if (result.serialLogTail) {
    console.log("");
    console.log("=== Serial log tail ===");
    console.log(result.serialLogTail);
  }
  console.log("");
  console.log(`Full serial log preserved at: ${serialLogPath}`);
  console.log(`(In CI: upload as workflow artifact for debug)`);

  process.exit(result.exitCode);
}

main();
