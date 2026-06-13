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
 *   bun tools/ci/qemu-boot-test.ts --usb-image <zflash-raw.img>
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
const TIMEOUT_SECONDS = 300; // 5 min — generous; typical x86_64 KVM boot is 60-180s
// 30 min — aarch64 without same-arch KVM is TCG-slow, and under a CONTENDED runner pool the
// kernel alone can exceed 15 min (2026-06-12: two runs timed out at 900s with the serial log
// still in the EFI stub — userspace never started — then the identical commit PASSED on rerun
// once the pool freed; the budget, not the boot, was the failure).
const AARCH64_TCG_TIMEOUT_SECONDS = 1800;
const POLL_INTERVAL_MS = 1000;
const MEMORY_MB = 2048; // installer needs >= 1GB; 2GB gives headroom for nix
const KVM_PATH = "/dev/kvm";

interface BootResult {
  exitCode: 0 | 1 | 2;
  reason: string;
  serialLogTail?: string;
}

type Arch = "x86_64" | "aarch64";

interface BootMedia {
  readonly kind: "iso" | "usb-image";
  readonly path: string;
}

function usage(): never {
  console.error("usage: bun tools/ci/qemu-boot-test.ts <iso-path> [--arch x86_64|aarch64]");
  console.error("       bun tools/ci/qemu-boot-test.ts --usb-image <zflash-raw.img> [--arch x86_64|aarch64]");
  process.exit(2);
}

function qemuBinary(arch: Arch): string {
  return arch === "aarch64" ? "qemu-system-aarch64" : "qemu-system-x86_64";
}

// aarch64 UEFI firmware (apt: qemu-efi-aarch64). -machine virt has no
// BIOS path; EDK2 is the only boot road. First existing candidate wins.
const AARCH64_EFI_CANDIDATES = [
  "/usr/share/qemu-efi-aarch64/QEMU_EFI.fd",
  "/usr/share/AAVMF/AAVMF_CODE.fd",
];

function checkDependencies(arch: Arch): string | null {
  const bin = qemuBinary(arch);
  const pkg = arch === "aarch64" ? "qemu-system-arm qemu-efi-aarch64" : "qemu-system-x86";
  try {
    const result = Bun.spawnSync([bin, "--version"]);
    if (result.exitCode !== 0) {
      return `${bin} not found or non-zero exit; install via \`apt-get install -y ${pkg}\``;
    }
  } catch {
    return `${bin} not found in PATH; install via \`apt-get install -y ${pkg}\``;
  }
  if (arch === "aarch64" && !AARCH64_EFI_CANDIDATES.some((f) => existsSync(f))) {
    return `aarch64 UEFI firmware not found (looked for ${AARCH64_EFI_CANDIDATES.join(", ")}); install via \`apt-get install -y qemu-efi-aarch64\``;
  }
  return null;
}

function buildQemuArgs(arch: Arch, bootMedia: BootMedia, serialLogPath: string): string[] {
  const kvm = existsSync(KVM_PATH);

  if (arch === "aarch64") {
    if (bootMedia.kind === "usb-image") {
      throw new Error("aarch64 --usb-image boot is not supported yet");
    }
    // -machine virt + EDK2 UEFI; the PL011 serial (ttyAMA0 — matched by
    // the installer's console= kernel param) lands in the serial log.
    const efi = AARCH64_EFI_CANDIDATES.find((f) => existsSync(f))!;
    const args: string[] = [
      "-machine", "virt",
      "-m", String(MEMORY_MB),
      "-smp", "2",
      "-bios", efi,
      "-cdrom", bootMedia.path,
      "-boot", "d",
      "-serial", `file:${serialLogPath}`,
      "-display", "none",
      "-no-reboot",
      // The virt machine adds a default virtio NIC whose boot ROM
      // (efi-virtio.rom) is NOT shipped under --no-install-recommends
      // (live failure 2026-06-11: instant exit 1). The boot FLOOR needs
      // no network at all — drop the NIC entirely (also: no network in
      // the boot proof = the membrane discipline at the firmware layer).
      "-nic", "none",
    ];
    // KVM only accelerates same-arch (an aarch64 host, e.g. the
    // ubuntu-24.04-arm runners); otherwise TCG with -cpu max.
    if (kvm && process.arch === "arm64") {
      args.push("-enable-kvm", "-cpu", "host");
    } else {
      args.push("-cpu", "max");
      console.warn(`[qemu-boot-test] aarch64 without same-arch KVM; using TCG (will be slow)`);
    }
    return args;
  }

  const args: string[] = [
    "-machine", "q35",
    "-m", String(MEMORY_MB),
    "-smp", "2",
    "-serial", `file:${serialLogPath}`,
    "-display", "none",
    "-no-reboot",
    // BIOS instead of UEFI — simpler boot path; ISO supports both but
    // BIOS requires no extra firmware package.
  ];

  if (bootMedia.kind === "usb-image") {
    args.push(
      "-drive",
      `file=${bootMedia.path},if=none,format=raw,readonly=on,id=zflashboot`,
      "-device",
      "qemu-xhci,id=xhci",
      "-device",
      "usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1",
    );
  } else {
    args.push("-cdrom", bootMedia.path, "-boot", "d");
  }

  // KVM acceleration when /dev/kvm is available (GitHub Actions
  // ubuntu-24.04 supports nested KVM). Falls back to TCG (slow but
  // works) when KVM unavailable (e.g., macOS local testing).
  if (kvm) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
    console.warn(`[qemu-boot-test] ${KVM_PATH} not available; using TCG emulation (will be slow)`);
  }

  return args;
}

function timeoutSecondsFor(arch: Arch): number {
  const kvm = existsSync(KVM_PATH);
  if (arch === "aarch64" && !(kvm && process.arch === "arm64")) {
    return AARCH64_TCG_TIMEOUT_SECONDS;
  }
  return TIMEOUT_SECONDS;
}

async function waitForLoginPrompt(
  serialLogPath: string,
  timeoutSeconds: number,
  abandoned?: () => boolean,
): Promise<BootResult> {
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    if (abandoned?.()) {
      const tail = existsSync(serialLogPath)
        ? readFileSync(serialLogPath, "utf8").slice(-2000)
        : "(serial log empty or never created)";
      return {
        exitCode: 1,
        reason: "QEMU exited with an error before the login prompt appeared",
        serialLogTail: tail,
      };
    }
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
    reason: `Timeout (${timeoutSeconds}s) waiting for "${EXPECTED_LOGIN_PROMPT}"`,
    serialLogTail: tail,
  };
}

function parseBootMedia(argv: string[]): BootMedia | null {
  const usbFlag = argv.indexOf("--usb-image");
  if (usbFlag >= 0) {
    const path = argv[usbFlag + 1];
    if (!path) return null;
    argv.splice(usbFlag, 2);
    return { kind: "usb-image", path };
  }
  const [isoPath] = argv;
  if (!isoPath) return null;
  argv.shift();
  return { kind: "iso", path: isoPath };
}

async function main(): Promise<never> {
  const argv = process.argv.slice(2);
  const archFlag = argv.indexOf("--arch");
  let arch: Arch = "x86_64";
  if (archFlag >= 0) {
    const v = argv[archFlag + 1];
    if (v !== "x86_64" && v !== "aarch64") usage();
    arch = v;
    argv.splice(archFlag, 2);
  }
  const bootMedia = parseBootMedia(argv);
  if (!bootMedia) usage();

  if (!existsSync(bootMedia.path)) {
    console.error(`[qemu-boot-test] boot media not found: ${bootMedia.path}`);
    process.exit(2);
  }

  const depErr = checkDependencies(arch);
  if (depErr) {
    console.error(`[qemu-boot-test] ${depErr}`);
    process.exit(2);
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "zeta-qemu-boot-test-"));
  const serialLogPath = join(tmpDir, "serial.log");

  const timeoutSeconds = timeoutSecondsFor(arch);

  console.log(`[qemu-boot-test] Boot media: ${bootMedia.kind} ${bootMedia.path}`);
  console.log(`[qemu-boot-test] Serial log: ${serialLogPath}`);
  console.log(`[qemu-boot-test] Memory: ${MEMORY_MB}MB; timeout: ${timeoutSeconds}s`);
  console.log(`[qemu-boot-test] Expecting login prompt: "${EXPECTED_LOGIN_PROMPT}"`);

  console.log(`[qemu-boot-test] Arch: ${arch}`);
  let qemuArgs: string[];
  try {
    qemuArgs = buildQemuArgs(arch, bootMedia, serialLogPath);
  } catch (error) {
    console.error(`[qemu-boot-test] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  console.log(`[qemu-boot-test] Launching: ${qemuBinary(arch)} ${qemuArgs.join(" ")}`);

  const qemu = spawn(qemuBinary(arch), qemuArgs, {
    stdio: ["ignore", "inherit", "inherit"],
  });

  let qemuExited = false;
  let qemuExitCode: number | null = null;
  qemu.on("exit", (code) => {
    qemuExited = true;
    qemuExitCode = code;
    console.log(`[qemu-boot-test] QEMU exited with code ${code}`);
  });

  const result = await waitForLoginPrompt(serialLogPath, timeoutSeconds, () =>
    // QEMU died with an error before the prompt: fail NOW, not at the
    // 300s timeout (live failure 2026-06-11 burned 5min on a 50ms death).
    qemuExited && qemuExitCode !== 0
  );

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
