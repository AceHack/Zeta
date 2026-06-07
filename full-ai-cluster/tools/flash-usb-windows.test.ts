/**
 * full-ai-cluster/tools/flash-usb-windows.test.ts
 *
 * Runs on ANY OS (bun test). Validates the dangerous decision logic of
 * the Windows flasher — device selection, safety rails, the confirm
 * nonce, the PowerShell command construction, and (critically) the raw
 * byte-copy that actually writes the image — without needing a Windows
 * box or a real USB stick.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MIN_USB_BYTES,
  MAX_USB_BYTES,
  MIN_ISO_BYTES,
  MAX_ISO_BYTES,
  parseGetDiskJson,
  selectUsbCandidate,
  validateIso,
  physicalDrivePath,
  buildShortChallenge,
  makeNonce,
  psGetDiskScript,
  psIsAdminScript,
  psSetReadonlyScript,
  psSetOfflineScript,
  psListVolumesScript,
  copyImageToDevice,
  autoDiscoverIso,
  human,
  type WinDisk,
} from "./flash-usb-windows.ts";

const GiB = 1024 * 1024 * 1024;

function disk(p: Partial<WinDisk>): WinDisk {
  return {
    number: 0,
    friendlyName: "Generic USB",
    serialNumber: "SER123",
    busType: "USB",
    size: 32 * GiB,
    isBoot: false,
    isSystem: false,
    isReadOnly: false,
    operationalStatus: "Online",
    partitionStyle: "MBR",
    ...p,
  };
}

describe("parseGetDiskJson", () => {
  test("parses a single-disk object (ConvertTo-Json non-array)", () => {
    const json = JSON.stringify({
      Number: 2,
      FriendlyName: "SanDisk Ultra",
      SerialNumber: "ABC",
      BusType: "USB",
      Size: 32 * GiB,
      IsBoot: false,
      IsSystem: false,
      IsReadOnly: false,
      OperationalStatus: "Online",
      PartitionStyle: "MBR",
    });
    const d = parseGetDiskJson(json);
    expect(d).toHaveLength(1);
    expect(d[0]!.number).toBe(2);
    expect(d[0]!.busType).toBe("USB");
    expect(d[0]!.size).toBe(32 * GiB);
  });

  test("parses a multi-disk array + flattens {value} enum objects", () => {
    const json = JSON.stringify([
      { Number: 0, BusType: "NVMe", Size: 1024 * GiB, IsBoot: true, IsSystem: true },
      { Number: 1, BusType: { value: "USB" }, Size: 16 * GiB, OperationalStatus: { value: "Online" } },
    ]);
    const d = parseGetDiskJson(json);
    expect(d).toHaveLength(2);
    expect(d[1]!.busType).toBe("USB"); // flattened from { value: "USB" }
    expect(d[1]!.operationalStatus).toBe("Online");
    expect(d[0]!.isBoot).toBe(true);
  });
});

describe("selectUsbCandidate — safety rails", () => {
  test("picks the single eligible USB disk", () => {
    const sel = selectUsbCandidate([
      disk({ number: 0, busType: "NVMe", size: 1024 * GiB, isBoot: true, isSystem: true }),
      disk({ number: 2, busType: "USB", size: 32 * GiB }),
    ]);
    expect(sel.ok).toBe(true);
    if (sel.ok) expect(sel.disk.number).toBe(2);
  });

  test("REFUSES the system/boot disk even if it were USB", () => {
    const sel = selectUsbCandidate([disk({ number: 0, busType: "USB", isBoot: true, isSystem: true })]);
    expect(sel.ok).toBe(false);
  });

  test("REFUSES non-USB disks (internal SATA/NVMe)", () => {
    const sel = selectUsbCandidate([disk({ number: 0, busType: "SATA" }), disk({ number: 1, busType: "NVMe" })]);
    expect(sel.ok).toBe(false);
  });

  test("REFUSES an oversize external drive (e.g. 4 TB SSD)", () => {
    const sel = selectUsbCandidate([disk({ number: 3, busType: "USB", size: 4096 * GiB })]);
    expect(sel.ok).toBe(false);
    if (!sel.ok) expect(sel.code).toBe(2);
  });

  test("REFUSES an undersize device below the floor", () => {
    const sel = selectUsbCandidate([disk({ number: 3, busType: "USB", size: 1 * GiB })]);
    expect(sel.ok).toBe(false);
  });

  test("REFUSES when MORE THAN ONE USB candidate is present", () => {
    const sel = selectUsbCandidate([
      disk({ number: 2, busType: "USB", size: 32 * GiB }),
      disk({ number: 3, busType: "USB", size: 64 * GiB }),
    ]);
    expect(sel.ok).toBe(false);
    if (!sel.ok) expect(sel.message).toContain("multiple USB candidates");
  });

  test("REFUSES when there is NO USB candidate", () => {
    const sel = selectUsbCandidate([disk({ number: 0, busType: "NVMe", isBoot: true, isSystem: true })]);
    expect(sel.ok).toBe(false);
  });

  test("rails match the macOS tool's size bounds", () => {
    expect(MIN_USB_BYTES).toBe(4 * GiB);
    expect(MAX_USB_BYTES).toBe(256 * GiB);
    expect(MIN_ISO_BYTES).toBe(200 * 1024 * 1024);
    expect(MAX_ISO_BYTES).toBe(8 * GiB);
  });
});

describe("validateIso", () => {
  test("accepts a valid .iso of sane size", () => {
    expect(validateIso("C:/Users/x/Downloads/zeta-installer-25.11.iso", 1500 * 1024 * 1024, true).ok).toBe(true);
  });
  test("rejects wrong extension", () => {
    expect(validateIso("foo.img", 1500 * 1024 * 1024, true).ok).toBe(false);
  });
  test("rejects too-small / too-large / non-file", () => {
    expect(validateIso("a.iso", 1024, true).ok).toBe(false);
    expect(validateIso("a.iso", 20 * GiB, true).ok).toBe(false);
    expect(validateIso("a.iso", 1500 * 1024 * 1024, false).ok).toBe(false);
  });
});

describe("nonce + device path + PowerShell builders", () => {
  test("physicalDrivePath formats \\\\.\\PhysicalDriveN and rejects bad input", () => {
    expect(physicalDrivePath(2)).toBe("\\\\.\\PhysicalDrive2");
    expect(() => physicalDrivePath(-1)).toThrow();
    expect(() => physicalDrivePath(1.5)).toThrow();
  });
  test("makeNonce yields 4 lowercase hex; challenge wraps it", () => {
    const n = makeNonce(() => 0.5); // deterministic
    expect(n).toMatch(/^[0-9a-f]{4}$/);
    expect(buildShortChallenge(n)).toBe(`yes ${n}`);
    expect(() => buildShortChallenge("xyz")).toThrow();
  });
  test("PS scripts embed the right disk number + flags", () => {
    expect(psGetDiskScript()).toContain("Get-Disk");
    expect(psGetDiskScript()).toContain("ConvertTo-Json");
    expect(psIsAdminScript()).toContain("Administrator");
    expect(psSetReadonlyScript(2, false)).toBe("Set-Disk -Number 2 -IsReadOnly $false");
    expect(psSetOfflineScript(2, true)).toBe("Set-Disk -Number 2 -IsOffline $true");
    expect(psSetOfflineScript(2, false)).toBe("Set-Disk -Number 2 -IsOffline $false");
    expect(psListVolumesScript(2)).toContain("Get-Partition -DiskNumber 2");
  });
});

describe("copyImageToDevice — the actual write path (byte-exact)", () => {
  test("copies all bytes and pads the final short block to a sector with zeros", () => {
    const dir = mkdtempSync(join(tmpdir(), "flashwin-"));
    const isoPath = join(dir, "fake.iso");
    const destPath = join(dir, "device.bin");
    // 5000 bytes -> with sector 512 the padded total is ceil(5000/512)*512 = 5120
    const isoBuf = Buffer.alloc(5000);
    for (let i = 0; i < isoBuf.length; i++) isoBuf[i] = (i * 7 + 3) & 0xff;
    writeFileSync(isoPath, isoBuf);
    writeFileSync(destPath, Buffer.alloc(0)); // pre-create so "r+" can open it

    const res = copyImageToDevice({ isoPath, destPath, chunkSize: 1024, sectorSize: 512 });

    expect(res.isoBytes).toBe(5000);
    expect(res.bytesWritten).toBe(5120); // padded up to a 512 multiple
    const out = readFileSync(destPath);
    expect(out.length).toBe(5120);
    expect(out.subarray(0, 5000).equals(isoBuf)).toBe(true); // image bytes intact
    expect(out.subarray(5000).every((b) => b === 0)).toBe(true); // tail zero-padded
  });

  test("no extra padding when the image is already a sector multiple", () => {
    const dir = mkdtempSync(join(tmpdir(), "flashwin-"));
    const isoPath = join(dir, "aligned.iso");
    const destPath = join(dir, "device2.bin");
    const isoBuf = Buffer.alloc(4096, 0xab); // exact multiple of 512
    writeFileSync(isoPath, isoBuf);
    writeFileSync(destPath, Buffer.alloc(0));

    const res = copyImageToDevice({ isoPath, destPath, chunkSize: 1024, sectorSize: 512 });
    expect(res.isoBytes).toBe(4096);
    expect(res.bytesWritten).toBe(4096);
    expect(readFileSync(destPath).equals(isoBuf)).toBe(true);
  });

  test("rejects a chunkSize that is not a multiple of the sector size", () => {
    expect(() =>
      copyImageToDevice({ isoPath: "x", destPath: "y", chunkSize: 1000, sectorSize: 512 }),
    ).toThrow();
  });
});

describe("autoDiscoverIso", () => {
  test("picks the NEWEST zeta-installer-*.iso, ignoring other files", () => {
    const dir = mkdtempSync(join(tmpdir(), "flashwin-dl-"));
    const older = join(dir, "zeta-installer-25.11.iso");
    const newer = join(dir, "zeta-installer-25.11-k3sfix.iso");
    writeFileSync(older, "x");
    writeFileSync(newer, "y");
    writeFileSync(join(dir, "some-other.iso"), "z"); // wrong prefix
    writeFileSync(join(dir, "notes.txt"), "z");
    // make `newer` newer by mtime
    utimesSync(older, new Date(1000), new Date(1000));
    utimesSync(newer, new Date(2000), new Date(2000));

    const found = autoDiscoverIso(dir);
    expect(found).toBe(newer);
  });

  test("returns null when Downloads has no matching ISO", () => {
    const dir = mkdtempSync(join(tmpdir(), "flashwin-empty-"));
    expect(autoDiscoverIso(dir)).toBeNull();
    expect(autoDiscoverIso(join(dir, "does-not-exist"))).toBeNull();
  });
});

describe("human() formatting", () => {
  test("formats bytes in IEC units", () => {
    expect(human(0)).toBe("0.00 B");
    expect(human(1536)).toBe("1.50 KiB");
    expect(human(32 * GiB)).toBe("32.00 GiB");
  });
});
