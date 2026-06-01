//! RangeSet — the Rust ferry cross-verify (oracle #4 of TS/F#/C#/Rust). The TS reference
//! (`src/Core.TypeScript/range-set/`) authors the shared golden vectors; this proves the Rust
//! impl replays them: `render(&parse(input))` == canonical (the cross-language byte lock) +
//! `contains` agrees, and the rejection vectors decline the SPECIFIC feedback variant.
//! "The compilers don't lie." Dev-only `serde_json` reads the golden; the production impl is zero-dep.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_range_set::{RangeSetFeedback, add, contains, parse, render, size, union};

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn golden() -> Value {
    let path = repo_root().join("src/Core.TypeScript/range-set/golden-vectors.json");
    serde_json::from_str(&std::fs::read_to_string(&path).expect("read golden-vectors.json")).expect("parse golden")
}

fn feedback_name(f: &RangeSetFeedback) -> &'static str {
    match f {
        RangeSetFeedback::NotInteger(_) => "NotInteger",
        RangeSetFeedback::InvertedRange { .. } => "InvertedRange",
        RangeSetFeedback::Malformed(_) => "Malformed",
    }
}

#[test]
fn rust_range_set_replays_golden_cases() {
    let doc = golden();
    let cases = doc["cases"].as_array().expect("cases array");
    assert!(!cases.is_empty(), "no golden cases");

    for c in cases {
        let name = c["name"].as_str().expect("name");
        let input = c["input"].as_str().expect("input");
        let canonical = c["canonical"].as_str().expect("canonical");
        let rs = parse(input).unwrap_or_else(|e| panic!("{name}: parse {input:?}: {e:?}"));
        assert_eq!(canonical, render(&rs), "{name}: render");
        // canonical is a fixed point of parse->render
        assert_eq!(canonical, render(&parse(canonical).expect("parse canonical")), "{name}: fixed point");

        for probe in c["contains"].as_array().expect("contains array") {
            let arr = probe.as_array().expect("probe array");
            let n = arr[0].as_i64().expect("probe n");
            let expected = arr[1].as_bool().expect("probe bool");
            assert_eq!(expected, contains(&rs, n), "{name}: contains {n}");
        }
    }
}

#[test]
fn rust_range_set_rejection_vectors_decline_specific_feedback() {
    let doc = golden();
    for r in doc["rejections"].as_array().expect("rejections array") {
        let name = r["name"].as_str().expect("name");
        let input = r["input"].as_str().expect("input");
        let expected = r["feedback"].as_str().expect("feedback");
        match parse(input) {
            Err(f) => assert_eq!(expected, feedback_name(&f), "{name}"),
            Ok(rs) => panic!("{name}: expected Err {expected}, got Ok {rs:?}"),
        }
    }
}

#[test]
fn rust_range_set_structural_laws() {
    let p = |s: &str| parse(s).expect("parse");
    assert_eq!("1-6", render(&union(&p("1-3"), &p("4-6"))));
    assert_eq!("1-6,10-14", render(&union(&p("1-5,10-12"), &p("6,13-14"))));
    assert_eq!("1-7", render(&add(&p("1-3,5-7"), 4)));
    assert_eq!("1-3,10", render(&add(&p("1-3"), 10)));
    assert_eq!(0, size(&p("")));
    assert_eq!(14, size(&p("1-5,8,10-17")));
}
