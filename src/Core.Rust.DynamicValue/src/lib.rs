//! DynamicValue -- the Rust oracle (#4 of TS/F#/C#/Rust) for the universal
//! self-describing-payload primitive. Conforms to the F# canonical shape
//! (`src/Core/DynamicValue.fs`) by AGREEING on the shared seed
//! (`src/Core.TypeScript/dynamic-value/golden-vectors.json`) -- seed-first
//! (Aaron 2026-06-01: "we are growing code from the seeds"): the seed is the
//! canonical DATA; this crate grows code that agrees on it, not a port of one
//! language's type.
//!
//! The case set `Null | Bool | Int | Float | String | Bytes | Array | Object`
//! is the common self-describing core shared by CBOR / msgpack / JSON / YAML.
//! [`DynamicValue::to_canonical_json`] is the canonical-encode side of the
//! byte-lock; v1 locks null/bool/int/string/array/object. `Float` and `Bytes`
//! are DEFERRED (no canonical JSON form yet -- they lock under CBOR or a
//! tagged-JSON convention) and panic if encoded. The `tests/cross_verify.rs`
//! oracle replays the shared seed and must value-match every locked vector.
//! "The compilers don't lie."

/// The runtime type tag -- QueryInterface ("what shape are you?") for a value
/// with no compile-time type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DynamicValueType {
    /// The null shape.
    Null,
    /// A boolean.
    Bool,
    /// A 64-bit signed integer.
    Int,
    /// A 64-bit IEEE-754 float.
    Float,
    /// A UTF-8 string.
    String,
    /// A raw byte payload.
    Bytes,
    /// An ordered array of values.
    Array,
    /// An ordered key -> value object.
    Object,
}

/// The format-agnostic dynamic / self-describing-payload value tree (eight
/// shapes). `Object` preserves INSERTION ORDER (order-significant: two objects
/// with the same pairs in different orders are NOT equal). Equality is structural.
#[derive(Debug, Clone, PartialEq)]
pub enum DynamicValue {
    /// The explicit null shape.
    Null,
    /// A boolean.
    Bool(bool),
    /// A 64-bit signed integer.
    Int(i64),
    /// A 64-bit IEEE-754 float.
    Float(f64),
    /// A UTF-8 string.
    String(String),
    /// A raw byte payload.
    Bytes(Vec<u8>),
    /// An ordered array of values.
    Array(Vec<DynamicValue>),
    /// An ordered key -> value object (insertion order is significant).
    Object(Vec<(String, DynamicValue)>),
}

impl DynamicValue {
    /// The runtime tag (QueryInterface).
    #[must_use]
    pub fn type_of(&self) -> DynamicValueType {
        match self {
            DynamicValue::Null => DynamicValueType::Null,
            DynamicValue::Bool(_) => DynamicValueType::Bool,
            DynamicValue::Int(_) => DynamicValueType::Int,
            DynamicValue::Float(_) => DynamicValueType::Float,
            DynamicValue::String(_) => DynamicValueType::String,
            DynamicValue::Bytes(_) => DynamicValueType::Bytes,
            DynamicValue::Array(_) => DynamicValueType::Array,
            DynamicValue::Object(_) => DynamicValueType::Object,
        }
    }

    /// Canonical JSON encoding -- the byte-lock target (the shared seed is
    /// `src/Core.TypeScript/dynamic-value/golden-vectors.json`). Minified;
    /// `Object` keys in INSERTION order (NOT sorted -- `Object` is
    /// order-significant, so a key-sorting canonical form would be lossy /
    /// non-bijective); `Int` = bare exact decimal; strings per RFC 8259 minimal
    /// escaping ('/' not escaped; control U+0000..U+001F short-form or
    /// `\u00XX` lowercase; all else raw UTF-8). v1 locks
    /// null/bool/int/string/array/object.
    ///
    /// # Panics
    /// Panics on `Float` or `Bytes` -- both are DEFERRED (no canonical JSON form
    /// yet; they lock under CBOR or a tagged-JSON convention).
    #[must_use]
    pub fn to_canonical_json(&self) -> String {
        let mut out = String::new();
        self.write_canonical(&mut out);
        out
    }

    fn write_canonical(&self, out: &mut String) {
        match self {
            DynamicValue::Null => out.push_str("null"),
            DynamicValue::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
            DynamicValue::Int(i) => out.push_str(&i.to_string()),
            DynamicValue::Float(_) => panic!(
                "DynamicValue::Float canonical JSON is DEFERRED (no canonical shortest-float in plain JSON); locks under CBOR or a tagged-JSON convention"
            ),
            DynamicValue::String(s) => escape_json_string(s, out),
            DynamicValue::Bytes(_) => panic!(
                "DynamicValue::Bytes canonical JSON is DEFERRED (no native JSON byte type); locks under CBOR or a tagged-JSON convention"
            ),
            DynamicValue::Array(items) => {
                out.push('[');
                for (k, item) in items.iter().enumerate() {
                    if k > 0 {
                        out.push(',');
                    }
                    item.write_canonical(out);
                }
                out.push(']');
            }
            DynamicValue::Object(pairs) => {
                out.push('{');
                for (k, (key, val)) in pairs.iter().enumerate() {
                    if k > 0 {
                        out.push(',');
                    }
                    escape_json_string(key, out);
                    out.push(':');
                    val.write_canonical(out);
                }
                out.push('}');
            }
        }
    }
}

// Append `s` as a JSON string literal (including the surrounding quotes), RFC 8259
// minimal escaping: '"' and '\' and control chars U+0000..U+001F (short forms
// where they exist, else \u00XX lowercase-hex); '/' is NOT escaped; all other
// characters (incl. non-ASCII / astral, by Unicode scalar value) emitted raw.
fn escape_json_string(s: &str, out: &mut String) {
    out.push('"');
    for ch in s.chars() {
        match ch {
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
}
