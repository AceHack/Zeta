//! Canonical YAML encoder -- Rust oracle, an exact mirror of the F#/TS/C# encoders
//! so all four produce BYTE-IDENTICAL canonical YAML (cross-language byte-lock;
//! YAML is the storage of record). Round-trips with the parser. Block style;
//! 2-space indent; map keys keep insertion order; strings + keys always
//! double-quoted (escapes \\ \" \n \t \r \0); null/bool/int plain; float via
//! shortest-repr with a forced "." . Culture-invariant (no locale formatting).

use crate::dom::YamlValue;

fn quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            '\r' => out.push_str("\\r"),
            '\0' => out.push_str("\\0"),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn force_float(f: f64) -> String {
    let r = format!("{f}");
    if r.contains(['.', 'e', 'E']) {
        r
    } else {
        format!("{r}.0")
    }
}

/// Inline rendering of a scalar value, or `None` for a container.
fn scalar(v: &YamlValue) -> Option<String> {
    match v {
        YamlValue::Null => Some("null".to_string()),
        YamlValue::Bool(b) => Some((if *b { "true" } else { "false" }).to_string()),
        YamlValue::Int(i) => Some(i.to_string()),
        YamlValue::Float(f) => Some(force_float(*f)),
        YamlValue::Str(s) => Some(quote(s)),
        YamlValue::Seq(_) | YamlValue::Map(_) => None,
    }
}

fn emit(indent: usize, v: &YamlValue, lines: &mut Vec<String>) {
    let pad = " ".repeat(indent);
    match v {
        YamlValue::Map(entries) => {
            for (k, child) in entries {
                let key = quote(k);
                match scalar(child) {
                    Some(s) => lines.push(format!("{pad}{key}: {s}")),
                    None => {
                        lines.push(format!("{pad}{key}:"));
                        emit(indent + 2, child, lines);
                    }
                }
            }
        }
        YamlValue::Seq(items) => {
            for child in items {
                match scalar(child) {
                    Some(s) => lines.push(format!("{pad}- {s}")),
                    None => {
                        lines.push(format!("{pad}-"));
                        emit(indent + 2, child, lines);
                    }
                }
            }
        }
        other => lines.push(format!("{pad}{}", scalar(other).expect("scalar"))),
    }
}

/// Canonical YAML rendering -- byte-identical to the F#/TS/C# encoders.
#[must_use]
pub fn encode(v: &YamlValue) -> String {
    let mut lines = Vec::new();
    emit(0, v, &mut lines);
    lines.join("\n") + "\n"
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dom::parse;

    // re-encode round-trip (canonical encode is deterministic; avoids needing PartialEq)
    fn roundtrips(v: &YamlValue) -> bool {
        match parse(&encode(v)) {
            Ok(back) => encode(&back) == encode(v),
            Err(_) => false,
        }
    }

    #[test]
    fn byte_lock_flat_matches_fsharp() {
        let v = YamlValue::Map(vec![
            ("b".into(), YamlValue::Int(2)),
            ("a".into(), YamlValue::Str("x".into())),
            ("n".into(), YamlValue::Null),
        ]);
        assert_eq!(encode(&v), "\"b\": 2\n\"a\": \"x\"\n\"n\": null\n");
    }

    #[test]
    fn byte_lock_nested_matches_fsharp() {
        let v = YamlValue::Map(vec![
            (
                "outer".into(),
                YamlValue::Map(vec![("inner".into(), YamlValue::Int(5))]),
            ),
            (
                "list".into(),
                YamlValue::Seq(vec![YamlValue::Int(1), YamlValue::Str("two".into())]),
            ),
        ]);
        assert_eq!(
            encode(&v),
            "\"outer\":\n  \"inner\": 5\n\"list\":\n  - 1\n  - \"two\"\n"
        );
    }

    #[test]
    fn strings_round_trip_as_map_values() {
        for s in [
            "123", "true", "null", "", "  sp  ", "a: b", "# c", "- d", "[x", "{y", "&z",
            "line\nbreak", "tab\tsep", "q\"here", "back\\slash", "ret\rurn", "nul\0byte",
        ] {
            let v = YamlValue::Map(vec![("v".into(), YamlValue::Str(s.into()))]);
            assert!(roundtrips(&v), "failed for {s:?}");
        }
    }

    #[test]
    fn nesting_round_trips() {
        let cases = vec![
            YamlValue::Seq(vec![
                YamlValue::Int(1),
                YamlValue::Int(2),
                YamlValue::Str("three".into()),
            ]),
            YamlValue::Map(vec![(
                "outer".into(),
                YamlValue::Map(vec![("inner".into(), YamlValue::Int(5))]),
            )]),
            YamlValue::Map(vec![(
                "list".into(),
                YamlValue::Seq(vec![YamlValue::Int(1), YamlValue::Int(2)]),
            )]),
            YamlValue::Seq(vec![
                YamlValue::Map(vec![("a".into(), YamlValue::Int(1))]),
                YamlValue::Map(vec![("b".into(), YamlValue::Int(2))]),
            ]),
        ];
        for v in &cases {
            assert!(roundtrips(v));
        }
    }
}
