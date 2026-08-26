/**
 * GPT + EFI System Partition disk builder (pure planner + byte emitter).
 *
 * WHY THIS EXISTS. `qemu-uefi-menu-smoke.ts` boots a *synthesised directory*
 * through QEMU vvfat. That proves `BOOTX64.EFI` and `grub.cfg` are the right
 * files with the right contents — and it proves nothing whatsoever about the
 * artifact zflash actually writes to a stick, because vvfat manufactures its
 * own volume and there is no partition table anywhere in the path. The manual
 * step `MAN-USB-05` says the mismatch to check first is the ESP **partition
 * type GUID** (`c12a7328-f81f-11d2-ba4b-00a0c93ec93b`), which is exactly the
 * byte range vvfat routes around.
 *
 * So this module emits the real thing: protective MBR, primary GPT header,
 * a 128-entry partition array with one ESP entry, the FAT payload at an
 * aligned LBA, and the backup array + header at the tail. UEFI 2.10 §5.3.
 *
 * PURE. No spawn, no network, no ambient clock, no randomness — every GUID is
 * an input with a fixed default, so the same layout emits the same bytes on
 * every host and every replay (DST, §7). `writeGptEspDisk` in the smoke runner
 * is the only part that touches a file descriptor.
 *
 * Register: **metered** for the byte layout (a golden hex vector pins the
 * headers, and `sfdisk --json` — an external oracle, not this file's own
 * parser — reads the type GUID back in the smoke). **Unmetered** for the claim
 * that firmware *accepts* it; only the OVMF boot in `gpt-esp-usb-boot-smoke.ts`
 * can support that, and only for OVMF.
 *
 * Anchor (Beacon): UEFI Specification 2.10, §5.3 "GUID Partition Table (GPT)
 * Disk Layout" (protective MBR, header CRC over 92 bytes with the CRC field
 * zeroed, mixed-endian GUID encoding) and §13.3.1.3 (removable-media default
 * loader path). CRC-32 is the IEEE 802.3 / zlib polynomial, reflected form
 * 0xEDB88320 — Peterson & Brown 1961 for the underlying cyclic-code idea.
 */

/** Sector size assumed by the layout. Real sticks are 512e even when 4Kn. */
export const SECTOR_BYTES = 512;

/** UEFI 2.10 Table 5.7 — the EFI System Partition type GUID. */
export const ESP_TYPE_GUID = "c12a7328-f81f-11d2-ba4b-00a0c93ec93b";

/** Microsoft Basic Data — used ONLY as the negative-control mutant type. */
export const MSFT_BASIC_DATA_TYPE_GUID = "ebd0a0a2-b9e5-4433-87c0-68b6b72699c7";

/** GPT header is 92 bytes of defined fields; the rest of the LBA is zero. */
export const GPT_HEADER_SIZE = 92;
/** UEFI requires firmware to handle >= 16384 bytes of entry array. */
export const GPT_ENTRY_COUNT = 128;
export const GPT_ENTRY_SIZE = 128;
const ENTRY_ARRAY_SECTORS = (GPT_ENTRY_COUNT * GPT_ENTRY_SIZE) / SECTOR_BYTES; // 32

/** 1 MiB alignment — what every partitioner has used since ~2010. */
export const DEFAULT_ESP_START_LBA = 2048;

/**
 * Deterministic default GUIDs. Fixed literals rather than v4 randomness so the
 * emitted image is byte-identical across runs; a real flasher would mint fresh
 * ones, and the smoke wants replay, not uniqueness.
 */
export const DEFAULT_DISK_GUID = "5a455441-0000-4000-8000-000000000001";
export const DEFAULT_ESP_PART_GUID = "5a455441-0000-4000-8000-000000000002";

export type GptEspLayout = {
  readonly totalSectors: number;
  readonly espStartLba: number;
  readonly espEndLba: number;
  readonly firstUsableLba: number;
  readonly lastUsableLba: number;
  readonly primaryHeaderLba: number;
  readonly primaryEntryArrayLba: number;
  readonly backupEntryArrayLba: number;
  readonly backupHeaderLba: number;
  readonly espSizeBytes: number;
  readonly totalBytes: number;
};

export type PlanResult<T> =
  | { readonly ok: true; readonly layout: T }
  | { readonly ok: false; readonly error: string };

/**
 * Lay out a single-ESP GPT disk around a FAT payload of `espSizeBytes`.
 *
 * Fails closed rather than rounding: an ESP that is not a whole number of
 * sectors would leave the tail of the last sector undefined, and a disk that
 * cannot hold both GPT copies plus the payload is not a disk.
 */
export function planGptEspDisk(input: {
  readonly espSizeBytes: number;
  readonly espStartLba?: number | undefined;
  /** Sectors of slack after the ESP, before the backup array. Default 2048. */
  readonly tailSlackSectors?: number | undefined;
}): PlanResult<GptEspLayout> {
  const { espSizeBytes } = input;
  if (!Number.isSafeInteger(espSizeBytes) || espSizeBytes <= 0) {
    return { ok: false, error: "espSizeBytes must be a positive safe integer" };
  }
  if (espSizeBytes % SECTOR_BYTES !== 0) {
    return {
      ok: false,
      error: `espSizeBytes must be a whole number of ${String(SECTOR_BYTES)}-byte sectors, got ${String(espSizeBytes)}`,
    };
  }
  const espStartLba = input.espStartLba ?? DEFAULT_ESP_START_LBA;
  const minStart = 2 + ENTRY_ARRAY_SECTORS; // MBR + header + entry array
  if (!Number.isSafeInteger(espStartLba) || espStartLba < minStart) {
    return {
      ok: false,
      error: `espStartLba must be a safe integer >= ${String(minStart)} (GPT primary copy), got ${String(espStartLba)}`,
    };
  }
  const tailSlackSectors = input.tailSlackSectors ?? 2048;
  if (!Number.isSafeInteger(tailSlackSectors) || tailSlackSectors < 0) {
    return { ok: false, error: "tailSlackSectors must be a non-negative safe integer" };
  }

  const espSectors = espSizeBytes / SECTOR_BYTES;
  const espEndLba = espStartLba + espSectors - 1;
  const backupEntryArrayLba = espEndLba + 1 + tailSlackSectors;
  const backupHeaderLba = backupEntryArrayLba + ENTRY_ARRAY_SECTORS;
  const totalSectors = backupHeaderLba + 1;

  return {
    ok: true,
    layout: {
      totalSectors,
      espStartLba,
      espEndLba,
      firstUsableLba: 2 + ENTRY_ARRAY_SECTORS,
      lastUsableLba: backupEntryArrayLba - 1,
      primaryHeaderLba: 1,
      primaryEntryArrayLba: 2,
      backupEntryArrayLba,
      backupHeaderLba,
      espSizeBytes,
      totalBytes: totalSectors * SECTOR_BYTES,
    },
  };
}

// ---------------------------------------------------------------------------
// CRC-32 (IEEE, reflected 0xEDB88320) — what GPT headers and entry arrays use.
// ---------------------------------------------------------------------------

const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n >>> 0;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC32_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// GUID encoding. UEFI stores the first three fields little-endian and the last
// two as-written — the "mixed endian" layout that makes a naive hexdump of a
// GPT look like the GUID is scrambled.
// ---------------------------------------------------------------------------

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function encodeGuid(guid: string): Uint8Array | null {
  const lower = guid.toLowerCase();
  if (!GUID_RE.test(lower)) {
    return null;
  }
  const hex = lower.replace(/-/g, "");
  const raw = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    raw[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const out = new Uint8Array(16);
  // time_low (4) LE
  out[0] = raw[3]!;
  out[1] = raw[2]!;
  out[2] = raw[1]!;
  out[3] = raw[0]!;
  // time_mid (2) LE
  out[4] = raw[5]!;
  out[5] = raw[4]!;
  // time_hi_and_version (2) LE
  out[6] = raw[7]!;
  out[7] = raw[6]!;
  // clock_seq (2) + node (6) big-endian / as-written
  for (let i = 8; i < 16; i++) {
    out[i] = raw[i]!;
  }
  return out;
}

/** Inverse of `encodeGuid`. Used by tests; the smoke cross-checks with sfdisk. */
export function decodeGuid(bytes: Uint8Array): string | null {
  if (bytes.length !== 16) {
    return null;
  }
  const order = [3, 2, 1, 0, 5, 4, 7, 6, 8, 9, 10, 11, 12, 13, 14, 15];
  const hex = order.map((i) => bytes[i]!.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ---------------------------------------------------------------------------
// Structure emitters.
// ---------------------------------------------------------------------------

export type GptEspImageParts = {
  /** LBA 0. Keeps MBR-only tools from seeing free space. UEFI 2.10 §5.3.1. */
  readonly protectiveMbr: Uint8Array;
  readonly primaryHeader: Uint8Array;
  readonly backupHeader: Uint8Array;
  /** 16384 bytes: one ESP entry followed by 127 zero entries. */
  readonly entryArray: Uint8Array;
};

export type BuildGptEspInput = {
  readonly layout: GptEspLayout;
  readonly diskGuid?: string | undefined;
  readonly espPartitionGuid?: string | undefined;
  /** Defaults to ESP_TYPE_GUID. Overridable so the mutant is a real input. */
  readonly espTypeGuid?: string | undefined;
  readonly partitionName?: string | undefined;
};

export type BuildResult =
  | { readonly ok: true; readonly parts: GptEspImageParts }
  | { readonly ok: false; readonly error: string };

function buildProtectiveMbr(totalSectors: number): Uint8Array {
  const mbr = new Uint8Array(SECTOR_BYTES);
  const view = new DataView(mbr.buffer);
  const off = 0x1be;
  mbr[off + 0] = 0x00; // not bootable
  mbr[off + 1] = 0x00; // starting CHS 0/0/2
  mbr[off + 2] = 0x02;
  mbr[off + 3] = 0x00;
  mbr[off + 4] = 0xee; // GPT protective
  mbr[off + 5] = 0xff; // ending CHS = max
  mbr[off + 6] = 0xff;
  mbr[off + 7] = 0xff;
  view.setUint32(off + 8, 1, true); // starting LBA
  view.setUint32(off + 12, Math.min(totalSectors - 1, 0xffffffff), true);
  mbr[510] = 0x55;
  mbr[511] = 0xaa;
  return mbr;
}

function buildEntryArray(input: {
  readonly typeGuid: Uint8Array;
  readonly partGuid: Uint8Array;
  readonly startLba: number;
  readonly endLba: number;
  readonly name: string;
}): Uint8Array {
  const array = new Uint8Array(GPT_ENTRY_COUNT * GPT_ENTRY_SIZE);
  const view = new DataView(array.buffer);
  array.set(input.typeGuid, 0);
  array.set(input.partGuid, 16);
  view.setBigUint64(32, BigInt(input.startLba), true);
  view.setBigUint64(40, BigInt(input.endLba), true);
  view.setBigUint64(48, 0n, true); // attributes
  // partitionName: UTF-16LE, 36 code units. Truncated, never overflowed.
  const name = input.name.slice(0, 35);
  for (let i = 0; i < name.length; i++) {
    view.setUint16(56 + i * 2, name.charCodeAt(i), true);
  }
  return array;
}

function buildHeader(input: {
  readonly myLba: number;
  readonly alternateLba: number;
  readonly firstUsableLba: number;
  readonly lastUsableLba: number;
  readonly diskGuid: Uint8Array;
  readonly entryArrayLba: number;
  readonly entryArrayCrc: number;
}): Uint8Array {
  const sector = new Uint8Array(SECTOR_BYTES);
  const view = new DataView(sector.buffer);
  sector.set(new TextEncoder().encode("EFI PART"), 0);
  view.setUint32(8, 0x0001_0000, true); // revision 1.0
  view.setUint32(12, GPT_HEADER_SIZE, true);
  view.setUint32(16, 0, true); // header CRC — zeroed while computing
  view.setUint32(20, 0, true); // reserved
  view.setBigUint64(24, BigInt(input.myLba), true);
  view.setBigUint64(32, BigInt(input.alternateLba), true);
  view.setBigUint64(40, BigInt(input.firstUsableLba), true);
  view.setBigUint64(48, BigInt(input.lastUsableLba), true);
  sector.set(input.diskGuid, 56);
  view.setBigUint64(72, BigInt(input.entryArrayLba), true);
  view.setUint32(80, GPT_ENTRY_COUNT, true);
  view.setUint32(84, GPT_ENTRY_SIZE, true);
  view.setUint32(88, input.entryArrayCrc, true);
  // CRC is over exactly headerSize bytes, with the CRC field read as zero.
  view.setUint32(16, crc32(sector.subarray(0, GPT_HEADER_SIZE)), true);
  return sector;
}

/** Emit every GPT structure for a planned layout. Pure. */
export function buildGptEspImageParts(input: BuildGptEspInput): BuildResult {
  const { layout } = input;
  const typeGuid = encodeGuid(input.espTypeGuid ?? ESP_TYPE_GUID);
  const diskGuid = encodeGuid(input.diskGuid ?? DEFAULT_DISK_GUID);
  const partGuid = encodeGuid(input.espPartitionGuid ?? DEFAULT_ESP_PART_GUID);
  if (typeGuid === null) {
    return { ok: false, error: `espTypeGuid is not a GUID: ${input.espTypeGuid ?? ""}` };
  }
  if (diskGuid === null) {
    return { ok: false, error: `diskGuid is not a GUID: ${input.diskGuid ?? ""}` };
  }
  if (partGuid === null) {
    return { ok: false, error: `espPartitionGuid is not a GUID: ${input.espPartitionGuid ?? ""}` };
  }
  if (layout.espEndLba > layout.lastUsableLba) {
    return {
      ok: false,
      error: `ESP end LBA ${String(layout.espEndLba)} exceeds last usable ${String(layout.lastUsableLba)}`,
    };
  }

  const entryArray = buildEntryArray({
    typeGuid,
    partGuid,
    startLba: layout.espStartLba,
    endLba: layout.espEndLba,
    name: input.partitionName ?? "ZETA_ESP",
  });
  const entryArrayCrc = crc32(entryArray);

  return {
    ok: true,
    parts: {
      protectiveMbr: buildProtectiveMbr(layout.totalSectors),
      primaryHeader: buildHeader({
        myLba: layout.primaryHeaderLba,
        alternateLba: layout.backupHeaderLba,
        firstUsableLba: layout.firstUsableLba,
        lastUsableLba: layout.lastUsableLba,
        diskGuid,
        entryArrayLba: layout.primaryEntryArrayLba,
        entryArrayCrc,
      }),
      backupHeader: buildHeader({
        myLba: layout.backupHeaderLba,
        alternateLba: layout.primaryHeaderLba,
        firstUsableLba: layout.firstUsableLba,
        lastUsableLba: layout.lastUsableLba,
        diskGuid,
        entryArrayLba: layout.backupEntryArrayLba,
        entryArrayCrc,
      }),
      entryArray,
    },
  };
}

/**
 * Byte offsets each structure is written at. Separated from the emitter so the
 * placement is assertable without doing any IO.
 */
export function gptWritePlan(
  layout: GptEspLayout,
): readonly { readonly part: keyof GptEspImageParts | "esp"; readonly offsetBytes: number }[] {
  return [
    { part: "protectiveMbr", offsetBytes: 0 },
    { part: "primaryHeader", offsetBytes: layout.primaryHeaderLba * SECTOR_BYTES },
    { part: "entryArray", offsetBytes: layout.primaryEntryArrayLba * SECTOR_BYTES },
    { part: "esp", offsetBytes: layout.espStartLba * SECTOR_BYTES },
    { part: "entryArray", offsetBytes: layout.backupEntryArrayLba * SECTOR_BYTES },
    { part: "backupHeader", offsetBytes: layout.backupHeaderLba * SECTOR_BYTES },
  ];
}

/**
 * Assemble the whole disk image in memory. Used by the smoke; kept here so the
 * layout, the bytes, and their placement are one testable unit.
 */
export function assembleGptEspDisk(input: {
  readonly espBytes: Uint8Array;
  readonly espStartLba?: number | undefined;
  readonly diskGuid?: string | undefined;
  readonly espPartitionGuid?: string | undefined;
  readonly espTypeGuid?: string | undefined;
  readonly partitionName?: string | undefined;
}): { readonly ok: true; readonly disk: Uint8Array; readonly layout: GptEspLayout } | {
  readonly ok: false;
  readonly error: string;
} {
  const planned = planGptEspDisk({
    espSizeBytes: input.espBytes.length,
    espStartLba: input.espStartLba,
  });
  if (!planned.ok) {
    return { ok: false, error: planned.error };
  }
  const built = buildGptEspImageParts({
    layout: planned.layout,
    diskGuid: input.diskGuid,
    espPartitionGuid: input.espPartitionGuid,
    espTypeGuid: input.espTypeGuid,
    partitionName: input.partitionName,
  });
  if (!built.ok) {
    return { ok: false, error: built.error };
  }
  const disk = new Uint8Array(planned.layout.totalBytes);
  for (const { part, offsetBytes } of gptWritePlan(planned.layout)) {
    const bytes = part === "esp" ? input.espBytes : built.parts[part];
    disk.set(bytes, offsetBytes);
  }
  return { ok: true, disk, layout: planned.layout };
}
