/**
 * home-ownership-shell-parity.test.ts — 081M3K16QKA087G0R002GT2F8X.
 *
 * MEASURED on a real bare-metal reinstall (node-5b2dfa, 2026-09-27):
 *
 *   - the install console printed "WARN: could not resolve zeta UID/GID from
 *     /mnt via chroot; falling back to NixOS defaults (1000:100)". The chroot
 *     could never work: `chroot /mnt id` resolves `id` through the live ISO's
 *     PATH, which is all /run/... — a tmpfs that does not exist inside /mnt
 *     until the installed system boots. The fallback happened to be right, so
 *     the dead resolution went unnoticed.
 *   - `ls ~/.kube` -> Permission denied: /home/zeta/.kube was root:root 0750,
 *     created 23:20:10 on first boot — the second zeta-creds-to-k8s.service
 *     ran `k3s kubectl` AS ROOT with HOME=/home/zeta (kubectl's discovery cache
 *     lands in $HOME/.kube/cache).
 *   - `git -C /etc/zeta rev-parse HEAD` as zeta -> "fatal: detected dubious
 *     ownership": the flake source is root-owned (correctly) and nothing told
 *     git that trusting root is safe.
 *
 * This file pins all three. The resolver is extracted VERBATIM from
 * zeta-install.sh (ZETA-HOME-IDS-BEGIN/END) and run in a real bash, same
 * harness and reason as install-failure-cause-shell-parity.test.ts: the ISO
 * ships no bun, so nothing on that path can execute TypeScript.
 *
 * PATHS: every filename inside a bash script string is a bare relative name
 * under `cwd: workdir` — an absolute Windows path would carry backslashes that
 * bash reads as escapes (repo-pin-shell-parity.test.ts names the incident).
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const INSTALLER = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");
const CREDS_TO_K8S = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-creds-to-k8s.nix"), "utf8");
const COMMON = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/common.nix"), "utf8");

const BEGIN = "# ZETA-HOME-IDS-BEGIN";
const END = "# ZETA-HOME-IDS-END";

function extractBlock(): string {
  const b = INSTALLER.indexOf(BEGIN);
  const e = INSTALLER.indexOf(END);
  if (b < 0 || e < 0 || e < b) throw new Error("ZETA-HOME-IDS markers missing or out of order in zeta-install.sh");
  return INSTALLER.slice(b, e + END.length);
}

/** Strip `#` comment lines so a comment can never satisfy (or trip) a check. */
function code(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-home-ids-"));
function resolve(passwd: string | null, homeDir: string | null): { rc: number; out: string } {
  // Extracted per call (not at load) so a missing marker fails THESE tests by
  // name instead of aborting the whole file before the other checks can speak.
  writeFileSync(join(workdir, "block.sh"), extractBlock() + "\n", "utf8");
  if (passwd !== null) writeFileSync(join(workdir, "passwd"), passwd, "utf8");
  const passwdArg = passwd === null ? "no-such-passwd" : "passwd";
  if (homeDir !== null) mkdirSync(join(workdir, homeDir), { recursive: true });
  const homeArg = homeDir ?? "no-such-home";
  writeFileSync(
    join(workdir, "runner.sh"),
    `set -uo pipefail\nsource ./block.sh\nzeta_resolve_home_ids "${passwdArg}" "${homeArg}" zeta\n`,
    "utf8",
  );
  const r = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8" });
  return { rc: r.status ?? -1, out: (r.stdout ?? "").trim() };
}

const NIXOS_PASSWD = [
  "root:x:0:0:System administrator:/root:/run/current-system/sw/bin/bash",
  "messagebus:x:4:4:D-Bus system message bus daemon user:/run/dbus:/run/current-system/sw/bin/nologin",
  "zetaops:x:1000:100::/home/zetaops:/run/current-system/sw/bin/bash",
  "zeta:x:1001:100::/home/zeta:/run/current-system/sw/bin/bash",
  "nobody:x:65534:65534:Unprivileged account:/var/empty:/run/current-system/sw/bin/nologin",
  "",
].join("\n");

describe("zeta_resolve_home_ids — the installed system's account database, read as a file", () => {
  it("resolves uid AND gid from passwd, and the source says so", () => {
    expect(resolve(NIXOS_PASSWD, null)).toEqual({ rc: 0, out: "1001 100 passwd" });
  });

  it("matches the user name exactly — a user whose name merely STARTS with zeta is not zeta", () => {
    // zetaops is 1000 and listed first; a prefix match would return 1000.
    expect(resolve(NIXOS_PASSWD, null).out.startsWith("1001 ")).toBe(true);
  });

  it("a malformed passwd entry is not an answer — falls through to the home-dir witness or refuses", () => {
    const r = resolve("zeta:x:abc:100::/home/zeta:/bin/sh\n", null);
    expect(r.rc).toBe(1);
    expect(r.out).toBe("");
  });

  it("with no passwd entry, the home directory's owner is the second witness (unless it is root)", () => {
    const r = resolve("root:x:0:0::/root:/bin/sh\n", "home-zeta");
    const stat = (spawnSync("stat", ["-c", "%u %g", "home-zeta"], { cwd: workdir, encoding: "utf8" }).stdout ?? "")
      .trim();
    if (stat.startsWith("0 ")) {
      // Running as root (a container): a root-owned home is the bug, never a witness.
      expect(r).toEqual({ rc: 1, out: "" });
    } else {
      expect(r).toEqual({ rc: 0, out: `${stat} home-dir` });
    }
  });

  it("with neither witness it REFUSES (rc 1, nothing on stdout) rather than guessing", () => {
    expect(resolve(null, null)).toEqual({ rc: 1, out: "" });
  });
});

describe("zeta-install.sh — the dead chroot resolution is gone and ownership is right by construction", () => {
  const src = code(INSTALLER);

  it("no longer resolves ids with `chroot /mnt id` (cannot run: /mnt has no /run until boot)", () => {
    expect(src).not.toMatch(/chroot\s+\/mnt\s+id\b/);
    expect(src).toContain('zeta_resolve_home_ids /mnt/etc/passwd "$ZETA_HOME" zeta');
  });

  it("sweeps ownership of the whole home AFTER the last write under it", () => {
    const sweepAt = INSTALLER.indexOf("# ZETA-HOME-OWNERSHIP-SWEEP");
    expect(sweepAt).toBeGreaterThan(-1);
    const after = INSTALLER.slice(sweepAt);
    expect(after.split("\n")[1]?.trim()).toBe('sudo chown -R "$ZETA_UID:$ZETA_GID" "$ZETA_HOME"');

    // Every root-side write under the operator's home must come BEFORE the sweep,
    // or the sweep covers nothing it did not already cover. A new step appended
    // after it fails here, by name.
    const writeVerb = /\b(mkdir|cp|tee|touch|install|mv|ln|git clone|chown|chmod)\b|>/;
    const homeRef = /\$ZETA_HOME|\/mnt\/home\/zeta/;
    const offenders = code(after.split("\n").slice(2).join("\n"))
      .split("\n")
      .filter((l) => !/^\s*echo\b/.test(l)) // a message ABOUT the home writes nothing
      .filter((l) => homeRef.test(l) && writeVerb.test(l));
    expect(offenders).toEqual([]);
  });

  it("the sweep sits inside the block that gates on the home existing", () => {
    const gate = INSTALLER.indexOf('if [ -d "$ZETA_HOME" ]; then');
    const sweep = INSTALLER.indexOf("# ZETA-HOME-OWNERSHIP-SWEEP");
    const absent = INSTALLER.indexOf('echo "[iter-5.5.0] $ZETA_HOME absent; skipping');
    expect(gate).toBeGreaterThan(-1);
    expect(sweep).toBeGreaterThan(gate);
    expect(absent).toBeGreaterThan(sweep);
  });
});

describe("installed-system ownership — the NixOS side", () => {
  it("zeta-creds-to-k8s (a ROOT unit) does not run with HOME set to the operator's home", () => {
    const nix = code(CREDS_TO_K8S);
    expect(nix).not.toMatch(/"HOME=\$\{cfg\.home\}"/);
    expect(nix).toContain('"HOME=/var/lib/zeta-creds-to-k8s"');
    expect(nix).toContain('StateDirectory = "zeta-creds-to-k8s";');
    // The operator's home still reaches the projector — explicitly, not via $HOME.
    expect(nix).toContain("--home ${cfg.home}");
  });

  it("an existing root-owned ~/.kube is re-owned to the operator on the next boot/rebuild", () => {
    const nix = code(CREDS_TO_K8S);
    expect(nix).toContain('"d ${cfg.home}/.kube 0700 ${cfg.user} users -"');
    expect(nix).toContain('"Z ${cfg.home}/.kube - ${cfg.user} users -"');
  });

  it("/etc/zeta stays root-owned but is readable by git (system safe.directory)", () => {
    const nix = code(COMMON);
    expect(nix).toMatch(/programs\.git\s*=\s*\{[^}]*enable\s*=\s*true;[^}]*config\.safe\.directory\s*=\s*"\/etc\/zeta";/s);
  });
});
