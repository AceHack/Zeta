//! IndexedZSet cross-language conformance (the Rust oracle for the rung ABOVE
//! the Z-set). Replays the SHARED, self-describing golden vectors —
//! `src/Core.TypeScript/indexed-z-set/golden-vectors.json` — building `A` via
//! `index_with(indexInput)` and asserting it equals `expectedA`, then asserting
//! `add` / `neg` / `sub` / `join` / `to_zset` / `key_count` / `tuple_count` of
//! `A` against `operandB`. Passing == agreeing with the TS/F#/C# oracles
//! (canonical-form byte-equality: groups ascending by key, each value-Z-set
//! sorted with weight `!= 0`, empty groups dropped).
//!
//! Native [`Ord`] on the `String` key/value coincides with the fixture's
//! "ascending ordinal" comparator for the ASCII-only single-letter keys/values
//! (same caveat as the Z-set/Bag/G-Set oracles). Dev-only `serde_json` reads the
//! nested-JSON fixture; the production crate has zero dependencies.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_algebra::indexed_zset::{IndexedZSet, KeyGroup};
use zeta_core_algebra::zset::{ZEntry, ZSet};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching
/// the convention in the other Rust oracles.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

/// A JSON array of `{e, w}` objects → `Vec<ZEntry<String>>`.
fn z_entries(v: &Value) -> Vec<ZEntry<String>> {
    v.as_array()
        .expect("expected a JSON array of {e, w}")
        .iter()
        .map(|x| ZEntry {
            e: x["e"].as_str().expect("entry.e string").to_string(),
            w: x["w"].as_i64().expect("entry.w integer"),
        })
        .collect()
}

/// A JSON array of `{e, w}` → a canonical `ZSet<String>` (the flat-result shape).
fn zset(v: &Value) -> ZSet<String> {
    ZSet::of_entries(z_entries(v))
}

/// A JSON array of `{k, values: [{e, w}]}` → a canonical `IndexedZSet<String, String>`.
fn groups(v: &Value) -> IndexedZSet<String, String> {
    let gs = v
        .as_array()
        .expect("expected a JSON array of {k, values}")
        .iter()
        .map(|g| KeyGroup {
            key: g["k"].as_str().expect("group.k string").to_string(),
            values: ZSet::of_entries(z_entries(&g["values"])),
        });
    IndexedZSet::of_groups(gs)
}

/// The `indexInput` array of `{e: {k, v}, w}` → a flat `ZSet<(key, value)>` to
/// feed `index_with` (canonicalized first, so the repeated `(a, x)` sums to 2).
fn index_input(v: &Value) -> ZSet<(String, String)> {
    let entries = v
        .as_array()
        .expect("expected indexInput array of {e:{k,v}, w}")
        .iter()
        .map(|x| ZEntry {
            e: (
                x["e"]["k"].as_str().expect("e.k string").to_string(),
                x["e"]["v"].as_str().expect("e.v string").to_string(),
            ),
            w: x["w"].as_i64().expect("entry.w integer"),
        });
    ZSet::of_entries(entries)
}

#[test]
fn indexed_zset_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/indexed-z-set/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read indexed-z-set golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse indexed-z-set golden-vectors.json");

    // Build A by indexing the flat (key, value) Z-set, then assert canonical form.
    let a = IndexedZSet::index_with(
        |kv: &(String, String)| kv.0.clone(),
        |kv: &(String, String)| kv.1.clone(),
        &index_input(&v["indexInput"]),
    );
    assert_eq!(a, groups(&v["expectedA"]), "indexWith(indexInput) != expectedA");

    let b = groups(&v["operandB"]);

    // Abelian-group ops (add / neg / sub) — indexed lift of the Z-set group.
    assert_eq!(a.add(&b), groups(&v["expectedAddAB"]), "add(A, B) mismatch");
    assert_eq!(a.neg(), groups(&v["expectedNegA"]), "neg(A) mismatch");
    assert_eq!(a.sub(&b), groups(&v["expectedSubAB"]), "sub(A, B) mismatch");

    // Bilinear join — merge-join on key, cross-product values, weight MULTIPLY.
    let join_ab = a.join(&b, |k: &String, va: &String, vb: &String| format!("{k}|{va}|{vb}"));
    assert_eq!(join_ab, zset(&v["expectedJoinAB"]), "join(A, B) mismatch");

    // Flatten to a Z-set of named (key, value) tuples.
    let z = a.to_zset(|k: &String, val: &String| format!("{k}|{val}"));
    assert_eq!(z, zset(&v["expectedToZSetA"]), "toZSet(A) mismatch");

    // Counts.
    assert_eq!(
        a.key_count(),
        v["expectedKeyCountA"].as_u64().expect("expectedKeyCountA") as usize,
        "keyCount(A) mismatch",
    );
    assert_eq!(
        a.tuple_count(),
        v["expectedTupleCountA"].as_u64().expect("expectedTupleCountA") as usize,
        "tupleCount(A) mismatch",
    );
}
