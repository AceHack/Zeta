//! Replays the shared golden seed through the Rust oracle; the C#/F#/TS oracles replay the same file.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_splitmix64::mix;

fn seed() -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/splitmix64/golden-vectors.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {:?}: {}", path, e));
    serde_json::from_str(&text).expect("parse seed")
}

#[test]
fn mix_agrees() {
    let s = seed();
    for v in s["mix"].as_array().unwrap() {
        let x: u64 = v["x"].as_str().unwrap().parse().unwrap();
        let expected: u64 = v["result"].as_str().unwrap().parse().unwrap();
        assert_eq!(mix(x), expected);
    }
}
