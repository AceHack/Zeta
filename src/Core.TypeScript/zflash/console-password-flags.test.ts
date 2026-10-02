/**
 * console-password-flags.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 19.
 *
 * zflash `--console-password default|mint` bakes the console-password POLICY into the ESP
 * `/zeta-firstboot.conf` (`ZETA_CONSOLE_PASSWORD_POLICY`), carried exactly like `--lb-pool`. It decides
 * what the `zeta` console password is when NO password is typed at the installer prompt: `default` (the
 * repo default, the owner's decision: the PUBLIC `zeta-change-me`) or `mint` (a random one-time password).
 * Anything else is refused before anything is written. Mirrors lb-pool-flags.test.ts.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseFileBackedZflashArgs } from "./file-backed.ts";
import { planFileBackedZflashImage } from "./lib.ts";
import { ZFLASH_ALLOWED_FLAGS } from "./allowed-flags.ts";
import {
  CONSOLE_PASSWORD_POLICY_ENV,
  planConsolePasswordPolicy,
  renderConsolePasswordPolicyConfLine,
} from "../installer/console-password-policy.ts";
import {
  consolePasswordDryRunLine,
  parseWindowsFlasherArgs,
  planWindowsEspWrites,
  VALUE_FLAGS,
} from "./flash-usb-windows.ts";

const BASE_ARGS = ["--iso", "/tmp/i.iso", "--output", "/tmp/o.img", "--esp-offset-bytes", "4096", "--host", "node-a"];

const base = {
  isoPath: "/tmp/installer.iso",
  outputImagePath: "/tmp/out.img",
  espOffsetBytes: 141_312,
  pubkeyPath: "/tmp/id.pub",
} as const;

describe("the policy parser (TypeScript oracle of the installer's shell twin)", () => {
  test("default and mint parse; omitted is null (the installer's own default applies)", () => {
    expect(planConsolePasswordPolicy("default")).toEqual({ ok: true, value: "default" });
    expect(planConsolePasswordPolicy("mint")).toEqual({ ok: true, value: "mint" });
    expect(planConsolePasswordPolicy(undefined)).toEqual({ ok: true, value: null });
  });

  for (const bad of ["", "DEFAULT", "Mint", "locked", "none", "zeta-change-me", "default ", "$(id)", "mint;rm -rf /"]) {
    test(`refused loudly: ${JSON.stringify(bad)}`, () => {
      const r = planConsolePasswordPolicy(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/neither "default" nor "mint"/);
    });
  }

  test("rendered as a sourceable single-quoted assignment", () => {
    expect(renderConsolePasswordPolicyConfLine("mint")).toBe("ZETA_CONSOLE_PASSWORD_POLICY='mint'\n");
    expect(renderConsolePasswordPolicyConfLine("default")).toBe("ZETA_CONSOLE_PASSWORD_POLICY='default'\n");
    expect(CONSOLE_PASSWORD_POLICY_ENV).toBe("ZETA_CONSOLE_PASSWORD_POLICY");
  });
});

describe("file-backed zflash: --console-password", () => {
  test("default and mint parse into the options", () => {
    for (const v of ["default", "mint"] as const) {
      const parsed = parseFileBackedZflashArgs([...BASE_ARGS, "--console-password", v]);
      expect(parsed.kind).toBe("run");
      if (parsed.kind !== "run") return;
      expect(parsed.options.consolePasswordPolicy).toBe(v);
    }
  });

  test("omitted -> no option (and no conf line: the installer's repo default decides)", () => {
    const parsed = parseFileBackedZflashArgs(BASE_ARGS);
    if (parsed.kind !== "run") throw new Error("must parse");
    expect(parsed.options.consolePasswordPolicy).toBeUndefined();
  });

  for (const bad of ["locked", "DEFAULT", "none", "$(id)"]) {
    test(`refused: ${JSON.stringify(bad)}`, () => {
      const parsed = parseFileBackedZflashArgs([...BASE_ARGS, "--console-password", bad]);
      expect(parsed.kind).toBe("error");
      if (parsed.kind === "error") expect(parsed.error).toMatch(/neither "default" nor "mint"/);
    });
  }

  test("a flag with no value is refused, not read as the next flag", () => {
    expect(parseFileBackedZflashArgs([...BASE_ARGS, "--console-password"]).kind).toBe("error");
  });

  test("the value reaches the planner's ESP conf (parse -> options -> plan), and runFileBackedZflashCli forwards it", () => {
    const parsed = parseFileBackedZflashArgs([...BASE_ARGS, "--console-password", "mint"]);
    if (parsed.kind !== "run") throw new Error("must parse");
    const planned = planFileBackedZflashImage({ ...base, consolePasswordPolicy: parsed.options.consolePasswordPolicy! });
    if (!planned.ok) throw new Error(planned.error);
    const conf = planned.value.espWrites.find((w) => w.destination === "/zeta-firstboot.conf");
    expect(conf?.content).toBe("ZETA_CONSOLE_PASSWORD_POLICY='mint'\n");
    const src = readFileSync(resolve(import.meta.dir, "file-backed.ts"), "utf8");
    expect(src).toContain("...(options.consolePasswordPolicy === undefined ? {} : { consolePasswordPolicy: options.consolePasswordPolicy }),");
  });

  test("the value lands in /zeta-firstboot.conf as a sourceable assignment", () => {
    const planned = planFileBackedZflashImage({ ...base, consolePasswordPolicy: "default" });
    if (!planned.ok) throw new Error(planned.error);
    const conf = planned.value.espWrites.find((w) => w.destination === "/zeta-firstboot.conf");
    expect(conf?.content).toBe("ZETA_CONSOLE_PASSWORD_POLICY='default'\n");
    const dir = mkdtempSync(join(tmpdir(), "zeta-cp-conf-"));
    const confPath = join(dir, "zeta-firstboot.conf").replaceAll("\\", "/");
    const runner = join(dir, "runner.sh");
    writeFileSync(confPath, conf?.content ?? "", "utf8");
    writeFileSync(runner, `. ${confPath}\nprintf '%s' "$ZETA_CONSOLE_PASSWORD_POLICY"\n`, "utf8");
    const r = spawnSync("bash", [runner.replaceAll("\\", "/")], { encoding: "utf8" });
    expect(r.stdout).toBe("default");
  });

  test("appends to the role conf, the public-TLS pair and the LB range rather than writing a second conf, and the WP27 override stays last", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      firstbootRole: { kind: "first-control-plane" },
      publicEndpoint: { acmeEmail: "ops@zeta-cluster-fixture.net", publicDomain: "zeta-cluster-fixture.net" },
      lbPool: { kind: "auto" },
      consolePasswordPolicy: "mint",
      allowLonghornUndersized: true,
    } as Parameters<typeof planFileBackedZflashImage>[0]);
    if (!planned.ok) throw new Error(planned.error);
    const confs = planned.value.espWrites.filter((w) => w.destination === "/zeta-firstboot.conf");
    expect(confs).toHaveLength(1);
    expect(confs[0]?.content).toContain("ZETA_ROLE='first-control-plane'");
    expect(confs[0]?.content).toContain("ZETA_LB_POOL='auto'");
    expect(confs[0]?.content).toContain("ZETA_CONSOLE_PASSWORD_POLICY='mint'");
    expect(confs[0]?.content?.trimEnd().split("\n").at(-1)).toBe("ZETA_ALLOW_LONGHORN_UNDERSIZED='1'");
  });

  test("the planner re-validates (defence in depth): a junk policy handed in directly is refused", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      consolePasswordPolicy: "locked" as unknown as "mint",
    });
    expect(planned.ok).toBe(false);
    if (!planned.ok) expect(planned.error).toMatch(/neither "default" nor "mint"/);
  });

  test("omitting it leaves the plan byte-identical (no conf is invented)", () => {
    const without = planFileBackedZflashImage({ ...base });
    if (!without.ok) throw new Error(without.error);
    expect(without.value.espWrites.some((w) => w.destination === "/zeta-firstboot.conf")).toBe(false);
  });
});

describe("device zflash (macOS / Linux): the same flag, the same validator", () => {
  const cli = readFileSync(resolve(import.meta.dir, "cli.ts"), "utf8");

  test("--console-password is on the strict allowlist", () => {
    expect(ZFLASH_ALLOWED_FLAGS.has("--console-password")).toBe(true);
  });

  test("cli.ts validates through planConsolePasswordPolicy before any device is touched", () => {
    const validate = cli.indexOf("planConsolePasswordPolicy(consolePasswordFlag)");
    expect(validate).toBeGreaterThan(0);
    expect(validate).toBeLessThan(cli.indexOf("const flashUsb = findFlashUsbPath()"));
  });

  test("the value reaches the ESP on macOS (injector) and on Linux (the mcopy bake), and a dropped policy is refused", () => {
    expect(cli).toContain("renderConsolePasswordPolicyConfLine(consolePasswordPolicy)");
    expect(cli).toContain("bakeEspPayloadForLinux(isoPath, pubkeyPath, hostOverride, testMode, consolePassword.value, storageProfile.value)");
    expect(cli).toContain("...(consolePasswordPolicy === null ? {} : { consolePasswordPolicy })");
    expect(cli).toContain("--console-password needs the ESP payload, but injection was skipped");
    expect(cli).toContain("--console-password requires ESP injection; remove --no-inject");
  });

  test("--help names the flag and its default honestly", () => {
    expect(cli).toContain("--console-password <default|mint>");
    expect(cli).toContain("the PUBLIC zeta-change-me");
  });
});

describe("Windows flasher: the same flag, the same shared planner", () => {
  test("--console-password is a value flag, so the strict unknown-flag refusal admits it", () => {
    expect(VALUE_FLAGS).toContain("--console-password");
    const p = parseWindowsFlasherArgs(["--console-password", "mint"]);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.value.consolePassword).toBe("mint");
    expect(parseWindowsFlasherArgs(["--console-password"]).ok).toBe(false);
    expect(parseWindowsFlasherArgs(["--console-password", "mint", "--console-password", "default"]).ok).toBe(false);
  });

  test("the value lands in /zeta-firstboot.conf, byte-for-byte what the shared planner bakes for the same flag", () => {
    const p = parseWindowsFlasherArgs(["--console-password", "default"]);
    if (!p.ok) throw new Error(p.message);
    const mine = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
    if (!mine.ok) throw new Error(mine.message);
    const shared = planFileBackedZflashImage({
      isoPath: "a.iso",
      outputImagePath: "a.img",
      espOffsetBytes: 141_312,
      consolePasswordPolicy: "default",
    });
    if (!shared.ok) throw new Error(shared.error);
    expect(mine.value).toEqual(shared.value.espWrites);
    expect(mine.value.find((w) => w.destination === "/zeta-firstboot.conf")?.content).toBe("ZETA_CONSOLE_PASSWORD_POLICY='default'\n");
  });

  test("--console-password alone is NOT 'nothing asked': a flash that asked only for a policy still writes the conf", () => {
    const p = parseWindowsFlasherArgs(["--no-inject", "--console-password", "mint"]);
    if (!p.ok) throw new Error(p.message);
    const r = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
    expect(r.ok && r.value.map((w) => w.destination)).toEqual(["/zeta-firstboot.conf"]);
  });

  test("junk is refused before any device work", () => {
    for (const bad of ["locked", "DEFAULT", "none", "$(id)"]) {
      const p = parseWindowsFlasherArgs(["--console-password", bad]);
      if (!p.ok) throw new Error(p.message);
      const r = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toContain("console password policy refused");
    }
  });

  test("--dry-run names the policy even when the flag was omitted (the default is the PUBLIC password)", () => {
    expect(consolePasswordDryRunLine(undefined)).toMatch(/flag omitted.*PUBLIC zeta-change-me.*--console-password mint/);
    expect(consolePasswordDryRunLine("default")).toMatch(/PUBLIC zeta-change-me/);
    expect(consolePasswordDryRunLine("mint")).toMatch(/^mint/);
    const src = readFileSync(resolve(import.meta.dir, "flash-usb-windows.ts"), "utf8");
    expect(src).toContain("consolePasswordDryRunLine(args.consolePassword)");
  });
});
