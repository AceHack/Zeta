import { describe, expect, it } from "bun:test";
import {
  probeTpm2,
  probeYubikey,
  probePkcs11,
  probeHardwareSecurity,
} from "./frost-hardware-probe.ts";

describe("Hardware Security Device Probe", () => {
  it("probes TPM 2.0 device availability without crashing", () => {
    const tpm = probeTpm2();
    expect(typeof tpm.available).toBe("boolean");
  });

  it("probes YubiKey USB detection without crashing", () => {
    const yubi = probeYubikey();
    expect(typeof yubi.detected).toBe("boolean");
  });

  it("probes PKCS#11 shared library without crashing", () => {
    const pkcs11 = probePkcs11();
    expect(typeof pkcs11.found).toBe("boolean");
  });

  it("executes full hardware probe and sets fallbackToSimulator flag correctly", () => {
    const res = probeHardwareSecurity();
    expect(res.timestamp).toBeDefined();
    expect(typeof res.fallbackToSimulator).toBe("boolean");
    // When physical hardware is absent, fallbackToSimulator MUST be true
    if (!res.tpm2Available && !res.yubikeyDetected && !res.pkcs11ModuleFound) {
      expect(res.fallbackToSimulator).toBeTrue();
    }
  });
});
