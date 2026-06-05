//! FrameDelta Rust oracle replay -- reads the SHARED golden seed
//! (`src/Core.TypeScript/frame-delta/golden-vectors.json`) that the F#, C#, and TS oracles also verify,
//! and must value-match every compose / inverse / between / apply / magnitude / distance vector. Four
//! oracles agreeing == the frame-offset transformation group is locked across TS/F#/C#/Rust.
//!
//! Dev-only `serde_json` reads the fixture; the production crate is zero-dependency.

use serde_json::Value;
use std::path::PathBuf;
use zeta_core_frame_delta::{apply, between, compose, distance, inverse, magnitude, FrameMap};

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn to_map(v: &Value) -> FrameMap {
    v.as_object()
        .expect("expected a JSON object")
        .iter()
        .map(|(k, val)| (k.clone(), val.as_i64().expect("expected an i64")))
        .collect()
}

#[test]
fn frame_delta_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/frame-delta/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read frame-delta golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse frame-delta golden-vectors.json");

    for c in v["compose"].as_array().expect("compose array") {
        assert_eq!(compose(&to_map(&c["a"]), &to_map(&c["b"])), to_map(&c["result"]), "compose");
    }
    for c in v["inverse"].as_array().expect("inverse array") {
        assert_eq!(inverse(&to_map(&c["d"])), to_map(&c["result"]), "inverse");
    }
    for c in v["between"].as_array().expect("between array") {
        assert_eq!(between(&to_map(&c["from"]), &to_map(&c["to"])), to_map(&c["result"]), "between");
    }
    for c in v["apply"].as_array().expect("apply array") {
        assert_eq!(apply(&to_map(&c["delta"]), &to_map(&c["frame"])), to_map(&c["result"]), "apply");
    }
    for c in v["magnitude"].as_array().expect("magnitude array") {
        assert_eq!(magnitude(&to_map(&c["d"])), c["result"].as_i64().expect("i64"), "magnitude");
    }
    for c in v["distance"].as_array().expect("distance array") {
        assert_eq!(
            distance(&to_map(&c["from"]), &to_map(&c["to"])),
            c["result"].as_i64().expect("i64"),
            "distance"
        );
    }
    // homeostat leg (order-independent aggregation): folding the deltas in any order gives the same total.
    for c in v["aggregate"].as_array().expect("aggregate array") {
        let deltas: Vec<FrameMap> = c["deltas"].as_array().expect("deltas").iter().map(to_map).collect();
        let total = to_map(&c["total"]);
        let fold = |ds: &[FrameMap]| ds.iter().fold(FrameMap::new(), |acc, d| compose(&acc, d));
        assert_eq!(fold(&deltas), total, "aggregate");
        let mut reversed = deltas.clone();
        reversed.reverse();
        assert_eq!(fold(&reversed), total, "aggregate-reversed");
    }
}
