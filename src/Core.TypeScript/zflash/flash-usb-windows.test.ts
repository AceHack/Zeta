/**
 * src/Core.TypeScript/zflash/flash-usb-windows.test.ts
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
  // SSH-key injection surface
  ESP_PUBKEY_FILENAME,
  ESP_GPT_TYPE_GUID,
  validatePubkeyContent,
  pubkeyFileContent,
  resolveSshPubkey,
  parseGetPartitionJson,
  isEspLike,
  selectEspPartition,
  firstFreeDriveLetter,
  psGetPartitionScript,
  diskpartAssignScript,
  diskpartRemoveLetterScript,
  psAddAccessPathAssignScript,
  injectPubkeyIntoEsp,
  type PubkeyFsLike,
  type CommandRunner,
  type WinPartition,
} from "./flash-usb-windows.ts";

const VALID_ED25519 = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIabc123def456ghi789jkl012mno345pqr678stu90 zeta@operator";

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

  // NOTE: this pins the SHARED bounds (./size-bounds.ts) against literals, so a
  // value change has to be made deliberately in two places. It is not a parity
  // check and never was -- under its old name, "rails match the macOS tool's
  // size bounds", it imported no macOS module and compared this file's own copy
  // to these same literals, so it could not have caught the cross-arm drift it
  // was named for. Parity is now structural: there is one definition.
  test("the shared size bounds still hold their intended values", () => {
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

// ── SSH-key injection ────────────────────────────────────────────────

describe("validatePubkeyContent()", () => {
  test("accepts a well-formed ed25519 public key with comment", () => {
    expect(validatePubkeyContent(VALID_ED25519).ok).toBe(true);
  });
  test("accepts rsa / ecdsa / sk- key types", () => {
    expect(validatePubkeyContent("ssh-rsa AAAAB3NzaC1yc2EAAAAabcdef user@h").ok).toBe(true);
    expect(validatePubkeyContent("ecdsa-sha2-nistp256 AAAAE2VjZHNhabc x").ok).toBe(true);
    expect(validatePubkeyContent("sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1abc y").ok).toBe(true);
  });
  test("tolerates CRLF and surrounding whitespace", () => {
    expect(validatePubkeyContent(`\r\n  ${VALID_ED25519}  \r\n`).ok).toBe(true);
  });
  test("REJECTS a private key (the worst footgun)", () => {
    const priv = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk=\n-----END OPENSSH PRIVATE KEY-----";
    const r = validatePubkeyContent(priv);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("PRIVATE");
  });
  test("rejects empty, multi-key, unknown-type, and non-base64 blobs", () => {
    expect(validatePubkeyContent("").ok).toBe(false);
    expect(validatePubkeyContent("   \n  ").ok).toBe(false);
    expect(validatePubkeyContent(`${VALID_ED25519}\n${VALID_ED25519}`).ok).toBe(false);
    expect(validatePubkeyContent("ssh-banana AAAAB x").ok).toBe(false);
    expect(validatePubkeyContent("ssh-ed25519 not!base64! x").ok).toBe(false);
    expect(validatePubkeyContent("ssh-ed25519").ok).toBe(false);
  });
});

describe("pubkeyFileContent()", () => {
  test("normalizes to LF body with exactly one trailing newline", () => {
    expect(pubkeyFileContent(VALID_ED25519)).toBe(`${VALID_ED25519}\n`);
    expect(pubkeyFileContent(`${VALID_ED25519}\r\n`)).toBe(`${VALID_ED25519}\n`);
    expect(pubkeyFileContent(`${VALID_ED25519}\n\n\n`)).toBe(`${VALID_ED25519}\n`);
    expect(pubkeyFileContent(VALID_ED25519).includes("\r")).toBe(false);
  });
});

describe("resolveSshPubkey()", () => {
  const home = "/home/op";
  const fsWith = (files: Record<string, string>): PubkeyFsLike => ({
    exists: (p) => p in files,
    read: (p) => files[p]!,
  });

  test("explicit --ssh-key path wins and is validated", () => {
    const r = resolveSshPubkey("/keys/mine.pub", home, fsWith({ "/keys/mine.pub": VALID_ED25519 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe("/keys/mine.pub");
  });
  test("explicit missing path is an error", () => {
    const r = resolveSshPubkey("/nope.pub", home, fsWith({}));
    expect(r.ok).toBe(false);
  });
  test("explicit private key is rejected (not silently passed through)", () => {
    const r = resolveSshPubkey("/keys/priv", home, fsWith({ "/keys/priv": "-----BEGIN OPENSSH PRIVATE KEY-----\nx\n-----END OPENSSH PRIVATE KEY-----" }));
    expect(r.ok).toBe(false);
  });
  test("default search prefers id_ed25519.pub over id_rsa.pub", () => {
    const r = resolveSshPubkey(undefined, home, fsWith({
      [join(home, ".ssh/id_ed25519.pub")]: VALID_ED25519,
      [join(home, ".ssh/id_rsa.pub")]: "ssh-rsa AAAAB other key",
    }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(join(home, ".ssh/id_ed25519.pub"));
  });
  test("falls back to id_rsa.pub when ed25519 absent", () => {
    const r = resolveSshPubkey(undefined, home, fsWith({ [join(home, ".ssh/id_rsa.pub")]: "ssh-rsa AAAAB k u" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(join(home, ".ssh/id_rsa.pub"));
  });
  test("no key anywhere → actionable error mentioning ssh-keygen + --no-inject", () => {
    const r = resolveSshPubkey(undefined, home, fsWith({}));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("ssh-keygen");
      expect(r.message).toContain("--no-inject");
    }
  });
});

describe("parseGetPartitionJson() + isEspLike() + selectEspPartition()", () => {
  // A realistic isohybrid USB: big ISO9660 data region + tiny FAT ESP.
  const gptUsb = JSON.stringify([
    { PartitionNumber: 1, Size: 1_600_000_000, Type: "Unknown", GptType: "{ebd0a0a2-b9e5-4433-87c0-68b6b72699c7}", DriveLetter: null, IsHidden: true },
    { PartitionNumber: 2, Size: 3_145_728, Type: "System", GptType: `{${ESP_GPT_TYPE_GUID.toUpperCase()}}`, DriveLetter: null, IsHidden: false },
  ]);
  const mbrUsb = JSON.stringify([
    { PartitionNumber: 1, Size: 1_600_000_000, Type: "Unknown", MbrType: 0, DriveLetter: null },
    { PartitionNumber: 2, Size: 3_145_728, Type: "Unknown", MbrType: 239 /* 0xEF */, DriveLetter: "S" },
  ]);

  test("ConvertTo-Json single-object form normalizes to an array", () => {
    const one = parseGetPartitionJson(JSON.stringify({ PartitionNumber: 1, Size: 100, Type: "FAT32", DriveLetter: "E" }));
    expect(one).toHaveLength(1);
    expect(one[0]!.driveLetter).toBe("E");
  });
  test("empty input yields no partitions (not a throw)", () => {
    expect(parseGetPartitionJson("")).toEqual([]);
  });
  test("isEspLike picks the GPT ESP by type GUID (case/braces-insensitive)", () => {
    const parts = parseGetPartitionJson(gptUsb);
    expect(isEspLike(parts[0]!)).toBe(false);
    expect(isEspLike(parts[1]!)).toBe(true);
    expect(parts[1]!.gptType).toBe(ESP_GPT_TYPE_GUID);
  });
  test("isEspLike picks the MBR 0xEF partition", () => {
    const parts = parseGetPartitionJson(mbrUsb);
    expect(isEspLike(parts[1]!)).toBe(true);
    expect(parts[1]!.driveLetter).toBe("S");
  });
  test("selectEspPartition chooses the tiny FAT ESP, never the 1.5 GiB data region", () => {
    const g = selectEspPartition(parseGetPartitionJson(gptUsb));
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.partition.number).toBe(2);
    const m = selectEspPartition(parseGetPartitionJson(mbrUsb));
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.partition.number).toBe(2);
  });
  test("size-heuristic fallback when no explicit EFI signal", () => {
    const noSignal = JSON.stringify([
      { PartitionNumber: 1, Size: 1_600_000_000, Type: "Unknown", MbrType: 0, DriveLetter: null },
      { PartitionNumber: 2, Size: 50_000_000, Type: "Unknown", MbrType: 0, DriveLetter: null },
    ]);
    const s = selectEspPartition(parseGetPartitionJson(noSignal));
    expect(s.ok).toBe(true);
    if (s.ok) expect(s.partition.number).toBe(2);
  });
  test("refuses when nothing plausible (all huge)", () => {
    const huge = JSON.stringify([{ PartitionNumber: 1, Size: 2_000_000_000, Type: "Unknown", MbrType: 0, DriveLetter: null }]);
    expect(selectEspPartition(parseGetPartitionJson(huge)).ok).toBe(false);
  });
});

describe("firstFreeDriveLetter()", () => {
  test("returns first of S..Z not in use", () => {
    expect(firstFreeDriveLetter([])).toBe("S");
    expect(firstFreeDriveLetter(["S", "T"])).toBe("U");
    expect(firstFreeDriveLetter(["s:", "T", "u"])).toBe("V");
  });
  test("throws if S..Z all taken", () => {
    expect(() => firstFreeDriveLetter("STUVWXYZ".split(""))).toThrow();
  });
});

describe("ESP-mount script builders", () => {
  test("diskpart assign/remove scripts target the right disk+partition with CRLF", () => {
    expect(diskpartAssignScript(2, 2, "S")).toBe("select disk 2\r\nselect partition 2\r\nassign letter=S");
    expect(diskpartRemoveLetterScript(2, 2, "S")).toContain("remove letter=S");
  });
  test("Add-PartitionAccessPath script is well-formed", () => {
    expect(psAddAccessPathAssignScript(2, 2)).toBe("Add-PartitionAccessPath -DiskNumber 2 -PartitionNumber 2 -AssignDriveLetter");
  });
  test("psGetPartitionScript selects the fields the parser reads", () => {
    const s = psGetPartitionScript(2);
    for (const f of ["PartitionNumber", "GptType", "MbrType", "DriveLetter"]) expect(s).toContain(f);
  });
});

describe("injectPubkeyIntoEsp() — full orchestration via a fake runner", () => {
  // A fake runner that simulates: Get-Partition, diskpart assign (mounts a
  // letter), and an in-memory ESP filesystem for write/read-back.
  function makeFakeRunner(opts: {
    partitions: WinPartition[];
    autoLetter?: string; // if the ESP already has a drive letter
    diskpartWorks?: boolean;
    corruptWrite?: boolean; // simulate a bad read-back (silent-failure guard)
  }): { runner: CommandRunner; files: Map<string, string>; calls: string[] } {
    const files = new Map<string, string>();
    const calls: string[] = [];
    let assigned: string | null = opts.autoLetter ?? null;
    const partJson = () =>
      JSON.stringify(
        opts.partitions.map((p) => ({
          PartitionNumber: p.number,
          Size: p.size,
          Type: p.type,
          GptType: p.gptType ? `{${p.gptType}}` : null,
          MbrType: p.mbrType,
          DriveLetter: assigned && isEsp(p) ? assigned : p.driveLetter || null,
          IsHidden: p.isHidden,
        })),
      );
    const isEsp = (p: WinPartition) => isEspLike(p);
    const runner: CommandRunner = {
      ps(script: string): string {
        calls.push(`ps:${script.slice(0, 28)}`);
        if (script.startsWith("Get-Partition")) return partJson();
        if (script.includes("Get-Volume")) return "C"; // used letters
        if (script.startsWith("Add-PartitionAccessPath")) {
          assigned = "V";
          return "";
        }
        return "";
      },
      diskpart(script: string): string {
        calls.push(`diskpart:${script.split("\r\n").pop()}`);
        if (!opts.diskpartWorks) throw new Error("diskpart refused");
        if (script.includes("assign letter=")) assigned = script.split("assign letter=")[1]!.trim();
        if (script.includes("remove letter=")) assigned = null;
        return "";
      },
      writeFile(path: string, content: string): void {
        calls.push(`write:${path}`);
        files.set(path, opts.corruptWrite ? content.slice(0, 5) : content);
      },
      readFile(path: string): string {
        if (!files.has(path)) throw new Error("not found");
        return files.get(path)!;
      },
    };
    return { runner, files, calls };
  }

  const espGpt: WinPartition = {
    number: 2,
    size: 3_145_728,
    type: "System",
    gptType: ESP_GPT_TYPE_GUID,
    mbrType: null,
    driveLetter: "",
    isHidden: false,
  };
  const dataRegion: WinPartition = {
    number: 1,
    size: 1_600_000_000,
    type: "Unknown",
    gptType: "ebd0a0a2-b9e5-4433-87c0-68b6b72699c7",
    mbrType: null,
    driveLetter: "",
    isHidden: true,
  };

  test("auto-mounted removable FAT: writes + verifies, no diskpart assign needed", () => {
    const { runner, files, calls } = makeFakeRunner({ partitions: [dataRegion, espGpt], autoLetter: "E" });
    const r = injectPubkeyIntoEsp(runner, 3, VALID_ED25519);
    expect(r.ok).toBe(true);
    expect(r.verified).toBe(true);
    expect(r.driveLetter).toBe("E");
    expect(files.get(`E:\\${ESP_PUBKEY_FILENAME}`)).toBe(`${VALID_ED25519}\n`);
    expect(calls.some((c) => c.startsWith("diskpart:assign"))).toBe(false);
  });

  test("hidden ESP: mounts via diskpart, writes, verifies, then unmounts", () => {
    const { runner, files, calls } = makeFakeRunner({ partitions: [dataRegion, espGpt], diskpartWorks: true });
    const r = injectPubkeyIntoEsp(runner, 3, VALID_ED25519);
    expect(r.ok).toBe(true);
    expect(r.assignedLetter).toBe(true);
    expect([...files.values()][0]).toBe(`${VALID_ED25519}\n`);
    expect(calls.some((c) => c.startsWith("diskpart:assign"))).toBe(true);
    expect(calls.some((c) => c.startsWith("diskpart:remove"))).toBe(true);
  });

  test("diskpart refuses → falls back to Add-PartitionAccessPath", () => {
    const { runner, calls } = makeFakeRunner({ partitions: [dataRegion, espGpt], diskpartWorks: false });
    const r = injectPubkeyIntoEsp(runner, 3, VALID_ED25519);
    expect(r.ok).toBe(true);
    expect(r.driveLetter).toBe("V");
    expect(calls.some((c) => c.startsWith("ps:Add-PartitionAccessPath"))).toBe(true);
  });

  test("corrupt write is caught by read-back verify → ok=false (NO silent green)", () => {
    const { runner } = makeFakeRunner({ partitions: [dataRegion, espGpt], autoLetter: "E", corruptWrite: true });
    const r = injectPubkeyIntoEsp(runner, 3, VALID_ED25519);
    expect(r.ok).toBe(false);
    expect(r.verified).toBe(false);
    expect(r.message).toContain("re-flash");
  });

  test("no ESP on disk → ok=false with a diagnostic", () => {
    const { runner } = makeFakeRunner({ partitions: [dataRegion] /* only the huge data region */ });
    // make the lone partition truly non-ESP + too big for the size fallback
    const r = injectPubkeyIntoEsp(runner, 3, VALID_ED25519);
    expect(r.ok).toBe(false);
  });
});
