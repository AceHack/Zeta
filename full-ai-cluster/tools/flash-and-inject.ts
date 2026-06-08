#!/usr/bin/env bun
/**
 * flash-and-inject.ts — flash the AI-cluster installer ISO to a Windows USB
 * AND inject the operator SSH pubkey, for the REMOVABLE-MEDIA case that
 * flash-usb-windows.ts cannot handle.
 *
 * Why a separate path from flash-usb-windows.ts: that tool takes the disk
 * offline (Set-Disk -IsOffline) and injects the key by MOUNTING the ESP.
 * Neither works on removable USB sticks flashed with an isohybrid ISO:
 *   - Set-Disk -IsOffline => "Removable media cannot be set to offline".
 *   - Windows mounts the flashed ISO9660 read-only (CDFS), so the ESP mounts
 *     write-protected ("The media is write protected") and the key write
 *     fails — leaving a bootable-but-KEYLESS USB.
 * (Both confirmed on a PNY USB 3.2.1 FD, 2026-06-07.)
 *
 * One elevated process instead:
 *   1. mountvol /R + /N (purge stale registrations + disable auto-mount) then
 *      Clear-Disk (force-dismount + blank) so no volume locks the disk.
 *   2. Raw-write the installer ISO to \\.\PhysicalDriveN on a single handle.
 *   3. Inject the pubkey into the FAT12 ESP via RAW SECTOR I/O (no mount): the
 *      inject geometry is computed from the ISO's in-memory head (zero device
 *      reads between the ISO write and the FAT writes) so the writes land
 *      before Windows can auto-mount + re-lock the ESP (the cause of EBADF).
 *   4. fsync, rescan, re-enable auto-mount, read-back verify (incl. LFN
 *      reconstruction so the installer reads "zeta-authorized-keys.pub").
 *
 * Reuses the shared, unit-tested pure helpers from flash-usb-windows.ts
 * (autoDiscoverIso / validateIso / human). Must run from an ELEVATED shell.
 *
 * argv: <device> <keyFile> <log>   (ISO auto-discovered from Downloads)
 */
import {
  appendFileSync,
  closeSync,
  fstatSync,
  fsyncSync,
  openSync,
  readFileSync,
  readSync,
  writeSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { autoDiscoverIso, human, validateIso } from "./flash-usb-windows.ts";

const device = process.argv[2] ?? "\\\\.\\PhysicalDrive3";
const keyFile = process.argv[3]!;
const log = process.argv[4] ?? "D:\\Zeta\\.flash-inject.log";
const diskNum = Number((device.match(/PhysicalDrive(\d+)/) ?? [])[1] ?? 3);
const ESP_NAME = "zeta-authorized-keys.pub";
const SHORT = "ZETA-A~1PUB";

function W(s: string): void {
  appendFileSync(log, s + "\n");
  process.stdout.write(s + "\n");
}
function fail(m: string): never {
  W(`RESULT:FAIL-${m}`);
  process.exit(1);
}
function ps(s: string): string {
  return execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", s], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

// ── raw aligned device IO ────────────────────────────────────────────
function readRegion(fd: number, off: number, len: number): Buffer {
  if (off % 512 || len % 512) throw new Error(`unaligned read off=${off} len=${len}`);
  const buf = Buffer.allocUnsafe(len);
  let got = 0;
  while (got < len) {
    const n = readSync(fd, buf, got, len - got, off + got);
    if (n <= 0) break;
    got += n;
  }
  if (got !== len) throw new Error(`short read ${got}/${len}@${off}`);
  return buf;
}
function writeRegion(fd: number, off: number, buf: Buffer): void {
  if (off % 512 || buf.length % 512) throw new Error(`unaligned write off=${off} len=${buf.length}`);
  let put = 0;
  while (put < buf.length) {
    const n = writeSync(fd, buf, put, buf.length - put, off + put);
    if (n <= 0) break;
    put += n;
  }
  if (put !== buf.length) throw new Error(`short write ${put}/${buf.length}@${off}`);
}

// ── FAT12 helpers ────────────────────────────────────────────────────
function fat12Get(fat: Buffer, c: number): number {
  const o = Math.floor((c * 3) / 2);
  const pair = fat[o]! | (fat[o + 1]! << 8);
  return c & 1 ? pair >> 4 : pair & 0x0fff;
}
function fat12Set(fat: Buffer, c: number, v: number): void {
  const o = Math.floor((c * 3) / 2);
  if (c & 1) {
    fat[o] = (fat[o]! & 0x0f) | ((v << 4) & 0xf0);
    fat[o + 1] = (v >> 4) & 0xff;
  } else {
    fat[o] = v & 0xff;
    fat[o + 1] = (fat[o + 1]! & 0xf0) | ((v >> 8) & 0x0f);
  }
}
function lfnChecksum(s11: Buffer): number {
  let sum = 0;
  for (let i = 0; i < 11; i++) sum = ((((sum & 1) << 7) | (sum >> 1)) + s11[i]!) & 0xff;
  return sum;
}
const LFN_SLOTS = [1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30];
function lfnEntry(name: string, base: number, seqByte: number, cksum: number): Buffer {
  const e = Buffer.alloc(32, 0);
  e[0] = seqByte;
  e[11] = 0x0f;
  e[13] = cksum;
  for (let p = 0; p < 13; p++) {
    const g = base + p;
    const code = g < name.length ? name.charCodeAt(g) : g === name.length ? 0 : 0xffff;
    e.writeUInt16LE(code, LFN_SLOTS[p]!);
  }
  return e;
}

// ── 1. resolve ISO + key ─────────────────────────────────────────────
const isoPath = autoDiscoverIso(join(homedir(), "Downloads"));
if (!isoPath) fail("no-iso");
const isoFd0 = openSync(isoPath, "r");
const isoSize = fstatSync(isoFd0).size;
closeSync(isoFd0);
const v = validateIso(isoPath, isoSize, true);
if (!v.ok) fail(`iso-${v.message}`);
const body = Buffer.from(readFileSync(keyFile, "utf8").replace(/\r\n/g, "\n").replace(/\n+$/, "") + "\n", "utf8");
W(`=== flash-and-inject device=${device} iso=${isoPath} (${human(isoSize)}) key=${keyFile} (${body.length}B) ===`);

// ── 1b. disable auto-mount of NEW volumes for the whole operation, so the
// freshly-flashed ISO9660 never gets mounted (and thus never locks the disk
// against our raw FAT writes). Re-enabled at the end.
try {
  // Purge stale MountMgr volume registrations first. After repeated flashes
  // Windows caches this USB's prior volume GUIDs and auto-mounts the new
  // ISO9660 by GUID *despite* /N — which re-locks the ESP region mid-inject
  // (EBADF). /R clears those so /N actually takes effect.
  execFileSync("mountvol", ["/R"], { encoding: "utf8" });
  W(`stale mount registrations purged (mountvol /R)`);
} catch (e) {
  W(`mountvol /R skipped: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
}
try {
  execFileSync("mountvol", ["/N"], { encoding: "utf8" });
  W(`automount disabled (mountvol /N)`);
} catch (e) {
  W(`mountvol /N failed (continuing): ${e instanceof Error ? e.message.split("\n")[0] : e}`);
}

// ── 2. force-dismount + blank the disk (Clear-Disk; diskpart fallback) ─
try {
  ps(`Set-Disk -Number ${diskNum} -IsReadOnly $false -ErrorAction SilentlyContinue`);
} catch {
  /* ignore */
}
try {
  ps(`Clear-Disk -Number ${diskNum} -RemoveData -RemoveOEM -Confirm:$false -ErrorAction Stop`);
  W(`Clear-Disk ok`);
} catch (e) {
  W(`Clear-Disk failed (${e instanceof Error ? e.message.split("\n")[0] : e}); trying diskpart clean`);
  try {
    const t = join(process.env.TEMP ?? "C:\\Windows\\Temp", `zclean-${process.pid}.txt`);
    require("node:fs").writeFileSync(t, `select disk ${diskNum}\r\nclean\r\n`, "ascii");
    W(execFileSync("diskpart", ["/s", t], { encoding: "utf8" }).trim());
  } catch (e2) {
    fail(`cannot-blank-disk ${e2 instanceof Error ? e2.message.split("\n")[0] : e2}`);
  }
}

// ── 3+4. open ONE handle; write ISO then inject; never rescan first ───
const SECTOR = 4096; // pad unit (works for 512 & 4096 drives)
const ISO_HEAD = 256 * 1024; // covers MBR + the whole FAT12 ESP metadata
let isoHead = Buffer.alloc(0); // in-memory copy of the ISO head (set after write)
const fd = openSync(device, "r+");
try {
 try {
  // 3. raw ISO copy, sector-padded.
  W(`writing ISO -> ${device} ...`);
  const isoFd = openSync(isoPath, "r");
  try {
    const chunk = 4 * 1024 * 1024;
    const buf = Buffer.allocUnsafe(chunk);
    let written = 0;
    let srcPos = 0;
    let lastBucket = -1;
    while (srcPos < isoSize) {
      const n = readSync(isoFd, buf, 0, chunk, srcPos);
      if (n <= 0) break;
      let len = n;
      if (len % SECTOR !== 0) {
        const padded = Math.ceil(len / SECTOR) * SECTOR;
        buf.fill(0, len, padded);
        len = padded;
      }
      writeSync(fd, buf, 0, len, written);
      written += len;
      srcPos += n;
      const bucket = Math.floor((srcPos / isoSize) * 10);
      if (bucket !== lastBucket) {
        lastBucket = bucket;
        W(`  ${Math.floor((srcPos / isoSize) * 100)}% (${human(Math.min(srcPos, isoSize))}/${human(isoSize)})`);
      }
    }
    // Capture the ISO's first 256 KiB (MBR + the whole FAT12 ESP metadata)
    // from the SOURCE FILE so the key-inject computes from this in-memory copy
    // and performs ZERO device reads between the ISO write and the FAT writes.
    // Those intervening device reads were the gap in which Windows auto-mounts
    // and locks the ESP (write -> EBADF). Also defer fsync to the very end so
    // we go straight from the last ISO byte to the FAT writes.
    isoHead = Buffer.alloc(ISO_HEAD);
    readSync(isoFd, isoHead, 0, ISO_HEAD, 0);
    W(`ISO write complete (${human(written)}); captured ${ISO_HEAD >> 10}KiB head for inject`);
  } finally {
    closeSync(isoFd);
  }

  // 4. find the EFI System Partition (type 0xEF) by scanning all 4 MBR slots
  //    of the IN-MEMORY ISO head (no device read).
  const mbr = isoHead.subarray(0, 512);
  let partOffset = 0;
  let espLBA = 0;
  for (let p = 0; p < 4; p++) {
    const o = 0x1be + p * 16;
    const type = mbr[o + 4]!;
    const lba = mbr.readUInt32LE(o + 8);
    const cnt = mbr.readUInt32LE(o + 12);
    W(`MBR[${p}]: type=0x${type.toString(16)} startLBA=${lba} sectors=${cnt}`);
    if (type === 0xef && lba > 0) {
      espLBA = lba;
      partOffset = lba * 512;
    }
  }
  // Fallback: this ISO's ESP is deterministically at LBA 276 (offset 141312).
  if (!partOffset) {
    partOffset = 141312;
    W(`no 0xEF entry found; falling back to known ESP offset ${partOffset}`);
  }
  W(`ESP at offset ${partOffset} (LBA ${espLBA || partOffset / 512})`);
  // Confirm it's a FAT BPB before trusting it (from the in-memory head).
  {
    const probe = isoHead.subarray(partOffset, partOffset + 512);
    const fsLabel = probe.subarray(0x36, 0x3b).toString("latin1");
    if (probe.readUInt16LE(0x1fe) !== 0xaa55 || !fsLabel.startsWith("FAT")) {
      fail(`esp-not-fat probeLabel='${fsLabel}' sig=0x${probe.readUInt16LE(0x1fe).toString(16)}`);
    }
  }

  // BPB / geometry (from the in-memory head).
  const bpb = isoHead.subarray(partOffset, partOffset + 512);
  const bps = bpb.readUInt16LE(0x0b);
  const spc = bpb.readUInt8(0x0d);
  const reserved = bpb.readUInt16LE(0x0e);
  const numFATs = bpb.readUInt8(0x10);
  const rootEntCnt = bpb.readUInt16LE(0x11);
  const fatSz16 = bpb.readUInt16LE(0x16);
  const totSec = bpb.readUInt16LE(0x13) || bpb.readUInt32LE(0x20);
  const rootDirSectors = Math.ceil((rootEntCnt * 32) / bps);
  const countOfClusters = Math.floor((totSec - (reserved + numFATs * fatSz16 + rootDirSectors)) / spc);
  if (countOfClusters >= 4085) fail(`not-FAT12 clusters=${countOfClusters}`);
  const clusterBytes = spc * bps;
  if (body.length > clusterBytes) fail(`key-too-big ${body.length}>${clusterBytes}`);
  const fat0Off = partOffset + reserved * bps;
  const fatLen = fatSz16 * bps;
  const rootOff = partOffset + (reserved + numFATs * fatSz16) * bps;
  const rootLen = rootDirSectors * bps;
  const dataOff = partOffset + (reserved + numFATs * fatSz16 + rootDirSectors) * bps;
  const clusOff = (c: number) => dataOff + (c - 2) * clusterBytes;

  // Writable COPIES of root dir + FAT from the in-memory ISO head (modified
  // then written back to the device). No device read.
  const root = Buffer.from(isoHead.subarray(rootOff, rootOff + rootLen));
  const fat0 = Buffer.from(isoHead.subarray(fat0Off, fat0Off + fatLen));
  let cluster = -1;
  for (let c = 2; c < countOfClusters + 2; c++)
    if (fat12Get(fat0, c) === 0) {
      cluster = c;
      break;
    }
  if (cluster < 0) fail("no-free-cluster");
  let slot = -1;
  for (let i = 0; i + 2 < rootEntCnt; i++) {
    const f = (k: number) => root[k * 32] === 0x00 || root[k * 32] === 0xe5;
    if (f(i) && f(i + 1) && f(i + 2)) {
      slot = i;
      break;
    }
  }
  if (slot < 0) fail("no-free-dir-slot");
  W(`inject: cluster=${cluster} dirSlot=${slot} clusterBytes=${clusterBytes}`);

  // write body cluster
  const cb = Buffer.alloc(clusterBytes, 0);
  body.copy(cb);
  writeRegion(fd, clusOff(cluster), cb);
  // EOC in every FAT copy
  for (let f = 0; f < numFATs; f++) {
    const fOff = partOffset + (reserved + f * fatSz16) * bps;
    const fb = f === 0 ? fat0 : Buffer.from(isoHead.subarray(fOff, fOff + fatLen));
    fat12Set(fb, cluster, 0xfff);
    writeRegion(fd, fOff, fb);
  }
  // directory entries
  const s11 = Buffer.from(SHORT, "latin1");
  const cks = lfnChecksum(s11);
  const lfnCount = Math.ceil(ESP_NAME.length / 13);
  const se = Buffer.alloc(32, 0);
  s11.copy(se, 0);
  se[11] = 0x20;
  se.writeUInt16LE(0x5c21, 0x10);
  se.writeUInt16LE(0x5c21, 0x12);
  se.writeUInt16LE(0x5c21, 0x18);
  se.writeUInt16LE(cluster, 0x1a);
  se.writeUInt32LE(body.length, 0x1c);
  const ents: Buffer[] = [];
  for (let seq = lfnCount; seq >= 1; seq--) ents.push(lfnEntry(ESP_NAME, (seq - 1) * 13, (seq === lfnCount ? 0x40 : 0) | seq, cks));
  ents.push(se);
  for (let k = 0; k < ents.length; k++) ents[k]!.copy(root, (slot + k) * 32);
  writeRegion(fd, rootOff, root);
  fsyncSync(fd);
  W(`wrote dir entries (short='${SHORT}', lfn='${ESP_NAME}', cksum=0x${cks.toString(16)})`);

  // read-back verify with LFN reconstruction
  const root2 = readRegion(fd, rootOff, rootLen);
  let ok = false;
  let pend: { ord: number; ch: number[] }[] = [];
  for (let i = 0; i < rootEntCnt; i++) {
    const e = root2.subarray(i * 32, i * 32 + 32);
    if (e[0] === 0x00) break;
    if (e[0] === 0xe5) {
      pend = [];
      continue;
    }
    if (e[11] === 0x0f) {
      pend.push({ ord: e[0]! & 0x1f, ch: LFN_SLOTS.map((s) => e.readUInt16LE(s)) });
      continue;
    }
    if (e.subarray(0, 11).toString("latin1") === SHORT) {
      const maxOrd = pend.reduce((m, p) => Math.max(m, p.ord), 0);
      const arr = new Array(maxOrd * 13).fill(0xffff);
      for (const p of pend) for (let k = 0; k < 13; k++) arr[(p.ord - 1) * 13 + k] = p.ch[k]!;
      let ln = "";
      for (const c of arr) {
        if (c === 0 || c === 0xffff) break;
        ln += String.fromCharCode(c);
      }
      const clus = e.readUInt16LE(0x1a);
      const sz = e.readUInt32LE(0x1c);
      const data = readRegion(fd, clusOff(clus), clusterBytes).subarray(0, sz);
      ok = ln === ESP_NAME && sz === body.length && data.equals(body);
      W(`verify: reconstructedLFN='${ln}' size=${sz} contentOk=${data.equals(body)} -> ${ok}`);
      break;
    }
    pend = [];
  }
  if (!ok) fail("readback-mismatch");
 } catch (e) {
   W(`EXCEPTION: ${e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)}`);
   try { execFileSync("mountvol", ["/E"], { encoding: "utf8" }); } catch {}
   fail("exception");
 }
} finally {
  closeSync(fd);
}

// ── 5. re-enable auto-mount + rescan so the table is re-read for removal ─
try {
  execFileSync("mountvol", ["/E"], { encoding: "utf8" });
  W(`automount re-enabled (mountvol /E)`);
} catch {
  /* best effort */
}
try {
  const t = join(process.env.TEMP ?? "C:\\Windows\\Temp", `zrescan-${process.pid}.txt`);
  require("node:fs").writeFileSync(t, "rescan\r\n", "ascii");
  execFileSync("diskpart", ["/s", t], { encoding: "utf8" });
} catch {
  /* best effort */
}
W("RESULT:OK");
