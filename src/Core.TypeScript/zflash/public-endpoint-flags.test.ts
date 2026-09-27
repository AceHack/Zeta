/**
 * public-endpoint-flags.test.ts — 081M3JG74G0087G0R001XJC837, part (d).
 *
 * zflash `--acme-email` / `--public-domain` bake the two public-TLS settings into
 * the ESP `/zeta-firstboot.conf` (resolution step 1 of the installer), and are
 * REFUSED — before anything is written — when invalid, reserved, or half a pair.
 * Mirrors how `--role` and the WP27 override are planned and tested.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseFileBackedZflashArgs } from "./file-backed.ts";
import { planFileBackedZflashImage } from "./lib.ts";
import { ZFLASH_ALLOWED_FLAGS } from "./allowed-flags.ts";
import { planPublicEndpoint } from "../installer/public-endpoint.ts";

const BASE_ARGS = ["--iso", "/tmp/i.iso", "--output", "/tmp/o.img", "--esp-offset-bytes", "4096", "--host", "node-a"];
const EMAIL = "ops@zeta-cluster-fixture.net";
const DOMAIN = "zeta-cluster-fixture.net";

const base = {
  isoPath: "/tmp/installer.iso",
  outputImagePath: "/tmp/out.img",
  espOffsetBytes: 141_312,
  pubkeyPath: "/tmp/id.pub",
} as const;

describe("(d) file-backed zflash: --acme-email / --public-domain", () => {
  test("both flags parse into one validated pair", () => {
    const parsed = parseFileBackedZflashArgs([...BASE_ARGS, "--acme-email", EMAIL, "--public-domain", "Zeta-Cluster-Fixture.NET"]);
    expect(parsed.kind).toBe("run");
    if (parsed.kind !== "run") return;
    expect(parsed.options.publicEndpoint).toEqual({ acmeEmail: EMAIL, publicDomain: DOMAIN });
  });

  test("neither flag -> no pair (UNSET is the default, not example.com)", () => {
    const parsed = parseFileBackedZflashArgs(BASE_ARGS);
    if (parsed.kind !== "run") throw new Error("must parse");
    expect(parsed.options.publicEndpoint).toBeUndefined();
  });

  const REFUSALS: ReadonlyArray<readonly [string, readonly string[], RegExp]> = [
    ["half a pair (email only)", ["--acme-email", EMAIL], /go together/],
    ["half a pair (domain only)", ["--public-domain", DOMAIN], /go together/],
    ["the live failure: you@example.com", ["--acme-email", "you@example.com", "--public-domain", DOMAIN], /reserved/],
    ["a reserved domain", ["--acme-email", EMAIL, "--public-domain", "example.org"], /reserved/],
    [".test TLD", ["--acme-email", EMAIL, "--public-domain", "cluster.test"], /reserved/],
    ["not an email", ["--acme-email", "ops", "--public-domain", DOMAIN], /not an address/],
    ["not a domain", ["--acme-email", EMAIL, "--public-domain", "https://x.net"], /not a DNS name/],
    ["shell metacharacters", ["--acme-email", "$(id)@x.net", "--public-domain", DOMAIN], /not an address/],
  ];
  for (const [name, flags, why] of REFUSALS) {
    test(`refused: ${name}`, () => {
      const parsed = parseFileBackedZflashArgs([...BASE_ARGS, ...flags]);
      expect(parsed.kind).toBe("error");
      if (parsed.kind === "error") expect(parsed.error).toMatch(why);
    });
  }

  test("the pair lands in /zeta-firstboot.conf as sourceable assignments", () => {
    const planned = planFileBackedZflashImage({ ...base, publicEndpoint: { acmeEmail: EMAIL, publicDomain: DOMAIN } });
    if (!planned.ok) throw new Error(planned.error);
    const conf = planned.value.espWrites.find((w) => w.destination === "/zeta-firstboot.conf");
    expect(conf?.content).toBe(`ZETA_ACME_EMAIL='${EMAIL}'\nZETA_PUBLIC_DOMAIN='${DOMAIN}'\n`);
    // actually sourceable by bash, and yields exactly the values
    const dir = mkdtempSync(join(tmpdir(), "zeta-pe-conf-"));
    const confPath = join(dir, "zeta-firstboot.conf").replaceAll("\\", "/");
    const runner = join(dir, "runner.sh");
    writeFileSync(confPath, conf?.content ?? "", "utf8");
    writeFileSync(runner, `. ${confPath}\nprintf '%s|%s' "$ZETA_ACME_EMAIL" "$ZETA_PUBLIC_DOMAIN"\n`, "utf8");
    const r = spawnSync("bash", [runner.replaceAll("\\", "/")], { encoding: "utf8" });
    expect(r.stdout).toBe(`${EMAIL}|${DOMAIN}`);
  });

  test("appends to the role conf rather than writing a second conf", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      firstbootRole: { kind: "first-control-plane" },
      publicEndpoint: { acmeEmail: EMAIL, publicDomain: DOMAIN },
    } as Parameters<typeof planFileBackedZflashImage>[0]);
    if (!planned.ok) throw new Error(planned.error);
    const confs = planned.value.espWrites.filter((w) => w.destination === "/zeta-firstboot.conf");
    expect(confs).toHaveLength(1);
    expect(confs[0]?.content).toContain("ZETA_ROLE='first-control-plane'");
    expect(confs[0]?.content).toContain(`ZETA_PUBLIC_DOMAIN='${DOMAIN}'`);
  });

  test("the planner re-validates (defence in depth): a reserved pair handed in directly is refused", () => {
    const planned = planFileBackedZflashImage({
      ...base,
      publicEndpoint: { acmeEmail: "you@example.com", publicDomain: "example.com" },
    });
    expect(planned.ok).toBe(false);
  });

  test("omitting it leaves the plan byte-identical", () => {
    const without = planFileBackedZflashImage({ ...base });
    if (!without.ok) throw new Error(without.error);
    expect(without.value.espWrites.some((w) => w.destination === "/zeta-firstboot.conf")).toBe(false);
  });
});

describe("(d) device zflash: the same flags, the same validator", () => {
  test("both flags are on the strict allowlist", () => {
    expect(ZFLASH_ALLOWED_FLAGS.has("--acme-email")).toBe(true);
    expect(ZFLASH_ALLOWED_FLAGS.has("--public-domain")).toBe(true);
  });

  test("cli.ts validates through planPublicEndpoint before any device is touched", () => {
    const cli = readFileSync(resolve(import.meta.dir, "cli.ts"), "utf8");
    const validate = cli.indexOf("planPublicEndpoint(");
    expect(validate).toBeGreaterThan(0);
    // refused before the ISO is even located, let alone flashed
    expect(validate).toBeLessThan(cli.indexOf("const flashUsb = findFlashUsbPath()"));
    expect(planPublicEndpoint({ acmeEmail: "you@example.com", publicDomain: DOMAIN }).ok).toBe(false);
  });
});
