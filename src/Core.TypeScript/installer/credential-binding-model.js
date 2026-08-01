import {
  decrypt,
  encryptWithBindingMaterial
} from "./zeta-creds-crypto.ts";
export const FIXTURE_ENCRYPT_CTX = {
  usbUuid: "9e8d7c6b-5a49-3827-1605-fedcba987654",
  usbISerial: "USB-STICK-SERIAL-001",
  uefiKeyfile: "uefi-keyfile-bytes-deadbeef",
  tpmSeal: "tpm-pcr-seal-node-alpha"
}, FIXTURE_PASSPHRASE = "correct horse battery staple", FIXTURE_WRONG_PASSPHRASE = "Tr0ub4dor&3";
const FACTOR_ORDER = [
  "usbUuid",
  "usbISerial",
  "uefiKeyfile",
  "tpmSeal"
];
export function bindingMaterialForContext(factor, ctx) {
  switch (factor) {
    case "usbUuid":
      return ctx.usbUuid.length > 0 ? ctx.usbUuid : null;
    case "usbISerial":
      return ctx.usbISerial !== void 0 && ctx.usbISerial.length > 0 ? ctx.usbISerial : null;
    case "uefiKeyfile":
      return ctx.uefiKeyfile !== void 0 && ctx.uefiKeyfile.length > 0 ? ctx.uefiKeyfile : null;
    case "tpmSeal":
      return ctx.tpmSeal !== void 0 && ctx.tpmSeal.length > 0 ? ctx.tpmSeal : null;
  }
}
export function applyBindingScenario(scenario, encryptCtx) {
  switch (scenario) {
    case "same_context":
      return encryptCtx;
    case "wrong_passphrase":
      return encryptCtx;
    case "reformat_same_stick":
      return {
        ...encryptCtx,
        usbUuid: "00000000-0000-0000-0000-111111111111"
      };
    case "stick_swap":
      return {
        usbUuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        usbISerial: "USB-STICK-SERIAL-OTHER",
        uefiKeyfile: encryptCtx.uefiKeyfile,
        tpmSeal: encryptCtx.tpmSeal
      };
    case "esp_wipe":
      return {
        ...encryptCtx,
        usbUuid: "00000000-0000-0000-0000-222222222222",
        uefiKeyfile: void 0
      };
    case "machine_swap":
      return {
        ...encryptCtx,
        tpmSeal: "tpm-pcr-seal-node-bravo"
      };
  }
}
export function expectedBindingScenarioOutcome(factor, scenario) {
  if (scenario === "same_context")
    return { decrypts: !0, reason: "baseline round-trip" };
  if (scenario === "wrong_passphrase")
    return { decrypts: !1, reason: "wrong passphrase always fails (GCM auth)" };
  switch (factor) {
    case "usbUuid":
      if (scenario === "reformat_same_stick" || scenario === "stick_swap" || scenario === "esp_wipe")
        return {
          decrypts: !1,
          reason: "FAT UUID is ephemeral \u2014 reformat/swap/ESP recreate changes UUID"
        };
      if (scenario === "machine_swap")
        return { decrypts: !0, reason: "usbUuid ignores TPM; same UUID material decrypts" };
      break;
    case "usbISerial":
      if (scenario === "reformat_same_stick" || scenario === "machine_swap")
        return { decrypts: !0, reason: "iSerial survives reformat and is stick-bound not node-bound" };
      if (scenario === "stick_swap")
        return { decrypts: !1, reason: "iSerial is physical-stick-bound" };
      if (scenario === "esp_wipe")
        return {
          decrypts: !0,
          reason: "ESP wipe does not change USB controller serial"
        };
      break;
    case "uefiKeyfile":
      if (scenario === "reformat_same_stick" || scenario === "stick_swap")
        return {
          decrypts: !0,
          reason: "keyfile on ESP survives reformat when ESP partition preserved"
        };
      if (scenario === "esp_wipe")
        return { decrypts: !1, reason: "full ESP wipe destroys uefi keyfile" };
      if (scenario === "machine_swap")
        return { decrypts: !0, reason: "uefi keyfile travels with stick image copy" };
      break;
    case "tpmSeal":
      if (scenario === "reformat_same_stick" || scenario === "stick_swap" || scenario === "esp_wipe")
        return { decrypts: !0, reason: "TPM seal is node-bound; stick events do not change PCR seal" };
      if (scenario === "machine_swap")
        return { decrypts: !1, reason: "TPM seal fails on different machine" };
      break;
  }
  return { decrypts: !1, reason: `unhandled matrix cell: ${factor}/${scenario}` };
}
export function credentialBindingExpectationMatrix() {
  const out = {};
  for (const factor of FACTOR_ORDER) {
    const row = {};
    for (const scenario of ALL_SCENARIOS)
      row[scenario] = expectedBindingScenarioOutcome(factor, scenario);
    out[factor] = row;
  }
  return out;
}
const ALL_SCENARIOS = [
  "same_context",
  "reformat_same_stick",
  "stick_swap",
  "esp_wipe",
  "machine_swap",
  "wrong_passphrase"
];
export const ALL_BINDING_FACTOR_KINDS = [
  "usbUuid",
  "usbISerial",
  "uefiKeyfile",
  "tpmSeal"
], ALL_BINDING_SCENARIOS = ALL_SCENARIOS;
export function attemptBindingScenarioDecrypt(input) {
  const encryptCtx = input.encryptCtx ?? FIXTURE_ENCRYPT_CTX, plaintext = input.plaintext ?? Buffer.from("zeta-cred-binding-fixture"), passphrase = input.passphrase ?? FIXTURE_PASSPHRASE, material = bindingMaterialForContext(input.factor, encryptCtx);
  if (material === null)
    return {
      decryptSucceeded: !1,
      expected: { decrypts: !1, reason: "encrypt context missing factor material" }
    };
  const envelope = encryptWithBindingMaterial(plaintext, material, passphrase), decryptCtx = applyBindingScenario(input.scenario, encryptCtx), expected = expectedBindingScenarioOutcome(input.factor, input.scenario);
  if (decryptCtx === null)
    return { decryptSucceeded: !1, expected };
  const decryptMaterial = bindingMaterialForContext(input.factor, decryptCtx);
  if (decryptMaterial === null)
    return { decryptSucceeded: !1, expected };
  const attemptPassphrase = input.scenario === "wrong_passphrase" ? FIXTURE_WRONG_PASSPHRASE : passphrase;
  return { decryptSucceeded: !("error" in decryptWithBindingMaterial(envelope, decryptMaterial, attemptPassphrase)), expected };
}
export function decryptWithBindingMaterial(envelope, bindingMaterial, passphrase) {
  return decrypt(envelope, bindingMaterial, passphrase);
}
export function shippedUsbUuidBindingRoundTrip(usbUuid, passphrase, plaintext) {
  const envelope = encryptWithBindingMaterial(plaintext, usbUuid, passphrase), result = decryptWithBindingMaterial(envelope, usbUuid, passphrase);
  if ("error" in result)
    return { ok: !1, error: result.error };
  return { ok: !0, plaintext: result };
}
