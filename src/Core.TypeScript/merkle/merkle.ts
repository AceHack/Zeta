// Merkle integrity — TypeScript parity oracle (#4 of TS/F#/C#/Rust), pure (no dependency).
//
// Conforms byte-for-byte to the F# canonical shape (src/Core/Merkle.fs): each leaf is hashed
// with XXH3-128 (./xxh3.ts, pure-TS, no dep — per Aaron's "pure-TS XxHash128 (no dep)"
// decision) and internal nodes combine two child hashes by concatenating their little-endian
// Hi/Lo halves and re-hashing. A tree over the same leaves yields a BYTE-IDENTICAL root in
// F#, C#, Rust, and TS — verified by merkle.test.ts against vectors generated from F#.

import { xxh3_128 } from "./xxh3";

const MASK64 = 0xffffffffffffffffn;

const swap64 = (x: bigint): bigint => {
  let r = 0n;
  for (let i = 0; i < 8; i++) r = (r << 8n) | ((x >> BigInt(8 * i)) & 0xffn);
  return r;
};

const hex16 = (x: bigint): string => x.toString(16).padStart(16, "0");

/** A Merkle hash — 128 bits (hi/lo), matching the F#/C#/Rust MerkleHash. */
export interface MerkleHash {
  readonly hi: bigint;
  readonly lo: bigint;
}

export const ZERO: MerkleHash = { hi: 0n, lo: 0n };

/** Hex representation (hi then lo, 16 hex digits each) — matches the other oracles' ToHex. */
export const toHex = (h: MerkleHash): string => hex16(h.hi) + hex16(h.lo);

/**
 * Hash a leaf into a MerkleHash. .NET's XxHash128 emits the XXH128 canonical big-endian form,
 * so F#'s Hi/Lo are the byte-swaps of xxh3_128's low/high halves (see Rust adapter).
 */
export function ofBytes(bytes: Uint8Array): MerkleHash {
  const { low, high } = xxh3_128(bytes);
  return { hi: swap64(low), lo: swap64(high) };
}

const writeU64LE = (buf: Uint8Array, off: number, x: bigint): void => {
  for (let i = 0; i < 8; i++) buf[off + i] = Number((x >> BigInt(8 * i)) & 0xffn);
};

/** Combine two child hashes into a parent (the internal-node construction). */
export function combine(a: MerkleHash, b: MerkleHash): MerkleHash {
  const buf = new Uint8Array(32);
  writeU64LE(buf, 0, a.hi & MASK64);
  writeU64LE(buf, 8, a.lo & MASK64);
  writeU64LE(buf, 16, b.hi & MASK64);
  writeU64LE(buf, 24, b.lo & MASK64);
  return ofBytes(buf);
}

/**
 * Merkle tree over a sequence of leaf blobs, built bottom-up (duplicate-last-leaf for odd
 * fan-in). The root is byte-identical to F#/C#/Rust over the same leaves.
 */
export class MerkleTree {
  private readonly levels: MerkleHash[][];

  constructor(leaves: Uint8Array[]) {
    const level0 = leaves.map(ofBytes);
    const all: MerkleHash[][] = [level0];
    let cur = level0;
    while (cur.length > 1) {
      const parent: MerkleHash[] = [];
      for (let i = 0; i < cur.length; i += 2) {
        const left = cur[i];
        const right = i + 1 < cur.length ? cur[i + 1] : left; // duplicate last for odd
        parent.push(combine(left, right));
      }
      all.push(parent);
      cur = parent;
    }
    this.levels = all;
  }

  /** Root digest — byte-identical to the F#/C#/Rust root over the same leaves. */
  root(): MerkleHash {
    const top = this.levels[this.levels.length - 1];
    return top.length === 0 ? ZERO : top[0];
  }

  /** The leaf hashes (level 0), useful for diffing. */
  leafHashes(): readonly MerkleHash[] {
    return this.levels[0];
  }
}
