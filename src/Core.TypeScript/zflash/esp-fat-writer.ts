// src/Core.TypeScript/zflash/esp-fat-writer.ts
//
// Add files to the root directory of the FAT12/FAT16 EFI System Partition of
// an isohybrid installer IMAGE — pure TypeScript, no mtools, no mount, no
// drive letter. Used by flash-usb-windows.ts to bake the ESP payloads into a
// COPY of the verified ISO before the raw write, which is the only injection
// path that works on Windows removable media: a stick cannot be taken offline
// ("Removable media cannot be set to offline"), and after the raw write
// Windows auto-mounts the isohybrid ESP read-only, so a post-write inject
// has nothing it can write to.
//
// Generalises esp-inject.ts (one hard-coded file, one cluster, FAT12 only)
// to: any number of root files, any length (multi-cluster chains), FAT12 and
// FAT16, generated 8.3 aliases with numeric tails (ZETA-A~1PUB, ZETA-F~1CON,
// ...), VFAT long-name entries, every FAT copy updated, and a read-back of
// each file that follows its cluster chain in EVERY FAT copy.
//
// Deterministic by design (DST): directory timestamps are the FAT epoch
// (1980-01-01 00:00), so baking the same payloads into the same ISO produces
// byte-identical images on every host. Anchor: Microsoft, "FAT: General
// Overview of On-Disk Format" (fatgen103, 2000) — BPB fields, the FAT
// type-by-cluster-count rule, the basis-name / numeric-tail algorithm and the
// LFN checksum all follow that document.
//
// All IO goes through a BlockIo of whole-sector reads/writes, so the same code
// runs against a file descriptor (production: the staged ISO copy) and a temp
// file (tests). Nothing here opens a device.

import { buildLfnEntry, fat12Get, fat12Set, LFN_SLOTS, lfnChecksum } from "./fat12-lib.ts";
import { readRegion, writeRegion } from "./esp-inject.ts";

export const SECTOR_BYTES = 512;
/** MBR partition type 0xEF == EFI System Partition. */
export const MBR_ESP_TYPE = 0xef;

export type FatResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };
const ok = <T>(value: T): FatResult<T> => ({ ok: true, value });
const err = <T>(error: string): FatResult<T> => ({ ok: false, error });

/** Whole-sector random access. Offsets and lengths are multiples of 512. */
export interface BlockIo {
  read(offset: number, length: number): Buffer;
  write(offset: number, data: Buffer): void;
}

/** A BlockIo over an already-open descriptor (file or device). */
export function fdBlockIo(fd: number): BlockIo {
  return {
    read: (offset, length) => readRegion(fd, offset, length),
    write: (offset, data) => writeRegion(fd, offset, data),
  };
}

// ── Partition table ──────────────────────────────────────────────────

export interface IsohybridEsp {
  readonly startLba: number;
  readonly sectorCount: number;
  readonly offsetBytes: number;
}

/**
 * The ESP of an isohybrid image: the MBR partition entry of type 0xEF with a
 * start LBA > 0. No fallback offset — an image whose MBR names no ESP is
 * refused rather than written at a guessed location.
 */
export function locateIsohybridEsp(mbr: Buffer): FatResult<IsohybridEsp> {
  if (mbr.length < SECTOR_BYTES) return err(`MBR sector too short (${mbr.length} bytes)`);
  if (mbr.readUInt16LE(0x1fe) !== 0xaa55) return err("no MBR boot signature (0x55AA) in sector 0");
  const found: IsohybridEsp[] = [];
  for (let p = 0; p < 4; p++) {
    const o = 0x1be + p * 16;
    const type = mbr[o + 4]!;
    const startLba = mbr.readUInt32LE(o + 8);
    const sectorCount = mbr.readUInt32LE(o + 12);
    if (type === MBR_ESP_TYPE && startLba > 0 && sectorCount > 0) {
      found.push({ startLba, sectorCount, offsetBytes: startLba * SECTOR_BYTES });
    }
  }
  if (found.length === 0) return err("no MBR partition of type 0xEF with start > 0 — not an isohybrid ESP image");
  if (found.length > 1) return err(`${found.length} MBR partitions of type 0xEF — refusing to guess which is the ESP`);
  return ok(found[0]!);
}

// ── FAT volume geometry ──────────────────────────────────────────────

export interface FatVolume {
  readonly fatType: 12 | 16;
  readonly offset: number;
  readonly bytesPerSector: number;
  readonly sectorsPerCluster: number;
  readonly reservedSectors: number;
  readonly numFats: number;
  readonly fatSectors: number;
  readonly rootEntries: number;
  readonly totalSectors: number;
  readonly clusterCount: number;
  readonly clusterBytes: number;
  readonly fatBytes: number;
  readonly rootOffset: number;
  readonly rootBytes: number;
  readonly dataOffset: number;
}

export function fatCopyOffset(v: FatVolume, index: number): number {
  return v.offset + (v.reservedSectors + index * v.fatSectors) * v.bytesPerSector;
}

export function clusterOffset(v: FatVolume, cluster: number): number {
  return v.dataOffset + (cluster - 2) * v.clusterBytes;
}

/**
 * Parse a FAT boot sector at `offset`. FAT type is decided by cluster count,
 * as the spec requires (never by the label string). FAT32 is refused: its root
 * directory is a cluster chain, and no Zeta ISO ships a FAT32 ESP.
 */
export function parseFatVolume(boot: Buffer, offset: number, partitionSectors?: number): FatResult<FatVolume> {
  if (boot.length < SECTOR_BYTES) return err("boot sector too short");
  if (boot.readUInt16LE(0x1fe) !== 0xaa55) return err("ESP boot sector has no 0x55AA signature");
  const bytesPerSector = boot.readUInt16LE(0x0b);
  const sectorsPerCluster = boot[0x0d]!;
  const reservedSectors = boot.readUInt16LE(0x0e);
  const numFats = boot[0x10]!;
  const rootEntries = boot.readUInt16LE(0x11);
  const totalSectors = boot.readUInt16LE(0x13) || boot.readUInt32LE(0x20);
  const fatSectors = boot.readUInt16LE(0x16);
  if (bytesPerSector !== SECTOR_BYTES) return err(`unsupported bytes/sector ${bytesPerSector} (need 512)`);
  if (sectorsPerCluster === 0 || (sectorsPerCluster & (sectorsPerCluster - 1)) !== 0) {
    return err(`invalid sectors/cluster ${sectorsPerCluster}`);
  }
  if (reservedSectors === 0 || numFats === 0 || totalSectors === 0) return err("invalid BPB (zero reserved/FATs/total)");
  if (fatSectors === 0 || rootEntries === 0) return err("FAT32 (or corrupt) ESP — only FAT12/FAT16 are supported");
  if (partitionSectors !== undefined && totalSectors > partitionSectors) {
    return err(`filesystem claims ${totalSectors} sectors but the partition has ${partitionSectors}`);
  }
  const rootSectors = Math.ceil((rootEntries * 32) / bytesPerSector);
  const metaSectors = reservedSectors + numFats * fatSectors + rootSectors;
  if (metaSectors >= totalSectors) return err("BPB metadata exceeds the volume");
  const clusterCount = Math.floor((totalSectors - metaSectors) / sectorsPerCluster);
  if (clusterCount >= 65525) return err(`FAT32-sized volume (${clusterCount} clusters) — only FAT12/FAT16 are supported`);
  const fatType: 12 | 16 = clusterCount < 4085 ? 12 : 16;
  const fatBytes = fatSectors * bytesPerSector;
  const neededFatBytes = fatType === 12 ? Math.ceil(((clusterCount + 2) * 3) / 2) : (clusterCount + 2) * 2;
  if (neededFatBytes > fatBytes) return err(`FAT too small for ${clusterCount} clusters`);
  return ok({
    fatType,
    offset,
    bytesPerSector,
    sectorsPerCluster,
    reservedSectors,
    numFats,
    fatSectors,
    rootEntries,
    totalSectors,
    clusterCount,
    clusterBytes: sectorsPerCluster * bytesPerSector,
    fatBytes,
    rootOffset: offset + (reservedSectors + numFats * fatSectors) * bytesPerSector,
    rootBytes: rootSectors * bytesPerSector,
    dataOffset: offset + metaSectors * bytesPerSector,
  });
}

// ── FAT entries ──────────────────────────────────────────────────────

function eoc(v: FatVolume): number {
  return v.fatType === 12 ? 0xfff : 0xffff;
}
function isEoc(v: FatVolume, value: number): boolean {
  return v.fatType === 12 ? value >= 0xff8 : value >= 0xfff8;
}
export function fatGet(v: FatVolume, fat: Buffer, c: number): number {
  return v.fatType === 12 ? fat12Get(fat, c) : fat.readUInt16LE(c * 2);
}
function fatSet(v: FatVolume, fat: Buffer, c: number, value: number): void {
  if (v.fatType === 12) fat12Set(fat, c, value);
  else fat.writeUInt16LE(value, c * 2);
}

/** Follow a chain; errors on a loop, an out-of-range link, or a free link. */
export function clusterChain(v: FatVolume, fat: Buffer, first: number): FatResult<number[]> {
  const chain: number[] = [];
  const seen = new Set<number>();
  let c = first;
  while (true) {
    if (c < 2 || c >= v.clusterCount + 2) return err(`cluster ${c} out of range in chain from ${first}`);
    if (seen.has(c)) return err(`cluster chain from ${first} loops at ${c}`);
    seen.add(c);
    chain.push(c);
    const next = fatGet(v, fat, c);
    if (isEoc(v, next)) return ok(chain);
    if (next === 0) return err(`cluster chain from ${first} reaches a FREE cluster after ${c}`);
    c = next;
  }
}

// ── 8.3 short names (fatgen103 basis-name + numeric tail) ────────────

const SHORT_VALID = /^[A-Z0-9$%'\-_@~`!(){}^#&]$/;

function basisChars(s: string): { chars: string; lossy: boolean } {
  let out = "";
  let lossy = false;
  for (const ch of s.toUpperCase()) {
    if (ch === " " || ch === ".") {
      lossy = true;
      continue;
    }
    if (SHORT_VALID.test(ch)) out += ch;
    else {
      out += "_";
      lossy = true;
    }
  }
  return { chars: out, lossy };
}

/** The 11-byte short name, as a string ("NAME    EXT"). */
export type Short11 = string;

/** True when `name` IS a valid upper-case 8.3 name, so no LFN is needed. */
export function isPlainShortName(name: string): boolean {
  const m = /^([^.]{1,8})(?:\.([^.]{1,3}))?$/.exec(name);
  if (m === null) return false;
  return [...(m[1]! + (m[2] ?? ""))].every((ch) => SHORT_VALID.test(ch));
}

/**
 * Generate the 8.3 alias for `longName`, unique among `taken` (upper-case
 * 11-char names). A name that is already a valid upper-case 8.3 name keeps
 * itself; everything else gets a numeric tail, first free of ~1..~999999.
 */
export function generateShortName(longName: string, taken: ReadonlySet<Short11>): FatResult<Short11> {
  const lastDot = longName.lastIndexOf(".");
  const hasExt = lastDot > 0 && lastDot < longName.length - 1;
  const base = basisChars(hasExt ? longName.slice(0, lastDot) : longName);
  const ext = basisChars(hasExt ? longName.slice(lastDot + 1) : "");
  const ext3 = ext.chars.slice(0, 3);
  if (isPlainShortName(longName)) {
    const s11 = base.chars.padEnd(8, " ") + ext3.padEnd(3, " ");
    if (taken.has(s11)) return err(`8.3 name ${s11.trim()} already exists`);
    return ok(s11);
  }
  const stem = base.chars.length > 0 ? base.chars : "_";
  for (let n = 1; n <= 999_999; n++) {
    const tail = `~${n}`;
    const s11 = (stem.slice(0, 8 - tail.length) + tail).padEnd(8, " ") + ext3.padEnd(3, " ");
    if (!taken.has(s11)) return ok(s11);
  }
  return err(`no free numeric-tail 8.3 alias for ${longName}`);
}

// ── Root directory ───────────────────────────────────────────────────

export interface RootFileEntry {
  readonly longName: string | null;
  readonly shortName: Short11;
  readonly attr: number;
  readonly firstCluster: number;
  readonly size: number;
  readonly slot: number;
}

/** Every live entry in the root directory, with its long name when a valid LFN run precedes it. */
export function listRootEntries(v: FatVolume, root: Buffer): RootFileEntry[] {
  const out: RootFileEntry[] = [];
  let lfn: Buffer[] = [];
  for (let i = 0; i < v.rootEntries; i++) {
    const e = root.subarray(i * 32, i * 32 + 32);
    if (e[0] === 0x00) break;
    if (e[0] === 0xe5) {
      lfn = [];
      continue;
    }
    if (e[11] === 0x0f) {
      if ((e[0]! & 0x40) !== 0) lfn = [];
      lfn.push(e);
      continue;
    }
    const short11 = e.subarray(0, 11);
    let longName: string | null = null;
    if (lfn.length > 0 && lfn.every((x) => x[13] === lfnChecksum(short11))) {
      longName = assembleLongName(lfn);
    }
    lfn = [];
    out.push({
      longName,
      shortName: short11.toString("latin1"),
      attr: e[11]!,
      firstCluster: e.readUInt16LE(26),
      size: e.readUInt32LE(28),
      slot: i,
    });
  }
  return out;
}

function assembleLongName(lfn: readonly Buffer[]): string | null {
  const units: number[] = [];
  const byOrd = new Map<number, Buffer>();
  for (const e of lfn) byOrd.set(e[0]! & 0x1f, e);
  for (let ord = 1; ord <= byOrd.size; ord++) {
    const e = byOrd.get(ord);
    if (e === undefined) return null;
    for (const s of LFN_SLOTS) units.push(e.readUInt16LE(s));
  }
  let name = "";
  for (const u of units) {
    if (u === 0x0000 || u === 0xffff) break;
    name += String.fromCharCode(u);
  }
  return name;
}

function displayName(e: RootFileEntry): string {
  if (e.longName !== null) return e.longName;
  const base = e.shortName.slice(0, 8).trimEnd();
  const ext = e.shortName.slice(8).trimEnd();
  return ext.length > 0 ? `${base}.${ext}` : base;
}

function sameName(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

/** Find a root entry by name (long or short, case-insensitive as FAT is). */
export function findRootEntry(v: FatVolume, root: Buffer, name: string): RootFileEntry | null {
  for (const e of listRootEntries(v, root)) {
    if ((e.attr & 0x08) !== 0) continue; // volume label
    if (sameName(displayName(e), name)) return e;
    if (e.longName !== null) {
      const base = e.shortName.slice(0, 8).trimEnd();
      const ext = e.shortName.slice(8).trimEnd();
      if (sameName(ext.length > 0 ? `${base}.${ext}` : base, name)) return e;
    }
  }
  return null;
}

// ── The mutation ─────────────────────────────────────────────────────

/** 1980-01-01, 00:00:00 — the FAT epoch. Deterministic, host-clock-free. */
const FAT_EPOCH_DATE = 0x0021;
const FAT_EPOCH_TIME = 0x0000;

export interface AddedFile {
  readonly name: string;
  readonly shortName: Short11;
  readonly clusters: readonly number[];
  readonly dirSlot: number;
}

function validateLongName(name: string): string | null {
  if (name.length === 0 || name.length > 255) return `file name length ${name.length} not in 1..255`;
  if (!/^[\x20-\x7e]+$/.test(name)) return `file name must be printable ASCII: ${JSON.stringify(name)}`;
  if (/[\\/:*?"<>|]/.test(name)) return `file name contains a character FAT forbids: ${name}`;
  if (name.startsWith(".") || name.endsWith(".") || name.endsWith(" ")) return `file name has a leading dot or trailing dot/space: ${name}`;
  return null;
}

/**
 * Add one file to the root directory. Refuses (never overwrites) a name that
 * already exists. Writes the data clusters, the chain into EVERY FAT copy,
 * then the directory entries — directory last, so a failure part-way leaves
 * at worst allocated-but-unreferenced clusters, never an entry pointing at
 * garbage.
 */
export function addRootFile(io: BlockIo, v: FatVolume, name: string, body: Buffer): FatResult<AddedFile> {
  const bad = validateLongName(name);
  if (bad !== null) return err(bad);
  const root = io.read(v.rootOffset, v.rootBytes);
  const entries = listRootEntries(v, root);
  if (findRootEntry(v, root, name) !== null) return err(`${name} already exists on the ESP — refusing to overwrite`);

  const taken = new Set(entries.map((e) => e.shortName.toUpperCase()));
  const short = generateShortName(name, taken);
  if (!short.ok) return err(short.error);
  const short11 = Buffer.from(short.value, "latin1");
  const needsLfn = !isPlainShortName(name);
  const lfnCount = needsLfn ? Math.ceil(name.length / 13) : 0;
  const slotsNeeded = lfnCount + 1;

  let slot = -1;
  for (let i = 0; i + slotsNeeded <= v.rootEntries; i++) {
    let free = true;
    for (let j = 0; j < slotsNeeded; j++) {
      const b = root[(i + j) * 32];
      if (b !== 0x00 && b !== 0xe5) {
        free = false;
        break;
      }
    }
    if (free) {
      slot = i;
      break;
    }
  }
  if (slot < 0) return err(`no ${slotsNeeded} consecutive free root-directory slots for ${name}`);

  const fats: Buffer[] = [];
  for (let f = 0; f < v.numFats; f++) fats.push(io.read(fatCopyOffset(v, f), v.fatBytes));
  const nClusters = Math.ceil(body.length / v.clusterBytes);
  const clusters: number[] = [];
  for (let c = 2; c < v.clusterCount + 2 && clusters.length < nClusters; c++) {
    if (fats.every((fat) => fatGet(v, fat, c) === 0)) clusters.push(c);
  }
  if (clusters.length < nClusters) {
    return err(`ESP full: ${name} needs ${nClusters} cluster(s), ${clusters.length} free`);
  }

  for (let k = 0; k < clusters.length; k++) {
    const chunk = Buffer.alloc(v.clusterBytes, 0);
    body.copy(chunk, 0, k * v.clusterBytes, Math.min(body.length, (k + 1) * v.clusterBytes));
    io.write(clusterOffset(v, clusters[k]!), chunk);
  }
  for (let f = 0; f < v.numFats; f++) {
    const fat = fats[f]!;
    for (let k = 0; k < clusters.length; k++) {
      fatSet(v, fat, clusters[k]!, k + 1 < clusters.length ? clusters[k + 1]! : eoc(v));
    }
    io.write(fatCopyOffset(v, f), fat);
  }

  const shortEntry = Buffer.alloc(32, 0);
  short11.copy(shortEntry, 0);
  shortEntry[11] = 0x20; // ARCHIVE
  shortEntry.writeUInt16LE(FAT_EPOCH_TIME, 14);
  shortEntry.writeUInt16LE(FAT_EPOCH_DATE, 16);
  shortEntry.writeUInt16LE(FAT_EPOCH_DATE, 18);
  shortEntry.writeUInt16LE(FAT_EPOCH_TIME, 22);
  shortEntry.writeUInt16LE(FAT_EPOCH_DATE, 24);
  shortEntry.writeUInt16LE(clusters.length > 0 ? clusters[0]! : 0, 26);
  shortEntry.writeUInt32LE(body.length, 28);
  const cks = lfnChecksum(short11);
  const dir: Buffer[] = [];
  for (let seq = lfnCount; seq >= 1; seq--) {
    dir.push(buildLfnEntry(name, (seq - 1) * 13, (seq === lfnCount ? 0x40 : 0) | seq, cks));
  }
  dir.push(shortEntry);
  for (let k = 0; k < dir.length; k++) dir[k]!.copy(root, (slot + k) * 32);
  io.write(v.rootOffset, root);

  return ok({ name, shortName: short.value, clusters, dirSlot: slot });
}

/**
 * Read a root file back by name, following its chain in EVERY FAT copy and
 * refusing if the copies disagree — a file readable through FAT 0 but not
 * FAT 1 is a file a repair tool can lose.
 */
export function readRootFile(io: BlockIo, v: FatVolume, name: string): FatResult<Buffer> {
  const root = io.read(v.rootOffset, v.rootBytes);
  const entry = findRootEntry(v, root, name);
  if (entry === null) return err(`${name} not found in the ESP root directory`);
  if ((entry.attr & 0x10) !== 0) return err(`${name} is a directory`);
  if (entry.size === 0) return ok(Buffer.alloc(0));
  let chain: number[] | null = null;
  for (let f = 0; f < v.numFats; f++) {
    const c = clusterChain(v, io.read(fatCopyOffset(v, f), v.fatBytes), entry.firstCluster);
    if (!c.ok) return err(`${name}: FAT ${f}: ${c.error}`);
    if (chain !== null && c.value.join(",") !== chain.join(",")) return err(`${name}: FAT copies disagree on its cluster chain`);
    chain = c.value;
  }
  const chainValue = chain ?? [];
  if (chainValue.length * v.clusterBytes < entry.size) {
    return err(`${name}: chain of ${chainValue.length} cluster(s) cannot hold ${entry.size} bytes`);
  }
  const out = Buffer.alloc(chainValue.length * v.clusterBytes);
  chainValue.forEach((c, k) => io.read(clusterOffset(v, c), v.clusterBytes).copy(out, k * v.clusterBytes));
  return ok(out.subarray(0, entry.size));
}

// ── The whole bake ───────────────────────────────────────────────────

export interface EspFile {
  /** Root-directory name, no leading slash (e.g. "zeta-authorized-keys.pub"). */
  readonly name: string;
  readonly body: Buffer;
}

export interface BakeReport {
  readonly esp: IsohybridEsp;
  readonly fatType: 12 | 16;
  readonly files: readonly AddedFile[];
}

/**
 * Locate the isohybrid ESP through the image's MBR, add every file, then read
 * EVERY file back and compare byte-for-byte. Returns ok only when all of them
 * verify; any refusal or mismatch is an error naming the file.
 */
export function bakeEspFiles(io: BlockIo, files: readonly EspFile[]): FatResult<BakeReport> {
  const esp = locateIsohybridEsp(io.read(0, SECTOR_BYTES));
  if (!esp.ok) return err(esp.error);
  const vol = parseFatVolume(io.read(esp.value.offsetBytes, SECTOR_BYTES), esp.value.offsetBytes, esp.value.sectorCount);
  if (!vol.ok) return err(vol.error);
  const names = new Set<string>();
  for (const f of files) {
    const key = f.name.toUpperCase();
    if (names.has(key)) return err(`duplicate ESP file ${f.name}`);
    names.add(key);
  }
  const added: AddedFile[] = [];
  for (const f of files) {
    const a = addRootFile(io, vol.value, f.name, f.body);
    if (!a.ok) return err(a.error);
    added.push(a.value);
  }
  for (const f of files) {
    const back = readRootFile(io, vol.value, f.name);
    if (!back.ok) return err(`read-back: ${back.error}`);
    if (!back.value.equals(f.body)) return err(`read-back: ${f.name} content does not match what was written`);
  }
  return ok({ esp: esp.value, fatType: vol.value.fatType, files: added });
}
