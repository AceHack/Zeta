//! Replays the shared golden seed through the Rust oracle; the C#/F#/TS oracles replay the same file.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_uncertain_clock::{compare_hlc, definitely_before, receive, send, uncertain, Hlc};

fn seed() -> Value {
    // crate dir -> src -> repo root -> the shared seed
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/uncertain-clock/golden-vectors.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {:?}: {}", path, e));
    serde_json::from_str(&text).expect("parse seed")
}

fn hlc(v: &Value) -> Hlc {
    Hlc::new(v["physical"].as_i64().unwrap(), v["logical"].as_i64().unwrap())
}

#[test]
fn compare_hlc_agrees() {
    let s = seed();
    for v in s["compareHlc"].as_array().unwrap() {
        assert_eq!(
            compare_hlc(hlc(&v["a"]), hlc(&v["b"])) as i64,
            v["result"].as_i64().unwrap()
        );
    }
}

#[test]
fn send_agrees() {
    let s = seed();
    for v in s["send"].as_array().unwrap() {
        assert_eq!(send(hlc(&v["clock"]), v["now"].as_i64().unwrap()), hlc(&v["result"]));
    }
}

#[test]
fn receive_agrees() {
    let s = seed();
    for v in s["receive"].as_array().unwrap() {
        assert_eq!(
            receive(hlc(&v["clock"]), hlc(&v["msg"]), v["now"].as_i64().unwrap()),
            hlc(&v["result"])
        );
    }
}

#[test]
fn definitely_before_agrees() {
    let s = seed();
    for v in s["definitelyBefore"].as_array().unwrap() {
        let (a, b) = (&v["a"], &v["b"]);
        assert_eq!(
            definitely_before(
                a["physical"].as_i64().unwrap(),
                a["eps"].as_i64().unwrap(),
                b["physical"].as_i64().unwrap(),
                b["eps"].as_i64().unwrap()
            ),
            v["result"].as_bool().unwrap()
        );
    }
}

#[test]
fn uncertain_agrees() {
    let s = seed();
    for v in s["uncertain"].as_array().unwrap() {
        let (a, b) = (&v["a"], &v["b"]);
        assert_eq!(
            uncertain(
                a["physical"].as_i64().unwrap(),
                a["eps"].as_i64().unwrap(),
                b["physical"].as_i64().unwrap(),
                b["eps"].as_i64().unwrap()
            ),
            v["result"].as_bool().unwrap()
        );
    }
}
