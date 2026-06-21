// esp-inject.ts — inject a small file (the operator SSH pubkey) into the FAT12
// EFI System Partition of an *isohybrid installer ISO*, by RAW region writes to
// an open fd. The fd may be a regular FILE (inject into the .iso before flashing
// — reliable: no Windows mount/lock/RO-medium semantics) or a block device.
//
// NOTE: this targets the isohybrid ISO layout (FAT BPB at the ESP partOffset,
// FAT label at 0x36) — distinct from raw-fat-esp.ts, which parses the
// file-backed zflash image layout (BPB at +512, OEM "MSWIN4.1"). FAT12 nibble
// packing + LFN entry building are shared from fat12-lib.ts.
//
// Pure + fd-driven so it is unit-testable against a real .iso copy without a USB
// stick (see esp-inject.test.ts). flash-and-inject.ts composes this with the raw
// device write.
import { fsyncSync, readSync, writeSync } from "node:fs";
import { buildLfnEntry, fat12Get, fat12Set, LFN_SLOTS, lfnChecksum } from "./fat12-lib.js";
export const ESP_NAME = "zeta-authorized-keys.pub";
export const SHORT = "ZETA-A~1PUB";
// ── raw aligned region IO (works on a file fd or a \\.\PhysicalDriveN fd) ──
export function readRegion(fd, off, len) {
    if (off % 512 || len % 512)
        throw new Error(`unaligned read off=${off} len=${len}`);
    const buf = Buffer.allocUnsafe(len);
    let got = 0;
    while (got < len) {
        const n = readSync(fd, buf, got, len - got, off + got);
        if (n <= 0)
            break;
        got += n;
    }
    if (got !== len)
        throw new Error(`short read ${got}/${len}@${off}`);
    return buf;
}
export function writeRegion(fd, off, buf) {
    if (off % 512 || buf.length % 512)
        throw new Error(`unaligned write off=${off} len=${buf.length}`);
    let put = 0;
    while (put < buf.length) {
        const n = writeSync(fd, buf, put, buf.length - put, off + put);
        if (n <= 0)
            break;
        put += n;
    }
    if (put !== buf.length)
        throw new Error(`short write ${put}/${buf.length}@${off}`);
}
const noop = (_) => { };
/** Parse the isohybrid ISO's FAT12 ESP geometry from a head buffer (>=256 KiB). */
export function parseEspGeom(head, log = noop) {
    const mbr = head.subarray(0, 512);
    let partOffset = 0, espLBA = 0;
    for (let p = 0; p < 4; p++) {
        const o = 0x1be + p * 16;
        const type = mbr[o + 4];
        const lba = mbr.readUInt32LE(o + 8);
        log(`MBR[${p}]: type=0x${type.toString(16)} startLBA=${lba} sectors=${mbr.readUInt32LE(o + 12)}`);
        if (type === 0xef && lba > 0) {
            espLBA = lba;
            partOffset = lba * 512;
        }
    }
    if (!partOffset) {
        partOffset = 141312;
        log(`no 0xEF entry; fallback ESP offset ${partOffset}`);
    }
    log(`ESP at offset ${partOffset} (LBA ${espLBA || partOffset / 512})`);
    const bpb = head.subarray(partOffset, partOffset + 512);
    const fsLabel = bpb.subarray(0x36, 0x3b).toString("latin1");
    if (bpb.readUInt16LE(0x1fe) !== 0xaa55 || !fsLabel.startsWith("FAT"))
        throw new Error(`esp-not-fat label='${fsLabel}'`);
    const bps = bpb.readUInt16LE(0x0b);
    const spc = bpb.readUInt8(0x0d);
    const reserved = bpb.readUInt16LE(0x0e);
    const numFATs = bpb.readUInt8(0x10);
    const rootEntCnt = bpb.readUInt16LE(0x11);
    const fatSz16 = bpb.readUInt16LE(0x16);
    const totSec = bpb.readUInt16LE(0x13) || bpb.readUInt32LE(0x20);
    const rootDirSectors = Math.ceil((rootEntCnt * 32) / bps);
    const countOfClusters = Math.floor((totSec - (reserved + numFATs * fatSz16 + rootDirSectors)) / spc);
    if (countOfClusters >= 4085)
        throw new Error(`not-FAT12 clusters=${countOfClusters}`);
    const clusterBytes = spc * bps;
    const fat0Off = partOffset + reserved * bps;
    const fatLen = fatSz16 * bps;
    const rootOff = partOffset + (reserved + numFATs * fatSz16) * bps;
    const rootLen = rootDirSectors * bps;
    const dataOff = partOffset + (reserved + numFATs * fatSz16 + rootDirSectors) * bps;
    return { partOffset, bps, reserved, numFATs, fatSz16, rootEntCnt, clusterBytes,
        fat0Off, fatLen, rootOff, rootLen, dataOff, countOfClusters,
        clusOff: (c) => dataOff + (c - 2) * clusterBytes };
}
/** Write `body` as the file ESP_NAME into the ESP. Throws on any failure. */
export function injectKeyIntoEsp(fd, body, log = noop) {
    const g = parseEspGeom(readRegion(fd, 0, 256 * 1024), log);
    if (body.length > g.clusterBytes)
        throw new Error(`key-too-big ${body.length}>${g.clusterBytes}`);
    const fat0 = readRegion(fd, g.fat0Off, g.fatLen);
    const root = readRegion(fd, g.rootOff, g.rootLen);
    let cluster = -1;
    for (let c = 2; c < g.countOfClusters + 2; c++)
        if (fat12Get(fat0, c) === 0) {
            cluster = c;
            break;
        }
    if (cluster < 0)
        throw new Error("no-free-cluster");
    let slot = -1;
    for (let i = 0; i + 2 < g.rootEntCnt; i++) {
        const f = (k) => root[k * 32] === 0x00 || root[k * 32] === 0xe5;
        if (f(i) && f(i + 1) && f(i + 2)) {
            slot = i;
            break;
        }
    }
    if (slot < 0)
        throw new Error("no-free-dir-slot");
    log(`inject: cluster=${cluster} dirSlot=${slot} clusterBytes=${g.clusterBytes}`);
    // body cluster
    const cb = Buffer.alloc(g.clusterBytes, 0);
    body.copy(cb);
    writeRegion(fd, g.clusOff(cluster), cb);
    // EOC marker in every FAT copy
    for (let f = 0; f < g.numFATs; f++) {
        const fOff = g.partOffset + (g.reserved + f * g.fatSz16) * g.bps;
        const fb = f === 0 ? fat0 : readRegion(fd, fOff, g.fatLen);
        fat12Set(fb, cluster, 0xfff);
        writeRegion(fd, fOff, fb);
    }
    // directory entries (LFN chain + 8.3 short)
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
    const ents = [];
    for (let seq = lfnCount; seq >= 1; seq--)
        ents.push(buildLfnEntry(ESP_NAME, (seq - 1) * 13, (seq === lfnCount ? 0x40 : 0) | seq, cks));
    ents.push(se);
    for (let k = 0; k < ents.length; k++)
        ents[k].copy(root, (slot + k) * 32);
    writeRegion(fd, g.rootOff, root);
    fsyncSync(fd);
    if (!verifyKeyInEsp(fd, body, log))
        throw new Error("inject-readback-mismatch");
    log(`inject verified ('${ESP_NAME}', ${body.length}B)`);
}
/** Read the ESP back from `fd` and confirm ESP_NAME exists with exactly `body`. */
export function verifyKeyInEsp(fd, body, log = noop) {
    const g = parseEspGeom(readRegion(fd, 0, 256 * 1024), log);
    const root2 = readRegion(fd, g.rootOff, g.rootLen);
    let pend = [];
    for (let i = 0; i < g.rootEntCnt; i++) {
        const e = root2.subarray(i * 32, i * 32 + 32);
        if (e[0] === 0x00)
            break;
        if (e[0] === 0xe5) {
            pend = [];
            continue;
        }
        if (e[11] === 0x0f) {
            pend.push({ ord: e[0] & 0x1f, ch: LFN_SLOTS.map((s) => e.readUInt16LE(s)) });
            continue;
        }
        if (e.subarray(0, 11).toString("latin1") === SHORT) {
            const maxOrd = pend.reduce((m, p) => Math.max(m, p.ord), 0);
            const arr = new Array(maxOrd * 13).fill(0xffff);
            for (const p of pend)
                for (let k = 0; k < 13; k++)
                    arr[(p.ord - 1) * 13 + k] = p.ch[k];
            let ln = "";
            for (const c of arr) {
                if (c === 0 || c === 0xffff)
                    break;
                ln += String.fromCharCode(c);
            }
            const sz = e.readUInt32LE(0x1c);
            const data = readRegion(fd, g.clusOff(e.readUInt16LE(0x1a)), g.clusterBytes).subarray(0, sz);
            const ok = ln === ESP_NAME && sz === body.length && data.equals(body);
            log(`verify: LFN='${ln}' size=${sz} contentOk=${data.equals(body)} -> ${ok}`);
            return ok;
        }
        pend = [];
    }
    return false;
}
