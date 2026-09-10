#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/unseal-path.ts
 *
 * Aaron 2026-09-06: detect HSM/TPM during setup; integrate only if
 * that hardware is accessible on the physical device; emulator
 * install tests with and without HSM/TPM; TPM auto-unseal as well
 * as HSM; keep Lucent 1Password unsealing; multiple paths.
 *
 * This module CLASSIFIES. It does not talk to USB, OpenBao, or
 * 1Password. A capture is injected (host hardware, and the
 * restored PKCS#11 pointer file). SoftHSM2 / swtpm are job
 * declarations, never inferred from `/dev/tpmrm0`. A named
 * PathRequest from env (`ZETA_UNSEAL_REQUEST`) is the same
 * rule: missing is unmeasured, not `auto`; `/dev/tpmrm0` is
 * not `pkcs11-tpm`. Parse does not call `integrateAtSetup`.
 * Env join (`integrateAtSetupFromEnv`) injects a named probe
 * snapshot (`NamedHardwareProbe | null`), mapped via
 * `hostCaptureFromNamedProbe`. Missing request is unmeasured,
 * not `auto`. Null probe is unmeasured, not present.
 * `/dev/tpmrm0` is not a capture. Inner `integrateAtSetup`
 * still takes a capture.
 *
 * OpenBao takes ONE seal per node. Multiple *paths* means the
 * fleet may mix PKCS#11-YubiHSM, PKCS#11-SmartCard-HSM,
 * PKCS#11-TPM, and Lucent-Shamir across boxes (and kind still
 * uses the HTTP unsealer). It does not mean two seal stanzas
 * on one member. Dual-vendor on one box is ZetaFS k-of-n, not
 * two OpenBao seals.
 *
 * Metal HSM vendors are peers (PKCS#11, not a brand in the
 * volume): YubiHSM 2, and CardContact SmartCard-HSM
 * (https://www.smartcard-hsm.com/). A YubiKey FIDO/CCID token
 * is not a SmartCard-HSM. SoftHSM2 is not a substitute for
 * either device.
 *
 * TPM auto-unseal: yes, via tpm2-pkcs11, mechanism pinned to
 * CKM_RSA_PKCS_OAEP (no AES-GCM on that token). YubiHSM
 * prefers AES-GCM. SmartCard-HSM AES-GCM is measured on the
 * device, not inherited from SoftHSM/YubiHSM. Lucent-Shamir
 * is the 2026-09-04 peer path (fetch-at-unseal, threshold >= 2,
 * cannot init) — not a silent fallback from a requested
 * PKCS#11 tier (frost-hardware-probe no-silent-downgrade).
 *
 * Cite: host-seal-profile.ts, seal-emulator-rung.ts,
 * pkcs11-hostpath-overlay.ts, vault-unsealer.ts,
 * tpm2-linux-probe.ts, frost-hardware-probe.ts,
 * docs/design/2026-09-04-credential-substrate-production-hardening-review.md.
 */

import {
  emptyCapture,
  hostCaptureFromNamedProbe,
  type HostHardwareCapture,
  type NamedHardwareProbe,
} from "./host-seal-profile.ts";
import {
  planSetupPkcs11Overlay,
  USB_PKCS11_MODULE_POINTER,
  type BaoElfCapture,
  type OverlayPlan,
} from "./pkcs11-hostpath-overlay.ts";
import { pickOpenbaoMechanism, type MechanismPick, type SealOracle } from "./seal-emulator-rung.ts";
import { UNSEAL_THRESHOLD } from "./vault-unsealer.ts";

/** One OpenBao seal (or the Shamir HTTP loop) per node. */
export type UnsealPath =
  "pkcs11-yubihsm" | "pkcs11-smartcard" | "pkcs11-tpm" | "lucent-shamir" | "ci-softhsm" | "ci-swtpm" | "kind-shamir";

/**
 * USB-install product vocabulary. One choice from detected hardware:
 * HSM if attached, else TPM if present, else the fetch-at-unseal sidecar.
 * Almost no machine has two HSMs; if two vendors are attached, still one
 * seal (`hsm`). Does not rename UnsealPath. CI maps simulators onto the
 * same three rungs (SoftHSM → hsm, swtpm → tpm, kind/Lucent → sidecar).
 */
export type UsbInstallSeal = "hsm" | "tpm" | "sidecar";

/** Project the internal path onto the USB-install ladder. Exhaustive. */
export function usbInstallSealFromPath(path: UnsealPath): UsbInstallSeal {
  switch (path) {
    case "pkcs11-yubihsm":
    case "pkcs11-smartcard":
    case "ci-softhsm":
      return "hsm";
    case "pkcs11-tpm":
    case "ci-swtpm":
      return "tpm";
    case "lucent-shamir":
    case "kind-shamir":
      return "sidecar";
  }
}

/**
 * Ladder is null when the look did not produce a path: missing request,
 * refused PKCS#11, incomplete probe. A look that did not happen is not
 * "sidecar" — sidecar is the completed negative (no HSM, no TPM).
 */
export function usbInstallSealFromDecision(decision: IntegrateDecision | null): UsbInstallSeal | null {
  if (decision === null || !decision.ok) return null;
  return usbInstallSealFromPath(decision.path);
}

/**
 * What setup asked for. `auto` picks the strongest accessible path.
 * `pkcs11-hsm` is request-only: either metal HSM vendor (YubiHSM or
 * CardContact SmartCard-HSM). The result names the vendor.
 */
export type PathRequest = "auto" | "pkcs11-hsm" | UnsealPath;

export interface SetupRequest {
  readonly requested: PathRequest;
}

/**
 * First-boot / installer env key for a named PathRequest.
 * Missing is unmeasured, not `auto`, not `pkcs11-tpm`.
 */
export const UNSEAL_REQUEST_ENV_KEY = "ZETA_UNSEAL_REQUEST";

export type NamedPathRequestError = "empty-request" | "unknown-request" | "unsafe-conf-value";

export type NamedPathRequestResult =
  | { readonly ok: true; readonly requested: PathRequest | null }
  | { readonly ok: false; readonly reason: NamedPathRequestError };

/** Same allowlist as firstboot-role `SHELL_SAFE_CONF_VALUE_REGEX`. Cluster must not import zflash. */
const SHELL_SAFE_REQUEST_REGEX = /^[A-Za-z0-9._:/@-]+$/;

const PATH_REQUESTS: ReadonlySet<string> = new Set([
  "auto",
  "pkcs11-hsm",
  "pkcs11-yubihsm",
  "pkcs11-smartcard",
  "pkcs11-tpm",
  "lucent-shamir",
  "ci-softhsm",
  "ci-swtpm",
  "kind-shamir",
]);

function isPathRequest(value: string): value is PathRequest {
  return PATH_REQUESTS.has(value);
}

/**
 * Named request from a string. Missing is unmeasured, not `auto`.
 * `/dev/tpmrm0` and `/mnt` are unknown, not `pkcs11-tpm`.
 * Does not open files. Does not call `integrateAtSetup`.
 */
export function parsePathRequest(value: string | undefined): NamedPathRequestResult {
  if (value === undefined) return { ok: true, requested: null };
  if (value.length === 0) return { ok: false, reason: "empty-request" };
  if (!SHELL_SAFE_REQUEST_REGEX.test(value)) return { ok: false, reason: "unsafe-conf-value" };
  if (isPathRequest(value)) return { ok: true, requested: value };
  return { ok: false, reason: "unknown-request" };
}

/**
 * Process env after bash sources a named request. Missing key
 * is unmeasured. Does not infer `pkcs11-tpm` from `/dev/tpmrm0`.
 */
export function consumeUnsealRequestFromEnv(env: {
  readonly [key: string]: string | undefined;
}): NamedPathRequestResult {
  return parsePathRequest(env[UNSEAL_REQUEST_ENV_KEY]);
}

export function namedPathRequestErrorMessage(reason: NamedPathRequestError): string {
  switch (reason) {
    case "empty-request":
      return "ZETA_UNSEAL_REQUEST requires a value";
    case "unknown-request":
      return "ZETA_UNSEAL_REQUEST must be a named PathRequest";
    case "unsafe-conf-value":
      return "ZETA_UNSEAL_REQUEST contains a value firstboot conf cannot carry";
  }
}

export type UnsealMechanism = "aes-gcm" | "must-pin-rsa-oaep" | "measure-on-device" | "none";

export type IntegrateRefuse =
  | "requested-pkcs11-not-accessible"
  | "driver-is-not-a-device"
  | "probe-did-not-run"
  | "emulator-not-declared"
  | "no-path"
  | "two-openbao-seals"
  | "fail-missing";

export type IntegrateOk = {
  readonly ok: true;
  readonly path: UnsealPath;
  readonly mechanism: UnsealMechanism;
  readonly autoUnseal: boolean;
  readonly threshold?: number;
};

export type IntegrateRefuseDecision = {
  readonly ok: false;
  readonly reason: IntegrateRefuse;
  readonly requested?: PathRequest;
};

export type IntegrateDecision = IntegrateOk | IntegrateRefuseDecision;

export interface InstallEmulators {
  readonly softhsmInstalled: boolean;
  readonly swtpmInstalled: boolean;
  readonly lucentFetcherPresent: boolean;
  readonly kindUnsealerPresent: boolean;
}

const PKCS11_PATHS: ReadonlySet<UnsealPath> = new Set([
  "pkcs11-yubihsm",
  "pkcs11-smartcard",
  "pkcs11-tpm",
  "ci-softhsm",
  "ci-swtpm",
]);

const AUTO_UNSEAL_PATHS: ReadonlySet<UnsealPath> = PKCS11_PATHS;

export function yubiHsmAccessible(capture: HostHardwareCapture): boolean {
  return capture.yubiHsm2 === "attached";
}

/** CardContact SmartCard-HSM (sc-hsm / OpenSC), not a YubiKey. */
export function smartcardHsmAccessible(capture: HostHardwareCapture): boolean {
  return capture.smartcardHsm === "present";
}

export function hsmAccessible(capture: HostHardwareCapture): boolean {
  return yubiHsmAccessible(capture) || smartcardHsmAccessible(capture);
}

/** TPM 2.0 usable for PKCS#11 auto-unseal. Five-state: only `present`. */
export function tpmAccessible(capture: HostHardwareCapture): boolean {
  return capture.tpm2 === "present";
}

export function tpmCheckDidNotRun(capture: HostHardwareCapture): boolean {
  return capture.tpm2 === "unreadable" || capture.tpm2 === "unavailable" || capture.tpm2 === "indeterminate";
}

export function hsmCheckDidNotRun(capture: HostHardwareCapture): boolean {
  return capture.yubiHsm2 === "indeterminate";
}

/**
 * Automatic-oracle look is unfinished. Unprobed / unavailable /
 * unreadable / indeterminate is a check that did not run, not absent.
 * An already-accessible device is enough — HSM attached does not wait
 * on a TPM look.
 */
export function automaticProbeIncomplete(capture: HostHardwareCapture): boolean {
  if (hsmAccessible(capture) || tpmAccessible(capture)) return false;
  const hsmLooked = capture.yubiHsm2 === "absent";
  const tpmLooked = capture.tpm2 === "absent";
  return !hsmLooked || !tpmLooked || hsmCheckDidNotRun(capture) || tpmCheckDidNotRun(capture);
}

export function flattenMechanism(pick: MechanismPick): UnsealMechanism {
  switch (pick.kind) {
    case "preferred-aes-gcm":
      return "aes-gcm";
    case "must-pin-rsa-oaep":
      return "must-pin-rsa-oaep";
    case "measure-on-device":
      return "measure-on-device";
    case "none":
      return "none";
  }
}

/** Yes: TPM is an auto-unseal oracle iff the mechanism is OAEP. */
export function tpmCanAutoUnseal(mechanism: string): boolean {
  return mechanism === "must-pin-rsa-oaep";
}

export function lucentThresholdHolds(): boolean {
  return UNSEAL_THRESHOLD >= 2;
}

export function isPkcs11OpenBaoSeal(path: UnsealPath): boolean {
  return PKCS11_PATHS.has(path);
}

function mechanismFor(path: UnsealPath): UnsealMechanism {
  switch (path) {
    case "pkcs11-yubihsm":
    case "ci-softhsm":
      return flattenMechanism(pickOpenbaoMechanism("yubihsm2"));
    case "pkcs11-smartcard":
      return flattenMechanism(pickOpenbaoMechanism("smartcard-hsm"));
    case "pkcs11-tpm":
    case "ci-swtpm":
      return flattenMechanism(pickOpenbaoMechanism("tpm2-pkcs11"));
    case "lucent-shamir":
    case "kind-shamir":
      return "none";
  }
}

function ok(path: UnsealPath): IntegrateOk {
  const autoUnseal = AUTO_UNSEAL_PATHS.has(path);
  if (path === "lucent-shamir" || path === "kind-shamir") {
    return {
      ok: true,
      path,
      mechanism: mechanismFor(path),
      autoUnseal,
      threshold: UNSEAL_THRESHOLD,
    };
  }
  return { ok: true, path, mechanism: mechanismFor(path), autoUnseal };
}

function driverWithoutDevice(capture: HostHardwareCapture): boolean {
  return capture.pkcs11ModuleOnDisk && !hsmAccessible(capture) && !tpmAccessible(capture);
}

/**
 * Setup-time integration. PKCS#11 only if the device is accessible.
 * A driver on disk is not a device. Requested PKCS#11 that is missing
 * refuses — it does not quietly become Lucent.
 */
export function integrateAtSetup(request: SetupRequest, capture: HostHardwareCapture): IntegrateDecision {
  const requested = request.requested;

  if (requested === "ci-softhsm" || requested === "ci-swtpm") {
    return { ok: false, reason: "emulator-not-declared", requested };
  }

  if (requested === "lucent-shamir") {
    return ok("lucent-shamir");
  }
  if (requested === "kind-shamir") {
    return ok("kind-shamir");
  }

  if (requested === "pkcs11-yubihsm") {
    if (yubiHsmAccessible(capture)) return ok("pkcs11-yubihsm");
    if (hsmCheckDidNotRun(capture) || capture.yubiHsm2 === "not-asked") {
      return { ok: false, reason: "probe-did-not-run", requested };
    }
    if (driverWithoutDevice(capture)) {
      return { ok: false, reason: "driver-is-not-a-device", requested };
    }
    return { ok: false, reason: "requested-pkcs11-not-accessible", requested };
  }

  if (requested === "pkcs11-smartcard") {
    if (smartcardHsmAccessible(capture)) return ok("pkcs11-smartcard");
    if (driverWithoutDevice(capture)) {
      return { ok: false, reason: "driver-is-not-a-device", requested };
    }
    return { ok: false, reason: "requested-pkcs11-not-accessible", requested };
  }

  // Umbrella: either metal HSM vendor. Result names which one.
  if (requested === "pkcs11-hsm") {
    if (yubiHsmAccessible(capture)) return ok("pkcs11-yubihsm");
    if (smartcardHsmAccessible(capture)) return ok("pkcs11-smartcard");
    if (hsmCheckDidNotRun(capture) || capture.yubiHsm2 === "not-asked") {
      return { ok: false, reason: "probe-did-not-run", requested };
    }
    if (driverWithoutDevice(capture)) {
      return { ok: false, reason: "driver-is-not-a-device", requested };
    }
    return { ok: false, reason: "requested-pkcs11-not-accessible", requested };
  }

  if (requested === "pkcs11-tpm") {
    if (tpmAccessible(capture)) return ok("pkcs11-tpm");
    if (tpmCheckDidNotRun(capture) || capture.tpm2 === "not-asked") {
      return { ok: false, reason: "probe-did-not-run", requested };
    }
    if (driverWithoutDevice(capture)) {
      return { ok: false, reason: "driver-is-not-a-device", requested };
    }
    return { ok: false, reason: "requested-pkcs11-not-accessible", requested };
  }

  // auto: strongest accessible PKCS#11, else Lucent. Incomplete probe
  // is not "absent" — do not pick Lucent because we failed to look.
  // YubiHSM and SmartCard-HSM are peer vendors; if both are on the
  // same node, one OpenBao seal still wins (YubiHSM first, matching
  // host-seal-profile). Dual-vendor custody is ZetaFS k-of-n.
  if (yubiHsmAccessible(capture)) return ok("pkcs11-yubihsm");
  if (smartcardHsmAccessible(capture)) return ok("pkcs11-smartcard");
  if (tpmAccessible(capture)) return ok("pkcs11-tpm");
  if (automaticProbeIncomplete(capture)) {
    return { ok: false, reason: "probe-did-not-run", requested };
  }
  return ok("lucent-shamir");
}

export type IntegrateFromEnv =
  | { readonly ok: true; readonly decision: IntegrateDecision | null }
  | { readonly ok: false; readonly reason: NamedPathRequestError };

/**
 * Request from env, probe snapshot still injected. Missing
 * request is unmeasured (`decision` null) — not `auto`.
 * Null probe is unmeasured, not present. `/dev/tpmrm0`
 * refuses at parse and does not call `integrateAtSetup`.
 * `tpmDeviceNode` does not invent `tpm2: "present"`. Inner
 * `integrateAtSetup` still takes a capture.
 */
export function integrateAtSetupFromEnv(
  env: { readonly [key: string]: string | undefined },
  probe: NamedHardwareProbe | null,
): IntegrateFromEnv {
  const parsed = consumeUnsealRequestFromEnv(env);
  if (!parsed.ok) return parsed;
  if (parsed.requested === null) return { ok: true, decision: null };
  return {
    ok: true,
    decision: integrateAtSetup({ requested: parsed.requested }, hostCaptureFromNamedProbe(probe)),
  };
}

/**
 * Paths this node *could* honour. OpenBao still picks exactly one seal.
 * Lucent-Shamir stays listed so 1Password remains a peer path on metal
 * that also has an HSM.
 */
export function availablePaths(capture: HostHardwareCapture): readonly UnsealPath[] {
  const paths: UnsealPath[] = [];
  if (yubiHsmAccessible(capture)) paths.push("pkcs11-yubihsm");
  if (smartcardHsmAccessible(capture)) paths.push("pkcs11-smartcard");
  if (tpmAccessible(capture)) paths.push("pkcs11-tpm");
  paths.push("lucent-shamir");
  return paths;
}

/** One OpenBao seal per node — two distinct paths as seals refuse. */
export function refuseTwoOpenBaoSeals(paths: readonly UnsealPath[]): IntegrateDecision {
  const unique = [...new Set(paths)];
  if (unique.length <= 1) {
    return unique[0] === undefined ? { ok: false, reason: "no-path" } : ok(unique[0]);
  }
  return { ok: false, reason: "two-openbao-seals" };
}

/**
 * Emulator install matrix. SoftHSM / swtpm are *installed by the job*,
 * never inferred. A cell that wants an emulator the runner did not
 * install is fail-missing — skip-if-absent cannot wear pass.
 */
export function pickInstallPath(env: InstallEmulators): IntegrateDecision {
  if (env.softhsmInstalled) return ok("ci-softhsm");
  if (env.swtpmInstalled) return ok("ci-swtpm");
  if (env.lucentFetcherPresent) return ok("lucent-shamir");
  if (env.kindUnsealerPresent) return ok("kind-shamir");
  return { ok: false, reason: "no-path" };
}

export function emulatorMatrixCell(cell: {
  readonly wantSofthsm: boolean;
  readonly wantSwtpm: boolean;
  readonly softhsmInstalled: boolean;
  readonly swtpmInstalled: boolean;
  readonly lucentFetcherPresent?: boolean;
  readonly kindUnsealerPresent?: boolean;
}): IntegrateDecision {
  if (cell.wantSofthsm && !cell.softhsmInstalled) {
    return { ok: false, reason: "fail-missing" };
  }
  if (cell.wantSwtpm && !cell.swtpmInstalled) {
    return { ok: false, reason: "fail-missing" };
  }
  return pickInstallPath({
    softhsmInstalled: cell.softhsmInstalled,
    swtpmInstalled: cell.swtpmInstalled,
    lucentFetcherPresent: cell.lucentFetcherPresent ?? false,
    kindUnsealerPresent: cell.kindUnsealerPresent ?? false,
  });
}

export function skipIfAbsentCannotWearPass(): false {
  return false;
}

/**
 * Integrate path → overlay oracle. Lucent / kind are not a hostPath
 * overlay. CI emulators map so the overlay can refuse them by name.
 */
export function sealOracleFromUnsealPath(path: UnsealPath): SealOracle {
  switch (path) {
    case "pkcs11-yubihsm":
      return "yubihsm2";
    case "pkcs11-smartcard":
      return "smartcard-hsm";
    case "pkcs11-tpm":
      return "tpm2-pkcs11";
    case "ci-softhsm":
      return "softhsm2";
    case "ci-swtpm":
      return "swtpm";
    case "lucent-shamir":
    case "kind-shamir":
      return "none";
  }
}

/**
 * Setup join: the integrate decision is the oracle. Companion
 * *contents* still win. A refused integrate is no-oracle, not a seal.
 * Current chart ABI still cannot commit the stanza unless a
 * capture names a same-libc in-chart `bao`. Option D is a
 * named host load-site, not a chart seal.
 */
export function planSetupOverlayFromIntegrate(
  decision: IntegrateDecision,
  companionModulePath: string | null,
  moduleFileExists: boolean,
  baoElf?: BaoElfCapture | null,
): OverlayPlan {
  const oracle = decision.ok ? sealOracleFromUnsealPath(decision.path) : "none";
  return planSetupPkcs11Overlay({ oracle, companionModulePath, moduleFileExists, baoElf: baoElf ?? null });
}

/**
 * Injected read of `/etc/zeta/seal/pkcs11-module-path`.
 * `openedPath` is which file was opened, not the module.
 * Contents are the path *string*. No live filesystem here.
 */
export interface RestoredPkcs11PointerCapture {
  readonly openedPath: string;
  readonly exists: boolean;
  readonly contents: string | null;
  readonly resolvedModuleExists: boolean;
}

/** Only the restore file's contents count. Any other opened path is not this companion. */
export function companionContentsFromRestore(capture: RestoredPkcs11PointerCapture): string | null {
  if (capture.openedPath !== USB_PKCS11_MODULE_POINTER) return null;
  if (!capture.exists) return null;
  if (capture.contents === null) return null;
  const trimmed = capture.contents.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function planSetupFromRestoredCompanion(
  decision: IntegrateDecision,
  capture: RestoredPkcs11PointerCapture,
  baoElf?: BaoElfCapture | null,
): OverlayPlan {
  return planSetupOverlayFromIntegrate(
    decision,
    companionContentsFromRestore(capture),
    capture.resolvedModuleExists,
    baoElf,
  );
}

export function defaultMetalCapture(): HostHardwareCapture {
  return emptyCapture({ os: "nixos", yubiHsm2: "absent", tpm2: "absent" });
}
