import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BASE_FILESYSTEMS_PRIORITY,
  type BlockDeviceFacts,
  effectOfFileSystemsDefinition,
  evaluateUdevRules,
  mountSourcesOverAllOrders,
  nixpkgsDefaultIsoDevice,
  readInstallerMediumConfig,
  readIsoPin,
  UPSTREAM_BY_LABEL_RULE,
  udevOrders,
} from "./install-medium-selection.ts";

// 081M3B7Z38Q087G0R003F9X7HM — the /iso mount source must not depend on the
// order udev processes the boot medium's block devices in.

const VOLUME_ID = "ZETA_INSTALL";

const iso = (extra: Record<string, string> = {}): Record<string, string> => ({
  ID_FS_USAGE: "filesystem",
  ID_FS_TYPE: "iso9660",
  ID_FS_LABEL: VOLUME_ID,
  ID_FS_LABEL_ENC: VOLUME_ID,
  ...extra,
});
const esp: Record<string, string> = {
  ID_FS_USAGE: "filesystem",
  ID_FS_TYPE: "vfat",
  ID_FS_LABEL: "EFIBOOT",
  ID_FS_LABEL_ENC: "EFIBOOT",
};

// The isohybrid stick (and QEMU usb-storage): MBR partition 1 at LBA 0 spans
// the image, so the whole disk AND partition 1 both probe as the iso9660.
const ISOHYBRID_USB: BlockDeviceFacts[] = [
  { kernel: "sda", devtype: "disk", env: iso({ ID_PART_TABLE_TYPE: "dos" }) },
  { kernel: "sda1", devtype: "partition", env: iso({ ID_PART_ENTRY_NUMBER: "1" }) },
  { kernel: "sda2", devtype: "partition", env: { ...esp, ID_PART_ENTRY_NUMBER: "2" } },
];
// The same image on NVMe/virtio naming.
const ISOHYBRID_NVME: BlockDeviceFacts[] = [
  { kernel: "nvme0n1", devtype: "disk", env: iso({ ID_PART_TABLE_TYPE: "dos" }) },
  { kernel: "nvme0n1p1", devtype: "partition", env: iso() },
  { kernel: "nvme0n1p2", devtype: "partition", env: esp },
];
// Optical media: the kernel never partitions sr*, but blkid can still see the
// isohybrid MBR and report a partition table on it.
const OPTICAL: BlockDeviceFacts[] = [{ kernel: "sr0", devtype: "disk", env: iso({ ID_PART_TABLE_TYPE: "dos" }) }];
// A plain iso9660 written to a stick with no MBR at all.
const PARTITIONLESS_USB: BlockDeviceFacts[] = [{ kernel: "sdb", devtype: "disk", env: iso() }];

const MODULE_PATH = resolve(
  import.meta.dir,
  "../../../full-ai-cluster/usb-nixos-installer/nixos/modules/install-label-single-device.nix",
);

function shipped(): { rules: string; isoDevice: string } {
  const nix = readFileSync(MODULE_PATH, "utf8");
  const cfg = readInstallerMediumConfig(nix, VOLUME_ID);
  // Upstream 60-persistent-storage.rules runs first; the module's rules land in 99-local.rules.
  return { rules: `${UPSTREAM_BY_LABEL_RULE}\n${cfg.rules}`, isoDevice: cfg.isoDevice };
}

// The module EXACTLY as PR #17751 shipped it on main (b82eced62f), trimmed to the two things
// the model reads: the rules and the pin. Run 36870188468 evaluated THIS and got by-label.
const MODULE_AS_SHIPPED_BY_17751 = [
  "{ config, lib, ... }:",
  "let",
  "  zetaInstallLabelOnePartition = ''",
  '    SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", ENV{ID_FS_LABEL}=="${config.isoImage.volumeID}", OPTIONS+="link_priority=-100"',
  '    SUBSYSTEM=="block", ENV{DEVTYPE}=="partition", ENV{ID_FS_TYPE}=="iso9660", ENV{ID_FS_LABEL}=="${config.isoImage.volumeID}", SYMLINK+="disk/zeta-install-medium"',
  '    SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", KERNEL=="sr*", ENV{ID_FS_TYPE}=="iso9660", ENV{ID_FS_LABEL}=="${config.isoImage.volumeID}", SYMLINK+="disk/zeta-install-medium"',
  '    SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", KERNEL!="sr*", ENV{ID_PART_TABLE_TYPE}!="?*", ENV{ID_FS_TYPE}=="iso9660", ENV{ID_FS_LABEL}=="${config.isoImage.volumeID}", SYMLINK+="disk/zeta-install-medium"',
  "  '';",
  "in",
  "{",
  "  boot.initrd.services.udev.rules = zetaInstallLabelOnePartition;",
  "  services.udev.extraRules = zetaInstallLabelOnePartition;",
  "",
  "  # mkForce (50) beats iso-image.nix's mkImageMediaOverride (60) on this one",
  "  # field; fsType, neededForBoot and noCheck stay as nixpkgs sets them.",
  '  fileSystems."/iso".device = lib.mkForce "/dev/disk/zeta-install-medium";',
  "}",
  "",
].join("\n");

describe("081M3B7Z38Q087G0R003F9X7HM — the model reproduces what run 36406378420 measured", () => {
  it("udev never processes a partition before its own disk", () => {
    const orders = udevOrders(ISOHYBRID_USB).map((o) => o.map((d) => d.kernel).join(","));
    expect(orders).toEqual(["sda,sda1,sda2", "sda,sda2,sda1"]);
  });

  it("by-label + link_priority on the whole disk is STILL order/timing dependent — the measured race", () => {
    // The mechanism PR #17695 shipped, restated here so this stays a statement
    // about that mechanism even after the module changes.
    const pr17695Rules = `${UPSTREAM_BY_LABEL_RULE}\n` +
      `SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", ENV{ID_FS_LABEL}=="${VOLUME_ID}", OPTIONS+="link_priority=-100"`;
    const sources = mountSourcesOverAllOrders(nixpkgsDefaultIsoDevice(VOLUME_ID), ISOHYBRID_USB, pr17695Rules);
    // Both outcomes are reachable: sda wins while it is the only claimant,
    // which is exactly when the systemd initrd starts the /iso mount.
    expect(sources).toEqual(["/dev/sda", "/dev/sda1"]);
  });

  it("the priority rule does rank the link once both claimants exist (it was right, just too late)", () => {
    const rule = `SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", ENV{ID_FS_LABEL}=="${VOLUME_ID}", OPTIONS+="link_priority=-100"`;
    expect(evaluateUdevRules(rule, ISOHYBRID_USB[0] as BlockDeviceFacts).linkPriority).toBe(-100);
    expect(evaluateUdevRules(rule, ISOHYBRID_USB[1] as BlockDeviceFacts).linkPriority).toBe(0);
  });
});

describe("081M3B7Z38Q087G0R003F9X7HM — the SHIPPED /iso device is chosen deterministically", () => {
  it("isohybrid USB: the LBA-0 partition, under every event order and mount timing", () => {
    const { rules, isoDevice } = shipped();
    expect(mountSourcesOverAllOrders(isoDevice, ISOHYBRID_USB, rules)).toEqual(["/dev/sda1"]);
  });

  it("isohybrid on nvme naming: the partition, never the namespace", () => {
    const { rules, isoDevice } = shipped();
    expect(mountSourcesOverAllOrders(isoDevice, ISOHYBRID_NVME, rules)).toEqual(["/dev/nvme0n1p1"]);
  });

  it("optical media: sr0 — even though blkid reports the isohybrid MBR on it", () => {
    const { rules, isoDevice } = shipped();
    expect(mountSourcesOverAllOrders(isoDevice, OPTICAL, rules)).toEqual(["/dev/sr0"]);
  });

  it("a stick with no partition table: the disk itself", () => {
    const { rules, isoDevice } = shipped();
    expect(mountSourcesOverAllOrders(isoDevice, PARTITIONLESS_USB, rules)).toEqual(["/dev/sdb"]);
  });

  it("the ESP and any other label never claim the /iso device", () => {
    const { rules, isoDevice } = shipped();
    const link = isoDevice.replace(/^\/dev\//u, "");
    expect(evaluateUdevRules(rules, ISOHYBRID_USB[2] as BlockDeviceFacts).symlinks).not.toContain(link);
    const other: BlockDeviceFacts = { kernel: "sdc1", devtype: "partition", env: iso({ ID_FS_LABEL: "OTHER", ID_FS_LABEL_ENC: "OTHER" }) };
    expect(evaluateUdevRules(rules, other).symlinks).not.toContain(link);
  });
});

// -- Run 36870188468: the fix that was in the source and not in the ISO -----------------------
//
// 3 of 5 WP11 USB runs after #17751 reported `boot-medium=/dev/sda`. The udev rules were right.
// The line that points /iso at the symlink they populate was discarded by the module system,
// so stage 1 kept mounting through by-label. These tests judge the module by what the merge
// does with it, which the earlier text-only checks could not.

describe("081M3B7Z38Q087G0R003F9X7HM — a pin the base DISCARDS is not a pin (run 36870188468)", () => {
  it("the module system keeps a fileSystems definition only at the base's own priority", () => {
    expect(BASE_FILESYSTEMS_PRIORITY).toBe(60); // installation-cd-base.nix:36, lib.mkImageMediaOverride
    expect(effectOfFileSystemsDefinition(100)).toBe("discarded"); // an undecorated definition
    expect(effectOfFileSystemsDefinition(1000)).toBe("discarded"); // mkDefault
    expect(effectOfFileSystemsDefinition(60)).toBe("merged"); // mkImageMediaOverride: both survive
    // mkForce on the whole attrset WINS, and deletes /, /nix/.ro-store, /nix/.rw-store with it.
    expect(effectOfFileSystemsDefinition(50)).toBe("replaces-base");
  });

  it("#17751's text is recognised as the defect: right device, default-priority definition, discarded", () => {
    const pin = readIsoPin(MODULE_AS_SHIPPED_BY_17751, VOLUME_ID);
    expect(pin.device).toBe("/dev/disk/zeta-install-medium"); // the text says the right thing
    expect(pin.form).toBe("nested-under-default-priority");
    expect(pin.optionPriority).toBe(100);
    expect(pin.effect).toBe("discarded"); // and it never reaches the fstab
  });

  it("the SHIPPED module pins /iso in a form the merge keeps (this is the line that was inert)", () => {
    const pin = readIsoPin(readFileSync(MODULE_PATH, "utf8"), VOLUME_ID);
    expect(pin.device).toBe("/dev/disk/zeta-install-medium");
    expect(pin.form).toBe("wrapped-at-option-priority");
    expect(pin.optionPriority).toBe(BASE_FILESYSTEMS_PRIORITY);
    expect(pin.effect).toBe("merged");
  });

  it("a comment QUOTING the old form is not read as a pin", () => {
    const quoted = [
      '# fileSystems."/iso".device = lib.mkForce "/dev/disk/zeta-install-medium";',
      "{ }",
    ].join("\n");
    expect(readIsoPin(quoted, VOLUME_ID).effect).toBe("no-pin");
  });

  it("REPRODUCES the failed run: with #17751's module the evaluated /iso is by-label and both sda AND sda1 are reachable", () => {
    const cfg = readInstallerMediumConfig(MODULE_AS_SHIPPED_BY_17751, VOLUME_ID);
    // What nix eval printed for the shipped ISO: the discarded pin left the nixpkgs default.
    expect(cfg.isoDevice).toBe(nixpkgsDefaultIsoDevice(VOLUME_ID));
    const rules = `${UPSTREAM_BY_LABEL_RULE}\n${cfg.rules}`;
    // The exact device layout of the failed run: sda (whole disk, dos PT, iso9660), sda1 (LBA-0 alias), sda2 (ESP).
    expect(mountSourcesOverAllOrders(cfg.isoDevice, ISOHYBRID_USB, rules)).toEqual(["/dev/sda", "/dev/sda1"]);
  });

  it("with the SHIPPED module, the same layout can only ever mount the partition", () => {
    const { rules, isoDevice } = shipped();
    expect(isoDevice).toBe("/dev/disk/zeta-install-medium");
    expect(mountSourcesOverAllOrders(isoDevice, ISOHYBRID_USB, rules)).toEqual(["/dev/sda1"]);
  });
});

describe("081M3B7Z38Q087G0R003F9X7HM — the claim rules, case by case", () => {
  it("a partition that carries the LABEL but is not iso9660 never claims (a stale or foreign FAT with our label)", () => {
    const { rules, isoDevice } = shipped();
    const link = isoDevice.replace(/^\/dev\//u, "");
    const fakeEsp: BlockDeviceFacts = {
      kernel: "sdb2",
      devtype: "partition",
      env: { ID_FS_USAGE: "filesystem", ID_FS_TYPE: "vfat", ID_FS_LABEL: VOLUME_ID, ID_FS_LABEL_ENC: VOLUME_ID },
    };
    expect(evaluateUdevRules(rules, fakeEsp).symlinks).not.toContain(link);
  });

  it("the whole disk of an isohybrid stick never claims, whatever its partition-table type", () => {
    const { rules, isoDevice } = shipped();
    const link = isoDevice.replace(/^\/dev\//u, "");
    for (const pt of ["dos", "gpt"]) {
      const disk: BlockDeviceFacts = { kernel: "sda", devtype: "disk", env: iso({ ID_PART_TABLE_TYPE: pt }) };
      expect(evaluateUdevRules(rules, disk).symlinks).not.toContain(link);
    }
  });

  it("a device-mapper or loop whole disk claims even with a partition table (nothing can partition it)", () => {
    const { rules, isoDevice } = shipped();
    const dm: BlockDeviceFacts[] = [{ kernel: "dm-0", devtype: "disk", env: iso({ ID_PART_TABLE_TYPE: "dos" }) }];
    const loop: BlockDeviceFacts[] = [{ kernel: "loop3", devtype: "disk", env: iso({ ID_PART_TABLE_TYPE: "dos" }) }];
    expect(mountSourcesOverAllOrders(isoDevice, dm, rules)).toEqual(["/dev/dm-0"]);
    expect(mountSourcesOverAllOrders(isoDevice, loop, rules)).toEqual(["/dev/loop3"]);
  });

  it("a real disk never takes the dm/loop shortcut: an isohybrid sda is still only ever sda1", () => {
    const { rules, isoDevice } = shipped();
    expect(mountSourcesOverAllOrders(isoDevice, ISOHYBRID_USB, rules)).not.toContain("/dev/sda");
  });

  it("an ISO WITHOUT the isohybrid MBR (aarch64: GPT whose only partition is the EFI image) leaves these rules with no claimant", () => {
    // This is why the module is gated: if the rules applied there, nothing would claim the
    // symlink and the /iso mount would wait out its timeout instead of falling back to by-label.
    const { rules, isoDevice } = shipped();
    const gptOnlyEsp: BlockDeviceFacts[] = [
      { kernel: "vda", devtype: "disk", env: iso({ ID_PART_TABLE_TYPE: "gpt" }) },
      { kernel: "vda1", devtype: "partition", env: esp },
    ];
    expect(mountSourcesOverAllOrders(isoDevice, gptOnlyEsp, rules)).toEqual(["<none>"]);
  });

  it("the module applies exactly when nixpkgs builds the isohybrid MBR (makeBiosBootable && makeUsbBootable)", () => {
    const { gate } = readInstallerMediumConfig(readFileSync(MODULE_PATH, "utf8"), VOLUME_ID);
    expect(gate).toBe("config.isoImage.makeBiosBootable && config.isoImage.makeUsbBootable");
  });
});
