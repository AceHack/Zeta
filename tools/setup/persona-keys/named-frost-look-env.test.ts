import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TPM_CHAR_DEVICE } from "../../../src/Core.TypeScript/cluster/bao-load-site.ts";
import { hostCaptureFromNamedProbe, pickSealOracleFromCapture } from "../../../src/Core.TypeScript/cluster/host-seal-profile.ts";
import type { HardwareProbeEffects } from "./frost-hardware-probe.ts";
import type { ListOutcome, PathOutcome, Tpm2LinuxEffects } from "./tpm2-linux-probe.ts";
import {
  FROST_LOOK_EFFECTS_FLAG,
  FROST_LOOK_EFFECTS_KEY,
  FROST_LOOK_OS_FLAG,
  FROST_LOOK_OS_KEY,
  FROST_LOOK_CONF_FLAG,
  consumeFrostLookFromArgv,
  consumeFrostLookFromCliArgv,
  consumeFrostLookFromConf,
  consumeFrostLookFromEnv,
  consumeOptionalFrostLookFromArgv,
  consumeOptionalFrostLookFromConf,
  consumeOptionalFrostLookFromEnv,
  frostLookProbeFromNamed,
  parseFrostLookEffects,
  parseFrostLookOs,
  runFrostLookArgvCli,
  runFrostLookConfCli,
  runFrostLookEnvCli,
} from "./named-frost-look-env.ts";

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

describe("parseFrostLookEffects — tpmrm0 is not real", () => {
  test("missing effects is unmeasured, not real", () => {
    expect(parseFrostLookEffects(undefined)).toEqual({ ok: true, effects: null });
  });

  test("empty effects refuses", () => {
    expect(parseFrostLookEffects("")).toEqual({ ok: false, reason: "empty-effects" });
  });

  test("tpmrm0 is unknown, not real", () => {
    expect(parseFrostLookEffects(TPM_CHAR_DEVICE)).toEqual({ ok: false, reason: "unknown-effects" });
  });

  test("named null and real stay named", () => {
    expect(parseFrostLookEffects("null")).toEqual({ ok: true, effects: "null" });
    expect(parseFrostLookEffects("real")).toEqual({ ok: true, effects: "real" });
  });
});

describe("parseFrostLookOs — tpmrm0 is not an OS", () => {
  test("missing OS refuses — does not default to nixos", () => {
    expect(parseFrostLookOs(undefined)).toEqual({ ok: false, reason: "missing-os" });
  });

  test("empty OS refuses", () => {
    expect(parseFrostLookOs("")).toEqual({ ok: false, reason: "empty-os" });
  });

  test("tpmrm0 is unknown, not nixos", () => {
    expect(parseFrostLookOs(TPM_CHAR_DEVICE)).toEqual({ ok: false, reason: "unknown-os" });
  });

  test("named families stay named", () => {
    expect(parseFrostLookOs("nixos")).toEqual({ ok: true, os: "nixos" });
    expect(parseFrostLookOs("darwin")).toEqual({ ok: true, os: "darwin" });
  });
});

describe("frostLookProbeFromNamed — tpmrm0 is not present", () => {
  test("missing and named-null do not use injected real effects", () => {
    expect(frostLookProbeFromNamed("nixos", null, unusedReal())).toBeNull();
    expect(frostLookProbeFromNamed("nixos", "null", unusedReal())).toBeNull();
    expect(hostCaptureFromNamedProbe(frostLookProbeFromNamed("nixos", null, unusedReal())).tpm2).toBe(
      "not-asked",
    );
  });

  test("named real with tpmrm0 node without family stays indeterminate", () => {
    const probe = frostLookProbeFromNamed(
      "nixos",
      "real",
      host({
        tpm2: tpm2Absent({
          statPath: (p) => (p === TPM_CHAR_DEVICE ? { kind: "found" } : { kind: "not-found" }),
          listDir: (p) => (p === "/sys/class/tpm" ? { kind: "listed", entries: ["tpmrm0"] } : { kind: "not-found" }),
        }),
      }),
    );
    expect(probe?.tpm2).toBe("indeterminate");
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("none");
  });

  test("named real with TPM 2.0 present stays named", () => {
    const probe = frostLookProbeFromNamed("nixos", "real", host({ tpm2: tpm2Present() }));
    expect(probe?.tpm2).toBe("present");
    expect(pickSealOracleFromCapture(hostCaptureFromNamedProbe(probe))).toBe("tpm2-pkcs11");
  });
});

describe("runFrostLookEnvCli — tpmrm0 is not present", () => {
  test("missing effects writes unmeasured probe and exits 0", () => {
    const lines: string[] = [];
    const code = runFrostLookEnvCli({ [FROST_LOOK_OS_KEY]: "nixos" }, unusedReal(), (line) => {
      lines.push(line);
    });
    expect(code).toBe(0);
    expect(lines).toEqual([`${JSON.stringify({ ok: true, os: "nixos", effects: null, probe: null })}\n`]);
  });

  test("tpmrm0 effects refuse and do not look", () => {
    const lines: string[] = [];
    const code = runFrostLookEnvCli(
      { [FROST_LOOK_OS_KEY]: "nixos", [FROST_LOOK_EFFECTS_KEY]: TPM_CHAR_DEVICE },
      unusedReal(),
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(2);
    expect(lines).toEqual([`${JSON.stringify({ ok: false, reason: "unknown-effects" })}\n`]);
  });

  test("missing OS refuses", () => {
    const lines: string[] = [];
    const code = runFrostLookEnvCli({}, unusedReal(), (line) => {
      lines.push(line);
    });
    expect(code).toBe(2);
    expect(lines).toEqual([`${JSON.stringify({ ok: false, reason: "missing-os" })}\n`]);
  });

  test("named real writes the probe and does not commit a stanza", () => {
    const lines: string[] = [];
    const code = runFrostLookEnvCli(
      { [FROST_LOOK_OS_KEY]: "nixos", [FROST_LOOK_EFFECTS_KEY]: "real" },
      host({ tpm2: tpm2Present() }),
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    const body = JSON.parse(lines[0] ?? "") as {
      ok: boolean;
      os: string;
      effects: string;
      probe: { tpm2: string } | null;
    };
    expect(body.ok).toBe(true);
    expect(body.os).toBe("nixos");
    expect(body.effects).toBe("real");
    expect(body.probe?.tpm2).toBe("present");
  });

  test("cluster and ISO bun do not import this CLI", async () => {
    const files = [
      "../../../src/Core.TypeScript/cluster/unseal-path.ts",
      "../../../src/Core.TypeScript/cluster/host-seal-profile.ts",
      "../../../src/Core.TypeScript/installer/bao-elf-capture.ts",
      "../../../src/Core.TypeScript/zflash/firstboot-bao-env.ts",
      "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh",
      "../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
      "./plan-setup-from-frost.ts",
      "./plan-setup-from-frost-look.ts",
    ];
    for (const rel of files) {
      const src = await Bun.file(new URL(rel, import.meta.url)).text();
      expect(src.split("named-frost-look-env").length - 1).toBe(0);
      expect(src.split("runFrostLookEnvCli").length - 1).toBe(0);
      expect(src.split("runFrostLookArgvCli").length - 1).toBe(0);
      expect(src.split("runFrostLookConfCli").length - 1).toBe(0);
    }
    const cli = await Bun.file(new URL("./named-frost-look-env.ts", import.meta.url)).text();
    expect(cli.split("osFamilyFromOsRelease(").length - 1).toBe(0);
    expect(cli.split("planSetupFromFrostLookEnv(").length - 1).toBe(0);
    expect(cli.split("planSetupFromFrostLookOptionalNamedEnv(").length - 1).toBe(0);
    expect(cli.split("integrateAtSetup(").length - 1).toBe(0);
    expect(cli.split("appendFirstbootBaoElfConf(").length - 1).toBe(0);
    expect(cli.split("from \"../../../src/Core.TypeScript/zflash/").length - 1).toBe(0);
    const firstboot = await Bun.file(
      new URL("../../../src/Core.TypeScript/zflash/firstboot-bao-elf.ts", import.meta.url),
    ).text();
    expect(firstboot.split("ZETA_FROST_LOOK_OS").length - 1).toBe(0);
    expect(firstboot.split("ZETA_FROST_LOOK_EFFECTS").length - 1).toBe(0);
    const bunCli = await Bun.file(new URL("../../../src/Core.TypeScript/zflash/firstboot-bao-env.ts", import.meta.url)).text();
    expect(bunCli.split("const probe: NamedHardwareProbe | null = null;").length - 1).toBe(1);
    expect(bunCli.split("named-frost-look-env").length - 1).toBe(0);
    expect(bunCli.split("namedProbeFromFrostLook").length - 1).toBe(0);
    expect(bunCli.split("frost-hardware-probe").length - 1).toBe(0);
    const parse = await Bun.file(new URL("./named-frost-look.ts", import.meta.url)).text();
    expect(parse.split("from \"./named-probe-from-frost-look").length - 1).toBe(0);
    expect(parse.split("namedProbeFromFrostLook").length - 1).toBe(0);
    expect(parse.split("realProbeEffects(").length - 1).toBe(0);
  });

  test("process CLI missing effects does not call realProbeEffects", () => {
    const script = fileURLToPath(new URL("./named-frost-look-env.ts", import.meta.url));
    const ran = spawnSync(process.execPath, [script], {
      env: { PATH: process.env.PATH, [FROST_LOOK_OS_KEY]: "nixos" },
      encoding: "utf8",
    });
    expect(ran.status).toBe(0);
    expect(ran.stdout).toBe(`${JSON.stringify({ ok: true, os: "nixos", effects: null, probe: null })}\n`);
  });
});

describe("consumeFrostLookFromEnv", () => {
  test("named OS plus missing effects is unmeasured", () => {
    expect(consumeFrostLookFromEnv({ [FROST_LOOK_OS_KEY]: "nixos" })).toEqual({
      ok: true,
      os: "nixos",
      effects: null,
    });
  });
});

describe("consumeOptionalFrostLookFromEnv", () => {
  test("missing both keys is unmeasured, not missing-os", () => {
    expect(consumeOptionalFrostLookFromEnv({})).toEqual({ ok: true, look: null });
  });

  test("effects without OS still refuses", () => {
    expect(consumeOptionalFrostLookFromEnv({ [FROST_LOOK_EFFECTS_KEY]: "real" })).toEqual({
      ok: false,
      reason: "missing-os",
    });
  });
});

describe("consumeOptionalFrostLookFromArgv", () => {
  test("missing both flags is unmeasured, not missing-os", () => {
    expect(consumeOptionalFrostLookFromArgv(["--bao-path=/run/current-system/sw/bin/bao"])).toEqual({
      ok: true,
      look: null,
    });
  });

  test("--effects without --os still refuses", () => {
    expect(consumeOptionalFrostLookFromArgv([`${FROST_LOOK_EFFECTS_FLAG}=real`])).toEqual({
      ok: false,
      reason: "missing-os",
    });
  });
});

describe("consumeOptionalFrostLookFromConf", () => {
  test("missing both keys is unmeasured; HOST and bao keys are ignored", () => {
    expect(
      consumeOptionalFrostLookFromConf("ZETA_HOST_BAO=/run/current-system/sw/bin/bao\nZETA_BAO_EPOCH=installed-host\n"),
    ).toEqual({ ok: true, look: null });
  });

  test("effects without OS still refuses", () => {
    expect(consumeOptionalFrostLookFromConf(`${FROST_LOOK_EFFECTS_KEY}='real'\n`)).toEqual({
      ok: false,
      reason: "missing-os",
    });
  });
});

describe("runFrostLookArgvCli — tpmrm0 is not present", () => {
  test("missing --effects is unmeasured, not real", () => {
    const lines: string[] = [];
    const code = runFrostLookArgvCli([`${FROST_LOOK_OS_FLAG}=nixos`], unusedReal(), (line) => {
      lines.push(line);
    });
    expect(code).toBe(0);
    expect(lines).toEqual([`${JSON.stringify({ ok: true, os: "nixos", effects: null, probe: null })}\n`]);
  });

  test("tpmrm0 as --effects refuses", () => {
    const lines: string[] = [];
    const code = runFrostLookArgvCli(
      [`${FROST_LOOK_OS_FLAG}=nixos`, `${FROST_LOOK_EFFECTS_FLAG}=${TPM_CHAR_DEVICE}`],
      unusedReal(),
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(2);
    expect(lines).toEqual([`${JSON.stringify({ ok: false, reason: "unknown-effects" })}\n`]);
  });

  test("tpmrm0 as --os refuses", () => {
    expect(consumeFrostLookFromArgv([`${FROST_LOOK_OS_FLAG}=${TPM_CHAR_DEVICE}`])).toEqual({
      ok: false,
      reason: "unknown-os",
    });
  });

  test("missing --os refuses — does not default to nixos", () => {
    const lines: string[] = [];
    const code = runFrostLookArgvCli([`${FROST_LOOK_EFFECTS_FLAG}=real`], unusedReal(), (line) => {
      lines.push(line);
    });
    expect(code).toBe(2);
    expect(lines).toEqual([`${JSON.stringify({ ok: false, reason: "missing-os" })}\n`]);
  });

  test("named real with TPM 2.0 present stays named", () => {
    const lines: string[] = [];
    const code = runFrostLookArgvCli(
      [FROST_LOOK_OS_FLAG, "nixos", FROST_LOOK_EFFECTS_FLAG, "real"],
      host({ tpm2: tpm2Present() }),
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    const body = JSON.parse(lines[0] ?? "") as { probe: { tpm2: string } | null };
    expect(body.probe?.tpm2).toBe("present");
  });

  test("process CLI --os nixos does not call realProbeEffects", () => {
    const script = fileURLToPath(new URL("./named-frost-look-env.ts", import.meta.url));
    const ran = spawnSync(process.execPath, [script, `${FROST_LOOK_OS_FLAG}=nixos`], {
      env: { PATH: process.env.PATH },
      encoding: "utf8",
    });
    expect(ran.status).toBe(0);
    expect(ran.stdout).toBe(`${JSON.stringify({ ok: true, os: "nixos", effects: null, probe: null })}\n`);
  });
});

describe("consumeFrostLookFromConf — tpmrm0 is not real", () => {
  test("missing effects is unmeasured, not real", () => {
    expect(consumeFrostLookFromConf(`${FROST_LOOK_OS_KEY}=nixos\n`)).toEqual({
      ok: true,
      os: "nixos",
      effects: null,
    });
  });

  test("missing OS refuses — does not default to nixos", () => {
    expect(consumeFrostLookFromConf("")).toEqual({ ok: false, reason: "missing-os" });
    expect(consumeFrostLookFromConf(`${FROST_LOOK_EFFECTS_KEY}=real\n`)).toEqual({
      ok: false,
      reason: "missing-os",
    });
  });

  test("tpmrm0 as OS is unknown, not nixos", () => {
    expect(consumeFrostLookFromConf(`${FROST_LOOK_OS_KEY}=${TPM_CHAR_DEVICE}\n`)).toEqual({
      ok: false,
      reason: "unknown-os",
    });
  });

  test("tpmrm0 as effects is unknown, not real", () => {
    expect(
      consumeFrostLookFromConf(`${FROST_LOOK_OS_KEY}=nixos\n${FROST_LOOK_EFFECTS_KEY}=${TPM_CHAR_DEVICE}\n`),
    ).toEqual({ ok: false, reason: "unknown-effects" });
  });

  test("quoted names stay named; HOST and bao keys are ignored", () => {
    const body = [
      "HOST=control-plane",
      "ZETA_ROLE='control-plane'",
      "ZETA_BAO_LOAD_SITE='on-host'",
      "ZETA_BAO_PATH='/run/current-system/sw/bin/bao'",
      `${FROST_LOOK_OS_KEY}='nixos'`,
      `${FROST_LOOK_EFFECTS_KEY}='null'`,
      "",
    ].join("\n");
    expect(consumeFrostLookFromConf(body)).toEqual({ ok: true, os: "nixos", effects: "null" });
  });

  test("unclosed quote is unsafe, not a silent unmeasure", () => {
    expect(consumeFrostLookFromConf(`${FROST_LOOK_OS_KEY}='nixos\n`)).toEqual({
      ok: false,
      reason: "unsafe-conf-value",
    });
  });
});

describe("runFrostLookConfCli — tpmrm0 is not present", () => {
  test("missing effects writes unmeasured probe and exits 0", () => {
    const lines: string[] = [];
    const code = runFrostLookConfCli(`${FROST_LOOK_OS_KEY}=nixos\n`, unusedReal(), (line) => {
      lines.push(line);
    });
    expect(code).toBe(0);
    expect(lines).toEqual([`${JSON.stringify({ ok: true, os: "nixos", effects: null, probe: null })}\n`]);
  });

  test("named real with TPM 2.0 present stays named", () => {
    const lines: string[] = [];
    const code = runFrostLookConfCli(
      `${FROST_LOOK_OS_KEY}='nixos'\n${FROST_LOOK_EFFECTS_KEY}='real'\n`,
      host({ tpm2: tpm2Present() }),
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    const body = JSON.parse(lines[0] ?? "") as { probe: { tpm2: string } | null };
    expect(body.probe?.tpm2).toBe("present");
  });

  test("mixing --from-conf with --os refuses", () => {
    expect(
      consumeFrostLookFromCliArgv([
        `${FROST_LOOK_CONF_FLAG}=${FROST_LOOK_OS_KEY}=nixos`,
        `${FROST_LOOK_OS_FLAG}=darwin`,
      ]),
    ).toEqual({ ok: false, reason: "mixed-source" });
  });

  test("process CLI --from-conf does not call realProbeEffects or mix env", () => {
    const script = fileURLToPath(new URL("./named-frost-look-env.ts", import.meta.url));
    const ran = spawnSync(
      process.execPath,
      [script, FROST_LOOK_CONF_FLAG, `${FROST_LOOK_OS_KEY}=nixos`],
      {
        env: { PATH: process.env.PATH, [FROST_LOOK_EFFECTS_KEY]: "real" },
        encoding: "utf8",
      },
    );
    expect(ran.status).toBe(0);
    expect(ran.stdout).toBe(`${JSON.stringify({ ok: true, os: "nixos", effects: null, probe: null })}\n`);
  });
});
