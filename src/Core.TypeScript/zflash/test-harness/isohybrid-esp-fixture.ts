// src/Core.TypeScript/zflash/test-harness/isohybrid-esp-fixture.ts
//
// TEST-ONLY. Builds a small isohybrid-shaped image (MBR + FAT12/FAT16 ESP) and
// reads a FAT root directory back with a parser that shares NO code with
// esp-fat-writer.ts — so a writer bug cannot be hidden by the same bug in its
// own reader. The FAT12 default mirrors the real Zeta installer ISO measured
// 2026-09-27 (zeta-installer-26.05-x86_64-linux.iso): MBR partition 1 type
// 0xEF at LBA 276, 6144 sectors, "mkfs.fat" BPB with 512 B/sector, 4
// sectors/cluster, 1 reserved sector, 2 FATs of 5 sectors, 512 root entries,
// label EFIBOOT, and an EFI directory occupying the first clusters.

export interface FixtureSpec {
  readonly fatType: 12 | 16;
  readonly espStartLba: number;
  readonly espSectors: number;
  readonly sectorsPerCluster: number;
  readonly reservedSectors: number;
  readonly fatSectors: number;
  readonly rootEntries: number;
  /** Clusters 2..2+n-1 are taken by the EFI directory's chain. */
  readonly occupiedClusters: number;
  /** Bytes of the image after the ESP (stand-in for the ISO9660 payload). */
  readonly tailBytes: number;
}

export const REAL_ISO_FAT12: FixtureSpec = {
  fatType: 12,
  espStartLba: 276,
  espSectors: 6144,
  sectorsPerCluster: 4,
  reservedSectors: 1,
  fatSectors: 5,
  rootEntries: 512,
  occupiedClusters: 719, // the real ISO's first free cluster is 721
  tailBytes: 64 * 1024,
};

export const FAT16_SPEC: FixtureSpec = {
  fatType: 16,
  espStartLba: 2048,
  espSectors: 8192,
  sectorsPerCluster: 1,
  reservedSectors: 1,
  fatSectors: 32,
  rootEntries: 512,
  occupiedClusters: 10,
  tailBytes: 4096,
};

function fixtureFatSet(fatType: 12 | 16, fat: Buffer, c: number, v: number): void {
  if (fatType === 16) {
    fat.writeUInt16LE(v, c * 2);
    return;
  }
  const o = Math.floor((c * 3) / 2);
  if (c % 2 === 0) {
    fat[o] = v & 0xff;
    fat[o + 1] = (fat[o + 1]! & 0xf0) | ((v >> 8) & 0x0f);
  } else {
    fat[o] = (fat[o]! & 0x0f) | ((v << 4) & 0xf0);
    fat[o + 1] = (v >> 4) & 0xff;
  }
}

/** Build the whole image in memory. Bytes outside the ESP are a recognisable pattern. */
export function buildIsohybridFixture(spec: FixtureSpec): Buffer {
  const espOff = spec.espStartLba * 512;
  const total = espOff + spec.espSectors * 512 + spec.tailBytes;
  const img = Buffer.alloc(total);
  for (let i = 0; i < total; i++) img[i] = (i * 31 + 7) & 0xff; // non-zero "ISO" bytes everywhere
  // MBR
  img.fill(0, 0x1be, 0x1fe);
  img[0x1be] = 0x80;
  img.writeUInt32LE(Math.floor(total / 512), 0x1be + 12);
  const p1 = 0x1be + 16;
  img[p1 + 4] = 0xef;
  img.writeUInt32LE(spec.espStartLba, p1 + 8);
  img.writeUInt32LE(spec.espSectors, p1 + 12);
  img.writeUInt16LE(0xaa55, 0x1fe);
  // ESP: zero it, then format
  img.fill(0, espOff, espOff + spec.espSectors * 512);
  const bs = img.subarray(espOff, espOff + 512);
  bs[0] = 0xeb;
  bs[1] = 0x3c;
  bs[2] = 0x90;
  bs.write("mkfs.fat", 3, "latin1");
  bs.writeUInt16LE(512, 0x0b);
  bs[0x0d] = spec.sectorsPerCluster;
  bs.writeUInt16LE(spec.reservedSectors, 0x0e);
  bs[0x10] = 2;
  bs.writeUInt16LE(spec.rootEntries, 0x11);
  bs.writeUInt16LE(spec.espSectors, 0x13);
  bs[0x15] = 0xf8;
  bs.writeUInt16LE(spec.fatSectors, 0x16);
  bs[0x26] = 0x29;
  bs.write("EFIBOOT    ", 0x2b, "latin1");
  bs.write(spec.fatType === 12 ? "FAT12   " : "FAT16   ", 0x36, "latin1");
  bs.writeUInt16LE(0xaa55, 0x1fe);
  // FATs
  for (let f = 0; f < 2; f++) {
    const fat = img.subarray(espOff + (spec.reservedSectors + f * spec.fatSectors) * 512, espOff + (spec.reservedSectors + (f + 1) * spec.fatSectors) * 512);
    fixtureFatSet(spec.fatType, fat, 0, spec.fatType === 12 ? 0xff8 : 0xfff8);
    fixtureFatSet(spec.fatType, fat, 1, spec.fatType === 12 ? 0xfff : 0xffff);
    for (let k = 0; k < spec.occupiedClusters; k++) {
      const c = 2 + k;
      const last = k === spec.occupiedClusters - 1;
      fixtureFatSet(spec.fatType, fat, c, last ? (spec.fatType === 12 ? 0xfff : 0xffff) : c + 1);
    }
  }
  // Root directory: label, EFI dir, a DELETED entry, then free.
  const rootOff = espOff + (spec.reservedSectors + 2 * spec.fatSectors) * 512;
  const e0 = img.subarray(rootOff, rootOff + 32);
  e0.write("EFIBOOT    ", 0, "latin1");
  e0[11] = 0x08;
  const e1 = img.subarray(rootOff + 32, rootOff + 64);
  e1.write("EFI        ", 0, "latin1");
  e1[11] = 0x10;
  e1.writeUInt16LE(0x0021, 16);
  e1.writeUInt16LE(2, 26);
  const e2 = img.subarray(rootOff + 64, rootOff + 96);
  e2.write("OLDFILE TXT", 0, "latin1");
  e2[0] = 0xe5; // one deleted slot: too small for a 3-slot LFN run on its own
  e2[11] = 0x20;
  return img;
}

export interface FixtureFile {
  readonly longName: string | null;
  readonly short11: string;
  readonly attr: number;
  readonly firstCluster: number;
  readonly size: number;
  readonly lfnOrdinals: readonly number[];
  readonly chainFat0: readonly number[];
  readonly chainFat1: readonly number[];
  readonly content: Buffer;
}

function fixtureFatGet(fatType: 12 | 16, fat: Buffer, c: number): number {
  if (fatType === 16) return fat.readUInt16LE(c * 2);
  const o = Math.floor((c * 3) / 2);
  const w = fat[o]! | (fat[o + 1]! << 8);
  return c % 2 === 0 ? w & 0xfff : w >> 4;
}

function fixtureChecksum(short11: Buffer): number {
  let s = 0;
  for (const b of short11) s = (((s >> 1) | ((s & 1) << 7)) + b) & 0xff;
  return s;
}

const LFN_CHAR_OFFSETS = [1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30];

/**
 * Independent reader: MBR -> ESP -> BPB -> root dir -> LFN (checksum-verified)
 * -> cluster chain in BOTH FATs -> content. Throws on anything malformed.
 */
export function readFixtureRoot(img: Buffer): { fatType: 12 | 16; files: FixtureFile[] } {
  let espOff = -1;
  for (let p = 0; p < 4; p++) {
    const o = 0x1be + p * 16;
    if (img[o + 4] === 0xef) espOff = img.readUInt32LE(o + 8) * 512;
  }
  if (espOff <= 0) throw new Error("fixture reader: no ESP");
  const bs = img.subarray(espOff, espOff + 512);
  const spc = bs[0x0d]!;
  const rsv = bs.readUInt16LE(0x0e);
  const nf = bs[0x10]!;
  const re = bs.readUInt16LE(0x11);
  const tot = bs.readUInt16LE(0x13) || bs.readUInt32LE(0x20);
  const fsz = bs.readUInt16LE(0x16);
  const rootSecs = Math.ceil((re * 32) / 512);
  const clusters = Math.floor((tot - rsv - nf * fsz - rootSecs) / spc);
  const fatType: 12 | 16 = clusters < 4085 ? 12 : 16;
  const fats = [0, 1].map((f) => img.subarray(espOff + (rsv + f * fsz) * 512, espOff + (rsv + (f + 1) * fsz) * 512));
  const rootOff = espOff + (rsv + nf * fsz) * 512;
  const dataOff = rootOff + rootSecs * 512;
  const eocMin = fatType === 12 ? 0xff8 : 0xfff8;
  const chain = (fat: Buffer, first: number): number[] => {
    const out: number[] = [];
    let c = first;
    while (c >= 2 && c < eocMin) {
      if (out.includes(c) || out.length > clusters) throw new Error("fixture reader: loop");
      out.push(c);
      c = fixtureFatGet(fatType, fat, c);
      if (c === 0) throw new Error("fixture reader: chain hits free cluster");
    }
    return out;
  };
  const files: FixtureFile[] = [];
  let lfn: Buffer[] = [];
  for (let i = 0; i < re; i++) {
    const e = img.subarray(rootOff + i * 32, rootOff + i * 32 + 32);
    if (e[0] === 0) break;
    if (e[0] === 0xe5) {
      lfn = [];
      continue;
    }
    if (e[11] === 0x0f) {
      lfn.push(e);
      continue;
    }
    const short = e.subarray(0, 11);
    let longName: string | null = null;
    const ordinals = lfn.map((x) => x[0]!);
    if (lfn.length > 0) {
      const ck = fixtureChecksum(short);
      if (lfn.some((x) => x[13] !== ck)) throw new Error(`fixture reader: LFN checksum mismatch for ${short.toString("latin1")}`);
      const ordered = [...lfn].sort((a, b) => (a[0]! & 0x1f) - (b[0]! & 0x1f));
      let s = "";
      outer: for (const x of ordered) {
        for (const off of LFN_CHAR_OFFSETS) {
          const u = x.readUInt16LE(off);
          if (u === 0 || u === 0xffff) break outer;
          s += String.fromCharCode(u);
        }
      }
      longName = s;
    }
    lfn = [];
    const first = e.readUInt16LE(26);
    const size = e.readUInt32LE(28);
    const isFile = (e[11]! & 0x18) === 0;
    const c0 = isFile && size > 0 ? chain(fats[0]!, first) : [];
    const c1 = isFile && size > 0 ? chain(fats[1]!, first) : [];
    const cb = spc * 512;
    const content = Buffer.concat(c0.map((c) => img.subarray(dataOff + (c - 2) * cb, dataOff + (c - 1) * cb))).subarray(0, size);
    files.push({
      longName,
      short11: short.toString("latin1"),
      attr: e[11]!,
      firstCluster: first,
      size,
      lfnOrdinals: ordinals,
      chainFat0: c0,
      chainFat1: c1,
      content,
    });
  }
  return { fatType, files };
}
