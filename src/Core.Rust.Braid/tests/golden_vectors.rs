//! Replays the shared golden seed through the Rust oracle; the C#/F#/TS oracles replay the same file.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_braid::{act, gen, permutation, writhe, writhe_parity, Word};

fn seed() -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/braid/golden-vectors.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {:?}: {}", path, e));
    serde_json::from_str(&text).expect("parse seed")
}

fn ints(v: &Value) -> Vec<i32> {
    v.as_array()
        .unwrap()
        .iter()
        .map(|x| x.as_i64().unwrap() as i32)
        .collect()
}

fn word(v: &Value) -> Word {
    v.as_array()
        .unwrap()
        .iter()
        .map(|l| {
            let a = l.as_array().unwrap();
            (a[0].as_i64().unwrap() as i32, a[1].as_i64().unwrap() as i32)
        })
        .collect()
}

#[test]
fn all_vectors_agree() {
    let s = seed();
    let n = s["n"].as_u64().unwrap() as usize;
    for v in s["vectors"].as_array().unwrap() {
        let braid = ints(&v["braid"]);
        assert_eq!(writhe(&braid), v["writhe"].as_i64().unwrap() as i32);
        assert_eq!(writhe_parity(&braid), v["writheParity"].as_i64().unwrap() as i32);
        assert_eq!(permutation(n, &braid), ints(&v["permutation"]));
        let actions = v["actions"].as_array().unwrap();
        for (i, expected) in actions.iter().enumerate() {
            assert_eq!(
                act(&braid, &gen(i as i32)),
                word(expected),
                "action x_{} of braid {:?}",
                i,
                braid
            );
        }
    }
}
