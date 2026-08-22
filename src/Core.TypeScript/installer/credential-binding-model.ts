/**
 * credential-binding-model.ts — injectable binding factors + reformat/swap
 * expectations for zeta-creds.enc (USB-IDENTITY-THREAT-MODEL §4 / §8).
 *
 * Pure: no I/O. Composes with zeta-creds-crypto.ts (scrypt → HKDF → AES-GCM).
 *
 * Shipped today: `usbUuid` (FAT filesystem UUID — breaks on reformat).
 * Research: `tpmSeal`. `uefiKeyfile` ESP persist planner + opt-in persist
 * (`uefi-keyfile-esp.ts` `--write`) and restore from `/boot/EFI/ZETA/keyfile`.
 * `usbISerial` sysfs probe landed (`usb-iserial-probe.ts`). Neither is the
 * default persist path.
 */

import { decrypt, encryptWithBindingMaterial, type Envelope } from "./zeta-creds-crypto.ts";

export type CredentialBindingFactorKind = "usbUuid" | "usbISerial" | "uefiKeyfile" | "tpmSeal";

/**
 * Operator / install contexts that mutate between encrypt and decrypt attempts.
 * Names match threat-model rows (reformat, stick swap, ESP wipe, machine swap).
 */
export type CredentialBindingScenario =
  | "same_context"
  | "reformat_same_stick"
  | "stick_swap"
  | "esp_wipe"
  | "machine_swap"
  | "wrong_passphrase";

/** Inputs available at encrypt and decrypt time (all injectable for tests). */
export type BindingContext = {
  readonly usbUuid: string;
  // `?: T | undefined` (not just `?: T`) is deliberate under `exactOptionalPropertyTypes`: these
  // fields model factors that can be EXPLICITLY GONE, not merely absent — e.g. `esp_wipe` sets
  // `uefiKeyfile: undefined` to model the keyfile being wiped. Narrowing these to `?: T` would
  // force those scenarios to omit the key, losing the distinction between "wiped" and "unknown".
  readonly usbISerial?: string | undefined;
  readonly uefiKeyfile?: string | undefined;
  readonly tpmSeal?: string | undefined;
};

export type BindingScenarioOutcome = {
  readonly decrypts: boolean;
  readonly reason: string;
};

/** Stable test fixtures — not production secrets. */
// `satisfies` (not `: BindingContext`) so the fixture keeps its CONCRETE shape — every field is
// present here, so `FIXTURE_ENCRYPT_CTX.usbISerial` types as `string`, not `string | undefined`.
// That lets tests compare it against `bindingMaterialForContext`'s `string | null` without
// sprinkling non-null assertions, while staying assignable to `BindingContext`.
export const FIXTURE_ENCRYPT_CTX = {
  usbUuid: "9e8d7c6b-5a49-3827-1605-fedcba987654",
  usbISerial: "USB-STICK-SERIAL-001",
  uefiKeyfile: "uefi-keyfile-bytes-deadbeef",
  tpmSeal: "tpm-pcr-seal-node-alpha",
} satisfies BindingContext;

export const FIXTURE_PASSPHRASE = "correct horse battery staple";
export const FIXTURE_WRONG_PASSPHRASE = "Tr0ub4dor&3";

const FACTOR_ORDER: readonly CredentialBindingFactorKind[] = ["usbUuid", "usbISerial", "uefiKeyfile", "tpmSeal"];

/**
 * Material bound into HKDF for a given factor kind.
 * Returns null when the factor is absent from context (decrypt impossible).
 */
export function bindingMaterialForContext(factor: CredentialBindingFactorKind, ctx: BindingContext): string | null {
  switch (factor) {
    case "usbUuid":
      return ctx.usbUuid.length > 0 ? ctx.usbUuid : null;
    case "usbISerial":
      return ctx.usbISerial !== undefined && ctx.usbISerial.length > 0 ? ctx.usbISerial : null;
    case "uefiKeyfile":
      return ctx.uefiKeyfile !== undefined && ctx.uefiKeyfile.length > 0 ? ctx.uefiKeyfile : null;
    case "tpmSeal":
      return ctx.tpmSeal !== undefined && ctx.tpmSeal.length > 0 ? ctx.tpmSeal : null;
  }
}

/**
 * Apply a scenario mutation to the encrypt-time context (what decrypt sees later).
 * Returns null when required factor material is missing after mutation.
 */
export function applyBindingScenario(
  scenario: CredentialBindingScenario,
  encryptCtx: BindingContext,
): BindingContext | null {
  switch (scenario) {
    case "same_context":
      return encryptCtx;
    case "wrong_passphrase":
      return encryptCtx;
    case "reformat_same_stick":
      // FAT UUID changes; physical stick + ESP keyfile (if any) unchanged.
      return {
        ...encryptCtx,
        usbUuid: "00000000-0000-0000-0000-111111111111",
      };
    case "stick_swap":
      // Different physical stick: new UUID + new iSerial; ESP contents may travel
      // if operator cloned the partition — model the "new stick" case (no uefi keyfile
      // unless explicitly carried).
      return {
        usbUuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        usbISerial: "USB-STICK-SERIAL-OTHER",
        uefiKeyfile: encryptCtx.uefiKeyfile,
        tpmSeal: encryptCtx.tpmSeal,
      };
    case "esp_wipe":
      // Full ESP wipe: uefi keyfile gone; uuid may change on recreate.
      return {
        ...encryptCtx,
        usbUuid: "00000000-0000-0000-0000-222222222222",
        uefiKeyfile: undefined,
      };
    case "machine_swap":
      // Same stick/file copy, different machine TPM seal.
      return {
        ...encryptCtx,
        tpmSeal: "tpm-pcr-seal-node-bravo",
      };
  }
}

/**
 * Declarative expectation matrix (USB-IDENTITY-THREAT-MODEL §4).
 * Used by unit tests and threat-review tooling — single source of truth.
 */
export function expectedBindingScenarioOutcome(
  factor: CredentialBindingFactorKind,
  scenario: CredentialBindingScenario,
): BindingScenarioOutcome {
  if (scenario === "same_context") {
    return { decrypts: true, reason: "baseline round-trip" };
  }
  if (scenario === "wrong_passphrase") {
    return { decrypts: false, reason: "wrong passphrase always fails (GCM auth)" };
  }

  switch (factor) {
    case "usbUuid":
      if (scenario === "reformat_same_stick" || scenario === "stick_swap" || scenario === "esp_wipe") {
        return {
          decrypts: false,
          reason: "FAT UUID is ephemeral — reformat/swap/ESP recreate changes UUID",
        };
      }
      if (scenario === "machine_swap") {
        return { decrypts: true, reason: "usbUuid ignores TPM; same UUID material decrypts" };
      }
      break;
    case "usbISerial":
      if (scenario === "reformat_same_stick" || scenario === "machine_swap") {
        return { decrypts: true, reason: "iSerial survives reformat and is stick-bound not node-bound" };
      }
      if (scenario === "stick_swap") {
        return { decrypts: false, reason: "iSerial is physical-stick-bound" };
      }
      if (scenario === "esp_wipe") {
        return {
          decrypts: true,
          reason: "ESP wipe does not change USB controller serial",
        };
      }
      break;
    case "uefiKeyfile":
      if (scenario === "reformat_same_stick" || scenario === "stick_swap") {
        return {
          decrypts: true,
          reason: "keyfile on ESP survives reformat when ESP partition preserved",
        };
      }
      if (scenario === "esp_wipe") {
        return { decrypts: false, reason: "full ESP wipe destroys uefi keyfile" };
      }
      if (scenario === "machine_swap") {
        return { decrypts: true, reason: "uefi keyfile travels with stick image copy" };
      }
      break;
    case "tpmSeal":
      if (scenario === "reformat_same_stick" || scenario === "stick_swap" || scenario === "esp_wipe") {
        return { decrypts: true, reason: "TPM seal is node-bound; stick events do not change PCR seal" };
      }
      if (scenario === "machine_swap") {
        return { decrypts: false, reason: "TPM seal fails on different machine" };
      }
      break;
  }

  return { decrypts: false, reason: `unhandled matrix cell: ${factor}/${scenario}` };
}

/** Full factor × scenario matrix for docs and CI tables. */
export function credentialBindingExpectationMatrix(): Readonly<
  Record<CredentialBindingFactorKind, Readonly<Record<CredentialBindingScenario, BindingScenarioOutcome>>>
> {
  const out = {} as Record<CredentialBindingFactorKind, Record<CredentialBindingScenario, BindingScenarioOutcome>>;
  for (const factor of FACTOR_ORDER) {
    const row: Record<CredentialBindingScenario, BindingScenarioOutcome> = {} as Record<
      CredentialBindingScenario,
      BindingScenarioOutcome
    >;
    for (const scenario of ALL_SCENARIOS) {
      row[scenario] = expectedBindingScenarioOutcome(factor, scenario);
    }
    out[factor] = row;
  }
  return out;
}

const ALL_SCENARIOS: readonly CredentialBindingScenario[] = [
  "same_context",
  "reformat_same_stick",
  "stick_swap",
  "esp_wipe",
  "machine_swap",
  "wrong_passphrase",
];

export const ALL_BINDING_FACTOR_KINDS = [
  "usbUuid",
  "usbISerial",
  "uefiKeyfile",
  "tpmSeal",
] as const satisfies readonly CredentialBindingFactorKind[];

export const ALL_BINDING_SCENARIOS = ALL_SCENARIOS;

export type BindingRoundTripResult =
  | { readonly ok: true; readonly plaintext: Buffer }
  | { readonly ok: false; readonly error: string };

/**
 * Encrypt with a binding factor, then attempt decrypt under a scenario mutation.
 * Returns whether GCM decrypt succeeded (not whether expectation matched).
 */
export function attemptBindingScenarioDecrypt(input: {
  readonly factor: CredentialBindingFactorKind;
  readonly scenario: CredentialBindingScenario;
  readonly encryptCtx?: BindingContext;
  readonly plaintext?: Uint8Array;
  readonly passphrase?: string;
}): { readonly decryptSucceeded: boolean; readonly expected: BindingScenarioOutcome } {
  const encryptCtx = input.encryptCtx ?? FIXTURE_ENCRYPT_CTX;
  const plaintext = input.plaintext ?? Buffer.from("zeta-cred-binding-fixture");
  const passphrase = input.passphrase ?? FIXTURE_PASSPHRASE;

  const material = bindingMaterialForContext(input.factor, encryptCtx);
  if (material === null) {
    return {
      decryptSucceeded: false,
      expected: { decrypts: false, reason: "encrypt context missing factor material" },
    };
  }

  const envelope = encryptWithBindingMaterial(plaintext, material, passphrase);
  const decryptCtx = applyBindingScenario(input.scenario, encryptCtx);
  const expected = expectedBindingScenarioOutcome(input.factor, input.scenario);

  if (decryptCtx === null) {
    return { decryptSucceeded: false, expected };
  }

  const decryptMaterial = bindingMaterialForContext(input.factor, decryptCtx);
  if (decryptMaterial === null) {
    return { decryptSucceeded: false, expected };
  }

  const attemptPassphrase = input.scenario === "wrong_passphrase" ? FIXTURE_WRONG_PASSPHRASE : passphrase;
  const result = decryptWithBindingMaterial(envelope, decryptMaterial, attemptPassphrase);
  const decryptSucceeded = !("error" in result);
  return { decryptSucceeded, expected };
}

export function decryptWithBindingMaterial(
  envelope: Envelope,
  bindingMaterial: string,
  passphrase: string,
): Buffer | { readonly error: string } {
  return decrypt(envelope, bindingMaterial, passphrase);
}

/** Shipped-path alias: usbUuid factor uses the same material string as today. */
export function shippedUsbUuidBindingRoundTrip(
  usbUuid: string,
  passphrase: string,
  plaintext: Uint8Array,
): BindingRoundTripResult {
  const envelope = encryptWithBindingMaterial(plaintext, usbUuid, passphrase);
  const result = decryptWithBindingMaterial(envelope, usbUuid, passphrase);
  if ("error" in result) return { ok: false, error: result.error };
  return { ok: true, plaintext: result };
}
