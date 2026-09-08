import { describe, expect, test } from "bun:test";
import { TPM_CHAR_DEVICE } from "../../../src/Core.TypeScript/cluster/bao-load-site.ts";
import {
  hostCaptureFromNamedProbe,
  pickSealOracleFromCapture,
} from "../../../src/Core.TypeScript/cluster/host-seal-profile.ts";
import type { HardwareProbeResult } from "./frost-hardware-probe.ts";
import { namedProbeFromFrostResult } from "./named-probe-from-frost.ts";

function frostLook(partial: Partial<HardwareProbeResult> = {}): HardwareProbeResult {
  return {
    timestamp: "2026-09-07T00:00:00.000Z",
    tpm2Available: false,
    tpm2State: "indeterminate",
    tpm2Reason: "node without family",
    tpmDeviceNode: TPM_CHAR_DEVICE,
    yubikeyDetected: true,
    smartCardReaderAttached: true,
    pkcs11ModuleFound: true,
    yubiHsm2Detected: false,
    yubiHsm2State: "indeterminate",
    yubiHsm2Reason: "check did not run",
    yubiHsm2Pkcs11ModuleFound: false,
    secureEnclaveAvailable: false,
    noHardwareDetected: true,
    ...partial,
  };
}

describe("namedProbeFromFrostResult — tpmrm0 is not present", () => {
  test("null frost result is unmeasured, not absent", () => {
    expect(namedProbeFromFrostResult(null, "nixos")).toBeNull();
    expect(hostCaptureFromNamedProbe(namedProbeFromFrostResult(null, "nixos")).tpm2).toBe("not-asked");
  });

  test("tpmrm0 plus indeterminate stays indeterminate; oracle is none", () => {
    const probe = namedProbeFromFrostResult(frostLook(), "nixos");
    expect(probe).toEqual({
      os: "nixos",
      tpm2: "indeterminate",
      tpmDeviceNode: TPM_CHAR_DEVICE,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: true,
      yubikeyDetected: true,
      pkcs11ModuleOnDisk: true,
      smartcardHsm: "not-asked",
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("none");
  });

  test("tpm2Available does not override tpm2State", () => {
    const probe = namedProbeFromFrostResult(frostLook({ tpm2Available: true, tpm2State: "indeterminate" }), "nixos");
    expect(probe).toEqual({
      os: "nixos",
      tpm2: "indeterminate",
      tpmDeviceNode: TPM_CHAR_DEVICE,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: true,
      yubikeyDetected: true,
      pkcs11ModuleOnDisk: true,
      smartcardHsm: "not-asked",
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("none");
  });

  test("YubiKey plus CCID reader is not CardContact SmartCard-HSM", () => {
    const probe = namedProbeFromFrostResult(frostLook(), "nixos");
    expect(probe).toEqual({
      os: "nixos",
      tpm2: "indeterminate",
      tpmDeviceNode: TPM_CHAR_DEVICE,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: true,
      yubikeyDetected: true,
      pkcs11ModuleOnDisk: true,
      smartcardHsm: "not-asked",
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("none");
  });

  test("PKCS#11 driver on disk is not an attached YubiHSM", () => {
    const probe = namedProbeFromFrostResult(
      frostLook({ pkcs11ModuleFound: true, yubiHsm2Pkcs11ModuleFound: true, yubiHsm2State: "indeterminate" }),
      "nixos",
    );
    expect(probe).toEqual({
      os: "nixos",
      tpm2: "indeterminate",
      tpmDeviceNode: TPM_CHAR_DEVICE,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: true,
      yubikeyDetected: true,
      pkcs11ModuleOnDisk: true,
      smartcardHsm: "not-asked",
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("none");
  });

  test("named TPM present and named YubiHSM attached stay named", () => {
    const tpm = namedProbeFromFrostResult(
      frostLook({
        tpm2Available: true,
        tpm2State: "present",
        yubikeyDetected: false,
        smartCardReaderAttached: false,
        pkcs11ModuleFound: false,
      }),
      "nixos",
    );
    expect(tpm).toEqual({
      os: "nixos",
      tpm2: "present",
      tpmDeviceNode: TPM_CHAR_DEVICE,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: false,
      yubikeyDetected: false,
      pkcs11ModuleOnDisk: false,
      smartcardHsm: "not-asked",
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(tpm))).toBe("tpm2-pkcs11");
    const hsm = namedProbeFromFrostResult(
      frostLook({
        yubiHsm2Detected: true,
        yubiHsm2State: "attached",
        yubikeyDetected: false,
        smartCardReaderAttached: false,
        pkcs11ModuleFound: false,
      }),
      "nixos",
    );
    expect(hsm).toEqual({
      os: "nixos",
      tpm2: "indeterminate",
      tpmDeviceNode: TPM_CHAR_DEVICE,
      yubiHsm2: "attached",
      smartCardReaderAttached: false,
      yubikeyDetected: false,
      pkcs11ModuleOnDisk: false,
      smartcardHsm: "not-asked",
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(hsm))).toBe("yubihsm2");
  });

  test("OS family stays named, not inferred", () => {
    const probe = namedProbeFromFrostResult(frostLook({ tpm2State: "absent", tpmDeviceNode: undefined }), "darwin");
    expect(probe).toEqual({
      os: "darwin",
      tpm2: "absent",
      tpmDeviceNode: null,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: true,
      yubikeyDetected: true,
      pkcs11ModuleOnDisk: true,
      smartcardHsm: "not-asked",
    });
  });

  test("cluster and ISO bun do not import this mapper", async () => {
    const files = [
      "../../../src/Core.TypeScript/cluster/unseal-path.ts",
      "../../../src/Core.TypeScript/cluster/host-seal-profile.ts",
      "../../../src/Core.TypeScript/installer/bao-elf-capture.ts",
      "../../../src/Core.TypeScript/zflash/firstboot-bao-env.ts",
      "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    ];
    for (const rel of files) {
      const src = await Bun.file(new URL(rel, import.meta.url)).text();
      expect(src.split("named-probe-from-frost").length - 1).toBe(0);
      expect(src.split("namedProbeFromFrostResult").length - 1).toBe(0);
    }
    const mapper = await Bun.file(new URL("./named-probe-from-frost.ts", import.meta.url)).text();
    expect(mapper.split("probeHardwareSecurity(").length - 1).toBe(0);
    expect(mapper.split("integrateAtSetup(").length - 1).toBe(0);
    expect(mapper.split("integrateAtSetupFromEnv(").length - 1).toBe(0);
  });
});
