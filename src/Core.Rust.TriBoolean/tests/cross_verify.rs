//! Cross-language-parity = the verification: the Rust TriBoolean
//! oracle (#4) evaluates the SHARED standard-anchored golden vectors and must produce
//! the exact JSON structure the TS reference (oracle #1) emitted.
//!
//! Reads `tests/cross-verification/tri-boolean/vectors.yaml` and
//! writes `rust-output.json` to the same directory, so
//! `tests/cross-verification/tri-boolean/compare.ts` can deep-equal all four outputs.

use std::path::PathBuf;

use zeta_core_tri_boolean::{
    and_tri, bind_tri, cooperate, from_bool, is_certain, is_living, map_tri, measure, not_tri,
    or_tri, CollapseFeedback, Tri,
};
use zeta_core_yaml::{parse, YamlValue};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel).
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

/// Pull a required string field from a vector's `Map`, panicking with a clear message
/// (naming the vector id when possible) on absence or wrong type.
fn str_field<'a>(entries: &'a [(String, YamlValue)], key: &str) -> Option<&'a str> {
    entries.iter().find(|(k, _)| k == key).map(|(_, v)| match v {
        YamlValue::Str(s) => s.as_str(),
        other => {
            let id = entries
                .iter()
                .find(|(k, _)| k == "id")
                .map(|(_, v)| format!("{v:?}"))
                .unwrap_or_else(|| "<no-id>".to_string());
            panic!("vector {id} field {key} is not a Str: {other:?}")
        }
    })
}

/// Minimal JSON string escaping (ids + values are plain ASCII, but be safe).
fn json_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

fn to_tri(s: &str) -> Tri {
    match s {
        "T" => Tri::True,
        "F" => Tri::False,
        "N" => Tri::N,
        other => panic!("unknown tri state: {other}"),
    }
}

fn to_str(t: Tri) -> String {
    match t {
        Tri::True => "T".to_string(),
        Tri::False => "F".to_string(),
        Tri::N => "N".to_string(),
    }
}

#[test]
fn cross_verify_matches_shared_vectors() {
    let fixture_dir = repo_root().join("tests/cross-verification/tri-boolean");
    let text = std::fs::read_to_string(fixture_dir.join("vectors.yaml")).expect("read vectors.yaml");

    // Parse via local YAML port
    let doc = parse(&text).expect("parse vectors.yaml via YAML port");
    let top = match doc {
        YamlValue::Map(entries) => entries,
        other => panic!("expected top-level Map, got {other:?}"),
    };
    let vectors = top
        .iter()
        .find(|(k, _)| k == "vectors")
        .map(|(_, v)| v)
        .expect("top-level key 'vectors'");
    let records = match vectors {
        YamlValue::Seq(items) => items,
        other => panic!("'vectors' is not a Seq, got {other:?}"),
    };
    assert!(!records.is_empty(), "no vectors parsed");

    let mut json_records = Vec::with_capacity(records.len());

    for rec in records {
        let entries = match rec {
            YamlValue::Map(e) => e,
            other => panic!("vector record is not a Map, got {other:?}"),
        };
        let id = str_field(entries, "id").expect("vector missing 'id'").to_string();
        let type_str = str_field(entries, "type").expect("vector missing 'type'");

        if type_str == "unary" {
            let state_str = str_field(entries, "state").unwrap();
            let t = to_tri(state_str);
            let m_res = measure(t);
            let measure_ok = m_res.is_ok();
            let measure_value = m_res.unwrap_or(false);
            let measure_feedback = match m_res {
                Ok(_) => "",
                Err(CollapseFeedback::CollapsedLivingUncertainty) => "collapsed-living-uncertainty",
            };

            let line = format!(
                "  {}: {{\n\
                 \x20   \"type\": \"unary\",\n\
                 \x20   \"state\": {},\n\
                 \x20   \"isLiving\": {},\n\
                 \x20   \"isCertain\": {},\n\
                 \x20   \"notState\": {},\n\
                 \x20   \"cooperateState\": {},\n\
                 \x20   \"measureOk\": {},\n\
                 \x20   \"measureValue\": {},\n\
                 \x20   \"measureFeedback\": {},\n\
                 \x20   \"mapNot\": {},\n\
                 \x20   \"bindNot\": {},\n\
                 \x20   \"bindToT\": {}\n\
                 \x20 }}",
                json_str(&id),
                json_str(state_str),
                is_living(t),
                is_certain(t),
                json_str(&to_str(not_tri(t))),
                json_str(&to_str(cooperate(t))),
                measure_ok,
                measure_value,
                json_str(measure_feedback),
                json_str(&to_str(map_tri(t, |b| !b))),
                json_str(&to_str(bind_tri(t, |b| from_bool(!b)))),
                json_str(&to_str(bind_tri(t, |_| Tri::True)))
            );
            json_records.push(line);
        } else if type_str == "binary" {
            let left_str = str_field(entries, "left").unwrap();
            let right_str = str_field(entries, "right").unwrap();
            let left = to_tri(left_str);
            let right = to_tri(right_str);

            let line = format!(
                "  {}: {{\n\
                 \x20   \"type\": \"binary\",\n\
                 \x20   \"left\": {},\n\
                 \x20   \"right\": {},\n\
                 \x20   \"expectedAnd\": {},\n\
                 \x20   \"expectedOr\": {}\n\
                 \x20 }}",
                json_str(&id),
                json_str(left_str),
                json_str(right_str),
                json_str(&to_str(and_tri(left, right))),
                json_str(&to_str(or_tri(left, right)))
            );
            json_records.push(line);
        } else if type_str == "float" {
            let high_str = str_field(entries, "high").unwrap();
            let decoder_str = str_field(entries, "decoder").unwrap();
            let low_str = str_field(entries, "low").unwrap();

            let high: Vec<Tri> = high_str.chars().map(|c| to_tri(&c.to_string())).collect();
            let decoder_vec: Vec<Tri> = decoder_str.chars().map(|c| to_tri(&c.to_string())).collect();
            let low: Vec<Tri> = low_str.chars().map(|c| to_tri(&c.to_string())).collect();

            let f = zeta_core_tri_boolean::float::from_trits(high, decoder_vec, low);
            let d_res = zeta_core_tri_boolean::float::decode(&f);

            let expected_ok = d_res.is_ok();
            let expected_value = d_res.unwrap_or(0.0);
            let expected_feedback = match d_res {
                Ok(_) => "",
                Err(zeta_core_tri_boolean::float::FloatFeedback::InterpretationSuperposed) => "interpretation-superposed",
                Err(zeta_core_tri_boolean::float::FloatFeedback::ValueSuperposed) => "value-superposed",
            };

            let mut line = format!(
                "  {}: {{\n\
                 \x20   \"type\": \"float\",\n\
                 \x20   \"high\": {},\n\
                 \x20   \"decoder\": {},\n\
                 \x20   \"low\": {},\n\
                 \x20   \"expectedOk\": {},\n\
                 \x20   \"expectedValue\": {},\n\
                 \x20   \"expectedFeedback\": {}",
                json_str(&id),
                json_str(high_str),
                json_str(decoder_str),
                json_str(low_str),
                expected_ok,
                expected_value,
                json_str(expected_feedback)
            );

            // Check for encode_value
            let encode_val_node = entries.iter().find(|(k, _)| k == "encode_value").map(|(_, v)| v);
            if let Some(val_node) = encode_val_node {
                let encode_value = match val_node {
                    YamlValue::Int(i) => *i as f64,
                    YamlValue::Float(fv) => *fv,
                    other => panic!("expected Int or Float for encode_value, got {other:?}"),
                };
                let enc_res = zeta_core_tri_boolean::float::from_value(encode_value, f.shape);
                line.push_str(",\n");
                line.push_str(&format!(
                    "    \"encodeValue\": {},\n\
                     \x20   \"expectedEncodeOk\": {}",
                    encode_value,
                    enc_res.is_ok()
                ));
                match enc_res {
                    Ok(enc_float) => {
                        let enc_high: String = enc_float.high.iter().map(|t| to_str(*t)).collect();
                        let enc_dec: String = enc_float.decoder.iter().map(|t| to_str(*t)).collect();
                        let enc_low: String = enc_float.low.iter().map(|t| to_str(*t)).collect();
                        line.push_str(",\n");
                        line.push_str(&format!(
                            "    \"expectedEncodeHigh\": {},\n\
                             \x20   \"expectedEncodeDecoder\": {},\n\
                             \x20   \"expectedEncodeLow\": {}",
                            json_str(&enc_high),
                            json_str(&enc_dec),
                            json_str(&enc_low)
                        ));
                    }
                    Err(detail) => {
                        line.push_str(",\n");
                        line.push_str(&format!(
                            "    \"expectedEncodeDetail\": {}",
                            json_str(&detail)
                        ));
                    }
                }
            }

            line.push_str("\n  }");
            json_records.push(line);
        }
    }

    let mut out = String::from("{\n");
    for (i, line) in json_records.iter().enumerate() {
        out.push_str(line);
        out.push_str(if i + 1 < json_records.len() { ",\n" } else { "\n" });
    }
    out.push_str("}\n");

    let output_path = fixture_dir.join("rust-output.json");
    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        std::fs::write(&output_path, &out).expect("write rust-output.json");
    } else {
        let existing = std::fs::read_to_string(&output_path).unwrap_or_default();
        assert_eq!(
            existing, out,
            "rust-output.json is stale -- regenerate with `UPDATE_GOLDEN=1 cargo test`",
        );
    }
}
