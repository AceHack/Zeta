//! SoftValue Rust oracle replay -- reads the SHARED golden seed
//! (`src/Core.TypeScript/soft-value/golden-vectors.json`) that the F#, C#, and TS oracles also verify,
//! and must value-match every resolve / observe-then-resolve DECISION. Four oracles agreeing == the
//! SoftValue decision semantics are locked across TS/F#/C#/Rust (float confidence/entropy out of scope).
//!
//! Dev-only `serde_json` reads the fixture; the production crate is zero-dependency.

use serde_json::Value;
use std::path::PathBuf;
use zeta_core_soft_value::{observe_resolve, resolve, Weights};

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn to_weights(v: &Value) -> Weights {
    v.as_object()
        .expect("expected a JSON object")
        .iter()
        .map(|(k, val)| (k.clone(), val.as_i64().expect("expected an i64")))
        .collect()
}

fn expected(v: &Value) -> Option<String> {
    if v.is_null() {
        None
    } else {
        Some(v.as_str().expect("expected a string or null").to_string())
    }
}

#[test]
fn soft_value_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/soft-value/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read soft-value golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse soft-value golden-vectors.json");

    for c in v["resolve"].as_array().expect("resolve array") {
        let got = resolve(&to_weights(&c["candidates"]), c["num"].as_i64().unwrap(), c["den"].as_i64().unwrap());
        assert_eq!(got, expected(&c["result"]), "resolve");
    }
    for c in v["observeResolve"].as_array().expect("observeResolve array") {
        let got = observe_resolve(
            &to_weights(&c["prior"]),
            &to_weights(&c["likelihood"]),
            c["num"].as_i64().unwrap(),
            c["den"].as_i64().unwrap(),
        );
        assert_eq!(got, expected(&c["result"]), "observeResolve");
    }
}
