import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FROST_LOOK_EFFECTS_KEY, FROST_LOOK_OS_KEY } from "../../../tools/setup/persona-keys/named-frost-look.ts";
import { TPM_CHAR_DEVICE } from "../cluster/bao-load-site.ts";
import { UNSEAL_REQUEST_ENV_KEY } from "../cluster/unseal-path.ts";
import {
  FIRSTBOOT_BAO_ELF_EPOCH_KEY,
  FIRSTBOOT_BAO_LOAD_SITE_KEY,
  FIRSTBOOT_BAO_PATH_KEY,
  NIXOS_HOST_BAO,
  composeFirstbootBaoElfCarrier,
  consumeFirstbootBaoElfProcessEnv,
  nixosHostBaoAsk,
} from "./firstboot-bao-elf.ts";

const FIRSTBOOT_SH = fileURLToPath(
  new URL("../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh", import.meta.url),
);
const INSTALL_SH = fileURLToPath(
  new URL("../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh", import.meta.url),
);

const FIRSTBOOT_START = "# ── 081M1VZRST2087G0R001QEJDWG: named bao export";
const FIRSTBOOT_END = "# ── 081M1VZRST2087G0R001QEJDWG: end named bao export";
const INSTALL_START = "# ── 081M1VZRST2087G0R001QEJDWG: named bao site+path pickup";
const INSTALL_END = "# ── 081M1VZRST2087G0R001QEJDWG: end named bao pickup";
const INVOKE_START = "# ── 081M1W1NCDT087G0R002H3VG6Y: named bao bun consume";
const INVOKE_END = "# ── 081M1W1NCDT087G0R002H3VG6Y: end named bao bun consume";
const SEAL_DETECT_START = "# ── 081M22M7G8M087G0R003R1C8Z4: automate the seal-path detection";
const SEAL_DETECT_END = "# ── 081M22M7G8M087G0R003R1C8Z4: end seal-path live look";
const SEAL_DETECT_HELPER_REL = "tools/setup/persona-keys/seal-path-detect.ts";
const BAO_ENV_HELPER_REL = "src/Core.TypeScript/zflash/firstboot-bao-env.ts";

const SITE_SED_BASH = `s/^${FIRSTBOOT_BAO_LOAD_SITE_KEY}='\\([^']*\\)'\\$/\\1/p`;
const PATH_SED_BASH = `s/^${FIRSTBOOT_BAO_PATH_KEY}='\\([^']*\\)'\\$/\\1/p`;
const SITE_SED = `s/^${FIRSTBOOT_BAO_LOAD_SITE_KEY}='\\([^']*\\)'$/\\1/p`;
const PATH_SED = `s/^${FIRSTBOOT_BAO_PATH_KEY}='\\([^']*\\)'$/\\1/p`;

function sliceMarkedBlock(src: string, start: string, end: string): string {
  const from = src.indexOf(start);
  const to = src.indexOf(end, from);
  expect(from).toBeGreaterThan(0);
  expect(to).toBeGreaterThan(from);
  return src.slice(from, to);
}

function executableLines(block: string): string {
  return block
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#");
    })
    .join("\n");
}

function parsePickupStdout(stdout: string): {
  site: string;
  openedPath: string;
  exported: string;
} {
  const site = stdout.match(/^SITE=(.*)$/m)?.[1];
  const openedPath = stdout.match(/^OPENED_PATH=(.*)$/m)?.[1];
  const exported = stdout.match(/^EXPORTED=(.*)$/m)?.[1];
  expect(site).toBeDefined();
  expect(openedPath).toBeDefined();
  expect(exported).toBeDefined();
  return { site: site!, openedPath: openedPath!, exported: exported! };
}

function runFirstbootBaoExport(env: { site?: string; openedPath?: string }): {
  site: string;
  openedPath: string;
  exported: string;
  stderr: string;
  status: number | null;
} {
  const block = sliceMarkedBlock(readFileSync(FIRSTBOOT_SH, "utf8"), FIRSTBOOT_START, FIRSTBOOT_END);
  const prelude = [
    "set -uo pipefail",
    env.site === undefined ? "" : `${FIRSTBOOT_BAO_LOAD_SITE_KEY}=${env.site}`,
    env.openedPath === undefined ? "" : `${FIRSTBOOT_BAO_PATH_KEY}=${env.openedPath}`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
  const epilogue = `
if [[ -n "\${${FIRSTBOOT_BAO_LOAD_SITE_KEY}+x}" ]]; then echo "SITE=\${${FIRSTBOOT_BAO_LOAD_SITE_KEY}}"; else echo "SITE=UNSET"; fi
if [[ -n "\${${FIRSTBOOT_BAO_PATH_KEY}+x}" ]]; then echo "OPENED_PATH=\${${FIRSTBOOT_BAO_PATH_KEY}}"; else echo "OPENED_PATH=UNSET"; fi
if export -p | grep -F '${FIRSTBOOT_BAO_LOAD_SITE_KEY}' >/dev/null && export -p | grep -F '${FIRSTBOOT_BAO_PATH_KEY}' >/dev/null; then echo EXPORTED=yes; else echo EXPORTED=no; fi
`;
  const spawned = spawnSync("bash", ["-c", `${prelude}\n${block}\n${epilogue}`], { encoding: "utf8" });
  expect(spawned.error).toBeUndefined();
  return { ...parsePickupStdout(spawned.stdout), stderr: spawned.stderr, status: spawned.status };
}

function runInstallBaoPickup(opts: { conf?: string; env?: { site?: string; openedPath?: string } }): {
  site: string;
  openedPath: string;
  exported: string;
  stderr: string;
  status: number | null;
} {
  const dir = mkdtempSync(join(tmpdir(), "firstboot-bao-pickup-"));
  try {
    const confPath = join(dir, "zeta-firstboot.conf");
    if (opts.conf !== undefined) writeFileSync(confPath, opts.conf);
    const block = sliceMarkedBlock(readFileSync(INSTALL_SH, "utf8"), INSTALL_START, INSTALL_END)
      .replaceAll("sudo sed", "sed")
      .replaceAll("sudo test", "test");
    const prelude = [
      "set -euo pipefail",
      `BOOT_USB_FIRSTBOOT_CONF=${opts.conf === undefined ? `${dir}/missing.conf` : confPath}`,
      opts.env?.site === undefined ? "" : `${FIRSTBOOT_BAO_LOAD_SITE_KEY}=${opts.env.site}`,
      opts.env?.openedPath === undefined ? "" : `${FIRSTBOOT_BAO_PATH_KEY}=${opts.env.openedPath}`,
    ]
      .filter((line) => line.length > 0)
      .join("\n");
    const epilogue = `
if [[ -n "\${${FIRSTBOOT_BAO_LOAD_SITE_KEY}+x}" ]]; then echo "SITE=\${${FIRSTBOOT_BAO_LOAD_SITE_KEY}}"; else echo "SITE=UNSET"; fi
if [[ -n "\${${FIRSTBOOT_BAO_PATH_KEY}+x}" ]]; then echo "OPENED_PATH=\${${FIRSTBOOT_BAO_PATH_KEY}}"; else echo "OPENED_PATH=UNSET"; fi
if export -p | grep -F '${FIRSTBOOT_BAO_LOAD_SITE_KEY}' >/dev/null && export -p | grep -F '${FIRSTBOOT_BAO_PATH_KEY}' >/dev/null; then echo EXPORTED=yes; else echo EXPORTED=no; fi
`;
    const spawned = spawnSync("bash", ["-c", `${prelude}\n${block}\n${epilogue}`], { encoding: "utf8" });
    expect(spawned.error).toBeUndefined();
    return { ...parsePickupStdout(spawned.stdout), stderr: spawned.stderr, status: spawned.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function sedQuotedAssignment(conf: string, program: string): string {
  const dir = mkdtempSync(join(tmpdir(), "firstboot-bao-sed-"));
  try {
    const confPath = join(dir, "zeta-firstboot.conf");
    writeFileSync(confPath, conf);
    const spawned = spawnSync("sed", ["-n", program, confPath], { encoding: "utf8" });
    expect(spawned.status).toBe(0);
    return spawned.stdout.replace(/\n$/u, "").split("\n")[0] ?? "";
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("zeta-first-boot.sh named bao export", () => {
  const src = readFileSync(FIRSTBOOT_SH, "utf8");
  const block = sliceMarkedBlock(src, FIRSTBOOT_START, FIRSTBOOT_END);

  test("export line is present after sourcing the ESP conf", () => {
    expect(src.indexOf("export ZETA_BAO_LOAD_SITE ZETA_BAO_PATH")).toBeGreaterThan(0);
    expect(src.indexOf(FIRSTBOOT_START)).toBeGreaterThan(src.indexOf("zeta_source_esp_firstboot_conf || true"));
  });

  test("executable pickup does not invoke bun or fill the host bao path", () => {
    const executable = executableLines(block);
    expect(executable.split("firstboot-bao-env").length - 1).toBe(0);
    expect(executable.split("bun").length - 1).toBe(0);
    expect(executable.split(NIXOS_HOST_BAO).length - 1).toBe(0);
    expect(executable).toBe(
      [
        `if [[ -n "\${${FIRSTBOOT_BAO_LOAD_SITE_KEY}:-}" && -n "\${${FIRSTBOOT_BAO_PATH_KEY}:-}" ]]; then`,
        `  export ${FIRSTBOOT_BAO_LOAD_SITE_KEY} ${FIRSTBOOT_BAO_PATH_KEY}`,
        `  echo "[081M1VZRST2087G0R001QEJDWG-bao] exported site=\${${FIRSTBOOT_BAO_LOAD_SITE_KEY}} path=\${${FIRSTBOOT_BAO_PATH_KEY}}"`,
        `elif [[ -n "\${${FIRSTBOOT_BAO_LOAD_SITE_KEY}:-}" || -n "\${${FIRSTBOOT_BAO_PATH_KEY}:-}" ]]; then`,
        `  echo "[081M1VZRST2087G0R001QEJDWG-bao] WARN: one bao name without the other; unsetting both (does not fill host bao)" >&2`,
        `  unset ${FIRSTBOOT_BAO_LOAD_SITE_KEY} ${FIRSTBOOT_BAO_PATH_KEY}`,
        `fi`,
      ].join("\n"),
    );
  });

  test("option D names are exported to the child", () => {
    const got = runFirstbootBaoExport({ site: "on-host", openedPath: NIXOS_HOST_BAO });
    expect(got.status).toBe(0);
    expect(got).toMatchObject({ site: "on-host", openedPath: NIXOS_HOST_BAO, exported: "yes" });
    expect(
      consumeFirstbootBaoElfProcessEnv({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: got.site,
        [FIRSTBOOT_BAO_PATH_KEY]: got.openedPath,
      }),
    ).toEqual({ ok: true, ask: nixosHostBaoAsk() });
  });

  test("one name without the other unsets both and does not fill NIXOS_HOST_BAO", () => {
    const siteOnly = runFirstbootBaoExport({ site: "on-host" });
    expect(siteOnly.status).toBe(0);
    expect(siteOnly).toEqual({
      site: "UNSET",
      openedPath: "UNSET",
      exported: "no",
      stderr: siteOnly.stderr,
      status: 0,
    });
    expect(siteOnly.stderr).toMatch(/one bao name without the other/);
    const pathOnly = runFirstbootBaoExport({ openedPath: NIXOS_HOST_BAO });
    expect(pathOnly).toMatchObject({ site: "UNSET", openedPath: "UNSET", exported: "no", status: 0 });
  });

  test("tpmrm0 is shell-safe and may be exported; bun consume is still not an ask", () => {
    const got = runFirstbootBaoExport({ site: "on-host", openedPath: TPM_CHAR_DEVICE });
    expect(got).toMatchObject({ site: "on-host", openedPath: TPM_CHAR_DEVICE, exported: "yes", status: 0 });
    expect(
      consumeFirstbootBaoElfProcessEnv({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: got.site,
        [FIRSTBOOT_BAO_PATH_KEY]: got.openedPath,
      }),
    ).toEqual({ ok: true, ask: null });
  });

  test("neither name is unmeasured — not exported, not filled", () => {
    expect(runFirstbootBaoExport({})).toMatchObject({
      site: "UNSET",
      openedPath: "UNSET",
      exported: "no",
      status: 0,
    });
  });
});

describe("zeta-install.sh named bao sed-parse", () => {
  const src = readFileSync(INSTALL_SH, "utf8");
  const block = sliceMarkedBlock(src, INSTALL_START, INSTALL_END);

  test("quoted-assignment sed for both bao keys sits next to the join-URL pickup", () => {
    expect(src.indexOf(SITE_SED_BASH)).toBeGreaterThan(0);
    expect(src.indexOf(PATH_SED_BASH)).toBeGreaterThan(0);
    expect(src.indexOf(INSTALL_START)).toBeGreaterThan(src.indexOf("BOOT_USB_FIRSTBOOT_CONF="));
    expect(src.indexOf(INSTALL_START)).toBeLessThan(src.indexOf("ZETA_CLUSTER_NODE_CIDR="));
  });

  test("executable pickup does not invoke bun, stage unused files, or fill host bao", () => {
    const executable = executableLines(block);
    expect(executable.split("firstboot-bao-env").length - 1).toBe(0);
    expect(executable.split("bun").length - 1).toBe(0);
    expect(executable.split("/mnt/etc/zeta").length - 1).toBe(0);
    expect(executable.split(NIXOS_HOST_BAO).length - 1).toBe(0);
    expect(src.indexOf("^(on-host|in-chart-image)$")).toBeGreaterThan(0);
    expect(src.indexOf("^[A-Za-z0-9._:/@-]+$")).toBeGreaterThan(0);
  });

  test("carrier conf lines round-trip through the same sed zeta-install uses", () => {
    const carrier = composeFirstbootBaoElfCarrier(nixosHostBaoAsk());
    if (!carrier.ok) throw new Error(carrier.reason);
    const conf = `${carrier.confLines[0]}\n${carrier.confLines[1]}\n`;
    const site = sedQuotedAssignment(conf, SITE_SED);
    const openedPath = sedQuotedAssignment(conf, PATH_SED);
    expect(site).toBe("on-host");
    expect(openedPath).toBe(NIXOS_HOST_BAO);
    expect(
      consumeFirstbootBaoElfProcessEnv({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: site,
        [FIRSTBOOT_BAO_PATH_KEY]: openedPath,
      }),
    ).toEqual({ ok: true, ask: nixosHostBaoAsk() });
  });

  test("option D on the ESP conf is exported", () => {
    const carrier = composeFirstbootBaoElfCarrier(nixosHostBaoAsk());
    if (!carrier.ok) throw new Error(carrier.reason);
    const got = runInstallBaoPickup({ conf: `${carrier.confLines[0]}\n${carrier.confLines[1]}\n` });
    expect(got).toMatchObject({ site: "on-host", openedPath: NIXOS_HOST_BAO, exported: "yes", status: 0 });
  });

  test("already-exported env is kept and not overwritten from conf", () => {
    const got = runInstallBaoPickup({
      conf: `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='in-chart-image'\n${FIRSTBOOT_BAO_PATH_KEY}='/bin/bao'\n`,
      env: { site: "on-host", openedPath: NIXOS_HOST_BAO },
    });
    expect(got).toMatchObject({ site: "on-host", openedPath: NIXOS_HOST_BAO, exported: "yes", status: 0 });
  });

  test("one conf key without the other unsets both and does not fill NIXOS_HOST_BAO", () => {
    const got = runInstallBaoPickup({ conf: `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'\n` });
    expect(got).toMatchObject({ site: "UNSET", openedPath: "UNSET", exported: "no", status: 0 });
    expect(got.stderr).toMatch(/one bao name without the other/);
  });

  test("malformed site is refused — does not fill NIXOS_HOST_BAO", () => {
    const got = runInstallBaoPickup({
      conf: `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='tpmrm0'\n${FIRSTBOOT_BAO_PATH_KEY}='${NIXOS_HOST_BAO}'\n`,
    });
    expect(got).toMatchObject({ site: "UNSET", openedPath: "UNSET", exported: "no", status: 0 });
    expect(got.stderr).toMatch(/refusing malformed bao names/);
  });

  test("a path with a shell metacharacter is refused", () => {
    const got = runInstallBaoPickup({
      conf: `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'\n${FIRSTBOOT_BAO_PATH_KEY}='${NIXOS_HOST_BAO};reboot'\n`,
    });
    expect(got).toMatchObject({ site: "UNSET", openedPath: "UNSET", exported: "no", status: 0 });
  });

  test("tpmrm0 on the ESP may be exported; bun consume is still not an ask", () => {
    const got = runInstallBaoPickup({
      conf: `${FIRSTBOOT_BAO_LOAD_SITE_KEY}='on-host'\n${FIRSTBOOT_BAO_PATH_KEY}='${TPM_CHAR_DEVICE}'\n`,
    });
    expect(got).toMatchObject({ site: "on-host", openedPath: TPM_CHAR_DEVICE, exported: "yes", status: 0 });
    expect(
      consumeFirstbootBaoElfProcessEnv({
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: got.site,
        [FIRSTBOOT_BAO_PATH_KEY]: got.openedPath,
      }),
    ).toEqual({ ok: true, ask: null });
  });
});

describe("zeta-install.sh named bao bun consume after 6.95a", () => {
  const src = readFileSync(INSTALL_SH, "utf8");
  const firstboot = readFileSync(FIRSTBOOT_SH, "utf8");
  const block = sliceMarkedBlock(src, INVOKE_START, INVOKE_END);
  const helper = fileURLToPath(new URL("./firstboot-bao-env.ts", import.meta.url));

  test("invoke sits after 6.95a-bootstrap and after ESP pickup", () => {
    expect(src.indexOf(BAO_ENV_HELPER_REL)).toBeGreaterThan(src.indexOf("6.95a-bootstrap"));
    expect(src.indexOf(INVOKE_START)).toBeGreaterThan(src.indexOf(INSTALL_END));
    expect(src.indexOf(INVOKE_START)).toBeGreaterThan(src.indexOf("tools/setup/install.sh"));
  });

  test("first-boot still does not invoke bun consume", () => {
    const executable = executableLines(firstboot);
    expect(executable.split("firstboot-bao-env").length - 1).toBe(0);
    expect(executable.split("bun ").length - 1).toBe(0);
  });

  test("pickup executable still does not invoke bun", () => {
    const pickup = executableLines(sliceMarkedBlock(src, INSTALL_START, INSTALL_END));
    expect(pickup.split("firstboot-bao-env").length - 1).toBe(0);
    expect(pickup.split("bun").length - 1).toBe(0);
  });

  test("invoke passes both env names into bun and does not open tpmrm0 or fill host bao", () => {
    const executable = executableLines(block);
    expect(executable.split("bun '$BAO_ENV_HELPER'").length - 1).toBe(1);
    expect(executable.split(`export ${FIRSTBOOT_BAO_LOAD_SITE_KEY}=`).length - 1).toBe(1);
    expect(executable.split(`${FIRSTBOOT_BAO_PATH_KEY}='`).length - 1).toBe(1);
    expect(executable.split(`${FIRSTBOOT_BAO_ELF_EPOCH_KEY}='installer-iso'`).length - 1).toBe(1);
    expect(executable.split(`${UNSEAL_REQUEST_ENV_KEY}=`).length - 1).toBe(0);
    expect(executable.split(`${FROST_LOOK_OS_KEY}=`).length - 1).toBe(0);
    expect(executable.split(`${FROST_LOOK_EFFECTS_KEY}=`).length - 1).toBe(0);
    expect(executable.split("jq -c '.requested'").length - 1).toBe(1);
    expect(executable.split("jq -c '.probe'").length - 1).toBe(1);
    expect(executable.split("jq -c '.look'").length - 1).toBe(1);
    expect(executable.split("--from-json").length - 1).toBe(0);
    expect(block.split("null request is unmeasured, not auto").length - 1).toBe(1);
    expect(block.split("null probe is unmeasured, not present").length - 1).toBe(1);
    expect(block.split("null look is unmeasured, not a live look").length - 1).toBe(1);
    expect(executable.split("planSetupFromNamedBaoElfEnv").length - 1).toBe(0);
    expect(executable.split("integrateAtSetup").length - 1).toBe(0);
    expect(executable.split("[ -d /mnt ]").length - 1).toBe(0);
    expect(executable.split("test -d /mnt").length - 1).toBe(0);
    expect(executable.split(TPM_CHAR_DEVICE).length - 1).toBe(0);
    expect(executable.split(NIXOS_HOST_BAO).length - 1).toBe(0);
    expect(executable.split("Application.yaml").length - 1).toBe(0);
    expect(executable.split("seal ").length - 1).toBe(0);
    expect(block.split("ISO current-system").length - 1).toBe(1);
    expect(block.split("null ask is not a named bao").length - 1).toBe(0);
  });

  test("the helper the installer names still consumes option D from env", () => {
    expect(helper.endsWith(BAO_ENV_HELPER_REL.replace("src/Core.TypeScript/zflash/", ""))).toBe(true);
    const helperSrc = readFileSync(helper, "utf8");
    expect(helperSrc.split("integrateAtSetupFromEnv").length - 1).toBe(0);
    expect(helperSrc.split("frost-hardware-probe").length - 1).toBe(0);
    expect(helperSrc.split("named-frost-look-env").length - 1).toBe(0);
    expect(helperSrc.split("namedProbeFromFrostLook").length - 1).toBe(0);
    expect(helperSrc.split("realProbeEffects").length - 1).toBe(0);
    expect(helperSrc.split("--from-json").length - 1).toBe(0);
    expect(helperSrc.split("const probe: NamedHardwareProbe | null = null;").length - 1).toBe(1);
    const spawned = spawnSync(process.execPath, [helper], {
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

  test("the helper the installer names reports installer-iso and filters ISO current-system bao", () => {
    expect(helper.endsWith(BAO_ENV_HELPER_REL.replace("src/Core.TypeScript/zflash/", ""))).toBe(true);
    const spawned = spawnSync(process.execPath, [helper], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
      },
    });
    expect(spawned.status).toBe(0);
    expect(JSON.parse(spawned.stdout)).toEqual({
      ok: true,
      ask: null,
      epoch: "installer-iso",
      requested: null,
      probe: null,
      look: null,
    });
  });

  test("the helper the installer names still returns null ask for tpmrm0", () => {
    const spawned = spawnSync(process.execPath, [helper], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: TPM_CHAR_DEVICE,
      },
    });
    expect(spawned.status).toBe(0);
    expect(JSON.parse(spawned.stdout)).toEqual({
      ok: true,
      ask: null,
      epoch: null,
      requested: null,
      probe: null,
      look: null,
    });
  });

  test("the helper the installer names reports a named unseal request and refuses tpmrm0", () => {
    const named = spawnSync(process.execPath, [helper], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [UNSEAL_REQUEST_ENV_KEY]: "pkcs11-tpm",
      },
    });
    expect(named.status).toBe(0);
    expect(JSON.parse(named.stdout)).toEqual({
      ok: true,
      ask: null,
      epoch: "installer-iso",
      requested: "pkcs11-tpm",
      probe: null,
      look: null,
    });
    const fromTpmrm0 = spawnSync(process.execPath, [helper], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [UNSEAL_REQUEST_ENV_KEY]: TPM_CHAR_DEVICE,
      },
    });
    expect(fromTpmrm0.status).toBe(2);
    expect(JSON.parse(fromTpmrm0.stdout)).toEqual({ ok: false, reason: "unknown-request" });
  });

  test("the helper the installer names reports frost-look keys and keeps probe null", () => {
    const named = spawnSync(process.execPath, [helper], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [FROST_LOOK_OS_KEY]: "nixos",
        [FROST_LOOK_EFFECTS_KEY]: "real",
      },
    });
    expect(named.status).toBe(0);
    expect(JSON.parse(named.stdout)).toEqual({
      ok: true,
      ask: null,
      epoch: "installer-iso",
      requested: null,
      probe: null,
      look: { os: "nixos", effects: "real" },
    });
    const fromTpmrm0 = spawnSync(process.execPath, [helper], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        [FIRSTBOOT_BAO_LOAD_SITE_KEY]: "on-host",
        [FIRSTBOOT_BAO_PATH_KEY]: NIXOS_HOST_BAO,
        [FIRSTBOOT_BAO_ELF_EPOCH_KEY]: "installer-iso",
        [FROST_LOOK_OS_KEY]: "nixos",
        [FROST_LOOK_EFFECTS_KEY]: TPM_CHAR_DEVICE,
      },
    });
    expect(fromTpmrm0.status).toBe(2);
    expect(JSON.parse(fromTpmrm0.stdout)).toEqual({ ok: false, reason: "unknown-effects" });
  });
});

describe("zeta-install.sh USB seal-path live look (081M22M7G8M / 081M246EAP)", () => {
  const src = readFileSync(INSTALL_SH, "utf8");
  const block = sliceMarkedBlock(src, SEAL_DETECT_START, SEAL_DETECT_END);
  const executable = executableLines(block);

  test("live look sits after named bao bun consume", () => {
    expect(src.indexOf(SEAL_DETECT_START)).toBeGreaterThan(src.indexOf(INVOKE_END));
  });

  test("runs seal-path-detect with auto on a real NixOS look", () => {
    expect(executable.split(SEAL_DETECT_HELPER_REL).length - 1).toBe(1);
    expect(executable.split("--os nixos").length - 1).toBe(1);
    expect(executable.split("--effects real").length - 1).toBe(1);
    expect(executable.split("--request auto").length - 1).toBe(1);
  });

  test("logs the USB ladder (hsm then tpm then sidecar) and stays observational", () => {
    expect(executable.split(".ladder").length - 1).toBe(1);
    expect(executable.split("ladder:").length - 1).toBe(1);
    expect(block.split("observed, not configured").length - 1).toBe(1);
    expect(block.split("hsm → tpm → sidecar").length - 1).toBe(1);
  });

  test("does not configure a seal, call overlay, or invent a probe", () => {
    expect(executable.split("Application.yaml").length - 1).toBe(0);
    expect(executable.split('seal "pkcs11"').length - 1).toBe(0);
    expect(executable.split("valuesObject").length - 1).toBe(0);
    expect(executable.split("plan-setup-from-frost-look").length - 1).toBe(0);
    expect(executable.split("planSetupFromNamedBaoElfEnv").length - 1).toBe(0);
    expect(executable.split("overlay").length - 1).toBe(0);
    expect(executable.split(TPM_CHAR_DEVICE).length - 1).toBe(0);
    expect(executable.split("--from-json").length - 1).toBe(0);
  });
});
