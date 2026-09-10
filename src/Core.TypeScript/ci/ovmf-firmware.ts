#!/usr/bin/env bun
// ovmf-firmware.ts -- ONE resolver for UEFI firmware, because two launchers with two
// answers is how scenarios 3 and 4 came to boot legacy BIOS for months.
//
// THE DEFECT THIS FILE EXISTS TO CLOSE (081M24BB3TD087G0R001PJTW9A, measured on dispatch
// run 34410308790, 2026-09-09/10). The zflash harness had TWO QEMU launchers:
//
//   * ci/qemu-full-install-test.ts -- resolved OVMF, passed `-drive if=pflash`, UEFI boot.
//     Scenario 2 delegates here, and scenario 2 passed.
//   * zflash/test-harness/qemu-state.ts buildQemuSystemBootArgs -- `-machine q35` and NO
//     pflash of any kind, so QEMU fell back to its built-in SeaBIOS. Scenarios 3, 4 and
//     every other non-`boot-cluster-up` scenario went through here.
//
// The installer then did exactly the right thing and refused:
//
//   ERROR: not booted in UEFI mode (/sys/firmware/efi absent). This ISO is hybrid, so it
//   will boot in legacy/CSM and then fail at bootloader install AFTER the disk has been
//   wiped.
//
// So the guest booted, ran discovery, probed the disks, ran the 60-second countdown, and
// stopped at a fail-closed guard -- while the harness waited out a 30-minute timeout for
// a marker that could never arrive. Two scenarios, ~60 runner-minutes per dispatch, spent
// proving a determined failure.
//
// WHY A SHARED MODULE RATHER THAN A SECOND COPY. The bug was not a wrong value; it was a
// MISSING one, in the launcher that did not have the code. Copying the resolver into
// qemu-state.ts would fix today's instance and rebuild the exact condition that produced
// it -- two implementations that can drift apart silently. One resolver, two importers.
//
// FIRMWARE IS A REQUIRED, EXPLICIT INPUT. `QemuSystemBootArgsInput.uefiFirmware` has no
// default, and the legacy variant is spelled `legacy-bios-no-uefi` with a mandatory
// `reason`. That is deliberate: the whole defect was that legacy BIOS was reachable by
// SAYING NOTHING. A caller may still choose it -- the boot-discriminator self-test boots
// synthetic marker images that never touch UEFI -- but it must now say so out loud, in
// writing, at the call site.
//
// PER-VM WRITABLE VARS, and this is the real design decision. OVMF needs a WRITABLE
// NVRAM image (`OVMF_VARS.fd`); the distro ships a read-only template. multi-vm.ts boots
// more than one guest, so a single shared copy would put two firmwares on one NVRAM file
// and let boot entries written by one guest appear in the other. `prepareWritableOvmfVars`
// therefore takes a caller-chosen file name and every VM gets its own, keyed by VM id.
//
// Disciplines: pure arg construction (`buildOvmfPflashArgs`) is separated from filesystem
// probing (`resolveOvmfFirmware`) and copying (`prepareWritableOvmfVars`), so the args are
// unit-testable with no OVMF installed -- Section 13, one declared door for the effect.

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * Search order for the distro OVMF images. Exported so a test can assert the roster is
 * non-empty and that every entry names BOTH halves -- a candidate with a code image and
 * no vars template would resolve and then fail at `cp`.
 */
export const OVMF_FIRMWARE_CANDIDATES = [
  // Ubuntu 24.04+ / Debian 12+ (2MB images removed from the ovmf package)
  { code: "/usr/share/OVMF/OVMF_CODE_4M.fd", vars: "/usr/share/OVMF/OVMF_VARS_4M.fd" },
  { code: "/usr/share/qemu/OVMF_CODE_4M.fd", vars: "/usr/share/qemu/OVMF_VARS_4M.fd" },
  // Legacy 2MB images (older distros)
  { code: "/usr/share/OVMF/OVMF_CODE.fd", vars: "/usr/share/OVMF/OVMF_VARS.fd" },
  { code: "/usr/share/qemu/OVMF_CODE.fd", vars: "/usr/share/qemu/OVMF_VARS.fd" },
] as const;

export interface ResolvedOvmfFirmware {
  readonly code: string;
  readonly varsTemplate: string;
}

/**
 * The firmware a QEMU guest boots. There is no default and no optional field: the defect
 * this module closes was legacy BIOS being reachable by omission.
 */
export type QemuUefiFirmware =
  | {
      readonly kind: "ovmf";
      /** Read-only OVMF_CODE image. */
      readonly codePath: string;
      /** WRITABLE per-VM NVRAM copy -- never the distro template. */
      readonly varsPath: string;
    }
  | {
      readonly kind: "legacy-bios-no-uefi";
      /**
       * Why this guest may boot without UEFI. Required, and required to be non-empty:
       * a legacy boot with no stated reason is the condition that produced
       * 081M24BB3TD087G0R001PJTW9A.
       */
      readonly reason: string;
    };

/** Probe the filesystem for a usable OVMF pair. `null` when none is installed. */
export function resolveOvmfFirmware(): ResolvedOvmfFirmware | null {
  for (const candidate of OVMF_FIRMWARE_CANDIDATES) {
    if (existsSync(candidate.code) && existsSync(candidate.vars)) {
      return { code: candidate.code, varsTemplate: candidate.vars };
    }
  }
  return null;
}

/**
 * Copy the read-only NVRAM template to a writable per-VM path.
 *
 * `fileName` is caller-chosen and MUST be unique per guest. multi-vm.ts boots several
 * VMs at once; one shared NVRAM file would let boot entries written by one firmware show
 * up in another, which is a cross-VM channel nobody declared.
 */
export function prepareWritableOvmfVars(tmpDir: string, varsTemplate: string, fileName = "OVMF_VARS.fd"): string {
  const varsPath = join(tmpDir, fileName);
  execFileSync("cp", [varsTemplate, varsPath]);
  return varsPath;
}

/**
 * The pflash argument pair, as pure data. Unit-testable with no OVMF installed, which is
 * the point: the arg SHAPE is what regressed, and asserting it must not require the
 * firmware to be present on the machine running the test.
 *
 * Legacy returns an empty list -- QEMU then uses its built-in SeaBIOS. That is the
 * historical behaviour, now reachable only by naming it.
 */
export function buildOvmfPflashArgs(firmware: QemuUefiFirmware): readonly string[] {
  if (firmware.kind === "legacy-bios-no-uefi") return [];
  return [
    "-drive",
    `if=pflash,format=raw,unit=0,readonly=on,file=${firmware.codePath}`,
    "-drive",
    `if=pflash,format=raw,unit=1,file=${firmware.varsPath}`,
  ];
}

/**
 * Resolve firmware for a guest that MUST boot UEFI, preparing its own NVRAM copy.
 * Throws rather than silently degrading to legacy: a UEFI installer booted on SeaBIOS
 * does not fail fast, it wipes the disk and then fails, which is strictly worse than
 * not starting.
 */
export function requireOvmfForGuest(tmpDir: string, varsFileName: string): QemuUefiFirmware {
  const resolved = resolveOvmfFirmware();
  if (resolved === null) {
    throw new Error(
      "OVMF firmware not found; install via `apt-get install -y ovmf`. Refusing to fall " +
        "back to SeaBIOS: this ISO is hybrid, so a legacy boot would WIPE THE DISK and " +
        "only then fail at bootloader install (081M24BB3TD087G0R001PJTW9A).",
    );
  }
  return {
    kind: "ovmf",
    codePath: resolved.code,
    varsPath: prepareWritableOvmfVars(tmpDir, resolved.varsTemplate, varsFileName),
  };
}

/**
 * Firmware for a PLAN that may never be executed.
 *
 * `requireOvmfForGuest` throws when OVMF is absent, which is right before a boot and
 * WRONG at plan time: the harness plans on a maintainer's macOS laptop and in
 * `zflash-harness-lint`, where no OVMF exists and nothing is going to boot. Making the
 * planner throw would turn a dry run into an error about a package it does not need --
 * and `zflash-harness-lint` asserts the fail-closed REFUSAL on every PR, so it would
 * have broken a green lane to fix a red one.
 *
 * So: when OVMF is installed, this behaves exactly like `requireOvmfForGuest` (resolved
 * template, per-VM writable copy). When it is not, it names the CANONICAL Ubuntu 24.04
 * pair -- the runner's real paths -- and copies nothing. The plan is data either way; the
 * executor calls `requireOvmfForGuest` before it spawns anything, so a genuinely missing
 * OVMF still fails loudly at the only moment it matters.
 */
export function ovmfForPlanning(tmpDir: string, varsFileName: string): QemuUefiFirmware {
  const resolved = resolveOvmfFirmware();
  if (resolved !== null) return requireOvmfForGuest(tmpDir, varsFileName);
  const canonical = OVMF_FIRMWARE_CANDIDATES[0];
  return { kind: "ovmf", codePath: canonical.code, varsPath: join(tmpDir, varsFileName) };
}
