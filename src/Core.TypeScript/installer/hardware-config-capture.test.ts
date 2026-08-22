/**
 * hardware-config-capture.test.ts
 *
 * The falsifier for zeta-install.sh's hardware-configuration.nix capture.
 *
 * WHAT WENT WRONG, AND WHY A UNIT TEST IS THE RIGHT SHAPE FOR IT
 * -------------------------------------------------------------
 * The capture used to read:
 *
 *     if [ -f "$HW_SRC" ] && [ -e "$HW_DST" ]; then sudo cp "$HW_SRC" "$HW_DST"
 *     else echo "[iter-5.1] WARN: hardware-configuration not copied ..." >&2; fi
 *
 * A FAILED capture printed one stderr line and the install continued, baking the
 * committed placeholder -- which declares only `/` and `/boot`. zeta-install.sh
 * has by that point partitioned, formatted and mounted longhorn{1..N}; with the
 * placeholder installed those partitions get no `fileSystems` entry and never
 * mount again on the node.
 *
 * It compounds. PR #13252's boot-time Longhorn preflight
 * (full-ai-cluster/nixos/modules/longhorn-preflight-checks.nix) derives its
 * must-be-mounted set from the host's OWN `fileSystems`, so a placeholder node
 * makes that set EMPTY and the mount check passes with nothing to check. The
 * silent install-time fallback turned a brand-new guard into a check that cannot
 * fail -- a check that did not run, looking exactly like a check that passed.
 *
 * This file runs the REAL decision logic out of the REAL installer, the way
 * disk-preflight-shell-parity.test.ts does: it extracts the block between the
 * ZETA-HWCONFIG-CAPTURE markers and executes it under bash against tmpdir
 * fixtures. Nothing here touches a device; the extracted functions only read
 * paths and print verdicts.
 *
 * WHAT IT CANNOT TELL YOU
 * Nothing here runs an install. It proves the verdict function decides correctly
 * over fixtures, that the installer's call site refuses on every non-good
 * verdict, and that the committed placeholders really would be caught. It cannot
 * prove `nixos-generate-config` emits what we expect on any particular hardware;
 * only an install can, and the QEMU full-install lane is where that is measured.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const INSTALL_SH = new URL(
  "../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh",
  import.meta.url,
).pathname;
const HOSTS_DIR = new URL("../../../full-ai-cluster/nixos/hosts", import.meta.url).pathname;

const BEGIN = "# ZETA-HWCONFIG-CAPTURE-BEGIN";
const END = "# ZETA-HWCONFIG-CAPTURE-END";

const installSh = readFileSync(INSTALL_SH, "utf8");

function extractCaptureBlock(): string {
  const b = installSh.indexOf(BEGIN);
  const e = installSh.indexOf(END);
  if (b < 0) throw new Error("ZETA-HWCONFIG-CAPTURE-BEGIN marker missing from zeta-install.sh");
  if (e < 0) throw new Error("ZETA-HWCONFIG-CAPTURE-END marker missing from zeta-install.sh");
  if (e < b) throw new Error("ZETA-HWCONFIG-CAPTURE markers out of order in zeta-install.sh");
  return installSh.slice(b, e + END.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-hwcap-"));
const blockPath = join(workdir, "capture-block.sh");
writeFileSync(blockPath, extractCaptureBlock() + "\n", "utf8");

/** Run a snippet with the extracted block sourced. Returns trimmed stdout. */
function runShell(script: string): string {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, `set -uo pipefail\nsource ${blockPath}\n${script}\n`, "utf8");
  const r = spawnSync("bash", [runner], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`capture block exited ${String(r.status)}: ${String(r.stderr)}`);
  }
  return String(r.stdout).trim();
}

// ── Fixture tree: a probe output, and the three host shapes that exist ──────
const fx = join(workdir, "fx");
const probe = join(fx, "etc/nixos/hardware-configuration.nix");
mkdirSync(join(fx, "etc/nixos"), { recursive: true });
writeFileSync(
  probe,
  [
    "{ config, lib, modulesPath, ... }:",
    "{",
    '  fileSystems."/" = { device = "/dev/disk/by-uuid/aaa"; fsType = "ext4"; };',
    '  fileSystems."/boot" = { device = "/dev/disk/by-uuid/bbb"; fsType = "vfat"; };',
    '  fileSystems."/var/lib/longhorn-disk1" = { device = "/dev/disk/by-uuid/ccc"; fsType = "ext4"; };',
    '  fileSystems."/var/lib/longhorn-disk2" = { device = "/dev/disk/by-uuid/ddd"; fsType = "ext4"; };',
    "}",
  ].join("\n"),
  "utf8",
);

/** hosts/control-plane + hosts/worker-gpu: carry the file AND import it. */
const carriesFile = join(fx, "hosts/control-plane");
mkdirSync(carriesFile, { recursive: true });
writeFileSync(join(carriesFile, "configuration.nix"), "imports = [ ./hardware-configuration.nix ];\n", "utf8");
writeFileSync(join(carriesFile, "hardware-configuration.nix"), "# PLACEHOLDER\n", "utf8");

/** A host that imports the file but does not carry it -- the flake cannot eval. */
const importsButMissing = join(fx, "hosts/broken");
mkdirSync(importsButMissing, { recursive: true });
writeFileSync(join(importsButMissing, "configuration.nix"), "imports = [ ./hardware-configuration.nix ];\n", "utf8");

/** hosts/worker-template: disko-shaped -- no file, no import. */
const diskoHost = join(fx, "hosts/worker-template");
mkdirSync(diskoHost, { recursive: true });
writeFileSync(
  join(diskoHost, "default.nix"),
  "imports = [ inputs.disko.nixosModules.disko ../../modules/disko-shapes/longhorn-node.nix ];\n",
  "utf8",
);

function plan(src: string, hostDir: string): string {
  return runShell(`zeta_hwcap_plan ${JSON.stringify(src)} ${JSON.stringify(hostDir)} ${JSON.stringify(join(hostDir, "hardware-configuration.nix"))}`);
}

function verify(file: string, ...mounts: string[]): string[] {
  const args = mounts.map((m) => JSON.stringify(m)).join(" ");
  const out = runShell(`zeta_hwcap_verify ${JSON.stringify(file)} ${args}`);
  return out === "" ? [] : out.split("\n");
}

describe("zeta_hwcap_plan -- the verdict is total and fails closed", () => {
  test("a host that carries the file gets COPY", () => {
    expect(plan(probe, carriesFile)).toBe("COPY");
  });

  test("no probe output at all REFUSES -- it never falls through to the placeholder", () => {
    expect(plan(join(fx, "etc/nixos/does-not-exist.nix"), carriesFile)).toBe(
      "REFUSE no-generated-config",
    );
  });

  test("an unknown flake host REFUSES rather than warning about a path it cannot write", () => {
    expect(plan(probe, join(fx, "hosts/ghost"))).toBe("REFUSE no-host-dir");
  });

  test("a host importing a hardware-configuration.nix it does not carry REFUSES", () => {
    expect(plan(probe, importsButMissing)).toBe("REFUSE host-imports-missing-file");
  });

  test("a disko-shaped host that imports none is the ONE legitimate non-copy", () => {
    // Established by READING the host tree, not assumed from a missing file --
    // which is the difference between this SKIP and the old blanket WARN.
    expect(plan(probe, diskoHost)).toBe("SKIP host-declares-own-filesystems");
  });

  test("every verdict is one non-empty line -- a blank verdict is the failure class", () => {
    for (const hostDir of [carriesFile, importsButMissing, diskoHost, join(fx, "hosts/ghost")]) {
      for (const src of [probe, join(fx, "nope.nix")]) {
        const v = plan(src, hostDir);
        expect(v.length).toBeGreaterThan(0);
        expect(v.split("\n")).toHaveLength(1);
      }
    }
  });
});

describe("zeta_hwcap_verify -- the check is on the CONTENT, not on cp's exit code", () => {
  test("a real generated config declaring every mounted path passes", () => {
    expect(verify(probe, "/var/lib/longhorn-disk1", "/var/lib/longhorn-disk2")).toEqual(["OK"]);
  });

  test("a path the config does not declare is reported by name", () => {
    expect(verify(probe, "/var/lib/longhorn-disk1", "/var/lib/longhorn-disk3")).toEqual([
      "MISSING /var/lib/longhorn-disk3",
    ]);
  });

  test("an absent file reports every mountpoint missing rather than passing quietly", () => {
    expect(verify(join(fx, "nope.nix"), "/var/lib/longhorn-disk1")).toEqual([
      "MISSING /var/lib/longhorn-disk1",
    ]);
  });

  test("THE BUG: each committed placeholder fails verification for a Longhorn mount", () => {
    // Non-vacuity, measured against the real artifacts rather than a fixture.
    // These two files are the ones a failed capture used to leave installed.
    for (const host of ["control-plane", "worker-gpu"]) {
      const committed = join(HOSTS_DIR, host, "hardware-configuration.nix");
      const text = readFileSync(committed, "utf8");
      // The placeholders are CORRECT as committed state -- they exist so
      // `nix flake check` can evaluate an unprovisioned host. What is wrong is
      // installing one on a node whose Longhorn partitions are live.
      expect(text).toContain('fileSystems."/"');
      expect(verify(committed, "/var/lib/longhorn-disk1")).toEqual([
        "MISSING /var/lib/longhorn-disk1",
      ]);
    }
  });
});

/**
 * Comment and blank lines stripped. The properties below are about what the
 * installer DOES, and both this file and the installer's own header quote the
 * old fallback verbatim -- scanning the raw text would let the documentation
 * trip a check that is about the code.
 */
function executableLines(shell: string): string {
  return shell
    .split("\n")
    .filter((l) => !/^\s*#/.test(l) && l.trim() !== "")
    .join("\n");
}

describe("the call site -- a correct decision nobody acts on is not a guard", () => {
  const callSite = installSh.slice(installSh.indexOf('HW_SRC="/mnt/etc/nixos/hardware-configuration.nix"'));
  const callSiteCode = executableLines(callSite);

  test("the WARN-and-continue fallback is gone from zeta-install.sh", () => {
    expect(executableLines(installSh)).not.toContain("WARN: hardware-configuration not copied");
    // The prose account of it must survive, though: a fix whose reason has been
    // deleted is a fix the next edit reverts.
    expect(installSh).toContain("WARN: hardware-configuration not copied");
  });

  test("the installer calls the extracted decision function rather than re-deciding inline", () => {
    expect(installSh).toContain('HW_PLAN="$(zeta_hwcap_plan "$HW_SRC" "$HOST_DIR" "$HW_DST")"');
    expect(installSh).toContain('HW_MISSING="$(zeta_hwcap_verify "$HW_DST" "${LONGHORN_MOUNTS[@]}")"');
  });

  test("every REFUSE verdict the function can emit has a bail arm at the call site", () => {
    const emitted = [...extractCaptureBlock().matchAll(/echo "(REFUSE [a-z-]+)"/g)].map((m) => m[1]);
    expect(emitted.length).toBeGreaterThanOrEqual(3);
    for (const verdict of emitted) {
      const arm = callSiteCode.indexOf(`"${verdict}")`);
      expect(arm).toBeGreaterThan(-1);
      const armBody = callSiteCode.slice(arm, callSiteCode.indexOf(";;", arm));
      expect(armBody).toContain("bail ");
    }
  });

  test("an unrecognised verdict refuses too -- the default arm is not a fall-through", () => {
    const dflt = callSiteCode.indexOf("\n  *)");
    expect(dflt).toBeGreaterThan(-1);
    expect(callSiteCode.slice(dflt, callSiteCode.indexOf(";;", dflt))).toContain("bail ");
  });

  test("a content mismatch bails rather than logging", () => {
    expect(callSiteCode).toContain('if [ "$HW_MISSING" != "OK" ]; then');
    const idx = callSiteCode.indexOf('if [ "$HW_MISSING" != "OK" ]; then');
    expect(callSiteCode.slice(idx, callSiteCode.indexOf("\n    fi", idx))).toContain("bail ");
  });

  test("the SKIP arm is LOUD on stdout and names the boot-time check that still has teeth", () => {
    const arm = callSiteCode.indexOf('"SKIP host-declares-own-filesystems")');
    expect(arm).toBeGreaterThan(-1);
    const armBody = callSiteCode.slice(arm, callSiteCode.indexOf(";;", arm));
    // Not a bail: a disko host genuinely has nothing for the probe to replace.
    // But not a lone `>&2` WARN either -- that is what this whole change is against.
    expect(armBody).toContain("NOTICE");
    expect(armBody).toContain("ZETA_LONGHORN_PREFLIGHT_OK");
    expect(armBody).not.toContain(">&2");
  });
});

describe("LONGHORN_MOUNTS is DERIVED from what the install mounted", () => {
  test("it is seeded at the mount step and appended to per data disk", () => {
    // A restated roster drifts from the mounts; deriving it at the one place
    // that mounts is what keeps the Step 6 check honest.
    expect(installSh).toContain('LONGHORN_MOUNTS=("/var/lib/longhorn-disk1")');
    expect(installSh).toContain('LONGHORN_MOUNTS+=("${mp#/mnt}")');
  });

  test("it is seeded BEFORE the capture check consumes it", () => {
    expect(installSh.indexOf('LONGHORN_MOUNTS=("/var/lib/longhorn-disk1")')).toBeLessThan(
      installSh.indexOf('zeta_hwcap_verify "$HW_DST"'),
    );
  });

  test("the /mnt prefix is stripped -- the installed node's view, not the installer's", () => {
    // `nixos-generate-config --root /mnt` writes mountpoints without /mnt, so a
    // roster carrying /mnt would make every grep miss and every install refuse.
    expect(installSh).not.toContain('LONGHORN_MOUNTS+=("$mp")');
  });
});
