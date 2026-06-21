#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ci/qemu-full-install-test.ts
 *
 * QEMU full-install test (081KSGS9H0008QG0R0011BC7T2 Slice 1) for the canonical Zeta installer ISO.
 *
 * Phase 1 — boot installer ISO + virtual disk; wait for install completion.
 * Phase 2 — boot installed disk only; verify login banner (+ optional phase-3
 * first-session serial markers when QEMU_FIRST_SESSION_PHASE3=1).
 * Phase 1 also asserts iter-5.4.1-ci dry-run registration (081KSGS9H0008QG0R0011BC7T2 slice 2)
 * and tree-path coherence (081KSGS9H0008QG0R0011BC7T2 slice 3).
 *
 * Composes with qemu-boot-test.ts (cascade #5) and 081KSNY2Z0008QG0R0008PN7RQ scenario 2.
 *
 * Usage:
 *   bun src/Core.TypeScript/ci/qemu-full-install-test.ts <iso-path>
 *
 * Exit codes:
 *   0 — install completed and installed OS reached login prompt
 *   1 — timeout or failure (check serial-log artifact)
 *   2 — usage error or missing dependencies
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serialFirstBootInProgress } from "../zflash/test-harness/serial-markers";
import { validateSelfRegCiCoherent } from "./self-reg-serial.ts";
import {
  firstSessionPhase3Enabled,
  firstSessionMarkersSatisfied,
} from "./qemu-first-session-phase3.ts";

/** zeta-install.sh success banner (end of install script). */
const INSTALL_COMPLETE_MARKER = "ZETA CLUSTER NODE INSTALL COMPLETE";

/** 081KSGS9H0008QG0R0011BC7T2 slice 2 — non-TTY CI dry-run cluster-node registration compose. */
const SELF_REG_CI_MARKER = "[iter-5.4.1-ci] composed ClusterNode";

/** Mid-install progress — nixos-install reached post-install wifi step. */
const NIXOS_INSTALL_PROGRESS_MARKER = "[iter-5.1]";

const FAILURE_MARKERS: readonly string[] = [
  "panic",
  "FATAL",
  "Refusing to wipe",
  "no internet",
  "bail",
  "[zeta-first-boot] Install failed",
];

const IDLE_INSTALLER_SHELL_MARKER = "nixos@zeta-installer:~";
const CONTROL_PLANE_LOGIN_PROMPT = "control-plane login:";

const CONSOLE_MIRROR_HINT =
  "serial log shows idle installer shell without install progress — " +
  "zeta-first-boot may be running on tty1 only; mirror output to /dev/ttyS0 " +
  "(see full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh)";

const INSTALL_TIMEOUT_SECONDS = 1800;
const DISK_BOOT_TIMEOUT_SECONDS = 1800;
const POLL_INTERVAL_MS = 2000;
const MEMORY_MB = 4096;
const CPU_COUNT = 2;
const DISK_SIZE_GB = 20;
const KVM_PATH = "/dev/kvm";

/** Separator between phase-1 installer serial and phase-2 disk-boot serial in artifacts. */
export const PHASE2_SERIAL_SEPARATOR =
  "\n\n=== PHASE 2: boot installed disk (no ISO) ===\n\n";

/** Exported for unit tests. QEMU `-serial file:` truncates on each launch. */
export function mergeFullInstallSerialLogs(phase1: string, phase2: string): string {
  return phase1 + PHASE2_SERIAL_SEPARATOR + phase2;
}

/** Exported for unit tests. */
export const OVMF_FIRMWARE_CANDIDATES = [
  // Ubuntu 24.04+ / Debian 12+ (2MB images removed from ovmf package)
  { code: "/usr/share/OVMF/OVMF_CODE_4M.fd", vars: "/usr/share/OVMF/OVMF_VARS_4M.fd" },
  { code: "/usr/share/qemu/OVMF_CODE_4M.fd", vars: "/usr/share/qemu/OVMF_VARS_4M.fd" },
  // Legacy 2MB images (older distros)
  { code: "/usr/share/OVMF/OVMF_CODE.fd", vars: "/usr/share/OVMF/OVMF_VARS.fd" },
  { code: "/usr/share/qemu/OVMF_CODE.fd", vars: "/usr/share/qemu/OVMF_VARS.fd" },
] as const;

interface InstallResult {
  readonly exitCode: 0 | 1 | 2;
  readonly reason: string;
  readonly serialLogTail?: string;
  readonly elapsedSeconds?: number;
  readonly hostname?: string;
}

/** Exported for unit tests. */
export function extractGeneratedHostname(serialOutput: string): string | null {
  const match = serialOutput.match(/\[iter-5\.2\.2\]\s+generated:\s+([a-z0-9-]+)/i);
  return match?.[1] ?? null;
}

/** Exported for unit tests. */
export function detectUnexpectedControlPlaneLogin(
  serialOutput: string,
  expectedHostname: string | null,
): string | null {
  if (
    expectedHostname &&
    expectedHostname !== "control-plane" &&
    serialOutput.includes(CONTROL_PLANE_LOGIN_PROMPT)
  ) {
    return `phase 2 FAILURE — 081KSGS9H0008QG0R00120EEHM Bug 1 regression: saw "${CONTROL_PLANE_LOGIN_PROMPT}" but expected "${expectedHostname}"`;
  }
  return null;
}

/** Exported for unit tests. Detect installed-system login prompt in serial output. */
export function detectInstalledLoginPrompt(
  serialOutput: string,
  expectedHostname: string | null,
): { readonly ok: true; readonly reason: string; readonly hostname?: string } | { readonly ok: false } {
  const loginNeedle = expectedHostname ? `${expectedHostname} login:` : null;
  const welcomeNeedle = expectedHostname
    ? `Welcome to ${expectedHostname} (Zeta cluster node)`
    : null;

  if (loginNeedle && serialOutput.includes(loginNeedle)) {
    return {
      ok: true,
      reason: `login prompt "${loginNeedle}" observed`,
      ...(expectedHostname !== null ? { hostname: expectedHostname } : {}),
    };
  }

  if (welcomeNeedle && serialOutput.includes(welcomeNeedle) && serialOutput.includes("login:")) {
    return {
      ok: true,
      reason: `login banner "${welcomeNeedle}" observed`,
      ...(expectedHostname !== null ? { hostname: expectedHostname } : {}),
    };
  }

  if (detectUnexpectedControlPlaneLogin(serialOutput, expectedHostname)) {
    return { ok: false };
  }

  if (!loginNeedle) {
    for (const match of serialOutput.matchAll(/(?:^|\n)([a-z0-9-]+) login:/gi)) {
      const host = match[1];
      if (host && host !== "zeta-installer") {
        return {
          ok: true,
          reason: `login prompt "${host} login:" observed`,
          hostname: host,
        };
      }
    }
  }

  return { ok: false };
}

/** Exported for unit tests. Phase 2 (+ optional phase-3 first-session markers). */
export function detectPhase2Success(
  serialOutput: string,
  expectedHostname: string | null,
  requireFirstSession = false,
): { readonly ok: true; readonly reason: string; readonly hostname?: string } | { readonly ok: false } {
  const login = detectInstalledLoginPrompt(serialOutput, expectedHostname);
  if (!login.ok) return { ok: false };
  if (requireFirstSession && !firstSessionMarkersSatisfied(serialOutput)) {
    return { ok: false };
  }
  const phase3Suffix = requireFirstSession ? " + first-session markers" : "";
  return {
    ok: true,
    reason: `phase 2 SUCCESS — ${login.reason}${phase3Suffix}`,
    ...(login.hostname !== undefined ? { hostname: login.hostname } : {}),
  };
}

function usage(): never {
  console.error("usage: bun src/Core.TypeScript/ci/qemu-full-install-test.ts <iso-path>");
  process.exit(2);
}

function checkDependencies(): string | null {
  try {
    const result = Bun.spawnSync(["qemu-system-x86_64", "--version"]);
    if (result.exitCode !== 0) {
      return "qemu-system-x86_64 not found; install via `apt-get install -y qemu-system-x86`";
    }
  } catch {
    return "qemu-system-x86_64 not found in PATH; install via `apt-get install -y qemu-system-x86`";
  }
  try {
    const result = Bun.spawnSync(["qemu-img", "--version"]);
    if (result.exitCode !== 0) {
      return "qemu-img not found; install via `apt-get install -y qemu-utils`";
    }
  } catch {
    return "qemu-img not found in PATH; install via `apt-get install -y qemu-utils`";
  }
  if (resolveOvmfFirmware() === null) {
    return "OVMF firmware not found; install via `apt-get install -y ovmf` (phase 2 systemd-boot disk boot)";
  }
  return null;
}

function resolveOvmfFirmware(): { readonly code: string; readonly varsTemplate: string } | null {
  for (const candidate of OVMF_FIRMWARE_CANDIDATES) {
    if (existsSync(candidate.code) && existsSync(candidate.vars)) {
      return { code: candidate.code, varsTemplate: candidate.vars };
    }
  }
  return null;
}

function prepareWritableOvmfVars(tmpDir: string, varsTemplate: string): string {
  const varsPath = join(tmpDir, "OVMF_VARS.fd");
  execFileSync("cp", [varsTemplate, varsPath]);
  return varsPath;
}

function kvmEnabled(): boolean {
  return existsSync(KVM_PATH);
}

function appendKvmCpu(args: string[]): void {
  if (kvmEnabled()) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
    console.warn(`[qemu-full-install-test] ${KVM_PATH} not available; using TCG (slow)`);
  }
}

function createVirtualDisk(diskPath: string): void {
  console.log(`[qemu-full-install-test] Creating ${DISK_SIZE_GB}GB qcow2 disk at ${diskPath}`);
  execFileSync("qemu-img", ["create", "-f", "qcow2", diskPath, `${DISK_SIZE_GB}G`], {
    stdio: "inherit",
  });
}

function buildQemuInstallArgs(isoPath: string, diskPath: string, serialLogPath: string): string[] {
  const args: string[] = [
    "-machine", "q35",
    "-m", String(MEMORY_MB),
    "-smp", String(CPU_COUNT),
    "-cdrom", isoPath,
    "-boot", "d",
    "-drive", `file=${diskPath},if=virtio,format=qcow2`,
    "-serial", `file:${serialLogPath}`,
    "-display", "none",
    "-netdev", "user,id=net0",
    "-device", "virtio-net-pci,netdev=net0",
  ];
  appendKvmCpu(args);
  return args;
}

function buildQemuDiskBootArgs(diskPath: string, serialLogPath: string, tmpDir: string): string[] {
  const ovmf = resolveOvmfFirmware();
  if (!ovmf) {
    throw new Error("OVMF firmware missing; cannot UEFI-boot installed systemd-boot disk");
  }
  const varsPath = prepareWritableOvmfVars(tmpDir, ovmf.varsTemplate);
  return buildQemuDiskBootArgsPure(diskPath, serialLogPath, ovmf.code, varsPath, kvmEnabled());
}

/** Exported for unit tests. */
export function buildQemuDiskBootArgsPure(
  diskPath: string,
  serialLogPath: string,
  ovmfCodePath: string,
  ovmfVarsPath: string,
  kvm: boolean,
): string[] {
  // Phase 2 only needs a login prompt on serial — no network. A virtio-net
  // NIC exposes a UEFI "Misc Device" boot entry (Pci 0x3,0x0) that can win
  // fresh OVMF_VARS boot order and stall after initrd (081KSNY2Z0008QG0R0008PN7RQ run #27589613408).
  const args: string[] = [
    "-machine", "q35",
    "-m", String(MEMORY_MB),
    "-smp", String(CPU_COUNT),
    "-drive", `if=pflash,format=raw,unit=0,readonly=on,file=${ovmfCodePath}`,
    "-drive", `if=pflash,format=raw,unit=1,file=${ovmfVarsPath}`,
    "-drive", `file=${diskPath},if=none,format=qcow2,id=installdisk`,
    "-device", "virtio-blk-pci,drive=installdisk,bootindex=1",
    "-serial", `file:${serialLogPath}`,
    "-display", "none",
    "-vga", "none",
    "-no-reboot",
  ];
  if (kvm) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
  }
  return args;
}

function readSerial(serialLogPath: string): string {
  return existsSync(serialLogPath) ? readFileSync(serialLogPath, "utf8") : "";
}

function checkFailureMarkers(content: string): string | null {
  for (const failMarker of FAILURE_MARKERS) {
    if (content.includes(failMarker)) {
      return failMarker;
    }
  }
  return null;
}

async function waitForInstallComplete(serialLogPath: string): Promise<InstallResult> {
  const start = Date.now();
  const deadline = start + INSTALL_TIMEOUT_SECONDS * 1000;
  let lastReportedMinute = -1;

  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      console.log(
        `[qemu-full-install-test] phase 1: ${elapsedMin} min elapsed; waiting for "${INSTALL_COMPLETE_MARKER}"`,
      );
      lastReportedMinute = elapsedMin;
    }

    const content = readSerial(serialLogPath);
    if (content.includes(INSTALL_COMPLETE_MARKER)) {
      if (!content.includes(SELF_REG_CI_MARKER)) {
        return {
          exitCode: 1,
          reason: `phase 1 FAILURE — "${INSTALL_COMPLETE_MARKER}" seen but missing "${SELF_REG_CI_MARKER}" (cluster join dry-run)`,
          serialLogTail: content.slice(-2000),
          elapsedSeconds: elapsedSec,
        };
      }
      const selfReg = validateSelfRegCiCoherent(content);
      if (!selfReg.ok) {
        return {
          exitCode: 1,
          reason: `phase 1 FAILURE — iter-5.4.1-ci dry-run incoherent: ${selfReg.reason}`,
          serialLogTail: content.slice(-2000),
          elapsedSeconds: elapsedSec,
        };
      }
      const resolvedHostname = extractGeneratedHostname(content);
      return {
        exitCode: 0,
        reason: `phase 1 SUCCESS — install complete + ${SELF_REG_CI_MARKER} observed`,
        serialLogTail: content.slice(-1500),
        elapsedSeconds: elapsedSec,
        ...(resolvedHostname !== null ? { hostname: resolvedHostname } : {}),
      };
    }

    const failMarker = checkFailureMarkers(content);
    if (failMarker) {
      return {
        exitCode: 1,
        reason: `phase 1 FAILURE — hard-fail marker "${failMarker}"`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }

    if (
      elapsedSec >= 120 &&
      content.includes(IDLE_INSTALLER_SHELL_MARKER) &&
      !content.includes(NIXOS_INSTALL_PROGRESS_MARKER) &&
      !content.includes("[zeta-first-boot]") &&
      !content.includes("[iter-") &&
      !serialFirstBootInProgress(content)
    ) {
      return {
        exitCode: 1,
        reason: `phase 1 FAILURE — ${CONSOLE_MIRROR_HINT}`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }

  const content = readSerial(serialLogPath);
  return {
    exitCode: 1,
    reason: `phase 1 timeout (${INSTALL_TIMEOUT_SECONDS}s) waiting for "${INSTALL_COMPLETE_MARKER}"`,
    serialLogTail: content.slice(-3000),
    elapsedSeconds: Math.floor((Date.now() - start) / 1000),
  };
}

async function waitForInstalledLogin(
  serialLogPath: string,
  expectedHostname: string | null,
  requireFirstSession: boolean,
): Promise<InstallResult> {
  const start = Date.now();
  const deadline = start + DISK_BOOT_TIMEOUT_SECONDS * 1000;
  const loginNeedle = expectedHostname ? `${expectedHostname} login:` : null;
  let lastReportedMinute = -1;

  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      const target = requireFirstSession
        ? `${loginNeedle ?? "login"} + first-session markers`
        : (loginNeedle ?? "installed-system login prompt");
      console.log(
        `[qemu-full-install-test] phase 2: ${elapsedMin} min elapsed; waiting for "${target}"`,
      );
      lastReportedMinute = elapsedMin;
    }
    const content = readSerial(serialLogPath);

    const unexpectedControlPlaneReason = detectUnexpectedControlPlaneLogin(content, expectedHostname);
    if (unexpectedControlPlaneReason) {
      return {
        exitCode: 1,
        reason: unexpectedControlPlaneReason,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }

    const success = detectPhase2Success(content, expectedHostname, requireFirstSession);
    if (success.ok) {
      return {
        exitCode: 0,
        reason: success.reason,
        serialLogTail: content.slice(-1500),
        elapsedSeconds: elapsedSec,
        ...(success.hostname !== undefined ? { hostname: success.hostname } : {}),
      };
    }

    const failMarker = checkFailureMarkers(content);
    if (failMarker) {
      return {
        exitCode: 1,
        reason: `phase 2 FAILURE — hard-fail marker "${failMarker}"`,
        serialLogTail: content.slice(-2000),
        elapsedSeconds: elapsedSec,
      };
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }

  const content = readSerial(serialLogPath);
  const emptySerialHint =
    content.trim().length === 0
      ? " (serial log empty — installed disk may need UEFI/OVMF boot or console=ttyS0 on the installed node)"
      : content.includes("EFI stub: Loaded initrd") && !content.includes("login:")
        ? " (serial stopped after EFI initrd — likely initrd cannot mount virtio root; verify hardware-configuration.nix copy at install + virtio_blk in initrd)"
        : "";
  const phase3Hint = requireFirstSession && !firstSessionMarkersSatisfied(content)
    ? " (login may be present but zeta-first-session: begin|complete markers missing — check zeta-first-session-ci.service)"
    : "";
  return {
    exitCode: 1,
    reason: loginNeedle
      ? `phase 2 timeout (${DISK_BOOT_TIMEOUT_SECONDS}s) waiting for "${loginNeedle}"${phase3Hint}${emptySerialHint}`
      : `phase 2 timeout (${DISK_BOOT_TIMEOUT_SECONDS}s) waiting for installed-system login prompt${phase3Hint}${emptySerialHint}`,
    serialLogTail: content.slice(-3000),
    elapsedSeconds: Math.floor((Date.now() - start) / 1000),
  };
}

async function runQemuUntil(
  args: string[],
  serialLogPath: string,
  wait: () => Promise<InstallResult>,
  phaseLabel: string,
): Promise<InstallResult> {
  console.log(`[qemu-full-install-test] ${phaseLabel}: qemu-system-x86_64 ${args.join(" ")}`);

  const qemu = spawn("qemu-system-x86_64", args, {
    stdio: ["ignore", "inherit", "inherit"],
  });

  let qemuExited = false;
  const earlyExit = new Promise<InstallResult>((res) => {
    qemu.on("exit", (code) => {
      qemuExited = true;
      console.log(`[qemu-full-install-test] ${phaseLabel}: QEMU exited with code ${code}`);
      const tail = readSerial(serialLogPath).slice(-2000);
      res({
        exitCode: 1,
        reason: `${phaseLabel} FAILURE — QEMU exited with code ${code} before success marker`,
        serialLogTail: tail,
      });
    });
  });

  const result = await Promise.race([wait(), earlyExit]);

  if (!qemuExited) {
    console.log(`[qemu-full-install-test] ${phaseLabel}: stopping QEMU (PID ${qemu.pid})`);
    qemu.kill("SIGTERM");
    await Bun.sleep(2000);
    if (!qemuExited) {
      qemu.kill("SIGKILL");
    }
  }

  return result;
}

function reportResult(result: InstallResult, serialLogPath: string): never {
  console.log("");
  console.log("=== Result ===");
  console.log(`Exit code: ${result.exitCode}`);
  console.log(`Reason: ${result.reason}`);
  if (result.hostname) {
    console.log(`Hostname: ${result.hostname}`);
  }
  if (result.elapsedSeconds !== undefined) {
    console.log(
      `Elapsed: ${result.elapsedSeconds}s (${Math.floor(result.elapsedSeconds / 60)}m ${result.elapsedSeconds % 60}s)`,
    );
  }
  if (result.serialLogTail) {
    console.log("");
    console.log("=== Serial log tail ===");
    console.log(result.serialLogTail);
  }
  console.log("");
  console.log(`Full serial log preserved at: ${serialLogPath}`);
  process.exit(result.exitCode);
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
  const artifactSerialLogPath = process.env.SERIAL_LOG_OUT_PATH ?? join(tmpDir, "serial.log");
  const phase1SerialLogPath = join(tmpDir, "phase1-serial.log");
  const phase2SerialLogPath = join(tmpDir, "phase2-serial.log");

  const writeArtifactSerialLog = (phase1: string, phase2: string): void => {
    writeFileSync(artifactSerialLogPath, mergeFullInstallSerialLogs(phase1, phase2));
  };

  console.log(`[qemu-full-install-test] ISO: ${isoPath}`);
  console.log(`[qemu-full-install-test] Virtual disk: ${diskPath}`);
  console.log(`[qemu-full-install-test] Serial log artifact: ${artifactSerialLogPath}`);

  createVirtualDisk(diskPath);

  const phase1 = await runQemuUntil(
    buildQemuInstallArgs(isoPath, diskPath, phase1SerialLogPath),
    phase1SerialLogPath,
    () => waitForInstallComplete(phase1SerialLogPath),
    "phase 1 (ISO install)",
  );
  const phase1Serial = readSerial(phase1SerialLogPath);
  if (phase1.exitCode !== 0) {
    writeArtifactSerialLog(phase1Serial, "");
    reportResult(phase1, artifactSerialLogPath);
  }

  const hostname = phase1.hostname ?? extractGeneratedHostname(phase1Serial);
  console.log(`[qemu-full-install-test] phase 1 done; expected hostname: ${hostname ?? "(infer at login)"}`);

  const requireFirstSession = firstSessionPhase3Enabled();
  if (requireFirstSession) {
    console.log("[qemu-full-install-test] phase 3 enabled (QEMU_FIRST_SESSION_PHASE3=1) — will assert first-session serial markers");
  }

  const phase2 = await runQemuUntil(
    buildQemuDiskBootArgs(diskPath, phase2SerialLogPath, tmpDir),
    phase2SerialLogPath,
    () => waitForInstalledLogin(phase2SerialLogPath, hostname, requireFirstSession),
    requireFirstSession ? "phase 2+3 (disk boot + first-session)" : "phase 2 (disk boot)",
  );

  writeArtifactSerialLog(phase1Serial, readSerial(phase2SerialLogPath));
  reportResult(phase2, artifactSerialLogPath);
}

if (import.meta.main) {
  main();
}
