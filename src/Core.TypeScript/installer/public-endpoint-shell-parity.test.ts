/**
 * public-endpoint-shell-parity.test.ts — 081M3JG74G0087G0R001XJC837, part (c).
 *
 * Extracts the ZETA-PUBLIC-TLS block from the real zeta-install.sh and runs it
 * under bash, the same harness as repo-pin-shell-parity.test.ts:
 *
 *   1. the shell validators agree with public-endpoint.ts over every input class,
 *      including the RFC 2606 names the live failure was made of;
 *   2. resolution order is ESP -> prompt -> UNSET, with Enter / EOF / a non-TTY
 *      meaning UNSET and never a default.
 *
 * Untrusted values reach bash through the ENVIRONMENT, never interpolated into
 * script text (see repo-pin-shell-parity.test.ts for the `$(rm -rf /)` history).
 *
 * What this cannot prove: the imperative call site (where in the install the
 * resolver runs, the /mnt/etc/zeta writes, the symlinks for flake eval). The
 * last test pins the ORDER of those in the script text; the QEMU lanes exercise
 * them for the UNSET case only, because they supply no values.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  validateAcmeEmail,
  validatePublicDomain,
  type DomainValidation,
  type EmailValidation,
} from "./public-endpoint.ts";

const INSTALL_SH = resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const FIRST_BOOT_SH = resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh");
const SRC = readFileSync(INSTALL_SH, "utf8");
const BEGIN = "# ZETA-PUBLIC-TLS-BEGIN";
const END = "# ZETA-PUBLIC-TLS-END";

function extractBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0 || e < 0 || e < b) throw new Error("ZETA-PUBLIC-TLS markers missing/out of order in zeta-install.sh");
  return SRC.slice(b, e + END.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-public-tls-"));
const blockPath = join(workdir, "block.sh").replaceAll("\\", "/");
writeFileSync(blockPath, extractBlock() + "\n", "utf8");

function runBash(script: string, env: Record<string, string>, stdin = ""): string {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, `set -uo pipefail\nsource ${blockPath}\n${script}\n`, "utf8");
  const r = spawnSync("bash", [runner.replaceAll("\\", "/")], {
    encoding: "utf8",
    input: stdin,
    env: { ...process.env, ZETA_ACME_EMAIL: "", ZETA_PUBLIC_DOMAIN: "", ...env },
  });
  if (r.status !== 0) throw new Error(`bash exited ${String(r.status)}: ${String(r.stderr)}`);
  return String(r.stdout).trim();
}

const shellDomain = (raw: string) => runBash('zeta_public_domain_validate "$T_RAW"', { T_RAW: raw });
const shellEmail = (raw: string) => runBash('zeta_acme_email_validate "$T_RAW"', { T_RAW: raw });

const DOMAIN_CASES: ReadonlyArray<readonly [string, DomainValidation]> = [
  ["", "empty"],
  ["zeta-cluster-fixture.net", "valid"],
  ["Sub.Zeta-Cluster-Fixture.NET", "valid"],
  ["xn--bcher-kva.ch", "valid"],
  ["example.com", "reserved"],
  ["zeta.example.com", "reserved"],
  ["EXAMPLE.ORG", "reserved"],
  ["example.net", "reserved"],
  ["cluster.test", "reserved"],
  ["cluster.example", "reserved"],
  ["cluster.invalid", "reserved"],
  ["cluster.localhost", "reserved"],
  ["node-5b2dfa.local", "reserved"],
  ["notexample.com", "valid"],
  ["localhost", "invalid-format"],
  ["singlelabel", "invalid-format"],
  ["192.168.1.10", "invalid-format"],
  ["-bad.net", "invalid-format"],
  ["bad-.net", "invalid-format"],
  ["a..b.net", "invalid-format"],
  ["trailing.dot.net.", "invalid-format"],
  ["has space.net", "invalid-format"],
  ["$(rm -rf /).net", "invalid-format"],
  ["https://zeta-cluster-fixture.net", "invalid-format"],
  [`${"a".repeat(64)}.net`, "invalid-format"],
  [`${Array.from({ length: 62 }, () => "abc").join(".")}.net`, "invalid-format"],
];

const EMAIL_CASES: ReadonlyArray<readonly [string, EmailValidation]> = [
  ["", "empty"],
  ["ops@zeta-cluster-fixture.net", "valid"],
  ["first.last+acme@sub.zeta-cluster-fixture.net", "valid"],
  ["you@example.com", "reserved-domain"],
  ["a@cluster.test", "reserved-domain"],
  ["no-at-sign.net", "invalid-format"],
  ["@zeta-cluster-fixture.net", "invalid-format"],
  ["a@b@zeta-cluster-fixture.net", "invalid-format"],
  ["o'brien@zeta-cluster-fixture.net", "invalid-format"],
  ["a b@zeta-cluster-fixture.net", "invalid-format"],
  ["$(id)@zeta-cluster-fixture.net", "invalid-format"],
  ["`id`@zeta-cluster-fixture.net", "invalid-format"],
  ["ops@localhost", "invalid-format"],
];

describe("(c) validators: shell == TypeScript", () => {
  for (const [raw, expected] of DOMAIN_CASES) {
    test(`domain ${JSON.stringify(raw)} -> ${expected}`, () => {
      expect(validatePublicDomain(raw)).toBe(expected);
      expect(shellDomain(raw)).toBe(expected);
    });
  }
  for (const [raw, expected] of EMAIL_CASES) {
    test(`email ${JSON.stringify(raw)} -> ${expected}`, () => {
      expect(validateAcmeEmail(raw)).toBe(expected);
      expect(shellEmail(raw)).toBe(expected);
    });
  }
});

const RESOLVE = 'zeta_public_tls_resolve "$T_MODE"; echo "RESULT=${ZETA_PUBLIC_TLS_SOURCE}|${ZETA_PUBLIC_TLS_EMAIL}|${ZETA_PUBLIC_TLS_DOMAIN}"';
function resolveWith(mode: string, env: Record<string, string>, stdin = ""): string {
  const out = runBash(RESOLVE, { T_MODE: mode, ...env }, stdin);
  const line = out.split("\n").find((l) => l.startsWith("RESULT="));
  if (line === undefined) throw new Error(`no RESULT line in: ${out}`);
  return line.slice("RESULT=".length);
}

const ESP = { ZETA_ACME_EMAIL: "ops@zeta-cluster-fixture.net", ZETA_PUBLIC_DOMAIN: "Zeta-Cluster-Fixture.net" };

describe("(c) resolution order: ESP -> prompt -> UNSET", () => {
  test("1. valid ESP values win and nothing is asked (stdin is not read)", () => {
    expect(resolveWith("ask", ESP, "other@zeta-cluster-fixture.net\nother.net\n")).toBe(
      "esp|ops@zeta-cluster-fixture.net|zeta-cluster-fixture.net",
    );
  });

  test("2. no ESP values -> the prompt supplies them", () => {
    expect(resolveWith("ask", {}, "ops@zeta-cluster-fixture.net\nzeta-cluster-fixture.net\n")).toBe(
      "prompt|ops@zeta-cluster-fixture.net|zeta-cluster-fixture.net",
    );
  });

  test("2. the prompt re-asks on a reserved domain and a bad email, then accepts", () => {
    const stdin = "you@example.com\nnot-an-email\nops@zeta-cluster-fixture.net\nexample.com\nportal.test\nzeta-cluster-fixture.net\n";
    expect(resolveWith("ask", {}, stdin)).toBe("prompt|ops@zeta-cluster-fixture.net|zeta-cluster-fixture.net");
  });

  test("3. Enter at the email prompt -> UNSET, not a default", () => {
    expect(resolveWith("ask", {}, "\n")).toBe("unset||");
  });

  test("3. Enter at the domain prompt -> UNSET (never half-set)", () => {
    expect(resolveWith("ask", {}, "ops@zeta-cluster-fixture.net\n\n")).toBe("unset||");
  });

  test("3. EOF on stdin -> UNSET, and the loop terminates", () => {
    expect(resolveWith("ask", {}, "")).toBe("unset||");
    expect(resolveWith("ask", {}, "bad\nbad\nbad\nbad\nbad\nbad\nbad\n")).toBe("unset||");
  });

  test("3. non-interactive (mode none) -> UNSET without reading stdin", () => {
    expect(resolveWith("none", {}, "ops@zeta-cluster-fixture.net\nzeta-cluster-fixture.net\n")).toBe("unset||");
  });

  test("gate mode: no 'p' within the window -> UNSET; 'p' opens the prompt", () => {
    expect(resolveWith("gate:1", {}, "x")).toBe("unset||");
    expect(resolveWith("gate:1", {}, "pops@zeta-cluster-fixture.net\nzeta-cluster-fixture.net\n")).toBe(
      "prompt|ops@zeta-cluster-fixture.net|zeta-cluster-fixture.net",
    );
  });

  test("an INVALID ESP value is refused loudly and falls through to the prompt / UNSET", () => {
    const bad = { ZETA_ACME_EMAIL: "you@example.com", ZETA_PUBLIC_DOMAIN: "portal.example.com" };
    expect(resolveWith("none", bad)).toBe("unset||");
    expect(resolveWith("ask", bad, "ops@zeta-cluster-fixture.net\nzeta-cluster-fixture.net\n")).toBe(
      "prompt|ops@zeta-cluster-fixture.net|zeta-cluster-fixture.net",
    );
  });

  test("a HALF ESP pair is refused, never half-applied", () => {
    expect(resolveWith("none", { ZETA_ACME_EMAIL: "ops@zeta-cluster-fixture.net" })).toBe("unset||");
    expect(resolveWith("none", { ZETA_PUBLIC_DOMAIN: "zeta-cluster-fixture.net" })).toBe("unset||");
  });
});

describe("(c) call-site wiring in the real scripts", () => {
  test("the resolver runs BEFORE disk enumeration (the start of the install), not after the long work", () => {
    const call = SRC.indexOf("zeta_public_tls_resolve \"$ZETA_PUBLIC_TLS_MODE\"");
    expect(call).toBeGreaterThan(SRC.indexOf(END));
    expect(call).toBeLessThan(SRC.indexOf("# ── Step 1: enumerate internal disks"));
  });

  test("SET values are written to /mnt/etc/zeta and symlinked for flake eval BEFORE nixos-install", () => {
    const install = SRC.indexOf("Running nixos-install --flake");
    for (const f of ["acme-email", "public-domain"]) {
      const write = SRC.indexOf(`/mnt/etc/zeta/${f}`);
      const link = SRC.indexOf(`maybe_symlink /mnt/etc/zeta/${f} /etc/zeta/${f}`);
      expect(write).toBeGreaterThan(0);
      expect(link).toBeGreaterThan(0);
      expect(write).toBeLessThan(install);
      expect(link).toBeLessThan(install);
    }
  });

  test("zeta-first-boot.sh EXPORTS the ESP-sourced pair (a sourced var never reaches the child)", () => {
    const fb = readFileSync(FIRST_BOOT_SH, "utf8");
    expect(fb).toMatch(/export ZETA_ACME_EMAIL="\$\{ZETA_ACME_EMAIL:-\}"/);
    expect(fb).toMatch(/export ZETA_PUBLIC_DOMAIN="\$\{ZETA_PUBLIC_DOMAIN:-\}"/);
  });

  test("the completion banner names the DNS + port-forward step when SET", () => {
    const banner = SRC.slice(SRC.indexOf("ZETA CLUSTER NODE INSTALL COMPLETE"));
    expect(banner).toContain("portal.${ZETA_PUBLIC_TLS_DOMAIN}");
    expect(banner).toMatch(/80.*443/);
  });
});
