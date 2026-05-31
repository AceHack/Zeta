//! JSON ingestion — hexagonal (ports & adapters).
//!
//! WE drive the interface. [`Json`] (our AST) and [`JsonParser`] (our trait) are the
//! PORT — the rest of the crate (mapping + algebra) depends only on these, never on
//! any external library's value type. External deps ADAPT INTO our port:
//!
//! - [`ZetaJsonParser`] — our own zero-dependency DOM parser, **built on top of the
//!   forward-only [`JsonReader`](crate::json_reader::JsonReader)** (one tokenizer;
//!   the reader is the primitive, the DOM is a consumer of it). Production default
//!   for TRUSTED input only (see the DoS note on the struct).
//! - [`SerdeJsonParser`] (feature `serde`) — the ADAPTER: it wraps serde_json and
//!   maps `serde_json::Value` → our [`Json`]. serde conforms to OUR interface, not the
//!   reverse. This lets us (a) differentially test ours against serde — "not flying
//!   blind" — and (b) let serde drop-in-replace ours in systems already on serde.
//!
//! Crucially, nothing outside the adapter (`from_serde`) ever names a `serde_json`
//! type, so the crate never *depends on* serde's interface — only its implementation,
//! behind our port. The port evolves as we learn; improvements flow back upstream.
//!
//! For untrusted or unbounded/streaming input, prefer the forward-only
//! [`JsonReader`](crate::json_reader::JsonReader) directly — it never materializes
//! the whole document (constant memory, bounded by nesting depth).

use std::fmt;

use crate::json_reader::{JsonReader, JsonToken};

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

impl JsonError {
    fn new(message: &str) -> Self {
        JsonError { message: message.to_string(), position: 0 }
    }
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

/// Zero-dependency DOM parser, built on the forward-only
/// [`JsonReader`](crate::json_reader::JsonReader).
///
/// SECURITY — TRUSTED INPUT ONLY. A DOM parse materializes the ENTIRE document in
/// memory and recurses on nesting depth, so a hostile payload (very large or deeply
/// nested) can exhaust memory or the stack — a denial-of-service vector. Use the DOM
/// only when the input is trusted. For untrusted or unbounded/streaming input, use
/// the forward-only [`JsonReader`](crate::json_reader::JsonReader) directly (constant
/// memory, bounded by nesting depth). (Operator observation 2026-05-31: a DOM model
/// "is susceptible to DOS attacks ... only use it in trusted situations" and "the dom
/// one can be built on the forward pass only one".)
#[derive(Debug, Clone, Copy, Default)]
pub struct ZetaJsonParser;

impl JsonParser for ZetaJsonParser {
    fn parse(&self, input: &str) -> Result<Json, JsonError> {
        let mut reader = JsonReader::new(input);
        let first = reader.read()?.ok_or_else(|| JsonError::new("empty input"))?;
        let value = build_value(&mut reader, first)?;
        // The reader yields None at EOF and errors on trailing content; confirm EOF.
        match reader.read()? {
            None => Ok(value),
            Some(_) => Err(JsonError::new("trailing tokens after JSON value")),
        }
    }
}

/// Build one DOM value from a token already pulled from the reader, recursively
/// draining nested containers.
///
/// NOTE: recursion depth = JSON nesting depth — the DoS vector noted on
/// [`ZetaJsonParser`]. The reader itself is iterative + constant-memory; the
/// unbounded growth lives only in this DOM materialization layer.
fn build_value<'a>(reader: &mut JsonReader<'a>, token: JsonToken<'a>) -> Result<Json, JsonError> {
    match token {
        JsonToken::Null => Ok(Json::Null),
        JsonToken::Bool(b) => Ok(Json::Bool(b)),
        JsonToken::Number(raw) => raw
            .parse::<f64>()
            .map(Json::Number)
            .map_err(|_| JsonError::new("invalid number")),
        JsonToken::Str(s) => Ok(Json::Str(s.into_owned())),
        JsonToken::StartArray => {
            let mut items = Vec::new();
            loop {
                let t = reader.read()?.ok_or_else(|| JsonError::new("unterminated array"))?;
                if t == JsonToken::EndArray {
                    break;
                }
                items.push(build_value(reader, t)?);
            }
            Ok(Json::Array(items))
        }
        JsonToken::StartObject => {
            let mut fields = Vec::new();
            loop {
                let t = reader.read()?.ok_or_else(|| JsonError::new("unterminated object"))?;
                match t {
                    JsonToken::EndObject => break,
                    JsonToken::Key(k) => {
                        let value_token =
                            reader.read()?.ok_or_else(|| JsonError::new("missing value after key"))?;
                        let value = build_value(reader, value_token)?;
                        fields.push((k.into_owned(), value));
                    }
                    _ => return Err(JsonError::new("expected an object key")),
                }
            }
            Ok(Json::Object(fields))
        }
        JsonToken::EndArray | JsonToken::EndObject | JsonToken::Key(_) => {
            Err(JsonError::new("unexpected token while building a value"))
        }
    }
}

/// serde_json-backed DOM parser (feature `serde`) — for differential testing against
/// the zero-dep parser and as a drop-in for systems already on serde. Also a DOM
/// (materializes the whole tree), so the same TRUSTED-input-only caveat as
/// [`ZetaJsonParser`] applies.
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
