// FastCDC content-defined chunking (Xia et al., USENIX ATC 2016; arXiv:1706.03410), TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/FastCdc.fs, FastCdc.chunkAll) by agreeing on the shared
// seed (./golden-vectors.json) that the C#/F#/Rust oracles also verify. Pure wrapping uint64 in BigInt
// masked to 64 bits — the Gear table is SplitMix64.mix(i) (builds on the 4-lang-proven SplitMix64).
const MASK64 = (1n << 64n) - 1n;
const GOLDEN_RATIO = 0x9e3779b97f4a7c15n;
const VIGNA_A = 0xbf58476d1ce4e5b9n;
const VIGNA_B = 0x94d049bb133111ebn;
function mix(x) {
    let z = (x * GOLDEN_RATIO) & MASK64;
    z = ((z ^ (z >> 30n)) * VIGNA_A) & MASK64;
    z = ((z ^ (z >> 27n)) * VIGNA_B) & MASK64;
    return (z ^ (z >> 31n)) & MASK64;
}
/** The GEAR lookup table: 256 entries, table[i] = SplitMix64.mix(i). */
export function gearTable() {
    const t = [];
    for (let i = 0; i < 256; i++)
        t.push(mix(BigInt(i)));
    return t;
}
/** Deterministic test byte stream: byte[i] = mix(i) & 0xFF. */
export function genBytes(count) {
    const out = [];
    for (let i = 0; i < count; i++)
        out.push(Number(mix(BigInt(i)) & 0xffn));
    return out;
}
const MASK_S = (1n << 15n) - 1n; // stricter (offset < avg)
const MASK_L = (1n << 11n) - 1n; // looser (offset >= avg)
/** Chunk an entire byte array; returns the chunk LENGTHS in order. Mirrors FastCdc.chunkAll. */
export function chunkLengths(bytes, min, avg, max) {
    const gear = gearTable();
    const n = bytes.length;
    const lengths = [];
    let head = 0;
    while (head < n) {
        let end = n; // default: flush trailing remainder as one chunk
        if (head + min < n) {
            let hash = 0n;
            let i = head + min;
            while (i < n) {
                hash = ((hash << 1n) + gear[bytes[i]]) & MASK64;
                const offset = i - head;
                const mask = offset < avg ? MASK_S : MASK_L;
                if ((hash & mask) === 0n) {
                    end = i + 1;
                    break;
                }
                else if (offset + 1 >= max) {
                    end = i + 1;
                    break;
                }
                i++;
            }
        }
        lengths.push(end - head);
        head = end;
    }
    return lengths;
}
