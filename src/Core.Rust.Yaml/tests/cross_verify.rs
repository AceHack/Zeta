//! Cross-language-parity = the verification (m-acc multi-oracle): the Rust YAML reader
//! (oracle #4) runs the SHARED golden vectors and must produce the exact L1 event stream
//! the TS reference (oracle #1) emitted -- and that the F#/C# oracles already reproduced.
//! "The compilers don't lie."
//!
//! Reads `tests/cross-verification/yaml/vectors.json` (the shared fixture, JSON not YAML
//! -- we do not use YAML to test YAML) and writes `rust-output.json` to the same
//! directory, so `tests/cross-verification/yaml/compare.ts` can deep-equal all four
//! `{ id: YamlEvent[] }` outputs.
//!
//! Zero-dep: a tiny hand-rolled recursive-descent JSON reader parses the fixture, and the
//! output JSON is emitted by hand (each event is a tiny fixed-shape object) exactly like
//! `src/Core.Rust.ZetaId/tests/cross_verify.rs` writes its output by hand -- keeping the
//! oracle dependency free (supply-chain doctrine).

use std::path::PathBuf;

use zeta_core_yaml::{read_events, ScalarKind, ScalarStyle, YamlEvent};

// ===================================================================================
// Minimal zero-dep JSON reader (only what the fixture needs: objects, arrays, strings,
// with `\n \t \r \" \\ \/ \b \f \uXXXX` string escapes). Numbers/bools/null are not
// present as fixture *values* we read, but we parse them defensively to skip cleanly.
// ===================================================================================

#[derive(Debug, Clone, PartialEq)]
enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
}

struct JsonReader<'a> {
    chars: &'a [char],
    pos: usize,
}

impl<'a> JsonReader<'a> {
    fn new(chars: &'a [char]) -> Self {
        JsonReader { chars, pos: 0 }
    }

    fn skip_ws(&mut self) {
        while let Some(&c) = self.chars.get(self.pos) {
            if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
                self.pos += 1;
            } else {
                break;
            }
        }
    }

    fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn bump(&mut self) -> char {
        let c = self.chars[self.pos];
        self.pos += 1;
        c
    }

    fn expect(&mut self, c: char) {
        self.skip_ws();
        let got = self.bump();
        assert_eq!(got, c, "JSON: expected {c:?} at pos {}", self.pos - 1);
    }

    fn value(&mut self) -> Json {
        self.skip_ws();
        match self.peek().expect("JSON: unexpected EOF") {
            '{' => self.object(),
            '[' => self.array(),
            '"' => Json::Str(self.string()),
            't' | 'f' => self.boolean(),
            'n' => self.null(),
            _ => self.number(),
        }
    }

    fn object(&mut self) -> Json {
        self.expect('{');
        let mut entries: Vec<(String, Json)> = Vec::new();
        self.skip_ws();
        if self.peek() == Some('}') {
            self.bump();
            return Json::Obj(entries);
        }
        loop {
            self.skip_ws();
            let key = self.string();
            self.expect(':');
            let val = self.value();
            entries.push((key, val));
            self.skip_ws();
            match self.bump() {
                ',' => continue,
                '}' => break,
                other => panic!("JSON: expected ',' or '}}' in object, got {other:?}"),
            }
        }
        Json::Obj(entries)
    }

    fn array(&mut self) -> Json {
        self.expect('[');
        let mut items: Vec<Json> = Vec::new();
        self.skip_ws();
        if self.peek() == Some(']') {
            self.bump();
            return Json::Arr(items);
        }
        loop {
            items.push(self.value());
            self.skip_ws();
            match self.bump() {
                ',' => continue,
                ']' => break,
                other => panic!("JSON: expected ',' or ']' in array, got {other:?}"),
            }
        }
        Json::Arr(items)
    }

    fn string(&mut self) -> String {
        self.skip_ws();
        self.expect('"');
        let mut out = String::new();
        loop {
            let c = self.bump();
            match c {
                '"' => break,
                '\\' => {
                    let esc = self.bump();
                    match esc {
                        '"' => out.push('"'),
                        '\\' => out.push('\\'),
                        '/' => out.push('/'),
                        'n' => out.push('\n'),
                        't' => out.push('\t'),
                        'r' => out.push('\r'),
                        'b' => out.push('\u{08}'),
                        'f' => out.push('\u{0C}'),
                        'u' => {
                            let mut code = 0u32;
                            for _ in 0..4 {
                                let h = self.bump();
                                code = code * 16
                                    + h.to_digit(16).expect("JSON: bad \\u hex digit");
                            }
                            out.push(char::from_u32(code).expect("JSON: bad \\u codepoint"));
                        }
                        other => panic!("JSON: bad string escape \\{other}"),
                    }
                }
                other => out.push(other),
            }
        }
        out
    }

    fn boolean(&mut self) -> Json {
        // peek already matched 't' or 'f'
        if self.peek() == Some('t') {
            for c in "true".chars() {
                assert_eq!(self.bump(), c);
            }
            Json::Bool(true)
        } else {
            for c in "false".chars() {
                assert_eq!(self.bump(), c);
            }
            Json::Bool(false)
        }
    }

    fn null(&mut self) -> Json {
        for c in "null".chars() {
            assert_eq!(self.bump(), c);
        }
        Json::Null
    }

    fn number(&mut self) -> Json {
        let start = self.pos;
        while let Some(c) = self.peek() {
            if c.is_ascii_digit()
                || c == '-'
                || c == '+'
                || c == '.'
                || c == 'e'
                || c == 'E'
            {
                self.pos += 1;
            } else {
                break;
            }
        }
        let s: String = self.chars[start..self.pos].iter().collect();
        Json::Num(s.parse().expect("JSON: bad number"))
    }
}

impl Json {
    fn as_obj(&self) -> &[(String, Json)] {
        match self {
            Json::Obj(e) => e,
            other => panic!("expected JSON object, got {other:?}"),
        }
    }

    fn as_arr(&self) -> &[Json] {
        match self {
            Json::Arr(a) => a,
            other => panic!("expected JSON array, got {other:?}"),
        }
    }

    fn as_str(&self) -> &str {
        match self {
            Json::Str(s) => s,
            other => panic!("expected JSON string, got {other:?}"),
        }
    }

    fn get<'b>(&'b self, key: &str) -> Option<&'b Json> {
        self.as_obj().iter().find(|(k, _)| k == key).map(|(_, v)| v)
    }
}

fn parse_json(text: &str) -> Json {
    let chars: Vec<char> = text.chars().collect();
    let mut reader = JsonReader::new(&chars);
    let value = reader.value();
    reader.skip_ws();
    value
}

// ===================================================================================
// Event <-> JSON object shape (the cross-verify output / expected shape).
// ===================================================================================

fn kind_name(kind: ScalarKind) -> &'static str {
    match kind {
        ScalarKind::Null => "Null",
        ScalarKind::Bool => "Bool",
        ScalarKind::Int => "Int",
        ScalarKind::Float => "Float",
        ScalarKind::Str => "Str",
    }
}

fn style_name(style: ScalarStyle) -> &'static str {
    match style {
        ScalarStyle::Plain => "Plain",
        ScalarStyle::SingleQuoted => "SingleQuoted",
        ScalarStyle::DoubleQuoted => "DoubleQuoted",
    }
}

/// Minimal JSON string escaping for the `raw` field (newlines/quotes/etc. appear in the
/// vectors, so this MUST handle the full control-character set).
fn json_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            '\r' => out.push_str("\\r"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0C}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Serialize one event to its canonical JSON object string (single-line).
fn event_json(ev: &YamlEvent) -> String {
    match ev {
        YamlEvent::StreamStart => "{\"e\":\"StreamStart\"}".to_string(),
        YamlEvent::StreamEnd => "{\"e\":\"StreamEnd\"}".to_string(),
        YamlEvent::MappingStart => "{\"e\":\"MappingStart\"}".to_string(),
        YamlEvent::MappingEnd => "{\"e\":\"MappingEnd\"}".to_string(),
        YamlEvent::SequenceStart => "{\"e\":\"SequenceStart\"}".to_string(),
        YamlEvent::SequenceEnd => "{\"e\":\"SequenceEnd\"}".to_string(),
        YamlEvent::Scalar { raw, kind, style } => format!(
            "{{\"e\":\"Scalar\",\"raw\":{},\"kind\":\"{}\",\"style\":\"{}\"}}",
            json_str(raw),
            kind_name(*kind),
            style_name(*style),
        ),
    }
}

/// Compare an actual event against a fixture `expected` JSON event object.
fn event_matches(ev: &YamlEvent, expected: &Json) -> bool {
    let e_field = expected.get("e").map(Json::as_str);
    match ev {
        YamlEvent::StreamStart => e_field == Some("StreamStart"),
        YamlEvent::StreamEnd => e_field == Some("StreamEnd"),
        YamlEvent::MappingStart => e_field == Some("MappingStart"),
        YamlEvent::MappingEnd => e_field == Some("MappingEnd"),
        YamlEvent::SequenceStart => e_field == Some("SequenceStart"),
        YamlEvent::SequenceEnd => e_field == Some("SequenceEnd"),
        YamlEvent::Scalar { raw, kind, style } => {
            e_field == Some("Scalar")
                && expected.get("raw").map(Json::as_str) == Some(raw.as_str())
                && expected.get("kind").map(Json::as_str) == Some(kind_name(*kind))
                && expected.get("style").map(Json::as_str) == Some(style_name(*style))
        }
    }
}

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching
/// `src/Core.Rust.ZetaId/tests/cross_verify.rs`.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

#[test]
fn cross_verify_matches_shared_vectors() {
    let fixture_dir = repo_root().join("tests/cross-verification/yaml");
    let text =
        std::fs::read_to_string(fixture_dir.join("vectors.json")).expect("read vectors.json");
    let fixture = parse_json(&text);
    let vectors = fixture.get("vectors").expect("vectors field").as_arr();
    assert!(!vectors.is_empty(), "no vectors parsed");

    // (id, events-json-array) in fixture order, for emitting rust-output.json.
    let mut results: Vec<(String, Vec<String>)> = Vec::with_capacity(vectors.len());
    let mut mismatches = 0usize;

    for vec_obj in vectors {
        let id = vec_obj.get("id").expect("id field").as_str().to_string();
        let yaml = vec_obj.get("yaml").expect("yaml field").as_str();
        let expected = vec_obj.get("expected").expect("expected field").as_arr();

        let events = read_events(yaml)
            .unwrap_or_else(|fb| panic!("vector {id}: read_events declined: {fb:?}"));

        // Assert event count + each event matches the fixture's expected object.
        if events.len() != expected.len() {
            mismatches += 1;
            eprintln!(
                "Vector {id}: event count {} != expected {}",
                events.len(),
                expected.len()
            );
        } else {
            for (i, (ev, exp)) in events.iter().zip(expected.iter()).enumerate() {
                if !event_matches(ev, exp) {
                    mismatches += 1;
                    eprintln!("Vector {id}: event[{i}] mismatch: got {ev:?}, expected {exp:?}");
                }
            }
        }

        let event_jsons: Vec<String> = events.iter().map(event_json).collect();
        results.push((id, event_jsons));
    }

    // Emit rust-output.json: { "id": [ {event}, ... ], ... } -- pretty enough to read,
    // structurally identical to ts-output.json (compare.ts uses Bun.deepEquals on parsed
    // JSON, so exact byte format is irrelevant; only the JSON structure must match).
    let mut out = String::from("{\n");
    for (vi, (id, events)) in results.iter().enumerate() {
        out.push_str("  ");
        out.push_str(&json_str(id));
        out.push_str(": [\n");
        for (ei, ev) in events.iter().enumerate() {
            out.push_str("    ");
            out.push_str(ev);
            out.push_str(if ei + 1 < events.len() { ",\n" } else { "\n" });
        }
        out.push_str("  ]");
        out.push_str(if vi + 1 < results.len() { ",\n" } else { "\n" });
    }
    out.push_str("}\n");

    std::fs::write(fixture_dir.join("rust-output.json"), &out).expect("write rust-output.json");

    let n = results.len();
    println!("Cross-verify: {n} vectors. Event-stream matches expected on {} of {n}.", n - mismatches.min(n));

    assert_eq!(mismatches, 0, "{mismatches} event mismatch(es) vs fixture expected");
}
