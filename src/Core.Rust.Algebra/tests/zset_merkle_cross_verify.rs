//! Z-set Merkle cross-language conformance (the Rust oracle for computing Merkle root over a Z-set).
//! Replays the SHARED golden vectors from `src/Core.TypeScript/z-set-merkle/golden-vectors.json`
//! and asserts that the computed Merkle root matches the reference F#/TS/C# root.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_algebra::zset::{ZEntry, ZSet};
use zeta_core_algebra::zset_merkle;

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching the
/// convention in the other Rust oracles.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

/// A JSON array of `{key, weight}` objects -> `Vec<ZEntry<String>>`.
fn entries(v: &Value) -> Vec<ZEntry<String>> {
    v.as_array()
        .expect("expected a JSON array")
        .iter()
        .map(|x| ZEntry {
            e: x["key"].as_str().expect("entry.key string").to_string(),
            w: x["weight"].as_i64().expect("entry.weight integer"),
        })
        .collect()
}

#[test]
fn zset_merkle_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/z-set-merkle/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read z-set-merkle golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse z-set-merkle golden-vectors.json");

    let vectors = v["vectors"].as_array().expect("vectors array");
    for vc in vectors {
        let name = vc["name"].as_str().expect("case name");
        let entries_list = entries(&vc["entries"]);
        let expected_root = vc["root"].as_str().expect("case root");

        let z = ZSet::of_entries(entries_list);
        let got_root = zset_merkle::root(|s: &String| s.as_bytes().to_vec(), &z);

        assert_eq!(
            got_root.to_hex(),
            expected_root,
            "Merkle root mismatch for vector case: {}",
            name
        );
    }
}
