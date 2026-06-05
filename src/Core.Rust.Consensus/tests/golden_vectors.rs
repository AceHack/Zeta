//! Replays the shared golden seed through the Rust oracle; the C#/F#/TS oracles replay the same file.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_consensus::{decide, quorum_threshold};

fn seed() -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/consensus/golden-vectors.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {:?}: {}", path, e));
    serde_json::from_str(&text).expect("parse seed")
}

#[test]
fn quorum_threshold_agrees() {
    let s = seed();
    for v in s["quorumThreshold"].as_array().unwrap() {
        assert_eq!(quorum_threshold(v["n"].as_i64().unwrap()), v["result"].as_i64().unwrap());
    }
}

#[test]
fn decide_agrees() {
    let s = seed();
    for v in s["decide"].as_array().unwrap() {
        let votes: Vec<String> =
            v["votes"].as_array().unwrap().iter().map(|x| x.as_str().unwrap().to_string()).collect();
        let d = decide(&votes);
        let r = &v["result"];
        assert_eq!(d.committed, r["committed"].as_bool().unwrap());
        let expected_value = r["value"].as_str().map(|x| x.to_string());
        assert_eq!(d.value, expected_value);
        assert_eq!(d.count, r["count"].as_i64().unwrap());
        assert_eq!(d.total, r["total"].as_i64().unwrap());
    }
}
