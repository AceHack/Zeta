//! JSON ingestion — hexagonal (ports & adapters).
//!
//! WE drive the interface. [`Json`] (our AST) and [`JsonParser`] (our trait) are the
//! PORT — the rest of the crate (mapping + algebra) depends only on these, never on
//! any external library's value type. External deps ADAPT INTO our port:
//!
//! - [`ZetaJsonParser`] — our own small, zero-dependency, idiomatic recursive-descent
//!   parser; the production default (supply-chain doctrine: zero external deps).
//! - [`SerdeJsonParser`] (feature `serde`) — the ADAPTER: it wraps serde_json and
//!   maps `serde_json::Value` → our [`Json`]. serde conforms to OUR interface, not the
//!   reverse. This lets us (a) differentially test ours against serde — "not flying
//!   blind" — and (b) let serde drop-in-replace ours in systems already on serde.
//!
//! Crucially, nothing outside the adapter (`from_serde`) ever names a `serde_json`
//! type, so the crate never *depends on* serde's interface — only its implementation,
//! behind our port. The port evolves as we learn; improvements flow back upstream.
//!
//! Day-one the [`ZetaJsonParser`] is intentionally minimal (owned `String` values).
//! A low-alloc / zero-copy borrowing variant is the eventual goal, not day-one.

use std::fmt;

/// A parsed JSON value (our minimal AST). Objects preserve insertion order.
#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    /// `null`.
    Null,
    /// `true` / `false`.
    Bool(bool),
    /// A number (stored as f64).
    Number(f64),
    /// A string (decoded, escapes resolved).
    Str(String),
    /// An array.
    Array(Vec<Json>),
    /// An object, insertion-ordered key/value pairs.
    Object(Vec<(String, Json)>),
}

impl Json {
    /// Look up a key in an object (`None` if not an object or key absent).
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Object(fields) => fields.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    /// The string value, if this is a `Str`.
    pub fn as_str(&self) -> Option<&str> {
        if let Json::Str(s) = self { Some(s) } else { None }
    }

    /// The bool value, if this is a `Bool`.
    pub fn as_bool(&self) -> Option<bool> {
        if let Json::Bool(b) = self { Some(*b) } else { None }
    }

    /// The array slice, if this is an `Array`.
    pub fn as_array(&self) -> Option<&[Json]> {
        if let Json::Array(a) = self { Some(a) } else { None }
    }
}

/// A JSON parse error: a message plus the byte offset where it occurred.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JsonError {
    /// Human-readable description.
    pub message: String,
    /// Byte offset into the input where parsing failed.
    pub position: usize,
}

impl fmt::Display for JsonError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "JSON parse error at byte {}: {}", self.position, self.message)
    }
}

impl std::error::Error for JsonError {}

/// The parser interface. Consumers depend on this trait, not on a concrete parser,
/// so serde (or any other backend) can drop in.
pub trait JsonParser {
    /// Parse a complete JSON document into the [`Json`] AST.
    fn parse(&self, input: &str) -> Result<Json, JsonError>;
}

/// The zero-dependency, hand-rolled parser (production default).
#[derive(Debug, Clone, Copy, Default)]
pub struct ZetaJsonParser;

impl JsonParser for ZetaJsonParser {
    fn parse(&self, input: &str) -> Result<Json, JsonError> {
        let mut p = Cursor::new(input);
        p.skip_ws();
        let value = p.parse_value()?;
        p.skip_ws();
        if p.pos != p.bytes.len() {
            return Err(p.err("trailing characters after JSON value"));
        }
        Ok(value)
    }
}

/// Internal byte cursor for the recursive-descent parse. Private — not API.
struct Cursor<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Cursor<'a> {
    fn new(input: &'a str) -> Self {
        Cursor { bytes: input.as_bytes(), pos: 0 }
    }

    fn err(&self, msg: &str) -> JsonError {
        JsonError { message: msg.to_string(), position: self.pos }
    }

    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.pos).copied()
    }

    fn skip_ws(&mut self) {
        while let Some(b) = self.peek() {
            if matches!(b, b' ' | b'\t' | b'\n' | b'\r') {
                self.pos += 1;
            } else {
                break;
            }
        }
    }

    fn expect(&mut self, b: u8, what: &str) -> Result<(), JsonError> {
        if self.peek() == Some(b) {
            self.pos += 1;
            Ok(())
        } else {
            Err(self.err(what))
        }
    }

    fn parse_value(&mut self) -> Result<Json, JsonError> {
        self.skip_ws();
        match self.peek() {
            Some(b'{') => self.parse_object(),
            Some(b'[') => self.parse_array(),
            Some(b'"') => Ok(Json::Str(self.parse_string()?)),
            Some(b't') | Some(b'f') => self.parse_bool(),
            Some(b'n') => self.parse_null(),
            Some(b) if b == b'-' || b.is_ascii_digit() => self.parse_number(),
            Some(_) => Err(self.err("unexpected character")),
            None => Err(self.err("unexpected end of input")),
        }
    }

    fn parse_object(&mut self) -> Result<Json, JsonError> {
        self.expect(b'{', "expected '{'")?;
        let mut fields = Vec::new();
        self.skip_ws();
        if self.peek() == Some(b'}') {
            self.pos += 1;
            return Ok(Json::Object(fields));
        }
        loop {
            self.skip_ws();
            let key = self.parse_string()?;
            self.skip_ws();
            self.expect(b':', "expected ':'")?;
            let value = self.parse_value()?;
            fields.push((key, value));
            self.skip_ws();
            match self.peek() {
                Some(b',') => self.pos += 1,
                Some(b'}') => {
                    self.pos += 1;
                    break;
                }
                _ => return Err(self.err("expected ',' or '}'")),
            }
        }
        Ok(Json::Object(fields))
    }

    fn parse_array(&mut self) -> Result<Json, JsonError> {
        self.expect(b'[', "expected '['")?;
        let mut items = Vec::new();
        self.skip_ws();
        if self.peek() == Some(b']') {
            self.pos += 1;
            return Ok(Json::Array(items));
        }
        loop {
            let value = self.parse_value()?;
            items.push(value);
            self.skip_ws();
            match self.peek() {
                Some(b',') => self.pos += 1,
                Some(b']') => {
                    self.pos += 1;
                    break;
                }
                _ => return Err(self.err("expected ',' or ']'")),
            }
        }
        Ok(Json::Array(items))
    }

    fn parse_string(&mut self) -> Result<String, JsonError> {
        self.expect(b'"', "expected '\"'")?;
        let mut out: Vec<u8> = Vec::new();
        loop {
            match self.peek() {
                None => return Err(self.err("unterminated string")),
                Some(b'"') => {
                    self.pos += 1;
                    break;
                }
                Some(b'\\') => {
                    self.pos += 1;
                    match self.peek() {
                        Some(b'"') => out.push(b'"'),
                        Some(b'\\') => out.push(b'\\'),
                        Some(b'/') => out.push(b'/'),
                        Some(b'b') => out.push(0x08),
                        Some(b'f') => out.push(0x0C),
                        Some(b'n') => out.push(b'\n'),
                        Some(b'r') => out.push(b'\r'),
                        Some(b't') => out.push(b'\t'),
                        Some(b'u') => {
                            self.pos += 1;
                            self.push_unicode_escape(&mut out)?;
                            continue; // push_unicode_escape advances pos past the digits
                        }
                        _ => return Err(self.err("invalid escape")),
                    }
                    self.pos += 1;
                }
                Some(b) => {
                    out.push(b);
                    self.pos += 1;
                }
            }
        }
        String::from_utf8(out).map_err(|_| self.err("invalid utf-8 in string"))
    }

    /// Decode a `\uXXXX` (possibly a surrogate pair) and append its UTF-8 bytes.
    /// Assumes the leading `\u` has been consumed up to (but not including) the hex.
    fn push_unicode_escape(&mut self, out: &mut Vec<u8>) -> Result<(), JsonError> {
        let hi = self.parse_hex4()?;
        let ch = if (0xD800..=0xDBFF).contains(&hi) {
            self.expect(b'\\', "expected low surrogate")?;
            self.expect(b'u', "expected low surrogate")?;
            let lo = self.parse_hex4()?;
            if !(0xDC00..=0xDFFF).contains(&lo) {
                return Err(self.err("invalid low surrogate"));
            }
            let cp = 0x10000 + (((hi - 0xD800) as u32) << 10) + (lo - 0xDC00) as u32;
            char::from_u32(cp).ok_or_else(|| self.err("invalid unicode scalar"))?
        } else {
            char::from_u32(hi as u32).ok_or_else(|| self.err("invalid unicode scalar"))?
        };
        let mut buf = [0u8; 4];
        out.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
        Ok(())
    }

    fn parse_hex4(&mut self) -> Result<u16, JsonError> {
        let mut value: u16 = 0;
        for _ in 0..4 {
            let b = self.peek().ok_or_else(|| self.err("unexpected end in \\u escape"))?;
            let digit = match b {
                b'0'..=b'9' => b - b'0',
                b'a'..=b'f' => b - b'a' + 10,
                b'A'..=b'F' => b - b'A' + 10,
                _ => return Err(self.err("invalid hex digit")),
            };
            value = value * 16 + u16::from(digit);
            self.pos += 1;
        }
        Ok(value)
    }

    fn parse_bool(&mut self) -> Result<Json, JsonError> {
        if self.bytes[self.pos..].starts_with(b"true") {
            self.pos += 4;
            Ok(Json::Bool(true))
        } else if self.bytes[self.pos..].starts_with(b"false") {
            self.pos += 5;
            Ok(Json::Bool(false))
        } else {
            Err(self.err("invalid literal"))
        }
    }

    fn parse_null(&mut self) -> Result<Json, JsonError> {
        if self.bytes[self.pos..].starts_with(b"null") {
            self.pos += 4;
            Ok(Json::Null)
        } else {
            Err(self.err("invalid literal"))
        }
    }

    fn parse_number(&mut self) -> Result<Json, JsonError> {
        let start = self.pos;
        if self.peek() == Some(b'-') {
            self.pos += 1;
        }
        while let Some(b) = self.peek() {
            if b.is_ascii_digit() || matches!(b, b'.' | b'e' | b'E' | b'+' | b'-') {
                self.pos += 1;
            } else {
                break;
            }
        }
        let slice = std::str::from_utf8(&self.bytes[start..self.pos])
            .map_err(|_| self.err("invalid number bytes"))?;
        slice
            .parse::<f64>()
            .map(Json::Number)
            .map_err(|_| self.err("invalid number"))
    }
}

/// serde_json-backed parser (feature `serde`) — for differential testing against
/// the zero-dep parser and as a drop-in for systems already on serde.
#[cfg(feature = "serde")]
#[derive(Debug, Clone, Copy, Default)]
pub struct SerdeJsonParser;

#[cfg(feature = "serde")]
impl JsonParser for SerdeJsonParser {
    fn parse(&self, input: &str) -> Result<Json, JsonError> {
        let value: serde_json::Value =
            serde_json::from_str(input).map_err(|e| JsonError {
                message: e.to_string(),
                position: 0,
            })?;
        Ok(from_serde(&value))
    }
}

#[cfg(feature = "serde")]
fn from_serde(value: &serde_json::Value) -> Json {
    match value {
        serde_json::Value::Null => Json::Null,
        serde_json::Value::Bool(b) => Json::Bool(*b),
        serde_json::Value::Number(n) => Json::Number(n.as_f64().unwrap_or(f64::NAN)),
        serde_json::Value::String(s) => Json::Str(s.clone()),
        serde_json::Value::Array(a) => Json::Array(a.iter().map(from_serde).collect()),
        serde_json::Value::Object(o) => {
            Json::Object(o.iter().map(|(k, v)| (k.clone(), from_serde(v))).collect())
        }
    }
}
