//! Replays the shared golden seed through the Rust oracle; the C#/F#/TS oracles replay the same file.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_fastcdc::{chunk_lengths, gear_table, gen_bytes};

fn seed() -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/fastcdc/golden-vectors.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {:?}: {}", path, e));
    serde_json::from_str(&text).expect("parse seed")
}

#[test]
fn gear_samples_agree() {
    let s = seed();
    let table = gear_table();
    for v in s["gearSamples"].as_array().unwrap() {
        let i = v["i"].as_u64().unwrap() as usize;
        let expected: u64 = v["value"].as_str().unwrap().parse().unwrap();
        assert_eq!(table[i], expected);
    }
}

#[test]
fn chunk_lengths_agree() {
    let s = seed();
    for v in s["chunk"].as_array().unwrap() {
        let count = v["count"].as_u64().unwrap() as usize;
        let min = v["min"].as_u64().unwrap() as usize;
        let avg = v["avg"].as_u64().unwrap() as usize;
        let max = v["max"].as_u64().unwrap() as usize;
        let expected: Vec<usize> =
            v["lengths"].as_array().unwrap().iter().map(|x| x.as_u64().unwrap() as usize).collect();
        let bytes = gen_bytes(count);
        assert_eq!(chunk_lengths(&bytes, min, avg, max), expected);
    }
}
