// src/Core.TypeScript/zflash/fat12-lib.ts
//
// Pure FAT12 + VFAT long-filename (LFN) helpers — the byte-level logic behind
// flash-and-inject.ts's raw key injection, extracted so it is importable and
// UNIT-TESTED (fat12-lib.test.ts) rather than living inline in a script that
// runs on import. No side effects; safe to import anywhere.
//
// The installer reads the operator key off the ESP by its LONG name
// (`zeta-authorized-keys.pub`), so the write/read symmetry of these functions
// is load-bearing: a bug here = a keyless USB. The tests pin it.
// ── FAT12 cluster table (12-bit packed entries) ──────────────────────
export function fat12Get(fat, c) {
    const o = Math.floor((c * 3) / 2);
    const pair = fat[o] | (fat[o + 1] << 8);
    return c & 1 ? pair >> 4 : pair & 0x0fff;
}
export function fat12Set(fat, c, v) {
    const o = Math.floor((c * 3) / 2);
    if (c & 1) {
        fat[o] = (fat[o] & 0x0f) | ((v << 4) & 0xf0);
        fat[o + 1] = (v >> 4) & 0xff;
    }
    else {
        fat[o] = v & 0xff;
        fat[o + 1] = (fat[o + 1] & 0xf0) | ((v >> 8) & 0x0f);
    }
}
// ── VFAT long-filename entries ───────────────────────────────────────
// Checksum of the 11-byte 8.3 short name (must match in every LFN entry, or a
// vfat reader discards the long name and falls back to the short alias).
export function lfnChecksum(short11) {
    let sum = 0;
    for (let i = 0; i < 11; i++)
        sum = ((((sum & 1) << 7) | (sum >> 1)) + short11[i]) & 0xff;
    return sum;
}
// The 13 UTF-16LE character positions inside a 32-byte LFN entry.
export const LFN_SLOTS = [1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30];
// Build one 32-byte LFN entry. `base` = index of the first of this entry's 13
// chars within the long name; `seqByte` = ordinal (0x40 OR'd on the last piece).
export function buildLfnEntry(name, base, seqByte, cksum) {
    const e = Buffer.alloc(32, 0);
    e[0] = seqByte;
    e[11] = 0x0f; // LFN attribute
    e[13] = cksum;
    for (let p = 0; p < 13; p++) {
        const g = base + p;
        const code = g < name.length ? name.charCodeAt(g) : g === name.length ? 0x0000 : 0xffff;
        e.writeUInt16LE(code, LFN_SLOTS[p]);
    }
    return e;
}
/**
 * Build the full set of 32-byte directory entries for a long name (the LFN
 * pieces in on-disk order — highest ordinal first, 0x40 flagged — followed by
 * the caller-supplied short entry). Mirrors what flash-and-inject.ts writes.
 */
export function buildDirEntries(longName, short11, shortEntry) {
    const cks = lfnChecksum(short11);
    const lfnCount = Math.ceil(longName.length / 13);
    const out = [];
    for (let seq = lfnCount; seq >= 1; seq--) {
        out.push(buildLfnEntry(longName, (seq - 1) * 13, (seq === lfnCount ? 0x40 : 0) | seq, cks));
    }
    out.push(shortEntry);
    return out;
}
/**
 * Reconstruct a long name from its LFN entries exactly as the Linux vfat
 * driver does — this is what the installer effectively runs to read the key
 * filename. `lfnEntries` are the 32-byte LFN entries (attr 0x0f) preceding a
 * short entry, in on-disk order.
 */
export function reconstructLongName(lfnEntries) {
    const pend = lfnEntries.map((e) => ({ ord: e[0] & 0x1f, ch: LFN_SLOTS.map((s) => e.readUInt16LE(s)) }));
    const maxOrd = pend.reduce((m, p) => Math.max(m, p.ord), 0);
    const arr = new Array(maxOrd * 13).fill(0xffff);
    for (const p of pend)
        for (let k = 0; k < 13; k++)
            arr[(p.ord - 1) * 13 + k] = p.ch[k];
    let name = "";
    for (const code of arr) {
        if (code === 0x0000 || code === 0xffff)
            break;
        name += String.fromCharCode(code);
    }
    return name;
}
// ── FAT free-space planning (pure) ───────────────────────────────────
/** First free cluster (FAT entry == 0) in [2, countOfClusters+2), or -1. */
export function firstFreeCluster(fat, countOfClusters) {
    for (let c = 2; c < countOfClusters + 2; c++)
        if (fat12Get(fat, c) === 0)
            return c;
    return -1;
}
/** First index of `n` consecutive free 32-byte dir slots (0x00 or 0xE5), or -1. */
export function firstFreeDirSlots(root, rootEntCnt, n) {
    const free = (k) => root[k * 32] === 0x00 || root[k * 32] === 0xe5;
    for (let i = 0; i + (n - 1) < rootEntCnt; i++) {
        let ok = true;
        for (let j = 0; j < n; j++)
            if (!free(i + j)) {
                ok = false;
                break;
            }
        if (ok)
            return i;
    }
    return -1;
}
