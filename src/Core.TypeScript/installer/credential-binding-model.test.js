import { describe, expect, it } from "bun:test";
import {
  ALL_BINDING_FACTOR_KINDS,
  ALL_BINDING_SCENARIOS,
  applyBindingScenario,
  attemptBindingScenarioDecrypt,
  bindingMaterialForContext,
  credentialBindingExpectationMatrix,
  expectedBindingScenarioOutcome,
  FIXTURE_ENCRYPT_CTX,
  FIXTURE_PASSPHRASE,
  shippedUsbUuidBindingRoundTrip
} from "./credential-binding-model.ts";
import { deriveKey, deriveKeyFromBindingMaterial, SALT_LEN } from "./zeta-creds-crypto.ts";
import { randomBytes } from "node:crypto";
describe("bindingMaterialForContext", () => {
  it("extracts each factor from fixture context", () => {
    expect(bindingMaterialForContext("usbUuid", FIXTURE_ENCRYPT_CTX)).toBe(FIXTURE_ENCRYPT_CTX.usbUuid);
    expect(bindingMaterialForContext("usbISerial", FIXTURE_ENCRYPT_CTX)).toBe(FIXTURE_ENCRYPT_CTX.usbISerial);
    expect(bindingMaterialForContext("uefiKeyfile", FIXTURE_ENCRYPT_CTX)).toBe(FIXTURE_ENCRYPT_CTX.uefiKeyfile);
    expect(bindingMaterialForContext("tpmSeal", FIXTURE_ENCRYPT_CTX)).toBe(FIXTURE_ENCRYPT_CTX.tpmSeal);
  });
  it("returns null when optional factor missing", () => {
    expect(bindingMaterialForContext("usbISerial", { usbUuid: "x" })).toBeNull();
    expect(bindingMaterialForContext("uefiKeyfile", { usbUuid: "x" })).toBeNull();
    expect(bindingMaterialForContext("tpmSeal", { usbUuid: "x" })).toBeNull();
  });
});
describe("applyBindingScenario", () => {
  it("changes uuid on reformat but keeps iSerial", () => {
    const next = applyBindingScenario("reformat_same_stick", FIXTURE_ENCRYPT_CTX);
    expect(next).not.toBeNull();
    if (!next)
      return;
    expect(next.usbUuid).not.toBe(FIXTURE_ENCRYPT_CTX.usbUuid);
    expect(next.usbISerial).toBe(FIXTURE_ENCRYPT_CTX.usbISerial);
  });
  it("clears uefi keyfile on esp_wipe", () => {
    const next = applyBindingScenario("esp_wipe", FIXTURE_ENCRYPT_CTX);
    expect(next?.uefiKeyfile).toBeUndefined();
  });
});
describe("expectedBindingScenarioOutcome \u2014 threat-model matrix", () => {
  it("documents usbUuid shipped flaw (reformat fails)", () => {
    expect(expectedBindingScenarioOutcome("usbUuid", "reformat_same_stick").decrypts).toBe(!1);
    expect(expectedBindingScenarioOutcome("usbUuid", "stick_swap").decrypts).toBe(!1);
  });
  it("documents usbISerial survives reformat", () => {
    expect(expectedBindingScenarioOutcome("usbISerial", "reformat_same_stick").decrypts).toBe(!0);
    expect(expectedBindingScenarioOutcome("usbISerial", "stick_swap").decrypts).toBe(!1);
  });
  it("documents tpmSeal is node-bound", () => {
    expect(expectedBindingScenarioOutcome("tpmSeal", "machine_swap").decrypts).toBe(!1);
    expect(expectedBindingScenarioOutcome("tpmSeal", "reformat_same_stick").decrypts).toBe(!0);
  });
  it("matrix has every factor \xD7 scenario cell", () => {
    const matrix = credentialBindingExpectationMatrix();
    for (const factor of ALL_BINDING_FACTOR_KINDS)
      for (const scenario of ALL_BINDING_SCENARIOS)
        expect(matrix[factor][scenario].reason.length).toBeGreaterThan(0);
  });
});
describe("attemptBindingScenarioDecrypt \u2014 crypto matches matrix", () => {
  for (const factor of ALL_BINDING_FACTOR_KINDS)
    for (const scenario of ALL_BINDING_SCENARIOS)
      it(`${factor} / ${scenario}`, () => {
        const { decryptSucceeded, expected } = attemptBindingScenarioDecrypt({
          factor,
          scenario
        });
        expect(decryptSucceeded).toBe(expected.decrypts);
      });
});
describe("shipped usbUuid path", () => {
  it("round-trips via binding model wrapper", () => {
    const pt = Buffer.from("shipped-path-fixture"), result = shippedUsbUuidBindingRoundTrip(FIXTURE_ENCRYPT_CTX.usbUuid, FIXTURE_PASSPHRASE, pt);
    expect(result.ok).toBe(!0);
    if (!result.ok)
      return;
    expect(result.plaintext.equals(pt)).toBe(!0);
  });
  it("deriveKey equals deriveKeyFromBindingMaterial for uuid string", () => {
    const salt = randomBytes(SALT_LEN), a = deriveKey(FIXTURE_ENCRYPT_CTX.usbUuid, FIXTURE_PASSPHRASE, salt), b = deriveKeyFromBindingMaterial(FIXTURE_ENCRYPT_CTX.usbUuid, FIXTURE_PASSPHRASE, salt);
    expect(a.equals(b)).toBe(!0);
  });
});
