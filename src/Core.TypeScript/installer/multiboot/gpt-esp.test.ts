import { describe, expect, it } from "bun:test";
import {
  DEFAULT_ESP_START_LBA,
  ESP_TYPE_GUID,
  GPT_ENTRY_COUNT,
  GPT_ENTRY_SIZE,
  GPT_HEADER_SIZE,
  MSFT_BASIC_DATA_TYPE_GUID,
  SECTOR_BYTES,
  assembleGptEspDisk,
  buildGptEspImageParts,
  crc32,
  decodeGuid,
  encodeGuid,
  gptWritePlan,
  planGptEspDisk,
} from "./gpt-esp.ts";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A 1 MiB stand-in for the FAT ESP. Content is irrelevant to the GPT. */
function fakeEsp(sizeBytes = 1024 * 1024): Uint8Array {
  const esp = new Uint8Array(sizeBytes);
  esp.fill(0x5a);
  return esp;
}

describe("crc32 (IEEE / zlib polynomial)", () => {
  // Published check values — an external anchor, not this file's own output.
  it("matches the standard check vectors", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new TextEncoder().encode("a"))).toBe(0xe8b7be43);
  });
});

describe("GUID mixed-endian encoding (UEFI 2.10 appendix A)", () => {
  it("encodes the ESP type GUID to the byte order firmware stores", () => {
    // 28 73 2a c1 1f f8 d2 11 ba 4b 00 a0 c9 3e c9 3b — the exact sequence a
    // hexdump of any real ESP entry shows. Independent of this file's decoder.
    expect(hex(encodeGuid(ESP_TYPE_GUID)!)).toBe("28732ac11ff8d211ba4b00a0c93ec93b");
  });

  it("round-trips", () => {
    expect(decodeGuid(encodeGuid(ESP_TYPE_GUID)!)).toBe(ESP_TYPE_GUID);
    expect(decodeGuid(encodeGuid(MSFT_BASIC_DATA_TYPE_GUID)!)).toBe(MSFT_BASIC_DATA_TYPE_GUID);
  });

  it("refuses malformed GUIDs rather than emitting silent garbage", () => {
    expect(encodeGuid("not-a-guid")).toBeNull();
    expect(encodeGuid("c12a7328-f81f-11d2-ba4b-00a0c93ec93")).toBeNull();
    expect(encodeGuid("")).toBeNull();
    expect(decodeGuid(new Uint8Array(15))).toBeNull();
  });
});

describe("planGptEspDisk", () => {
  it("reserves both GPT copies and places the ESP at 1 MiB", () => {
    const planned = planGptEspDisk({ espSizeBytes: 32 * 1024 * 1024 });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const l = planned.layout;
    expect(l.espStartLba).toBe(DEFAULT_ESP_START_LBA);
    expect(l.firstUsableLba).toBe(34);
    expect(l.espEndLba).toBe(2048 + 65536 - 1);
    expect(l.espEndLba).toBeLessThanOrEqual(l.lastUsableLba);
    expect(l.backupHeaderLba).toBe(l.totalSectors - 1);
    expect(l.totalBytes).toBe(l.totalSectors * SECTOR_BYTES);
  });

  it("refuses a partial-sector ESP instead of rounding it", () => {
    const planned = planGptEspDisk({ espSizeBytes: 1024 * 1024 + 1 });
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.error).toContain("whole number of 512-byte sectors");
  });

  it("refuses an ESP start that would overwrite the primary GPT copy", () => {
    const planned = planGptEspDisk({ espSizeBytes: 1024 * 1024, espStartLba: 33 });
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.error).toContain(">= 34");
  });

  it("refuses zero and negative sizes", () => {
    expect(planGptEspDisk({ espSizeBytes: 0 }).ok).toBe(false);
    expect(planGptEspDisk({ espSizeBytes: -512 }).ok).toBe(false);
  });
});

describe("buildGptEspImageParts", () => {
  const layout = (() => {
    const p = planGptEspDisk({ espSizeBytes: 1024 * 1024 });
    if (!p.ok) throw new Error(p.error);
    return p.layout;
  })();

  it("emits a protective MBR with type 0xEE and the 0x55AA signature", () => {
    const built = buildGptEspImageParts({ layout });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const mbr = built.parts.protectiveMbr;
    expect(mbr.length).toBe(SECTOR_BYTES);
    expect(mbr[0x1be + 4]).toBe(0xee);
    expect(mbr[510]).toBe(0x55);
    expect(mbr[511]).toBe(0xaa);
    const startLba = new DataView(mbr.buffer).getUint32(0x1be + 8, true);
    expect(startLba).toBe(1);
    const sizeLba = new DataView(mbr.buffer).getUint32(0x1be + 12, true);
    expect(sizeLba).toBe(layout.totalSectors - 1);
  });

  it("writes the ESP type GUID into entry 0 in firmware byte order", () => {
    const built = buildGptEspImageParts({ layout });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(decodeGuid(built.parts.entryArray.subarray(0, 16))).toBe(ESP_TYPE_GUID);
    const view = new DataView(built.parts.entryArray.buffer);
    expect(Number(view.getBigUint64(32, true))).toBe(layout.espStartLba);
    expect(Number(view.getBigUint64(40, true))).toBe(layout.espEndLba);
  });

  it("leaves entries 1..127 zeroed", () => {
    const built = buildGptEspImageParts({ layout });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const tail = built.parts.entryArray.subarray(GPT_ENTRY_SIZE);
    expect(tail.length).toBe((GPT_ENTRY_COUNT - 1) * GPT_ENTRY_SIZE);
    expect(tail.some((b) => b !== 0)).toBe(false);
  });

  it("header CRC verifies over exactly 92 bytes with the CRC field zeroed", () => {
    const built = buildGptEspImageParts({ layout });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    for (const header of [built.parts.primaryHeader, built.parts.backupHeader]) {
      expect(new TextDecoder().decode(header.subarray(0, 8))).toBe("EFI PART");
      const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
      expect(view.getUint32(12, true)).toBe(GPT_HEADER_SIZE);
      const stated = view.getUint32(16, true);
      const scratch = header.slice(0, GPT_HEADER_SIZE);
      new DataView(scratch.buffer).setUint32(16, 0, true);
      expect(crc32(scratch)).toBe(stated);
      expect(view.getUint32(88, true)).toBe(crc32(built.parts.entryArray));
    }
  });

  it("primary and backup headers point at each other", () => {
    const built = buildGptEspImageParts({ layout });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const primary = new DataView(built.parts.primaryHeader.buffer);
    const backup = new DataView(built.parts.backupHeader.buffer);
    expect(Number(primary.getBigUint64(24, true))).toBe(layout.primaryHeaderLba);
    expect(Number(primary.getBigUint64(32, true))).toBe(layout.backupHeaderLba);
    expect(Number(backup.getBigUint64(24, true))).toBe(layout.backupHeaderLba);
    expect(Number(backup.getBigUint64(32, true))).toBe(layout.primaryHeaderLba);
    expect(Number(primary.getBigUint64(72, true))).toBe(layout.primaryEntryArrayLba);
    expect(Number(backup.getBigUint64(72, true))).toBe(layout.backupEntryArrayLba);
  });

  it("refuses a non-GUID type rather than emitting a partition firmware cannot read", () => {
    const built = buildGptEspImageParts({ layout, espTypeGuid: "0xEF" });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("not a GUID");
  });
});

describe("golden byte-lock (hex-in-source, diffable)", () => {
  // A 1 MiB ESP at the default start LBA with the default deterministic GUIDs.
  // If any header field or the CRC changes, this string changes in the diff.
  it("pins the primary GPT header bytes", () => {
    const built = buildGptEspImageParts({
      layout: (() => {
        const p = planGptEspDisk({ espSizeBytes: 1024 * 1024 });
        if (!p.ok) throw new Error(p.error);
        return p.layout;
      })(),
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(hex(built.parts.primaryHeader.subarray(0, GPT_HEADER_SIZE))).toBe(
      "4546492050415254" + //  0  signature "EFI PART"
        "00000100" + //         8  revision 1.0
        "5c000000" + //        12  headerSize = 92
        "a3203682" + //        16  header CRC-32
        "00000000" + //        20  reserved
        "0100000000000000" + //24  myLBA = 1
        "2018000000000000" + //32  alternateLBA = 6176
        "2200000000000000" + //40  firstUsableLBA = 34
        "ff17000000000000" + //48  lastUsableLBA = 6143
        "4154455a000000408000000000000001" + // 56  disk GUID (mixed endian)
        "0200000000000000" + //72  partitionEntryLBA = 2
        "80000000" + //        80  numberOfPartitionEntries = 128
        "80000000" + //        84  sizeOfPartitionEntry = 128
        "e7fa15fb", //         88  partitionEntryArray CRC-32
    );
  });
});

describe("assembleGptEspDisk placement", () => {
  it("puts every structure at its planned byte offset", () => {
    const esp = fakeEsp();
    const assembled = assembleGptEspDisk({ espBytes: esp });
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    const { disk, layout } = assembled;
    expect(disk.length).toBe(layout.totalBytes);
    // protective MBR
    expect(disk[510]).toBe(0x55);
    // primary header at LBA 1
    expect(new TextDecoder().decode(disk.subarray(512, 520))).toBe("EFI PART");
    // backup header at the last LBA
    const backupOff = layout.backupHeaderLba * SECTOR_BYTES;
    expect(new TextDecoder().decode(disk.subarray(backupOff, backupOff + 8))).toBe("EFI PART");
    // ESP payload verbatim at 1 MiB
    const espOff = layout.espStartLba * SECTOR_BYTES;
    expect(espOff).toBe(1024 * 1024);
    expect(disk.subarray(espOff, espOff + esp.length)).toEqual(esp);
    // both entry-array copies identical
    const primaryEntries = disk.subarray(1024, 1024 + GPT_ENTRY_COUNT * GPT_ENTRY_SIZE);
    const backupOffEntries = layout.backupEntryArrayLba * SECTOR_BYTES;
    expect(
      disk.subarray(backupOffEntries, backupOffEntries + GPT_ENTRY_COUNT * GPT_ENTRY_SIZE),
    ).toEqual(primaryEntries);
  });

  it("gptWritePlan lists both entry-array copies and the payload", () => {
    const p = planGptEspDisk({ espSizeBytes: 1024 * 1024 });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const parts = gptWritePlan(p.layout).map((s) => s.part);
    expect(parts).toEqual([
      "protectiveMbr",
      "primaryHeader",
      "entryArray",
      "esp",
      "entryArray",
      "backupHeader",
    ]);
  });

  it("the type-GUID mutant differs from the honest image in exactly the type field", () => {
    // This is the negative control's construction, asserted at the byte level:
    // if the mutant were byte-identical the boot comparison would be vacuous.
    const esp = fakeEsp();
    const honest = assembleGptEspDisk({ espBytes: esp });
    const mutant = assembleGptEspDisk({ espBytes: esp, espTypeGuid: MSFT_BASIC_DATA_TYPE_GUID });
    expect(honest.ok && mutant.ok).toBe(true);
    if (!honest.ok || !mutant.ok) return;
    expect(honest.disk.length).toBe(mutant.disk.length);
    const differing: number[] = [];
    for (let i = 0; i < honest.disk.length; i++) {
      if (honest.disk[i] !== mutant.disk[i]) differing.push(i);
    }
    expect(differing.length).toBeGreaterThan(0);
    // Differences confined to: both entry arrays' first 16 bytes + both header CRCs.
    const entryA = 1024;
    const entryB = mutant.layout.backupEntryArrayLba * SECTOR_BYTES;
    for (const i of differing) {
      const inEntryTypeField =
        (i >= entryA && i < entryA + 16) || (i >= entryB && i < entryB + 16);
      const inHeaderCrcOrEntryCrc =
        (i >= 512 + 16 && i < 512 + 20) ||
        (i >= 512 + 88 && i < 512 + 92) ||
        (i >= mutant.layout.backupHeaderLba * SECTOR_BYTES + 16 &&
          i < mutant.layout.backupHeaderLba * SECTOR_BYTES + 20) ||
        (i >= mutant.layout.backupHeaderLba * SECTOR_BYTES + 88 &&
          i < mutant.layout.backupHeaderLba * SECTOR_BYTES + 92);
      expect(inEntryTypeField || inHeaderCrcOrEntryCrc).toBe(true);
    }
  });
});
