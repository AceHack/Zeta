//! Replays the shared golden seed through the Rust oracle; the C#/F#/TS oracles replay the same file.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_consistent_hash::{pick, seeds};

fn seed() -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/consistent-hash/golden-vectors.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {:?}: {}", path, e));
    serde_json::from_str(&text).expect("parse seed")
}

#[test]
fn seeds_agree() {
    let s = seed();
    let n = s["seeds"]["n"].as_u64().unwrap() as usize;
    let expected: Vec<u64> = s["seeds"]["result"]
        .as_array()
        .unwrap()
        .iter()
        .map(|x| x.as_str().unwrap().parse().unwrap())
        .collect();
    assert_eq!(seeds(n), expected);
}

#[test]
fn pick_agrees() {
    let s = seed();
    for v in s["pick"].as_array().unwrap() {
        let n = v["buckets"].as_u64().unwrap() as usize;
        let key: u64 = v["key"].as_str().unwrap().parse().unwrap();
        assert_eq!(pick(n, key), v["result"].as_i64().unwrap() as i32);
    }
}
