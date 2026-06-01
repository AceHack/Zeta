//! Bonsai-subset serializer — the Rust oracle (#4 of TS/F#/C#/Rust) cross-verify for B-0976
//! slice 1. The TS reference oracle authors the shared golden vectors
//! (`src/Core.TypeScript/bonsai/golden-vectors.json`); this proves the Rust impl replays them
//! byte-for-byte: `serialize(parse(canonical)) == canonical` (the cross-language byte lock).
//! "The compilers don't lie."
//!
//! Dev-only `serde_json` reads the golden fixture wrapper; the *production* parse/serialize
//! under test are zero-dep (the hand-rolled reader in the crate). Rejection tests assert the
//! SPECIFIC feedback variant (the cross-language rejection-vector contract); accumulate tests
//! cover `parse_all` + RFC-9457 `ProblemDetails`.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_bonsai::{
    BonsaiFeedback, ConstValue, Expr, MAX_DEPTH, parse, parse_all, serialize, to_problem_details,
};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching the convention
/// in the other Rust oracles.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

const CONST_INT_CANONICAL: &str = r#"{"v":1,"expr":{"kind":"const","value":{"t":"int","v":42}}}"#;

// A canonical-shaped doc with three INDEPENDENT bad leaves: unknown op, non-string param
// name, fractional int — the accumulate mode collects all three.
const THREE_BAD_LEAVES: &str = r#"{"v":1,"expr":{"kind":"binary","op":"xor","left":{"kind":"param","name":42},"right":{"kind":"const","value":{"t":"int","v":1.5}}}}"#;

#[test]
fn bonsai_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/bonsai/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read bonsai golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse bonsai golden-vectors.json");

    let cases = v["cases"].as_array().expect("cases array");
    assert!(!cases.is_empty(), "no golden cases loaded");

    for case in cases {
        let name = case["name"].as_str().expect("case.name string");
        let canonical = case["canonical"].as_str().expect("case.canonical string");

        let parsed = parse(canonical).unwrap_or_else(|e| panic!("{name}: parse failed: {e:?}"));
        let round =
            serialize(&parsed).unwrap_or_else(|e| panic!("{name}: serialize failed: {e:?}"));
        assert_eq!(
            round, canonical,
            "{name}: serialize is not the byte-exact fixed point"
        );

        // structural stability: parsing the same canonical twice yields equal trees
        let again = parse(canonical).expect("re-parse");
        assert_eq!(parsed, again, "{name}: parse is not stable");
    }
}

#[test]
fn independently_constructed_tree_matches_golden_canonical() {
    let e = Expr::Const(ConstValue::Int(42));
    assert_eq!(serialize(&e).expect("serialize"), CONST_INT_CANONICAL);
}

// ---- rejection-by-variant (the cross-language rejection-vector contract) ----

#[test]
fn unsupported_version_declines() {
    let r = parse(r#"{"v":2,"expr":{"kind":"const","value":{"t":"int","v":1}}}"#);
    assert!(matches!(r, Err(BonsaiFeedback::UnsupportedVersion { .. })));
}

#[test]
fn malformed_json_declines() {
    assert!(matches!(
        parse("not json"),
        Err(BonsaiFeedback::MalformedJson(_))
    ));
}

#[test]
fn unknown_kind_declines() {
    let r = parse(r#"{"v":1,"expr":{"kind":"frobnicate"}}"#);
    assert!(matches!(r, Err(BonsaiFeedback::UnknownKind(_))));
}

#[test]
fn unknown_const_tag_declines() {
    let r = parse(r#"{"v":1,"expr":{"kind":"const","value":{"t":"float","v":1}}}"#);
    assert!(matches!(r, Err(BonsaiFeedback::UnknownConstTag(_))));
}

#[test]
fn unknown_op_declines() {
    let r = parse(
        r#"{"v":1,"expr":{"kind":"binary","op":"xor","left":{"kind":"const","value":{"t":"int","v":1}},"right":{"kind":"const","value":{"t":"int","v":2}}}}"#,
    );
    assert!(matches!(r, Err(BonsaiFeedback::UnknownOp(_))));
}

#[test]
fn non_safe_int_declines_on_serialize() {
    let e = Expr::Const(ConstValue::Int(9_007_199_254_740_992));
    assert!(matches!(serialize(&e), Err(BonsaiFeedback::NonSafeInt(_))));
}

#[test]
fn non_canonical_declines() {
    // structurally valid, but a space after the wrapper comma → not canonical bytes
    let r = parse(r#"{"v":1, "expr":{"kind":"const","value":{"t":"int","v":42}}}"#);
    assert!(matches!(r, Err(BonsaiFeedback::NonCanonical)));
}

#[test]
fn malformed_number_declines_as_malformed_json() {
    // a real JSON parser rejects a leading-zero integer — error-for-error with the siblings
    // (MalformedJson), not a downstream NonCanonical/ExpectedInt
    for bad in [
        r#"{"v":1,"expr":{"kind":"const","value":{"t":"int","v":01}}}"#,
        r#"{"v":1,"expr":{"kind":"const","value":{"t":"int","v":1.2.3}}}"#,
        r#"{"v":1,"expr":{"kind":"const","value":{"t":"int","v":1+}}}"#,
    ] {
        assert!(
            matches!(parse(bad), Err(BonsaiFeedback::MalformedJson(_))),
            "expected MalformedJson for {bad}"
        );
    }
}

#[test]
fn raw_control_char_in_string_declines_as_malformed_json() {
    // an unescaped newline inside a JSON string is malformed JSON (the siblings reject it)
    let bad = "{\"v\":1,\"expr\":{\"kind\":\"param\",\"name\":\"a\nb\"}}";
    assert!(matches!(parse(bad), Err(BonsaiFeedback::MalformedJson(_))));
}

#[test]
fn too_deep_declines_on_serialize() {
    // Build + serialize + drop a depth-exceeding tree on a large stack. The production depth
    // guard bounds recursion at MAX_DEPTH (fine on the 8 MiB main thread), but constructing,
    // serializing, AND recursively dropping a >1024-deep tree exceeds the default 2 MiB
    // test-thread stack — so exercise it on a generously-sized thread.
    let declined = std::thread::Builder::new()
        .stack_size(64 * 1024 * 1024)
        .spawn(|| {
            let mut e = Expr::Const(ConstValue::Int(1));
            for _ in 0..=MAX_DEPTH {
                e = Expr::Lambda {
                    params: vec!["x".to_string()],
                    body: Box::new(e),
                };
            }
            matches!(serialize(&e), Err(BonsaiFeedback::TooDeep(_)))
        })
        .expect("spawn deep-tree thread")
        .join()
        .expect("join deep-tree thread");
    assert!(declined, "expected TooDeep for an over-MAX_DEPTH tree");
}

// ---- accumulate-mode (RFC-9457 ProblemDetails) ----

#[test]
fn parse_all_returns_ok_on_golden_canonical() {
    assert!(parse_all(CONST_INT_CANONICAL).is_ok());
}

#[test]
fn parse_all_collects_every_independent_decline() {
    let err = parse_all(THREE_BAD_LEAVES).expect_err("should decline");
    let mut paths: Vec<String> = err.iter().map(|pf| pf.path.clone()).collect();
    paths.sort();
    assert_eq!(
        paths,
        vec!["$.expr.left.name", "$.expr.op", "$.expr.right.value"]
    );
}

#[test]
fn to_problem_details_groups_declines_by_path() {
    let err = parse_all(THREE_BAD_LEAVES).expect_err("should decline");
    let pd = to_problem_details(&err);
    let keys: Vec<&String> = pd.errors.keys().collect();
    assert_eq!(
        keys,
        vec!["$.expr.left.name", "$.expr.op", "$.expr.right.value"]
    );
}

#[test]
fn parse_all_returns_single_malformed_json() {
    let err = parse_all("not json").expect_err("should decline");
    assert_eq!(err.len(), 1);
    assert_eq!(err[0].path, "$");
    assert!(matches!(err[0].feedback, BonsaiFeedback::MalformedJson(_)));
}

#[test]
fn parse_all_returns_single_non_canonical() {
    let err = parse_all(r#"{"v":1, "expr":{"kind":"const","value":{"t":"int","v":42}}}"#)
        .expect_err("should decline");
    assert_eq!(err.len(), 1);
    assert_eq!(err[0].path, "$");
    assert!(matches!(err[0].feedback, BonsaiFeedback::NonCanonical));
}
