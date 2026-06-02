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
    /// # Errors
    /// Returns [`EncodeError`] for `Float` or `Bytes` -- both are DEFERRED (no
    /// canonical JSON form yet; they lock under CBOR or a tagged-JSON
    /// convention), surfaced as data per the Result-over-exception rule (AGENTS.md),
    /// never panicked. Mirrors the F#/C# `Result<string, EncodeError>` oracles.
    pub fn to_canonical_json(&self) -> Result<String, EncodeError> {
        let mut out = String::new();
        self.write_canonical(&mut out)?;
        Ok(out)
    }

    fn write_canonical(&self, out: &mut String) -> Result<(), EncodeError> {
        match self {
            DynamicValue::Null => out.push_str("null"),
            DynamicValue::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
            DynamicValue::Int(i) => out.push_str(&i.to_string()),
            DynamicValue::Float(_) => return Err(EncodeError::FloatDeferred),
            DynamicValue::String(s) => escape_json_string(s, out),
            DynamicValue::Bytes(_) => return Err(EncodeError::BytesDeferred),
            DynamicValue::Array(items) => {
                out.push('[');
                for (k, item) in items.iter().enumerate() {
                    if k > 0 {
                        out.push(',');
                    }
                    item.write_canonical(out)?;
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
                    val.write_canonical(out)?;
                }
                out.push('}');
            }
        }

        Ok(())
    }
}

/// Why a [`DynamicValue`] could not be canonically encoded (v1). `Float` and
/// `Bytes` have no canonical JSON form yet (they lock under CBOR or a tagged-JSON
/// convention); surfaced as `Err` data per the Result-over-exception rule
/// (AGENTS.md), never panicked. Mirrors the F#/C# `EncodeError`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EncodeError {
    /// `DynamicValue::Float` has no canonical shortest-float form in plain JSON.
    FloatDeferred,
    /// `DynamicValue::Bytes` has no native JSON byte type.
    BytesDeferred,
}

// `EncodeError` is public API (returned from `to_canonical_json`), so it carries
// a stable human-readable `Display` and is a real `std::error::Error` -- callers
// surface it without leaning on `Debug`.
impl std::fmt::Display for EncodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            EncodeError::FloatDeferred => {
                "DynamicValue::Float has no canonical JSON form yet (deferred to CBOR or a tagged-JSON convention)"
            }
            EncodeError::BytesDeferred => {
                "DynamicValue::Bytes has no native JSON byte type yet (deferred to CBOR or a tagged-JSON convention)"
            }
        })
    }
}

impl std::error::Error for EncodeError {}

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

#[cfg(test)]
mod tests {
    use super::*;

    // Lock the Result contract this oracle introduced: the deferred variants
    // surface as `Err` and NEVER panic, per the Result-over-exception rule
    // (AGENTS.md). The seed has no Float/Bytes vectors, so the cross-verify
    // oracle can't catch a regression here -- these assert the contract directly
    // (assert-don't-skip: a contract with no test is a hole in the shield).
    #[test]
    fn float_is_deferred_error_not_panic() {
        assert_eq!(
            DynamicValue::Float(1.5).to_canonical_json(),
            Err(EncodeError::FloatDeferred)
        );
    }

    #[test]
    fn bytes_is_deferred_error_not_panic() {
        assert_eq!(
            DynamicValue::Bytes(vec![0u8, 1, 2]).to_canonical_json(),
            Err(EncodeError::BytesDeferred)
        );
    }

    // `EncodeError` is public API; Display must be stable + human-readable.
    #[test]
    fn encode_error_display_is_human_readable() {
        assert!(EncodeError::FloatDeferred.to_string().contains("Float"));
        assert!(EncodeError::BytesDeferred.to_string().contains("Bytes"));
    }
}
