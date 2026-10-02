/**
 * console-password-policy-shell.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 19.
 *
 * With NO password typed at the installer prompt, the `zeta` console password is an install-time POLICY
 * (`ZETA_CONSOLE_PASSWORD_POLICY`): `default` (the repo default, the OWNER's decision: the PUBLIC
 * `zeta-change-me`, never locked, never minted, announced loudly) or `mint` (the random one-time
 * password of PR #17796, locked if unseen). A password TYPED at the prompt always wins over both.
 *
 * What is EXECUTED here (bash): the policy resolver, the unknown-policy refusal at the call site, and every
 * branch of the real Step 6.55 text (typed wins / mint / default / mkpasswd failure), against a temp
 * directory standing in for /mnt/etc/zeta. `sudo`, `chown` and `mkpasswd` are stubs in the harness; the
 * mkpasswd stub encodes its STDIN into the hash and logs its argv, so the tests can say "the password
 * went on stdin, never on argv".
 * What is read as TEXT (no nix on the authoring machine; stated, not implied): initial-password.nix, the
 * reminder service, the ISO's baked conf, common.nix.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { planConsolePasswordPolicy } from "./console-password-policy.ts";

const REPO = resolve(import.meta.dir, "../../..");
const INSTALL_SH = join(REPO, "full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const FIRST_BOOT = readFileSync(join(REPO, "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh"), "utf8");
const ISO_CONFIG = readFileSync(join(REPO, "full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix"), "utf8");
const NIX = readFileSync(join(REPO, "full-ai-cluster/nixos/modules/initial-password.nix"), "utf8");
const COMMON_NIX = readFileSync(join(REPO, "full-ai-cluster/nixos/modules/common.nix"), "utf8");
const SRC = readFileSync(INSTALL_SH, "utf8");

const T = 120_000; // bash spawns are slow on Windows

const workdir = mkdtempSync(join(tmpdir(), "zeta-console-pw-policy-"));
const fwd = (p: string) => p.replaceAll("\\", "/");

function between(begin: string, end: string, inclusiveEnd = false): string {
  const b = SRC.indexOf(begin);
  const e = SRC.indexOf(end, b + 1);
  if (b < 0 || e < b) throw new Error(`markers missing/out of order in zeta-install.sh: ${begin} .. ${end}`);
  return SRC.slice(b, inclusiveEnd ? e + end.length : e);
}

const PW_BLOCK = between("# ZETA-CONSOLE-PW-BEGIN", "# ZETA-CONSOLE-PW-END", true);
const POLICY_BLOCK = between("# ZETA-CONSOLE-PW-POLICY-BEGIN", "# ZETA-CONSOLE-PW-POLICY-END", true);
const POLICY_CALL_SITE = between("# Refuse an unknown policy HERE", "# ── Step 1: enumerate internal disks");
const STEP_655 = between("# ── Step 6.55: iter-5.3", "# ── Step 6.56:");

interface Run {
  readonly out: string;
  readonly err: string;
  readonly status: number;
  readonly root: string;
  readonly consoleDevice: string;
  readonly argvLog: string;
}

function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.ZETA_CONSOLE_PASSWORD_POLICY;
  return { ...env, ...extra };
}

/** Runs the policy call site then the REAL Step 6.55 text. `root` stands in for /mnt. */
function runInstall(opts: {
  policy?: string | undefined;
  prompts?: boolean | undefined;
  stdin?: string | undefined;
  mkpasswdFails?: boolean | undefined;
}): Run {
  const root = mkdtempSync(join(workdir, "mnt-"));
  const consoleDevice = fwd(join(root, "console-device"));
  const argvLog = fwd(join(root, "mkpasswd-argv.log"));
  const dir = fwd(root);
  const files = {
    pw: fwd(join(root, "pw-block.sh")),
    policy: fwd(join(root, "policy-block.sh")),
    call: fwd(join(root, "call-site.sh")),
    step: fwd(join(root, "step.sh")),
    runner: fwd(join(root, "runner.sh")),
  };
  writeFileSync(files.pw, PW_BLOCK + "\n", "utf8");
  writeFileSync(files.policy, POLICY_BLOCK + "\n", "utf8");
  writeFileSync(files.call, POLICY_CALL_SITE + "\n", "utf8");
  writeFileSync(files.step, STEP_655.replaceAll("/mnt/etc/zeta", `${dir}/etc/zeta`) + "\n", "utf8");
  writeFileSync(
    files.runner,
    String.raw`set -uo pipefail
bail() { echo "ERROR: $*" >&2; exit 1; }
sudo() { "$@"; }
chown() { :; }
zeta_install_prompts_enabled() { [ "${"$"}{PROMPTS:-0}" = 1 ]; }
mkpasswd() {
  printf '%s\n' "$*" >> "${argvLog}"
  local pw; pw="$(cat)"
  if [ "${"$"}{MKPASSWD_FAILS:-0}" = 1 ]; then return 1; fi
  printf '$6$stub$%s\n' "$pw"
}
source ${files.pw}
source ${files.policy}
source ${files.call}
source ${files.step}
echo "REACHED-END"
`,
    "utf8",
  );
  const env = cleanEnv({
    ZETA_CONSOLE_DEVICES: consoleDevice,
    PROMPTS: opts.prompts ? "1" : "0",
    MKPASSWD_FAILS: opts.mkpasswdFails ? "1" : "0",
    ...(opts.policy === undefined ? {} : { ZETA_CONSOLE_PASSWORD_POLICY: opts.policy }),
  });
  const r = spawnSync("bash", [files.runner], { encoding: "utf8", env, input: opts.stdin ?? "" });
  return { out: String(r.stdout), err: String(r.stderr), status: r.status ?? -1, root, consoleDevice, argvLog };
}

const etc = (run: Run, name: string) => join(run.root, "etc/zeta", name);
/** Membership in the directory listing: one syscall, no existsSync-then-read pair to race. */
const has = (run: Run, name: string) => {
  try {
    return readdirSync(join(run.root, "etc/zeta")).includes(name);
  } catch {
    return false; // the directory was never created (e.g. the install refused before writing anything)
  }
};
const read = (run: Run, name: string) => readFileSync(etc(run, name), "utf8");
const BANNER = "CONSOLE PASSWORD IS THE PUBLIC DEFAULT zeta-change-me — change it: sudo passwd zeta. SSH password login stays disabled.";

describe("the policy resolver (shell twin of planConsolePasswordPolicy)", () => {
  test("shell and TypeScript agree on every value; empty means default; anything else refuses", () => {
    const values = ["default", "mint", "DEFAULT", "Mint", "locked", "none", "default ", "zeta-change-me", "mint;ls"];
    const runner = fwd(join(workdir, "resolver.sh"));
    const policy = fwd(join(workdir, "resolver-policy.sh"));
    writeFileSync(policy, POLICY_BLOCK + "\n", "utf8");
    writeFileSync(
      runner,
      String.raw`set -uo pipefail
source ${policy}
unset ZETA_CONSOLE_PASSWORD_POLICY
printf 'EMPTY=%s\n' "$(zeta_console_password_policy_resolve)"
for v in "$@"; do
  r="$(ZETA_CONSOLE_PASSWORD_POLICY="$v" zeta_console_password_policy_resolve)" && printf '%s=%s\n' "$v" "$r" || printf '%s=REFUSED\n' "$v"
done
`,
      "utf8",
    );
    const r = spawnSync("bash", [runner, ...values], { encoding: "utf8", env: cleanEnv({}) });
    const lines = String(r.stdout).split(/\r?\n/).filter((l) => l.length > 0);
    expect(lines[0]).toBe("EMPTY=default");
    for (const v of values) {
      const ts = planConsolePasswordPolicy(v);
      const expected = ts.ok && ts.value !== null ? ts.value : "REFUSED";
      expect(lines.find((l) => l.startsWith(`${v}=`)), `shell result for ${JSON.stringify(v)}`).toBe(`${v}=${expected}`);
    }
  }, T);

  test("an unknown policy refuses the install LOUDLY at the call site, before the wipe", () => {
    const run = runInstall({ policy: "locked" });
    expect(run.status).toBe(1);
    expect(run.err).toContain("ERROR: ZETA_CONSOLE_PASSWORD_POLICY='locked' is neither 'default' nor 'mint'");
    expect(run.err).toContain("Nothing has been wiped.");
    expect(run.out).not.toContain("REACHED-END");
    expect(has(run, "initial-hashedpassword")).toBe(false);
    expect(has(run, "console-password-locked")).toBe(false); // a typo must not silently lock either
  }, T);

  test("the call site sits BEFORE Step 1 (disk enumeration), so a refusal wipes nothing", () => {
    expect(SRC.indexOf("# Refuse an unknown policy HERE")).toBeLessThan(SRC.indexOf("# ── Step 1: enumerate internal disks"));
    expect(SRC.indexOf("# Refuse an unknown policy HERE")).toBeLessThan(SRC.indexOf("About to FULL-WIPE"));
  });
});

describe("Step 6.55, executed: a TYPED password always wins", () => {
  for (const policy of [undefined, "default", "mint"] as const) {
    test(`policy ${policy ?? "(unset)"}: the typed hash is written; no default/minted/locked marker; no banner`, () => {
      const run = runInstall({ policy, prompts: true, stdin: "hunter2-typed\nhunter2-typed\n" });
      expect(run.status).toBe(0);
      expect(run.out).toContain("REACHED-END");
      expect(read(run, "initial-hashedpassword").trim()).toBe("$6$stub$hunter2-typed");
      // The EXACT set of files: the hash and nothing else, so no default/minted/locked marker exists.
      expect(readdirSync(join(run.root, "etc/zeta"))).toEqual(["initial-hashedpassword"]);
      // Zero banner lines, stated as an exact count rather than an absence.
      expect(run.out.split("\n").filter((l) => l.includes("CONSOLE PASSWORD IS THE PUBLIC DEFAULT"))).toEqual([]);
      expect(existsSync(run.consoleDevice)).toBe(false); // nothing was shown on the console either
    }, T);
  }

  test("the typed password goes to mkpasswd on STDIN, never argv", () => {
    const run = runInstall({ policy: "default", prompts: true, stdin: "hunter2-typed\nhunter2-typed\n" });
    const argv = readFileSync(run.argvLog, "utf8");
    expect(argv).not.toContain("hunter2-typed");
    expect(argv.trim()).toBe("-m sha-512 -s");
  }, T);

  test("a typed password whose confirmation does not match falls through to the POLICY (default here), not to a lock", () => {
    const run = runInstall({ policy: "default", prompts: true, stdin: "one\ntwo\n" });
    expect(run.out).toContain("passwords don't match");
    expect(has(run, "initial-password-default")).toBe(true);
    expect(has(run, "console-password-locked")).toBe(false);
  }, T);
});

describe("Step 6.55, executed: no password typed, policy `default` (the repo default)", () => {
  for (const policy of [undefined, "", "default"] as const) {
    test(`policy ${JSON.stringify(policy ?? "(unset)")}: hash of the PUBLIC password, marker, NO lock, NO mint, LOUD banner`, () => {
      const run = runInstall(policy === undefined ? {} : { policy });
      expect(run.status).toBe(0);
      expect(run.out).toContain("REACHED-END");
      expect(read(run, "initial-hashedpassword").trim()).toBe("$6$stub$zeta-change-me");
      expect(has(run, "initial-password-default")).toBe(true);
      expect(has(run, "console-password-locked")).toBe(false);
      expect(has(run, "initial-password-minted")).toBe(false);
      expect(run.out).toContain(BANNER);
    }, T);
  }

  test("the banner is on the console devices as well as stdout (console + serial)", () => {
    const run = runInstall({ policy: "default" });
    expect(readFileSync(run.consoleDevice, "utf8")).toContain(BANNER);
  }, T);

  test("the public password goes to mkpasswd on STDIN and the hash alone is written: never on argv", () => {
    const run = runInstall({ policy: "default" });
    const argv = readFileSync(run.argvLog, "utf8");
    expect(argv).not.toContain("zeta-change-me");
    expect(argv.trim()).toBe("-m sha-512 -s");
    expect(read(run, "initial-hashedpassword")).toBe("$6$stub$zeta-change-me\n");
  }, T);

  test("mkpasswd failing does NOT lock and does NOT mint: the marker is written and the module's build-time fallback (the same public hash) applies", () => {
    const run = runInstall({ policy: "default", mkpasswdFails: true });
    expect(run.status).toBe(0);
    expect(has(run, "initial-password-default")).toBe(true);
    expect(has(run, "initial-hashedpassword")).toBe(false);
    expect(has(run, "console-password-locked")).toBe(false);
    expect(has(run, "initial-password-minted")).toBe(false);
    expect(run.err).toContain("build-time fallback hash");
    expect(run.out).toContain(BANNER);
  }, T);

  test("the unset-policy install says out loud what it chose (stderr at the call site)", () => {
    const run = runInstall({});
    expect(run.out).toContain("[console-password] policy when no password is typed: default");
    expect(run.err).toContain("the PUBLIC zeta-change-me");
    expect(run.err).toContain("zflash --console-password mint");
  }, T);
});

describe("Step 6.55, executed: no password typed, policy `mint` (explicit opt-in, today's behaviour)", () => {
  test("a minted one-time password is shown on the console device only; the hash and minted marker are written; NOT the public password", () => {
    const run = runInstall({ policy: "mint" });
    expect(run.status).toBe(0);
    // The EXACT set of files: the hash plus the minted marker; no default marker, no lock.
    expect(readdirSync(join(run.root, "etc/zeta")).sort()).toEqual(["initial-hashedpassword", "initial-password-minted"]);
    const hash = read(run, "initial-hashedpassword").trim();
    expect(hash).toMatch(/^\$6\$stub\$[a-z2-7]{24}$/);
    expect(hash).not.toContain("zeta-change-me");
    const shown = readFileSync(run.consoleDevice, "utf8");
    const pw = hash.replace("$6$stub$", "");
    expect(shown).toContain(pw);
    expect(run.out).not.toContain(pw); // never on the tee'd stdout
    expect(run.out.split("\n").filter((l) => l.includes("CONSOLE PASSWORD IS THE PUBLIC DEFAULT"))).toEqual([]);
  }, T);

  test("mint with nowhere to show it LOCKS the account (not defaulted): the safe opt-in keeps its fail-safe", () => {
    // The console device is a directory, which no `tee` can write.
    const root = mkdtempSync(join(workdir, "mint-lock-"));
    const dirAsDevice = fwd(join(root, "a-directory"));
    mkdirSync(dirAsDevice, { recursive: true });
    const runner = fwd(join(root, "runner.sh"));
    const files = ["pw", "policy", "call", "step"].map((n) => fwd(join(root, `${n}.sh`)));
    writeFileSync(files[0]!, PW_BLOCK + "\n", "utf8");
    writeFileSync(files[1]!, POLICY_BLOCK + "\n", "utf8");
    writeFileSync(files[2]!, POLICY_CALL_SITE + "\n", "utf8");
    writeFileSync(files[3]!, STEP_655.replaceAll("/mnt/etc/zeta", `${fwd(root)}/etc/zeta`) + "\n", "utf8");
    writeFileSync(
      runner,
      String.raw`set -uo pipefail
bail() { echo "ERROR: $*" >&2; exit 1; }
sudo() { "$@"; }
chown() { :; }
zeta_install_prompts_enabled() { return 1; }
mkpasswd() { local pw; pw="$(cat)"; printf '$6$stub$%s\n' "$pw"; }
source ${files[0]}
source ${files[1]}
source ${files[2]}
source ${files[3]}
`,
      "utf8",
    );
    const r = spawnSync("bash", [runner], {
      encoding: "utf8",
      env: cleanEnv({ ZETA_CONSOLE_DEVICES: dirAsDevice, ZETA_CONSOLE_PASSWORD_POLICY: "mint" }),
    });
    expect(existsSync(join(root, "etc/zeta/console-password-locked"))).toBe(true);
    expect(existsSync(join(root, "etc/zeta/initial-hashedpassword"))).toBe(false);
    expect(String(r.stderr)).toContain("password is LOCKED");
  }, T);
});

describe("the Nix activation + reminder (initial-password.nix) - text only, nothing was evaluated", () => {
  test("the default marker is its own branch, between locked and minted, applied ONCE through the shared state file", () => {
    const iLocked = NIX.indexOf('if [ -f "${lockedMarker}" ] && [ ! -f "${stateFile}" ]');
    const iDefault = NIX.indexOf('elif [ -f "${defaultMarker}" ]; then');
    const iMinted = NIX.indexOf('elif [ -f "${hashFile}" ] && [ -f "${mintedMarker}" ]');
    const iTyped = NIX.indexOf('elif [ -f "${hashFile}" ]; then');
    expect(iLocked).toBeGreaterThan(0);
    expect(iDefault).toBeGreaterThan(iLocked);
    expect(iMinted).toBeGreaterThan(iDefault);
    expect(iTyped).toBeGreaterThan(iMinted);
    expect(NIX).toContain('defaultMarker = "/etc/zeta/initial-password-default"');
    const branch = NIX.slice(iDefault, iMinted);
    expect(branch).toContain('if [ -f "${stateFile}" ]; then');
    expect(branch).toContain("public default already applied once; not re-applying");
    expect(branch).toContain('touch "${stateFile}"');
  });

  test("the default branch applies a hash and NEVER locks (and falls back to the same public hash, not to a lock)", () => {
    const branch = NIX.slice(NIX.indexOf('elif [ -f "${defaultMarker}" ]; then'), NIX.indexOf('elif [ -f "${hashFile}" ] && [ -f "${mintedMarker}" ]'));
    expect(branch).toContain("usermod -p");
    expect(branch).not.toContain("usermod -L");
    expect(branch).toContain("'${fallbackHash}'");
  });

  test("a typed password (no marker) never reaches the default branch: the marker is the only way in", () => {
    const branch = NIX.slice(NIX.indexOf('elif [ -f "${defaultMarker}" ]; then'), NIX.indexOf('elif [ -f "${hashFile}" ] && [ -f "${mintedMarker}" ]'));
    expect(branch.startsWith('elif [ -f "${defaultMarker}" ]; then')).toBe(true);
    // the installer writes the default marker ONLY in the no-typed-password branch of Step 6.55
    const typedBranch = STEP_655.slice(STEP_655.indexOf('if [ -n "$INJECTED_PW" ]; then'), STEP_655.indexOf('elif [ "${ZETA_CONSOLE_PASSWORD_POLICY_RESOLVED:-default}" = "default" ]'));
    expect(typedBranch.split("\n").filter((l) => l.includes("initial-password-default"))).toEqual([]);
  });

  test("the first-boot reminder: a service + timer keep a reminder file while the shadow hash is still the applied one, login shells print it", () => {
    expect(NIX).toContain("systemd.services.zeta-default-password-reminder");
    expect(NIX).toContain("systemd.timers.zeta-default-password-reminder");
    expect(NIX).toContain('reminderFile = "/run/zeta/console-password-is-default"');
    expect(NIX).toContain("grep '^zeta:' /etc/shadow");
    expect(NIX).toContain('if [ "$have" = "$want" ]; then');
    expect(NIX).toMatch(/else\s+\$\{pkgs\.coreutils\}\/bin\/rm -f "\$\{reminderFile\}"/); // hash changed -> reminder removed
    expect(NIX).toContain("environment.interactiveShellInit");
    expect(NIX).toContain('cat "${reminderFile}"');
    expect(NIX).toContain("NOTE: the zeta console password is still the PUBLIC default zeta-change-me");
  });

  test("the module never expires or force-changes the password (an expired password breaks key-only SSH)", () => {
    expect(NIX).not.toMatch(/chage\b/);
  });
});

describe("SSH password login stays DISABLED (unchanged by the policy)", () => {
  test("common.nix keeps PasswordAuthentication = false, and the installer ISO forces it", () => {
    expect(COMMON_NIX).toContain("PasswordAuthentication = lib.mkDefault false;");
    expect(ISO_CONFIG).toContain("PasswordAuthentication = lib.mkForce false;");
  });

  test("initial-password.nix does not touch sshd at all", () => {
    // Comments may name the setting (to say it is untouched); no CODE line may.
    const code = NIX.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    expect(code.split("\n").filter((l) => l.includes("PasswordAuthentication") || l.includes("services.openssh"))).toEqual([]);
  });

  test("no module under full-ai-cluster sets PasswordAuthentication true", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === ".git") continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".nix") && /PasswordAuthentication\s*=\s*(lib\.\w+\s+)?true/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(join(REPO, "full-ai-cluster"));
    expect(hits).toEqual([]);
  });

  test("the installer never writes sshd_config or enables password auth", () => {
    expect(SRC.split("\n").filter((l) => /PasswordAuthentication\s+yes/i.test(l))).toEqual([]);
  });
});

describe("the policy only comes from the owner's ESP / environment; the ISO bakes none", () => {
  test("the ISO's own /etc/zeta-firstboot.conf never sets the policy (so `mint` is never implicit, and `default` is only the installer's own unset-default)", () => {
    expect(ISO_CONFIG.split("\n").filter((l) => l.includes("ZETA_CONSOLE_PASSWORD_POLICY"))).toEqual([]);
  });

  test("zeta-first-boot.sh passes it through as ${VAR:-} and sets no policy of its own", () => {
    const lines = FIRST_BOOT.split("\n").filter((l) => /^\s*export ZETA_CONSOLE_PASSWORD_POLICY=/.test(l));
    expect(lines).toEqual(['export ZETA_CONSOLE_PASSWORD_POLICY="${ZETA_CONSOLE_PASSWORD_POLICY:-}"']);
    expect(FIRST_BOOT).not.toMatch(/ZETA_CONSOLE_PASSWORD_POLICY=['"]?(mint|default)/);
  });

  test("an explicit `mint` in the environment / ESP conf is honoured (it is the only way the policy leaves `default`)", () => {
    const run = runInstall({ policy: "mint" });
    expect(run.out).toContain("[console-password] policy when no password is typed: mint");
    expect(has(run, "initial-password-minted")).toBe(true);
    expect(has(run, "initial-password-default")).toBe(false);
  }, T);

  test("with nothing set anywhere the installer resolves `default` (the owner's repo default), loudly", () => {
    const run = runInstall({});
    expect(run.out).toContain("[console-password] policy when no password is typed: default");
    expect(has(run, "initial-password-default")).toBe(true);
  }, T);
});

describe("the install-complete summary reminds, without disclosing the literal", () => {
  test("it reads the default marker and says so without the password text (the non-disclosure check reads this block)", () => {
    const summary = SRC.slice(SRC.indexOf('echo "  ZETA CLUSTER NODE INSTALL COMPLETE"'), SRC.indexOf("081KSGS9H0008QG0R001RR3ZXQ install log preservation", SRC.indexOf('echo "  ZETA CLUSTER NODE INSTALL COMPLETE"')));
    expect(summary).toContain("/mnt/etc/zeta/initial-password-default");
    expect(summary).toContain("CONSOLE PASSWORD IS THE PUBLIC DEFAULT");
    expect(summary).not.toContain("zeta-change-me");
  });
});
