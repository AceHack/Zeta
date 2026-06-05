//! FastCDC content-defined chunking (Xia et al., USENIX ATC 2016; arXiv:1706.03410), Rust oracle.
//!
//! Conforms to the F# canonical shape (`src/Core/FastCdc.fs`, `FastCdc.chunkAll`) by agreeing on the
//! shared seed (`src/Core.TypeScript/fastcdc/golden-vectors.json`) that the C#/F#/TS oracles also verify.
//! Pure wrapping `u64` — the Gear table is `SplitMix64.mix(i)` (builds on the 4-lang-proven SplitMix64),
//! the rolling hash is `(hash << 1) + GEAR[byte]`, normalized masks 2^15-1 / 2^11-1.

const GOLDEN_RATIO: u64 = 0x9E3779B97F4A7C15;
const VIGNA_A: u64 = 0xBF58476D1CE4E5B9;
const VIGNA_B: u64 = 0x94D049BB133111EB;

fn mix(x: u64) -> u64 {
    let mut z = x.wrapping_mul(GOLDEN_RATIO);
    z = (z ^ (z >> 30)).wrapping_mul(VIGNA_A);
    z = (z ^ (z >> 27)).wrapping_mul(VIGNA_B);
    z ^ (z >> 31)
}

/// The GEAR lookup table: 256 entries, `table[i] = SplitMix64.mix(i)`.
pub fn gear_table() -> Vec<u64> {
    (0..256u64).map(mix).collect()
}

/// Deterministic test byte stream: `byte[i] = mix(i) & 0xFF`.
pub fn gen_bytes(count: usize) -> Vec<u8> {
    (0..count as u64).map(|i| (mix(i) & 0xFF) as u8).collect()
}

const MASK_S: u64 = (1 << 15) - 1; // stricter (offset < avg)
const MASK_L: u64 = (1 << 11) - 1; // looser (offset >= avg)

/// Chunk an entire byte slice; returns the chunk LENGTHS in order (boundaries fully determine the cut).
/// Mirrors `FastCdc.chunkAll` (one-shot push + flush) exactly.
pub fn chunk_lengths(bytes: &[u8], min: usize, avg: usize, max: usize) -> Vec<usize> {
    let gear = gear_table();
    let n = bytes.len();
    let mut lengths = Vec::new();
    let mut head = 0usize;
    while head < n {
        let mut end = n; // default: flush trailing remainder as one chunk
        if head + min < n {
            let mut hash = 0u64;
            let mut i = head + min;
            while i < n {
                hash = (hash << 1).wrapping_add(gear[bytes[i] as usize]);
                let offset = i - head;
                let mask = if offset < avg { MASK_S } else { MASK_L };
                if hash & mask == 0 {
                    end = i + 1;
                    break;
                } else if offset + 1 >= max {
                    end = i + 1;
                    break;
                }
                i += 1;
            }
        }
        lengths.push(end - head);
        head = end;
    }
    lengths
}
