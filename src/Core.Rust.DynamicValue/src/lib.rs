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

    /// Canonical CBOR encoding (RFC 8949) -- the TOTAL byte-lock target for all
    /// eight shapes (the shared seed is
    /// `src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json`). Where
    /// [`to_canonical_json`](DynamicValue::to_canonical_json) is a partial
    /// projection (6/8 shapes; Float/Bytes deferred), CBOR is total: `Float` uses
    /// the RFC 8949 §4.2.2 shortest-float rule (float16 if it round-trips exactly,
    /// else float32, else float64; NaN canonicalizes to `0xf97e00`) and `Bytes`
    /// uses a native major-type-2 byte string -- so the result is `Vec<u8>`, not
    /// `Result` (CBOR has a canonical form for every shape). Mirrors the C#/F#
    /// `toCanonicalCbor`.
    ///
    /// One deliberate deviation from RFC 8949 §4.2.1 deterministic encoding:
    /// `Object` map keys stay in INSERTION order, NOT bytewise-sorted, because
    /// `Object` is order-significant -- the §4.2.1 key-sort would be lossy /
    /// non-bijective (the same call v1 made for canonical JSON). Integers and
    /// string/array/map lengths use preferred (shortest) serialization per §4.2.1.
    #[must_use]
    pub fn to_canonical_cbor(&self) -> Vec<u8> {
        let mut out = Vec::new();
        self.write_cbor(&mut out);
        out
    }

    fn write_cbor(&self, out: &mut Vec<u8>) {
        match self {
            DynamicValue::Null => out.push(0xf6),
            DynamicValue::Bool(b) => out.push(if *b { 0xf5 } else { 0xf4 }),
            DynamicValue::Int(i) => {
                // major 0 for >= 0; major 1 for < 0 (encodes -1 - n). `(!i) as u64`
                // (bitwise NOT) yields -1 - i without the i64::MIN overflow of `-1 - i`.
                if *i >= 0 {
                    cbor_head(out, 0, *i as u64);
                } else {
                    cbor_head(out, 1, (!*i) as u64);
                }
            }
            DynamicValue::Float(f) => cbor_float(out, *f),
            DynamicValue::String(s) => {
                // CBOR text string: raw UTF-8, no escaping (unlike JSON).
                let bytes = s.as_bytes();
                cbor_head(out, 3, bytes.len() as u64);
                out.extend_from_slice(bytes);
            }
            DynamicValue::Bytes(b) => {
                cbor_head(out, 2, b.len() as u64);
                out.extend_from_slice(b);
            }
            DynamicValue::Array(items) => {
                cbor_head(out, 4, items.len() as u64);
                for item in items {
                    item.write_cbor(out);
                }
            }
            DynamicValue::Object(pairs) => {
                cbor_head(out, 5, pairs.len() as u64);
                for (key, val) in pairs {
                    let kb = key.as_bytes();
                    cbor_head(out, 3, kb.len() as u64);
                    out.extend_from_slice(kb);
                    val.write_cbor(out);
                }
            }
        }
    }

    /// Decode the canonical CBOR bytes emitted by
    /// [`to_canonical_cbor`](DynamicValue::to_canonical_cbor) back into a [`DynamicValue`] --
    /// the inverse, completing the byte<->value bijection for all eight shapes. These are
    /// RFC 8949-shaped but deliberately keep object keys in INSERTION order (NOT RFC 8949
    /// §4.2.1 bytewise key sorting), since `Object` is order-significant; "canonical" here
    /// means "as emitted by `to_canonical_cbor`", not full RFC-deterministic CBOR. Decode is
    /// partial (truncation, reserved/indefinite
    /// forms, CBOR tags, oversized integers, non-text map keys, non-canonical encodings), so
    /// it returns `Result<DynamicValue, DecodeError>` -- never panics on malformed input.
    /// Mirrors the C#/F# decoder.
    ///
    /// # Errors
    /// Strictly canonical: the canonical bytes are exactly the fixed points of encode-after-
    /// decode, so after a structurally-valid decode it checks `to_canonical_cbor() == bytes`
    /// and returns [`DecodeError::NonCanonical`] otherwise -- rejecting non-shortest int/length
    /// widths, non-shortest floats / non-canonical NaN, and invalid UTF-8 repaired to U+FFFD,
    /// in one uniform check. float16 payloads decode via [`f16_to_f32`].
    pub fn from_canonical_cbor(bytes: &[u8]) -> Result<DynamicValue, DecodeError> {
        let mut pos = 0usize;
        let value = read_cbor(bytes, &mut pos)?;
        if pos != bytes.len() {
            return Err(DecodeError::TrailingData);
        }
        // canonical fixed-point: canonical bytes are exactly those `b` with encode(decode(b)) == b
        if value.to_canonical_cbor() != bytes {
            return Err(DecodeError::NonCanonical);
        }
        Ok(value)
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

/// Why canonical CBOR bytes could not be decoded into a [`DynamicValue`]. Public API
/// (returned from [`DynamicValue::from_canonical_cbor`]); carries `Display` +
/// `std::error::Error`. Mirrors the C#/F# `DecodeError`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecodeError {
    /// Input ended mid-item (a head or payload was truncated).
    UnexpectedEnd,
    /// Extra bytes remained after a complete top-level value.
    TrailingData,
    /// An additional-info or major-7 simple value this decoder does not accept (reserved
    /// 28-30, indefinite-length 31, CBOR tags (major 6), or an unsupported simple value).
    Unsupported,
    /// A CBOR integer does not fit `i64` (`DynamicValue::Int`).
    IntegerOverflow,
    /// An object (map) key was not a text string (`DynamicValue::Object` keys are strings).
    NonTextKey,
    /// Well-formed CBOR that is NOT the canonical form this codec emits -- non-shortest
    /// int/length width, non-shortest float / non-canonical NaN, or invalid UTF-8 repaired
    /// to U+FFFD. Detected by the fixed-point check `to_canonical_cbor() == input`.
    NonCanonical,
}

impl std::fmt::Display for DecodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            DecodeError::UnexpectedEnd => "input ended mid-item (truncated CBOR)",
            DecodeError::TrailingData => "extra bytes after a complete top-level value",
            DecodeError::Unsupported => {
                "unsupported CBOR (reserved/indefinite additional-info, tag, or simple value)"
            }
            DecodeError::IntegerOverflow => "CBOR integer does not fit i64",
            DecodeError::NonTextKey => "object (map) key was not a text string",
            DecodeError::NonCanonical => {
                "well-formed but non-canonical CBOR (not the shortest/canonical form this codec emits)"
            }
        })
    }
}

impl std::error::Error for DecodeError {}

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

// CBOR initial byte (major type in the top 3 bits) + preferred/shortest argument
// (RFC 8949 §3, §4.2.1).
fn cbor_head(out: &mut Vec<u8>, major: u8, arg: u64) {
    let mt = major << 5;
    if arg <= 23 {
        out.push(mt | arg as u8);
    } else if arg <= 0xff {
        out.push(mt | 24);
        out.push(arg as u8);
    } else if arg <= 0xffff {
        out.push(mt | 25);
        out.extend_from_slice(&(arg as u16).to_be_bytes());
    } else if arg <= 0xffff_ffff {
        out.push(mt | 26);
        out.extend_from_slice(&(arg as u32).to_be_bytes());
    } else {
        out.push(mt | 27);
        out.extend_from_slice(&arg.to_be_bytes());
    }
}

// RFC 8949 §4.2.2 shortest float: NaN -> 0xf97e00; else the shortest of
// float16 / float32 / float64 that decodes back to the exact same value (±0 and
// ±Inf round-trip through float16). float16 is hand-rolled (no stable `f16` in
// Rust, and the core is zero-dep) and gated on an EXACT round-trip, so it is only
// ever emitted for genuinely f16-exact values. `f32v as f64 == v` also rejects a
// width that overflowed to Inf (e.g. 1e300 as float32), falling through correctly.
fn cbor_float(out: &mut Vec<u8>, v: f64) {
    if v.is_nan() {
        out.extend_from_slice(&[0xf9, 0x7e, 0x00]);
        return;
    }
    let f32v = v as f32;
    if f32v as f64 == v {
        if let Some(bits16) = f16_bits_if_exact(f32v) {
            out.push(0xf9);
            out.extend_from_slice(&bits16.to_be_bytes());
            return;
        }
        out.push(0xfa);
        out.extend_from_slice(&f32v.to_bits().to_be_bytes());
        return;
    }
    out.push(0xfb);
    out.extend_from_slice(&v.to_bits().to_be_bytes());
}

// Some(bits) iff `value` is EXACTLY representable in float16 (the round-trip is
// bit-identical, including sign of zero); None otherwise. The exact gate means a
// rounding imperfection can never emit a non-canonical f16 -- non-exact values are
// always rejected here and fall through to float32.
fn f16_bits_if_exact(value: f32) -> Option<u16> {
    let bits = f32_to_f16_round(value);
    if f16_to_f32(bits).to_bits() == value.to_bits() {
        Some(bits)
    } else {
        None
    }
}

// f32 -> float16 bits, round-to-nearest-even. Only the exact path (no rounding)
// affects canonical output, since non-exact results are rejected by the round-trip
// gate in `f16_bits_if_exact`.
fn f32_to_f16_round(value: f32) -> u16 {
    let x = value.to_bits();
    let sign = ((x >> 16) & 0x8000) as u16;
    let exp_field = ((x >> 23) & 0xff) as i32;
    let mant = x & 0x007f_ffff;

    if exp_field == 0xff {
        // Inf (mant 0) or NaN (mant != 0; NaN is handled before this in cbor_float).
        return if mant != 0 {
            sign | 0x7e00
        } else {
            sign | 0x7c00
        };
    }

    let exp = exp_field - 127 + 15; // rebias to float16
    if exp >= 0x1f {
        return sign | 0x7c00; // overflow -> Inf
    }
    if exp <= 0 {
        if exp < -10 {
            return sign; // underflow -> ±0
        }
        let m = mant | 0x0080_0000; // 24-bit significand with the implicit leading 1
        let result = round_shift(m, (14 - exp) as u32);
        return sign | result as u16;
    }

    // normal
    let m10 = round_shift(mant, 13);
    if m10 == 0x400 {
        // mantissa rounding carried into the exponent
        let e = exp + 1;
        if e >= 0x1f {
            return sign | 0x7c00;
        }
        return sign | ((e as u16) << 10);
    }
    sign | ((exp as u16) << 10) | m10 as u16
}

// Right shift with round-to-nearest-even.
fn round_shift(value: u32, shift: u32) -> u32 {
    if shift == 0 {
        return value;
    }
    let result = value >> shift;
    let round_bit = 1u32 << (shift - 1);
    let rem = value & ((1u32 << shift) - 1);
    if rem > round_bit || (rem == round_bit && (result & 1) == 1) {
        result + 1
    } else {
        result
    }
}

// float16 bits -> f32, exact (every float16 value is exactly representable in f32;
// no rounding occurs).
fn f16_to_f32(bits: u16) -> f32 {
    let sign = if bits & 0x8000 != 0 { -1.0f32 } else { 1.0f32 };
    let exp = ((bits >> 10) & 0x1f) as i32;
    let mant = (bits & 0x3ff) as f32;
    let val = if exp == 0 {
        mant * 2.0f32.powi(-24) // subnormal: mant * 2^-24
    } else if exp == 0x1f {
        if mant == 0.0 { f32::INFINITY } else { f32::NAN }
    } else {
        (1.0 + mant / 1024.0) * 2.0f32.powi(exp - 15) // normal
    };
    sign * val
}

// Reads one CBOR item starting at `*pos`, advancing it. Mirrors the C#/F# reader; per-form
// readers stay lenient (e.g. lossy UTF-8) -- the single fixed-point check in
// `from_canonical_cbor` is the canonical-enforcement point.
fn read_cbor(b: &[u8], pos: &mut usize) -> Result<DynamicValue, DecodeError> {
    if *pos >= b.len() {
        return Err(DecodeError::UnexpectedEnd);
    }
    let initial = b[*pos];
    *pos += 1;
    let major = initial >> 5;
    let ai = (initial & 0x1f) as i32;

    if major == 7 {
        return read_simple_or_float(b, pos, ai);
    }

    let arg = read_arg(b, pos, ai)?;
    match major {
        0 => {
            if arg > i64::MAX as u64 {
                Err(DecodeError::IntegerOverflow)
            } else {
                Ok(DynamicValue::Int(arg as i64))
            }
        }
        1 => {
            if arg > i64::MAX as u64 {
                Err(DecodeError::IntegerOverflow)
            } else {
                Ok(DynamicValue::Int(-1_i64 - arg as i64))
            }
        }
        2 => read_byte_string(b, pos, arg),
        3 => read_text_string(b, pos, arg),
        4 => read_array(b, pos, arg),
        5 => read_map(b, pos, arg),
        _ => Err(DecodeError::Unsupported), // major 6 = tags
    }
}

// CBOR argument after the initial byte: inline for 0-23, else 1/2/4/8 big-endian bytes.
fn read_arg(b: &[u8], pos: &mut usize, ai: i32) -> Result<u64, DecodeError> {
    if ai < 24 {
        return Ok(ai as u64);
    }
    let n = match ai {
        24 => 1,
        25 => 2,
        26 => 4,
        27 => 8,
        _ => return Err(DecodeError::Unsupported),
    };
    if *pos + n > b.len() {
        return Err(DecodeError::UnexpectedEnd);
    }
    let mut v = 0u64;
    for &byte in &b[*pos..*pos + n] {
        v = (v << 8) | u64::from(byte);
    }
    *pos += n;
    Ok(v)
}

// Major 7: simple values (false/true/null) + IEEE floats; float16 via f16_to_f32.
fn read_simple_or_float(b: &[u8], pos: &mut usize, ai: i32) -> Result<DynamicValue, DecodeError> {
    match ai {
        20 => Ok(DynamicValue::Bool(false)),
        21 => Ok(DynamicValue::Bool(true)),
        22 => Ok(DynamicValue::Null),
        25 => {
            if *pos + 2 > b.len() {
                return Err(DecodeError::UnexpectedEnd);
            }
            let bits = (u16::from(b[*pos]) << 8) | u16::from(b[*pos + 1]);
            *pos += 2;
            Ok(DynamicValue::Float(f64::from(f16_to_f32(bits))))
        }
        26 => {
            if *pos + 4 > b.len() {
                return Err(DecodeError::UnexpectedEnd);
            }
            let bits = u32::from_be_bytes([b[*pos], b[*pos + 1], b[*pos + 2], b[*pos + 3]]);
            *pos += 4;
            Ok(DynamicValue::Float(f64::from(f32::from_bits(bits))))
        }
        27 => {
            if *pos + 8 > b.len() {
                return Err(DecodeError::UnexpectedEnd);
            }
            let mut arr = [0u8; 8];
            arr.copy_from_slice(&b[*pos..*pos + 8]);
            *pos += 8;
            Ok(DynamicValue::Float(f64::from_bits(u64::from_be_bytes(arr))))
        }
        _ => Err(DecodeError::Unsupported),
    }
}

fn read_byte_string(b: &[u8], pos: &mut usize, arg: u64) -> Result<DynamicValue, DecodeError> {
    if arg > (b.len() - *pos) as u64 {
        return Err(DecodeError::UnexpectedEnd);
    }
    let n = arg as usize;
    let v = b[*pos..*pos + n].to_vec();
    *pos += n;
    Ok(DynamicValue::Bytes(v))
}

fn read_text_string(b: &[u8], pos: &mut usize, arg: u64) -> Result<DynamicValue, DecodeError> {
    if arg > (b.len() - *pos) as u64 {
        return Err(DecodeError::UnexpectedEnd);
    }
    let n = arg as usize;
    // Rust String is guaranteed UTF-8; lossy conversion keeps decode total, and the
    // fixed-point check rejects invalid UTF-8 (U+FFFD re-encodes to different bytes).
    let s = String::from_utf8_lossy(&b[*pos..*pos + n]).into_owned();
    *pos += n;
    Ok(DynamicValue::String(s))
}

fn read_array(b: &[u8], pos: &mut usize, arg: u64) -> Result<DynamicValue, DecodeError> {
    // each item is >= 1 byte, so a count beyond the remaining bytes is truncated
    if arg > (b.len() - *pos) as u64 {
        return Err(DecodeError::UnexpectedEnd);
    }
    let mut items = Vec::with_capacity(arg as usize);
    for _ in 0..arg {
        items.push(read_cbor(b, pos)?);
    }
    Ok(DynamicValue::Array(items))
}

fn read_map(b: &[u8], pos: &mut usize, arg: u64) -> Result<DynamicValue, DecodeError> {
    if arg > (b.len() - *pos) as u64 {
        return Err(DecodeError::UnexpectedEnd);
    }
    let mut pairs = Vec::with_capacity(arg as usize);
    for _ in 0..arg {
        let DynamicValue::String(k) = read_cbor(b, pos)? else {
            return Err(DecodeError::NonTextKey);
        };
        let v = read_cbor(b, pos)?;
        pairs.push((k, v));
    }
    Ok(DynamicValue::Object(pairs))
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

    fn float_hex(v: f64) -> String {
        DynamicValue::Float(v)
            .to_canonical_cbor()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect()
    }

    // Independent RFC 8949 Appendix A anchor (anti-circularity): these canonical
    // bytes come straight from the RFC, not from our encoder or the seed.
    #[test]
    fn cbor_float_matches_rfc_8949_appendix_a() {
        assert_eq!(float_hex(0.0), "f90000");
        assert_eq!(float_hex(1.0), "f93c00");
        assert_eq!(float_hex(1.5), "f93e00");
        assert_eq!(float_hex(65504.0), "f97bff");
        assert_eq!(float_hex(100000.0), "fa47c35000");
        assert_eq!(float_hex(3.4028234663852886e38), "fa7f7fffff");
        assert_eq!(float_hex(1.0e300), "fb7e37e43c8800759c");
        assert_eq!(float_hex(5.960464477539063e-8), "f90001");
        assert_eq!(float_hex(0.00006103515625), "f90400");
        assert_eq!(float_hex(-4.0), "f9c400");
        assert_eq!(float_hex(-4.1), "fbc010666666666666");
        assert_eq!(float_hex(f64::INFINITY), "f97c00");
        assert_eq!(float_hex(f64::NEG_INFINITY), "f9fc00");
        assert_eq!(float_hex(f64::NAN), "f97e00");
        assert_eq!(float_hex(-0.0), "f98000");
    }

    // Shortest-float tier selection (robust, no hard-coded f64 bit patterns): the
    // encoder picks the narrowest exact width.
    #[test]
    fn cbor_shortest_float_tier_selection() {
        assert!(float_hex(1.5).starts_with("f9")); // float16 (exact)
        assert!(float_hex(100000.0).starts_with("fa")); // float32 (float16 overflow)
        assert!(float_hex(1.1).starts_with("fb")); // float64 (not float32-exact)
        assert!(float_hex(1.0e300).starts_with("fb")); // float64 (float32 overflow)
    }

    // Decode rejects malformed + non-canonical input. The NonCanonical cases all pass through a
    // successful (lenient) decode and are caught by the from_canonical_cbor fixed-point check.
    #[test]
    fn cbor_decode_rejects_malformed_and_non_canonical() {
        let err = |b: &[u8]| match DynamicValue::from_canonical_cbor(b) {
            Err(e) => e,
            Ok(_) => panic!("expected Err"),
        };
        assert_eq!(err(&[]), DecodeError::UnexpectedEnd); // empty
        assert_eq!(err(&[0x18]), DecodeError::UnexpectedEnd); // uint8 head, payload truncated
        assert_eq!(err(&[0xf6, 0x00]), DecodeError::TrailingData); // null + extra byte
        assert_eq!(err(&[0xc0, 0x00]), DecodeError::Unsupported); // tag (major 6)
        assert_eq!(err(&[0xf7]), DecodeError::Unsupported); // undefined (major 7, ai 23)
        assert_eq!(err(&[0xa1, 0x00, 0x00]), DecodeError::NonTextKey); // int map key
        assert_eq!(err(&[0x18, 0x00]), DecodeError::NonCanonical); // non-shortest int (0 as uint8)
        assert_eq!(err(&[0x18, 0x17]), DecodeError::NonCanonical); // 23 as uint8 (non-shortest width)
        assert_eq!(err(&[0x61, 0xff]), DecodeError::NonCanonical); // text string, invalid UTF-8
        assert_eq!(err(&[0xf9, 0x7e, 0x01]), DecodeError::NonCanonical); // non-canonical float16 NaN
        assert_eq!(
            err(&[0xfa, 0x3f, 0x80, 0x00, 0x00]),
            DecodeError::NonCanonical
        ); // 1.0 as float32
        assert_eq!(
            err(&[0xfb, 0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
            DecodeError::NonCanonical
        ); // 1.0 as float64
    }

    // `DecodeError` is public API (implements `Display` + `Error`); the messages must
    // stay stable + human-readable (mirrors `encode_error_display_is_human_readable`).
    #[test]
    fn decode_error_display_is_human_readable() {
        assert!(DecodeError::UnexpectedEnd.to_string().contains("truncated"));
        assert!(
            DecodeError::TrailingData
                .to_string()
                .contains("extra bytes")
        );
        assert!(DecodeError::Unsupported.to_string().contains("unsupported"));
        assert!(DecodeError::IntegerOverflow.to_string().contains("i64"));
        assert!(DecodeError::NonTextKey.to_string().contains("text string"));
        assert!(DecodeError::NonCanonical.to_string().contains("canonical"));
    }
}
