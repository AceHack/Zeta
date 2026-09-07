import { describe, expect, test } from "bun:test";
import { ELF_INTERP_GLIBC_X86_64, TPM_CHAR_DEVICE } from "../../../src/Core.TypeScript/cluster/bao-load-site.ts";
import { USB_PKCS11_MODULE_POINTER, hostBaoSealHcl } from "../../../src/Core.TypeScript/cluster/pkcs11-hostpath-overlay.ts";
import { UNSEAL_REQUEST_ENV_KEY } from "../../../src/Core.TypeScript/cluster/unseal-path.ts";
import {
  FIRSTBOOT_BAO_ELF_EPOCH_KEY,
  FIRSTBOOT_BAO_LOAD_SITE_KEY,
  FIRSTBOOT_BAO_PATH_KEY,
  NIXOS_HOST_BAO,
} from "../../../src/Core.TypeScript/installer/bao-elf-capture.ts";
import type { HardwareProbeEffects } from "./frost-hardware-probe.ts";
import type { ListOutcome, PathOutcome, Tpm2LinuxEffects } from "./tpm2-linux-probe.ts";
import {
  FROST_LOOK_EFFECTS_KEY,
  FROST_LOOK_OS_FLAG,
  FROST_LOOK_OS_KEY,
} from "./named-frost-look.ts";
import {
  planSetupFromFrostLookArgv,
  planSetupFromFrostLookConf,
  planSetupFromFrostLookEnv,
  planSetupFromFrostLookNamedArgv,
  planSetupFromFrostLookNamedConf,
  planSetupFromFrostLookNamedEnv,
  planSetupFromFrostLookOptionalNamedArgv,
  planSetupFromFrostLookOptionalNamedBunJson,
  planSetupFromFrostLookOptionalNamedConf,
  planSetupFromFrostLookOptionalNamedEnv,
} from "./plan-setup-from-frost-look.ts";

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

function unusedReal(): HardwareProbeEffects {
  return host({
    exists: () => {
      throw new Error("unmeasured look does not use real effects");
    },
    tpm2: tpm2Absent({
      statPath: () => {
        throw new Error("unmeasured look does not use real effects");
      },
    }),
  });
}

function optionDEnv(request: string): { readonly [key: string]: string } {
  return {
    ZETA_BAO_LOAD_SITE: "on-host",
    ZETA_BAO_PATH: NIXOS_HOST_BAO,
    [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host",
    [UNSEAL_REQUEST_ENV_KEY]: request,
  };
}

function requestEnv(request: string): { readonly [key: string]: string } {
  return { [UNSEAL_REQUEST_ENV_KEY]: request };
}

function optionDArgv(): readonly string[] {
  return ["--bao-load-site=on-host", `--bao-path=${NIXOS_HOST_BAO}`];
}

function optionDConf(): string {
  return `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'\n${FIRSTBOOT_BAO_PATH_KEY}='${NIXOS_HOST_BAO}'\n`;
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

describe("planSetupFromFrostLookEnv — tpmrm0 is not present", () => {
  test("null effects is unmeasured, not a live look — option D does not emit host HCL", () => {
    const opened: string[] = [];
    const fromNull = planSetupFromFrostLookEnv(
      missingRestore,
      optionDEnv("pkcs11-tpm"),
      glibcRead(opened),
      null,
      "nixos",
    );
    expect(fromNull.ok).toBe(true);
    if (!fromNull.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromNull.plan.oracle).toBe("none");
    expect(fromNull.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromNull.plan)).toBeNull();
  });

  test("tpmrm0 node without family stays indeterminate; oracle is none", () => {
    const opened: string[] = [];
    const fromNode = planSetupFromFrostLookEnv(
      missingRestore,
      optionDEnv("pkcs11-tpm"),
      glibcRead(opened),
      host({
        tpm2: tpm2Absent({
          statPath: (p) => (p === TPM_CHAR_DEVICE ? { kind: "found" } : { kind: "not-found" }),
          listDir: (p) => (p === "/sys/class/tpm" ? { kind: "listed", entries: ["tpmrm0"] } : { kind: "not-found" }),
        }),
      }),
      "nixos",
    );
    expect(fromNode.ok).toBe(true);
    if (!fromNode.ok) return;
    expect(fromNode.plan.oracle).toBe("none");
    expect(fromNode.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromNode.plan)).toBeNull();
  });

  test("YubiKey plus CCID reader is not CardContact SmartCard-HSM", () => {
    const fromKey = planSetupFromFrostLookEnv(
      missingRestore,
      optionDEnv("pkcs11-smartcard"),
      glibcRead([]),
      host({
        readDir: (p) => (p === "/sys/bus/usb/devices" ? ["1-1", "1-1:1.0"] : []),
        readFile: (p) => {
          if (p === "/sys/bus/usb/devices/1-1:1.0/bInterfaceClass") return "0b\n";
          throw new Error("no such file");
        },
      }),
      "nixos",
    );
    expect(fromKey.ok).toBe(true);
    if (!fromKey.ok) return;
    expect(fromKey.plan.oracle).toBe("none");
    expect(fromKey.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromKey.plan)).toBeNull();
  });

  test("named TPM 2.0 present may emit host HCL and cannot commit Application.yaml", () => {
    const opened: string[] = [];
    const fromTpm = planSetupFromFrostLookEnv(
      missingRestore,
      optionDEnv("pkcs11-tpm"),
      glibcRead(opened),
      host({ tpm2: tpm2Present() }),
      "nixos",
    );
    expect(fromTpm.ok).toBe(true);
    if (!fromTpm.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromTpm.plan.oracle).toBe("tpm2-pkcs11");
    expect(fromTpm.plan.mayCommitSeal).toBe(false);
    expect(fromTpm.plan.mayCommitHostHcl).toBe(true);
    expect(hostBaoSealHcl(fromTpm.plan)).not.toBeNull();
  });

  test("cluster and ISO bun do not import this look join", async () => {
    const files = [
      "../../../src/Core.TypeScript/cluster/unseal-path.ts",
      "../../../src/Core.TypeScript/cluster/host-seal-profile.ts",
      "../../../src/Core.TypeScript/installer/bao-elf-capture.ts",
      "../../../src/Core.TypeScript/zflash/firstboot-bao-env.ts",
      "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh",
      "../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
      "./plan-setup-from-frost.ts",
    ];
    for (const rel of files) {
      const src = await Bun.file(new URL(rel, import.meta.url)).text();
      expect(src.split("plan-setup-from-frost-look").length - 1).toBe(0);
      expect(src.split("planSetupFromFrostLookEnv").length - 1).toBe(0);
      expect(src.split("planSetupFromFrostLookArgv").length - 1).toBe(0);
      expect(src.split("planSetupFromFrostLookConf").length - 1).toBe(0);
      expect(src.split("planSetupFromFrostLookOptionalNamedEnv").length - 1).toBe(0);
      expect(src.split("planSetupFromFrostLookOptionalNamedArgv").length - 1).toBe(0);
      expect(src.split("planSetupFromFrostLookOptionalNamedConf").length - 1).toBe(0);
      expect(src.split("planSetupFromFrostLookOptionalNamedBunJson").length - 1).toBe(0);
    }
    const join = await Bun.file(new URL("./plan-setup-from-frost-look.ts", import.meta.url)).text();
    expect(join.split("realProbeEffects(").length - 1).toBe(0);
    expect(join.split("appendFirstbootBaoElfConf(").length - 1).toBe(0);
    expect(join.split("named-frost-look-env").length - 1).toBe(0);
    expect(join.split("runFrostLook").length - 1).toBe(0);
    expect(join.split("planSetupFromFrostLookNamedEnv").length - 1).toBe(1);
    expect(join.split("planSetupFromFrostLookNamedArgv").length - 1).toBe(1);
    expect(join.split("planSetupFromFrostLookNamedConf").length - 1).toBe(1);
    expect(join.split("planSetupFromFrostLookOptionalNamedEnv").length - 1).toBe(1);
    expect(join.split("planSetupFromFrostLookOptionalNamedArgv").length - 1).toBe(1);
    expect(join.split("planSetupFromFrostLookOptionalNamedConf").length - 1).toBe(1);
    expect(join.split("planSetupFromFrostLookOptionalNamedBunJson").length - 1).toBe(1);
    const resultJoin = await Bun.file(new URL("./plan-setup-from-frost.ts", import.meta.url)).text();
    expect(resultJoin.split("probeHardwareSecurity(").length - 1).toBe(0);
    const bunCli = await Bun.file(new URL("../../../src/Core.TypeScript/zflash/firstboot-bao-env.ts", import.meta.url)).text();
    expect(bunCli.split("const probe: NamedHardwareProbe | null = null;").length - 1).toBe(1);
    expect(bunCli.split("named-frost-look-env").length - 1).toBe(0);
    expect(bunCli.split("consumeOptionalFrostLookFromEnv(").length - 1).toBe(1);
    expect(bunCli.split("consumeOptionalFrostLookFromArgv").length - 1).toBe(0);
    expect(bunCli.split("planSetupFromFrostLookOptionalNamedEnv").length - 1).toBe(0);
    expect(bunCli.split("planSetupFromFrostLookOptionalNamedBunJson").length - 1).toBe(0);
    expect(bunCli.split("consumeOptionalFrostLookFromBunJson").length - 1).toBe(0);
  });
});

describe("planSetupFromFrostLookArgv/Conf — tpmrm0 is not present", () => {
  test("null effects is unmeasured on argv and conf", () => {
    const argvOpened: string[] = [];
    const fromArgv = planSetupFromFrostLookArgv(
      missingRestore,
      optionDArgv(),
      requestEnv("pkcs11-tpm"),
      glibcRead(argvOpened),
      null,
      "nixos",
    );
    expect(fromArgv.ok).toBe(true);
    if (!fromArgv.ok) return;
    expect(argvOpened).toEqual([NIXOS_HOST_BAO]);
    expect(fromArgv.plan.oracle).toBe("none");
    expect(fromArgv.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromArgv.plan)).toBeNull();
    const confOpened: string[] = [];
    const fromConf = planSetupFromFrostLookConf(
      missingRestore,
      optionDConf(),
      requestEnv("pkcs11-tpm"),
      glibcRead(confOpened),
      null,
      "nixos",
    );
    expect(fromConf.ok).toBe(true);
    if (!fromConf.ok) return;
    expect(confOpened).toEqual([NIXOS_HOST_BAO]);
    expect(fromConf.plan.oracle).toBe("none");
    expect(fromConf.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromConf.plan)).toBeNull();
  });

  test("tpmrm0 plus indeterminate stays unmeasured on argv and conf", () => {
    const node = host({
      tpm2: tpm2Absent({
        statPath: (p) => (p === TPM_CHAR_DEVICE ? { kind: "found" } : { kind: "not-found" }),
        listDir: (p) => (p === "/sys/class/tpm" ? { kind: "listed", entries: ["tpmrm0"] } : { kind: "not-found" }),
      }),
    });
    const fromArgv = planSetupFromFrostLookArgv(
      missingRestore,
      optionDArgv(),
      requestEnv("pkcs11-tpm"),
      glibcRead([]),
      node,
      "nixos",
    );
    expect(fromArgv.ok).toBe(true);
    if (!fromArgv.ok) return;
    expect(fromArgv.plan.oracle).toBe("none");
    expect(fromArgv.plan.mayCommitHostHcl).toBe(false);
    const fromConf = planSetupFromFrostLookConf(
      missingRestore,
      optionDConf(),
      requestEnv("pkcs11-tpm"),
      glibcRead([]),
      node,
      "nixos",
    );
    expect(fromConf.ok).toBe(true);
    if (!fromConf.ok) return;
    expect(fromConf.plan.oracle).toBe("none");
    expect(fromConf.plan.mayCommitHostHcl).toBe(false);
  });

  test("named TPM present may emit host HCL on argv and conf and cannot commit Application.yaml", () => {
    const fx = host({ tpm2: tpm2Present() });
    const argvOpened: string[] = [];
    const fromArgv = planSetupFromFrostLookArgv(
      missingRestore,
      optionDArgv(),
      requestEnv("pkcs11-tpm"),
      glibcRead(argvOpened),
      fx,
      "nixos",
    );
    expect(fromArgv.ok).toBe(true);
    if (!fromArgv.ok) return;
    expect(argvOpened).toEqual([NIXOS_HOST_BAO]);
    expect(fromArgv.plan.oracle).toBe("tpm2-pkcs11");
    expect(fromArgv.plan.mayCommitSeal).toBe(false);
    expect(fromArgv.plan.mayCommitHostHcl).toBe(true);
    const confOpened: string[] = [];
    const fromConf = planSetupFromFrostLookConf(
      missingRestore,
      optionDConf(),
      requestEnv("pkcs11-tpm"),
      glibcRead(confOpened),
      fx,
      "nixos",
    );
    expect(fromConf.ok).toBe(true);
    if (!fromConf.ok) return;
    expect(confOpened).toEqual([NIXOS_HOST_BAO]);
    expect(fromConf.plan.oracle).toBe("tpm2-pkcs11");
    expect(fromConf.plan.mayCommitSeal).toBe(false);
    expect(fromConf.plan.mayCommitHostHcl).toBe(true);
  });
});

describe("planSetupFromFrostLookNamedEnv/Argv/Conf — tpmrm0 is not present", () => {
  test("named env missing effects is unmeasured and does not use real effects", () => {
    const opened: string[] = [];
    const fromEnv = planSetupFromFrostLookNamedEnv(
      missingRestore,
      { ...optionDEnv("pkcs11-tpm"), [FROST_LOOK_OS_KEY]: "nixos" },
      glibcRead(opened),
      unusedReal(),
    );
    expect(fromEnv.ok).toBe(true);
    if (!fromEnv.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromEnv.plan.oracle).toBe("none");
    expect(fromEnv.plan.mayCommitHostHcl).toBe(false);
  });

  test("named env missing OS refuses — does not default to nixos", () => {
    expect(planSetupFromFrostLookNamedEnv(missingRestore, optionDEnv("pkcs11-tpm"), glibcRead([]), unusedReal())).toEqual(
      { ok: false, reason: "missing-os" },
    );
  });

  test("named conf tpmrm0 effects refuse", () => {
    const body = `${optionDConf()}${FROST_LOOK_OS_KEY}='nixos'\n${FROST_LOOK_EFFECTS_KEY}='${TPM_CHAR_DEVICE}'\n`;
    expect(
      planSetupFromFrostLookNamedConf(missingRestore, body, requestEnv("pkcs11-tpm"), glibcRead([]), unusedReal()),
    ).toEqual({ ok: false, reason: "unknown-effects" });
  });

  test("named argv missing --effects is unmeasured", () => {
    const fromArgv = planSetupFromFrostLookNamedArgv(
      missingRestore,
      [...optionDArgv(), `${FROST_LOOK_OS_FLAG}=nixos`],
      requestEnv("pkcs11-tpm"),
      glibcRead([]),
      unusedReal(),
    );
    expect(fromArgv.ok).toBe(true);
    if (!fromArgv.ok) return;
    expect(fromArgv.plan.oracle).toBe("none");
    expect(fromArgv.plan.mayCommitHostHcl).toBe(false);
  });

  test("named conf real TPM present may emit host HCL and cannot commit Application.yaml", () => {
    const body = `${optionDConf()}${FROST_LOOK_OS_KEY}='nixos'\n${FROST_LOOK_EFFECTS_KEY}='real'\n${FIRSTBOOT_BAO_ELF_EPOCH_KEY}='installed-host'\n`;
    const opened: string[] = [];
    const fromConf = planSetupFromFrostLookNamedConf(
      missingRestore,
      body,
      { ...requestEnv("pkcs11-tpm"), [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host" },
      glibcRead(opened),
      host({ tpm2: tpm2Present() }),
    );
    expect(fromConf.ok).toBe(true);
    if (!fromConf.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromConf.plan.oracle).toBe("tpm2-pkcs11");
    expect(fromConf.plan.mayCommitSeal).toBe(false);
    expect(fromConf.plan.mayCommitHostHcl).toBe(true);
  });
});

describe("planSetupFromFrostLookOptionalNamedEnv/Argv/Conf — tpmrm0 is not present", () => {
  test("optional env without frost-look keys is unmeasured; NamedEnv still missing-os", () => {
    const opened: string[] = [];
    const env = optionDEnv("pkcs11-tpm");
    const optional = planSetupFromFrostLookOptionalNamedEnv(
      missingRestore,
      env,
      glibcRead(opened),
      unusedReal(),
    );
    expect(optional.ok).toBe(true);
    if (!optional.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(optional.plan.oracle).toBe("none");
    expect(optional.plan.mayCommitHostHcl).toBe(false);
    expect(optional.plan.mayCommitSeal).toBe(false);
    expect(hostBaoSealHcl(optional.plan)).toBeNull();
    expect(planSetupFromFrostLookNamedEnv(missingRestore, env, glibcRead([]), unusedReal())).toEqual({
      ok: false,
      reason: "missing-os",
    });
  });

  test("optional env with effects and no OS is still missing-os", () => {
    expect(
      planSetupFromFrostLookOptionalNamedEnv(
        missingRestore,
        { [FROST_LOOK_EFFECTS_KEY]: "real" },
        glibcRead([]),
        unusedReal(),
      ),
    ).toEqual({ ok: false, reason: "missing-os" });
  });

  test("optional env refuses /dev/tpmrm0 effects", () => {
    expect(
      planSetupFromFrostLookOptionalNamedEnv(
        missingRestore,
        { [FROST_LOOK_OS_KEY]: "nixos", [FROST_LOOK_EFFECTS_KEY]: TPM_CHAR_DEVICE },
        glibcRead([]),
        unusedReal(),
      ),
    ).toEqual({ ok: false, reason: "unknown-effects" });
  });

  test("optional argv without frost-look flags is unmeasured", () => {
    const opened: string[] = [];
    const fromArgv = planSetupFromFrostLookOptionalNamedArgv(
      missingRestore,
      optionDArgv(),
      requestEnv("pkcs11-tpm"),
      glibcRead(opened),
      unusedReal(),
    );
    expect(fromArgv.ok).toBe(true);
    if (!fromArgv.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromArgv.plan.oracle).toBe("none");
    expect(fromArgv.plan.mayCommitHostHcl).toBe(false);
  });

  test("optional conf without frost-look keys is unmeasured", () => {
    const fromConf = planSetupFromFrostLookOptionalNamedConf(
      missingRestore,
      optionDConf(),
      requestEnv("pkcs11-tpm"),
      glibcRead([]),
      unusedReal(),
    );
    expect(fromConf.ok).toBe(true);
    if (!fromConf.ok) return;
    expect(fromConf.plan.oracle).toBe("none");
    expect(fromConf.plan.mayCommitHostHcl).toBe(false);
  });

  test("optional conf named real + TPM present may emit host HCL and cannot commit Application.yaml", () => {
    const body = `${optionDConf()}${FROST_LOOK_OS_KEY}='nixos'\n${FROST_LOOK_EFFECTS_KEY}='real'\n${FIRSTBOOT_BAO_ELF_EPOCH_KEY}='installed-host'\n`;
    const opened: string[] = [];
    const fromConf = planSetupFromFrostLookOptionalNamedConf(
      missingRestore,
      body,
      { ...requestEnv("pkcs11-tpm"), [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host" },
      glibcRead(opened),
      host({ tpm2: tpm2Present() }),
    );
    expect(fromConf.ok).toBe(true);
    if (!fromConf.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromConf.plan.oracle).toBe("tpm2-pkcs11");
    expect(fromConf.plan.mayCommitSeal).toBe(false);
    expect(fromConf.plan.mayCommitHostHcl).toBe(true);
    expect(hostBaoSealHcl(fromConf.plan)).not.toBeNull();
  });
});

describe("planSetupFromFrostLookOptionalNamedBunJson — tpmrm0 is not present", () => {
  test("null look is unmeasured even when JSON probe claims present", () => {
    const opened: string[] = [];
    const json = JSON.stringify({
      ok: true,
      ask: null,
      epoch: "installed-host",
      requested: "pkcs11-tpm",
      probe: { tpm2: "present", osFamily: "nixos" },
      look: null,
    });
    const fromJson = planSetupFromFrostLookOptionalNamedBunJson(
      missingRestore,
      json,
      optionDEnv("pkcs11-tpm"),
      glibcRead(opened),
      unusedReal(),
    );
    expect(fromJson.ok).toBe(true);
    if (!fromJson.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromJson.plan.oracle).toBe("none");
    expect(fromJson.plan.mayCommitHostHcl).toBe(false);
    expect(fromJson.plan.mayCommitSeal).toBe(false);
    expect(hostBaoSealHcl(fromJson.plan)).toBeNull();
  });

  test("named look real uses injected effects; JSON probe is still ignored", () => {
    const opened: string[] = [];
    const json = JSON.stringify({
      ok: true,
      ask: null,
      epoch: "installed-host",
      requested: "pkcs11-tpm",
      probe: { tpm2: "absent" },
      look: { os: "nixos", effects: "real" },
    });
    const fromJson = planSetupFromFrostLookOptionalNamedBunJson(
      missingRestore,
      json,
      optionDEnv("pkcs11-tpm"),
      glibcRead(opened),
      host({ tpm2: tpm2Present() }),
    );
    expect(fromJson.ok).toBe(true);
    if (!fromJson.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromJson.plan.oracle).toBe("tpm2-pkcs11");
    expect(fromJson.plan.mayCommitSeal).toBe(false);
    expect(fromJson.plan.mayCommitHostHcl).toBe(true);
    expect(hostBaoSealHcl(fromJson.plan)).not.toBeNull();
  });

  test("env frost-look keys mixed with bun JSON look refuse", () => {
    expect(
      planSetupFromFrostLookOptionalNamedBunJson(
        missingRestore,
        JSON.stringify({ ok: true, look: { os: "nixos", effects: "real" }, probe: null }),
        { ...optionDEnv("pkcs11-tpm"), [FROST_LOOK_OS_KEY]: "nixos" },
        glibcRead([]),
        unusedReal(),
      ),
    ).toEqual({ ok: false, reason: "mixed-source" });
  });

  test("malformed JSON is unsafe-json, not a live look", () => {
    expect(
      planSetupFromFrostLookOptionalNamedBunJson(
        missingRestore,
        "{",
        optionDEnv("pkcs11-tpm"),
        glibcRead([]),
        unusedReal(),
      ),
    ).toEqual({ ok: false, reason: "unsafe-json" });
  });
});
