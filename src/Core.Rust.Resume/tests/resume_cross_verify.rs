//! Resume engine — the Rust ferry cross-verify for the B-0976 resume slice. The TS reference
//! (`src/Core.TypeScript/bonsai/resume.ts`) authors the shared saga traces
//! (`resume-golden.json`); this proves the Rust impl replays them: same ordered suspension
//! sequence + same final value (the cross-language behavioral lock), and restore-not-replay
//! (persist + re-parse the state at every suspension; prior activities are never re-invoked).
//! "The compilers don't lie."
//!
//! Dev-only `serde_json` reads the golden fixture; the *production* engine under test is zero-dep.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_bonsai::{BinOp, ConstValue, Expr};
use zeta_core_resume::{Activity, Env, ResumeFeedback, SagaStep, parse_state, resume, serialize_state, start};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching the other oracles.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

// ---- golden JSON -> Rust DU converters ----

fn binop_of_json(s: &str) -> BinOp {
    match s {
        "add" => BinOp::Add,
        "sub" => BinOp::Sub,
        "mul" => BinOp::Mul,
        "eq" => BinOp::Eq,
        "lt" => BinOp::Lt,
        "and" => BinOp::And,
        "or" => BinOp::Or,
        other => panic!("unknown op {other}"),
    }
}

fn const_of_json(v: &Value) -> ConstValue {
    match v["t"].as_str().expect("const tag") {
        "int" => ConstValue::Int(v["v"].as_i64().expect("int value")),
        "str" => ConstValue::Str(v["v"].as_str().expect("str value").to_string()),
        "bool" => ConstValue::Bool(v["v"].as_bool().expect("bool value")),
        "null" => ConstValue::Null,
        other => panic!("unknown const tag {other}"),
    }
}

fn expr_of_json(v: &Value) -> Expr {
    match v["kind"].as_str().expect("kind") {
        "const" => Expr::Const(const_of_json(&v["value"])),
        "param" => Expr::Param(v["name"].as_str().expect("name").to_string()),
        "lambda" => Expr::Lambda {
            params: v["params"].as_array().expect("params").iter().map(|p| p.as_str().expect("param").to_string()).collect(),
            body: Box::new(expr_of_json(&v["body"])),
        },
        "binary" => Expr::Binary {
            op: binop_of_json(v["op"].as_str().expect("op")),
            left: Box::new(expr_of_json(&v["left"])),
            right: Box::new(expr_of_json(&v["right"])),
        },
        "call" => Expr::Call {
            fn_name: v["fn"].as_str().expect("fn").to_string(),
            args: v["args"].as_array().expect("args").iter().map(expr_of_json).collect(),
        },
        "cond" => Expr::Cond {
            test: Box::new(expr_of_json(&v["test"])),
            then: Box::new(expr_of_json(&v["then"])),
            els: Box::new(expr_of_json(&v["else"])),
        },
        other => panic!("unknown kind {other}"),
    }
}

fn activity_of_json(v: &Value) -> Activity {
    Activity {
        fn_name: v["fn"].as_str().expect("fn").to_string(),
        args: v["args"].as_array().expect("args").iter().map(const_of_json).collect(),
    }
}

#[test]
fn rust_resume_replays_every_shared_golden_trace_restore_not_replay() {
    let path = repo_root().join("src/Core.TypeScript/bonsai/resume-golden.json");
    let text = std::fs::read_to_string(&path).expect("read resume-golden.json");
    let doc: Value = serde_json::from_str(&text).expect("parse golden json");
    let traces = doc["traces"].as_array().expect("traces array");
    assert!(!traces.is_empty(), "no golden traces");

    for tr in traces {
        let name = tr["name"].as_str().expect("name");
        let program = expr_of_json(&tr["program"]);
        let mut bindings = Env::new();
        if let Some(obj) = tr["bindings"].as_object() {
            for (k, v) in obj {
                bindings.insert(k.clone(), const_of_json(v));
            }
        }
        let activity_results: Vec<ConstValue> = tr["activityResults"].as_array().expect("activityResults").iter().map(const_of_json).collect();
        let expected_suspensions: Vec<Activity> = tr["expectedSuspensions"].as_array().expect("expectedSuspensions").iter().map(activity_of_json).collect();
        // the canonical serialize_state bytes the TS reference emits at each suspension, in order —
        // the cross-oracle STATE-BYTE lock this Rust oracle must reproduce verbatim (kont top-last)
        let expected_state_at_suspension: Vec<&str> = tr["expectedStateAtSuspension"]
            .as_array()
            .expect("expectedStateAtSuspension")
            .iter()
            .map(|s| s.as_str().expect("expectedStateAtSuspension entry"))
            .collect();
        let expected_final = const_of_json(&tr["expectedFinal"]);

        let mut step = start(&program, &bindings).unwrap_or_else(|f| panic!("{name}: start: {f:?}"));
        for (i, exp) in expected_suspensions.iter().enumerate() {
            match step {
                SagaStep::Done(v) => panic!("{name}: expected suspension {i}, got Done {v:?}"),
                SagaStep::Suspended { state, activity } => {
                    assert_eq!(*exp, activity, "{name}: suspension {i}");
                    // persist -> re-parse -> resume from the RESTORED state (not a replay)
                    let ser = serialize_state(&state).unwrap_or_else(|f| panic!("{name}: serialize: {f:?}"));
                    // STATE-BYTE LOCK: the persisted continuation must equal the TS reference bytes
                    // (the kont serializes top-last — innermost frame last in the array)
                    assert_eq!(expected_state_at_suspension[i], ser.as_str(), "{name}: state byte-lock at suspension {i}");
                    let restored = parse_state(&ser).unwrap_or_else(|f| panic!("{name}: parse: {f:?}"));
                    assert_eq!(ser, serialize_state(&restored).expect("re-serialize"), "{name}: round-trip byte-stable");
                    step = resume(restored, activity_results[i].clone()).unwrap_or_else(|f| panic!("{name}: resume: {f:?}"));
                }
            }
        }
        match step {
            SagaStep::Done(v) => assert_eq!(expected_final, v, "{name}: final"),
            SagaStep::Suspended { activity, .. } => panic!("{name}: expected Done, suspended on {activity:?}"),
        }
    }
}

#[test]
fn rust_resume_unbound_param_declines() {
    for n in ["missing", "toString", "constructor"] {
        match start(&Expr::Param(n.to_string()), &Env::new()) {
            Err(ResumeFeedback::Unbound(_)) => {}
            other => panic!("expected Unbound for {n}, got {other:?}"),
        }
    }
}

#[test]
fn rust_resume_type_mismatch_declines() {
    let p = Expr::Binary {
        op: BinOp::Add,
        left: Box::new(Expr::Const(ConstValue::Int(1))),
        right: Box::new(Expr::Const(ConstValue::Bool(true))),
    };
    assert!(matches!(start(&p, &Env::new()), Err(ResumeFeedback::TypeMismatch { .. })));
}

#[test]
fn rust_resume_lambda_unsupported() {
    let p = Expr::Lambda { params: vec!["x".to_string()], body: Box::new(Expr::Const(ConstValue::Int(1))) };
    assert!(matches!(start(&p, &Env::new()), Err(ResumeFeedback::UnsupportedNode(_))));
}

#[test]
fn rust_resume_arithmetic_past_safe_int_declines() {
    let p = Expr::Binary {
        op: BinOp::Add,
        left: Box::new(Expr::Const(ConstValue::Int(9_007_199_254_740_991))),
        right: Box::new(Expr::Const(ConstValue::Int(1))),
    };
    assert!(matches!(start(&p, &Env::new()), Err(ResumeFeedback::NonSafeInt(_))));
}

#[test]
fn rust_resume_multiply_overflowing_i64_into_safe_range_declines() {
    // 4294967296 (= 2^32) is a valid safe int; its square is 2^64, which overflows i64 (Rust
    // debug-panics; release wraps to 0 — a silently-wrong Int(0)). The i128 path catches the
    // true product as out-of-safe-range.
    let p = Expr::Binary {
        op: BinOp::Mul,
        left: Box::new(Expr::Const(ConstValue::Int(4_294_967_296))),
        right: Box::new(Expr::Const(ConstValue::Int(4_294_967_296))),
    };
    assert!(matches!(start(&p, &Env::new()), Err(ResumeFeedback::NonSafeInt(_))));
}

#[test]
fn rust_resume_deep_embedded_program_restores_past_low_depth() {
    fn deep_nest(n: u32) -> Expr {
        if n == 0 {
            Expr::Const(ConstValue::Int(0))
        } else {
            Expr::Binary { op: BinOp::Add, left: Box::new(Expr::Const(ConstValue::Int(1))), right: Box::new(deep_nest(n - 1)) }
        }
    }

    // left is a no-arg activity -> suspends immediately, leaving the deep right operand inline.
    let program = Expr::Binary {
        op: BinOp::Add,
        left: Box::new(Expr::Call { fn_name: "a".to_string(), args: vec![] }),
        right: Box::new(deep_nest(100)),
    };
    match start(&program, &Env::new()).expect("start") {
        SagaStep::Suspended { state, .. } => {
            let ser = serialize_state(&state).expect("serialize");
            let restored = parse_state(&ser).expect("parse deep state");
            assert_eq!(ser, serialize_state(&restored).expect("re-serialize"));
        }
        SagaStep::Done(v) => panic!("expected suspension, got Done {v:?}"),
    }
}

#[test]
fn rust_resume_state_strings_escape_like_json_stringify() {
    let program = Expr::Call { fn_name: "act".to_string(), args: vec![Expr::Const(ConstValue::Str("x<y\"z\n".to_string()))] };
    match start(&program, &Env::new()).expect("start") {
        SagaStep::Suspended { state, .. } => {
            let ser = serialize_state(&state).expect("serialize");
            assert!(ser.contains('<'), "literal '<': {ser}");
            assert!(!ser.contains("\\u003"), "no <-style escaping: {ser}");
            assert!(ser.contains("\\n"), "newline short escape: {ser}");
            assert_eq!(ser, serialize_state(&parse_state(&ser).expect("parse")).expect("re-serialize"));
        }
        SagaStep::Done(v) => panic!("expected suspension, got Done {v:?}"),
    }
}

#[test]
fn rust_resume_parse_state_declines_malformed() {
    assert!(matches!(parse_state("not json"), Err(ResumeFeedback::MalformedState(_))));
    assert!(matches!(
        parse_state(r#"{"v":2,"kont":[],"awaiting":{"fn":"a","args":[]}}"#),
        Err(ResumeFeedback::MalformedState(_))
    ));

    // a real suspension's persisted state with a tampered op / unsafe int must be rejected
    let program = Expr::Binary {
        op: BinOp::Add,
        left: Box::new(Expr::Call { fn_name: "a".to_string(), args: vec![Expr::Const(ConstValue::Int(7))] }),
        right: Box::new(Expr::Call { fn_name: "b".to_string(), args: vec![] }),
    };
    match start(&program, &Env::new()).expect("start") {
        SagaStep::Suspended { state, .. } => {
            let ser = serialize_state(&state).expect("serialize");

            let tampered_op = ser.replace(r#""op":"add""#, r#""op":"xor""#);
            assert_ne!(ser, tampered_op);
            assert!(matches!(parse_state(&tampered_op), Err(ResumeFeedback::MalformedState(_))));

            let tampered_int = ser.replace(r#""v":7"#, r#""v":9007199254740993"#);
            assert_ne!(ser, tampered_int);
            assert!(matches!(parse_state(&tampered_int), Err(ResumeFeedback::MalformedState(_))));
        }
        SagaStep::Done(v) => panic!("expected suspension, got Done {v:?}"),
    }
}
