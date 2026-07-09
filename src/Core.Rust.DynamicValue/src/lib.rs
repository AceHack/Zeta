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

/// Markdown + Frontmatter Treaty (Priority 1)
pub mod markdown;

/// Content-addressed comparable row key (Priority 1)
pub mod dv_key;
pub use dv_key::DvKey;

/// CNCF CloudEvents v1.0 envelope mapper (Priority 1)
pub mod cloud_events;
pub use cloud_events::CloudEvent;

/// Schema evolution over DynamicValue (zero-downtime versioning seed)
pub mod schema_evolution;

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

/// Maximum value/input nesting depth the recursive canonical codecs (JSON, XML) walk before
/// returning `EncodeError::NestingTooDeep` / `DecodeError::NestingTooDeep`. A fixed
/// resource-safety bound, NOT part of the contract's value domain: it sits FAR above any realistic
/// `DynamicValue`, so golden vectors and real data are unaffected while a depth-bomb is rejected as
/// data before it can overflow the stack. Not exposed in the public surface (may be raised later --
/// only ever moving the error later, never earlier). Mirrored across F#/C#/Rust/TS.
const MAX_NESTING_DEPTH: usize = 256;

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
        self.write_canonical(&mut out, 0)?;
        Ok(out)
    }

    // `depth` guards the per-nesting-level recursion: past the fixed bound the value is rejected as
    // data (`NestingTooDeep`) rather than overflowing the stack.
    fn write_canonical(&self, out: &mut String, depth: usize) -> Result<(), EncodeError> {
        if depth > MAX_NESTING_DEPTH {
            return Err(EncodeError::NestingTooDeep);
        }
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
                    item.write_canonical(out, depth + 1)?;
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
                    val.write_canonical(out, depth + 1)?;
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
    pub fn to_canonical_cbor(&self) -> Result<Vec<u8>, EncodeError> {
        let mut out = Vec::new();
        self.write_cbor(&mut out, 0)?;
        Ok(out)
    }

    fn write_cbor(&self, out: &mut Vec<u8>, depth: usize) -> Result<(), EncodeError> {
        if depth > MAX_NESTING_DEPTH {
            return Err(EncodeError::NestingTooDeep);
        }
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
                    item.write_cbor(out, depth + 1)?;
                }
            }
            DynamicValue::Object(pairs) => {
                cbor_head(out, 5, pairs.len() as u64);
                for (key, val) in pairs {
                    let kb = key.as_bytes();
                    cbor_head(out, 3, kb.len() as u64);
                    out.extend_from_slice(kb);
                    val.write_cbor(out, depth + 1)?;
                }
            }
        }
        Ok(())
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
        let value = read_cbor(bytes, &mut pos, 0)?;
        if pos != bytes.len() {
            return Err(DecodeError::TrailingData);
        }
        // canonical fixed-point: canonical bytes are exactly those `b` with encode(decode(b)) == b
        match value.to_canonical_cbor() {
            Ok(enc) if enc == bytes => Ok(value),
            _ => Err(DecodeError::NonCanonical),
        }
    }

    /// Decodes canonical JSON text into a [`DynamicValue`] -- the inverse of
    /// [`to_canonical_json`](DynamicValue::to_canonical_json), completing the text<->value round-trip
    /// for the six locked shapes (`Float` + `Bytes` are DEFERRED in JSON and lock under CBOR; a number
    /// with a decimal point or exponent is a Float -> [`DecodeError::Unsupported`]). Strictly canonical:
    /// a lenient recursive-descent parse, then one fixed-point check (`to_canonical_json() == input`)
    /// rejects every non-canonical form (insignificant whitespace, non-minimal escapes, leading zeros)
    /// as [`DecodeError::NonCanonical`] (a leading '+' is invalid JSON -> `UnexpectedEnd`). int64
    /// precision is preserved by parsing the number token as text. Mirrors the TS/C#/F# decoder.
    ///
    /// # Errors
    /// Returns the [`DecodeError`] describing why the input is not a valid canonical-JSON v1 value.
    pub fn from_canonical_json(json: &str) -> Result<DynamicValue, DecodeError> {
        let chars: Vec<char> = json.chars().collect();
        let mut pos = 0usize;
        let value = read_json_value(&chars, &mut pos, 0)?;
        skip_json_ws(&chars, &mut pos);
        if pos != chars.len() {
            return Err(DecodeError::TrailingData);
        }
        // canonical fixed-point: a canonical string re-encodes to itself; anything else (extra
        // whitespace, non-minimal escapes, leading zeros) is well-formed but not canonical
        match value.to_canonical_json() {
            Ok(s) if s == json => Ok(value),
            _ => Err(DecodeError::NonCanonical),
        }
    }

    /// Canonical XML encoding -- the byte-lock target (seed:
    /// `src/Core.TypeScript/dynamic-value/golden-vectors-xml.json`). Typed-element,
    /// minified form (one rendering per value):
    /// `<null/>` / `<bool>true</bool>` / `<int>DECIMAL</int>` / `<str>TEXT</str>` /
    /// `<float>16-HEX</float>` / `<bytes>HEX</bytes>` / `<arr>CHILD...</arr>` /
    /// `<obj><e k="KEY">VALUE</e>...</obj>`. Empty collections render distinctly
    /// (`<arr></arr>`, `<obj></obj>`, `<str></str>`, `<bytes></bytes>`), never collapsing
    /// to null. `Float` is the 16-hex lowercase IEEE-754 f64 big-endian bit pattern (the
    /// same language-neutral form CBOR locks); `Bytes` is lowercase hex. Element TEXT
    /// escapes `& < >` and `\t \n \r` as char-refs (`&#9; &#10; &#13;`); the key attribute
    /// additionally escapes `"`. `Object` keys in INSERTION order. TOTAL: all 8 shapes lock.
    ///
    /// # Errors
    /// Returns [`EncodeError::NotXmlRepresentable`] for a string/key containing NUL or a
    /// C0 control other than `\t \n \r` (XML 1.0 forbids these even as char-refs -- the XML
    /// analogue of Bytes-not-in-YAML). Mirrors the TS `canonicalXml` + `XmlEncodeError`.
    pub fn to_canonical_xml(&self) -> Result<String, EncodeError> {
        let mut out = String::new();
        self.write_canonical_xml(&mut out, 0)?;
        Ok(out)
    }

    // `depth` guards the per-nesting-level recursion: past the fixed bound the value is rejected as
    // data (`NestingTooDeep`) rather than overflowing the stack.
    fn write_canonical_xml(&self, out: &mut String, depth: usize) -> Result<(), EncodeError> {
        if depth > MAX_NESTING_DEPTH {
            return Err(EncodeError::NestingTooDeep);
        }
        match self {
            DynamicValue::Null => out.push_str("<null/>"),
            DynamicValue::Bool(b) => out.push_str(if *b {
                "<bool>true</bool>"
            } else {
                "<bool>false</bool>"
            }),
            DynamicValue::Int(i) => {
                out.push_str("<int>");
                out.push_str(&i.to_string());
                out.push_str("</int>");
            }
            DynamicValue::Float(f) => {
                // <float> + 16 LOWERCASE hex of the IEEE-754 f64 big-endian bit pattern --
                // the SAME language-neutral form CBOR's golden value carries (f64::to_bits()).
                // Distinct for every corner (NaN canonical 7ff8000000000000; -0.0 != +0.0).
                out.push_str("<float>");
                for byte in f.to_bits().to_be_bytes() {
                    out.push(
                        char::from_digit((u32::from(byte) >> 4) & 0xf, 16).expect("hex digit"),
                    );
                    out.push(char::from_digit(u32::from(byte) & 0xf, 16).expect("hex digit"));
                }
                out.push_str("</float>");
            }
            DynamicValue::String(s) => {
                out.push_str("<str>");
                escape_xml_text(s, out)?;
                out.push_str("</str>");
            }
            DynamicValue::Bytes(b) => {
                // <bytes> + lowercase hex (empty -> <bytes></bytes>) -- the CBOR byte/hex form.
                out.push_str("<bytes>");
                for byte in b {
                    out.push(
                        char::from_digit((u32::from(*byte) >> 4) & 0xf, 16).expect("hex digit"),
                    );
                    out.push(char::from_digit(u32::from(*byte) & 0xf, 16).expect("hex digit"));
                }
                out.push_str("</bytes>");
            }
            DynamicValue::Array(items) => {
                out.push_str("<arr>");
                for item in items {
                    item.write_canonical_xml(out, depth + 1)?;
                }
                out.push_str("</arr>");
            }
            DynamicValue::Object(pairs) => {
                out.push_str("<obj>");
                for (k, v) in pairs {
                    out.push_str("<e k=\"");
                    escape_xml_attr(k, out)?;
                    out.push_str("\">");
                    v.write_canonical_xml(out, depth + 1)?;
                    out.push_str("</e>");
                }
                out.push_str("</obj>");
            }
        }
        Ok(())
    }

    /// Decode canonical XML emitted by [`to_canonical_xml`](DynamicValue::to_canonical_xml)
    /// back into a [`DynamicValue`], completing the text<->value round-trip. Strictly
    /// canonical: a lenient recursive-descent parse, then one fixed-point check
    /// (`to_canonical_xml() == input`) -- any non-canonical spelling (self-closing empties,
    /// `&#x9;` vs `&#9;`, raw whitespace, leading zeros) is rejected as
    /// [`DecodeError::NonCanonical`]. `<float>` parses 16-hex f64 bits; `<bytes>` parses
    /// lowercase hex; unknown tags -> [`DecodeError::Unsupported`]. int64-overflow ->
    /// [`DecodeError::IntegerOverflow`].
    ///
    /// # Errors
    /// Returns the [`DecodeError`] describing why the input is not a valid canonical-XML
    /// v1 value. Mirrors the TS `fromCanonicalXml`.
    pub fn from_canonical_xml(xml: &str) -> Result<DynamicValue, DecodeError> {
        let chars: Vec<char> = xml.chars().collect();
        let mut pos = 0usize;
        let value = parse_xml_value(&chars, &mut pos, 0)?;
        if pos != chars.len() {
            return Err(DecodeError::TrailingData);
        }
        // canonical fixed-point: a canonical string re-encodes to itself; anything else
        // (self-closing empties, &#x9; vs &#9;, raw whitespace, leading zeros) is rejected.
        match value.to_canonical_xml() {
            Ok(s) if s == xml => Ok(value),
            _ => Err(DecodeError::NonCanonical),
        }
    }

    /// Canonical YAML encoding -- the text-lock target for six shapes (Float + Bytes are DEFERRED).
    /// Object keys in INSERTION order.
    ///
    /// # Errors
    /// Returns [`EncodeError`] for `Bytes` or if nesting depth is exceeded.
    pub fn to_canonical_yaml(&self) -> Result<String, EncodeError> {
        let yv = self.to_yaml_value(0)?;
        Ok(zeta_core_yaml::encoder::encode(&yv))
    }

    fn to_yaml_value(&self, depth: usize) -> Result<zeta_core_yaml::dom::YamlValue, EncodeError> {
        if depth > MAX_NESTING_DEPTH {
            return Err(EncodeError::NestingTooDeep);
        }
        match self {
            DynamicValue::Null => Ok(zeta_core_yaml::dom::YamlValue::Null),
            DynamicValue::Bool(b) => Ok(zeta_core_yaml::dom::YamlValue::Bool(*b)),
            DynamicValue::Int(i) => Ok(zeta_core_yaml::dom::YamlValue::Int(*i)),
            DynamicValue::Float(f) => Ok(zeta_core_yaml::dom::YamlValue::Float(*f)),
            DynamicValue::String(s) => Ok(zeta_core_yaml::dom::YamlValue::Str(s.clone())),
            DynamicValue::Bytes(_) => Err(EncodeError::BytesDeferred),
            DynamicValue::Array(items) => {
                let mut y_items = Vec::with_capacity(items.len());
                for item in items {
                    y_items.push(item.to_yaml_value(depth + 1)?);
                }
                Ok(zeta_core_yaml::dom::YamlValue::Seq(y_items))
            }
            DynamicValue::Object(pairs) => {
                let mut y_pairs = Vec::with_capacity(pairs.len());
                for (k, v) in pairs {
                    y_pairs.push((k.clone(), v.to_yaml_value(depth + 1)?));
                }
                Ok(zeta_core_yaml::dom::YamlValue::Map(y_pairs))
            }
        }
    }

    /// Decode canonical YAML back into a DynamicValue. Strict canonical check requires
    /// to_canonical_yaml() == yaml.
    ///
    /// # Errors
    /// Returns [`DecodeError`] if parsing fails or YAML is non-canonical.
    pub fn from_canonical_yaml(yaml: &str) -> Result<DynamicValue, DecodeError> {
        let y_val = zeta_core_yaml::dom::parse(yaml).map_err(|_| DecodeError::NonCanonical)?;
        let decoded = Self::from_yaml_value(&y_val, 0)?;
        // Strict canonical check
        match decoded.to_canonical_yaml() {
            Ok(s) if s == yaml => Ok(decoded),
            _ => Err(DecodeError::NonCanonical),
        }
    }

    fn from_yaml_value(
        yv: &zeta_core_yaml::dom::YamlValue,
        depth: usize,
    ) -> Result<DynamicValue, DecodeError> {
        if depth > MAX_NESTING_DEPTH {
            return Err(DecodeError::NestingTooDeep);
        }
        match yv {
            zeta_core_yaml::dom::YamlValue::Null => Ok(DynamicValue::Null),
            zeta_core_yaml::dom::YamlValue::Bool(b) => Ok(DynamicValue::Bool(*b)),
            zeta_core_yaml::dom::YamlValue::Int(i) => Ok(DynamicValue::Int(*i)),
            zeta_core_yaml::dom::YamlValue::Float(f) => Ok(DynamicValue::Float(*f)),
            zeta_core_yaml::dom::YamlValue::Str(s) => Ok(DynamicValue::String(s.clone())),
            zeta_core_yaml::dom::YamlValue::Seq(items) => {
                let mut dv_items = Vec::with_capacity(items.len());
                for item in items {
                    dv_items.push(Self::from_yaml_value(item, depth + 1)?);
                }
                Ok(DynamicValue::Array(dv_items))
            }
            zeta_core_yaml::dom::YamlValue::Map(pairs) => {
                let mut dv_pairs = Vec::with_capacity(pairs.len());
                for (k, v) in pairs {
                    dv_pairs.push((k.clone(), Self::from_yaml_value(v, depth + 1)?));
                }
                Ok(DynamicValue::Object(dv_pairs))
            }
        }
    }
}

/// Why a [`DynamicValue`] could not be canonically encoded (v1). `Float` and
/// `Bytes` have no canonical JSON form yet (they lock under CBOR or a tagged-JSON
/// convention); surfaced as `Err` data per the Result-over-exception rule
/// (AGENTS.md), never panicked. Mirrors the F#/C# `EncodeError`.
#[non_exhaustive]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EncodeError {
    /// `DynamicValue::Float` has no canonical shortest-float form in plain JSON.
    FloatDeferred,
    /// `DynamicValue::Bytes` has no native JSON byte type.
    BytesDeferred,
    /// A string or object key contains a character (NUL or a C0 control other than
    /// `\t \n \r`) that XML 1.0 cannot represent even as a character reference.
    /// Surfaced only by [`DynamicValue::to_canonical_xml`].
    NotXmlRepresentable,
    /// The value's nesting depth exceeds the fixed bound (well above any realistic value),
    /// guarding the recursive encoders against unbounded stack growth -- a depth-bomb is rejected
    /// as data rather than overflowing the stack. Resource-safety guard, NOT a value-domain limit.
    /// Mirrors the F#/C#/TS `NestingTooDeep`.
    NestingTooDeep,
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
            EncodeError::NotXmlRepresentable => {
                "string or key contains a character not representable in XML 1.0 (NUL or a C0 control other than tab/lf/cr)"
            }
            EncodeError::NestingTooDeep => {
                "value nesting depth exceeds the maximum the canonical codec accepts"
            }
        })
    }
}

impl std::error::Error for EncodeError {}

/// Why canonical CBOR bytes could not be decoded into a [`DynamicValue`]. Public API
/// (returned from [`DynamicValue::from_canonical_cbor`]); carries `Display` +
/// `std::error::Error`. Mirrors the C#/F# `DecodeError`.
#[non_exhaustive]
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
    /// The input's nesting depth exceeds the fixed bound (well above any realistic value),
    /// guarding the recursive decoders against unbounded stack growth -- deeply-nested input is
    /// rejected as data rather than overflowing the stack. Resource-safety guard, NOT a grammar
    /// limit. Mirrors the F#/C#/TS `NestingTooDeep`.
    NestingTooDeep,
}

impl std::fmt::Display for DecodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // format-neutral: `DecodeError` is shared by the CBOR and JSON decoders, so the messages
        // must not name one codec (a JSON caller logging `Unsupported` shouldn't see "CBOR ... tag").
        f.write_str(match self {
            DecodeError::UnexpectedEnd => "input ended mid-item (truncated input)",
            DecodeError::TrailingData => "extra input after a complete top-level value",
            DecodeError::Unsupported => "unsupported or reserved form for this codec",
            DecodeError::IntegerOverflow => "integer does not fit i64",
            DecodeError::NonTextKey => "object (map) key was not a text string",
            DecodeError::NonCanonical => {
                "well-formed but non-canonical input (not the canonical form this codec emits)"
            }
            DecodeError::NestingTooDeep => {
                "input nesting depth exceeds the maximum the canonical codec accepts"
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

// --- canonical XML helpers (mirrors src/Core.TypeScript/dynamic-value/xml.ts) ---

// A char is XML-1.0 forbidden as content iff it is a C0 control other than \t \n \r.
fn is_forbidden_c0(code: u32) -> bool {
    code < 0x20 && code != 0x09 && code != 0x0a && code != 0x0d
}

// Escape element TEXT: & < > as entities; \t \n \r as char-refs; forbidden C0 declines.
fn escape_xml_text(s: &str, out: &mut String) -> Result<(), EncodeError> {
    for ch in s.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '\t' => out.push_str("&#9;"),
            '\n' => out.push_str("&#10;"),
            '\r' => out.push_str("&#13;"),
            c if is_forbidden_c0(c as u32) => return Err(EncodeError::NotXmlRepresentable),
            c => out.push(c),
        }
    }
    Ok(())
}

// Escape an attribute value (object key): like text plus " as &quot;.
fn escape_xml_attr(s: &str, out: &mut String) -> Result<(), EncodeError> {
    for ch in s.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\t' => out.push_str("&#9;"),
            '\n' => out.push_str("&#10;"),
            '\r' => out.push_str("&#13;"),
            c if is_forbidden_c0(c as u32) => return Err(EncodeError::NotXmlRepresentable),
            c => out.push(c),
        }
    }
    Ok(())
}

// Unescape XML content/attribute: inverse of the escapers. Lenient (accepts named +
// decimal + hex char-refs); the fixed-point check rejects any non-canonical spelling.
fn unescape_xml(s: &[char]) -> Result<String, DecodeError> {
    let mut out = String::new();
    let mut i = 0usize;
    while i < s.len() {
        if s[i] != '&' {
            out.push(s[i]);
            i += 1;
            continue;
        }
        let semi = (i + 1..s.len())
            .find(|&j| s[j] == ';')
            .ok_or(DecodeError::Unsupported)?;
        let ent: String = s[i + 1..semi].iter().collect();
        match ent.as_str() {
            "amp" => out.push('&'),
            "lt" => out.push('<'),
            "gt" => out.push('>'),
            "quot" => out.push('"'),
            "apos" => out.push('\''),
            _ if ent.starts_with('#') => {
                let is_hex = ent.starts_with("#x") || ent.starts_with("#X");
                let digits = if is_hex { &ent[2..] } else { &ent[1..] };
                if digits.is_empty() {
                    return Err(DecodeError::Unsupported);
                }
                let radix = if is_hex { 16 } else { 10 };
                let code =
                    u32::from_str_radix(digits, radix).map_err(|_| DecodeError::Unsupported)?;
                let c = char::from_u32(code).ok_or(DecodeError::Unsupported)?;
                out.push(c);
            }
            _ => return Err(DecodeError::Unsupported),
        }
        i = semi + 1;
    }
    Ok(out)
}

struct XmlTag {
    name: String,
    close: bool,
    self_close: bool,
    attr_k: Option<String>,
}

// Read a `<...>` tag at `*pos` (must point at '<'). Mirrors readTag.
fn read_xml_tag(s: &[char], pos: &mut usize) -> Result<XmlTag, DecodeError> {
    if s.get(*pos) != Some(&'<') {
        return Err(DecodeError::Unsupported);
    }
    *pos += 1;
    let mut close = false;
    if s.get(*pos) == Some(&'/') {
        close = true;
        *pos += 1;
    }
    let name_start = *pos;
    while *pos < s.len() && s[*pos].is_ascii_lowercase() {
        *pos += 1;
    }
    let name: String = s[name_start..*pos].iter().collect();
    if name.is_empty() {
        return Err(DecodeError::Unsupported);
    }
    let mut attr_k: Option<String> = None;
    if s.get(*pos) == Some(&' ') {
        *pos += 1;
        let prefix: String = s
            .get(*pos..*pos + 3)
            .map(|c| c.iter().collect())
            .unwrap_or_default();
        if prefix != "k=\"" {
            return Err(DecodeError::Unsupported);
        }
        *pos += 3;
        let v_start = *pos;
        while *pos < s.len() && s[*pos] != '"' {
            *pos += 1;
        }
        if *pos >= s.len() {
            return Err(DecodeError::UnexpectedEnd);
        }
        attr_k = Some(unescape_xml(&s[v_start..*pos])?);
        *pos += 1; // closing quote
    }
    let mut self_close = false;
    if s.get(*pos) == Some(&'/') {
        self_close = true;
        *pos += 1;
    }
    if s.get(*pos) != Some(&'>') {
        return Err(DecodeError::Unsupported);
    }
    *pos += 1;
    Ok(XmlTag {
        name,
        close,
        self_close,
        attr_k,
    })
}

// Read raw text (still-escaped) up to the next '<'.
fn read_xml_text_run(s: &[char], pos: &mut usize) -> Vec<char> {
    let start = *pos;
    while *pos < s.len() && s[*pos] != '<' {
        *pos += 1;
    }
    s[start..*pos].to_vec()
}

fn expect_xml_close(s: &[char], pos: &mut usize, name: &str) -> Result<(), DecodeError> {
    let tag = read_xml_tag(s, pos)?;
    if !tag.close || tag.name != name || tag.self_close {
        return Err(DecodeError::Unsupported);
    }
    Ok(())
}

// `depth` guards the per-nesting-level recursion: past the fixed bound the input is rejected as
// data (`NestingTooDeep`) rather than overflowing the stack.
fn parse_xml_value(s: &[char], pos: &mut usize, depth: usize) -> Result<DynamicValue, DecodeError> {
    if depth > MAX_NESTING_DEPTH {
        return Err(DecodeError::NestingTooDeep);
    }
    if s.get(*pos) != Some(&'<') {
        return Err(DecodeError::Unsupported);
    }
    let tag = read_xml_tag(s, pos)?;
    if tag.close {
        return Err(DecodeError::Unsupported);
    }
    match tag.name.as_str() {
        "null" => {
            if !tag.self_close {
                return Err(DecodeError::Unsupported);
            }
            Ok(DynamicValue::Null)
        }
        "bool" => {
            if tag.self_close {
                return Err(DecodeError::Unsupported);
            }
            let text: String = read_xml_text_run(s, pos).iter().collect();
            expect_xml_close(s, pos, "bool")?;
            match text.as_str() {
                "true" => Ok(DynamicValue::Bool(true)),
                "false" => Ok(DynamicValue::Bool(false)),
                _ => Err(DecodeError::Unsupported),
            }
        }
        "int" => {
            if tag.self_close {
                return Err(DecodeError::Unsupported);
            }
            let text: String = read_xml_text_run(s, pos).iter().collect();
            expect_xml_close(s, pos, "int")?;
            let bytes = text.as_bytes();
            let valid = !bytes.is_empty() && {
                let digits = if bytes[0] == b'-' { &bytes[1..] } else { bytes };
                !digits.is_empty() && digits.iter().all(u8::is_ascii_digit)
            };
            if !valid {
                return Err(DecodeError::Unsupported);
            }
            match text.parse::<i64>() {
                Ok(i) => Ok(DynamicValue::Int(i)),
                Err(_) => Err(DecodeError::IntegerOverflow),
            }
        }
        "str" => {
            if tag.self_close {
                return Ok(DynamicValue::String(String::new())); // tolerated; fixed-point rejects
            }
            let run = read_xml_text_run(s, pos);
            let text = unescape_xml(&run)?;
            expect_xml_close(s, pos, "str")?;
            Ok(DynamicValue::String(text))
        }
        "float" => {
            if tag.self_close {
                return Err(DecodeError::Unsupported);
            }
            let text: String = read_xml_text_run(s, pos).iter().collect();
            expect_xml_close(s, pos, "float")?;
            // canonical = exactly 16 LOWERCASE hex (IEEE-754 f64 big-endian bits)
            let b = text.as_bytes();
            let valid = b.len() == 16
                && b.iter()
                    .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(c));
            if !valid {
                return Err(DecodeError::Unsupported);
            }
            let bits = u64::from_str_radix(&text, 16).map_err(|_| DecodeError::Unsupported)?;
            Ok(DynamicValue::Float(f64::from_bits(bits)))
        }
        "bytes" => {
            if tag.self_close {
                return Ok(DynamicValue::Bytes(Vec::new())); // tolerated; fixed-point rejects
            }
            let text: String = read_xml_text_run(s, pos).iter().collect();
            expect_xml_close(s, pos, "bytes")?;
            // canonical = even-length LOWERCASE hex
            let b = text.as_bytes();
            let valid = b.len().is_multiple_of(2)
                && b.iter()
                    .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(c));
            if !valid {
                return Err(DecodeError::Unsupported);
            }
            let bytes = (0..b.len())
                .step_by(2)
                .map(|i| u8::from_str_radix(&text[i..i + 2], 16).expect("hex byte"))
                .collect();
            Ok(DynamicValue::Bytes(bytes))
        }
        "arr" => {
            if tag.self_close {
                return Ok(DynamicValue::Array(Vec::new())); // tolerated; fixed-point rejects
            }
            let mut items = Vec::new();
            while !(s.get(*pos) == Some(&'<') && s.get(*pos + 1) == Some(&'/')) {
                items.push(parse_xml_value(s, pos, depth + 1)?);
            }
            expect_xml_close(s, pos, "arr")?;
            Ok(DynamicValue::Array(items))
        }
        "obj" => {
            if tag.self_close {
                return Ok(DynamicValue::Object(Vec::new())); // tolerated; fixed-point rejects
            }
            let mut pairs = Vec::new();
            while !(s.get(*pos) == Some(&'<') && s.get(*pos + 1) == Some(&'/')) {
                let e_tag = read_xml_tag(s, pos)?;
                if e_tag.close || e_tag.name != "e" || e_tag.attr_k.is_none() || e_tag.self_close {
                    return Err(DecodeError::Unsupported);
                }
                let val = parse_xml_value(s, pos, depth + 1)?;
                expect_xml_close(s, pos, "e")?;
                pairs.push((e_tag.attr_k.expect("attr_k present"), val));
            }
            expect_xml_close(s, pos, "obj")?;
            Ok(DynamicValue::Object(pairs))
        }
        _ => Err(DecodeError::Unsupported), // unknown tags
    }
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
fn read_cbor(b: &[u8], pos: &mut usize, depth: usize) -> Result<DynamicValue, DecodeError> {
    if depth > MAX_NESTING_DEPTH {
        return Err(DecodeError::NestingTooDeep);
    }
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
        4 => read_array(b, pos, arg, depth),
        5 => read_map(b, pos, arg, depth),
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

fn read_array(
    b: &[u8],
    pos: &mut usize,
    arg: u64,
    depth: usize,
) -> Result<DynamicValue, DecodeError> {
    // each item is >= 1 byte, so a count beyond the remaining bytes is truncated
    if arg > (b.len() - *pos) as u64 {
        return Err(DecodeError::UnexpectedEnd);
    }
    let mut items = Vec::with_capacity(arg as usize);
    for _ in 0..arg {
        items.push(read_cbor(b, pos, depth + 1)?);
    }
    Ok(DynamicValue::Array(items))
}

fn read_map(
    b: &[u8],
    pos: &mut usize,
    arg: u64,
    depth: usize,
) -> Result<DynamicValue, DecodeError> {
    if arg > (b.len() - *pos) as u64 {
        return Err(DecodeError::UnexpectedEnd);
    }
    let mut pairs = Vec::with_capacity(arg as usize);
    for _ in 0..arg {
        let DynamicValue::String(k) = read_cbor(b, pos, depth + 1)? else {
            return Err(DecodeError::NonTextKey);
        };
        let v = read_cbor(b, pos, depth + 1)?;
        pairs.push((k, v));
    }
    Ok(DynamicValue::Object(pairs))
}

// --- canonical JSON decode (inverse of to_canonical_json) ---
// Operates on a Vec<char> (Unicode scalar values) so structural scanning never splits a
// multi-byte UTF-8 char and raw string content reconstructs faithfully.

fn skip_json_ws(c: &[char], pos: &mut usize) {
    while *pos < c.len() && matches!(c[*pos], ' ' | '\t' | '\n' | '\r') {
        *pos += 1;
    }
}

// reads one JSON value at `pos`, advancing it
// `depth` guards the per-nesting-level recursion: past the fixed bound the input is rejected as
// data (`NestingTooDeep`) rather than overflowing the stack.
fn read_json_value(c: &[char], pos: &mut usize, depth: usize) -> Result<DynamicValue, DecodeError> {
    if depth > MAX_NESTING_DEPTH {
        return Err(DecodeError::NestingTooDeep);
    }
    skip_json_ws(c, pos);
    if *pos >= c.len() {
        return Err(DecodeError::UnexpectedEnd);
    }
    match c[*pos] {
        'n' => read_json_literal(c, pos, "null", DynamicValue::Null),
        't' => read_json_literal(c, pos, "true", DynamicValue::Bool(true)),
        'f' => read_json_literal(c, pos, "false", DynamicValue::Bool(false)),
        '"' => Ok(DynamicValue::String(read_json_string(c, pos)?)),
        '[' => read_json_array(c, pos, depth),
        '{' => read_json_object(c, pos, depth),
        ch if ch == '-' || ch.is_ascii_digit() => read_json_number(c, pos),
        _ => Err(DecodeError::UnexpectedEnd),
    }
}

fn read_json_literal(
    c: &[char],
    pos: &mut usize,
    lit: &str,
    val: DynamicValue,
) -> Result<DynamicValue, DecodeError> {
    for (i, lc) in lit.chars().enumerate() {
        if c.get(*pos + i) != Some(&lc) {
            return Err(DecodeError::UnexpectedEnd);
        }
    }
    *pos += lit.chars().count();
    Ok(val)
}

// reads exactly 4 hex digits starting at index `at`, as a u32; UnexpectedEnd on out-of-range or
// any non-hex char (to_digit(16) rejects whitespace + non-hex — no lenient trim)
fn read_u4_hex(c: &[char], at: usize) -> Result<u32, DecodeError> {
    if at + 4 > c.len() {
        return Err(DecodeError::UnexpectedEnd);
    }
    let mut code: u32 = 0;
    for ch in &c[at..at + 4] {
        match ch.to_digit(16) {
            Some(d) => code = code * 16 + d,
            None => return Err(DecodeError::UnexpectedEnd),
        }
    }
    Ok(code)
}

// reads one escape (pos at the backslash), returns the decoded char, advances pos
fn read_json_escape(c: &[char], pos: &mut usize) -> Result<char, DecodeError> {
    *pos += 1; // past backslash
    if *pos >= c.len() {
        return Err(DecodeError::UnexpectedEnd);
    }
    if c[*pos] == 'u' {
        let hi = read_u4_hex(c, *pos + 1)?; // 4 hex after 'u'
        *pos += 5; // 'u' + 4 hex
        // A UTF-16 high surrogate must be followed by a \uXXXX low surrogate; combine into the
        // astral scalar. This matches the TS/C#/F# oracles (whose UTF-16 strings decode the pair
        // and then report NonCanonical via the fixed-point check, since canonical emits raw UTF-8).
        if (0xD800..=0xDBFF).contains(&hi) {
            if *pos + 6 > c.len() || c[*pos] != '\\' || c[*pos + 1] != 'u' {
                return Err(DecodeError::UnexpectedEnd); // high surrogate not followed by \uXXXX
            }
            let lo = read_u4_hex(c, *pos + 2)?;
            if !(0xDC00..=0xDFFF).contains(&lo) {
                return Err(DecodeError::UnexpectedEnd); // not a valid low surrogate
            }
            *pos += 6; // '\' 'u' + 4 hex
            let astral = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00);
            return char::from_u32(astral).ok_or(DecodeError::UnexpectedEnd);
        }
        // a lone low surrogate (or any non-scalar code unit) is not representable as a char; reject
        char::from_u32(hi).ok_or(DecodeError::UnexpectedEnd)
    } else {
        let rep = match c[*pos] {
            '"' => '"',
            '\\' => '\\',
            '/' => '/',
            'b' => '\u{0008}',
            'f' => '\u{000C}',
            'n' => '\n',
            'r' => '\r',
            't' => '\t',
            _ => return Err(DecodeError::UnexpectedEnd), // invalid escape
        };
        *pos += 1;
        Ok(rep)
    }
}

fn read_json_string(c: &[char], pos: &mut usize) -> Result<String, DecodeError> {
    *pos += 1; // opening quote
    let mut out = String::new();
    while *pos < c.len() {
        let ch = c[*pos];
        if ch == '"' {
            *pos += 1;
            return Ok(out);
        }
        if ch == '\\' {
            out.push(read_json_escape(c, pos)?);
        } else {
            out.push(ch);
            *pos += 1;
        }
    }
    Err(DecodeError::UnexpectedEnd) // unterminated string
}

// consumes one or more digits at pos; UnexpectedEnd if none (the JSON grammar's
// "at least one digit" for the integer part, fraction, and exponent)
fn consume_json_digits(c: &[char], pos: &mut usize) -> Result<(), DecodeError> {
    let d0 = *pos;
    while *pos < c.len() && c[*pos].is_ascii_digit() {
        *pos += 1;
    }
    if *pos == d0 {
        Err(DecodeError::UnexpectedEnd)
    } else {
        Ok(())
    }
}

fn read_json_number(c: &[char], pos: &mut usize) -> Result<DynamicValue, DecodeError> {
    let start = *pos;
    if c[*pos] == '-' {
        *pos += 1;
    }
    consume_json_digits(c, pos)?; // integer part — required (rejects "-", "-.5")
    let mut is_float = false;
    if *pos < c.len() && c[*pos] == '.' {
        is_float = true;
        *pos += 1;
        consume_json_digits(c, pos)?; // fraction — required after '.'
    }
    if *pos < c.len() && (c[*pos] == 'e' || c[*pos] == 'E') {
        is_float = true;
        *pos += 1;
        if *pos < c.len() && (c[*pos] == '+' || c[*pos] == '-') {
            *pos += 1;
        }
        consume_json_digits(c, pos)?; // exponent — required ("1e", "1e+")
    }
    if is_float {
        return Err(DecodeError::Unsupported); // Float deferred in v1 JSON
    }
    // token is -?[0-9]+, so the only way the parse fails is i64 overflow
    let tok: String = c[start..*pos].iter().collect();
    tok.parse::<i64>()
        .map(DynamicValue::Int)
        .map_err(|_| DecodeError::IntegerOverflow)
}

fn read_json_array(c: &[char], pos: &mut usize, depth: usize) -> Result<DynamicValue, DecodeError> {
    *pos += 1; // past the opening bracket
    let mut items = Vec::new();
    skip_json_ws(c, pos);
    if *pos < c.len() && c[*pos] == ']' {
        *pos += 1;
        return Ok(DynamicValue::Array(items));
    }
    loop {
        items.push(read_json_value(c, pos, depth + 1)?);
        skip_json_ws(c, pos);
        if *pos >= c.len() {
            return Err(DecodeError::UnexpectedEnd);
        }
        match c[*pos] {
            ',' => *pos += 1,
            ']' => {
                *pos += 1;
                return Ok(DynamicValue::Array(items));
            }
            _ => return Err(DecodeError::UnexpectedEnd),
        }
    }
}

fn read_json_object(
    c: &[char],
    pos: &mut usize,
    depth: usize,
) -> Result<DynamicValue, DecodeError> {
    *pos += 1; // past the opening brace
    let mut pairs = Vec::new();
    skip_json_ws(c, pos);
    if *pos < c.len() && c[*pos] == '}' {
        *pos += 1;
        return Ok(DynamicValue::Object(pairs));
    }
    loop {
        skip_json_ws(c, pos);
        if *pos >= c.len() || c[*pos] != '"' {
            return Err(DecodeError::UnexpectedEnd); // key must be a string
        }
        let key = read_json_string(c, pos)?;
        skip_json_ws(c, pos);
        if *pos >= c.len() || c[*pos] != ':' {
            return Err(DecodeError::UnexpectedEnd);
        }
        *pos += 1;
        let val = read_json_value(c, pos, depth + 1)?;
        pairs.push((key, val));
        skip_json_ws(c, pos);
        if *pos >= c.len() {
            return Err(DecodeError::UnexpectedEnd);
        }
        match c[*pos] {
            ',' => *pos += 1,
            '}' => {
                *pos += 1;
                return Ok(DynamicValue::Object(pairs));
            }
            _ => return Err(DecodeError::UnexpectedEnd),
        }
    }
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
            .unwrap()
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
                .contains("extra input")
        );
        assert!(DecodeError::Unsupported.to_string().contains("unsupported"));
        assert!(DecodeError::IntegerOverflow.to_string().contains("i64"));
        assert!(DecodeError::NonTextKey.to_string().contains("text string"));
        assert!(DecodeError::NonCanonical.to_string().contains("canonical"));
        // format-neutral: the shared DecodeError Display must not name a single codec
        for e in [
            DecodeError::UnexpectedEnd,
            DecodeError::TrailingData,
            DecodeError::Unsupported,
            DecodeError::IntegerOverflow,
            DecodeError::NonCanonical,
        ] {
            assert!(!e.to_string().contains("CBOR"), "{e:?} Display names CBOR");
        }
    }
}
