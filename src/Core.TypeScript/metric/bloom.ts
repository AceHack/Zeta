// Blocked Bloom filter — TypeScript parity oracle (pure; reuses the pure-TS XXH3-128 from the
// merkle port). Byte-identical to the F# canonical shape (src/Core/BloomFilter.fs): keys hash
// via XXH3-128, (h1,h2)=(high64,low64), bucket = high 32 bits of h1, then probesPerLookup bits
// set in one 512-bit bucket by double-hashing. BigInt for 64-bit math.

import { xxh3_128 } from "../merkle/xxh3";

const MASK64 = 0xffffffffffffffffn;
const WORDS_PER_BUCKET = 8;

function pairOfInt64(key: bigint): [bigint, bigint] {
  const buf = new Uint8Array(8);
  let k = key & MASK64;
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(k & 0xffn);
    k >>= 8n;
  }
  const { low, high } = xxh3_128(buf);
  return [high, low]; // h1 = high64, h2 = low64 (numeric, matches .NET HashToUInt128)
}

export class BlockedBloomFilter {
  private readonly table: bigint[];
  private readonly bucketCount: number;
  private readonly probes: number;
  private readonly bucketMask: bigint;
  private readonly isPow2: boolean;

  constructor(bucketCount: number, probes: number) {
    if (bucketCount <= 0) throw new Error("bucketCount must be positive");
    if (probes <= 0 || probes > 32) throw new Error("probes must be 1..32");
    this.bucketCount = bucketCount;
    this.probes = probes;
    this.table = new Array<bigint>(bucketCount * WORDS_PER_BUCKET).fill(0n);
    this.bucketMask = (bucketCount & (bucketCount - 1)) === 0 ? BigInt(bucketCount - 1) : 0n;
    this.isPow2 = this.bucketMask !== 0n || bucketCount === 1;
  }

  /** Raw bit-table (for serialization / cross-language comparison). */
  rawTable(): readonly bigint[] {
    return this.table;
  }

  private bucketIndex(h1: bigint): number {
    const hi = (h1 >> 32n) & 0xffffffffn;
    return this.isPow2 ? Number(hi & this.bucketMask) : Number(hi % BigInt(this.bucketCount));
  }

  private setBucketBits(base: number, h1: bigint, h2: bigint): void {
    let h = h1;
    for (let i = 0; i < this.probes; i++) {
      const bit = Number(h & 0x1ffn);
      const w = bit >> 6;
      const b = bit & 0x3f;
      this.table[base + w] = this.table[base + w]! | (1n << BigInt(b));
      h = (h + h2 + BigInt(i)) & MASK64;
    }
  }

  private testBucketBits(base: number, h1: bigint, h2: bigint): boolean {
    let h = h1;
    for (let i = 0; i < this.probes; i++) {
      const bit = Number(h & 0x1ffn);
      const w = bit >> 6;
      const b = bit & 0x3f;
      if ((this.table[base + w]! & (1n << BigInt(b))) === 0n) return false;
      h = (h + h2 + BigInt(i)) & MASK64;
    }
    return true;
  }

  /** Add an int64 key (BigInt). */
  add(key: bigint): void {
    const [h1, h2] = pairOfInt64(key);
    this.setBucketBits(this.bucketIndex(h1) * WORDS_PER_BUCKET, h1, h2);
  }

  /** Membership test for an int64 key. */
  mayContain(key: bigint): boolean {
    const [h1, h2] = pairOfInt64(key);
    return this.testBucketBits(this.bucketIndex(h1) * WORDS_PER_BUCKET, h1, h2);
  }

  /** OR-merge another filter of the same shape (CRDT union). */
  mergeFrom(other: BlockedBloomFilter): void {
    if (other.table.length !== this.table.length) throw new Error("table length differs");
    if (other.probes !== this.probes) throw new Error("probe count differs");
    for (let i = 0; i < this.table.length; i++) this.table[i] = this.table[i]! | other.table[i]!;
  }
}
