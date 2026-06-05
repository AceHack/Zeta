//! Replays the shared golden seed through the Rust oracle; the C#/F#/TS oracles replay the same file.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_crc32c::crc32c;

fn seed() -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/crc32c/golden-vectors.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {:?}: {}", path, e));
    serde_json::from_str(&text).expect("parse seed")
}

#[test]
fn crc32c_agrees() {
    let s = seed();
    for v in s["crc32c"].as_array().unwrap() {
        let payload: Vec<u8> = v["payload"]
            .as_array()
            .unwrap()
            .iter()
            .map(|x| x.as_u64().unwrap() as u8)
            .collect();
        assert_eq!(crc32c(&payload) as u64, v["result"].as_u64().unwrap(), "case {}", v["name"]);
    }
}
