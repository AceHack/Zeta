// Count-Min Sketch — TypeScript parity oracle (pure). Byte-identical to the F# canonical
// shape (src/Core/CountMin.fs) on the deterministic core: add(baseHash, weight) uses SplitMix
// row seeds + a SplitMix mix + fastrange column selection. BigInt for 64-bit math. (The .NET
// HashCode.Combine convenience hash is not portable and is intentionally absent.)
const MASK64 = 0xffffffffffffffffn;
const K1 = 0x9e3779b97f4a7c15n;
const KB = 0xbf58476d1ce4e5b9n;
const KC = 0x94d049bb133111ebn;
const mul64 = (a, b) => (a * b) & MASK64;
// signed 64-bit wrap for counter arithmetic (table is i64)
const wrapI64 = (x) => {
    const m = ((x % (1n << 64n)) + (1n << 64n)) % (1n << 64n); // to unsigned 64
    return m >= 1n << 63n ? m - (1n << 64n) : m;
};
export class CountMinSketch {
    depth;
    width;
    table;
    rowSeeds;
    constructor(depth, width, seed) {
        if (depth < 1 || depth > 32)
            throw new Error("depth must be 1..32");
        if (width < 8)
            throw new Error("width must be >= 8");
        this.depth = depth;
        this.width = width;
        this.table = new Array(depth * width).fill(0n);
        const s = seed & MASK64;
        this.rowSeeds = Array.from({ length: depth }, (_unused, i) => {
            let z = mul64(s, K1) ^ mul64(BigInt(i), KB);
            z = mul64(z ^ (z >> 30n), KB);
            z = mul64(z ^ (z >> 27n), KC);
            return (z ^ (z >> 31n)) & MASK64;
        });
    }
    /** A copy of the raw counter table (row-major). */
    snapshot() {
        return this.table.slice();
    }
    static columnFor(hash, w) {
        const hash32 = hash & 0xffffffffn;
        return Number((hash32 * BigInt(w)) >> 32n);
    }
    colAt(baseHash, row) {
        const rowSeed = this.rowSeeds[row];
        if (rowSeed === undefined)
            throw new Error("row out of bounds");
        let z = (baseHash & MASK64) ^ rowSeed;
        z = mul64(z ^ (z >> 30n), KB);
        z = mul64(z ^ (z >> 27n), KC);
        return CountMinSketch.columnFor(z ^ (z >> 31n), this.width);
    }
    /** Add `weight` at `baseHash` (the deterministic, portable entry point). */
    add(baseHash, weight) {
        for (let row = 0; row < this.depth; row++) {
            const idx = row * this.width + this.colAt(baseHash, row);
            this.table[idx] = wrapI64(this.table[idx] + weight);
        }
    }
    /** Min-row estimate (overestimate for insertion-only streams). */
    estimate(baseHash) {
        let result = (1n << 63n) - 1n; // i64 max
        for (let row = 0; row < this.depth; row++) {
            const v = this.table[row * this.width + this.colAt(baseHash, row)];
            if (v < result)
                result = v;
        }
        return result === (1n << 63n) - 1n ? 0n : result;
    }
    /** Elementwise add (CRDT monoid merge). */
    union(other) {
        if (other.depth !== this.depth || other.width !== this.width)
            throw new Error("dimension mismatch");
        for (let i = 0; i < this.table.length; i++)
            this.table[i] = wrapI64(this.table[i] + other.table[i]);
    }
}
