import { describe, expect, test } from "bun:test";
import { TPM_CHAR_DEVICE } from "../../../src/Core.TypeScript/cluster/bao-load-site.ts";
import {
  hostCaptureFromNamedProbe,
  pickSealOracleFromCapture,
} from "../../../src/Core.TypeScript/cluster/host-seal-profile.ts";
import { NIXOS_PKCS11_MODULE_PATH } from "../../../src/Core.TypeScript/cluster/pkcs11-hostpath-overlay.ts";
import type { HardwareProbeEffects } from "./frost-hardware-probe.ts";
import type { ListOutcome, PathOutcome, Tpm2LinuxEffects } from "./tpm2-linux-probe.ts";
import { namedProbeFromFrostLook } from "./named-probe-from-frost-look.ts";

function tpm2Absent(over: Partial<Tpm2LinuxEffects> = {}): Tpm2LinuxEffects {
  return {
    platform: "linux",
    statPath: () => ({ kind: "not-found" }),
    readText: () => ({ kind: "not-found" }),
    listDir: (p) => (p === "/sys/class/tpm" ? { kind: "listed", entries: [] } : { kind: "not-found" }),
    run: () => ({ kind: "not-installed" }),
    ...over,
  };
}

function tpm2Present(): Tpm2LinuxEffects {
  const found: PathOutcome = { kind: "found" };
  const chips: ListOutcome = { kind: "listed", entries: ["tpm0", "tpmrm0"] };
  return tpm2Absent({
    statPath: () => found,
    listDir: (p) => (p === "/sys/class/tpm" ? chips : { kind: "not-found" }),
    readText: (p) => (p.endsWith("tpm_version_major") ? { kind: "read", text: "2\n" } : { kind: "not-found" }),
  });
}

function host(over: Partial<HardwareProbeEffects> = {}): HardwareProbeEffects {
  return {
    exists: () => false,
    readDir: () => [],
    readFile: () => {
      throw new Error("no such file");
    },
    run: () => {
      throw new Error("command not found");
    },
    platform: "linux",
    ...over,
    tpm2: over.tpm2 ?? tpm2Absent({ platform: over.platform ?? "linux" }),
  };
}

describe("namedProbeFromFrostLook — tpmrm0 is not present", () => {
  test("null effects is unmeasured, not a live look", () => {
    expect(namedProbeFromFrostLook("nixos", null)).toBeNull();
    expect(hostCaptureFromNamedProbe(namedProbeFromFrostLook("nixos", null)).tpm2).toBe("not-asked");
  });

  test("tpmrm0 node without family stays indeterminate; oracle is none", () => {
    const probe = namedProbeFromFrostLook(
      "nixos",
      host({
        tpm2: tpm2Absent({
          statPath: (p) => (p === TPM_CHAR_DEVICE ? { kind: "found" } : { kind: "not-found" }),
          listDir: (p) => (p === "/sys/class/tpm" ? { kind: "listed", entries: ["tpmrm0"] } : { kind: "not-found" }),
        }),
      }),
    );
    expect(probe).toEqual({
      os: "nixos",
      tpm2: "indeterminate",
      tpmDeviceNode: null,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: false,
      yubikeyDetected: false,
      pkcs11ModuleOnDisk: false,
      smartcardHsm: false,
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("none");
  });

  test("YubiKey plus CCID reader is not CardContact SmartCard-HSM", () => {
    const probe = namedProbeFromFrostLook(
      "nixos",
      host({
        readDir: (p) => (p === "/sys/bus/usb/devices" ? ["1-1", "1-1:1.0"] : []),
        readFile: (p) => {
          if (p === "/sys/bus/usb/devices/1-1:1.0/bInterfaceClass") return "0b\n";
          throw new Error("no such file");
        },
      }),
    );
    expect(probe).toEqual({
      os: "nixos",
      tpm2: "absent",
      tpmDeviceNode: null,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: true,
      yubikeyDetected: true,
      pkcs11ModuleOnDisk: false,
      smartcardHsm: false,
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("none");
  });

  test("PKCS#11 driver on disk is not an attached YubiHSM", () => {
    const probe = namedProbeFromFrostLook(
      "nixos",
      host({
        exists: (p) => p === NIXOS_PKCS11_MODULE_PATH.yubihsm2 || p === NIXOS_PKCS11_MODULE_PATH["smartcard-hsm"],
      }),
    );
    expect(probe).toEqual({
      os: "nixos",
      tpm2: "absent",
      tpmDeviceNode: null,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: false,
      yubikeyDetected: false,
      pkcs11ModuleOnDisk: true,
      smartcardHsm: false,
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("none");
  });

  test("named TPM 2.0 present stays named", () => {
    const probe = namedProbeFromFrostLook("nixos", host({ tpm2: tpm2Present() }));
    expect(probe).toEqual({
      os: "nixos",
      tpm2: "present",
      tpmDeviceNode: TPM_CHAR_DEVICE,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: false,
      yubikeyDetected: false,
      pkcs11ModuleOnDisk: false,
      smartcardHsm: false,
    });
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("tpm2-pkcs11");
  });

  test("OS family stays named, not inferred from effects.platform", () => {
    const probe = namedProbeFromFrostLook("darwin", host({ platform: "linux", tpm2: tpm2Absent({ platform: "linux" }) }));
    expect(probe).toEqual({
      os: "darwin",
      tpm2: "absent",
      tpmDeviceNode: null,
      yubiHsm2: "indeterminate",
      smartCardReaderAttached: false,
      yubikeyDetected: false,
      pkcs11ModuleOnDisk: false,
      smartcardHsm: false,
    });
  });

  test("cluster and ISO bun do not import this look", async () => {
    const files = [
      "../../../src/Core.TypeScript/cluster/unseal-path.ts",
      "../../../src/Core.TypeScript/cluster/host-seal-profile.ts",
      "../../../src/Core.TypeScript/installer/bao-elf-capture.ts",
      "../../../src/Core.TypeScript/zflash/firstboot-bao-env.ts",
      "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh",
      "../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
      "./named-probe-from-frost.ts",
      "./plan-setup-from-frost.ts",
    ];
    for (const rel of files) {
      const src = await Bun.file(new URL(rel, import.meta.url)).text();
      expect(src.split("named-probe-from-frost-look").length - 1).toBe(0);
      expect(src.split("namedProbeFromFrostLook").length - 1).toBe(0);
    }
    const look = await Bun.file(new URL("./named-probe-from-frost-look.ts", import.meta.url)).text();
    expect(look.split("realProbeEffects(").length - 1).toBe(0);
    expect(look.split("integrateAtSetup(").length - 1).toBe(0);
    const bunCli = await Bun.file(new URL("../../../src/Core.TypeScript/zflash/firstboot-bao-env.ts", import.meta.url)).text();
    expect(bunCli.split("const probe: NamedHardwareProbe | null = null;").length - 1).toBe(1);
  });
});
