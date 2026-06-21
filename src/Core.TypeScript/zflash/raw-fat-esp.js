// Pure FAT12 ESP geometry + authorized-keys inject planning (no block I/O).
// Used by flash-and-inject.ts and fat-inspect.ts.
import { detectIsohybridEspOffsetBytes } from "./lib.js";
import { buildDirEntries, fat12Get, fat12Set, firstFreeCluster, firstFreeDirSlots, reconstructLongName, } from "./fat12-lib.js";
export function parseFat12Bpb(bpb, partOffset) {
    const bps = bpb.readUInt16LE(11);
    const spc = bpb[13];
    const rsv = bpb.readUInt16LE(14);
    const fatCnt = bpb[16];
    const rootEnt = bpb.readUInt16LE(17);
    const totSec16 = bpb.readUInt16LE(19);
    const fatSz16 = bpb.readUInt16LE(22);
    const totSec32 = bpb.readUInt32LE(32);
    const totalSectors = totSec16 !== 0 ? totSec16 : totSec32;
    if (bps !== 512 || spc === 0 || fatCnt === 0 || rootEnt === 0 || totalSectors === 0) {
        return { error: "invalid BPB geometry" };
    }
    const fatStart = partOffset + rsv * bps;
    const rootStart = fatStart + fatCnt * fatSz16 * bps;
    const rootBytes = rootEnt * 32;
    const dataStart = rootStart + rootBytes;
    return {
        partOffset,
        bps,
        spc,
        rsv,
        fatCnt,
        fatSz16,
        rootEnt,
        totSec16,
        totSec32,
        fatStart,
        rootStart,
        dataStart,
        totalSectors,
        fatBytes: fatCnt * fatSz16 * bps,
        rootBytes,
    };
}
export function resolveEspGeometry(isoHead) {
    const espOffset = detectIsohybridEspOffsetBytes(isoHead);
    if (espOffset === null)
        return { error: "could not locate ESP partition in ISO MBR" };
    const bpb = isoHead.subarray(espOffset + 512, espOffset + 1024);
    if (bpb.toString("ascii", 0, 8) !== "MSWIN4.1") {
        return { error: "ESP BPB signature mismatch (expected MSWIN4.1)" };
    }
    return parseFat12Bpb(bpb, espOffset);
}
export function buildShortDirEntry(shortName, cluster) {
    const entry = Buffer.alloc(32, 0);
    Buffer.from(shortName.padEnd(11, " ").slice(0, 11), "ascii").copy(entry, 0);
    entry[11] = 0x20;
    entry.writeUInt16LE(cluster, 26);
    return entry;
}
export function planAuthorizedKeysInject(params) {
    const geomOrErr = resolveEspGeometry(params.isoHead);
    if ("error" in geomOrErr)
        return geomOrErr;
    const geom = geomOrErr;
    const fat = Buffer.alloc(geom.fatBytes);
    params.isoHead.copy(fat, 0, geom.fatStart, geom.fatStart + geom.fatBytes);
    const root = Buffer.alloc(geom.rootBytes);
    params.isoHead.copy(root, 0, geom.rootStart, geom.rootStart + geom.rootBytes);
    const cluster = firstFreeCluster(fat, Math.floor(geom.fatBytes / (512 * 3 / 2)));
    if (cluster < 2)
        return { error: "no free FAT12 clusters" };
    const slotsNeeded = Math.ceil(params.longName.length / 13) + 1;
    const slotIndex = firstFreeDirSlots(root, geom.rootBytes, slotsNeeded);
    if (slotIndex < 0)
        return { error: "no free root directory slots" };
    const shortEntry = buildShortDirEntry(params.shortName, cluster);
    const dirEntries = buildDirEntries(params.longName, Buffer.from(params.shortName, "ascii"), shortEntry);
    fat12Set(fat, cluster, 0xfff);
    const dataOffset = geom.dataStart + (cluster - 2) * geom.spc * geom.bps;
    return {
        geom,
        fat,
        root,
        dirEntries,
        dirSlotOffset: slotIndex * 32,
        cluster,
        dataOffset,
        body: params.body,
    };
}
export function verifyAuthorizedKeysInRoot(root, rootBytes, longName, shortName) {
    for (let i = 0; i < rootBytes; i += 32) {
        const entry = root.subarray(i, i + 32);
        if (entry[0] === 0x00 || entry[0] === 0xe5)
            continue;
        if (entry[11] === 0x0f)
            continue;
        const name = entry.subarray(0, 11).toString("ascii").trimEnd();
        if (name !== shortName)
            continue;
        const lfnPieces = [];
        for (let j = i - 32; j >= 0; j -= 32) {
            const lfn = root.subarray(j, j + 32);
            if (lfn[11] !== 0x0f)
                break;
            lfnPieces.unshift(lfn);
        }
        if (lfnPieces.length > 0 && reconstructLongName(lfnPieces) === longName)
            return true;
    }
    return false;
}
export { fat12Get, fat12Set, reconstructLongName };
