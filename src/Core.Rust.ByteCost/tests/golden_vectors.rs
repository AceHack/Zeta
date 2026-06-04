//! ByteCost byte-lock -- the Rust oracle replays the shared seed
//! (`src/Core.TypeScript/byte-cost/golden-vectors.json`) and asserts identical
//! UTF-8 byte counts. Passing == agreeing with the TS/F#/C# oracles on the
//! count for every vector. "The compilers don't lie."
//!
//! Dev-only `serde_json` reads the seed; the production crate has zero dependencies.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_byte_cost::{measure_text, sum, ByteCost};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel).
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn seed() -> Value {
    let path = repo_root()
        .join("src")
        .join("Core.TypeScript")
        .join("byte-cost")
        .join("golden-vectors.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("could not read seed {}: {e}", path.display()));
    serde_json::from_str(&text).expect("seed is valid JSON")
}

#[test]
fn measure_matches_golden_vectors() {
    let s = seed();
    assert_eq!(s["primitive"], "byte-cost");
    assert_eq!(s["version"], "v1");
    assert_eq!(s["unit"], "utf8-bytes");

    let vectors = s["vectors"].as_array().expect("vectors is an array");
    assert!(!vectors.is_empty(), "seed has at least one vector");

    let mut costs = Vec::new();
    for v in vectors {
        let name = v["name"].as_str().expect("name is a string");
        let text = v["text"].as_str().expect("text is a string");
        let expected = v["bytes"].as_u64().expect("bytes is a number");
        let actual = measure_text(text).bytes;
        assert_eq!(actual, expected, "byte-cost vector '{name}': expected {expected}, measured {actual}");
        costs.push(ByteCost::of_bytes(actual));
    }

    // Order-independent sum (sound DORA aggregate).
    let mut rev = costs.clone();
    rev.reverse();
    assert_eq!(sum(&costs), sum(&rev));
}
