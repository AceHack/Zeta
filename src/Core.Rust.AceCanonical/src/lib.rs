//! Ace canonical-JSON seam -- the Rust oracle (#4 of TS/F#/C#/Rust) for Ace's
//! trust-core canonicalization (slice 8.8). Reproduces `src/Core.TypeScript/ace/canonical.ts`
//! (`toTagged` + `canonicalBytes`) byte-for-byte over the shared `DynamicValue`
//! value model.
//!
//! The seam differs from [`zeta_core_dynamic_value::DynamicValue::to_canonical_json`]
//! in exactly one way: Ace SORTS object keys at every level (code-unit / UTF-8 byte
//! order), where the base DynamicValue canonical form preserves insertion order. Ace
//! keeps its key-order-INDEPENDENT canonicalization (`package_hash` + index/manifest
//! signing must not depend on map iteration order) by consuming the order-preserving
//! base primitive over a sorted-key tree.
//!
//! Encoding rules (matching the shared `canonicalJson` the TS seam emits through):
//! minified (`{"a":1,"b":2}`, no spaces); object keys SORTED; arrays keep insertion
//! order; `Int` = bare exact decimal, REJECTED if its magnitude exceeds the JS
//! safe-integer bound `2^53 - 1 = 9007199254740991` (Ace content is integer-only and
//! tiny -- an out-of-safe-range int is a bug); `Float` REJECTED (Ace canonical content
//! has no Float fields); `Bytes` REJECTED (no JSON-canonical shape here); strings +
//! keys escape only `"` -> `\"`, `\` -> `\\`, the C-style controls `\b \f \n \r \t`,
//! and any remaining control `< 0x20` as lowercase `\u00XX`, all else raw UTF-8 (astral
//! preserved). Lone surrogates cannot occur in a Rust `String`, so they are rejected
//! upstream (at parse time) rather than here.
//!
//! "The compilers don't lie." The `tests/cross_verify.rs` oracle replays the shared
//! `tests/cross-verification/canonical-json/vectors.json` fixture and must value-match
//! every `expected_canonical_json`.

use zeta_core_dynamic_value::DynamicValue;

/// The JS safe-integer bound: `Number.MAX_SAFE_INTEGER` = `2^53 - 1`. Ace integers must
/// satisfy `|i| <= MAX_SAFE_INTEGER` (the TS seam gates on `Number.isSafeInteger`); an
/// int outside `[-MAX_SAFE_INTEGER, MAX_SAFE_INTEGER]` is rejected.
pub const MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;

/// Why a [`DynamicValue`] could not be canonicalized by the Ace seam. Ace canonical
/// content is integer-only with no Float/Bytes fields, so encountering those shapes --
/// or an integer outside the JS safe-integer range -- is a bug surfaced as `Err` data
/// (Result-over-exception, AGENTS.md), mirroring the TS seam's fail-loud `throw`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AceCanonicalError {
    /// A `DynamicValue::Float` was encountered -- Ace canonical content has no Float fields
    /// (the TS seam's `Number.isSafeInteger` rejects non-integers).
    FloatNotAllowed,
    /// A `DynamicValue::Int` whose magnitude exceeds [`MAX_SAFE_INTEGER`] (`2^53 - 1`) --
    /// the TS seam's `Number.isSafeInteger` rejects integers outside the safe range.
    UnsafeInteger(i64),
    /// A shape with no JSON-canonical Ace form (currently `DynamicValue::Bytes`).
    UnsupportedShape,
}

// `AceCanonicalError` is public API (returned from `ace_canonical_json`); carry a stable,
// human-readable `Display` and be a real `std::error::Error`.
impl std::fmt::Display for AceCanonicalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AceCanonicalError::FloatNotAllowed => f.write_str(
                "Ace canonical content has no Float fields (value must be a safe integer)",
            ),
            AceCanonicalError::UnsafeInteger(i) => write!(
                f,
                "{i} is not a safe integer -- Ace integers must be within +/- (2^53 - 1)"
            ),
            AceCanonicalError::UnsupportedShape => {
                f.write_str("unsupported shape for the Ace canonical-JSON seam (e.g. Bytes)")
            }
        }
    }
}

impl std::error::Error for AceCanonicalError {}

/// Ace's canonical JSON for `value`: minified, with object keys SORTED at every level
/// (code-unit / UTF-8 byte order) and arrays in insertion order. This is the string the
/// TS seam's `canonicalBytes` UTF-8-encodes; hashing the UTF-8 bytes of this string
/// reproduces Ace's `package_hash` / signature input.
///
/// # Errors
/// Returns [`AceCanonicalError`] for a `Float` (no Float fields in Ace content), a
/// `Bytes` (no JSON-canonical shape), or an `Int` whose magnitude exceeds
/// [`MAX_SAFE_INTEGER`] -- mirroring the TS seam's fail-loud rejections, surfaced as
/// data per the Result-over-exception rule.
pub fn ace_canonical_json(value: &DynamicValue) -> Result<String, AceCanonicalError> {
    let mut out = String::new();
    write_canonical(value, &mut out)?;
    Ok(out)
}

fn write_canonical(value: &DynamicValue, out: &mut String) -> Result<(), AceCanonicalError> {
    match value {
        DynamicValue::Null => out.push_str("null"),
        DynamicValue::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        DynamicValue::Int(i) => {
            if i.unsigned_abs() > MAX_SAFE_INTEGER as u64 {
                return Err(AceCanonicalError::UnsafeInteger(*i));
            }
            out.push_str(&i.to_string());
        }
        DynamicValue::Float(_) => return Err(AceCanonicalError::FloatNotAllowed),
        DynamicValue::String(s) => escape_json_string(s, out),
        DynamicValue::Bytes(_) => return Err(AceCanonicalError::UnsupportedShape),
        DynamicValue::Array(items) => {
            // Arrays keep INSERTION order (order is significant; do not sort).
            out.push('[');
            for (n, item) in items.iter().enumerate() {
                if n > 0 {
                    out.push(',');
                }
                write_canonical(item, out)?;
            }
            out.push(']');
        }
        DynamicValue::Object(pairs) => {
            // Ace sorts object keys at every level by JS String order = UTF-16 code-unit
            // lexicographic order (`Object.keys(obj).sort()` in canonical.ts). Rust `&str`
            // `Ord` is UTF-8 byte = code-POINT order, which diverges from JS for astral keys
            // (an astral char's high surrogate 0xD800..=0xDBFF sorts BELOW a BMP char >= 0xE000
            // in UTF-16, but ABOVE it by code point). Compare UTF-16 code-unit sequences so the
            // Rust oracle matches the TS oracle for ALL keys, not just the BMP keys the vectors
            // carry. Borrow references -- no key/value cloning.
            let mut sorted: Vec<&(String, DynamicValue)> = pairs.iter().collect();
            sorted.sort_by(|a, b| a.0.encode_utf16().cmp(b.0.encode_utf16()));
            out.push('{');
            for (n, (key, val)) in sorted.iter().enumerate() {
                if n > 0 {
                    out.push(',');
                }
                escape_json_string(key, out);
                out.push(':');
                write_canonical(val, out)?;
            }
            out.push('}');
        }
    }
    Ok(())
}

// Append `s` as a JSON string literal (surrounding quotes included), matching the shared
// `encodeString` the TS seam emits through: escape `"` and `\`, the C-style controls
// `\b \f \n \r \t`, and any other control char `< 0x20` as lowercase `\u00XX`; '/' is NOT
// escaped; every other character (incl. non-ASCII / astral) is emitted raw as UTF-8.
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

    // Out-of-order object keys sort at every level; arrays keep insertion order.
    #[test]
    fn sorts_object_keys_keeps_array_order() {
        let value = DynamicValue::Object(vec![
            ("b".to_string(), DynamicValue::Int(1)),
            (
                "list".to_string(),
                DynamicValue::Array(vec![
                    DynamicValue::Int(3),
                    DynamicValue::Int(1),
                    DynamicValue::Int(2),
                ]),
            ),
            ("a".to_string(), DynamicValue::Int(2)),
        ]);
        assert_eq!(
            ace_canonical_json(&value).expect("encode"),
            r#"{"a":2,"b":1,"list":[3,1,2]}"#
        );
    }

    // A Float is rejected (Ace has no Float fields).
    #[test]
    fn float_is_rejected() {
        assert_eq!(
            ace_canonical_json(&DynamicValue::Float(3.14)),
            Err(AceCanonicalError::FloatNotAllowed)
        );
    }

    // Safe-integer bounds: the JS MAX_SAFE_INTEGER and its negation pass; one beyond is rejected.
    #[test]
    fn safe_integer_bounds() {
        let inside = DynamicValue::Object(vec![
            ("max".to_string(), DynamicValue::Int(MAX_SAFE_INTEGER)),
            ("min".to_string(), DynamicValue::Int(-MAX_SAFE_INTEGER)),
        ]);
        assert_eq!(
            ace_canonical_json(&inside).expect("encode"),
            r#"{"max":9007199254740991,"min":-9007199254740991}"#
        );
        let over = DynamicValue::Int(MAX_SAFE_INTEGER + 1);
        assert_eq!(
            ace_canonical_json(&over),
            Err(AceCanonicalError::UnsafeInteger(MAX_SAFE_INTEGER + 1))
        );
        // Bytes has no JSON-canonical Ace shape.
        assert_eq!(
            ace_canonical_json(&DynamicValue::Bytes(vec![1, 2, 3])),
            Err(AceCanonicalError::UnsupportedShape)
        );
    }

    // JS String sort is UTF-16 code-unit order: an astral key (high surrogate 0xD83D) sorts
    // BEFORE a BMP key >= U+E000 (0xE000), even though 0x1F600 > 0xE000 by code point.
    // Code-point/byte order (the old `&str` cmp) would put U+E000 first and diverge from TS.
    #[test]
    fn astral_key_sorts_by_utf16_like_js() {
        let value = DynamicValue::Object(vec![
            ("\u{E000}".to_string(), DynamicValue::Int(1)),
            ("\u{1F600}".to_string(), DynamicValue::Int(2)),
        ]);
        let out = ace_canonical_json(&value).expect("encode");
        let astral_at = out.find('\u{1F600}').expect("astral key present");
        let bmp_at = out.find('\u{E000}').expect("bmp key present");
        assert!(astral_at < bmp_at, "astral key must sort before U+E000 (UTF-16 order): {out}");
    }
}
