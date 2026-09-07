import { describe, expect, test } from "bun:test";
import { ELF_INTERP_GLIBC_X86_64, TPM_CHAR_DEVICE } from "../../../src/Core.TypeScript/cluster/bao-load-site.ts";
import { USB_PKCS11_MODULE_POINTER, hostBaoSealHcl } from "../../../src/Core.TypeScript/cluster/pkcs11-hostpath-overlay.ts";
import { UNSEAL_REQUEST_ENV_KEY } from "../../../src/Core.TypeScript/cluster/unseal-path.ts";
import {
  FIRSTBOOT_BAO_ELF_EPOCH_KEY,
  NIXOS_HOST_BAO,
} from "../../../src/Core.TypeScript/installer/bao-elf-capture.ts";
import type { HardwareProbeResult } from "./frost-hardware-probe.ts";
import { planSetupFromFrostEnv } from "./plan-setup-from-frost.ts";

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

function elf64LeWithInterp(interp: string): Uint8Array {
  const interpBytes = new TextEncoder().encode(`${interp}\0`);
  const phoff = 64;
  const interpOff = phoff + 56;
  const buf = new Uint8Array(interpOff + interpBytes.length);
  const view = new DataView(buf.buffer);
  buf[0] = 0x7f;
  buf[1] = 0x45;
  buf[2] = 0x4c;
  buf[3] = 0x46;
  buf[4] = 2;
  buf[5] = 1;
  buf[6] = 1;
  view.setUint16(16, 3, true);
  view.setUint16(18, 0x3e, true);
  view.setUint32(20, 1, true);
  view.setBigUint64(32, BigInt(phoff), true);
  view.setUint16(52, 64, true);
  view.setUint16(54, 56, true);
  view.setUint16(56, 1, true);
  view.setUint32(phoff, 3, true);
  view.setBigUint64(phoff + 8, BigInt(interpOff), true);
  view.setBigUint64(phoff + 32, BigInt(interpBytes.length), true);
  buf.set(interpBytes, interpOff);
  return buf;
}

const missingRestore = {
  openedPath: USB_PKCS11_MODULE_POINTER,
  exists: false,
  contents: null,
  resolvedModuleExists: true,
};

function optionDEnv(request: string): { readonly [key: string]: string } {
  return {
    ZETA_BAO_LOAD_SITE: "on-host",
    ZETA_BAO_PATH: NIXOS_HOST_BAO,
    [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host",
    [UNSEAL_REQUEST_ENV_KEY]: request,
  };
}

function glibcRead(opened: string[]): (path: string) => { exists: boolean; bytes: Uint8Array | null } {
  return (path) => {
    opened.push(path);
    return {
      exists: true,
      bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
    };
  };
}

describe("planSetupFromFrostEnv — tpmrm0 is not present", () => {
  test("null frost result is unmeasured, not present — option D does not emit host HCL", () => {
    const opened: string[] = [];
    const fromNull = planSetupFromFrostEnv(missingRestore, optionDEnv("pkcs11-tpm"), glibcRead(opened), null, "nixos");
    expect(fromNull.ok).toBe(true);
    if (!fromNull.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromNull.plan.oracle).toBe("none");
    expect(fromNull.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromNull.plan)).toBeNull();
  });

  test("tpmrm0 plus indeterminate stays unmeasured; option D does not emit host HCL", () => {
    const opened: string[] = [];
    const fromNode = planSetupFromFrostEnv(
      missingRestore,
      optionDEnv("pkcs11-tpm"),
      glibcRead(opened),
      frostLook(),
      "nixos",
    );
    expect(fromNode.ok).toBe(true);
    if (!fromNode.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromNode.plan.oracle).toBe("none");
    expect(fromNode.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromNode.plan)).toBeNull();
  });

  test("tpm2Available does not override tpm2State", () => {
    const opened: string[] = [];
    const fromBool = planSetupFromFrostEnv(
      missingRestore,
      optionDEnv("pkcs11-tpm"),
      glibcRead(opened),
      frostLook({ tpm2Available: true, tpm2State: "indeterminate" }),
      "nixos",
    );
    expect(fromBool.ok).toBe(true);
    if (!fromBool.ok) return;
    expect(fromBool.plan.oracle).toBe("none");
    expect(fromBool.plan.mayCommitHostHcl).toBe(false);
  });

  test("YubiKey plus CCID reader is not CardContact SmartCard-HSM", () => {
    const opened: string[] = [];
    const fromKey = planSetupFromFrostEnv(
      missingRestore,
      optionDEnv("pkcs11-smartcard"),
      glibcRead(opened),
      frostLook(),
      "nixos",
    );
    expect(fromKey.ok).toBe(true);
    if (!fromKey.ok) return;
    expect(fromKey.plan.oracle).toBe("none");
    expect(fromKey.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromKey.plan)).toBeNull();
  });

  test("PKCS#11 driver on disk is not an attached YubiHSM", () => {
    const opened: string[] = [];
    const fromSo = planSetupFromFrostEnv(
      missingRestore,
      optionDEnv("pkcs11-yubihsm"),
      glibcRead(opened),
      frostLook({ pkcs11ModuleFound: true, yubiHsm2Pkcs11ModuleFound: true, yubiHsm2State: "indeterminate" }),
      "nixos",
    );
    expect(fromSo.ok).toBe(true);
    if (!fromSo.ok) return;
    expect(fromSo.plan.oracle).toBe("none");
    expect(fromSo.plan.mayCommitHostHcl).toBe(false);
  });

  test("named TPM present may emit host HCL and cannot commit Application.yaml", () => {
    const opened: string[] = [];
    const fromTpm = planSetupFromFrostEnv(
      missingRestore,
      optionDEnv("pkcs11-tpm"),
      glibcRead(opened),
      frostLook({
        tpm2Available: true,
        tpm2State: "present",
        yubikeyDetected: false,
        smartCardReaderAttached: false,
        pkcs11ModuleFound: false,
      }),
      "nixos",
    );
    expect(fromTpm.ok).toBe(true);
    if (!fromTpm.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromTpm.plan.oracle).toBe("tpm2-pkcs11");
    expect(fromTpm.plan.mayCommitSeal).toBe(false);
    expect(fromTpm.plan.mayCommitHostHcl).toBe(true);
  });

  test("missing unseal request is not auto even when frost names TPM present", () => {
    const opened: string[] = [];
    const missingRequest = planSetupFromFrostEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host",
      },
      glibcRead(opened),
      frostLook({
        tpm2Available: true,
        tpm2State: "present",
        yubikeyDetected: false,
        smartCardReaderAttached: false,
        pkcs11ModuleFound: false,
      }),
      "nixos",
    );
    expect(missingRequest.ok).toBe(true);
    if (!missingRequest.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(missingRequest.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(missingRequest.plan)).toBeNull();
  });

  test("cluster and ISO bun do not import this join", async () => {
    const files = [
      "../../../src/Core.TypeScript/cluster/unseal-path.ts",
      "../../../src/Core.TypeScript/cluster/host-seal-profile.ts",
      "../../../src/Core.TypeScript/installer/bao-elf-capture.ts",
      "../../../src/Core.TypeScript/zflash/firstboot-bao-env.ts",
      "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh",
    ];
    for (const rel of files) {
      const src = await Bun.file(new URL(rel, import.meta.url)).text();
      expect(src.split("plan-setup-from-frost").length - 1).toBe(0);
      expect(src.split("planSetupFromFrostEnv").length - 1).toBe(0);
    }
    const join = await Bun.file(new URL("./plan-setup-from-frost.ts", import.meta.url)).text();
    expect(join.split("probeHardwareSecurity(").length - 1).toBe(0);
    const bunCli = await Bun.file(new URL("../../../src/Core.TypeScript/zflash/firstboot-bao-env.ts", import.meta.url)).text();
    expect(bunCli.split("const probe: NamedHardwareProbe | null = null;").length - 1).toBe(1);
  });
});
