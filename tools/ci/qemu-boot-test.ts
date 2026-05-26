#!/usr/bin/env bun
/**
 * tools/ci/qemu-boot-test.ts
 *
 * QEMU boot smoke-test for the canonical Zeta installer ISO.
 *
 * Boots the ISO in QEMU/KVM with serial console output captured to a
 * log file, waits up to TIMEOUT_SECONDS for the expected login prompt
 * matching the installer's networking.hostName (`zeta-installer`), then
 * shuts down cleanly.
 *
 * Per Rule 0 (TS-over-bash for DST + cross-platform) + Kestrel's
 * 2026-05-26 ferry pointer to nixos/tests/installer.nix prior art.
 * Composes with full-ai-cluster/usb-nixos-installer/ canonical
 * installer + the build-ai-cluster-iso.yml workflow's post-build audit
 * stack.
 *
 * Usage:
 *   bun tools/ci/qemu-boot-test.ts <iso-path>
 *
 * Exit codes:
 *   0 — boot succeeded (login prompt observed within timeout)
 *   1 — boot failed (timeout or QEMU error)
 *   2 — usage error (bad args or missing dependencies)
 *
 * GitHub Actions context: ubuntu-24.04 runners have /dev/kvm available
 * for nested KVM acceleration. Install qemu-system-x86 + ovmf before
 * invocation. Tested boot time ~60-180s on cold-boot KVM.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXPECTED_HOSTNAME = "zeta-installer";
const EXPECTED_LOGIN_PROMPT = `${EXPECTED_HOSTNAME} login:`;
const TIMEOUT_SECONDS = 300; // 5 min — generous; typical boot is 60-180s
const POLL_INTERVAL_MS = 1000;
const MEMORY_MB = 2048; // installer needs >= 1GB; 2GB gives headroom for nix
const KVM_PATH = "/dev/kvm";

interface BootResult {
  exitCode: 0 | 1 | 2;
  reason: string;
  serialLogTail?: string;
}

function usage(): never {
  console.error("usage: bun tools/ci/qemu-boot-test.ts <iso-path>");
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
  return null;
}

function buildQemuArgs(isoPath: string, serialLogPath: string): string[] {
  const args: string[] = [
    "-machine", "q35",
    "-m", String(MEMORY_MB),
    "-smp", "2",
    "-cdrom", isoPath,
    "-boot", "d",
    "-serial", `file:${serialLogPath}`,
    "-display", "none",
    "-no-reboot",
    // BIOS instead of UEFI — simpler boot path; ISO supports both but
    // BIOS requires no extra firmware package.
  ];

  // KVM acceleration when /dev/kvm is available (GitHub Actions
  // ubuntu-24.04 supports nested KVM). Falls back to TCG (slow but
  // works) when KVM unavailable (e.g., macOS local testing).
  if (existsSync(KVM_PATH)) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
    console.warn(`[qemu-boot-test] ${KVM_PATH} not available; using TCG emulation (will be slow)`);
  }

  return args;
}

async function waitForLoginPrompt(serialLogPath: string): Promise<BootResult> {
  const deadline = Date.now() + TIMEOUT_SECONDS * 1000;

  while (Date.now() < deadline) {
    if (existsSync(serialLogPath)) {
      try {
        const content = readFileSync(serialLogPath, "utf8");
        if (content.includes(EXPECTED_LOGIN_PROMPT)) {
          const tail = content.slice(-500);
          return {
            exitCode: 0,
            reason: `Login prompt observed: "${EXPECTED_LOGIN_PROMPT}"`,
            serialLogTail: tail,
          };
        }
      } catch {
        // Log file in transit; retry on next poll
      }
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }

  const tail = existsSync(serialLogPath)
    ? readFileSync(serialLogPath, "utf8").slice(-2000)
    : "(serial log empty or never created)";
  return {
    exitCode: 1,
    reason: `Timeout (${TIMEOUT_SECONDS}s) waiting for "${EXPECTED_LOGIN_PROMPT}"`,
    serialLogTail: tail,
  };
}

async function main(): Promise<never> {
  const [isoPath] = process.argv.slice(2);
  if (!isoPath) usage();

  if (!existsSync(isoPath)) {
    console.error(`[qemu-boot-test] ISO not found: ${isoPath}`);
    process.exit(2);
  }

  const depErr = checkDependencies();
  if (depErr) {
    console.error(`[qemu-boot-test] ${depErr}`);
    process.exit(2);
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "zeta-qemu-boot-test-"));
  const serialLogPath = join(tmpDir, "serial.log");

  console.log(`[qemu-boot-test] ISO: ${isoPath}`);
  console.log(`[qemu-boot-test] Serial log: ${serialLogPath}`);
  console.log(`[qemu-boot-test] Memory: ${MEMORY_MB}MB; timeout: ${TIMEOUT_SECONDS}s`);
  console.log(`[qemu-boot-test] Expecting login prompt: "${EXPECTED_LOGIN_PROMPT}"`);

  const qemuArgs = buildQemuArgs(isoPath, serialLogPath);
  console.log(`[qemu-boot-test] Launching: qemu-system-x86_64 ${qemuArgs.join(" ")}`);

  const qemu = spawn("qemu-system-x86_64", qemuArgs, {
    stdio: ["ignore", "inherit", "inherit"],
  });

  let qemuExited = false;
  qemu.on("exit", (code) => {
    qemuExited = true;
    console.log(`[qemu-boot-test] QEMU exited with code ${code}`);
  });

  const result = await waitForLoginPrompt(serialLogPath);

  if (!qemuExited) {
    console.log(`[qemu-boot-test] Killing QEMU (PID ${qemu.pid})`);
    qemu.kill("SIGTERM");
    setTimeout(() => {
      if (!qemuExited) qemu.kill("SIGKILL");
    }, 5000);
  }

  console.log("");
  console.log("=== Result ===");
  console.log(`Exit code: ${result.exitCode}`);
  console.log(`Reason: ${result.reason}`);
  if (result.serialLogTail) {
    console.log("");
    console.log("=== Serial log tail ===");
    console.log(result.serialLogTail);
  }

  process.exit(result.exitCode);
}

main();
