//! Curve Rust oracle replay -- reads the SHARED golden seed
//! (`src/Core.TypeScript/curve/golden-vectors.json`) that the F#, C#, and TS oracles also verify,
//! and must value-match every vector's rate (D), integrate (I), and curvature (D2). Four oracles
//! agreeing == the discrete DBSP D/I calculus is locked across TS/F#/C#/Rust.
//!
//! Dev-only `serde_json` reads the fixture; the production crate is zero-dependency.

use serde_json::Value;
use std::path::PathBuf;
use zeta_core_curve::{curvature, differentiate, integrate};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching the other Rust oracles.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

/// A JSON number array -> `Vec<i64>`.
fn i64_vec(v: &Value) -> Vec<i64> {
    v.as_array()
        .expect("expected a JSON array")
        .iter()
        .map(|x| x.as_i64().expect("expected an i64"))
        .collect()
}

#[test]
fn curve_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/curve/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read curve golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse curve golden-vectors.json");

    let vectors = v["vectors"].as_array().expect("vectors array");
    assert!(!vectors.is_empty(), "no vectors in seed");

    for vec in vectors {
        let input = i64_vec(&vec["input"]);
        assert_eq!(differentiate(&input), i64_vec(&vec["rate"]), "rate mismatch");
        assert_eq!(integrate(&input), i64_vec(&vec["integrate"]), "integrate mismatch");
        assert_eq!(curvature(&input), i64_vec(&vec["curvature"]), "curvature mismatch");
    }
}
