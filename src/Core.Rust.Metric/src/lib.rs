//! Metric / aggregation sketches — Rust parity oracle (#4 of TS/F#/C#/Rust).
//!
//! Byte-identical to the F# canonical shapes (`src/Core/BloomFilter.fs`, `src/Core/CountMin.fs`)
//! on the deterministic CORE. [`BlockedBloomFilter`]: keys → XXH3-128 → (h1,h2)=(high64,low64)
//! → bucket + probe bits. [`CountMinSketch`]: `add(base_hash, weight)` → SplitMix row seed +
//! SplitMix mix + fastrange column. (The `.NET HashCode.Combine` convenience hash is not
//! portable and is intentionally absent.) Verified against golden vectors generated from F#
//! (tests/golden_vectors.rs).

#![forbid(unsafe_code)]

const WORDS_PER_BUCKET: usize = 8;

/// Insert-only blocked Bloom filter (XXH3-128 keys). Table byte-identical to F#/C#/TS.
pub struct BlockedBloomFilter {
    table: Vec<u64>,
    bucket_count: usize,
    probes_per_lookup: usize,
    bucket_mask: u32,
    is_pow2: bool,
}

impl BlockedBloomFilter {
    /// Create an empty filter.
    pub fn new(bucket_count: usize, probes_per_lookup: usize) -> Self {
        assert!(bucket_count > 0, "bucket_count must be positive");
        assert!((1..=32).contains(&probes_per_lookup), "probes must be 1..32");
        let bucket_mask = if bucket_count & (bucket_count - 1) == 0 { (bucket_count - 1) as u32 } else { 0 };
        let is_pow2 = bucket_mask != 0 || bucket_count == 1;
        Self {
            table: vec![0u64; bucket_count * WORDS_PER_BUCKET],
            bucket_count,
            probes_per_lookup,
            bucket_mask,
            is_pow2,
        }
    }

    /// Raw bit-table (for serialization / cross-language comparison).
    pub fn table(&self) -> &[u64] {
        &self.table
    }

    fn bucket_index(&self, h1: u64) -> usize {
        let hi = (h1 >> 32) as u32;
        if self.is_pow2 {
            (hi & self.bucket_mask) as usize
        } else {
            (hi % self.bucket_count as u32) as usize
        }
    }

    fn set_bucket_bits(&mut self, base: usize, h1: u64, h2: u64) {
        let mut h = h1;
        for i in 0..self.probes_per_lookup {
            let bit = (h & 0x1FF) as usize;
            let w = bit >> 6;
            let b = bit & 0x3F;
            self.table[base + w] |= 1u64 << b;
            h = h.wrapping_add(h2).wrapping_add(i as u64);
        }
    }

    fn test_bucket_bits(&self, base: usize, h1: u64, h2: u64) -> bool {
        let mut h = h1;
        for i in 0..self.probes_per_lookup {
            let bit = (h & 0x1FF) as usize;
            let w = bit >> 6;
            let b = bit & 0x3F;
            if self.table[base + w] & (1u64 << b) == 0 {
                return false;
            }
            h = h.wrapping_add(h2).wrapping_add(i as u64);
        }
        true
    }

    /// XXH3-128 of `bytes`; (h1,h2) = (high64, low64) of the numeric hash (no byte-swap —
    /// this mirrors .NET `XxHash128.HashToUInt128`, distinct from the byte-serialized form).
    #[cfg(feature = "xxh3")]
    fn pair(bytes: &[u8]) -> (u64, u64) {
        let v = xxhash_rust::xxh3::xxh3_128(bytes);
        ((v >> 64) as u64, v as u64)
    }

    /// Add an int64 key (little-endian bytes), matching F# `pairOfInt64`.
    #[cfg(feature = "xxh3")]
    pub fn add(&mut self, key: i64) {
        let (h1, h2) = Self::pair(&key.to_le_bytes());
        let base = self.bucket_index(h1) * WORDS_PER_BUCKET;
        self.set_bucket_bits(base, h1, h2);
    }

    /// Membership test for an int64 key.
    #[cfg(feature = "xxh3")]
    pub fn may_contain(&self, key: i64) -> bool {
        let (h1, h2) = Self::pair(&key.to_le_bytes());
        let base = self.bucket_index(h1) * WORDS_PER_BUCKET;
        self.test_bucket_bits(base, h1, h2)
    }

    /// OR-merge another filter of the same shape (CRDT union).
    pub fn merge_from(&mut self, other: &BlockedBloomFilter) {
        assert_eq!(self.table.len(), other.table.len(), "table length differs");
        assert_eq!(self.probes_per_lookup, other.probes_per_lookup, "probe count differs");
        for i in 0..self.table.len() {
            self.table[i] |= other.table[i];
        }
    }
}

/// Count-Min Sketch (SplitMix + fastrange core). Counter table byte-identical to F#/C#/TS.
pub struct CountMinSketch {
    depth: usize,
    width: usize,
    seed: i64,
    table: Vec<i64>,
    row_seeds: Vec<u64>,
}

impl CountMinSketch {
    /// Create an empty sketch.
    pub fn new(depth: usize, width: usize, seed: i64) -> Self {
        assert!((1..=32).contains(&depth), "depth must be 1..32");
        assert!(width >= 8, "width must be >= 8");
        let row_seeds = (0..depth)
            .map(|i| {
                let mut z = (seed as u64).wrapping_mul(0x9E3779B97F4A7C15)
                    ^ (i as u64).wrapping_mul(0xBF58476D1CE4E5B9);
                z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
                z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
                z ^ (z >> 31)
            })
            .collect();
        Self { depth, width, seed, table: vec![0i64; depth * width], row_seeds }
    }

    /// A copy of the raw counter table (row-major).
    pub fn snapshot(&self) -> Vec<i64> {
        self.table.clone()
    }

    fn column_for(hash: u64, w: usize) -> usize {
        let hash32 = hash as u32;
        ((hash32 as u64 * w as u64) >> 32) as usize
    }

    fn col_at(&self, base_hash: u64, row: usize) -> usize {
        let mut z = base_hash ^ self.row_seeds[row];
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        Self::column_for(z ^ (z >> 31), self.width)
    }

    /// Add `weight` at `base_hash` (the deterministic, portable entry point).
    pub fn add(&mut self, base_hash: u64, weight: i64) {
        for row in 0..self.depth {
            let col = self.col_at(base_hash, row);
            self.table[row * self.width + col] = self.table[row * self.width + col].wrapping_add(weight);
        }
    }

    /// Min-row estimate (overestimate for insertion-only streams).
    pub fn estimate(&self, base_hash: u64) -> i64 {
        let mut result = i64::MAX;
        for row in 0..self.depth {
            let v = self.table[row * self.width + self.col_at(base_hash, row)];
            if v < result {
                result = v;
            }
        }
        if result == i64::MAX { 0 } else { result }
    }

    /// Elementwise add (CRDT monoid merge).
    pub fn union(&mut self, other: &CountMinSketch) {
        assert!(
            self.depth == other.depth && self.width == other.width && self.seed == other.seed,
            "CountMinSketch dimensions or seed mismatch"
        );
        for i in 0..self.table.len() {
            self.table[i] = self.table[i].wrapping_add(other.table[i]);
        }
    }
}
