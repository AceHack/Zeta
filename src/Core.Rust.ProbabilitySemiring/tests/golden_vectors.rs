//! Replays the shared golden seed through the Rust oracle; the C#/F#/TS oracles replay the same file.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_probability_semiring::{add, div, forward_step, max, merge3, mul, rat, viterbi_step, Rational};

fn seed() -> Value {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/probability-semiring/golden-vectors.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {:?}: {}", path, e));
    serde_json::from_str(&text).expect("parse seed")
}

fn r(v: &Value) -> Rational {
    rat(v["n"].as_i64().unwrap(), v["d"].as_i64().unwrap())
}
fn vec_r(v: &Value) -> Vec<Rational> {
    v.as_array().unwrap().iter().map(r).collect()
}
fn mat_r(v: &Value) -> Vec<Vec<Rational>> {
    v.as_array().unwrap().iter().map(vec_r).collect()
}

#[test]
fn normalize_agrees() {
    let s = seed();
    for v in s["normalize"].as_array().unwrap() {
        assert_eq!(rat(v["n"].as_i64().unwrap(), v["d"].as_i64().unwrap()), r(&v["result"]));
    }
}

#[test]
fn add_agrees() {
    let s = seed();
    for v in s["add"].as_array().unwrap() {
        assert_eq!(add(r(&v["a"]), r(&v["b"])), r(&v["result"]));
    }
}

#[test]
fn mul_agrees() {
    let s = seed();
    for v in s["mul"].as_array().unwrap() {
        assert_eq!(mul(r(&v["a"]), r(&v["b"])), r(&v["result"]));
    }
}

#[test]
fn max_agrees() {
    let s = seed();
    for v in s["max"].as_array().unwrap() {
        assert_eq!(max(r(&v["a"]), r(&v["b"])), r(&v["result"]));
    }
}

#[test]
fn forward_step_agrees() {
    let s = seed();
    for v in s["forwardStep"].as_array().unwrap() {
        assert_eq!(forward_step(&vec_r(&v["pi"]), &mat_r(&v["p"])), vec_r(&v["result"]));
    }
}

#[test]
fn viterbi_step_agrees() {
    let s = seed();
    for v in s["viterbiStep"].as_array().unwrap() {
        assert_eq!(viterbi_step(&vec_r(&v["v"]), &mat_r(&v["p"])), vec_r(&v["result"]));
    }
}

#[test]
fn div_agrees() {
    let s = seed();
    for v in s["div"].as_array().unwrap() {
        assert_eq!(div(r(&v["a"]), r(&v["b"])), r(&v["result"]));
    }
}

#[test]
fn merge3_agrees() {
    let s = seed();
    for v in s["merge3"].as_array().unwrap() {
        assert_eq!(
            merge3(&vec_r(&v["ancestor"]), &vec_r(&v["a"]), &vec_r(&v["b"])),
            vec_r(&v["result"])
        );
    }
}
