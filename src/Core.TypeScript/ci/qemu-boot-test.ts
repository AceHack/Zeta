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
 *   4 — STALLED     (the guest reached the kernel handoff and then emitted
 *                    NOTHING for STALL_SECONDS. This reports the FACT --
 *                    prolonged silence -- and deliberately does not claim
 *                    whether the guest is hung or starved of CPU.)
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
 *
 * ── THE SAME CRUX, ON x86_64 (2026-08-16) ───────────────────────────
 * The discriminator above was built and measured on the aarch64 road and
 * it did not transfer: on x86_64 the ladder read a CONSTANT. Two
 * measurements, neither inferred from the diff:
 *
 *   1. Nineteen consecutive successful x86_64 CI runs (31964938508 …
 *      31977504172) each printed exactly ONE stage line — `stage → login`
 *      — because three of the five rungs matched EDK2/GRUB/EFI-stub
 *      strings that a SeaBIOS + ISOLINUX + BIOS boot never emits.
 *   2. A non-bootable image on this machine, on the harness's own
 *      xhci/usb-storage chain: serial log 0 bytes, QEMU still alive at
 *      25s. Identical presentation to a healthy boot that has not
 *      reached userspace yet — the aarch64 defect, unfixed on x86_64.
 *
 * Both are addressed here rather than in a second harness: per-road
 * markers on the same rungs, plus a firmware diagnostic channel that
 * gives SeaBIOS somewhere to say `No bootable device.` (it lands at
 * t=1s). The x86_64 lane is also, unlike aarch64, NOT intermittent —
 * those same 19 runs booted in 21-24s against a 300s budget.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { qemuUsbStorageDeviceArg } from "../installer/qemu-usb-storage.ts";

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
// CI runs QEMU 8.2.2 on a 4-vCPU Ampere runner.
//
// TWO instrumented CI runs, and they DISAGREE — which is the finding:
//   job 95208551157: t=1s firmware | t=16s bootloader | t=17s efi-stub
//                    | then NOTHING for 4184s. Never booted.
//   job 95218377728: t=1s firmware | t=16s bootloader | t=17s efi-stub
//                    | login t=192s. BOOTED.
// Same image, same workflow, same runner type. Identical to the EFI stub
// (and identical to the local host); then the SAME segment takes 175s on
// one run and >4184s on the other — a >24x swing.
//
// So the aarch64 TCG lane is INTERMITTENT, not uniformly slow and not
// deterministically broken. That vindicates the original 2026-06-12 note
// this file already carried (two 900s timeouts parked in the EFI stub,
// then the identical commit passed on rerun once the runner pool freed).
// I briefly concluded "deterministic hang" from the single bad run; the
// good run refutes that, and one observation was never enough to support
// it.
//
// The budget stays generous because a good run finishes in ~192s and a
// contended one may legitimately need far more.
const AARCH64_TCG_TIMEOUT_SECONDS = 4200; // 70 min
const POLL_INTERVAL_MS = 1000;
// How long the serial may stay COMPLETELY SILENT past the kernel handoff
// before we stop waiting. This is a cost bound, NOT a diagnosis: it ends
// a futile 70-minute burn early, and it deliberately does not claim to
// know whether the guest is hung or merely starved.
//
// Sizing it honestly against both runs: a healthy CI boot is ~192s END TO
// END, and the bad run emitted nothing for 4184s. 1200s is >6x a whole
// healthy boot, which leaves real room for a contended-but-progressing
// run, while still cutting the wasted budget from 70min to ~20min.
const DEFAULT_STALL_SECONDS = 1200;
const MEMORY_MB = 2048; // installer needs >= 1GB; 2GB gives headroom for nix
const KVM_PATH = "/dev/kvm";

// ── Boot-stage ladder ───────────────────────────────────────────────
// Ordered floor-to-ceiling. `furthestBootStage` reports the highest rung
// whose marker appears, which is what separates "did not boot" from
// "was still booting when the clock ran out".
//
// ── WHY EACH RUNG CARRIES SEVERAL MARKERS (x86_64, 2026-08-16) ──────
// The rungs above were written against the aarch64 boot road — EDK2 →
// GRUB → EFI stub — and THREE OF THE FIVE cannot occur on the x86_64
// road, which is SeaBIOS → ISOLINUX → a BIOS (not EFI) kernel handoff.
// Counted on a REAL, SUCCESSFUL x86_64 CI serial log (run 31975465756
// artifact `qemu-full-install-serial.log`, 170KB):
//
//   "UEFI firmware" ................... 0 occurrences
//   "Booting `NixOS" .................. 0
//   "EFI stub: Exiting boot services" . 0
//   "Welcome to NixOS" ................ 1
//   "login:" .......................... 2
//   "ISOLINUX " ....................... 1   (the real bootloader banner)
//   "Linux version " .................. 1   (the real kernel handoff)
//
// So on x86_64 the ladder could only ever read `none` or `login`, and
// the CI logs confirm it: across NINETEEN consecutive successful runs
// (31964938508 … 31977504172) the harness printed exactly one stage
// line every time — `t=2Ns stage → login`. Never firmware, never
// bootloader, never userspace. The instrument that separates "slow"
// from "broken" on aarch64 was, on x86_64, reading a constant.
//
// The fix is per-road markers on the SAME rungs rather than a second
// harness: the two vocabularies are disjoint (no NixOS x86_64 boot
// prints "UEFI firmware"; no aarch64 EDK2 boot prints "SeaBIOS ("), so
// a rung matching ANY of its markers stays unambiguous and the API
// stays arch-blind.
//
// `efi-stub` was renamed to `kernel`. The rung means "the kernel took
// over from the bootloader", which on aarch64 is the EFI stub exiting
// boot services and on x86_64 BIOS is the kernel's first console line.
// Calling a BIOS boot's rung `efi-stub` would be a false name in every
// CI log line it printed.
export type BootStage =
  | "none"
  | "firmware"
  | "bootloader"
  | "kernel"
  | "userspace"
  | "login";

export const BOOT_STAGE_LADDER: readonly {
  readonly stage: BootStage;
  readonly markers: readonly string[];
}[] = [
  // aarch64: EDK2's banner. x86_64: SeaBIOS's banner — which only
  // reaches us because we now give SeaBIOS a diagnostic channel (see
  // X86_FIRMWARE_DEBUGCON_PORT); by default it talks to the VGA
  // console and the serial log stays empty.
  { stage: "firmware", markers: ["UEFI firmware", "SeaBIOS ("] },
  // aarch64: GRUB. x86_64: ISOLINUX (`ISOLINUX 6.04  Copyright (C) …`
  // is literally the first line of the real x86_64 serial log).
  { stage: "bootloader", markers: ["Booting `NixOS", "ISOLINUX ", "Loading /boot/"] },
  // The kernel has the console.
  { stage: "kernel", markers: ["EFI stub: Exiting boot services", "Linux version "] },
  { stage: "userspace", markers: ["Welcome to NixOS"] },
  { stage: "login", markers: [EXPECTED_LOGIN_PROMPT] },
];

export const BOOT_STAGE_ORDER: readonly BootStage[] = [
  "none",
  ...BOOT_STAGE_LADDER.map((r) => r.stage),
];

/** Highest boot stage evidenced by the serial log. Pure. */
export function furthestBootStage(serial: string): BootStage {
  let reached: BootStage = "none";
  for (const rung of BOOT_STAGE_LADDER) {
    if (rung.markers.some((m) => serial.includes(m))) reached = rung.stage;
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
  // SeaBIOS's TERMINAL verdict, printed only after every boot option has
  // been tried and has failed. Reproduced 2026-08-16 on this machine
  // (QEMU 11.0.1, SeaBIOS rel-1.17.0) with a 4MB /dev/urandom image on
  // the harness's own xhci/usb-storage chain: the line appears at t=1s
  // and QEMU STAYS ALIVE — the x86_64 twin of the EDK2 shell park.
  //
  // NOT a marker, deliberately: "Boot failed:". SeaBIOS prints it once
  // PER REJECTED BOOT CANDIDATE and then goes on to try the next one, so
  // a perfectly healthy boot whose USB device is not the first candidate
  // contains it. Matching on it would fail good images. `detectFailureMarker`
  // has a test pinning exactly that.
  { marker: "No bootable device", meaning: "SeaBIOS exhausted every boot option — no bootable device" },
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

export type BootOutcome = "BOOTED" | "BOOT-FAILED" | "STALLED" | "TIMEOUT";

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
  /**
   * Seconds since the serial log last GREW. Undefined means "not
   * tracked" and disables stall detection.
   */
  readonly secondsSinceSerialGrowth?: number;
  /** Silence threshold; defaults to DEFAULT_STALL_SECONDS. */
  readonly stallSeconds?: number;
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

  // STALL: the guest handed off to the kernel and then emitted nothing
  // for a long time.
  //
  // This is a COST BOUND on a lane measured to be intermittent (see the
  // two disagreeing runs noted at DEFAULT_STALL_SECONDS): one run sat
  // silent for 4184s and never booted, another booted in 192s. Sitting
  // out the full 4200s budget on the bad runs costs 70 minutes of
  // arm-runner time and produces no more information than stopping
  // earlier does.
  //
  // It reports the FACT (silence of N seconds at stage X) and leaves the
  // reading — hung vs starved — to whoever looks. Detection is not a
  // verdict.
  if (
    input.secondsSinceSerialGrowth !== undefined &&
    input.secondsSinceSerialGrowth >= (input.stallSeconds ?? DEFAULT_STALL_SECONDS) &&
    stageAtLeast(stage, "kernel")
  ) {
    return {
      outcome: "STALLED",
      stage,
      // The reference points used to be baked in here as "~192s on a
      // good CI run and ~52s on a local TCG host". Those are the
      // aarch64 TCG numbers, and this classifier is arch-blind — on the
      // x86_64 lane, where a healthy boot is 21-24s, printing them
      // states a measurement that was never taken on that lane. Removed
      // rather than duplicated per-arch: the silence is the fact, and
      // the budget already prints beside it.
      reason:
        `Stalled at stage ${stage} — the serial console produced nothing for ` +
        `${input.secondsSinceSerialGrowth}s after the kernel handoff. ` +
        `This reports the SILENCE, not a diagnosis — the guest may be hung or merely starved ` +
        `of CPU on a contended runner, and this harness cannot tell those apart.`,
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

export function outcomeExitCode(outcome: BootOutcome): 0 | 1 | 3 | 4 {
  if (outcome === "BOOTED") return 0;
  if (outcome === "BOOT-FAILED") return 1;
  if (outcome === "STALLED") return 4;
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

// ── The x86_64 firmware diagnostic channel ──────────────────────────
// SeaBIOS talks to the VGA console, NOT to COM1, so on x86_64 the
// firmware's own verdict never reached the serial log. Measured here
// 2026-08-16 (QEMU 11.0.1, macOS/TCG, the harness's exact xhci
// usb-storage chain, 4MB /dev/urandom image):
//
//   without this channel: serial log = 0 bytes, QEMU still alive at 25s
//   with    this channel: `No bootable device.` in the log at t=1s
//
// That zero-byte log is precisely the aarch64 defect wearing x86_64
// clothes — a broken image and a slow-but-healthy one both present as
// "nothing yet", so only the budget could settle it and the verdict cost
// the whole 300s.
//
// Port 0x402 is QEMU's conventional SeaBIOS debug console. It is chosen
// over the alternative (`-fw_cfg name=etc/sercon-port`, which also works
// — verified) BECAUSE it is a SEPARATE device on a SEPARATE file: the
// guest's own UART is left byte-for-byte as it was, so the healthy boot
// path — a blocking CI gate that has passed 19 consecutive runs — cannot
// be perturbed by this instrument. Measuring must not move the thing
// measured.
export const X86_FIRMWARE_DEBUGCON_PORT = "0x402";
const X86_FIRMWARE_CHARDEV_ID = "zetafwlog";

/** Pure arg construction — no filesystem probing, so it is testable. */
export function buildQemuArgsPure(
  arch: Arch,
  bootMedia: BootMedia,
  serialLogPath: string,
  host: HostCapabilities,
  firmwareLogPath?: string,
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

  if (firmwareLogPath !== undefined) {
    args.push(
      "-chardev",
      `file,id=${X86_FIRMWARE_CHARDEV_ID},path=${firmwareLogPath}`,
      "-device",
      `isa-debugcon,iobase=${X86_FIRMWARE_DEBUGCON_PORT},chardev=${X86_FIRMWARE_CHARDEV_ID}`,
    );
  }

  if (bootMedia.kind === "usb-image") {
    const usb = qemuUsbStorageDeviceArg("zflashboot");
    if (!usb.ok) {
      throw new Error(usb.error);
    }
    args.push(
      "-drive",
      `file=${bootMedia.path},if=none,format=raw,readonly=on,id=zflashboot`,
      "-device",
      "qemu-xhci,id=xhci",
      "-device",
      usb.device,
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
  readonly firmwareTail: string;
  readonly firmwareBytes: number;
  readonly elapsedSeconds: number;
}

/**
 * The firmware channel is a SEPARATE file, so classification reads the
 * union of the two transcripts. Both are append-only text and the
 * classifier only ever asks `includes`, so concatenation order carries
 * no meaning and cannot create a marker that neither file contained.
 */
export function combineTranscripts(serial: string, firmware: string): string {
  return firmware.length === 0 ? serial : `${firmware}\n${serial}`;
}

async function watchBoot(
  serialLogPath: string,
  firmwareLogPath: string | undefined,
  timeoutSeconds: number,
  stallSeconds: number,
  qemuState: () => { exited: boolean; exitCode: number | null },
): Promise<WatchResult> {
  const started = Date.now();
  const deadline = started + timeoutSeconds * 1000;
  const elapsed = () => Math.round((Date.now() - started) / 1000);

  // Live stage ladder: the CI log then SHOWS where the time went, which
  // is the difference between "we know the budget is too small" and
  // "we guessed the budget was too small".
  let announced: BootStage = "none";

  const readFile = (path: string | undefined): string => {
    if (path === undefined || !existsSync(path)) return "";
    try {
      return readFileSync(path, "utf8");
    } catch {
      return ""; // log in transit; retry on next poll
    }
  };

  // Serial-growth tracking, for stall detection.
  let lastSerialLength = -1;
  let lastGrowthAt = started;
  let lastFirmware = "";
  let lastSerialOnly = "";

  for (;;) {
    const serialOnly = readFile(serialLogPath);
    const firmware = readFile(firmwareLogPath);
    lastFirmware = firmware;
    lastSerialOnly = serialOnly;
    const serial = combineTranscripts(serialOnly, firmware);
    const q = qemuState();
    const deadlineReached = Date.now() >= deadline;

    if (serial.length !== lastSerialLength) {
      lastSerialLength = serial.length;
      lastGrowthAt = Date.now();
    }
    const secondsSinceSerialGrowth = Math.round((Date.now() - lastGrowthAt) / 1000);

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
      secondsSinceSerialGrowth,
      stallSeconds,
    });

    const settled =
      classification.outcome === "BOOTED" ||
      classification.outcome === "BOOT-FAILED" ||
      classification.outcome === "STALLED" ||
      deadlineReached;

    if (settled) {
      return {
        ...classification,
        serialTail:
          lastSerialOnly.length > 0
            ? lastSerialOnly.slice(-2000)
            : "(serial log empty or never created)",
        firmwareTail:
          lastFirmware.length > 0
            ? lastFirmware.slice(-1200)
            : "(no firmware transcript — channel absent, or the firmware wrote nothing)",
        firmwareBytes: lastFirmware.length,
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

  const stallFlag = argv.indexOf("--stall-seconds");
  let stallSeconds = DEFAULT_STALL_SECONDS;
  if (stallFlag >= 0) {
    const v = Number(argv[stallFlag + 1]);
    if (!Number.isFinite(v) || v <= 0) usage();
    stallSeconds = v;
    argv.splice(stallFlag, 2);
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
  // aarch64's EDK2 already speaks on the PL011 the guest uses, so it
  // needs no side channel; x86_64's SeaBIOS does not (see
  // X86_FIRMWARE_DEBUGCON_PORT).
  const firmwareLogPath = arch === "x86_64" ? join(tmpDir, "firmware.log") : undefined;

  const host = probeHost(arch);
  const timeoutSeconds = timeoutOverride ?? timeoutSecondsFor(arch, host);

  if (arch === "aarch64" && !(host.kvmAvailable && host.hostArch === "arm64")) {
    console.warn(`[qemu-boot-test] aarch64 without same-arch KVM; using TCG (will be slow)`);
  } else if (arch === "x86_64" && !host.kvmAvailable) {
    console.warn(`[qemu-boot-test] ${KVM_PATH} not available; using TCG emulation (will be slow)`);
  }

  console.log(`[qemu-boot-test] Boot media: ${bootMedia.kind} ${bootMedia.path}`);
  console.log(`[qemu-boot-test] Serial log: ${serialLogPath}`);
  if (firmwareLogPath !== undefined) {
    console.log(`[qemu-boot-test] Firmware log (debugcon ${X86_FIRMWARE_DEBUGCON_PORT}): ${firmwareLogPath}`);
  }
  console.log(`[qemu-boot-test] Memory: ${MEMORY_MB}MB; timeout: ${timeoutSeconds}s; stall-after: ${stallSeconds}s`);
  console.log(`[qemu-boot-test] Expecting login prompt: "${EXPECTED_LOGIN_PROMPT}"`);
  console.log(`[qemu-boot-test] Arch: ${arch}`);

  let qemuArgs: string[];
  try {
    qemuArgs = buildQemuArgsPure(arch, bootMedia, serialLogPath, host, firmwareLogPath);
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

  const result = await watchBoot(
    serialLogPath,
    firmwareLogPath,
    timeoutSeconds,
    stallSeconds,
    () => ({ exited: qemuExited, exitCode: qemuExitCode }),
  );

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
  if (firmwareLogPath !== undefined) {
    // Printed ALWAYS, including on success, and including when it is 0.
    // A diagnostic channel that silently produces nothing is worse than
    // no channel: it degrades the harness back to the budget-only verdict
    // while still reading as instrumented. A zero here is the signal that
    // this runner's SeaBIOS was built without debug output.
    console.log(`Firmware transcript: ${result.firmwareBytes} bytes`);
  }
  console.log("");
  console.log("=== Serial log tail ===");
  console.log(result.serialTail);
  if (firmwareLogPath !== undefined && result.outcome !== "BOOTED") {
    console.log("");
    console.log("=== Firmware transcript tail (SeaBIOS) ===");
    console.log(result.firmwareTail);
  }

  process.exit(exitCode);
}

if (import.meta.main) {
  void main();
}
