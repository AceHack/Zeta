#!/usr/bin/env bun
/**
 * fat-inspect.ts — read-only inspector for a flashed USB's EFI System
 * Partition (FAT12). Companion verifier for flash-and-inject.ts.
 *
 * Run: bun src/Core.TypeScript/zflash/fat-inspect.ts <device> <partByteOffset> [log]
 */
import { closeSync, openSync, readSync, appendFileSync } from "node:fs";
const device = process.argv[2] ?? "\\\\.\\PhysicalDrive3";
const partOffset = Number(process.argv[3] ?? 141312);
const log = process.argv[4] ?? "D:\\Zeta\\.fat-inspect.log";
const SS = 512;
function W(s) {
    appendFileSync(log, s + "\n");
    process.stdout.write(s + "\n");
}
function readAligned(fd, byteOffset, byteLen) {
    const start = Math.floor(byteOffset / SS) * SS;
    const end = Math.ceil((byteOffset + byteLen) / SS) * SS;
    const buf = Buffer.allocUnsafe(end - start);
    let got = 0;
    while (got < buf.length) {
        const n = readSync(fd, buf, got, buf.length - got, start + got);
        if (n <= 0)
            break;
        got += n;
    }
    return buf.subarray(byteOffset - start, byteOffset - start + byteLen);
}
const fd = openSync(device, "r");
try {
    W(`=== fat-inspect ${device} partOffset=${partOffset} ===`);
    const bpb = readAligned(fd, partOffset, SS);
    const u16 = (o) => bpb.readUInt16LE(o);
    const u8 = (o) => bpb.readUInt8(o);
    const u32 = (o) => bpb.readUInt32LE(o);
    const bytesPerSector = u16(0x0b);
    const secPerClus = u8(0x0d);
    const reserved = u16(0x0e);
    const numFATs = u8(0x10);
    const rootEntCnt = u16(0x11);
    const totSec16 = u16(0x13);
    const media = u8(0x15);
    const fatSz16 = u16(0x16);
    const totSec32 = u32(0x20);
    const oem = bpb.subarray(0x03, 0x0b).toString("latin1");
    const fsType = bpb.subarray(0x36, 0x3e).toString("latin1");
    const sig = u16(0x1fe);
    const totSec = totSec16 !== 0 ? totSec16 : totSec32;
    const rootDirSectors = Math.ceil((rootEntCnt * 32) / bytesPerSector);
    const firstRootDirSec = reserved + numFATs * fatSz16;
    const firstDataSec = reserved + numFATs * fatSz16 + rootDirSectors;
    const dataSec = totSec - firstDataSec;
    const countOfClusters = Math.floor(dataSec / secPerClus);
    const fatTypeName = countOfClusters < 4085 ? "FAT12" : countOfClusters < 65525 ? "FAT16" : "FAT32";
    W(`OEM='${oem}' fsTypeLabel='${fsType}' bootSig=0x${sig.toString(16)}`);
    W(`bytesPerSector=${bytesPerSector} secPerClus=${secPerClus} reserved=${reserved} numFATs=${numFATs}`);
    W(`rootEntCnt=${rootEntCnt} totSec=${totSec} media=0x${media.toString(16)} fatSz16=${fatSz16}`);
    W(`rootDirSectors=${rootDirSectors} firstRootDirSec=${firstRootDirSec} firstDataSec=${firstDataSec}`);
    W(`dataSec=${dataSec} countOfClusters=${countOfClusters} => ${fatTypeName}`);
    W(`clusterSizeBytes=${secPerClus * bytesPerSector}`);
    W(`BPB[0..63] hex: ${bpb.subarray(0, 64).toString("hex")}`);
    // Root directory: list existing 8.3 entries + count free slots.
    const rootBytes = readAligned(fd, partOffset + firstRootDirSec * bytesPerSector, rootDirSectors * bytesPerSector);
    let used = 0, free = 0, lfn = 0, endSeen = false;
    const names = [];
    for (let i = 0; i < rootEntCnt; i++) {
        const e = rootBytes.subarray(i * 32, i * 32 + 32);
        const first = e[0];
        if (first === 0x00) {
            free++;
            endSeen = true;
            continue;
        }
        if (first === 0xe5) {
            free++;
            continue;
        }
        const attr = e[11] ?? 0;
        if (attr === 0x0f) {
            lfn++;
            continue;
        }
        used++;
        const nm = e.subarray(0, 11).toString("latin1");
        const clus = e.readUInt16LE(0x1a);
        const sz = e.readUInt32LE(0x1c);
        names.push(`'${nm}' attr=0x${attr.toString(16)} clus=${clus} size=${sz}`);
    }
    W(`root entries: used=${used} lfn=${lfn} free(approx)=${free} endSeen=${endSeen}`);
    for (const n of names)
        W(`  ${n}`);
    // Count free clusters in FAT copy #0.
    const fatStart = partOffset + reserved * bytesPerSector;
    const fatBytes = readAligned(fd, fatStart, fatSz16 * bytesPerSector);
    let freeClusters = 0;
    let firstFree = -1;
    for (let c = 2; c < countOfClusters + 2; c++) {
        let val;
        if (fatTypeName === "FAT12") {
            const off = Math.floor((c * 3) / 2);
            const pair = (fatBytes[off] ?? 0) | ((fatBytes[off + 1] ?? 0) << 8);
            val = c & 1 ? pair >> 4 : pair & 0x0fff;
        }
        else {
            val = fatBytes.readUInt16LE(c * 2);
        }
        if (val === 0) {
            freeClusters++;
            if (firstFree < 0)
                firstFree = c;
        }
    }
    W(`FAT: freeClusters=${freeClusters} firstFreeCluster=${firstFree} fatStartByte=${fatStart}`);
    W(`=== inspect done ===`);
}
finally {
    closeSync(fd);
}
