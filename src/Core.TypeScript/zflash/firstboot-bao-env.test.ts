import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FROST_LOOK_EFFECTS_KEY, FROST_LOOK_OS_KEY } from "../../../tools/setup/persona-keys/named-frost-look.ts";
import { TPM_CHAR_DEVICE } from "../cluster/bao-load-site.ts";
import { UNSEAL_REQUEST_ENV_KEY } from "../cluster/unseal-path.ts";
import {
  FIRSTBOOT_BAO_ELF_EPOCH_KEY,
  FIRSTBOOT_BAO_LOAD_SITE_KEY,
  FIRSTBOOT_BAO_PATH_KEY,
  NIXOS_HOST_BAO,
  consumeFirstbootBaoElfEnvWithEpoch,
  consumeFirstbootBaoElfProcessEnv,
  namedBaoElfArgErrorMessage,
  nixosHostBaoAsk,
  parseBaoElfEpoch,
} from "./firstboot-bao-elf.ts";
import { runFirstbootBaoElfEnvCli } from "./firstboot-bao-env.ts";

describe("consumeFirstbootBaoElfProcessEnv", () => {
  test("missing keys are unmeasured", () => {
    expect(consumeFirstbootBaoElfProcessEnv({})).toEqual({ ok: true, ask: null });
  });

  test("option D env is a named ask", () => {
    expect(
      consumeFirstbootBaoElfProcessEnv({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
      }),
    ).toEqual({ ok: true, ask: nixosHostBaoAsk() });
  });

  test("one key without the other refuses — does not fill NIXOS_HOST_BAO", () => {
    expect(consumeFirstbootBaoElfProcessEnv({ [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host" })).toEqual({
      ok: false,
      reason: "site-without-path",
    });
    expect(consumeFirstbootBaoElfProcessEnv({ [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO })).toEqual({
      ok: false,
      reason: "path-without-site",
    });
  });

  test("tpmrm0 is shell-safe and still not an ask", () => {
    expect(
      consumeFirstbootBaoElfProcessEnv({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: TPM_CHAR_DEVICE,
      }),
    ).toEqual({ ok: true, ask: null });
  });
});

describe("runFirstbootBaoElfEnvCli", () => {
  test("writes option D JSON and exits 0", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    expect(lines).toEqual([
      `${JSON.stringify({ ok: true, ask: nixosHostBaoAsk(), epoch: null, requested: null, probe: null, look: null })}\n`,
    ]);
  });

  test("writes a refusal and exits 2", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli({ [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host" }, (line) => {
      lines.push(line);
    });
    expect(code).toBe(2);
    expect(lines).toEqual([`${JSON.stringify({ ok: false, reason: "site-without-path" })}\n`]);
  });
});

describe("firstboot-bao-env.ts process entry", () => {
  const script = fileURLToPath(new URL("./firstboot-bao-env.ts", import.meta.url));

  test("spawned bun consume round-trips option D from env", () => {
    const spawned = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
      },
    });
    expect(spawned.status).toBe(0);
    expect(JSON.parse(spawned.stdout)).toEqual({
      ok: true,
      ask: nixosHostBaoAsk(),
      epoch: null,
      requested: null,
      probe: null,
      look: null,
    });
  });

  test("spawned bun consume is unmeasured when neither key is exported", () => {
    const spawned = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    expect(spawned.status).toBe(0);
    expect(JSON.parse(spawned.stdout)).toEqual({ ok: true, ask: null, epoch: null, requested: null, probe: null, look: null });
  });
});

describe("parseBaoElfEpoch — named, not inferred", () => {
  test("missing is unmeasured, not installed-host", () => {
    expect(parseBaoElfEpoch(undefined)).toEqual({ ok: true, epoch: null });
  });

  test("installer-iso and installed-host are named", () => {
    expect(parseBaoElfEpoch("installer-iso")).toEqual({ ok: true, epoch: "installer-iso" });
    expect(parseBaoElfEpoch("installed-host")).toEqual({ ok: true, epoch: "installed-host" });
  });

  test("/mnt and tpmrm0 are unknown, not installer-iso", () => {
    expect(parseBaoElfEpoch("/mnt")).toEqual({ ok: false, reason: "unknown-epoch" });
    expect(parseBaoElfEpoch(TPM_CHAR_DEVICE)).toEqual({ ok: false, reason: "unknown-epoch" });
    expect(parseBaoElfEpoch("on-host")).toEqual({ ok: false, reason: "unknown-epoch" });
  });

  test("empty and unsafe values refuse", () => {
    expect(parseBaoElfEpoch("")).toEqual({ ok: false, reason: "empty-epoch" });
    expect(parseBaoElfEpoch("installer-iso;reboot")).toEqual({ ok: false, reason: "unsafe-conf-value" });
    expect(namedBaoElfArgErrorMessage("unknown-epoch")).toBe(
      "ZETA_BAO_ELF_EPOCH must be installer-iso or installed-host",
    );
    expect(namedBaoElfArgErrorMessage("empty-epoch")).toBe("ZETA_BAO_ELF_EPOCH requires a value");
  });
});

describe("consumeFirstbootBaoElfEnvWithEpoch", () => {
  test("installer-iso filters NIXOS_HOST_BAO from the sourced ask", () => {
    expect(
      consumeFirstbootBaoElfEnvWithEpoch({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
      }),
    ).toEqual({ ok: true, ask: null, epoch: "installer-iso" });
  });

  test("installer-iso still reports a named store path as an ask", () => {
    const storeBao = "/nix/store/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee-openbao/bin/bao";
    expect(
      consumeFirstbootBaoElfEnvWithEpoch({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: storeBao,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
      }),
    ).toEqual({ ok: true, ask: { site: "on-host", openedPath: storeBao }, epoch: "installer-iso" });
  });

  test("installed-host keeps option D; missing epoch still reports the sourced ask", () => {
    expect(
      consumeFirstbootBaoElfEnvWithEpoch({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installed-host",
      }),
    ).toEqual({ ok: true, ask: nixosHostBaoAsk(), epoch: "installed-host" });
    expect(
      consumeFirstbootBaoElfEnvWithEpoch({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
      }),
    ).toEqual({ ok: true, ask: nixosHostBaoAsk(), epoch: null });
    expect(
      consumeFirstbootBaoElfEnvWithEpoch({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "/mnt",
      }),
    ).toEqual({ ok: false, reason: "unknown-epoch" });
  });
});

describe("runFirstbootBaoElfEnvCli epoch", () => {
  test("writes installer-iso epoch with a null ask for NIXOS_HOST_BAO", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    expect(lines).toEqual([
      `${JSON.stringify({ ok: true, ask: null, epoch: "installer-iso", requested: null, probe: null, look: null })}\n`,
    ]);
  });
});

describe("runFirstbootBaoElfEnvCli unseal request", () => {
  test("missing request is unmeasured, not auto", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      ok: true,
      ask: null,
      epoch: "installer-iso",
      requested: null,
      probe: null,
      look: null,
    });
  });

  test("named pkcs11-tpm is reported; probe stays unmeasured", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [UNSEAL_REQUEST_ENV_KEY]: "pkcs11-tpm",
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      ok: true,
      ask: null,
      epoch: "installer-iso",
      requested: "pkcs11-tpm",
      probe: null,
      look: null,
    });
  });

  test("tpmrm0 as unseal request refuses and does not report auto", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [UNSEAL_REQUEST_ENV_KEY]: TPM_CHAR_DEVICE,
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(2);
    expect(JSON.parse(lines[0] ?? "")).toEqual({ ok: false, reason: "unknown-request" });
  });
});

describe("runFirstbootBaoElfEnvCli frost look", () => {
  test("missing frost-look keys are unmeasured, not missing-os", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      ok: true,
      ask: null,
      epoch: "installer-iso",
      requested: null,
      probe: null,
      look: null,
    });
  });

  test("named OS plus missing effects is reported; probe stays null", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [FROST_LOOK_OS_KEY]: "nixos",
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      ok: true,
      ask: null,
      epoch: "installer-iso",
      requested: null,
      probe: null,
      look: { os: "nixos", effects: null },
    });
  });

  test("named real is reported and still leaves probe null", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [FROST_LOOK_OS_KEY]: "nixos",
        [FROST_LOOK_EFFECTS_KEY]: "real",
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(0);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      ok: true,
      ask: null,
      epoch: "installer-iso",
      requested: null,
      probe: null,
      look: { os: "nixos", effects: "real" },
    });
  });

  test("tpmrm0 as effects refuses and does not fill probe", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [FROST_LOOK_OS_KEY]: "nixos",
        [FROST_LOOK_EFFECTS_KEY]: TPM_CHAR_DEVICE,
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(2);
    expect(JSON.parse(lines[0] ?? "")).toEqual({ ok: false, reason: "unknown-effects" });
  });

  test("tpmrm0 as OS refuses and does not default to nixos", () => {
    const lines: string[] = [];
    const code = runFirstbootBaoElfEnvCli(
      {
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FROST_LOOK_OS_KEY]: TPM_CHAR_DEVICE,
      },
      (line) => {
        lines.push(line);
      },
    );
    expect(code).toBe(2);
    expect(JSON.parse(lines[0] ?? "")).toEqual({ ok: false, reason: "unknown-os" });
  });
});
