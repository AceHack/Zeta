/**
 * lb-pool-flags.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 3.
 *
 * zflash `--lb-pool` bakes the Cilium LoadBalancer range into the ESP
 * `/zeta-firstboot.conf` (resolution step 1 of the installer), and is REFUSED - before
 * anything is written - when it is wrong on every LAN. What only the LAN decides (is it on
 * the node's subnet, is it free) is decided by the installer, which refuses before the
 * wipe (lan-config-shell-parity.test.ts). Mirrors public-endpoint-flags.test.ts.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseFileBackedZflashArgs } from "./file-backed.ts";
import { planFileBackedZflashImage } from "./lib.ts";
import { ZFLASH_ALLOWED_FLAGS } from "./allowed-flags.ts";
import { planLbPool } from "../installer/lan-config.ts";
import { parseWindowsFlasherArgs, planWindowsEspWrites, VALUE_FLAGS } from "./flash-usb-windows.ts";

const BASE_ARGS = ["--iso", "/tmp/i.iso", "--output", "/tmp/o.img", "--esp-offset-bytes", "4096", "--host", "node-a"];
const RANGE = "192.168.50.200-192.168.50.210";

const base = {
  isoPath: "/tmp/installer.iso",
  outputImagePath: "/tmp/out.img",
  espOffsetBytes: 141_312,
  pubkeyPath: "/tmp/id.pub",
} as const;

describe("file-backed zflash: --lb-pool", () => {
  test("a range parses into one validated spec", () => {
    const parsed = parseFileBackedZflashArgs([...BASE_ARGS, "--lb-pool", RANGE]);
    expect(parsed.kind).toBe("run");
    if (parsed.kind !== "run") return;
    expect(parsed.options.lbPool).toEqual({ kind: "range", start: "192.168.50.200", stop: "192.168.50.210" });
  });

  test("`auto` parses", () => {
    const parsed = parseFileBackedZflashArgs([...BASE_ARGS, "--lb-pool", "auto"]);
    if (parsed.kind !== "run") throw new Error("must parse");
    expect(parsed.options.lbPool).toEqual({ kind: "auto" });
  });

  test("omitted -> no spec (UNSET is the default, not 192.168.1.240-250)", () => {
    const parsed = parseFileBackedZflashArgs(BASE_ARGS);
    if (parsed.kind !== "run") throw new Error("must parse");
    expect(parsed.options.lbPool).toBeUndefined();
  });

  const REFUSALS: ReadonlyArray<readonly [string, string, RegExp]> = [
    ["a single address", "192.168.1.240", /neither "auto"/],
    ["backwards", "192.168.1.250-192.168.1.240", /backwards/],
    ["a /16 pasted as a range", "10.0.0.0-10.0.255.255", /limit is 256/],
    ["loopback", "127.0.0.1-127.0.0.9", /not LAN addresses/],
    ["the inter-node segment", "10.88.0.10-10.88.0.20", /inter-node cluster segment/],
    ["shell metacharacters", "$(id)-1.1.1.1", /neither "auto"/],
    ["an octet out of range", "192.168.1.300-192.168.1.310", /not a dotted-quad/],
  ];
  for (const [name, value, why] of REFUSALS) {
    test(`refused: ${name}`, () => {
      const parsed = parseFileBackedZflashArgs([...BASE_ARGS, "--lb-pool", value]);
      expect(parsed.kind).toBe("error");
      if (parsed.kind === "error") expect(parsed.error).toMatch(why);
    });
  }

  test("the value lands in /zeta-firstboot.conf as a sourceable assignment", () => {
    const planned = planFileBackedZflashImage({ ...base, lbPool: { kind: "range", start: "192.168.50.200", stop: "192.168.50.210" } });
    if (!planned.ok) throw new Error(planned.error);
    const conf = planned.value.espWrites.find((w) => w.destination === "/zeta-firstboot.conf");
    expect(conf?.content).toBe(`ZETA_LB_POOL='${RANGE}'\n`);
    const dir = mkdtempSync(join(tmpdir(), "zeta-lb-conf-"));
    const confPath = join(dir, "zeta-firstboot.conf").replaceAll("\\", "/");
    const runner = join(dir, "runner.sh");
    writeFileSync(confPath, conf?.content ?? "", "utf8");
    writeFileSync(runner, `. ${confPath}\nprintf '%s' "$ZETA_LB_POOL"\n`, "utf8");
    const r = spawnSync("bash", [runner.replaceAll("\\", "/")], { encoding: "utf8" });
    expect(r.stdout).toBe(RANGE);
  });

  test("`auto` is written as the literal word", () => {
    const planned = planFileBackedZflashImage({ ...base, lbPool: { kind: "auto" } });
    if (!planned.ok) throw new Error(planned.error);
    expect(planned.value.espWrites.find((w) => w.destination === "/zeta-firstboot.conf")?.content).toBe("ZETA_LB_POOL='auto'\n");
  });

  test("appends to the role conf and the public-TLS pair rather than writing a second conf", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      firstbootRole: { kind: "first-control-plane" },
      publicEndpoint: { acmeEmail: "ops@zeta-cluster-fixture.net", publicDomain: "zeta-cluster-fixture.net" },
      lbPool: { kind: "range", start: "192.168.50.200", stop: "192.168.50.210" },
    } as Parameters<typeof planFileBackedZflashImage>[0]);
    if (!planned.ok) throw new Error(planned.error);
    const confs = planned.value.espWrites.filter((w) => w.destination === "/zeta-firstboot.conf");
    expect(confs).toHaveLength(1);
    expect(confs[0]?.content).toContain("ZETA_ROLE='first-control-plane'");
    expect(confs[0]?.content).toContain("ZETA_PUBLIC_DOMAIN='zeta-cluster-fixture.net'");
    expect(confs[0]?.content).toContain(`ZETA_LB_POOL='${RANGE}'`);
  });

  test("the planner re-validates (defence in depth): a loopback range handed in directly is refused", () => {
    const planned = planFileBackedZflashImage({ ...base, lbPool: { kind: "range", start: "127.0.0.1", stop: "127.0.0.9" } });
    expect(planned.ok).toBe(false);
  });

  test("omitting it leaves the plan byte-identical", () => {
    const without = planFileBackedZflashImage({ ...base });
    if (!without.ok) throw new Error(without.error);
    expect(without.value.espWrites.some((w) => w.destination === "/zeta-firstboot.conf")).toBe(false);
  });
});

describe("device zflash: the same flag, the same validator", () => {
  test("--lb-pool is on the strict allowlist", () => {
    expect(ZFLASH_ALLOWED_FLAGS.has("--lb-pool")).toBe(true);
  });

  test("cli.ts validates through planLbPool before any device is touched", () => {
    const cli = readFileSync(resolve(import.meta.dir, "cli.ts"), "utf8");
    const validate = cli.indexOf("planLbPool(lbPoolFlag)");
    expect(validate).toBeGreaterThan(0);
    expect(validate).toBeLessThan(cli.indexOf("const flashUsb = findFlashUsbPath()"));
    expect(planLbPool("127.0.0.1-127.0.0.9").ok).toBe(false);
  });

  test("the value reaches the ESP: cli.ts hands it to the injector alongside the public-TLS pair", () => {
    const cli = readFileSync(resolve(import.meta.dir, "cli.ts"), "utf8");
    expect(cli).toContain("firstbootRole.value, joinTokenPathFlag, publicEndpoint.value, lbPool.value)");
    expect(cli).toContain("renderLbPoolConfLine(lbPool)");
  });
});

describe("Windows flasher (the operator's own platform): the same flag, the same shared planner", () => {
  const ARGV = ["--lb-pool", RANGE];

  test("--lb-pool is a value flag, so the strict unknown-flag refusal admits it", () => {
    expect(VALUE_FLAGS).toContain("--lb-pool");
    const p = parseWindowsFlasherArgs(ARGV);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.value.lbPool).toBe(RANGE);
    expect(parseWindowsFlasherArgs(["--lb-pool"]).ok).toBe(false);
    expect(parseWindowsFlasherArgs([...ARGV, "--lb-pool", "auto"]).ok).toBe(false);
  });

  test("the value lands in /zeta-firstboot.conf, byte-for-byte what the shared planner bakes for the same flag", () => {
    const p = parseWindowsFlasherArgs(ARGV);
    if (!p.ok) throw new Error(p.message);
    const mine = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
    if (!mine.ok) throw new Error(mine.message);
    const shared = planFileBackedZflashImage({
      isoPath: "a.iso",
      outputImagePath: "a.img",
      espOffsetBytes: 141_312,
      lbPool: { kind: "range", start: "192.168.50.200", stop: "192.168.50.210" },
    });
    if (!shared.ok) throw new Error(shared.error);
    expect(mine.value).toEqual(shared.value.espWrites);
    expect(mine.value.find((w) => w.destination === "/zeta-firstboot.conf")?.content).toBe(`ZETA_LB_POOL='${RANGE}'` + "\n");
  });

  test("--lb-pool alone is NOT 'nothing asked': a flash that asked only for a range still writes the conf", () => {
    const p = parseWindowsFlasherArgs(["--no-inject", ...ARGV]);
    if (!p.ok) throw new Error(p.message);
    const r = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
    expect(r.ok && r.value.map((w) => w.destination)).toEqual(["/zeta-firstboot.conf"]);
  });

  test("a range that is wrong on every LAN is refused before any device work", () => {
    for (const bad of ["127.0.0.1-127.0.0.9", "192.168.1.250-192.168.1.240", "10.88.0.10-10.88.0.20", "nonsense"]) {
      const p = parseWindowsFlasherArgs(["--lb-pool", bad]);
      if (!p.ok) throw new Error(p.message);
      const r = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toContain("LoadBalancer range refused");
    }
  });

  test("`auto` is accepted and written as the literal word", () => {
    const p = parseWindowsFlasherArgs(["--lb-pool", "auto"]);
    if (!p.ok) throw new Error(p.message);
    const r = planWindowsEspWrites(p.value, undefined, "a.iso", 141_312, "a.img");
    expect(r.ok && r.value.find((w) => w.destination === "/zeta-firstboot.conf")?.content).toBe("ZETA_LB_POOL='auto'" + "\n");
  });
});
