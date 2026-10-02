/**
 * storage-profile-flags.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 29.
 *
 * zflash `--storage-profile <auto|name>` bakes the storage profile into the ESP `/zeta-firstboot.conf`
 * (the installer's `ZETA_STORAGE_PROFILE`), and is REFUSED - before anything is written - when the name is
 * not a rung of the ladder, which is wrong on every machine. What only the pool decides (does it fit?) is
 * decided by the installer, which refuses before the wipe (storage-profile-shell-parity.test.ts).
 * Mirrors lb-pool-flags.test.ts: same three surfaces (file-backed, device CLI, Windows), same shared planner.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseFileBackedZflashArgs } from "./file-backed.ts";
import { planFileBackedZflashImage } from "./lib.ts";
import { ZFLASH_ALLOWED_FLAGS } from "./allowed-flags.ts";
import { planStorageProfile, STORAGE_PROFILE_LADDER } from "../installer/storage-profile-selection.ts";
import { describeStorageProfile, parseWindowsFlasherArgs, planWindowsEspWrites, VALUE_FLAGS } from "./flash-usb-windows.ts";

const BASE_ARGS = ["--iso", "/tmp/i.iso", "--output", "/tmp/o.img", "--esp-offset-bytes", "4096", "--host", "node-a"];

const base = {
  isoPath: "/tmp/installer.iso",
  outputImagePath: "/tmp/out.img",
  espOffsetBytes: 141_312,
  pubkeyPath: "/tmp/id.pub",
} as const;

describe("file-backed zflash: --storage-profile", () => {
  test("every rung and `auto` parse into the validated spec", () => {
    for (const value of ["auto", ...STORAGE_PROFILE_LADDER.map((r) => r.name)]) {
      const parsed = parseFileBackedZflashArgs([...BASE_ARGS, "--storage-profile", value]);
      expect(parsed.kind).toBe("run");
      if (parsed.kind === "run") expect(parsed.options.storageProfile).toBe(value);
    }
  });

  test("omitted -> no spec at all (the default is `auto`, and nothing is written to say so)", () => {
    const parsed = parseFileBackedZflashArgs(BASE_ARGS);
    if (parsed.kind !== "run") throw new Error("must parse");
    expect(parsed.options.storageProfile).toBeUndefined();
  });

  const REFUSALS: ReadonlyArray<readonly [string, string]> = [
    ["a name that is not a profile", "huge"],
    ["the hosted runner's profile, which is not a node's", "ci"],
    ["wrong case", "Standard"],
    ["shell metacharacters", "$(id)"],
    ["a quote that would break the single-quoted assignment", "standard'; rm -rf /; '"],
    ["empty", ""],
  ];
  for (const [name, value] of REFUSALS) {
    test(`refused: ${name}`, () => {
      const parsed = parseFileBackedZflashArgs([...BASE_ARGS, "--storage-profile", value]);
      expect(parsed.kind).toBe("error");
      if (parsed.kind === "error") expect(parsed.error).toContain("minimal, standard, measured, large");
    });
  }

  test("the value lands in /zeta-firstboot.conf as a sourceable assignment", () => {
    const planned = planFileBackedZflashImage({ ...base, storageProfile: "standard" });
    if (!planned.ok) throw new Error(planned.error);
    const conf = planned.value.espWrites.find((w) => w.destination === "/zeta-firstboot.conf");
    expect(conf?.content).toBe("ZETA_STORAGE_PROFILE='standard'\n");
    const dir = mkdtempSync(join(tmpdir(), "zeta-sp-conf-"));
    const confPath = join(dir, "zeta-firstboot.conf").replaceAll("\\", "/");
    const runner = join(dir, "runner.sh");
    writeFileSync(confPath, conf?.content ?? "", "utf8");
    writeFileSync(runner, `. ${confPath}\nprintf '%s' "$ZETA_STORAGE_PROFILE"\n`, "utf8");
    expect(spawnSync("bash", [runner.replaceAll("\\", "/")], { encoding: "utf8" }).stdout).toBe("standard");
  });

  test("`auto` is written as the literal word when the operator typed it", () => {
    const planned = planFileBackedZflashImage({ ...base, storageProfile: "auto" });
    if (!planned.ok) throw new Error(planned.error);
    expect(planned.value.espWrites.find((w) => w.destination === "/zeta-firstboot.conf")?.content).toBe("ZETA_STORAGE_PROFILE='auto'\n");
  });

  test("appends to the role conf, the public-TLS pair and the LB range rather than writing a second conf", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      firstbootRole: { kind: "first-control-plane" },
      publicEndpoint: { acmeEmail: "ops@zeta-cluster-fixture.net", publicDomain: "zeta-cluster-fixture.net" },
      lbPool: { kind: "auto" },
      storageProfile: "large",
    } as Parameters<typeof planFileBackedZflashImage>[0]);
    if (!planned.ok) throw new Error(planned.error);
    const confs = planned.value.espWrites.filter((w) => w.destination === "/zeta-firstboot.conf");
    expect(confs).toHaveLength(1);
    expect(confs[0]?.content).toContain("ZETA_ROLE='first-control-plane'");
    expect(confs[0]?.content).toContain("ZETA_PUBLIC_DOMAIN='zeta-cluster-fixture.net'");
    expect(confs[0]?.content).toContain("ZETA_LB_POOL='auto'");
    expect(confs[0]?.content).toContain("ZETA_STORAGE_PROFILE='large'");
  });

  test("the planner re-validates (defence in depth): a bad name handed in directly is refused", () => {
    expect(planFileBackedZflashImage({ ...base, storageProfile: "huge" }).ok).toBe(false);
    expect(planFileBackedZflashImage({ ...base, storageProfile: "ci" }).ok).toBe(false);
  });

  test("omitting it leaves the plan byte-identical", () => {
    const without = planFileBackedZflashImage({ ...base });
    if (!without.ok) throw new Error(without.error);
    expect(without.value.espWrites.some((w) => w.destination === "/zeta-firstboot.conf")).toBe(false);
  });
});

describe("device zflash: the same flag, the same validator", () => {
  const cli = readFileSync(resolve(import.meta.dir, "cli.ts"), "utf8");

  test("--storage-profile is on the strict allowlist", () => {
    expect(ZFLASH_ALLOWED_FLAGS.has("--storage-profile")).toBe(true);
  });

  test("cli.ts validates through planStorageProfile before any device is touched", () => {
    const validate = cli.indexOf("planStorageProfile(storageProfileFlag)");
    expect(validate).toBeGreaterThan(0);
    expect(validate).toBeLessThan(cli.indexOf("const flashUsb = findFlashUsbPath()"));
    expect(planStorageProfile("ci").ok).toBe(false);
  });

  test("the value reaches the ESP: cli.ts hands it to the injector alongside the others and renders one conf line", () => {
    expect(cli).toContain("lbPool.value, consolePassword.value, storageProfile.value)");
    expect(cli).toContain("renderStorageProfileConfLine(storageProfile)");
  });

  test("on LINUX it reaches the ESP through the mcopy bake too, and a dropped profile is refused (both console-password and this flag survive the merge)", () => {
    expect(cli).toContain("hostOverride, testMode, consolePassword.value, storageProfile.value)");
    expect(cli).toContain("...(storageProfile === null ? {} : { storageProfile })");
    expect(cli).toContain("--storage-profile needs the ESP payload, but injection was skipped");
    expect(cli).toContain("--storage-profile requires ESP injection; remove --no-inject");
    // The other feature that shares this plumbing is still wired: dropping either would be a silent regression.
    expect(cli).toContain("--console-password requires ESP injection; remove --no-inject");
    expect(cli).toContain("renderConsolePasswordPolicyConfLine(consolePasswordPolicy)");
  });

  test("both flags land in ONE /zeta-firstboot.conf, with the Longhorn override still the last line", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      consolePasswordPolicy: "mint",
      storageProfile: "standard",
      allowLonghornUndersized: true,
    });
    if (!planned.ok) throw new Error(planned.error);
    const confs = planned.value.espWrites.filter((w) => w.destination === "/zeta-firstboot.conf");
    expect(confs).toHaveLength(1);
    expect(confs[0]?.content).toContain("ZETA_CONSOLE_PASSWORD_POLICY='mint'");
    expect(confs[0]?.content).toContain("ZETA_STORAGE_PROFILE='standard'");
    expect(confs[0]?.content?.trimEnd().split("\n").at(-1)).toBe("ZETA_ALLOW_LONGHORN_UNDERSIZED='1'");
  });

  test("it is in --help", () => {
    expect(cli).toContain("--storage-profile <auto|name>");
  });
});

describe("Windows flasher (the operator's own platform): the same flag, the same shared planner", () => {
  const ARGV = ["--storage-profile", "standard"];

  test("--storage-profile is a value flag, so the strict unknown-flag refusal admits it", () => {
    expect(VALUE_FLAGS).toContain("--storage-profile");
    const p = parseWindowsFlasherArgs(ARGV);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.value.storageProfile).toBe("standard");
    expect(parseWindowsFlasherArgs(["--storage-profile"]).ok).toBe(false);
    expect(parseWindowsFlasherArgs([...ARGV, "--storage-profile", "large"]).ok).toBe(false);
  });

  test("the value lands in /zeta-firstboot.conf, byte-for-byte what the shared planner bakes for the same flag", () => {
    const p = parseWindowsFlasherArgs(ARGV);
    if (!p.ok) throw new Error(p.message);
    const mine = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
    if (!mine.ok) throw new Error(mine.message);
    const shared = planFileBackedZflashImage({ isoPath: "a.iso", outputImagePath: "a.img", espOffsetBytes: 141_312, storageProfile: "standard" });
    if (!shared.ok) throw new Error(shared.error);
    expect(mine.value).toEqual(shared.value.espWrites);
    expect(mine.value.find((w) => w.destination === "/zeta-firstboot.conf")?.content).toBe("ZETA_STORAGE_PROFILE='standard'\n");
  });

  test("--storage-profile alone is NOT 'nothing asked': a flash that asked only for a profile still writes the conf", () => {
    const p = parseWindowsFlasherArgs(["--no-inject", ...ARGV]);
    if (!p.ok) throw new Error(p.message);
    const r = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
    expect(r.ok && r.value.map((w) => w.destination)).toEqual(["/zeta-firstboot.conf"]);
  });

  test("a name that is not a profile is refused before any device work", () => {
    for (const bad of ["huge", "ci", "Standard", "x'; evil"]) {
      const p = parseWindowsFlasherArgs(["--storage-profile", bad]);
      if (!p.ok) throw new Error(p.message);
      const r = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toContain("storage profile refused");
    }
  });

  test("--dry-run says what the node will see: the forced profile, `auto`, or nothing set", () => {
    const planFor = (argv: readonly string[]) => {
      const p = parseWindowsFlasherArgs(argv);
      if (!p.ok) throw new Error(p.message);
      const r = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
      if (!r.ok) throw new Error(r.message);
      return r.value;
    };
    expect(describeStorageProfile(planFor(["--no-inject", "--storage-profile", "large"]))).toContain("ZETA_STORAGE_PROFILE='large'");
    expect(describeStorageProfile(planFor(["--no-inject", "--storage-profile", "large"]))).toContain("FORCED");
    expect(describeStorageProfile(planFor(["--no-inject", "--storage-profile", "auto"]))).toContain("'auto'");
    const unset = describeStorageProfile(planFor(["--no-inject", "--host", "node-a"]));
    expect(unset).toContain("not set on the ESP");
    expect(unset).toContain("`auto`");
  });

  test("it is in --help and in the dry-run block", () => {
    const src = readFileSync(resolve(import.meta.dir, "flash-usb-windows.ts"), "utf8");
    expect(src).toContain("--storage-profile <auto|name>");
    expect(src).toContain("describeStorageProfile(planned.value)");
  });
});
