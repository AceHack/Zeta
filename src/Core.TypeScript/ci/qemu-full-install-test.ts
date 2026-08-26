#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ci/qemu-full-install-test.ts
 *
 * QEMU full-install test (081KSGS9H0008QG0R0011BC7T2 Slice 1) for the canonical Zeta installer ISO.
 *
 * Phase 1 — boot installer ISO (or zflash USB image when QEMU_WIFI_ESP_PHASE1=1
 * or QEMU_USB_ISERIAL_PHASE1=1 or QEMU_UEFI_KEYFILE_PHASE1=1 or
 * QEMU_UEFI_KEYFILE_PICKER=1 or QEMU_UEFI_KEYFILE_RESTORE=1) + virtual disk; wait for install completion.
 * Phase 2 — boot installed disk only; verify login banner (+ optional phase-3
 * first-session serial markers when QEMU_FIRST_SESSION_PHASE3=1; + optional
 * UEFI keyfile restore decrypt when QEMU_UEFI_KEYFILE_RESTORE=1).
 * Phase 1 also asserts iter-5.4.1-ci dry-run registration (081KSGS9H0008QG0R0011BC7T2 slice 2)
 * and tree-path coherence (081KSGS9H0008QG0R0011BC7T2 slice 3).
 * Opt-in QEMU_WIFI_ESP_PHASE1=1 bakes zeta-wifi-credentials.json onto a
 * file-backed zflash image and asserts ESP→NM serial markers (no radio claim).
 * Opt-in QEMU_USB_ISERIAL_PHASE1=1 (also implied by wifi ESP USB boot) asserts
 * guest sysfs iSerial markers from zeta-install.sh 6.95d. Opt-in
 * QEMU_UEFI_KEYFILE_PHASE1=1 bakes `/zeta-bind-uefi-keyfile` and asserts the
 * install-time keyfile write (not restore decrypt). QEMU_UEFI_KEYFILE_PICKER=1
 * also bakes `/zeta-qemu-creds-passphrase` so 6.95-picker binds the blob —
 * the restore-decrypt precondition, not phase-2 decrypt. Opt-in
 * QEMU_UEFI_KEYFILE_RESTORE=1 (dedicated; not implied by PICKER) injects the
 * QEMU test passphrase via `-fw_cfg file=` on disk boot and asserts restore
 * decrypt against the UEFI keyfile. The secret is not copied onto the
 * installed ESP. ISO/cdrom cascade-5
 * has no usb-storage serial=.
 * Not on gate.
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
import { existsSync, mkdtempSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertUsbISerialGuestSerial,
  assertWifiEspInstallSerial,
  serialFirstBootInProgress,
} from "../zflash/test-harness/serial-markers";
import {
  DEFAULT_QEMU_PASSPHRASE,
  DEFAULT_QEMU_WIFI_PASSWORD,
  DEFAULT_QEMU_WIFI_SSID,
  prepareBootImage,
} from "../zflash/test-harness/prepare-boot-image";
import { validateSelfRegCiCoherent } from "./self-reg-serial.ts";
import { QEMU_USB_TEST_SERIAL, qemuUsbStorageDeviceArg } from "../installer/qemu-usb-storage.ts";
import { UEFI_KEYFILE_SERIAL } from "../installer/uefi-keyfile-esp.ts";
import { USB_ISERIAL_SERIAL } from "../installer/usb-iserial-probe.ts";
import { firstSessionPhase3Enabled, phase3BootMarkersSatisfied } from "./qemu-first-session-phase3.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TEST_INFRA_PUBKEY = resolve(REPO_ROOT, "src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub");

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
export const PHASE2_SERIAL_SEPARATOR = "\n\n=== PHASE 2: boot installed disk (no ISO) ===\n\n";

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

/** Canonical on-node unique hostname shape from zeta-install.sh iter-5.2.2. */
export const NODE_HEX_HOSTNAME_RE = /^node-[0-9a-f]{6}$/;

/**
 * Software-only uniqueness contract for Bug 1 (081KSGS9H0008QG0R00120EEHM):
 * when install serial shows a generated `node-<6hex>`, phase-2 login must use
 * that hostname — never the flake default `control-plane`.
 */
export function assertGeneratedNodeHostnameContract(
  phase1Serial: string,
  phase2Serial: string,
): { readonly ok: true; readonly hostname: string } | { readonly ok: false; readonly reason: string } {
  const generated = extractGeneratedHostname(phase1Serial);
  if (!generated) {
    return { ok: false, reason: "phase 1 serial missing [iter-5.2.2] generated hostname" };
  }
  if (!NODE_HEX_HOSTNAME_RE.test(generated)) {
    return {
      ok: false,
      reason: `generated hostname "${generated}" is not node-<6hex> (expected /^node-[0-9a-f]{6}$/)`,
    };
  }
  const unexpected = detectUnexpectedControlPlaneLogin(phase2Serial, generated);
  if (unexpected) {
    return { ok: false, reason: unexpected };
  }
  const login = detectInstalledLoginPrompt(phase2Serial, generated);
  if (!login.ok) {
    return {
      ok: false,
      reason: `phase 2 serial missing login prompt for generated hostname "${generated}"`,
    };
  }
  return { ok: true, hostname: generated };
}

/** Opt-in ESP wifi acceptance gate (no radio association claim). */
export function wifiEspPhase1Enabled(): boolean {
  return process.env.QEMU_WIFI_ESP_PHASE1 === "1";
}

/**
 * Opt-in guest USB iSerial assertion. Dedicated flag, or implied by wifi ESP
 * because that path already boots `usb-storage,serial=ZETA-QEMU-001`.
 * ISO/cdrom cascade-5 has no USB serial — do not assert there.
 */
export function usbISerialGuestEnabled(): boolean {
  return process.env.QEMU_USB_ISERIAL_PHASE1 === "1" || wifiEspPhase1Enabled();
}

/** Opt-in guest UEFI keyfile write. Dedicated flag — not implied by wifi/iSerial. */
export function uefiKeyfilePhase1Enabled(): boolean {
  return process.env.QEMU_UEFI_KEYFILE_PHASE1 === "1" || uefiKeyfilePickerEnabled();
}

/**
 * Opt-in 6.95-picker bind of the cred blob to the UEFI keyfile. Dedicated
 * flag — not implied by QEMU_UEFI_KEYFILE_PHASE1 (write-only stays
 * write-only). Bakes `/zeta-qemu-creds-passphrase`.
 */
export function uefiKeyfilePickerEnabled(): boolean {
  return process.env.QEMU_UEFI_KEYFILE_PICKER === "1" || uefiKeyfileRestoreEnabled();
}

/**
 * Opt-in phase-2 restore decrypt against the UEFI keyfile. Dedicated flag —
 * not implied by QEMU_UEFI_KEYFILE_PICKER (picker bind stays picker-only).
 * Injects `-fw_cfg name=opt/org.zeta/creds-passphrase,file=` on disk boot.
 */
export function uefiKeyfileRestoreEnabled(): boolean {
  return process.env.QEMU_UEFI_KEYFILE_RESTORE === "1";
}

/** QEMU fw_cfg name. Guest sysfs: /sys/firmware/qemu_fw_cfg/by_name/<name>/raw */
export const QEMU_CREDS_PASSPHRASE_FWCFG_NAME = "opt/org.zeta/creds-passphrase";

/** Serial markers from zeta-creds-restore.nix. Never include the passphrase. */
export const UEFI_KEYFILE_RESTORE_SERIAL = {
  stagedFromFwcfg: "zeta-creds-restore: passphrase staged from qemu fw_cfg",
  /**
   * 081M0WS33AK087G0R000BG9R8X -- the transport the restore actually used, on
   * the success line rather than inferred from a staging line.
   *
   * `fw_cfg` DOES NOT EXIST ON METAL. On hardware zeta-creds-restore.nix falls
   * back to systemd-ask-password on tty1, which nothing in this harness can
   * exercise. So a green run of this contract proves the DECRYPT and the
   * BINDING, and proves nothing whatever about the metal passphrase path. The
   * marker below is asserted precisely so that green cannot be quoted as metal
   * evidence: it carries `metal-capable=no` in the same line as the success.
   */
  transportFwcfgNotMetal:
    "zeta-creds-restore: passphrase transport=qemu-fw_cfg metal-capable=no",
  /** The metal transport. Asserted ABSENT here -- QEMU must not claim it. */
  transportInteractive:
    "zeta-creds-restore: passphrase transport=interactive-ask-password metal-capable=yes",
  bindingKeyfile: "zeta-creds-restore: binding-factor uefiKeyfile (ESP file; not copied to /etc)",
  wrotePrefix: "zeta-creds-restore: wrote ",
  alreadyPresent: "zeta-creds-restore: already-present, skipping credential rewrite",
  missingKeyfile: "zeta-creds-restore: uefiKeyfile recorded but ESP keyfile missing",
  uuidBinding: "zeta-creds-restore: binding-factor usbUuid (default)",
  /**
   * Unconditional FIRST line of the unit's ExecStart (081M0WTB5MN). Its presence
   * proves ExecStart ran at all; its ABSENCE on the phase-2 slice means the unit
   * failed BEFORE ExecStart (WorkingDirectory chdir / User / Environment), which
   * no in-ExecStart logging can catch. Distinguishes a pre-ExecStart start
   * failure from a precondition exit.
   */
  execStartEntered: "zeta-creds-restore: ExecStart entered",
  /**
   * Emitted once per absent precondition by the unit's ExecStart (081M0WTB5MN),
   * naming the exact missing path — the ESP blob, /etc/zeta/usb-uuid, the cloned
   * restore CLI, or the mise bun shim — instead of skipping the unit silently.
   * See `missingRestorePreconditions`.
   */
  missingPrecondition: "zeta-creds-restore: MISSING precondition",
  /**
   * Emitted unconditionally by the unit's ExecStart, immediately after the
   * precondition gate + optional fw_cfg block (`zeta-creds-restore.nix`). Its
   * ABSENCE therefore means the ExecStart body never ran at all — see
   * `restoreServiceNeverRan`.
   */
  readingBlob: "zeta-creds-restore: reading preserved ESP blob",
} as const;

/**
 * `zeta.credsRestore`'s unit checks FOUR preconditions
 * (`zeta-creds-restore.nix`): the ESP blob, the recorded USB UUID, the restore
 * CLI inside the cloned repo, and the zeta user's mise `bun` shim.
 *
 * These used to be a `unitConfig.ConditionPathExists`, so when any was absent
 * systemd SKIPPED the unit with ZERO serial output — run 32816110015 booted to
 * a login prompt with not one `zeta-creds-restore:` line, and the contract could
 * only report "fw_cfg staging marker missing", which reads as a fw_cfg bug and
 * is not one. 081M0WTB5MN moved the checks into `ExecStart`, which now logs
 * `MISSING precondition <path>` for each absent one — so the exact gap is named
 * (see `missingRestorePreconditions`), not guessed.
 *
 * This predicate survives for the residual case: a serial with NO
 * `zeta-creds-restore` line at all now means the unit did not start (e.g.
 * `zeta.credsRestore.enable` off, or a start failure before ExecStart) — a
 * stronger, rarer condition than a precondition miss.
 */
export function restoreServiceNeverRan(phase2Serial: string): boolean {
  return !phase2Serial.includes("zeta-creds-restore");
}

/**
 * Preconditions the unit named as MISSING on serial (081M0WTB5MN), in order.
 * Each is one of `RESTORE_UNIT_CONDITION_PATHS`. Empty when the unit ran with
 * all preconditions present (the happy path) or did not run at all.
 */
export function missingRestorePreconditions(phase2Serial: string): readonly string[] {
  const out: string[] = [];
  const re = /zeta-creds-restore: MISSING precondition (\S+); skipping restore/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(phase2Serial)) !== null) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/**
 * The four precondition paths, verbatim from zeta-creds-restore.nix defaults.
 * Now checked inside the unit's `ExecStart` (081M0WTB5MN), not
 * `unitConfig.ConditionPathExists`.
 */
export const RESTORE_UNIT_CONDITION_PATHS = [
  "/boot/zeta-creds.enc",
  "/etc/zeta/usb-uuid",
  "/home/zeta/Zeta/src/Core.TypeScript/installer/zeta-creds-restore.ts",
  "/home/zeta/.local/share/mise/shims/bun",
] as const;

/**
 * When USB boot is on, phase-1 serial must show found + serial=ZETA-QEMU-001
 * + no-metal-claim from zeta-install.sh 6.95d, and persist-default remains
 * FAT UUID (ZETA_BIND_USB_ISERIAL and ZETA_BIND_UEFI_KEYFILE are off on this
 * gate). Live QEMU only sees this after the ISO/clone carries 6.95d;
 * helper-unavailable is a fail, not a skip.
 */
export function assertUsbISerialPhase1Contract(phase1Serial: string):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  const result = assertUsbISerialGuestSerial(phase1Serial, QEMU_USB_TEST_SERIAL);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  if (phase1Serial.includes(USB_ISERIAL_SERIAL.persistOptInIserial)) {
    return {
      ok: false,
      reason:
        "usb iSerial persist-opt-in appeared on the default QEMU phase-1 path; " +
        "FAT UUID must remain the persist factor unless ZETA_BIND_USB_ISERIAL=1",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.espFound)) {
    return {
      ok: false,
      reason:
        "UEFI keyfile ESP bind marker appeared on the default QEMU phase-1 path; " +
        "wifi/iSerial USB bake must not write /zeta-bind-uefi-keyfile",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.persistOptInKeyfile)) {
    return {
      ok: false,
      reason:
        "UEFI keyfile persist-opt-in appeared on the default QEMU phase-1 path; " +
        "FAT UUID must remain the persist factor unless ZETA_BIND_UEFI_KEYFILE=1",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseFound)) {
    return {
      ok: false,
      reason:
        "QEMU cred passphrase ESP file appeared on the default QEMU phase-1 path; " +
        "wifi/iSerial USB bake must not write /zeta-qemu-creds-passphrase",
    };
  }
  if (!phase1Serial.includes(USB_ISERIAL_SERIAL.persistDefaultUuid)) {
    return {
      ok: false,
      reason:
        `usb iSerial persist-default marker missing ("${USB_ISERIAL_SERIAL.persistDefaultUuid}"). ` +
        "QEMU phase-1 must keep FAT UUID persist unless ZETA_BIND_USB_ISERIAL=1 is set.",
    };
  }
  return { ok: true };
}

/**
 * When QEMU_UEFI_KEYFILE_PHASE1=1, phase-1 serial must show the ESP marker,
 * the persist-opt-in write, and no-metal-claim. Does not prove restore
 * decrypt: write-only does not bake `/zeta-qemu-creds-passphrase`, so the
 * picker never binds the blob. Passphrase-ESP found is a fail here (that
 * belongs on QEMU_UEFI_KEYFILE_PICKER). Helper-unavailable is a fail, not a skip.
 */
export function assertUefiKeyfilePhase1Contract(
  phase1Serial: string,
  options: { readonly allowPassphraseEsp?: boolean } = {},
):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  if (phase1Serial.includes(USB_ISERIAL_SERIAL.persistOptInIserial)) {
    return {
      ok: false,
      reason:
        "usb iSerial persist-opt-in appeared on the UEFI keyfile QEMU path; " +
        "the two opt-ins are mutually exclusive",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.persistBothOptInsUuid)) {
    return {
      ok: false,
      reason: "both bind opt-ins were set; keyfile write stayed UUID instead of binding",
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.espFound)) {
    return {
      ok: false,
      reason:
        `UEFI keyfile ESP marker missing ("${UEFI_KEYFILE_SERIAL.espFound}"). ` +
        "QEMU_UEFI_KEYFILE_PHASE1 must bake /zeta-bind-uefi-keyfile onto the USB image.",
    };
  }
  if (
    phase1Serial.includes(UEFI_KEYFILE_SERIAL.helperUnavailable) ||
    phase1Serial.includes(UEFI_KEYFILE_SERIAL.helperAbsent)
  ) {
    return {
      ok: false,
      reason:
        "UEFI keyfile write helper was unavailable; that is a fail, not a skip, " + "on QEMU_UEFI_KEYFILE_PHASE1.",
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.persistOptInKeyfile)) {
    return {
      ok: false,
      reason: `UEFI keyfile persist-opt-in marker missing ("${UEFI_KEYFILE_SERIAL.persistOptInKeyfile}").`,
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.wrote)) {
    return {
      ok: false,
      reason: `UEFI keyfile write marker missing ("${UEFI_KEYFILE_SERIAL.wrote}").`,
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.noMetalClaim)) {
    return {
      ok: false,
      reason: `UEFI keyfile no-metal-claim marker missing ("${UEFI_KEYFILE_SERIAL.noMetalClaim}").`,
    };
  }
  if (!options.allowPassphraseEsp && phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseFound)) {
    return {
      ok: false,
      reason:
        "QEMU cred passphrase ESP file appeared on the write-only UEFI keyfile path; " +
        "QEMU_UEFI_KEYFILE_PHASE1 must not bake /zeta-qemu-creds-passphrase " +
        "(use QEMU_UEFI_KEYFILE_PICKER=1 for picker bind)",
    };
  }
  return { ok: true };
}

/**
 * When QEMU_UEFI_KEYFILE_PICKER=1, phase-1 must satisfy the write contract
 * AND run 6.95-picker bound to `--uefi-keyfile`. Does not prove phase-2
 * restore decrypt (passphraseMode=file + /run staging). No metal claim.
 */
export function assertUefiKeyfilePickerContract(phase1Serial: string):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  const write = assertUefiKeyfilePhase1Contract(phase1Serial, { allowPassphraseEsp: true });
  if (!write.ok) {
    return write;
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseFound)) {
    return {
      ok: false,
      reason:
        `QEMU cred passphrase ESP marker missing ("${UEFI_KEYFILE_SERIAL.espPassphraseFound}"). ` +
        "QEMU_UEFI_KEYFILE_PICKER must bake /zeta-qemu-creds-passphrase onto the USB image.",
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseEmpty)) {
    return {
      ok: false,
      reason: "QEMU cred passphrase ESP file was empty; picker cannot bind the blob.",
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.espPassphraseCaptured)) {
    return {
      ok: false,
      reason: `QEMU cred passphrase capture marker missing ("${UEFI_KEYFILE_SERIAL.espPassphraseCaptured}").`,
    };
  }
  if (phase1Serial.includes(UEFI_KEYFILE_SERIAL.pickerSkipped)) {
    return {
      ok: false,
      reason: "6.95-picker was skipped; QEMU_UEFI_KEYFILE_PICKER must bind the blob.",
    };
  }
  if (!phase1Serial.includes(UEFI_KEYFILE_SERIAL.pickerBoundKeyfile)) {
    return {
      ok: false,
      reason: `6.95-picker did not bind --uefi-keyfile ("${UEFI_KEYFILE_SERIAL.pickerBoundKeyfile}").`,
    };
  }
  if (phase1Serial.includes(DEFAULT_QEMU_PASSPHRASE)) {
    return {
      ok: false,
      reason: "UEFI keyfile picker serial leaked QEMU test cred passphrase (must stay redacted)",
    };
  }
  return { ok: true };
}

/**
 * When QEMU_UEFI_KEYFILE_RESTORE=1, phase-2 serial must show fw_cfg staging
 * + uefiKeyfile bind + restore wrote/already-present. Does not persist the
 * QEMU passphrase onto the installed ESP. No metal claim.
 */
export function assertUefiKeyfileRestoreContract(phase2Serial: string):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  const missingPreconditions = missingRestorePreconditions(phase2Serial);
  if (missingPreconditions.length > 0) {
    return {
      ok: false,
      reason:
        "zeta-creds-restore skipped — missing precondition(s) on the installed guest: " +
        `${missingPreconditions.join(", ")}. The unit named them on serial (081M0WTB5MN); ` +
        "fix the producer for that path — ESP blob delivery (/mnt/boot→/boot), " +
        "/etc/zeta/usb-uuid, the cloned restore CLI, or the mise bun shim.",
    };
  }
  if (restoreServiceNeverRan(phase2Serial)) {
    return {
      ok: false,
      reason:
        "zeta-creds-restore.service never ran — phase-2 serial carries no " +
        "'zeta-creds-restore' line at all. With preconditions now checked inside " +
        "ExecStart (they log 'MISSING precondition <path>' when absent, 081M0WTB5MN), " +
        "a blank serial means the unit did not start: zeta.credsRestore.enable is off, " +
        "or it failed before ExecStart.",
    };
  }
  if (!phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg)) {
    return {
      ok: false,
      reason:
        `UEFI keyfile restore fw_cfg staging marker missing ("${UEFI_KEYFILE_RESTORE_SERIAL.stagedFromFwcfg}").`,
    };
  }
  if (phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.missingKeyfile)) {
    return {
      ok: false,
      reason: "UEFI keyfile restore aborted: ESP keyfile missing (must not fall back to UUID).",
    };
  }
  if (phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.uuidBinding)) {
    return {
      ok: false,
      reason: "UEFI keyfile restore used usbUuid; sidecar must say uefiKeyfile.",
    };
  }
  if (!phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile)) {
    return {
      ok: false,
      reason: `UEFI keyfile restore bind marker missing ("${UEFI_KEYFILE_RESTORE_SERIAL.bindingKeyfile}").`,
    };
  }
  // 081M0WS33AK087G0R000BG9R8X: the run must SAY which transport it proved.
  // Without this, "wrote N credentials" on the serial reads identically whether
  // the passphrase came from the hypervisor or from a human at tty1, and the
  // hypervisor one is the only one this lane can ever produce.
  if (!phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal)) {
    return {
      ok: false,
      reason:
        "restore did not declare its passphrase transport " +
        `("${UEFI_KEYFILE_RESTORE_SERIAL.transportFwcfgNotMetal}"). A restore that does not name ` +
        "its transport reads as a metal proof it is not.",
    };
  }
  if (phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.transportInteractive)) {
    return {
      ok: false,
      reason:
        "restore claimed the INTERACTIVE (metal-capable) transport inside QEMU. " +
        "fw_cfg staging must never be reported as the systemd-ask-password path.",
    };
  }
  const wrote =
    phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix) ||
    phase2Serial.includes(UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent);
  if (!wrote) {
    return {
      ok: false,
      reason:
        `UEFI keyfile restore did not write creds ("${UEFI_KEYFILE_RESTORE_SERIAL.wrotePrefix}" or ` +
        `"${UEFI_KEYFILE_RESTORE_SERIAL.alreadyPresent}").`,
    };
  }
  if (phase2Serial.includes(DEFAULT_QEMU_PASSPHRASE)) {
    return {
      ok: false,
      reason: "UEFI keyfile restore serial leaked QEMU test cred passphrase (must stay redacted)",
    };
  }
  return { ok: true };
}

/**
 * Serial markers zeta-install.sh emits around the first-boot install.sh step.
 *
 * These are LITERALS DUPLICATED from `zeta-install.sh` (the START echo and the
 * post-retry WARN). Nothing in the type system ties them to their producer, so
 * `qemu-full-install-test.test.ts` asserts that zeta-install.sh actually contains
 * both — otherwise rewording the shell echo would silently turn the contract
 * below into a test that can never fail, which is precisely the defect class this
 * contract exists to close (Kira, PR #10196 review).
 */
export const INSTALL_SH_START_MARKER = "running tools/setup/install.sh";
export const INSTALL_SH_FINAL_FAILURE_MARKER = "WARN: install.sh FAILED rc=";

/**
 * 081KZETP6AT — first-boot provisioning contract.
 *
 * `zeta-install.sh` treats a failed `tools/setup/install.sh` as non-fatal, which
 * is correct for the ARTIFACT (a node without agent CLIs is still recoverable)
 * but left the TEST with nothing to assert on: a fully-provisioned node and a
 * node with no toolchain at all both reported success. This closes that hole —
 * grace in the artifact, strict in the test.
 *
 * Deliberately matches only the FINAL (post-retry) failure marker, so a genuine
 * transient blip that the retry-with-backoff recovers from stays green — the
 * retry exists precisely so transient faults self-heal.
 */
export function assertFirstBootProvisioningContract(phase1Serial: string):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  // Require POSITIVE evidence, do not merely look for a failure string. An
  // assertion that only convicts and never acquits passes green on a truncated
  // serial, a VM that died before Step 6.95a, or an install.sh that was never
  // invoked at all — the same "absence of bad news = good news" hole this
  // contract was added to close (Kira, PR #10196 review).
  if (!phase1Serial.includes(INSTALL_SH_START_MARKER)) {
    return {
      ok: false,
      reason:
        `first-boot never reached the install.sh step (start marker "${INSTALL_SH_START_MARKER}" ` +
        "absent from the phase-1 serial). Either the serial was truncated, the VM died before " +
        "Step 6.95a, or the runtime-bootstrap block was skipped — all of which previously passed " +
        "green because the contract only looked for a failure string.",
    };
  }
  if (!phase1Serial.includes(INSTALL_SH_FINAL_FAILURE_MARKER)) return { ok: true };
  return {
    ok: false,
    reason:
      "tools/setup/install.sh failed on first boot after exhausting its retries " +
      `(marker: "${INSTALL_SH_FINAL_FAILURE_MARKER}"). The node is only PARTIALLY ` +
      "provisioned: mise toolchains and/or agent CLIs are absent, so anything " +
      "downstream that needs bun/node/python (e.g. the iter-5-wifi NM-profile " +
      "converter) cannot run. On NixOS the usual cause is a missing FHS loader — " +
      "see full-ai-cluster/nixos/modules/foreign-binaries.nix (programs.nix-ld) " +
      "and the 081KZETP6AT diag block in the serial log for the exact error lines.",
  };
}

/**
 * When QEMU_WIFI_ESP_PHASE1=1, phase-1 serial must show ESP JSON found +
 * NM profile write + association deferred. Failure text never echoes the
 * QEMU test PSK.
 */
export function assertWifiEspPhase1Contract(phase1Serial: string):
  | {
      readonly ok: true;
    }
  | { readonly ok: false; readonly reason: string } {
  const result = assertWifiEspInstallSerial(phase1Serial, {
    forbiddenSecrets: [DEFAULT_QEMU_WIFI_PASSWORD],
  });
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  if (phase1Serial.includes(DEFAULT_QEMU_WIFI_PASSWORD)) {
    return {
      ok: false,
      reason: "wifi ESP phase-1 serial leaked QEMU test wifi password (must stay redacted)",
    };
  }
  return { ok: true };
}

/** Exported for unit tests. */
export function detectUnexpectedControlPlaneLogin(
  serialOutput: string,
  expectedHostname: string | null,
): string | null {
  if (expectedHostname && expectedHostname !== "control-plane" && serialOutput.includes(CONTROL_PLANE_LOGIN_PROMPT)) {
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
  const welcomeNeedle = expectedHostname ? `Welcome to ${expectedHostname} (Zeta cluster node)` : null;

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

/** Exported for unit tests. Phase 2 (+ optional phase-3 first-session + self-register markers). */
export function detectPhase2Success(
  serialOutput: string,
  expectedHostname: string | null,
  requireFirstSession = false,
  requireUefiKeyfileRestore = false,
): { readonly ok: true; readonly reason: string; readonly hostname?: string } | { readonly ok: false } {
  const login = detectInstalledLoginPrompt(serialOutput, expectedHostname);
  if (!login.ok) return { ok: false };
  if (requireFirstSession && !phase3BootMarkersSatisfied(serialOutput)) {
    return { ok: false };
  }
  if (requireUefiKeyfileRestore && !assertUefiKeyfileRestoreContract(serialOutput).ok) {
    return { ok: false };
  }
  const phase3Suffix = requireFirstSession ? " + first-session + post-boot self-register markers" : "";
  const restoreSuffix = requireUefiKeyfileRestore ? " + UEFI keyfile restore decrypt" : "";
  return {
    ok: true,
    reason: `phase 2 SUCCESS — ${login.reason}${phase3Suffix}${restoreSuffix}`,
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

function createVirtualDisk(diskPath: string): void {
  console.log(`[qemu-full-install-test] Creating ${DISK_SIZE_GB}GB qcow2 disk at ${diskPath}`);
  execFileSync("qemu-img", ["create", "-f", "qcow2", diskPath, `${DISK_SIZE_GB}G`], {
    stdio: "inherit",
  });
}

type InstallBootMedia =
  | { readonly kind: "iso"; readonly path: string }
  | { readonly kind: "usb-image"; readonly path: string };

function buildQemuInstallArgs(bootMedia: InstallBootMedia, diskPath: string, serialLogPath: string): string[] {
  return buildQemuInstallArgsPure(bootMedia, diskPath, serialLogPath, kvmEnabled());
}

/** Exported for unit tests. */
export function buildQemuInstallArgsPure(
  bootMedia: InstallBootMedia,
  diskPath: string,
  serialLogPath: string,
  kvm: boolean,
): string[] {
  const args: string[] = [
    "-machine",
    "q35",
    "-m",
    String(MEMORY_MB),
    "-smp",
    String(CPU_COUNT),
    "-drive",
    `file=${diskPath},if=virtio,format=qcow2`,
    "-serial",
    `file:${serialLogPath}`,
    "-display",
    "none",
    "-netdev",
    "user,id=net0",
    "-device",
    "virtio-net-pci,netdev=net0",
  ];
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
  if (kvm) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
  }
  return args;
}

function buildQemuDiskBootArgs(
  diskPath: string,
  serialLogPath: string,
  tmpDir: string,
  fwCfgPassphraseFile?: string,
): string[] {
  const ovmf = resolveOvmfFirmware();
  if (!ovmf) {
    throw new Error("OVMF firmware missing; cannot UEFI-boot installed systemd-boot disk");
  }
  const varsPath = prepareWritableOvmfVars(tmpDir, ovmf.varsTemplate);
  return buildQemuDiskBootArgsPure(
    diskPath,
    serialLogPath,
    ovmf.code,
    varsPath,
    kvmEnabled(),
    fwCfgPassphraseFile,
  );
}

/** Exported for unit tests. */
export function buildQemuDiskBootArgsPure(
  diskPath: string,
  serialLogPath: string,
  ovmfCodePath: string,
  ovmfVarsPath: string,
  kvm: boolean,
  fwCfgPassphraseFile?: string,
): string[] {
  // Phase 2 only needs a login prompt on serial — no network. A virtio-net
  // NIC exposes a UEFI "Misc Device" boot entry (Pci 0x3,0x0) that can win
  // fresh OVMF_VARS boot order and stall after initrd (081KSNY2Z0008QG0R0008PN7RQ run #27589613408).
  const args: string[] = [
    "-machine",
    "q35",
    "-m",
    String(MEMORY_MB),
    "-smp",
    String(CPU_COUNT),
    "-drive",
    `if=pflash,format=raw,unit=0,readonly=on,file=${ovmfCodePath}`,
    "-drive",
    `if=pflash,format=raw,unit=1,file=${ovmfVarsPath}`,
    "-drive",
    `file=${diskPath},if=none,format=qcow2,id=installdisk`,
    "-device",
    "virtio-blk-pci,drive=installdisk,bootindex=1",
    "-serial",
    `file:${serialLogPath}`,
    "-display",
    "none",
    "-vga",
    "none",
    "-no-reboot",
  ];
  if (fwCfgPassphraseFile !== undefined) {
    // file= keeps the secret out of qemu argv; never use string=.
    args.push("-fw_cfg", `name=${QEMU_CREDS_PASSPHRASE_FWCFG_NAME},file=${fwCfgPassphraseFile}`);
  }
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
  requireUefiKeyfileRestore = false,
): Promise<InstallResult> {
  const start = Date.now();
  const deadline = start + DISK_BOOT_TIMEOUT_SECONDS * 1000;
  const loginNeedle = expectedHostname ? `${expectedHostname} login:` : null;
  let lastReportedMinute = -1;

  while (Date.now() < deadline) {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin > lastReportedMinute) {
      const extras = [
        ...(requireFirstSession ? ["first-session markers"] : []),
        ...(requireUefiKeyfileRestore ? ["UEFI keyfile restore decrypt"] : []),
      ];
      const target =
        extras.length > 0
          ? `${loginNeedle ?? "login"} + ${extras.join(" + ")}`
          : (loginNeedle ?? "installed-system login prompt");
      console.log(`[qemu-full-install-test] phase 2: ${elapsedMin} min elapsed; waiting for "${target}"`);
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

    const success = detectPhase2Success(
      content,
      expectedHostname,
      requireFirstSession,
      requireUefiKeyfileRestore,
    );
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
  const phase3Hint =
    requireFirstSession && !phase3BootMarkersSatisfied(content)
      ? " (login may be present but phase-3 markers missing — check zeta-first-session-ci + zeta-self-register-ci; rebuild ISO if markers absent)"
      : "";
  const restoreHint =
    requireUefiKeyfileRestore && !assertUefiKeyfileRestoreContract(content).ok
      ? " (login may be present but UEFI keyfile restore-decrypt markers missing)"
      : "";
  return {
    exitCode: 1,
    reason: loginNeedle
      ? `phase 2 timeout (${DISK_BOOT_TIMEOUT_SECONDS}s) waiting for "${loginNeedle}"${phase3Hint}${restoreHint}${emptySerialHint}`
      : `phase 2 timeout (${DISK_BOOT_TIMEOUT_SECONDS}s) waiting for installed-system login prompt${phase3Hint}${restoreHint}${emptySerialHint}`,
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

/**
 * Delete the multi-GB QEMU images this run created, keeping every log file.
 *
 * Measured on workflow_dispatch run 32816110015: the runner worker died with
 * `System.IO.IOException: No space left on device` the instant step 28
 * (scenario 3) started, after four sequential invocations of this script had
 * each left a `${DISK_SIZE_GB}`G qcow2 behind in `mkdtempSync`'s directory.
 * Nothing in this file ever removed them — `reportResult` calls
 * `process.exit`, which does not run `finally` blocks, so the only hook that
 * fires on every exit path is `process.on("exit")` (synchronous unlink only).
 *
 * The blast radius of ENOSPC is larger than the QEMU steps that caused it:
 * steps 33-38 (`Locate ISO` -> `Sign ISO with cosign` -> `Upload ISO`) carry
 * `if: ${{ !cancelled() }}` so a merely-failing scenario still ships an ISO,
 * but a dead worker process ships nothing. Run 32816110015 produced no
 * x86_64 ISO artifact at all for that reason.
 *
 * Logs are deliberately NOT reclaimed: when `SERIAL_LOG_OUT_PATH` is unset the
 * serial log lives inside this same directory and `reportResult` prints it as
 * "preserved at", a promise this function must not break. Only the images go.
 */
export function reclaimLargeTempArtifacts(paths: readonly string[]): {
  readonly removed: readonly string[];
  readonly bytesReclaimed: number;
} {
  const removed: string[] = [];
  let bytesReclaimed = 0;
  for (const path of paths) {
    try {
      // No existsSync pre-check: that is a check-then-use race
      // (lint-check-then-use-file-races), and here it would also be a lie —
      // the size must be read from the file we actually unlink, not from a
      // file that existed a syscall ago. Stat, unlink, then count, so a
      // failed unlink never reports bytes it did not reclaim.
      const { size } = statSync(path);
      unlinkSync(path);
      bytesReclaimed += size;
      removed.push(path);
    } catch {
      // Absent (the run exited before creating it) or undeletable. Best-effort:
      // a file we cannot remove must never turn a green run red. The ENOSPC
      // this guards against is reported by the runner itself.
    }
  }
  return { removed, bytesReclaimed };
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

  // Register BEFORE createVirtualDisk so an exit between create and the first
  // boot still reclaims. `process.on("exit")` is the only hook that survives
  // reportResult's process.exit(); the handler must stay synchronous.
  const largeTempArtifacts: string[] = [diskPath];
  process.on("exit", () => {
    const { removed, bytesReclaimed } = reclaimLargeTempArtifacts(largeTempArtifacts);
    if (removed.length > 0) {
      console.log(
        `[qemu-full-install-test] reclaimed ${removed.length} QEMU image(s), ` +
          `${(bytesReclaimed / 1024 ** 3).toFixed(2)} GiB (logs kept under ${tmpDir})`,
      );
    }
  });

  const writeArtifactSerialLog = (phase1: string, phase2: string): void => {
    writeFileSync(artifactSerialLogPath, mergeFullInstallSerialLogs(phase1, phase2));
  };

  console.log(`[qemu-full-install-test] ISO: ${isoPath}`);
  console.log(`[qemu-full-install-test] Virtual disk: ${diskPath}`);
  console.log(`[qemu-full-install-test] Serial log artifact: ${artifactSerialLogPath}`);

  createVirtualDisk(diskPath);

  const requireWifiEsp = wifiEspPhase1Enabled();
  const requireUefiKeyfileRestore = uefiKeyfileRestoreEnabled();
  const requireUefiKeyfilePicker = uefiKeyfilePickerEnabled();
  const requireUefiKeyfile = uefiKeyfilePhase1Enabled();
  // Keyfile opt-in writes persistOptInKeyfile; the iSerial contract treats that
  // as a silent-switch fail. Dedicated QEMU_UEFI_KEYFILE_PHASE1 / PICKER must not run it.
  const requireUsbISerial = usbISerialGuestEnabled() && !requireUefiKeyfile;
  let bootMedia: InstallBootMedia = { kind: "iso", path: isoPath };
  if (requireWifiEsp || requireUsbISerial || requireUefiKeyfile) {
    const usbImagePath = join(
      tmpDir,
      requireUefiKeyfileRestore
        ? "zflash-uefi-keyfile-restore-boot.img"
        : requireUefiKeyfilePicker
          ? "zflash-uefi-keyfile-picker-boot.img"
          : requireUefiKeyfile
            ? "zflash-uefi-keyfile-boot.img"
            : requireWifiEsp
              ? "zflash-wifi-esp-boot.img"
              : "zflash-usb-iserial-boot.img",
    );
    largeTempArtifacts.push(usbImagePath);
    console.log(
      requireUefiKeyfileRestore
        ? "[qemu-full-install-test] QEMU_UEFI_KEYFILE_RESTORE=1 — baking picker bind + phase-2 fw_cfg restore decrypt (no ESP persist / metal claim)"
        : requireUefiKeyfilePicker
          ? "[qemu-full-install-test] QEMU_UEFI_KEYFILE_PICKER=1 — baking bind marker + /zeta-qemu-creds-passphrase (picker bind; no phase-2 restore / metal claim)"
          : requireUefiKeyfile
            ? "[qemu-full-install-test] QEMU_UEFI_KEYFILE_PHASE1=1 — baking /zeta-bind-uefi-keyfile (install-time write; no restore-decrypt claim)"
            : requireWifiEsp
              ? `[qemu-full-install-test] QEMU_WIFI_ESP_PHASE1=1 — baking file-backed zflash image with wifi ESP JSON (ssid=${DEFAULT_QEMU_WIFI_SSID})`
              : "[qemu-full-install-test] QEMU_USB_ISERIAL_PHASE1=1 — baking file-backed zflash USB image (serial=ZETA-QEMU-001; no wifi claim)",
    );
    const prepared = prepareBootImage({
      isoPath,
      outputImagePath: usbImagePath,
      withCredentialBlob: false,
      testMode: true,
      hostname: requireUefiKeyfileRestore
        ? "node-qemu-keyfile-restore"
        : requireUefiKeyfilePicker
          ? "node-qemu-keyfile-picker"
          : requireUefiKeyfile
            ? "node-qemu-keyfile"
            : requireWifiEsp
              ? "node-qemu-wifi"
              : "node-qemu-iserial",
      pubkeyPath: TEST_INFRA_PUBKEY,
      ...(requireWifiEsp
        ? {
            wifiCredentials: {
              ssid: DEFAULT_QEMU_WIFI_SSID,
              password: DEFAULT_QEMU_WIFI_PASSWORD,
            },
          }
        : {}),
      ...(requireUefiKeyfile ? { bindUefiKeyfileMarker: true } : {}),
      ...(requireUefiKeyfilePicker ? { qemuCredsPassphrase: DEFAULT_QEMU_PASSPHRASE } : {}),
    });
    if ("error" in prepared) {
      console.error(`[qemu-full-install-test] USB boot-image bake failed: ${prepared.error}`);
      process.exit(2);
    }
    bootMedia = { kind: "usb-image", path: prepared.outputImagePath };
    console.log(`[qemu-full-install-test] USB boot image: ${bootMedia.path}`);
  }
  if (!kvmEnabled()) {
    console.warn(`[qemu-full-install-test] ${KVM_PATH} not available; using TCG (slow)`);
  }

  let phase1Label = "phase 1 (ISO install)";
  if (requireUefiKeyfileRestore) {
    phase1Label = "phase 1 (zflash USB install + UEFI keyfile picker bind for restore)";
  } else if (requireUefiKeyfilePicker) {
    phase1Label = "phase 1 (zflash USB install + UEFI keyfile picker bind)";
  } else if (requireUefiKeyfile) {
    phase1Label = "phase 1 (zflash USB install + UEFI keyfile write)";
  } else if (requireWifiEsp) {
    phase1Label = "phase 1 (zflash USB install + wifi ESP)";
  } else if (requireUsbISerial) {
    phase1Label = "phase 1 (zflash USB install + iSerial guest probe)";
  }

  const phase1 = await runQemuUntil(
    buildQemuInstallArgs(bootMedia, diskPath, phase1SerialLogPath),
    phase1SerialLogPath,
    () => waitForInstallComplete(phase1SerialLogPath),
    phase1Label,
  );
  const phase1Serial = readSerial(phase1SerialLogPath);
  if (phase1.exitCode !== 0) {
    writeArtifactSerialLog(phase1Serial, "");
    reportResult(phase1, artifactSerialLogPath);
  }

  // 081KZETP6AT — grace in the ARTIFACT, assert in the TEST.
  //
  // zeta-install.sh deliberately treats a failed `tools/setup/install.sh` as
  // non-fatal (a node that boots without agent CLIs is still recoverable — that
  // is the right call for the artifact). But nothing ever ASSERTED on it, so a
  // fully-provisioned node and a node with no toolchain at all both reported
  // "scenario passed". That false green is why a DETERMINISTIC failure (NixOS
  // has no FHS loader, so mise's prebuilt binaries cannot execve) read as "a
  // rare transient blip" for weeks and cost three PRs chasing a ghost.
  //
  // Checked BEFORE the wifi contract on purpose: a failed toolchain install is
  // the ROOT cause and the missing wifi profile is its SYMPTOM (no bun ⇒ the
  // wifi-esp-to-nm converter cannot run). Reporting the symptom first is what
  // sent the last diagnosis down the wrong path.
  //
  // Note `build-iso` is not in the required gate floor (build-and-test /
  // cross-verify / full-verify / lint(semgrep)), so this makes the job loudly
  // red without blocking merges — notice fast, do not wedge the fleet.
  const provisioning = assertFirstBootProvisioningContract(phase1Serial);
  if (!provisioning.ok) {
    writeArtifactSerialLog(phase1Serial, "");
    reportResult(
      {
        exitCode: 1,
        reason: `first-boot provisioning contract failed — ${provisioning.reason}`,
        serialLogTail: phase1Serial.slice(-2000),
        ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
      },
      artifactSerialLogPath,
    );
  }

  if (requireWifiEsp) {
    const wifiContract = assertWifiEspPhase1Contract(phase1Serial);
    if (!wifiContract.ok) {
      // Persist the phase-1 serial BEFORE reporting — otherwise reportResult claims
      // "Full serial log preserved at: <path>" but the file was never written (the write
      // only happens on the exitCode!=0 path at line ~717 and the success path at ~757),
      // so the upload-artifact step finds nothing and this failure is undiagnosable.
      // This is exactly why 081KZHJPJCF (wifi-ESP markers missing) could not be root-caused.
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `wifi ESP phase-1 contract failed — ${wifiContract.reason}`,
          serialLogTail: phase1Serial.slice(-2000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log("[qemu-full-install-test] wifi ESP phase-1 contract ok (profile write; association deferred)");
  }

  // USB image only. ISO/cdrom cascade-5 has no usb-storage serial=; missing
  // markers there are expected. Helper-unavailable is a fail, not a skip.
  if (requireUsbISerial) {
    const iserialContract = assertUsbISerialPhase1Contract(phase1Serial);
    if (!iserialContract.ok) {
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `usb iSerial phase-1 contract failed — ${iserialContract.reason}`,
          serialLogTail: phase1Serial.slice(-2000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log("[qemu-full-install-test] usb iSerial phase-1 contract ok (guest sysfs; no metal claim)");
  }

  if (requireUefiKeyfilePicker) {
    const pickerContract = assertUefiKeyfilePickerContract(phase1Serial);
    if (!pickerContract.ok) {
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `UEFI keyfile picker contract failed — ${pickerContract.reason}`,
          serialLogTail: phase1Serial.slice(-2000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(
      "[qemu-full-install-test] UEFI keyfile picker contract ok (blob bound; no phase-2 restore / metal claim)",
    );
  } else if (requireUefiKeyfile) {
    const keyfileContract = assertUefiKeyfilePhase1Contract(phase1Serial);
    if (!keyfileContract.ok) {
      writeArtifactSerialLog(phase1Serial, "");
      reportResult(
        {
          exitCode: 1,
          reason: `UEFI keyfile phase-1 contract failed — ${keyfileContract.reason}`,
          serialLogTail: phase1Serial.slice(-2000),
          ...(phase1.elapsedSeconds !== undefined ? { elapsedSeconds: phase1.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(
      "[qemu-full-install-test] UEFI keyfile phase-1 contract ok (install-time write; no restore-decrypt / metal claim)",
    );
  }

  const hostname = phase1.hostname ?? extractGeneratedHostname(phase1Serial);
  console.log(`[qemu-full-install-test] phase 1 done; expected hostname: ${hostname ?? "(infer at login)"}`);

  const requireFirstSession = firstSessionPhase3Enabled();
  if (requireFirstSession) {
    console.log(
      "[qemu-full-install-test] phase 3 enabled (QEMU_FIRST_SESSION_PHASE3=1) — will assert first-session + mock/skip identity-auth markers",
    );
  }

  let fwCfgPassphraseFile: string | undefined;
  if (requireUefiKeyfileRestore) {
    fwCfgPassphraseFile = join(tmpDir, "qemu-creds-passphrase.fwcfg");
    writeFileSync(fwCfgPassphraseFile, DEFAULT_QEMU_PASSPHRASE, { mode: 0o600 });
    console.log(
      "[qemu-full-install-test] QEMU_UEFI_KEYFILE_RESTORE=1 — injecting fw_cfg file= (secret not in argv / not on installed ESP)",
    );
  }

  let phase2Label = "phase 2 (disk boot)";
  if (requireUefiKeyfileRestore && requireFirstSession) {
    phase2Label = "phase 2+3 (disk boot + first-session + UEFI keyfile restore decrypt)";
  } else if (requireUefiKeyfileRestore) {
    phase2Label = "phase 2 (disk boot + UEFI keyfile restore decrypt)";
  } else if (requireFirstSession) {
    phase2Label = "phase 2+3 (disk boot + first-session)";
  }

  const phase2 = await runQemuUntil(
    buildQemuDiskBootArgs(diskPath, phase2SerialLogPath, tmpDir, fwCfgPassphraseFile),
    phase2SerialLogPath,
    () =>
      waitForInstalledLogin(
        phase2SerialLogPath,
        hostname,
        requireFirstSession,
        requireUefiKeyfileRestore,
      ),
    phase2Label,
  );

  const phase2Serial = readSerial(phase2SerialLogPath);
  writeArtifactSerialLog(phase1Serial, phase2Serial);

  if (requireUefiKeyfileRestore) {
    const restoreContract = assertUefiKeyfileRestoreContract(phase2Serial);
    if (!restoreContract.ok) {
      reportResult(
        {
          exitCode: 1,
          reason: `UEFI keyfile restore contract failed — ${restoreContract.reason}`,
          serialLogTail: phase2Serial.slice(-2000),
          ...(phase2.elapsedSeconds !== undefined ? { elapsedSeconds: phase2.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(
      "[qemu-full-install-test] UEFI keyfile restore contract ok (fw_cfg staged; no ESP persist / metal claim)",
    );
  }

  // Cascade #6 deepen: when install generated node-<6hex>, bind phase-1 → phase-2
  // login and reject control-plane regression (081KSGS9H0008QG0R00120EEHM Bug 1).
  if (phase2.exitCode === 0 && hostname && NODE_HEX_HOSTNAME_RE.test(hostname)) {
    const contract = assertGeneratedNodeHostnameContract(phase1Serial, phase2Serial);
    if (!contract.ok) {
      reportResult(
        {
          exitCode: 1,
          reason: `hostname uniqueness contract failed — ${contract.reason}`,
          serialLogTail: phase2Serial.slice(-2000),
          ...(phase2.elapsedSeconds !== undefined ? { elapsedSeconds: phase2.elapsedSeconds } : {}),
        },
        artifactSerialLogPath,
      );
    }
    console.log(`[qemu-full-install-test] hostname uniqueness contract ok (${contract.hostname})`);
  }

  reportResult(phase2, artifactSerialLogPath);
}

if (import.meta.main) {
  main();
}
