/**
 * console-password-shell.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 19.
 *
 * THE `mint` POLICY. With no password typed - which the zero-typing path always is - the installed
 * node kept the iter-4.x default `zeta-change-me`: the SAME known console password on every install.
 * Under policy `mint` each install instead mints its own random one-time password, shown ONCE on the
 * console devices and NEVER on the script's tee'd stdout (that is copied into the install log on the
 * node); when it cannot be shown, the account is LOCKED rather than defaulted. `mint` is the explicit
 * opt-in (`zflash --console-password mint`); the repo default is the owner's `default` policy, which is
 * pinned in console-password-policy-shell.test.ts (the policy, both branches executed, the reminder).
 *
 * Extracts the ZETA-CONSOLE-PW block from the real zeta-install.sh and runs it under bash; the call
 * site and the Nix activation are pinned on their text (no nix here: stated, not implied).
 * `sudo` is a function in the harness (`sudo() { "$@"; }`), and ZETA_CONSOLE_DEVICES points at files.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { installCompletePasswordDisclosureFailures, extractInstallCompleteBannerSource } from "../ci/install-complete-banner.ts";

const INSTALL_SH = resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const PASSWORD_NIX = resolve(import.meta.dir, "../../../full-ai-cluster/nixos/modules/initial-password.nix");
const SRC = readFileSync(INSTALL_SH, "utf8");
const NIX = readFileSync(PASSWORD_NIX, "utf8");
const BEGIN = "# ZETA-CONSOLE-PW-BEGIN";
const END = "# ZETA-CONSOLE-PW-END";

const workdir = mkdtempSync(join(tmpdir(), "zeta-console-pw-"));
const fwd = (p: string) => p.replaceAll("\\", "/");
const blockPath = fwd(join(workdir, "block.sh"));
{
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0 || e < b) throw new Error("ZETA-CONSOLE-PW markers missing/out of order in zeta-install.sh");
  writeFileSync(blockPath, SRC.slice(b, e + END.length) + "\n", "utf8");
}

function runBash(script: string, env: Record<string, string> = {}): { out: string; err: string; status: number } {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, `set -uo pipefail\nsudo() { "$@"; }\nsource ${blockPath}\n${script}\n`, "utf8");
  const r = spawnSync("bash", [fwd(runner)], { encoding: "utf8", env: { ...process.env, ...env } });
  return { out: String(r.stdout), err: String(r.stderr), status: r.status ?? -1 };
}

describe("minting", () => {
  test("a password is 24 lowercase base32 characters (120 bits of /dev/urandom)", () => {
    const r = runBash("zeta_mint_console_password");
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/^[a-z2-7]{24}$/);
  });

  test("THE DEFECT: two installs do NOT share a password (the old default was one constant)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) seen.add(runBash("zeta_mint_console_password").out.trim());
    expect(seen.size).toBe(8);
    expect(seen.has("zeta-change-me")).toBe(false);
  });
});

describe("showing: console devices only, never stdout", () => {
  test("the password lands on every writable console device and NOT on stdout", () => {
    const a = fwd(join(workdir, "console-a"));
    const b = fwd(join(workdir, "console-b"));
    const r = runBash('zeta_console_password_show "hunter2-one-time"; echo "rc=$?"', { ZETA_CONSOLE_DEVICES: `${a} ${b}` });
    expect(r.out.trim()).toBe("rc=0");
    expect(r.out).not.toContain("hunter2-one-time");
    expect(r.err).not.toContain("hunter2-one-time");
    for (const f of [a, b]) {
      const text = readFileSync(f, "utf8");
      expect(text).toContain("hunter2-one-time");
      expect(text).toContain("shown ONCE, not logged");
    }
  });

  test("shown on at least one device is success; shown on NONE is failure (so the caller locks the account)", () => {
    const dir = fwd(join(workdir, "a-directory-is-not-writable-as-a-file"));
    mkdirSync(dir, { recursive: true });
    const good = fwd(join(workdir, "console-ok"));
    expect(runBash('zeta_console_password_show pw; echo "rc=$?"', { ZETA_CONSOLE_DEVICES: `${dir} ${good}` }).out.trim()).toBe("rc=0");
    expect(runBash('zeta_console_password_show pw; echo "rc=$?"', { ZETA_CONSOLE_DEVICES: `${dir}` }).out.trim()).toBe("rc=1");
  });
});

describe("the call site (zeta-install.sh Step 6.55)", () => {
  const step = SRC.slice(SRC.indexOf("# ── Step 6.55: iter-5.3"), SRC.indexOf("# ── Step 6.56:"));

  test("no password typed -> mint, hash, SHOW, then write the hash file and the minted marker", () => {
    expect(step).toContain('ZETA_MINTED_PW="$(zeta_mint_console_password)"');
    expect(step).toContain("zeta_console_password_show");
    const show = step.indexOf('zeta_console_password_show "$ZETA_MINTED_PW"');
    const write = step.indexOf("/mnt/etc/zeta/initial-hashedpassword", show);
    expect(show).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(show); // nothing is written until the password has been shown to somebody
    expect(step).toContain("/mnt/etc/zeta/initial-password-minted");
  });

  test("the plaintext is only ever piped (to mkpasswd) or passed to the console writer -- never echoed, never on stdout", () => {
    const uses = step.split("\n").filter((l) => l.includes("ZETA_MINTED_PW"));
    for (const l of uses) {
      const ok =
        l.includes('ZETA_MINTED_PW="$(zeta_mint_console_password)"') ||
        l.includes("printf '%s\\n' \"$ZETA_MINTED_PW\" | mkpasswd") ||
        l.includes('[ -n "$ZETA_MINTED_PW" ]') ||
        l.includes("unset ZETA_MINTED_PW") ||
        l.includes("# ");
      expect(ok, `ZETA_MINTED_PW used unsafely: ${l.trim()}`).toBe(true);
      expect(l).not.toMatch(/\becho\b.*ZETA_MINTED_PW/);
    }
  });

  test("it cannot be minted AND shown -> the account is LOCKED, loudly, not defaulted", () => {
    expect(step).toContain("/mnt/etc/zeta/console-password-locked");
    expect(step).toMatch(/console password is LOCKED/);
  });

  test("a typed password whose hash fails does not fall back to the shared default either", () => {
    expect(step).toContain("mkpasswd produced an invalid hash; the zeta console password is LOCKED (not defaulted)");
    expect(step).not.toContain("falling back to default");
  });

  test("the shared default is no longer promised to the operator anywhere in the installer", () => {
    expect(SRC).not.toContain("iter-4.x default 'zeta-change-me' stays");
    expect(SRC).not.toContain("login as zeta/zeta-change-me");
  });

  test("the install-complete banner still discloses no password (the repo's own non-disclosure policy)", () => {
    const banner = extractInstallCompleteBannerSource(SRC);
    expect(banner).not.toBeNull();
    expect(installCompletePasswordDisclosureFailures(banner!)).toEqual([]);
  });
});

describe("the Nix activation (initial-password.nix) - text only, nothing was evaluated", () => {
  test("minted and locked states have their own markers, applied ONCE through a state file", () => {
    expect(NIX).toContain('mintedMarker = "/etc/zeta/initial-password-minted"');
    expect(NIX).toContain('lockedMarker = "/etc/zeta/console-password-locked"');
    expect(NIX).toContain('stateFile = "/var/lib/zeta/console-password-applied"');
    expect(NIX).toContain("usermod -L zeta");
    expect(NIX).toContain("already applied once; not re-applying");
  });

  test("minting does NOT expire the password: an expired password makes sshd demand a change even for KEY logins, breaking non-interactive SSH", () => {
    expect(NIX).not.toMatch(/chage\b/);
  });

  test("an operator-CHOSEN password keeps its behaviour (the branch order puts minted/locked first, typed after)", () => {
    const iLocked = NIX.indexOf('if [ -f "${lockedMarker}" ] && [ ! -f "${stateFile}" ]');
    const iMinted = NIX.indexOf('elif [ -f "${hashFile}" ] && [ -f "${mintedMarker}" ]');
    const iTyped = NIX.indexOf('elif [ -f "${hashFile}" ]; then');
    expect(iLocked).toBeGreaterThan(0);
    expect(iMinted).toBeGreaterThan(iLocked);
    expect(iTyped).toBeGreaterThan(iMinted);
    expect(NIX).toContain("applied operator-chosen password hash");
  });
});
