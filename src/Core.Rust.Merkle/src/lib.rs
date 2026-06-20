//! Merkle integrity — Rust parity oracle (#4 of TS/F#/C#/Rust).
//!
//! **Hexagonal (own-your-interfaces).** The zero-dep core owns the [`Hasher128`] port,
//! [`MerkleHash`], and [`MerkleTree`]. The concrete XXH3-128 implementation is a swappable
//! adapter ([`Xxh3Hasher128`], behind the default `xxh3` feature). A future zero-dep pure
//! XXH3 impl can replace it behind the same trait without touching [`MerkleTree`].
//!
//! Conforms byte-for-byte to the F# canonical shape (`src/Core/Merkle.fs`): each leaf is
//! hashed with XXH3-128 and internal nodes combine two child hashes by concatenating their
//! little-endian Hi/Lo halves and re-hashing. A tree over the same leaves yields a
//! BYTE-IDENTICAL root in F#, C#, and Rust — verified by `tests/golden_vectors.rs` against
//! vectors generated from the F# implementation.

#![forbid(unsafe_code)]

/// A Merkle hash — 128 bits (Hi/Lo), matching the F#/C# `MerkleHash`. Pure data; the
/// hashing lives behind the [`Hasher128`] port.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct MerkleHash {
    /// High 64 bits.
    pub hi: u64,
    /// Low 64 bits.
    pub lo: u64,
}

impl MerkleHash {
    /// The all-zero hash (root of the empty tree).
    pub const ZERO: MerkleHash = MerkleHash { hi: 0, lo: 0 };

    /// Hex representation (Hi then Lo, 16 hex digits each) — matches F#/C# `ToHex`.
    pub fn to_hex(&self) -> String {
        format!("{:016x}{:016x}", self.hi, self.lo)
    }
}

/// The 128-bit hashing **port** Merkle depends on. We OWN this interface; the concrete
/// XXH3-128 implementation is a swappable adapter. `combine` is a provided method so every
/// adapter shares the canonical internal-node layout.
pub trait Hasher128 {
    /// Hash raw bytes into a 128-bit [`MerkleHash`].
    fn hash128(&self, bytes: &[u8]) -> MerkleHash;

    /// Combine two child hashes into a parent: `a.hi, a.lo, b.hi, b.lo` each written
    /// little-endian into a 32-byte buffer, then hashed. Mirrors `src/Core/Merkle.fs`.
    fn combine(&self, a: MerkleHash, b: MerkleHash) -> MerkleHash {
        let mut buf = [0u8; 32];
        buf[0..8].copy_from_slice(&a.hi.to_le_bytes());
        buf[8..16].copy_from_slice(&a.lo.to_le_bytes());
        buf[16..24].copy_from_slice(&b.hi.to_le_bytes());
        buf[24..32].copy_from_slice(&b.lo.to_le_bytes());
        self.hash128(&buf)
    }
}

/// XXH3-128 adapter (the `xxhash-rust` crate), mapped to F#'s Hi/Lo convention.
///
/// .NET's `XxHash128.Hash` emits the XXH128 **canonical big-endian** form,
/// `BE(high64) ++ BE(low64)`. The F# reader then takes `Lo = LE(bytes[0..8])` and
/// `Hi = LE(bytes[8..16])`, i.e. `Lo = swap(high64)`, `Hi = swap(low64)`. `xxh3_128` returns
/// `low64 | (high64 << 64)`, so we byte-swap each half to land on F#'s Hi/Lo.
#[cfg(feature = "xxh3")]
pub struct Xxh3Hasher128;

#[cfg(feature = "xxh3")]
impl Hasher128 for Xxh3Hasher128 {
    fn hash128(&self, bytes: &[u8]) -> MerkleHash {
        let v = xxhash_rust::xxh3::xxh3_128(bytes);
        MerkleHash {
            hi: (v as u64).swap_bytes(),
            lo: ((v >> 64) as u64).swap_bytes(),
        }
    }
}

/// Merkle tree over a sequence of leaf blobs, built bottom-up via a [`Hasher128`] port.
/// Mirrors the F# `MerkleTree` exactly (duplicate-last-leaf for odd fan-in), so the root is
/// byte-identical to F#/C#.
pub struct MerkleTree {
    levels: Vec<Vec<MerkleHash>>,
}

impl MerkleTree {
    /// Build a tree over the given leaves using an explicit hashing port. Zero-dep core —
    /// no vendor reference here; the adapter is supplied by the caller.
    pub fn with_hasher<H: Hasher128>(leaves: &[Vec<u8>], hasher: &H) -> MerkleTree {
        let level0: Vec<MerkleHash> = leaves.iter().map(|b| hasher.hash128(b)).collect();
        let mut all = vec![level0.clone()];
        let mut cur = level0;
        while cur.len() > 1 {
            let mut parent = Vec::with_capacity(cur.len().div_ceil(2));
            let mut i = 0;
            while i < cur.len() {
                let left = cur[i];
                let right = if i + 1 < cur.len() { cur[i + 1] } else { left }; // duplicate last for odd
                parent.push(hasher.combine(left, right));
                i += 2;
            }
            all.push(parent.clone());
            cur = parent;
        }
        MerkleTree { levels: all }
    }

    /// Build a tree using the default XXH3-128 adapter (requires the `xxh3` feature).
    #[cfg(feature = "xxh3")]
    pub fn new(leaves: &[Vec<u8>]) -> MerkleTree {
        MerkleTree::with_hasher(leaves, &Xxh3Hasher128)
    }

    /// Root digest — byte-identical to the F#/C# root over the same leaves.
    pub fn root(&self) -> MerkleHash {
        let top = self.levels.last().expect("levels always has level 0");
        if top.is_empty() {
            MerkleHash::ZERO
        } else {
            top[0]
        }
    }

    /// The leaf hashes (level 0), useful for diffing.
    pub fn leaf_hashes(&self) -> &[MerkleHash] {
        &self.levels[0]
    }

    /// Inclusion (audit) proof for the leaf at `index`: the sibling digest at each
    /// level from leaf to root, with its side. A verifier holding only the leaf, this
    /// proof, and the root can confirm membership without the tree (see [`verify_proof`]).
    /// Replays the exact F# fold (duplicate-last on an odd trailing node → sibling is
    /// self, on the right). Mirrors `MerkleTree.Proof` in `src/Core/Merkle.fs`.
    ///
    /// # Panics
    /// Panics if `index >= leaf count` (leaf-index out of range), matching the F#
    /// `invalidArg`.
    pub fn proof(&self, index: usize) -> Vec<ProofStep> {
        let level0 = &self.levels[0];
        assert!(
            index < level0.len(),
            "leaf index {index} out of range [0, {})",
            level0.len()
        );
        let mut steps = Vec::with_capacity(self.levels.len().saturating_sub(1));
        let mut idx = index;
        // Walk levels[0 .. n-2]; the last level is the root (no sibling).
        for lvl in 0..self.levels.len().saturating_sub(1) {
            let cur = &self.levels[lvl];
            let self_is_left = idx.is_multiple_of(2);
            let sibling_idx = if self_is_left {
                if idx + 1 < cur.len() {
                    idx + 1
                } else {
                    idx // duplicate-last: odd trailing node's sibling is itself
                }
            } else {
                idx - 1
            };
            steps.push(ProofStep {
                sibling: cur[sibling_idx],
                right: self_is_left,
            });
            idx /= 2;
        }
        steps
    }
}

/// One step of a Merkle inclusion proof: a sibling digest and which side it sits on.
/// `right == true` means the sibling is the RIGHT child (the current accumulator is the
/// LEFT child, so `parent = combine(self, sibling)`). Mirrors the F# `MerkleProofStep`
/// and the `{"hash","right"}` golden-vector schema.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct ProofStep {
    /// The sibling node's digest at this level.
    pub sibling: MerkleHash,
    /// `true` ⇒ sibling is the RIGHT child (combine self then sibling);
    /// `false` ⇒ sibling is the LEFT child (combine sibling then self).
    pub right: bool,
}

/// Verify an inclusion proof against `expected_root` using an explicit hashing port:
/// re-hash `leaf`, fold the audit `steps` up, and check the result equals the root.
/// Touches ONLY the leaf, the proof, and the root — never the tree (the third-party
/// property). Matches `MerkleTree.verifyProof` (`src/Core/Merkle.fs`) byte-for-byte.
pub fn verify_proof_with_hasher<H: Hasher128>(
    leaf: &[u8],
    steps: &[ProofStep],
    expected_root: MerkleHash,
    hasher: &H,
) -> bool {
    let mut acc = hasher.hash128(leaf);
    for step in steps {
        acc = if step.right {
            hasher.combine(acc, step.sibling)
        } else {
            hasher.combine(step.sibling, acc)
        };
    }
    acc == expected_root
}

/// Verify an inclusion proof using the default XXH3-128 adapter (requires the `xxh3`
/// feature). See [`verify_proof_with_hasher`].
#[cfg(feature = "xxh3")]
pub fn verify_proof(leaf: &[u8], steps: &[ProofStep], expected_root: MerkleHash) -> bool {
    verify_proof_with_hasher(leaf, steps, expected_root, &Xxh3Hasher128)
}
