#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/host-seal-profile.ts
 *
 * Aaron 2026-09-05: make the emulator-vs-metal distinction very clear
 * based on detected hardware; NixOS can tell us what is on the device,
 * not just k8s. Developers: biometrics and FIDO-like devices supported.
 * Prod boxes: key rotation must be automatic.
 *
 * This module CLASSIFIES. It does not talk to USB, PAM, or OpenBao.
 * A capture is injected (from frost-hardware-probe / /etc/os-release /
 * sysfs). A named probe snapshot maps to this capture
 * (`hostCaptureFromNamedProbe`). `/dev/tpmrm0` is not `present`.
 * A YubiKey CCID reader is not CardContact SmartCard-HSM. A
 * PKCS#11 driver on disk is not an attached YubiHSM. A null
 * snapshot is unmeasured, not absent. NixOS evaluation cannot
 * see a hot-plugged HSM; it declares the *role* and enables
 * userspace. Presence is still a measurement.
 *
 * A driver on disk is not a device (frost-hardware-probe). SoftHSM2
 * is never selected from a metal capture. Init stays gated on every
 * role. Rotation is the split:
 *
 *   developer  — FIDO / biometric MAY rotate or approve
 *   prod-metal — rotation MUST be automatic (HSM or TPM PKCS#11)
 *   ci-emulator — SoftHSM2 / swtpm wiring only, never metal
 *
 * Cite: seal-emulator-rung.ts, tpm2-linux-probe.ts, frost-hardware-probe.ts,
 * tpm2-seal-model.nix (role is declared; silicon is measured).
 */

import { isCiEmulatorRung, isMetalOracle, type SealOracle } from "./seal-emulator-rung.ts";

export type BoxRole = "developer" | "prod-metal" | "ci-emulator";

export type OsFamily = "nixos" | "darwin" | "linux-other" | "unknown";

export type Tpm2CaptureState = "present" | "absent" | "unreadable" | "unavailable" | "indeterminate" | "not-asked";

export type YubiHsm2CaptureState = "attached" | "absent" | "indeterminate" | "not-asked";

/**
 * SmartCard-HSM capture, with an explicit UNMEASURED state.
 *
 * Was a bare `boolean`, and that is what made the defect unavoidable: a mapper
 * that does not measure had two options and both were lies -- `true` claims
 * presence, `false` claims absence. The frost->named mapper hardcoded
 * `false` while correctly REFUSING to infer an HSM from a CCID reader, so the
 * refusal was right and the value it wrote was not. Measured wrong on real
 * hardware 2026-09-08: a SmartCard-HSM v4.1 was attached and provisioned.
 *
 * The bare boolean was also being read TWO WAYS in this file -- `false` meant
 * "absent" when picking the oracle and "we did not look" when deciding whether
 * anything had been probed. Its siblings carry `not-asked` precisely so that
 * cannot happen to them.
 */
export type SmartcardHsmCaptureState = "present" | "absent" | "indeterminate" | "not-asked";

export type RotationGate = "automatic-hsm" | "automatic-tpm" | "developer-fido" | "developer-biometric" | "ci-emulator";

export type RotationRefuse =
  | "prod-refuses-fido-rotation"
  | "prod-refuses-biometric-rotation"
  | "prod-no-automatic-oracle"
  | "emulator-is-not-metal"
  | "driver-is-not-a-device"
  | "no-oracle";

export type HardwareAssess = "no-claim" | "unprobed" | "agree" | "check-did-not-run" | "drift";

export interface HostHardwareCapture {
  readonly os: OsFamily;
  readonly tpm2: Tpm2CaptureState;
  readonly yubiHsm2: YubiHsm2CaptureState;
  /** CardContact / SmartCard-HSM (or another PKCS#11 smartcard HSM), not a YubiKey. */
  readonly smartcardHsm: SmartcardHsmCaptureState;
  /** YubiKey / FIDO / CCID token — a developer factor, not a prod rotation oracle. */
  readonly yubikeyFido: boolean;
  readonly biometricEnrolled: boolean;
  /** PKCS#11 .so/.dylib on disk. A DRIVER, never enough to pick a metal oracle. */
  readonly pkcs11ModuleOnDisk: boolean;
}

export interface HostSealProfile {
  readonly role: BoxRole;
  readonly os: OsFamily;
  readonly oracle: SealOracle;
  readonly rotation:
    { readonly ok: true; readonly gate: RotationGate } | { readonly ok: false; readonly reason: RotationRefuse };
  readonly assess: HardwareAssess;
  readonly nixosDetected: boolean;
}

const EMPTY_CAPTURE: HostHardwareCapture = {
  os: "unknown",
  tpm2: "not-asked",
  yubiHsm2: "not-asked",
  smartcardHsm: "not-asked",
  yubikeyFido: false,
  biometricEnrolled: false,
  pkcs11ModuleOnDisk: false,
};

/** Parse os-release(5). ID=nixos is the only positive NixOS reading. */
export function osFamilyFromOsRelease(text: string): OsFamily {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "ID=nixos" || trimmed === 'ID="nixos"') return "nixos";
  }
  if (/^ID=/m.test(text)) return "linux-other";
  return "unknown";
}

export function emptyCapture(overrides: Partial<HostHardwareCapture> = {}): HostHardwareCapture {
  return { ...EMPTY_CAPTURE, ...overrides };
}

/**
 * Named probe snapshot. Cluster does not open `/dev/tpmrm0`
 * and does not import frost-hardware-probe (fs/spawn).
 * `smartcardHsm` is named — a CCID reader / YubiKey is not
 * CardContact SmartCard-HSM.
 */
export interface NamedHardwareProbe {
  readonly os: OsFamily;
  readonly tpm2: Tpm2CaptureState;
  readonly tpmDeviceNode: string | null;
  readonly yubiHsm2: YubiHsm2CaptureState;
  readonly smartCardReaderAttached: boolean;
  readonly yubikeyDetected: boolean;
  readonly pkcs11ModuleOnDisk: boolean;
  readonly smartcardHsm: SmartcardHsmCaptureState;
}

/**
 * Map a named probe snapshot to a host capture. Null is
 * unmeasured (`not-asked`), not `absent`. `/dev/tpmrm0` does
 * not upgrade `tpm2` to `present`. A YubiKey / CCID reader
 * does not set `smartcardHsm`. A PKCS#11 driver on disk does
 * not set `yubiHsm2` to `attached`. Does not call
 * `integrateAtSetup`.
 */
export function hostCaptureFromNamedProbe(probe: NamedHardwareProbe | null): HostHardwareCapture {
  if (probe === null) return emptyCapture();
  return emptyCapture({
    os: probe.os,
    tpm2: probe.tpm2,
    yubiHsm2: probe.yubiHsm2,
    smartcardHsm: probe.smartcardHsm,
    yubikeyFido: probe.yubikeyDetected,
    pkcs11ModuleOnDisk: probe.pkcs11ModuleOnDisk,
    biometricEnrolled: false,
  });
}

/**
 * Metal oracle from ATTACHED devices. SoftHSM2 / swtpm are never inferred
 * from a host capture — those are ci-emulator only.
 */
export function pickSealOracleFromCapture(capture: HostHardwareCapture): SealOracle {
  if (capture.yubiHsm2 === "attached") return "yubihsm2";
  if (capture.smartcardHsm === "present") return "smartcard-hsm";
  if (capture.tpm2 === "present") return "tpm2-pkcs11";
  return "none";
}

function tpmLooked(state: Tpm2CaptureState): boolean {
  return state === "present" || state === "absent";
}

function hsmLooked(state: YubiHsm2CaptureState): boolean {
  return state === "attached" || state === "absent";
}

function smartcardLooked(state: SmartcardHsmCaptureState): boolean {
  return state === "present" || state === "absent";
}

function hasAutomaticOracle(capture: HostHardwareCapture): boolean {
  return capture.yubiHsm2 === "attached" || capture.smartcardHsm === "present" || capture.tpm2 === "present";
}

function automaticOracleUnprobed(capture: HostHardwareCapture): boolean {
  return capture.tpm2 === "not-asked" && capture.yubiHsm2 === "not-asked" && capture.smartcardHsm === "not-asked";
}

function automaticCheckDidNotRun(capture: HostHardwareCapture): boolean {
  const tpmStuck = capture.tpm2 === "unreadable" || capture.tpm2 === "unavailable" || capture.tpm2 === "indeterminate";
  const hsmStuck = capture.yubiHsm2 === "indeterminate";
  const tpmSilent = capture.tpm2 === "not-asked";
  const hsmSilent = capture.yubiHsm2 === "not-asked";
  const cardStuck = capture.smartcardHsm === "indeterminate";
  const cardSilent = capture.smartcardHsm === "not-asked";
  if (hasAutomaticOracle(capture)) return false;
  if (tpmLooked(capture.tpm2) && hsmLooked(capture.yubiHsm2) && smartcardLooked(capture.smartcardHsm)) return false;
  return tpmStuck || hsmStuck || cardStuck || tpmSilent || hsmSilent || cardSilent;
}

export function assessHardware(role: BoxRole, capture: HostHardwareCapture): HardwareAssess {
  if (role === "ci-emulator" || role === "developer") return "no-claim";
  if (automaticOracleUnprobed(capture)) return "unprobed";
  if (hasAutomaticOracle(capture)) return "agree";
  if (automaticCheckDidNotRun(capture)) return "check-did-not-run";
  return "drift";
}

export function pickRotation(
  role: BoxRole,
  oracle: SealOracle,
  capture: HostHardwareCapture,
): HostSealProfile["rotation"] {
  if (role === "ci-emulator") {
    if (isMetalOracle(oracle)) {
      return { ok: false, reason: "emulator-is-not-metal" };
    }
    return { ok: true, gate: "ci-emulator" };
  }

  if (capture.pkcs11ModuleOnDisk && oracle === "none") {
    return { ok: false, reason: "driver-is-not-a-device" };
  }

  if (role === "prod-metal") {
    if (oracle === "yubihsm2" || oracle === "smartcard-hsm") {
      return { ok: true, gate: "automatic-hsm" };
    }
    if (oracle === "tpm2-pkcs11") {
      return { ok: true, gate: "automatic-tpm" };
    }
    if (capture.yubikeyFido) {
      return { ok: false, reason: "prod-refuses-fido-rotation" };
    }
    if (capture.biometricEnrolled) {
      return { ok: false, reason: "prod-refuses-biometric-rotation" };
    }
    return { ok: false, reason: "prod-no-automatic-oracle" };
  }

  // developer: automatic oracles still win when attached; FIDO / biometric are allowed.
  if (oracle === "yubihsm2" || oracle === "smartcard-hsm") {
    return { ok: true, gate: "automatic-hsm" };
  }
  if (oracle === "tpm2-pkcs11") {
    return { ok: true, gate: "automatic-tpm" };
  }
  if (capture.yubikeyFido) {
    return { ok: true, gate: "developer-fido" };
  }
  if (capture.biometricEnrolled) {
    return { ok: true, gate: "developer-biometric" };
  }
  return { ok: false, reason: "no-oracle" };
}

/**
 * `ciOracle` is declared by the job, never inferred from a metal capture.
 * A self-hosted runner with a real TPM is not swtpm because `/dev/tpmrm0` exists.
 */
export function classifyHostSeal(
  role: BoxRole,
  capture: HostHardwareCapture,
  ciOracle: "softhsm2" | "swtpm" = "softhsm2",
): HostSealProfile {
  const oracle = role === "ci-emulator" ? ciOracle : pickSealOracleFromCapture(capture);
  const rotation = pickRotation(role, oracle, capture);
  return {
    role,
    os: capture.os,
    oracle,
    rotation,
    assess: assessHardware(role, capture),
    nixosDetected: capture.os === "nixos",
  };
}

export function ciEmulatorIsNotMetal(profile: HostSealProfile): boolean {
  return profile.role === "ci-emulator" && isCiEmulatorRung(profile.oracle);
}
