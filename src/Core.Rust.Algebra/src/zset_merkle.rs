//! Canonical Merkle root over a Z-set — the Rust parity oracle for `src/Core/ZSetMerkle.fs`.
//! Leaves are the DBSP Z-set entries, so the content-addressed root is a pure function of the net Z-set state.

use crate::zset::ZSet;
use zeta_core_merkle::{Hasher128, MerkleHash};

/// Canonical leaf encoding for one entry: `[4-byte LE keyLen][keyBytes][8-byte LE weight]`.
fn leaf_bytes(key_bytes: &[u8], weight: i64) -> Vec<u8> {
    let mut buf = Vec::with_capacity(4 + key_bytes.len() + 8);
    buf.extend_from_slice(&(key_bytes.len() as u32).to_le_bytes());
    buf.extend_from_slice(key_bytes);
    buf.extend_from_slice(&weight.to_le_bytes());
    buf
}

/// Combine two child digests into a parent: 32 LE bytes `a.hi a.lo b.hi b.lo`, re-hashed.
fn combine<H: Hasher128 + ?Sized>(hasher: &H, a: MerkleHash, b: MerkleHash) -> MerkleHash {
    hasher.combine(a, b)
}

/// Fold a level of digests bottom-up; an odd trailing node is promoted (duplicated).
fn fold<H: Hasher128 + ?Sized>(hasher: &H, level: Vec<MerkleHash>) -> MerkleHash {
    if level.is_empty() {
        return hasher.hash128(&[]);
    }
    let mut cur = level;
    while cur.len() > 1 {
        let mut parent = Vec::with_capacity(cur.len().div_ceil(2));
        let mut i = 0;
        while i < cur.len() {
            let left = cur[i];
            let right = if i + 1 < cur.len() { cur[i + 1] } else { left };
            parent.push(combine(hasher, left, right));
            i += 2;
        }
        cur = parent;
    }
    cur[0]
}

/// Canonical Merkle root over `z` with an explicit hash function. Leaves = `(key, weight)` entries
/// encoded + sorted by key bytes (ordinal); folded bottom-up. Deterministic + retraction-native.
pub fn root_with<T, H, F>(hasher: &H, encode_key: F, z: &ZSet<T>) -> MerkleHash
where
    T: Ord + Clone,
    H: Hasher128 + ?Sized,
    F: Fn(&T) -> Vec<u8>,
{
    let mut leaves_temp: Vec<(Vec<u8>, i64)> = z
        .as_slice()
        .iter()
        .map(|entry| (encode_key(&entry.e), entry.w))
        .collect();

    // Lexicographic ordinal comparison of key byte arrays (the cross-language canonical order)
    leaves_temp.sort_by(|a, b| a.0.cmp(&b.0));

    let leaves: Vec<MerkleHash> = leaves_temp
        .iter()
        .map(|(kb, w)| hasher.hash128(&leaf_bytes(kb, *w)))
        .collect();

    fold(hasher, leaves)
}

/// Canonical Merkle root using the default XXH3-128 adapter.
#[cfg(feature = "xxh3")]
pub fn root<T, F>(encode_key: F, z: &ZSet<T>) -> MerkleHash
where
    T: Ord + Clone,
    F: Fn(&T) -> Vec<u8>,
{
    root_with(&zeta_core_merkle::Xxh3Hasher128, encode_key, z)
}
