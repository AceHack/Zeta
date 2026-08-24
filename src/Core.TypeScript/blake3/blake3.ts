import { blake3 } from "@noble/hashes/blake3.js";
import type { MerkleHash } from "../merkle/merkle.ts";

/**
 * **ContentHash256** — the full 256-bit raw BLAKE3 digest (the proof tier; treaty `081KTH59TVZ`).
 */
export class ContentHash256 {
  readonly raw: Uint8Array;

  constructor(raw: Uint8Array) {
    if (raw.length !== 32) {
      throw new Error("BLAKE3-256 digest must be exactly 32 bytes.");
    }
    this.raw = raw;
  }

  /** Lowercase hex of the raw 32 bytes (no reversal) — the canonical proof rendering. */
  toHex(): string {
    return Array.from(this.raw)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  equals(other: ContentHash256): boolean {
    if (this.raw.length !== other.raw.length) return false;
    for (let i = 0; i < this.raw.length; i++) {
      if (this.raw[i] !== other.raw[i]) return false;
    }
    return true;
  }

  /** The full raw BLAKE3-256 digest of bytes (32 bytes, raw order). */
  static ofBytes(bytes: Uint8Array): ContentHash256 {
    return new ContentHash256(blake3(bytes));
  }

  /** Parse a 32-byte BLAKE3-256 digest from its hex string representation (allows optional 'blake3:' prefix). */
  static ofHex(hex: string): ContentHash256 {
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
  static toContentAddress128(h: ContentHash256): MerkleHash {
    const view = new DataView(h.raw.buffer, h.raw.byteOffset, h.raw.byteLength);
    const lo = view.getBigUint64(0, true);
    const hi = view.getBigUint64(8, true);
    return { hi, lo };
  }
}

/**
 * **IContentHasher** interface definition in TypeScript (matching the hexagonal port).
 */
export interface IContentHasher {
  readonly name: string;
  hash(bytes: Uint8Array): MerkleHash;
}

/**
 * **Blake3Hasher** — the TS implementation of the BLAKE3 ContentHasher.
 */
export class Blake3Hasher implements IContentHasher {
  readonly name = "blake3";

  hash(bytes: Uint8Array): MerkleHash {
    const digest = blake3(bytes);
    const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
    const lo = view.getBigUint64(0, true);
    const hi = view.getBigUint64(8, true);
    return { hi, lo };
  }
}

export const hasher: IContentHasher = new Blake3Hasher();
