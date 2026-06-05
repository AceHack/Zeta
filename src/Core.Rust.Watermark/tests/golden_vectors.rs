//! Replays the shared golden seed through the Rust oracle; the C#/F#/TS oracles replay the same file.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_watermark::{combine, is_late, observe};

fn seed() -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/watermark/golden-vectors.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {:?}: {}", path, e));
    serde_json::from_str(&text).expect("parse seed")
}

fn longs(v: &Value) -> Vec<i64> {
    v.as_array().unwrap().iter().map(|x| x.as_i64().unwrap()).collect()
}

#[test]
fn observe_agrees() {
    let s = seed();
    for v in s["observe"].as_array().unwrap() {
        let got = observe(
            v["strategy"].as_str().unwrap(),
            v["lateness"].as_i64().unwrap(),
            &longs(&v["events"]),
        );
        assert_eq!(got, longs(&v["result"]));
    }
}

#[test]
fn is_late_agrees() {
    let s = seed();
    for v in s["isLate"].as_array().unwrap() {
        assert_eq!(
            is_late(v["wm"].as_i64().unwrap(), v["eventTime"].as_i64().unwrap()),
            v["result"].as_bool().unwrap()
        );
    }
}

#[test]
fn combine_agrees() {
    let s = seed();
    for v in s["combine"].as_array().unwrap() {
        assert_eq!(combine(&longs(&v["sources"])), v["result"].as_i64().unwrap());
    }
}
