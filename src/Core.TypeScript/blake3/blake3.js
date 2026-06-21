import { blake3 } from "@noble/hashes/blake3.js";
/**
 * **ContentHash256** — the full 256-bit raw BLAKE3 digest (the proof tier; treaty `081KTH59TVZ`).
 */
export class ContentHash256 {
    raw;
    constructor(raw) {
        if (raw.length !== 32) {
            throw new Error("BLAKE3-256 digest must be exactly 32 bytes.");
        }
        this.raw = raw;
    }
    /** Lowercase hex of the raw 32 bytes (no reversal) — the canonical proof rendering. */
    toHex() {
        return Array.from(this.raw)
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }
    equals(other) {
        if (this.raw.length !== other.raw.length)
            return false;
        for (let i = 0; i < this.raw.length; i++) {
            if (this.raw[i] !== other.raw[i])
                return false;
        }
        return true;
    }
    /** The full raw BLAKE3-256 digest of bytes (32 bytes, raw order). */
    static ofBytes(bytes) {
        return new ContentHash256(blake3(bytes));
    }
    /** Parse a 32-byte BLAKE3-256 digest from its hex string representation (allows optional 'blake3:' prefix). */
    static ofHex(hex) {
        const clean = hex.startsWith("blake3:") ? hex.slice(7) : hex;
        if (clean.length !== 64) {
            throw new Error("BLAKE3-256 hex string must be exactly 64 characters.");
        }
        const raw = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            raw[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
        }
        return new ContentHash256(raw);
    }
    /** Derive the compact ContentAddress128 (MerkleHash) from the full digest. */
    static toContentAddress128(h) {
        const view = new DataView(h.raw.buffer, h.raw.byteOffset, h.raw.byteLength);
        const lo = view.getBigUint64(0, true);
        const hi = view.getBigUint64(8, true);
        return { hi, lo };
    }
}
/**
 * **Blake3Hasher** — the TS implementation of the BLAKE3 ContentHasher.
 */
export class Blake3Hasher {
    name = "blake3";
    hash(bytes) {
        const digest = blake3(bytes);
        const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
        const lo = view.getBigUint64(0, true);
        const hi = view.getBigUint64(8, true);
        return { hi, lo };
    }
}
export const hasher = new Blake3Hasher();
