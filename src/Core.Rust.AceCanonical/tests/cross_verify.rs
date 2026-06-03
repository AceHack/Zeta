//! Cross-language-parity = the verification (m-acc multi-oracle): the Rust Ace
//! canonical-JSON seam oracle (#4) canonicalizes the SHARED `vectors.json` fixture and
//! must produce the exact `expected_canonical_json` the TS seam (oracle #1) emits -- and
//! that the F#/C# oracles reproduce. "The compilers don't lie."
//!
//! Reads `tests/cross-verification/canonical-json/vectors.json` and writes
//! `rust-output.json` to the same directory (flat map: `canonical:<id>` -> the canonical
//! string, `invalid:<id>` -> the literal `<rejected>`), so the cross-language compare can
//! check all oracles agree.
//!
//! Zero external dependencies, even in dev: the fixture inputs are deliberately
//! NON-canonical (unsorted keys), so `DynamicValue::from_canonical_json` (which only
//! accepts already-canonical input) cannot parse them. This test hand-rolls a small
//! LENIENT JSON parser instead -- and keeps it dependency-free (no serde_json), matching
//! the production crate's zero-dep stance.

use std::path::PathBuf;

use zeta_core_ace_canonical::ace_canonical_json;
use zeta_core_dynamic_value::DynamicValue;

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching the
/// convention in `src/Core.Rust.Sha256/tests/cross_verify.rs`.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

// --- lenient JSON parser (zero-dep) ---
//
// A faithful-enough JSON value for reading the fixture. Numbers are kept as their raw
// token text so the Int-vs-reject decision (safe-integer range / float syntax) is made at
// conversion time, exactly where the Ace seam's `Number.isSafeInteger` gate lives.
//
// A LONE (unpaired) `\uXXXX` surrogate is well-formed JSON STRING SYNTAX, but the TS seam
// rejects it (and a Rust `String`/`char` cannot hold one). So the parser does NOT treat it
// as a hard syntax error -- it parses the structure and yields `Json::Rejected`, keeping
// the whole `vectors.json` parseable (the `invalid` block deliberately carries
// lone-surrogate fixtures, both as a string VALUE and as an object KEY). A lone surrogate
// in a KEY makes the whole enclosing object `Json::Rejected`. Genuine malformed JSON
// (unterminated string, bad `\u` hex, trailing data) is still a hard `ParseError`.

#[derive(Debug, Clone)]
enum Json {
    Null,
    Bool(bool),
    /// Raw number token text (e.g. "42", "-7", "3.14", "1e+21"); interpreted later.
    Num(String),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
    /// Well-formed JSON syntax the seam rejects (a lone-surrogate string, or a value/object
    /// containing one). Distinct from a hard `ParseError` so the whole document still parses.
    Rejected,
}

/// A hard JSON syntax error (unterminated string, bad `\u` hex, trailing data, unexpected
/// char). Distinct from a seam-rejection (lone surrogate), which flows through as
/// `Json::Rejected`. The reason is surfaced via `Display`.
#[derive(Debug)]
struct ParseError(String);

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

// The outcome of decoding one JSON string body: either a real string, or a seam-rejection
// (a lone surrogate) -- distinct from a hard syntax `ParseError` (unterminated / bad hex).
enum StrParse {
    Ok(String),
    Rejected,
}

struct Parser {
    chars: Vec<char>,
    pos: usize,
}

impl Parser {
    fn new(text: &str) -> Self {
        Parser {
            chars: text.chars().collect(),
            pos: 0,
        }
    }

    fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn skip_ws(&mut self) {
        while let Some(c) = self.peek() {
            if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
                self.pos += 1;
            } else {
                break;
            }
        }
    }

    fn parse_value(&mut self) -> Result<Json, ParseError> {
        self.skip_ws();
        match self.peek() {
            None => Err(ParseError("unexpected end of input".to_string())),
            Some('n') => self.parse_literal("null", Json::Null),
            Some('t') => self.parse_literal("true", Json::Bool(true)),
            Some('f') => self.parse_literal("false", Json::Bool(false)),
            Some('"') => Ok(match self.parse_string()? {
                StrParse::Ok(s) => Json::Str(s),
                StrParse::Rejected => Json::Rejected,
            }),
            Some('[') => self.parse_array(),
            Some('{') => self.parse_object(),
            Some(c) if c == '-' || c.is_ascii_digit() => self.parse_number(),
            Some(c) => Err(ParseError(format!("unexpected char {c:?}"))),
        }
    }

    fn parse_literal(&mut self, lit: &str, val: Json) -> Result<Json, ParseError> {
        for (i, lc) in lit.chars().enumerate() {
            if self.chars.get(self.pos + i) != Some(&lc) {
                return Err(ParseError(format!("expected literal {lit:?}")));
            }
        }
        self.pos += lit.chars().count();
        Ok(val)
    }

    // Reads exactly 4 hex digits at index `at` into a u32; hard error on out-of-range or
    // non-hex (malformed `\u`, not a seam-rejection).
    fn read_u4_hex(&self, at: usize) -> Result<u32, ParseError> {
        if at + 4 > self.chars.len() {
            return Err(ParseError("truncated \\u escape".to_string()));
        }
        let mut code: u32 = 0;
        for ch in &self.chars[at..at + 4] {
            match ch.to_digit(16) {
                Some(d) => code = code * 16 + d,
                None => return Err(ParseError("non-hex digit in \\u escape".to_string())),
            }
        }
        Ok(code)
    }

    // Reads one escape (pos at the backslash), advancing pos. `Ok(Some(c))` = a decoded
    // char; `Ok(None)` = a lone surrogate (well-formed syntax, seam-rejected); `Err` = a
    // hard syntax error (EOF after `\`, bad `\u` hex, invalid simple escape). Surrogate
    // PAIRS combine into the astral scalar.
    fn read_escape(&mut self) -> Result<Option<char>, ParseError> {
        self.pos += 1; // past backslash
        let e = self
            .peek()
            .ok_or_else(|| ParseError("EOF after backslash".to_string()))?;
        if e == 'u' {
            let hi = self.read_u4_hex(self.pos + 1)?; // 4 hex after 'u'
            self.pos += 5; // 'u' + 4 hex
            if (0xD800..=0xDBFF).contains(&hi) {
                // high surrogate: a low surrogate must immediately follow to form a pair
                if self.pos + 6 <= self.chars.len()
                    && self.chars[self.pos] == '\\'
                    && self.chars[self.pos + 1] == 'u'
                {
                    let lo = self.read_u4_hex(self.pos + 2)?;
                    if (0xDC00..=0xDFFF).contains(&lo) {
                        self.pos += 6; // '\' 'u' + 4 hex
                        let astral = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00);
                        return Ok(Some(
                            char::from_u32(astral)
                                .ok_or_else(|| ParseError("invalid astral scalar".to_string()))?,
                        ));
                    }
                }
                // not followed by a valid low surrogate -> lone high surrogate (rejected)
                return Ok(None);
            }
            if (0xDC00..=0xDFFF).contains(&hi) {
                // a lone LOW surrogate (rejected)
                return Ok(None);
            }
            Ok(Some(char::from_u32(hi).ok_or_else(|| {
                ParseError("invalid \\u scalar".to_string())
            })?))
        } else {
            let rep = match e {
                '"' => '"',
                '\\' => '\\',
                '/' => '/',
                'b' => '\u{0008}',
                'f' => '\u{000C}',
                'n' => '\n',
                'r' => '\r',
                't' => '\t',
                other => return Err(ParseError(format!("invalid escape \\{other}"))),
            };
            self.pos += 1;
            Ok(Some(rep))
        }
    }

    // Parses a JSON string body. Returns `StrParse::Rejected` if it contains a lone
    // surrogate (well-formed syntax, seam-rejected), or `Err` for a hard syntax error.
    fn parse_string(&mut self) -> Result<StrParse, ParseError> {
        self.pos += 1; // opening quote
        let mut out = String::new();
        let mut rejected = false;
        while let Some(ch) = self.peek() {
            if ch == '"' {
                self.pos += 1;
                return Ok(if rejected {
                    StrParse::Rejected
                } else {
                    StrParse::Ok(out)
                });
            }
            if ch == '\\' {
                match self.read_escape()? {
                    Some(c) => out.push(c),
                    None => rejected = true, // lone surrogate; keep scanning to the close quote
                }
            } else {
                out.push(ch);
                self.pos += 1;
            }
        }
        Err(ParseError("unterminated string".to_string()))
    }

    // Reads a JSON number token verbatim (-?digits(.digits)?([eE][+-]?digits)?) and keeps
    // the raw text; Int-vs-reject (range / float) is decided at conversion.
    fn parse_number(&mut self) -> Result<Json, ParseError> {
        let start = self.pos;
        if self.peek() == Some('-') {
            self.pos += 1;
        }
        self.consume_digits()?; // integer part required
        if self.peek() == Some('.') {
            self.pos += 1;
            self.consume_digits()?; // fraction required after '.'
        }
        if matches!(self.peek(), Some('e') | Some('E')) {
            self.pos += 1;
            if matches!(self.peek(), Some('+') | Some('-')) {
                self.pos += 1;
            }
            self.consume_digits()?; // exponent required
        }
        let tok: String = self.chars[start..self.pos].iter().collect();
        Ok(Json::Num(tok))
    }

    fn consume_digits(&mut self) -> Result<(), ParseError> {
        let d0 = self.pos;
        while matches!(self.peek(), Some(c) if c.is_ascii_digit()) {
            self.pos += 1;
        }
        if self.pos == d0 {
            Err(ParseError("expected digit".to_string()))
        } else {
            Ok(())
        }
    }

    fn parse_array(&mut self) -> Result<Json, ParseError> {
        self.pos += 1; // past '['
        let mut items = Vec::new();
        self.skip_ws();
        if self.peek() == Some(']') {
            self.pos += 1;
            return Ok(Json::Arr(items));
        }
        loop {
            items.push(self.parse_value()?);
            self.skip_ws();
            match self.peek() {
                Some(',') => self.pos += 1,
                Some(']') => {
                    self.pos += 1;
                    return Ok(Json::Arr(items));
                }
                _ => return Err(ParseError("expected ',' or ']'".to_string())),
            }
        }
    }

    fn parse_object(&mut self) -> Result<Json, ParseError> {
        self.pos += 1; // past '{'
        let mut pairs = Vec::new();
        let mut key_rejected = false;
        self.skip_ws();
        if self.peek() == Some('}') {
            self.pos += 1;
            return Ok(Json::Obj(pairs));
        }
        loop {
            self.skip_ws();
            if self.peek() != Some('"') {
                return Err(ParseError("object key must be a string".to_string()));
            }
            // A lone-surrogate KEY can't be a Rust String; mark the whole object rejected
            // (after the loop), but keep structurally parsing so the document stays valid.
            let key = match self.parse_string()? {
                StrParse::Ok(k) => k,
                StrParse::Rejected => {
                    key_rejected = true;
                    String::new() // placeholder; the object becomes Json::Rejected below
                }
            };
            self.skip_ws();
            if self.peek() != Some(':') {
                return Err(ParseError("expected ':' after object key".to_string()));
            }
            self.pos += 1;
            let val = self.parse_value()?;
            pairs.push((key, val));
            self.skip_ws();
            match self.peek() {
                Some(',') => self.pos += 1,
                Some('}') => {
                    self.pos += 1;
                    return Ok(if key_rejected {
                        Json::Rejected
                    } else {
                        Json::Obj(pairs)
                    });
                }
                _ => return Err(ParseError("expected ',' or '}'".to_string())),
            }
        }
    }
}

/// Parse a complete JSON document; error if trailing non-whitespace remains.
fn parse_json(text: &str) -> Result<Json, ParseError> {
    let mut p = Parser::new(text);
    let value = p.parse_value()?;
    p.skip_ws();
    if p.pos != p.chars.len() {
        return Err(ParseError("trailing data after top-level value".to_string()));
    }
    Ok(value)
}

/// The MAX_SAFE_INTEGER bound (kept in the test independently of the crate constant, so a
/// regression in the crate cannot silently move the test's idea of the bound).
const MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;

/// Convert a parsed `Json` value into a `DynamicValue`, OR signal that the seam rejects it.
/// A number with a `.` / exponent, or one outside the safe-integer range, is rejected (the
/// seam's `Number.isSafeInteger` gate); a `Json::Rejected` (lone surrogate) is rejected.
fn to_dynamic(json: &Json) -> Result<DynamicValue, ()> {
    match json {
        Json::Null => Ok(DynamicValue::Null),
        Json::Bool(b) => Ok(DynamicValue::Bool(*b)),
        Json::Str(s) => Ok(DynamicValue::String(s.clone())),
        Json::Rejected => Err(()), // lone surrogate -> seam-rejected
        Json::Num(tok) => {
            // float syntax -> rejected (Ace has no Float fields)
            if tok.contains('.') || tok.contains('e') || tok.contains('E') {
                return Err(());
            }
            // integer: must parse to i64 AND be within the safe-integer range
            match tok.parse::<i64>() {
                Ok(i) if i.unsigned_abs() <= MAX_SAFE_INTEGER as u64 => Ok(DynamicValue::Int(i)),
                _ => Err(()),
            }
        }
        Json::Arr(items) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                out.push(to_dynamic(item)?);
            }
            Ok(DynamicValue::Array(out))
        }
        Json::Obj(pairs) => {
            let mut out = Vec::with_capacity(pairs.len());
            for (k, v) in pairs {
                out.push((k.clone(), to_dynamic(v)?));
            }
            Ok(DynamicValue::Object(out))
        }
    }
}

/// Find a required string field in an object's entries.
fn obj_str<'a>(entries: &'a [(String, Json)], key: &str) -> &'a str {
    match entries.iter().find(|(k, _)| k == key) {
        Some((_, Json::Str(s))) => s.as_str(),
        other => panic!("expected string field {key:?}, got {other:?}"),
    }
}

/// Find a required field (any shape) in an object's entries.
fn obj_field<'a>(entries: &'a [(String, Json)], key: &str) -> &'a Json {
    entries
        .iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v)
        .unwrap_or_else(|| panic!("missing field {key:?}"))
}

/// Minimal JSON string escaping for the output file (ids + canonical strings).
fn json_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{0008}' => out.push_str("\\b"),
            '\u{000C}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                let n = c as u32;
                out.push_str("\\u00");
                out.push(char::from_digit((n >> 4) & 0xf, 16).expect("hex digit"));
                out.push(char::from_digit(n & 0xf, 16).expect("hex digit"));
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

#[test]
fn cross_verify_matches_shared_vectors() {
    let fixture_dir = repo_root().join("tests/cross-verification/canonical-json");
    let text =
        std::fs::read_to_string(fixture_dir.join("vectors.json")).expect("read vectors.json");

    let top = match parse_json(&text).unwrap_or_else(|e| panic!("parse vectors.json: {e}")) {
        Json::Obj(entries) => entries,
        other => panic!("expected top-level object, got {other:?}"),
    };

    let canonical = match obj_field(&top, "canonical") {
        Json::Arr(items) => items,
        other => panic!("'canonical' is not an array, got {other:?}"),
    };
    let invalid = match obj_field(&top, "invalid") {
        Json::Arr(items) => items,
        other => panic!("'invalid' is not an array, got {other:?}"),
    };
    assert!(!canonical.is_empty(), "no canonical vectors parsed");
    assert!(!invalid.is_empty(), "no invalid vectors parsed");

    // Flat output map in fixture iteration order: canonical first, then invalid.
    let mut out_entries: Vec<(String, String)> = Vec::new();
    let mut failures = 0usize;

    // --- canonical layer: ace_canonical_json(value) must equal expected_canonical_json ---
    for rec in canonical {
        let entries = match rec {
            Json::Obj(e) => e,
            other => panic!("canonical record is not an object, got {other:?}"),
        };
        let id = obj_str(entries, "id").to_string();
        let expected = obj_str(entries, "expected_canonical_json").to_string();
        let value_json = obj_field(entries, "value");

        let dv = to_dynamic(value_json).unwrap_or_else(|()| {
            panic!("canonical vector {id}: value unexpectedly rejected at parse/convert");
        });
        let got = ace_canonical_json(&dv).unwrap_or_else(|e| {
            panic!("canonical vector {id}: ace_canonical_json returned Err({e:?})");
        });

        if got != expected {
            failures += 1;
            eprintln!("canonical {id}: MISMATCH\n  got={got}\n  exp={expected}");
        }
        out_entries.push((format!("canonical:{id}"), got));
    }

    // --- invalid layer: the value must be rejected (parse/convert Err OR seam Err) ---
    for rec in invalid {
        let entries = match rec {
            Json::Obj(e) => e,
            other => panic!("invalid record is not an object, got {other:?}"),
        };
        let id = obj_str(entries, "id").to_string();
        let value_json = obj_field(entries, "value");

        // Rejected if the value cannot become a valid DynamicValue (float / unsafe-int /
        // lone surrogate) OR the seam itself returns Err.
        let rejected = match to_dynamic(value_json) {
            Err(()) => true,
            Ok(dv) => ace_canonical_json(&dv).is_err(),
        };

        if !rejected {
            failures += 1;
            eprintln!("invalid {id}: expected rejection but value was ACCEPTED");
        }
        out_entries.push((format!("invalid:{id}"), "<rejected>".to_string()));
    }

    // Build rust-output.json: pretty 2-space indent, keys in fixture order, trailing newline.
    let mut out = String::from("{\n");
    for (i, (key, val)) in out_entries.iter().enumerate() {
        out.push_str("  ");
        out.push_str(&json_str(key));
        out.push_str(": ");
        out.push_str(&json_str(val));
        out.push_str(if i + 1 < out_entries.len() {
            ",\n"
        } else {
            "\n"
        });
    }
    out.push_str("}\n");

    // Golden-file discipline: assert the checked-in rust-output.json matches the freshly
    // generated output. Regenerate on demand with `UPDATE_GOLDEN=1 cargo test`.
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

    let nc = canonical.len();
    let ni = invalid.len();
    println!("canonical-json cross-verify: canonical={nc} invalid={ni}, {failures} failure(s).");
    assert_eq!(failures, 0, "{failures} cross-verify failure(s)");
}
