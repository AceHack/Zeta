import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type BlockDeviceFacts,
  evaluateUdevRules,
  mountSourcesOverAllOrders,
  nixpkgsDefaultIsoDevice,
  readInstallerMediumConfig,
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

function shipped(): { rules: string; isoDevice: string } {
  const nix = readFileSync(
    resolve(import.meta.dir, "../../../full-ai-cluster/usb-nixos-installer/nixos/modules/install-label-single-device.nix"),
    "utf8",
  );
  const cfg = readInstallerMediumConfig(nix, VOLUME_ID);
  // Upstream 60-persistent-storage.rules runs first; the module's rules land in 99-local.rules.
  return { rules: `${UPSTREAM_BY_LABEL_RULE}\n${cfg.rules}`, isoDevice: cfg.isoDevice };
}

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
