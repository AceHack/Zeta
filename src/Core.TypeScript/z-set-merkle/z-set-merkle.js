import { ofBytes } from "../merkle/merkle";
/** Lexicographic ordinal comparison of two byte arrays. */
function byteCompare(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) {
            return a[i] - b[i];
        }
    }
    return a.length - b.length;
}
/** Canonical leaf encoding for one entry: [4-byte LE keyLen][keyBytes][8-byte LE weight]. */
function leafBytes(keyBytes, weight) {
    const buf = new Uint8Array(4 + keyBytes.length + 8);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    view.setInt32(0, keyBytes.length, true);
    buf.set(keyBytes, 4);
    view.setBigInt64(4 + keyBytes.length, weight, true);
    return buf;
}
/** Combine two child digests into a parent: 32 LE bytes a.Hi a.Lo b.Hi b.Lo, re-hashed. */
function combine(hash, a, b) {
    const buf = new Uint8Array(32);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    view.setBigUint64(0, a.hi, true);
    view.setBigUint64(8, a.lo, true);
    view.setBigUint64(16, b.hi, true);
    view.setBigUint64(24, b.lo, true);
    return hash(buf);
}
/** Fold a level of digests bottom-up; an odd trailing node is promoted (duplicated). */
function fold(hash, level) {
    if (level.length === 0) {
        return hash(new Uint8Array(0));
    }
    let cur = level;
    while (cur.length > 1) {
        const parent = [];
        for (let i = 0; i < cur.length; i += 2) {
            const left = cur[i];
            const right = i + 1 < cur.length ? cur[i + 1] : left;
            parent.push(combine(hash, left, right));
        }
        cur = parent;
    }
    return cur[0];
}
/**
 * Canonical Merkle root over z with an explicit hash function. Leaves = (key, weight) entries
 * encoded + sorted by key bytes (ordinal); folded bottom-up. Deterministic + retraction-native.
 */
export function rootWith(hash, encodeKey, z) {
    const leavesTemp = z.map((e) => ({
        kb: encodeKey(e.e),
        w: e.w,
    }));
    leavesTemp.sort((a, b) => byteCompare(a.kb, b.kb));
    const leaves = leavesTemp.map((e) => hash(leafBytes(e.kb, BigInt(e.w))));
    return fold(hash, leaves);
}
/**
 * Canonical Merkle root using the default digest (XxHash128 via MerkleHash).
 */
export function root(encodeKey, z) {
    return rootWith(ofBytes, encodeKey, z);
}
