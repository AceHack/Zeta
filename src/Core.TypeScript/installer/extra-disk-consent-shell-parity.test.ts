/**
 * extra-disk-consent-shell-parity.test.ts — 081M3K3DVBA087G0R002XTMMVW.
 *
 * MEASURED on the 2026-09-27 bare-metal reinstall (node-5b2dfa, two 931 GiB
 * NVMe): the installer put the OS + longhorn1 on one drive and wiped the WHOLE
 * other drive as /var/lib/longhorn-disk2 with no confirmation. Every non-boot
 * internal disk was adopted, whatever it held.
 *
 * The rule now: an extra disk is adopted when it probes BLANK (the documented
 * "add a drive for capacity" intent) or when the operator consents
 * (ZETA_LONGHORN_EXTRA_DISKS by device or serial, or a `y` keypress). A disk
 * that carries partitions / filesystems / labels, or could not be read, is left
 * untouched by default. The boot medium is never selected, consent or not.
 *
 * Fixtures run the REAL chain: fact record -> zeta_pf_classify (extracted from
 * ZETA-PREFLIGHT-PARITY) -> zeta_extra_disk_consent + zeta_extra_disk_decision
 * (extracted from ZETA-EXTRA-DISK), all under a real bash.
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SRC = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");

function marked(begin: string, end: string): string {
  const b = SRC.indexOf(begin);
  const e = SRC.indexOf(end);
  if (b < 0 || e < b) throw new Error(`${begin} / ${end} missing or out of order in zeta-install.sh`);
  return SRC.slice(b, e + end.length);
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-extra-disk-"));

/**
 * Runs classify over `facts`, then the consent + decision functions.
 * Returns "<disposition> <decision>".
 */
function decide(facts: string, opts: { list?: string; dev?: string; serial?: string; interactive?: boolean }): string {
  writeFileSync(
    join(workdir, "blocks.sh"),
    marked("# ZETA-PREFLIGHT-PARITY-BEGIN", "# ZETA-PREFLIGHT-PARITY-END") +
      "\n" +
      marked("# ZETA-EXTRA-DISK-BEGIN", "# ZETA-EXTRA-DISK-END") +
      "\n",
    "utf8",
  );
  writeFileSync(join(workdir, "facts"), facts, "utf8");
  writeFileSync(
    join(workdir, "runner.sh"),
    [
      "set -uo pipefail",
      // The classify block reads these label constants from the script's
      // top-level; mirror the real values rather than restating the logic.
      'ZETA_INSTALLER_VOLUME_LABEL="ZETA_INSTALL"',
      "source ./blocks.sh",
      "disp=$(zeta_pf_classify < facts)",
      `consent=$(zeta_extra_disk_consent '${opts.list ?? ""}' '${opts.dev ?? "/dev/nvme0n1"}' '${opts.serial ?? ""}')`,
      `echo "$disp $(zeta_extra_disk_decision "$disp" "$consent" ${opts.interactive === true ? "1" : "0"})"`,
      "",
    ].join("\n"),
    "utf8",
  );
  const r = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`bash exited ${String(r.status)}: ${r.stderr}`);
  return r.stdout.trim();
}

// Fact records in zeta_pf_gather's own shape (pttype= / part=name|fstype|label|partlabel / volumelabel=).
const BLANK = "pttype=\n";
const NTFS_DATA = "pttype=gpt\npart=/dev/nvme0n1p1|vfat|SYSTEM|EFI system partition\npart=/dev/nvme0n1p2|ntfs|Windows|Basic data partition\n";
const EXT4_DATA = "pttype=gpt\npart=/dev/nvme0n1p1|ext4|photos|\n";
const PRIOR_ZETA_LONGHORN2 = "pttype=gpt\npart=/dev/nvme0n1p1|ext4|longhorn2|longhorn2\n";
const UNREADABLE = "err=gather-failed\n";
const USB_BOOT_MEDIUM = "pttype=dos\nvolumelabel=ZETA_INSTALL\npart=/dev/sda1|iso9660|ZETA_INSTALL|\npart=/dev/sda2|vfat|ZETA_ESP|\n";

describe("extra-disk selection — fixtures through the real classify", () => {
  it("a BLANK extra disk is adopted with no consent (the documented add-a-drive intent)", () => {
    expect(decide(BLANK, {})).toBe("blank adopt");
  });

  it("an extra disk carrying NTFS data is LEFT UNTOUCHED by default", () => {
    expect(decide(NTFS_DATA, {})).toBe("foreign-data skip");
  });

  it("an extra disk carrying ext4 data is LEFT UNTOUCHED by default", () => {
    expect(decide(EXT4_DATA, {})).toBe("foreign-data skip");
  });

  it("a prior Zeta install's longhorn2 disk is not adopted without consent either — the reinstall case", () => {
    const [disp, decision] = decide(PRIOR_ZETA_LONGHORN2, {}).split(" ");
    expect(disp).not.toBe("blank");
    expect(decision).toBe("skip");
  });

  it("a disk that could not be read is not blank, and is left untouched", () => {
    expect(decide(UNREADABLE, {})).toBe("indeterminate skip");
  });

  it("on a real terminal a data-bearing disk is ASKED about, never silently taken", () => {
    expect(decide(NTFS_DATA, { interactive: true })).toBe("foreign-data ask");
  });

  it("the USB boot medium is NEVER selected — not by `all`, not by name, not interactively", () => {
    expect(decide(USB_BOOT_MEDIUM, { list: "all", dev: "/dev/sda" })).toBe("installer-medium skip");
    expect(decide(USB_BOOT_MEDIUM, { list: "/dev/sda", dev: "/dev/sda" })).toBe("installer-medium skip");
    expect(decide(USB_BOOT_MEDIUM, { interactive: true, dev: "/dev/sda" })).toBe("installer-medium skip");
  });
});

describe("extra-disk consent — ZETA_LONGHORN_EXTRA_DISKS", () => {
  it("naming the device adopts a data-bearing disk (zero-typing consent)", () => {
    expect(decide(EXT4_DATA, { list: "/dev/nvme0n1", dev: "/dev/nvme0n1" })).toBe("foreign-data adopt");
  });

  it("naming the SERIAL adopts it — serials survive nvme0/nvme1 renumbering between boots", () => {
    expect(decide(EXT4_DATA, { list: "2330E1A2B3C4", dev: "/dev/nvme1n1", serial: "2330E1A2B3C4" })).toBe(
      "foreign-data adopt",
    );
  });

  it("comma and space separated lists both work; a different disk's name does not consent", () => {
    expect(decide(EXT4_DATA, { list: "/dev/sdb,/dev/nvme0n1", dev: "/dev/nvme0n1" })).toBe("foreign-data adopt");
    expect(decide(EXT4_DATA, { list: "/dev/sdb /dev/sdc", dev: "/dev/nvme0n1" })).toBe("foreign-data skip");
  });

  it("`all` adopts every non-medium extra disk; `none` leaves even a blank one", () => {
    expect(decide(NTFS_DATA, { list: "all" })).toBe("foreign-data adopt");
    expect(decide(BLANK, { list: "none" })).toBe("blank skip");
  });

  it("an empty serial never matches an empty token", () => {
    expect(decide(EXT4_DATA, { list: ",,", dev: "/dev/nvme0n1", serial: "" })).toBe("foreign-data skip");
  });
});

describe("zeta-install.sh — wiring", () => {
  const code = SRC.split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");

  it("the consent step runs AFTER the R6 probe and BEFORE the R7 scope decision and the capacity check", () => {
    const probe = code.indexOf('>> "$ZETA_PF_DISPFILE"');
    const step = code.indexOf('zeta_extra_disk_decision "${d_disp:-indeterminate}"');
    const scope = code.indexOf('ZETA_SCOPE="$(zeta_pf_decide_scope');
    expect(probe).toBeGreaterThan(-1);
    expect(step).toBeGreaterThan(probe);
    expect(scope).toBeGreaterThan(step);
  });

  it("a left disk leaves DATA_DISKS AND the R7 wipe scope", () => {
    expect(code).toContain('DATA_DISKS=("${KEPT_DATA[@]+"${KEPT_DATA[@]}"}")');
    expect(code).toMatch(/sed -i "\\#\^\$\{d\}\|#d" "\$ZETA_PF_DISPFILE"/);
  });

  it("the keypress prompt is bounded and anything but y leaves the disk", () => {
    expect(code).toContain('read -r -n 1 -s -t "$ZETA_EXTRA_DISK_PROMPT_SECS" d_key');
    expect(code).toContain('case "$d_key" in y|Y) d_decision="adopt" ;; *) d_decision="skip" ;; esac');
  });
});
