import { test, expect } from "bun:test";
import bloomGolden from "./golden-vectors-bloom.json";
import cmsGolden from "./golden-vectors-countmin.json";
import { BlockedBloomFilter } from "./bloom";
import { CountMinSketch } from "./countmin";
// Cross-language byte-lock: the TS sketches must match the F# implementations byte-for-byte
// over the same inputs. Fixtures generated from src/Core/{BloomFilter,CountMin}.fs. If these
// pass, TS agrees with F#/C#/Rust — closing metric's 4-lang leg.
const hex16 = (x) => x.toString(16).padStart(16, "0");
test("Bloom table matches F# golden vectors", () => {
    const g = bloomGolden;
    const f = new BlockedBloomFilter(g.bucketCount, g.probesPerLookup);
    for (const k of g.keys)
        f.add(BigInt(k));
    const got = f.rawTable().map(hex16);
    expect(got).toEqual(g.table);
});
test("CountMin table matches F# golden vectors", () => {
    const g = cmsGolden;
    const c = new CountMinSketch(g.depth, g.width, BigInt(g.seed));
    for (const h of g.baseHashes)
        c.add(BigInt("0x" + h), 1n);
    const got = c.snapshot().map((v) => v.toString());
    expect(got).toEqual(g.table);
});
test("Bloom no-false-negative on the golden keys", () => {
    const g = bloomGolden;
    const f = new BlockedBloomFilter(g.bucketCount, g.probesPerLookup);
    for (const k of g.keys)
        f.add(BigInt(k));
    for (const k of g.keys)
        expect(f.mayContain(BigInt(k))).toBe(true);
});
