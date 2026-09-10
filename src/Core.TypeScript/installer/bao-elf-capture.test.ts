/**
 * Falsifiers for the installer bao ELF capture gate.
 *
 * REFUTE:
 *   * Overlay / unseal-path opening the filesystem.
 *   * Opening `/dev/tpmrm0`, a `.so`, or the restore pointer.
 *   * Inferring `on-host` from a glibc interpreter.
 *   * Inferring `on-host` from `/dev/tpmrm0` or a `.so`.
 *   * Spawning `readelf`.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { ELF_INTERP_GLIBC_X86_64, ELF_INTERP_MUSL_X86_64, TPM_CHAR_DEVICE } from "../cluster/bao-load-site.ts";
import { emptyCapture, type NamedHardwareProbe } from "../cluster/host-seal-profile.ts";
import {
  NIXOS_PKCS11_MODULE_PATH,
  USB_PKCS11_MODULE_POINTER,
  hostBaoSealHcl,
  overlaySealHcl,
  planSetupPkcs11Overlay,
} from "../cluster/pkcs11-hostpath-overlay.ts";
import { integrateAtSetup, UNSEAL_REQUEST_ENV_KEY } from "../cluster/unseal-path.ts";
import { SHELL_SAFE_CONF_VALUE_REGEX, planFirstbootConfFileContent } from "../zflash/firstboot-role.ts";
import {
  FIRSTBOOT_BAO_ELF_EPOCH_KEY,
  FIRSTBOOT_BAO_LOAD_SITE_KEY,
  FIRSTBOOT_BAO_PATH_KEY,
  NIXOS_HOST_BAO,
  appendFirstbootBaoElfConf,
  captureBaoElfFromRead,
  composeFirstbootBaoElfCarrier,
  firstbootBaoElfArgvFromAsk,
  namedBaoElfAsk,
  namedBaoElfAskAtEpoch,
  nixosHostBaoAsk,
  nodeBaoElfRead,
  parseFirstbootBaoElfConf,
  parseFirstbootBaoElfEnv,
  parseNamedBaoElfArgs,
  planFirstbootConfWithNamedBaoElf,
  planSetupFromNamedBaoElf,
  planSetupFromNamedBaoElfArgv,
  planSetupFromNamedBaoElfConf,
  planSetupFromNamedBaoElfEnv,
} from "./bao-elf-capture.ts";

function namedTpmPresent(): NamedHardwareProbe {
  return {
    os: "nixos",
    tpm2: "present",
    tpmDeviceNode: TPM_CHAR_DEVICE,
    yubiHsm2: "not-asked",
    smartCardReaderAttached: false,
    yubikeyDetected: false,
    pkcs11ModuleOnDisk: false,
    smartcardHsm: "not-asked",
  };
}

function namedTpmrm0Look(): NamedHardwareProbe {
  return { ...namedTpmPresent(), tpm2: "indeterminate" };
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

describe("captureBaoElfFromRead — installer opens bao, not the overlay", () => {
  test("injected glibc bytes on-host keep site on-host", () => {
    const bytes = elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64);
    const capture = captureBaoElfFromRead(NIXOS_HOST_BAO, "on-host", () => ({
      exists: true,
      bytes,
    }));
    expect(capture.site).toBe("on-host");
    expect(capture.interpreter).toBe(ELF_INTERP_GLIBC_X86_64);
  });

  test("tpmrm0, restore pointer, and .so are not opened", () => {
    let reads = 0;
    const read = (): { exists: boolean; bytes: Uint8Array | null } => {
      reads += 1;
      return { exists: true, bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) };
    };
    expect(captureBaoElfFromRead(TPM_CHAR_DEVICE, "on-host", read).interpreter).toBeNull();
    expect(captureBaoElfFromRead(USB_PKCS11_MODULE_POINTER, "in-chart-image", read).interpreter).toBeNull();
    expect(
      captureBaoElfFromRead("/run/current-system/sw/lib/libtpm2_pkcs11.so", "on-host", read).interpreter,
    ).toBeNull();
    expect(reads).toBe(0);
  });

  test("live temp file round-trips musl PT_INTERP without readelf", () => {
    const dir = mkdtempSync(join(tmpdir(), "bao-elf-"));
    const path = join(dir, "bao");
    writeFileSync(path, elf64LeWithInterp(ELF_INTERP_MUSL_X86_64));
    const capture = captureBaoElfFromRead(path, "in-chart-image", nodeBaoElfRead);
    expect(capture.openedPath).toBe(path);
    expect(capture.site).toBe("in-chart-image");
    expect(capture.interpreter).toBe(ELF_INTERP_MUSL_X86_64);
  });

  test("nodeBaoElfRead: ENOENT is unmeasured; a directory is not ENOENT", () => {
    const missing = nodeBaoElfRead(join(tmpdir(), `bao-elf-missing-${Date.now()}`));
    expect(missing).toEqual({ exists: false, bytes: null });
    const dir = mkdtempSync(join(tmpdir(), "bao-elf-dir-"));
    expect(() => nodeBaoElfRead(dir)).toThrow();
  });

  test("on-host glibc bytes may emit host HCL and cannot commit Application.yaml", () => {
    const capture = captureBaoElfFromRead(NIXOS_HOST_BAO, "on-host", () => ({
      exists: true,
      bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64),
    }));
    const plan = planSetupPkcs11Overlay({
      oracle: "tpm2-pkcs11",
      companionModulePath: null,
      moduleFileExists: true,
      baoElf: capture,
    });
    expect(plan.mayCommitSeal).toBe(false);
    expect(plan.mayCommitHostHcl).toBe(true);
    expect(overlaySealHcl(plan)).toBeNull();
    expect(hostBaoSealHcl(plan)).toBe(
      [
        'seal "pkcs11" {',
        `  lib = "${NIXOS_PKCS11_MODULE_PATH["tpm2-pkcs11"]}"`,
        '  token_label = "zeta-openbao"',
        '  mechanism = "CKM_RSA_PKCS_OAEP"',
        "  # pin: never here. BAO_HSM_PIN env.",
        "}",
      ].join("\n"),
    );
  });
});

describe("planSetupFromNamedBaoElf — first-boot names site and path", () => {
  const missingRestore = {
    openedPath: USB_PKCS11_MODULE_POINTER,
    exists: false,
    contents: null,
    resolvedModuleExists: true,
  };

  function tpmDecision() {
    return integrateAtSetup({ requested: "pkcs11-tpm" }, emptyCapture({ os: "nixos", tpm2: "present" }));
  }

  test("TPM present without a named bao is unmeasured, not on-host", () => {
    let reads = 0;
    const plan = planSetupFromNamedBaoElf(tpmDecision(), missingRestore, null, () => {
      reads += 1;
      return { exists: true, bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) };
    });
    expect(plan.loadSite).toBe("in-chart-image");
    expect(plan.mayCommitSeal).toBe(false);
    expect(plan.mayCommitHostHcl).toBe(false);
    expect(overlaySealHcl(plan)).toBeNull();
    expect(hostBaoSealHcl(plan)).toBeNull();
    expect(reads).toBe(0);
  });

  test("tpmrm0 and .so cannot name a bao ask", () => {
    expect(namedBaoElfAsk("on-host", TPM_CHAR_DEVICE)).toBeNull();
    expect(namedBaoElfAsk("on-host", NIXOS_PKCS11_MODULE_PATH["tpm2-pkcs11"])).toBeNull();
    expect(namedBaoElfAsk("in-chart-image", USB_PKCS11_MODULE_POINTER)).toBeNull();
  });

  test("named NixOS host bao with glibc bytes may emit host HCL, not Application.yaml", () => {
    const opened: { path: string | null } = { path: null };
    const plan = planSetupFromNamedBaoElf(tpmDecision(), missingRestore, nixosHostBaoAsk(), (path) => {
      opened.path = path;
      return { exists: true, bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) };
    });
    expect(opened.path).toBe(NIXOS_HOST_BAO);
    expect(plan.ok).toBe(true);
    expect(plan.loadSite).toBe("on-host");
    expect(plan.mayCommitSeal).toBe(false);
    expect(plan.mayCommitHostHcl).toBe(true);
    expect(overlaySealHcl(plan)).toBeNull();
    expect(hostBaoSealHcl(plan)).toBe(
      [
        'seal "pkcs11" {',
        `  lib = "${NIXOS_PKCS11_MODULE_PATH["tpm2-pkcs11"]}"`,
        '  token_label = "zeta-openbao"',
        '  mechanism = "CKM_RSA_PKCS_OAEP"',
        "  # pin: never here. BAO_HSM_PIN env.",
        "}",
      ].join("\n"),
    );
  });

  test("passing tpmrm0 as the named path does not open it and cannot commit host HCL", () => {
    let reads = 0;
    const plan = planSetupFromNamedBaoElf(
      tpmDecision(),
      missingRestore,
      { site: "on-host", openedPath: TPM_CHAR_DEVICE },
      () => {
        reads += 1;
        return { exists: true, bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) };
      },
    );
    expect(reads).toBe(0);
    expect(plan.loadSite).toBe("in-chart-image");
    expect(plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(plan)).toBeNull();
  });
});

describe("parseNamedBaoElfArgs — live installer names both flags", () => {
  const missingRestore = {
    openedPath: USB_PKCS11_MODULE_POINTER,
    exists: false,
    contents: null,
    resolvedModuleExists: true,
  };

  function pkcs11Env() {
    return { [UNSEAL_REQUEST_ENV_KEY]: "pkcs11-tpm" };
  }

  test("no flags is unmeasured; a bare tpmrm0 argv is not on-host", () => {
    expect(parseNamedBaoElfArgs([])).toEqual({ ok: true, ask: null });
    expect(parseNamedBaoElfArgs([TPM_CHAR_DEVICE, "--tpm"])).toEqual({ ok: true, ask: null });
  });

  test("one flag without the other refuses — does not fill the NixOS host path", () => {
    expect(parseNamedBaoElfArgs(["--bao-load-site=on-host"])).toEqual({ ok: false, reason: "site-without-path" });
    expect(parseNamedBaoElfArgs(["--bao-path", NIXOS_HOST_BAO])).toEqual({ ok: false, reason: "path-without-site" });
    expect(parseNamedBaoElfArgs(["--bao-load-site="])).toEqual({ ok: false, reason: "site-without-path" });
  });

  test("unknown site is not on-host; tpmrm0 as path is not an ask", () => {
    expect(parseNamedBaoElfArgs(["--bao-load-site=tpmrm0", "--bao-path", NIXOS_HOST_BAO])).toEqual({
      ok: false,
      reason: "unknown-site",
    });
    expect(parseNamedBaoElfArgs(["--bao-load-site=on-host", `--bao-path=${TPM_CHAR_DEVICE}`])).toEqual({
      ok: true,
      ask: null,
    });
  });

  test("both flags name option D; argv still cannot commit Application.yaml", () => {
    const parsed = parseNamedBaoElfArgs(["--bao-load-site", "on-host", "--bao-path", NIXOS_HOST_BAO]);
    expect(parsed).toEqual({ ok: true, ask: { site: "on-host", openedPath: NIXOS_HOST_BAO } });
    const fromArgv = planSetupFromNamedBaoElfArgv(
      missingRestore,
      ["--bao-load-site=on-host", `--bao-path=${NIXOS_HOST_BAO}`],
      pkcs11Env(),
      (path) => ({
        exists: true,
        bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
      }),
      namedTpmPresent(),
    );
    expect(fromArgv.ok).toBe(true);
    if (!fromArgv.ok) return;
    expect(fromArgv.plan.mayCommitSeal).toBe(false);
    expect(fromArgv.plan.mayCommitHostHcl).toBe(true);
    expect(overlaySealHcl(fromArgv.plan)).toBeNull();
    const empty = planSetupFromNamedBaoElfArgv(
      missingRestore,
      [],
      pkcs11Env(),
      () => ({
        exists: true,
        bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64),
      }),
      namedTpmPresent(),
    );
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(empty.plan)).toBeNull();
  });

  test("missing unseal request is not auto even when TPM is present", () => {
    const opened: string[] = [];
    const missingRequest = planSetupFromNamedBaoElfArgv(
      missingRestore,
      ["--bao-load-site=on-host", `--bao-path=${NIXOS_HOST_BAO}`],
      {},
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(missingRequest.ok).toBe(true);
    if (!missingRequest.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(missingRequest.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(missingRequest.plan)).toBeNull();
  });

  test("tpmrm0 as unseal request refuses and does not open NIXOS_HOST_BAO", () => {
    const opened: string[] = [];
    const fromTpmrm0 = planSetupFromNamedBaoElfArgv(
      missingRestore,
      ["--bao-load-site=on-host", `--bao-path=${NIXOS_HOST_BAO}`],
      { [UNSEAL_REQUEST_ENV_KEY]: TPM_CHAR_DEVICE },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(fromTpmrm0).toEqual({ ok: false, reason: "unknown-request" });
    expect(opened).toEqual([]);
  });

  test("null probe is unmeasured, not present — option D does not emit host HCL", () => {
    const opened: string[] = [];
    const fromNull = planSetupFromNamedBaoElfArgv(
      missingRestore,
      ["--bao-load-site=on-host", `--bao-path=${NIXOS_HOST_BAO}`],
      pkcs11Env(),
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      null,
    );
    expect(fromNull.ok).toBe(true);
    if (!fromNull.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromNull.plan.oracle).toBe("none");
    expect(fromNull.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromNull.plan)).toBeNull();
  });
});

describe("composeFirstbootBaoElfCarrier — both names or neither", () => {
  const tpmAsk: { site: "on-host"; openedPath: string } = {
    site: "on-host",
    openedPath: TPM_CHAR_DEVICE,
  };
  const soAsk: { site: "on-host"; openedPath: string } = {
    site: "on-host",
    openedPath: "/run/current-system/sw/lib/libtpm2_pkcs11.so",
  };
  const restoreAsk: { site: "on-host"; openedPath: string } = {
    site: "on-host",
    openedPath: USB_PKCS11_MODULE_POINTER,
  };
  const unsafeAsk: { site: "on-host"; openedPath: string } = {
    site: "on-host",
    openedPath: `${NIXOS_HOST_BAO};reboot`,
  };

  test("null ask is unmeasured — neither conf line, empty argv", () => {
    expect(composeFirstbootBaoElfCarrier(null)).toEqual({ ok: false, reason: "unmeasured" });
    expect(firstbootBaoElfArgvFromAsk(null)).toEqual([]);
  });

  test("tpmrm0 is shell-safe and still not a bao path — neither name", () => {
    expect(SHELL_SAFE_CONF_VALUE_REGEX.test(TPM_CHAR_DEVICE)).toBe(true);
    expect(composeFirstbootBaoElfCarrier(tpmAsk)).toEqual({ ok: false, reason: "not-bao-path" });
    expect(firstbootBaoElfArgvFromAsk(tpmAsk)).toEqual([]);
  });

  test("a .so and the restore pointer are not a bao path — neither name", () => {
    expect(composeFirstbootBaoElfCarrier(soAsk)).toEqual({ ok: false, reason: "not-bao-path" });
    expect(composeFirstbootBaoElfCarrier(restoreAsk)).toEqual({ ok: false, reason: "not-bao-path" });
    expect(firstbootBaoElfArgvFromAsk(soAsk)).toEqual([]);
    expect(firstbootBaoElfArgvFromAsk(restoreAsk)).toEqual([]);
  });

  test("a path with a shell metacharacter refuses both names", () => {
    expect(composeFirstbootBaoElfCarrier(unsafeAsk)).toEqual({ ok: false, reason: "unsafe-conf-value" });
    expect(firstbootBaoElfArgvFromAsk(unsafeAsk)).toEqual([]);
  });

  test("option D emits both quoted conf lines and both argv tokens", () => {
    const ask = nixosHostBaoAsk();
    expect(composeFirstbootBaoElfCarrier(ask)).toEqual({
      ok: true,
      confLines: [
        `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'`,
        `${FIRSTBOOT_BAO_PATH_KEY}='${NIXOS_HOST_BAO}'`,
      ],
      argv: [`--bao-load-site=on-host`, `--bao-path=${NIXOS_HOST_BAO}`],
    });
  });

  test("argv carrier round-trips through parseNamedBaoElfArgs", () => {
    const ask = nixosHostBaoAsk();
    expect(parseNamedBaoElfArgs(firstbootBaoElfArgvFromAsk(ask))).toEqual({ ok: true, ask });
    expect(parseNamedBaoElfArgs(firstbootBaoElfArgvFromAsk(null))).toEqual({ ok: true, ask: null });
    expect(parseNamedBaoElfArgs(firstbootBaoElfArgvFromAsk(tpmAsk))).toEqual({ ok: true, ask: null });
  });

  test("append writes both lines after a founder conf, or leaves the conf unchanged", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    const withBao = appendFirstbootBaoElfConf(planned.value, nixosHostBaoAsk());
    expect(withBao).toBe(
      `${planned.value}${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'\n${FIRSTBOOT_BAO_PATH_KEY}='${NIXOS_HOST_BAO}'\n`,
    );
    expect(appendFirstbootBaoElfConf(planned.value, null)).toBe(planned.value);
    expect(appendFirstbootBaoElfConf(planned.value, tpmAsk)).toBe(planned.value);
    expect(appendFirstbootBaoElfConf(planned.value, soAsk)).toBe(planned.value);
    expect(appendFirstbootBaoElfConf(planned.value, unsafeAsk)).toBe(planned.value);
  });

  test("appended founder assignments are both names after HOST, never one", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    const assignments = appendFirstbootBaoElfConf(planned.value, nixosHostBaoAsk())
      .split("\n")
      .filter((line) => !line.startsWith("#") && line.length > 0);
    expect(assignments).toEqual([
      "ZETA_ROLE='first-control-plane'",
      "HOST='control-plane'",
      `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'`,
      `${FIRSTBOOT_BAO_PATH_KEY}='${NIXOS_HOST_BAO}'`,
    ]);
  });
});

describe("parseFirstbootBaoElfConf — consume both names or neither", () => {
  const missingRestore = {
    openedPath: USB_PKCS11_MODULE_POINTER,
    exists: false,
    contents: null,
    resolvedModuleExists: true,
  };

  function pkcs11Env() {
    return { [UNSEAL_REQUEST_ENV_KEY]: "pkcs11-tpm" };
  }

  test("a founder conf with no bao keys is unmeasured", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    expect(parseFirstbootBaoElfConf(planned.value)).toEqual({ ok: true, ask: null });
    expect(parseFirstbootBaoElfEnv({})).toEqual({ ok: true, ask: null });
  });

  test("appended option D round-trips through conf and env", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    const ask = nixosHostBaoAsk();
    const withBao = appendFirstbootBaoElfConf(planned.value, ask);
    expect(parseFirstbootBaoElfConf(withBao)).toEqual({ ok: true, ask });
    expect(
      parseFirstbootBaoElfEnv({
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
      }),
    ).toEqual({ ok: true, ask });
  });

  test("one conf key without the other refuses — does not fill the NixOS host path", () => {
    expect(parseFirstbootBaoElfConf(`${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'\n`)).toEqual({
      ok: false,
      reason: "site-without-path",
    });
    expect(parseFirstbootBaoElfConf(`${FIRSTBOOT_BAO_PATH_KEY}='${NIXOS_HOST_BAO}'\n`)).toEqual({
      ok: false,
      reason: "path-without-site",
    });
    expect(parseFirstbootBaoElfEnv({ ZETA_BAO_LOAD_SITE: "on-host" })).toEqual({
      ok: false,
      reason: "site-without-path",
    });
  });

  test("tpmrm0 in both conf keys is shell-safe and still not an ask", () => {
    const conf =
      `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'\n` + `${FIRSTBOOT_BAO_PATH_KEY}='${TPM_CHAR_DEVICE}'\n`;
    expect(SHELL_SAFE_CONF_VALUE_REGEX.test(TPM_CHAR_DEVICE)).toBe(true);
    expect(parseFirstbootBaoElfConf(conf)).toEqual({ ok: true, ask: null });
    expect(
      parseFirstbootBaoElfEnv({
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: TPM_CHAR_DEVICE,
      }),
    ).toEqual({ ok: true, ask: null });
  });

  test("a path with a shell metacharacter in conf or env refuses", () => {
    const conf =
      `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'\n` + `${FIRSTBOOT_BAO_PATH_KEY}='${NIXOS_HOST_BAO};reboot'\n`;
    expect(parseFirstbootBaoElfConf(conf)).toEqual({ ok: false, reason: "unsafe-conf-value" });
    expect(
      parseFirstbootBaoElfEnv({
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: `${NIXOS_HOST_BAO};reboot`,
      }),
    ).toEqual({ ok: false, reason: "unsafe-conf-value" });
  });

  test("conf consume may emit host HCL and cannot commit Application.yaml", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    const withBao = appendFirstbootBaoElfConf(planned.value, nixosHostBaoAsk());
    const fromConf = planSetupFromNamedBaoElfConf(
      missingRestore,
      withBao,
      pkcs11Env(),
      (path) => ({
        exists: true,
        bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
      }),
      namedTpmPresent(),
    );
    expect(fromConf.ok).toBe(true);
    if (!fromConf.ok) return;
    expect(fromConf.plan.mayCommitSeal).toBe(false);
    expect(fromConf.plan.mayCommitHostHcl).toBe(true);
    expect(overlaySealHcl(fromConf.plan)).toBeNull();
    const empty = planSetupFromNamedBaoElfConf(
      missingRestore,
      planned.value,
      pkcs11Env(),
      () => ({
        exists: true,
        bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64),
      }),
      namedTpmPresent(),
    );
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(empty.plan)).toBeNull();
  });

  test("missing unseal request is not auto even when TPM is present", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    const withBao = appendFirstbootBaoElfConf(planned.value, nixosHostBaoAsk());
    const opened: string[] = [];
    const missingRequest = planSetupFromNamedBaoElfConf(
      missingRestore,
      withBao,
      {},
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(missingRequest.ok).toBe(true);
    if (!missingRequest.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(missingRequest.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(missingRequest.plan)).toBeNull();
  });

  test("tpmrm0 as unseal request refuses and does not open NIXOS_HOST_BAO", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    const withBao = appendFirstbootBaoElfConf(planned.value, nixosHostBaoAsk());
    const opened: string[] = [];
    const fromTpmrm0 = planSetupFromNamedBaoElfConf(
      missingRestore,
      withBao,
      { [UNSEAL_REQUEST_ENV_KEY]: TPM_CHAR_DEVICE },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(fromTpmrm0).toEqual({ ok: false, reason: "unknown-request" });
    expect(opened).toEqual([]);
  });

  test("null probe is unmeasured, not present — option D does not emit host HCL", () => {
    const planned = planFirstbootConfFileContent({ kind: "first-control-plane" });
    if (!planned.ok) throw new Error(planned.error);
    const withBao = appendFirstbootBaoElfConf(planned.value, nixosHostBaoAsk());
    const opened: string[] = [];
    const fromNull = planSetupFromNamedBaoElfConf(
      missingRestore,
      withBao,
      pkcs11Env(),
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      null,
    );
    expect(fromNull.ok).toBe(true);
    if (!fromNull.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromNull.plan.oracle).toBe("none");
    expect(fromNull.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromNull.plan)).toBeNull();
  });
});

describe("namedBaoElfAskAtEpoch — ISO current-system is not option D", () => {
  const storeBao = "/nix/store/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee-openbao/bin/bao";

  test("installer-iso refuses NIXOS_HOST_BAO and does not fill a /mnt path", () => {
    expect(namedBaoElfAskAtEpoch("on-host", NIXOS_HOST_BAO, "installer-iso")).toBeNull();
    expect(namedBaoElfAskAtEpoch("in-chart-image", NIXOS_HOST_BAO, "installer-iso")).toBeNull();
  });

  test("installed-host keeps option D; a named store path is still an ask on the ISO", () => {
    expect(namedBaoElfAskAtEpoch("on-host", NIXOS_HOST_BAO, "installed-host")).toEqual({
      site: "on-host",
      openedPath: NIXOS_HOST_BAO,
    });
    expect(namedBaoElfAskAtEpoch("on-host", storeBao, "installer-iso")).toEqual({
      site: "on-host",
      openedPath: storeBao,
    });
  });

  test("tpmrm0 is still not an ask at either epoch", () => {
    expect(namedBaoElfAskAtEpoch("on-host", TPM_CHAR_DEVICE, "installer-iso")).toBeNull();
    expect(namedBaoElfAskAtEpoch("on-host", TPM_CHAR_DEVICE, "installed-host")).toBeNull();
  });
});

describe("planSetupFromNamedBaoElfEnv — env join, still not a seal", () => {
  const missingRestore = {
    openedPath: USB_PKCS11_MODULE_POINTER,
    exists: false,
    contents: null,
    resolvedModuleExists: true,
  };

  test("installed-host option D env may emit host HCL and cannot commit Application.yaml", () => {
    const opened: string[] = [];
    const fromEnv = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        PATH: "/usr/bin",
        ZETA_ROLE: "first-control-plane",
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host",
        [UNSEAL_REQUEST_ENV_KEY]: "pkcs11-tpm",
      },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(fromEnv.ok).toBe(true);
    if (!fromEnv.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromEnv.plan.mayCommitSeal).toBe(false);
    expect(fromEnv.plan.mayCommitHostHcl).toBe(true);
    expect(overlaySealHcl(fromEnv.plan)).toBeNull();
  });

  test("missing unseal request is not auto even when TPM is present", () => {
    const opened: string[] = [];
    const missingRequest = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host",
      },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(missingRequest.ok).toBe(true);
    if (!missingRequest.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(missingRequest.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(missingRequest.plan)).toBeNull();
  });

  test("tpmrm0 as unseal request refuses and does not open NIXOS_HOST_BAO", () => {
    const opened: string[] = [];
    const fromTpmrm0 = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host",
        [UNSEAL_REQUEST_ENV_KEY]: TPM_CHAR_DEVICE,
      },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(fromTpmrm0).toEqual({ ok: false, reason: "unknown-request" });
    expect(opened).toEqual([]);
  });

  test("null probe is unmeasured, not present — option D does not emit host HCL", () => {
    const opened: string[] = [];
    const fromNull = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host",
        [UNSEAL_REQUEST_ENV_KEY]: "pkcs11-tpm",
      },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      null,
    );
    expect(fromNull.ok).toBe(true);
    if (!fromNull.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromNull.plan.oracle).toBe("none");
    expect(fromNull.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromNull.plan)).toBeNull();
  });

  test("tpmrm0 on the probe is not present — option D does not emit host HCL", () => {
    const opened: string[] = [];
    const fromNode = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host",
        [UNSEAL_REQUEST_ENV_KEY]: "pkcs11-tpm",
      },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmrm0Look(),
    );
    expect(fromNode.ok).toBe(true);
    if (!fromNode.ok) return;
    expect(opened).toEqual([NIXOS_HOST_BAO]);
    expect(fromNode.plan.oracle).toBe("none");
    expect(fromNode.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromNode.plan)).toBeNull();
  });

  test("installer-iso does not open NIXOS_HOST_BAO even when glibc bytes are injected", () => {
    const opened: string[] = [];
    const fromIso = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [UNSEAL_REQUEST_ENV_KEY]: "pkcs11-tpm",
      },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(fromIso.ok).toBe(true);
    if (!fromIso.ok) return;
    expect(opened).toEqual([]);
    expect(fromIso.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromIso.plan)).toBeNull();
    expect(overlaySealHcl(fromIso.plan)).toBeNull();
  });

  test("installer-iso still opens a named store bao path", () => {
    const storeBao = "/nix/store/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee-openbao/bin/bao";
    const opened: string[] = [];
    const fromStore = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: storeBao,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [UNSEAL_REQUEST_ENV_KEY]: "pkcs11-tpm",
      },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === storeBao ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(fromStore.ok).toBe(true);
    if (!fromStore.ok) return;
    expect(opened).toEqual([storeBao]);
    expect(fromStore.plan.mayCommitSeal).toBe(false);
    expect(fromStore.plan.mayCommitHostHcl).toBe(true);
    expect(overlaySealHcl(fromStore.plan)).toBeNull();
  });

  test("missing keys are unmeasured even when glibc bytes are injected", () => {
    const opened: string[] = [];
    const empty = planSetupFromNamedBaoElfEnv(
      missingRestore,
      { PATH: "/usr/bin" },
      (path) => {
        opened.push(path);
        return { exists: true, bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) };
      },
      namedTpmPresent(),
    );
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(opened).toEqual([]);
    expect(empty.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(empty.plan)).toBeNull();
  });

  test("tpmrm0 env is not an ask and does not open the char device", () => {
    const opened: string[] = [];
    const fromTpm = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: TPM_CHAR_DEVICE,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
      },
      (path) => {
        opened.push(path);
        return { exists: true, bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) };
      },
      namedTpmPresent(),
    );
    expect(fromTpm.ok).toBe(true);
    if (!fromTpm.ok) return;
    expect(opened).toEqual([]);
    expect(fromTpm.plan.mayCommitHostHcl).toBe(false);
    expect(hostBaoSealHcl(fromTpm.plan)).toBeNull();
  });

  test("one env key without the other refuses — does not fill the NixOS host path", () => {
    const opened: string[] = [];
    const siteOnly = planSetupFromNamedBaoElfEnv(
      missingRestore,
      { ZETA_BAO_LOAD_SITE: "on-host" },
      (path) => {
        opened.push(path);
        return { exists: true, bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) };
      },
      namedTpmPresent(),
    );
    expect(siteOnly).toEqual({ ok: false, reason: "site-without-path" });
    expect(opened).toEqual([]);
    const pathOnly = planSetupFromNamedBaoElfEnv(
      missingRestore,
      { ZETA_BAO_PATH: NIXOS_HOST_BAO },
      (path) => {
        opened.push(path);
        return { exists: true, bytes: elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) };
      },
      namedTpmPresent(),
    );
    expect(pathOnly).toEqual({ ok: false, reason: "path-without-site" });
    expect(opened).toEqual([]);
  });

  test("option D env without a named epoch refuses and does not open NIXOS_HOST_BAO", () => {
    const opened: string[] = [];
    const missingEpoch = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
      },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(missingEpoch).toEqual({ ok: false, reason: "empty-epoch" });
    expect(opened).toEqual([]);
  });

  test("/mnt as epoch refuses unknown-epoch and does not open NIXOS_HOST_BAO", () => {
    const opened: string[] = [];
    const fromMnt = planSetupFromNamedBaoElfEnv(
      missingRestore,
      {
        ZETA_BAO_LOAD_SITE: "on-host",
        ZETA_BAO_PATH: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "/mnt",
      },
      (path) => {
        opened.push(path);
        return {
          exists: true,
          bytes: path === NIXOS_HOST_BAO ? elf64LeWithInterp(ELF_INTERP_GLIBC_X86_64) : null,
        };
      },
      namedTpmPresent(),
    );
    expect(fromMnt).toEqual({ ok: false, reason: "unknown-epoch" });
    expect(opened).toEqual([]);
  });
});

describe("planFirstbootConfWithNamedBaoElf — role conf plus both names or neither", () => {
  const founder = { kind: "first-control-plane" as const };
  const tpmAsk: { site: "on-host"; openedPath: string } = {
    site: "on-host",
    openedPath: TPM_CHAR_DEVICE,
  };
  const soAsk: { site: "on-host"; openedPath: string } = {
    site: "on-host",
    openedPath: "/run/current-system/sw/lib/libtpm2_pkcs11.so",
  };
  const httpJoiner = { kind: "joiner" as const, serverUrl: "http://control-plane.local:6443" };

  test("null ask is byte-identical to the role conf; config has no bao fields", () => {
    const roleOnly = planFirstbootConfFileContent(founder);
    const joined = planFirstbootConfWithNamedBaoElf(founder, null);
    expect(roleOnly.ok).toBe(true);
    expect(joined.ok).toBe(true);
    if (!roleOnly.ok || !joined.ok) return;
    expect(joined.value).toBe(roleOnly.value);
    expect(joined.config).toEqual(roleOnly.config);
  });

  test("tpmrm0 and .so asks leave the role conf byte-identical", () => {
    const roleOnly = planFirstbootConfFileContent(founder);
    if (!roleOnly.ok) throw new Error(roleOnly.error);
    expect(planFirstbootConfWithNamedBaoElf(founder, tpmAsk)).toEqual(roleOnly);
    expect(planFirstbootConfWithNamedBaoElf(founder, soAsk)).toEqual(roleOnly);
  });

  test("option D appends both names; consume round-trips; HOST is unchanged", () => {
    const ask = nixosHostBaoAsk();
    const joined = planFirstbootConfWithNamedBaoElf(founder, ask);
    const roleOnly = planFirstbootConfFileContent(founder);
    expect(joined.ok).toBe(true);
    expect(roleOnly.ok).toBe(true);
    if (!joined.ok || !roleOnly.ok) return;
    expect(joined.config).toEqual(roleOnly.config);
    expect(joined.value).toBe(
      `${roleOnly.value}${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'\n${FIRSTBOOT_BAO_PATH_KEY}='${NIXOS_HOST_BAO}'\n`,
    );
    expect(parseFirstbootBaoElfConf(joined.value)).toEqual({ ok: true, ask });
  });

  test("a refused role is unchanged — bao cannot paper over it", () => {
    const roleOnly = planFirstbootConfFileContent(httpJoiner);
    const withBao = planFirstbootConfWithNamedBaoElf(httpJoiner, nixosHostBaoAsk());
    expect(roleOnly.ok).toBe(false);
    expect(withBao).toEqual(roleOnly);
  });
});
