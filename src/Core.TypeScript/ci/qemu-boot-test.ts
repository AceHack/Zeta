#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ci/qemu-boot-test.ts
 *
 * QEMU boot smoke-test for the canonical Zeta installer ISO.
 *
 * Boots the ISO in QEMU/KVM with serial console output captured to a
 * log file, waits up to the arch-appropriate budget for the expected
 * login prompt matching the installer's networking.hostName
 * (`zeta-installer`), then shuts down cleanly.
 *
 * Per Rule 0 (TS-over-bash for DST + cross-platform) + Kestrel's
 * 2026-05-26 ferry pointer to nixos/tests/installer.nix prior art.
 * Composes with full-ai-cluster/usb-nixos-installer/ canonical
 * installer + the build-ai-cluster-iso.yml workflow's post-build audit
 * stack.
 *
 * Usage:
 *   bun src/Core.TypeScript/ci/qemu-boot-test.ts <iso-path>
 *   bun src/Core.TypeScript/ci/qemu-boot-test.ts --usb-image <zflash-raw.img>
 *   bun src/Core.TypeScript/ci/qemu-boot-test.ts <iso> --timeout-seconds 120
 *
 * Exit codes:
 *   0 — BOOTED      (login prompt observed)
 *   1 — BOOT-FAILED (positive evidence the image did not boot)
 *   2 — usage error (bad args or missing dependencies)
 *   3 — TIMEOUT     (budget exhausted while the guest was demonstrably
 *                    still progressing through the boot; NOT evidence of
 *                    a broken image)
 *
 * ── WHY 1 AND 3 ARE DIFFERENT EXIT CODES (2026-08-16) ───────────────
 * They used to be the same code with only a free-text `reason` to tell
 * them apart, and that made the aarch64 lane unable to report a real
 * boot break. Measured, not assumed:
 *
 *   - A genuinely NON-BOOTABLE image does not exit QEMU. EDK2 finds no
 *     boot option, drops to the UEFI Shell, and sits there forever
 *     (reproduced locally 2026-08-16 with a 4MB /dev/urandom "ISO":
 *     QEMU still alive at 180s, serial parked at `Shell>`). The old code
 *     therefore burned the ENTIRE budget and printed
 *     `Timeout (1800s) waiting for ...` — the same sentence a slow-but-
 *     healthy boot prints. The two were indistinguishable.
 *   - The old `abandoned` predicate only fired on `qemuExitCode !== 0`,
 *     so even a guest that powered itself off cleanly was reported as a
 *     timeout after the full budget.
 *
 * The discriminator that actually works is the SERIAL CONTENT, not the
 * process exit: how far up the boot-stage ladder did the guest get?
 * Verified against three real captured logs (see qemu-boot-test.test.ts
 * fixtures): a healthy boot reaches `login`; the CI aarch64 TCG timeout
 * reached `efi-stub`; the non-bootable image never left `firmware` and
 * positively announced the UEFI Shell.
 *
 * GitHub Actions context: ubuntu-24.04 (x86_64) runners have /dev/kvm.
 * The ubuntu-24.04-arm runners DO NOT — confirmed in the job log, which
 * prints the TCG warning below — so the aarch64 lane is pure TCG.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXPECTED_HOSTNAME = "zeta-installer";
export const EXPECTED_LOGIN_PROMPT = `${EXPECTED_HOSTNAME} login:`;
const TIMEOUT_SECONDS = 300; // 5 min — generous; typical x86_64 KVM boot is 60-180s

// aarch64 without same-arch KVM is pure TCG. Measured 2026-08-16 on an
// M2 Ultra (QEMU 11.0.1), same CI ISO artifact, to the login prompt:
//   HVF (native virt) ........ 24s
//   TCG -cpu max ............. 58s
//   TCG -cpu cortex-a72 ...... 60s   (no win — hypothesis tested, refuted)
//   TCG -cpu neoverse-n1 ..... 63s
//   TCG -cpu max,pauth-impdef  62s   (no win — hypothesis tested, refuted)
// So the CPU MODEL is not the lever; host speed and QEMU version are.
// CI runs QEMU 8.2.2 on a 4-vCPU Ampere runner and blew past 1800s with
// the serial parked at `EFI stub: Exiting boot services` — i.e. still
// inside the kernel handoff. The implied slowdown vs this measurement is
// >31x, which is larger than a CPU-model tweak can close, so the budget
// is raised and INSTRUMENTED (stage ladder with elapsed seconds) instead
// of guessed at. The job's own `timeout-minutes: 120` bounds the blast
// radius; ~6 min of that is checkout/nix/apt/build.
const AARCH64_TCG_TIMEOUT_SECONDS = 4200; // 70 min
const POLL_INTERVAL_MS = 1000;
const MEMORY_MB = 2048; // installer needs >= 1GB; 2GB gives headroom for nix
const KVM_PATH = "/dev/kvm";

// ── Boot-stage ladder ───────────────────────────────────────────────
// Ordered floor-to-ceiling. `furthestBootStage` reports the highest rung
// whose marker appears, which is what separates "did not boot" from
// "was still booting when the clock ran out".
export type BootStage =
  | "none"
  | "firmware"
  | "bootloader"
  | "efi-stub"
  | "userspace"
  | "login";

export const BOOT_STAGE_LADDER: readonly { readonly stage: BootStage; readonly marker: string }[] = [
  { stage: "firmware", marker: "UEFI firmware" },
  { stage: "bootloader", marker: "Booting `NixOS" },
  { stage: "efi-stub", marker: "EFI stub: Exiting boot services" },
  { stage: "userspace", marker: "Welcome to NixOS" },
  { stage: "login", marker: EXPECTED_LOGIN_PROMPT },
];

export const BOOT_STAGE_ORDER: readonly BootStage[] = [
  "none",
  ...BOOT_STAGE_LADDER.map((r) => r.stage),
];

/** Highest boot stage evidenced by the serial log. Pure. */
export function furthestBootStage(serial: string): BootStage {
  let reached: BootStage = "none";
  for (const rung of BOOT_STAGE_LADDER) {
    if (serial.includes(rung.marker)) reached = rung.stage;
  }
  return reached;
}

/** True when `stage` is at or above `floor` on the ladder. Pure. */
export function stageAtLeast(stage: BootStage, floor: BootStage): boolean {
  return BOOT_STAGE_ORDER.indexOf(stage) >= BOOT_STAGE_ORDER.indexOf(floor);
}

// Positive failure evidence. Each of these means "this image is not
// going to boot no matter how long we wait", so we may fail FAST rather
// than burning the budget and then mislabelling the result a timeout.
export const FAILURE_MARKERS: readonly { readonly marker: string; readonly meaning: string }[] = [
  // EDK2 found no bootable boot option and fell through to its shell.
  // Reproduced 2026-08-16 with a /dev/urandom image.
  { marker: "startup.nsh", meaning: "UEFI Shell reached — firmware found no bootable boot option" },
  { marker: "Shell> ", meaning: "UEFI Shell prompt — firmware found no bootable boot option" },
  { marker: "Kernel panic", meaning: "kernel panic" },
  { marker: "Synchronous Exception at", meaning: "firmware synchronous exception" },
  { marker: "ASSERT_EFI_ERROR", meaning: "EDK2 assertion failure" },
];

/** First positive failure marker present, if any. Pure. */
export function detectFailureMarker(serial: string): string | null {
  for (const f of FAILURE_MARKERS) {
    if (serial.includes(f.marker)) return f.meaning;
  }
  return null;
}

export type BootOutcome = "BOOTED" | "BOOT-FAILED" | "TIMEOUT";

export interface BootClassification {
  readonly outcome: BootOutcome;
  readonly stage: BootStage;
  readonly reason: string;
}

export interface ClassifyInput {
  readonly serial: string;
  /** QEMU process has exited (regardless of its exit code). */
  readonly qemuExited: boolean;
  readonly qemuExitCode: number | null;
  /** The time budget has been exhausted. */
  readonly deadlineReached: boolean;
  readonly timeoutSeconds: number;
}

/**
 * Sole authority on what a run means. Pure so it is unit-testable
 * without QEMU (the previous version had no test at all, which is a
 * large part of why the conflation survived).
 *
 * Ordering matters: the login prompt wins over everything (a guest can
 * print a scary-looking string and still be up), then positive failure
 * evidence, then process death, then the clock.
 */
export function classifyBoot(input: ClassifyInput): BootClassification {
  const stage = furthestBootStage(input.serial);

  if (input.serial.includes(EXPECTED_LOGIN_PROMPT)) {
    return {
      outcome: "BOOTED",
      stage,
      reason: `Login prompt observed: "${EXPECTED_LOGIN_PROMPT}"`,
    };
  }

  const failure = detectFailureMarker(input.serial);
  if (failure !== null) {
    return {
      outcome: "BOOT-FAILED",
      stage,
      reason: `Boot failed — ${failure} (furthest stage: ${stage})`,
    };
  }

  // ANY exit before the prompt is a boot failure, including a clean
  // exit 0. The old predicate required a non-zero code and so silently
  // waited out the whole budget on a guest that powered itself off.
  if (input.qemuExited) {
    return {
      outcome: "BOOT-FAILED",
      stage,
      reason: `QEMU exited (code ${input.qemuExitCode}) before the login prompt (furthest stage: ${stage})`,
    };
  }

  if (input.deadlineReached) {
    // Never reached the bootloader => the firmware never handed off.
    // More waiting cannot help; this is a failure, not a slow boot.
    if (!stageAtLeast(stage, "bootloader")) {
      return {
        outcome: "BOOT-FAILED",
        stage,
        reason:
          `Budget (${input.timeoutSeconds}s) exhausted and the guest never reached the bootloader ` +
          `(furthest stage: ${stage}) — the firmware never handed off to an OS`,
      };
    }
    return {
      outcome: "TIMEOUT",
      stage,
      reason:
        `Budget (${input.timeoutSeconds}s) exhausted while still booting (furthest stage: ${stage}). ` +
        `This is a BUDGET result, not a boot failure — the guest was progressing and no failure ` +
        `marker was seen.`,
    };
  }

  return { outcome: "TIMEOUT", stage, reason: "still running" };
}

export function outcomeExitCode(outcome: BootOutcome): 0 | 1 | 3 {
  if (outcome === "BOOTED") return 0;
  if (outcome === "BOOT-FAILED") return 1;
  return 3;
}

type Arch = "x86_64" | "aarch64";

export interface BootMedia {
  readonly kind: "iso" | "usb-image";
  readonly path: string;
}

function usage(): never {
  console.error("usage: bun src/Core.TypeScript/ci/qemu-boot-test.ts <iso-path> [--arch x86_64|aarch64] [--timeout-seconds N]");
  console.error("       bun src/Core.TypeScript/ci/qemu-boot-test.ts --usb-image <zflash-raw.img> [--arch x86_64|aarch64]");
  process.exit(2);
}

function qemuBinary(arch: Arch): string {
  return arch === "aarch64" ? "qemu-system-aarch64" : "qemu-system-x86_64";
}

// aarch64 UEFI firmware (apt: qemu-efi-aarch64). -machine virt has no
// BIOS path; EDK2 is the only boot road. First existing candidate wins.
export const AARCH64_EFI_CANDIDATES = [
  "/usr/share/qemu-efi-aarch64/QEMU_EFI.fd",
  "/usr/share/AAVMF/AAVMF_CODE.fd",
  // Homebrew (macOS, Apple Silicon). Not a CI path — it is what makes
  // this harness runnable on a local aarch64 host, which is how the
  // 2026-08-16 diagnosis was made (the CI artifact was booted here and
  // reached the login prompt in 24s, proving the image was fine and the
  // budget was the defect).
  "/opt/homebrew/share/qemu/edk2-aarch64-code.fd",
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

export interface HostCapabilities {
  readonly kvmAvailable: boolean;
  readonly hostArch: string;
  readonly efiPath?: string;
}

/** Pure arg construction — no filesystem probing, so it is testable. */
export function buildQemuArgsPure(
  arch: Arch,
  bootMedia: BootMedia,
  serialLogPath: string,
  host: HostCapabilities,
): string[] {
  if (arch === "aarch64") {
    if (bootMedia.kind === "usb-image") {
      throw new Error("aarch64 --usb-image boot is not supported yet");
    }
    // -machine virt + EDK2 UEFI; the PL011 serial (ttyAMA0 — matched by
    // the installer's console= kernel param) lands in the serial log.
    const args: string[] = [
      "-machine", "virt",
      "-m", String(MEMORY_MB),
      "-smp", "2",
      "-bios", host.efiPath ?? AARCH64_EFI_CANDIDATES[0]!,
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
    // KVM only accelerates same-arch (an aarch64 host). GitHub's
    // ubuntu-24.04-arm runners do NOT expose /dev/kvm, so CI is TCG.
    if (host.kvmAvailable && host.hostArch === "arm64") {
      args.push("-enable-kvm", "-cpu", "host");
    } else {
      // Measured 2026-08-16: cortex-a72 / neoverse-n1 / pauth-impdef are
      // all within noise of `max` under TCG, so there is no cheap CPU
      // -model win to take here. Left as `max`.
      args.push("-cpu", "max");
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

  if (host.kvmAvailable) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
  }

  return args;
}

function probeHost(arch: Arch): HostCapabilities {
  const efiPath = arch === "aarch64" ? AARCH64_EFI_CANDIDATES.find((f) => existsSync(f)) : undefined;
  // `exactOptionalPropertyTypes` is on: an optional property must be
  // ABSENT, not present-and-undefined.
  return {
    kvmAvailable: existsSync(KVM_PATH),
    hostArch: process.arch,
    ...(efiPath === undefined ? {} : { efiPath }),
  };
}

export function timeoutSecondsFor(arch: Arch, host: HostCapabilities): number {
  if (arch === "aarch64" && !(host.kvmAvailable && host.hostArch === "arm64")) {
    return AARCH64_TCG_TIMEOUT_SECONDS;
  }
  return TIMEOUT_SECONDS;
}

interface WatchResult extends BootClassification {
  readonly serialTail: string;
  readonly elapsedSeconds: number;
}

async function watchBoot(
  serialLogPath: string,
  timeoutSeconds: number,
  qemuState: () => { exited: boolean; exitCode: number | null },
): Promise<WatchResult> {
  const started = Date.now();
  const deadline = started + timeoutSeconds * 1000;
  const elapsed = () => Math.round((Date.now() - started) / 1000);

  // Live stage ladder: the CI log then SHOWS where the time went, which
  // is the difference between "we know the budget is too small" and
  // "we guessed the budget was too small".
  let announced: BootStage = "none";

  const read = (): string => {
    if (!existsSync(serialLogPath)) return "";
    try {
      return readFileSync(serialLogPath, "utf8");
    } catch {
      return ""; // log in transit; retry on next poll
    }
  };

  for (;;) {
    const serial = read();
    const q = qemuState();
    const deadlineReached = Date.now() >= deadline;

    const stage = furthestBootStage(serial);
    if (stage !== announced) {
      announced = stage;
      console.log(`[qemu-boot-test] t=${elapsed()}s  stage → ${stage}`);
    }

    const classification = classifyBoot({
      serial,
      qemuExited: q.exited,
      qemuExitCode: q.exitCode,
      deadlineReached,
      timeoutSeconds,
    });

    const settled =
      classification.outcome === "BOOTED" ||
      classification.outcome === "BOOT-FAILED" ||
      deadlineReached;

    if (settled) {
      return {
        ...classification,
        serialTail: serial.length > 0 ? serial.slice(-2000) : "(serial log empty or never created)",
        elapsedSeconds: elapsed(),
      };
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }
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

  const tmoFlag = argv.indexOf("--timeout-seconds");
  let timeoutOverride: number | null = null;
  if (tmoFlag >= 0) {
    const v = Number(argv[tmoFlag + 1]);
    if (!Number.isFinite(v) || v <= 0) usage();
    timeoutOverride = v;
    argv.splice(tmoFlag, 2);
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

  const host = probeHost(arch);
  const timeoutSeconds = timeoutOverride ?? timeoutSecondsFor(arch, host);

  if (arch === "aarch64" && !(host.kvmAvailable && host.hostArch === "arm64")) {
    console.warn(`[qemu-boot-test] aarch64 without same-arch KVM; using TCG (will be slow)`);
  } else if (arch === "x86_64" && !host.kvmAvailable) {
    console.warn(`[qemu-boot-test] ${KVM_PATH} not available; using TCG emulation (will be slow)`);
  }

  console.log(`[qemu-boot-test] Boot media: ${bootMedia.kind} ${bootMedia.path}`);
  console.log(`[qemu-boot-test] Serial log: ${serialLogPath}`);
  console.log(`[qemu-boot-test] Memory: ${MEMORY_MB}MB; timeout: ${timeoutSeconds}s`);
  console.log(`[qemu-boot-test] Expecting login prompt: "${EXPECTED_LOGIN_PROMPT}"`);
  console.log(`[qemu-boot-test] Arch: ${arch}`);

  let qemuArgs: string[];
  try {
    qemuArgs = buildQemuArgsPure(arch, bootMedia, serialLogPath, host);
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

  const result = await watchBoot(serialLogPath, timeoutSeconds, () => ({
    exited: qemuExited,
    exitCode: qemuExitCode,
  }));

  if (!qemuExited) {
    console.log(`[qemu-boot-test] Killing QEMU (PID ${qemu.pid})`);
    qemu.kill("SIGTERM");
    setTimeout(() => {
      if (!qemuExited) qemu.kill("SIGKILL");
    }, 5000);
  }

  const exitCode = outcomeExitCode(result.outcome);

  console.log("");
  console.log("=== Result ===");
  console.log(`Outcome: ${result.outcome}`);
  console.log(`Furthest boot stage: ${result.stage}`);
  console.log(`Elapsed: ${result.elapsedSeconds}s (budget ${timeoutSeconds}s)`);
  console.log(`Exit code: ${exitCode}`);
  console.log(`Reason: ${result.reason}`);
  console.log("");
  console.log("=== Serial log tail ===");
  console.log(result.serialTail);

  process.exit(exitCode);
}

if (import.meta.main) {
  void main();
}
