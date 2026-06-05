//! TravelerFrame Rust oracle replay -- reads the SHARED golden seed
//! (`src/Core.TypeScript/traveler-frame/golden-vectors.json`) that the F#, C#, and TS oracles also verify,
//! and must value-match every transform / dominates / converge vector. Four oracles agreeing == the causal
//! frame is locked across TS/F#/C#/Rust.
//!
//! Dev-only `serde_json` reads the fixture; the production crate is zero-dependency.

use serde_json::Value;
use std::path::PathBuf;
use zeta_core_traveler_frame::{converge, dominates, transform, Frame};

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn to_frame(v: &Value) -> Frame {
    v.as_object()
        .expect("expected a JSON object")
        .iter()
        .map(|(k, val)| (k.clone(), val.as_i64().expect("expected an i64")))
        .collect()
}

#[test]
fn traveler_frame_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/traveler-frame/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read traveler-frame golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse traveler-frame golden-vectors.json");

    for c in v["transform"].as_array().expect("transform array") {
        assert_eq!(transform(&to_frame(&c["a"]), &to_frame(&c["b"])), to_frame(&c["result"]), "transform");
    }
    for c in v["dominates"].as_array().expect("dominates array") {
        assert_eq!(
            dominates(&to_frame(&c["a"]), &to_frame(&c["b"])),
            c["result"].as_bool().expect("bool"),
            "dominates"
        );
    }
    for c in v["converge"].as_array().expect("converge array") {
        let frames: Vec<Frame> = c["frames"].as_array().expect("frames").iter().map(to_frame).collect();
        let lub = to_frame(&c["lub"]);
        assert_eq!(converge(&frames), lub, "converge");
        let mut reversed = frames.clone();
        reversed.reverse();
        assert_eq!(converge(&reversed), lub, "converge-reversed");
    }
}
