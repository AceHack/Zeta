//! Forward-only, pull-based, zero-copy UTF-8 JSON token reader — the
//! `Utf8JsonReader` model (System.Text.Json / ASP.NET Core).
//!
//! Single pass, forward only. It NEVER materializes the whole document into a DOM:
//! it yields tokens one at a time and the caller discards as it goes, so even a
//! million-element array is processed in constant memory (reader state is bounded by
//! nesting DEPTH — a small container stack — not document size). Tokens BORROW from
//! the input buffer (zero-copy); only an escaped string allocates (`Cow::Owned`);
//! numbers are returned as their raw `&str` slice (zero-copy, lossless — parse on
//! demand).
//!
//! SCOPE — day-one this reads from a COMPLETE in-memory buffer (the public
//! constructors take `&str`; bytes internally). So it gives the no-DOM / constant-
//! memory / forward-only half of the `Utf8JsonReader` model, but NOT yet *truly
//! unbounded* socket streaming — that needs the multi-segment / `BufRead`-refill
//! variant (re-feed bytes across reads) tracked in B-0867.29. "Streams" here means
//! "tokenizes without a DOM", not "reads from an endless socket" (yet).
//!
//! This is the streaming PRIMITIVE, and the DOM `Json` parse (json.rs) IS built on
//! top of it (`ZetaJsonParser` drives this reader) — one tokenizer; the DOM is a
//! trusted-input-only convenience layer over the streaming core. Operator
//! observation 2026-05-31: "our json parser needs to ... be
//! like dotnet ... one pass forward only ... never needs the whole object at once ...
//! deserialize infinite json streams" + "think aspnet json speed requirements".
//!
//! Perf-hardening roadmap (B-0867.29):
//! a multi-segment / `BufRead`-refill variant for truly infinite socket streams
//! (re-feed bytes across reads), SIMD-vectorized whitespace/structural scanning,
//! and a criterion benchmark vs serde_json to prove ASP.NET-grade throughput.

use std::borrow::Cow;

use crate::json::JsonError;

/// A single forward-only token. Borrows from the input buffer where possible.
#[derive(Debug, Clone, PartialEq)]
pub enum JsonToken<'a> {
    /// `{`
    StartObject,
    /// `}`
    EndObject,
    /// `[`
    StartArray,
    /// `]`
    EndArray,
    /// An object key. Zero-copy (`Borrowed`) unless it contained escapes.
    Key(Cow<'a, str>),
    /// A string value. Zero-copy (`Borrowed`) unless it contained escapes.
    Str(Cow<'a, str>),
    /// A number, as its raw source slice (zero-copy, lossless). Use
    /// [`JsonToken::number_as_f64`] to parse on demand.
    Number(&'a str),
    /// `true` / `false`.
    Bool(bool),
    /// `null`.
    Null,
}

impl JsonToken<'_> {
    /// Parse a [`JsonToken::Number`] as f64 (returns `None` for other tokens or an
    /// unparseable slice).
    pub fn number_as_f64(&self) -> Option<f64> {
        match self {
            JsonToken::Number(raw) => raw.parse::<f64>().ok(),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Container {
    Object,
    Array,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum State {
    /// Expect the single top-level (root) value.
    Value,
    /// Just opened a container: expect the first member (key in object / value in
    /// array) or an immediate close.
    FirstMember,
    /// In an object, a key + `:` were just read: expect the value.
    ObjectValue,
    /// After a member: expect `,` (→ next member) or the matching close.
    AfterMember,
    /// The root value has been consumed; only trailing whitespace may remain.
    End,
}

/// Default maximum nesting depth, matching serde_json's recursion limit. Caps the
/// container stack so hostile deeply-nested input (`[[[[…`) can't grow it without
/// bound — the deep-nesting DoS the SOAP/XML DOM era taught (B-0867.29).
pub const DEFAULT_MAX_DEPTH: usize = 128;

/// A forward-only, pull-based reader over a complete UTF-8 JSON buffer. Call
/// [`read`](JsonReader::read) repeatedly; it yields one [`JsonToken`] per call and
/// `None` at end of input. Memory is bounded by nesting depth, not document size,
/// and nesting depth itself is capped at [`max_depth`](JsonReader::with_max_depth)
/// (default [`DEFAULT_MAX_DEPTH`]) so untrusted input cannot exhaust memory via the
/// container stack.
pub struct JsonReader<'a> {
    bytes: &'a [u8],
    pos: usize,
    stack: Vec<Container>,
    state: State,
    max_depth: usize,
}

impl<'a> JsonReader<'a> {
    /// Create a reader over a complete UTF-8 JSON buffer (nesting capped at
    /// [`DEFAULT_MAX_DEPTH`]).
    pub fn new(input: &'a str) -> Self {
        Self::with_max_depth(input, DEFAULT_MAX_DEPTH)
    }

    /// Create a reader with an explicit maximum nesting depth (`{`/`[` beyond this
    /// are rejected) — tune it for the trust level of the input source.
    pub fn with_max_depth(input: &'a str, max_depth: usize) -> Self {
        JsonReader {
            bytes: input.as_bytes(),
            pos: 0,
            stack: Vec::new(),
            state: State::Value,
            max_depth,
        }
    }

    /// Current nesting depth (number of open containers). Stays bounded regardless
    /// of document size — the proof of constant-memory streaming.
    pub fn depth(&self) -> usize {
        self.stack.len()
    }

    /// Advance to and return the next token, or `None` at end of input.
    pub fn read(&mut self) -> Result<Option<JsonToken<'a>>, JsonError> {
        self.skip_ws();
        match self.state {
            State::End => {
                if self.pos == self.bytes.len() {
                    Ok(None)
                } else {
                    Err(self.err("trailing characters after JSON value"))
                }
            }
            State::Value => {
                let (tok, is_start) = self.read_value()?;
                self.state = if is_start { State::FirstMember } else { State::End };
                Ok(Some(tok))
            }
            State::ObjectValue => {
                let (tok, is_start) = self.read_value()?;
                self.state = if is_start { State::FirstMember } else { State::AfterMember };
                Ok(Some(tok))
            }
            State::FirstMember => match self.stack.last().copied() {
                Some(Container::Object) => {
                    if self.peek() == Some(b'}') {
                        self.pos += 1;
                        self.stack.pop();
                        self.state = self.pop_state();
                        Ok(Some(JsonToken::EndObject))
                    } else {
                        let key = self.read_key()?;
                        self.state = State::ObjectValue;
                        Ok(Some(JsonToken::Key(key)))
                    }
                }
                Some(Container::Array) => {
                    if self.peek() == Some(b']') {
                        self.pos += 1;
                        self.stack.pop();
                        self.state = self.pop_state();
                        Ok(Some(JsonToken::EndArray))
                    } else {
                        let (tok, is_start) = self.read_value()?;
                        self.state = if is_start { State::FirstMember } else { State::AfterMember };
                        Ok(Some(tok))
                    }
                }
                None => Err(self.err("internal: FirstMember with empty stack")),
            },
            State::AfterMember => match self.peek() {
                Some(b',') => {
                    self.pos += 1;
                    self.skip_ws();
                    match self.stack.last().copied() {
                        Some(Container::Object) => {
                            let key = self.read_key()?;
                            self.state = State::ObjectValue;
                            Ok(Some(JsonToken::Key(key)))
                        }
                        Some(Container::Array) => {
                            let (tok, is_start) = self.read_value()?;
                            self.state = if is_start { State::FirstMember } else { State::AfterMember };
                            Ok(Some(tok))
                        }
                        None => Err(self.err("internal: AfterMember with empty stack")),
                    }
                }
                Some(b'}') if self.stack.last() == Some(&Container::Object) => {
                    self.pos += 1;
                    self.stack.pop();
                    self.state = self.pop_state();
                    Ok(Some(JsonToken::EndObject))
                }
                Some(b']') if self.stack.last() == Some(&Container::Array) => {
                    self.pos += 1;
                    self.stack.pop();
                    self.state = self.pop_state();
                    Ok(Some(JsonToken::EndArray))
                }
                _ => Err(self.err("expected ',' or a closing bracket")),
            },
        }
    }

    fn pop_state(&self) -> State {
        if self.stack.is_empty() { State::End } else { State::AfterMember }
    }

    /// Push a container, enforcing the max-depth cap (rejects hostile deep nesting).
    fn push_container(&mut self, container: Container) -> Result<(), JsonError> {
        if self.stack.len() >= self.max_depth {
            return Err(self.err("maximum nesting depth exceeded"));
        }
        self.stack.push(container);
        Ok(())
    }

    /// Read a value token. Returns `(token, is_container_start)`; on `{`/`[` it
    /// pushes the container and returns the Start token with `true`.
    fn read_value(&mut self) -> Result<(JsonToken<'a>, bool), JsonError> {
        self.skip_ws();
        // Containers return immediately (their interior is driven by the state
        // machine). Scalars fall through to the value-terminator check.
        let token = match self.peek() {
            Some(b'{') => {
                self.pos += 1;
                self.push_container(Container::Object)?;
                return Ok((JsonToken::StartObject, true));
            }
            Some(b'[') => {
                self.pos += 1;
                self.push_container(Container::Array)?;
                return Ok((JsonToken::StartArray, true));
            }
            Some(b'"') => JsonToken::Str(self.read_string()?),
            Some(b't') | Some(b'f') => JsonToken::Bool(self.read_bool()?),
            Some(b'n') => {
                self.read_null()?;
                JsonToken::Null
            }
            Some(b) if b == b'-' || b.is_ascii_digit() => JsonToken::Number(self.read_number()?),
            Some(_) => return Err(self.err("unexpected character (expected a value)")),
            None => return Err(self.err("unexpected end of input (expected a value)")),
        };
        // After ANY scalar, the next byte must be a value terminator (whitespace, a
        // structural delimiter, or EOF). Validating it HERE rejects every malformed
        // trailing byte — `1x`, `true_`, `null/`, `false"`, `[1x]` — on the read()
        // that produced the token, instead of yielding a bogus token with the error
        // delayed to the next read().
        self.expect_value_terminator()?;
        Ok((token, false))
    }

    /// A scalar value must be followed (after any whitespace) by a terminator that
    /// is valid IN CONTEXT: EOF always; `,` only inside a container; `]` only inside
    /// an array; `}` only inside an object. We look PAST whitespace to the next
    /// significant byte so `[1 2]` / `1   x` (a bad byte after the space) are rejected
    /// eagerly — a check that stopped at the whitespace would accept it and delay the
    /// error to the next read.
    fn expect_value_terminator(&self) -> Result<(), JsonError> {
        let mut i = self.pos;
        while i < self.bytes.len() && matches!(self.bytes[i], b' ' | b'\t' | b'\n' | b'\r') {
            i += 1;
        }
        let ok = match self.bytes.get(i).copied() {
            None => true,
            Some(b',') => !self.stack.is_empty(),
            Some(b']') => self.stack.last() == Some(&Container::Array),
            Some(b'}') => self.stack.last() == Some(&Container::Object),
            Some(_) => false,
        };
        if ok {
            Ok(())
        } else {
            Err(self.err("unexpected character after value (invalid terminator in this context)"))
        }
    }

    fn read_key(&mut self) -> Result<Cow<'a, str>, JsonError> {
        self.skip_ws();
        let key = self.read_string()?;
        self.skip_ws();
        if self.peek() == Some(b':') {
            self.pos += 1;
            Ok(key)
        } else {
            Err(self.err("expected ':' after object key"))
        }
    }

    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.pos).copied()
    }

    fn err(&self, msg: &str) -> JsonError {
        JsonError { message: msg.to_string(), position: self.pos }
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

    /// Read a string. Fast path: borrow the buffer slice (zero-copy) when there are
    /// no escapes; slow path: build an owned `String` when escapes are present.
    fn read_string(&mut self) -> Result<Cow<'a, str>, JsonError> {
        if self.peek() != Some(b'"') {
            return Err(self.err("expected '\"'"));
        }
        self.pos += 1;
        let start = self.pos;
        while let Some(b) = self.peek() {
            match b {
                b'"' => {
                    let slice = &self.bytes[start..self.pos];
                    self.pos += 1;
                    let s = std::str::from_utf8(slice).map_err(|_| self.err("invalid utf-8 in string"))?;
                    return Ok(Cow::Borrowed(s));
                }
                b'\\' => return self.read_string_escaped(start),
                // JSON forbids raw control characters (U+0000–U+001F) in strings;
                // they must be escaped. (serde rejects these too.)
                c if c < 0x20 => return Err(self.err("unescaped control character in string")),
                _ => self.pos += 1,
            }
        }
        Err(self.err("unterminated string"))
    }

    fn read_string_escaped(&mut self, start: usize) -> Result<Cow<'a, str>, JsonError> {
        let mut out: Vec<u8> = Vec::new();
        out.extend_from_slice(&self.bytes[start..self.pos]); // bytes before the first backslash
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
                            continue;
                        }
                        _ => return Err(self.err("invalid escape")),
                    }
                    self.pos += 1;
                }
                Some(b) if b < 0x20 => {
                    return Err(self.err("unescaped control character in string"));
                }
                Some(b) => {
                    out.push(b);
                    self.pos += 1;
                }
            }
        }
        String::from_utf8(out)
            .map(Cow::Owned)
            .map_err(|_| self.err("invalid utf-8 in string"))
    }

    fn push_unicode_escape(&mut self, out: &mut Vec<u8>) -> Result<(), JsonError> {
        let hi = self.read_hex4()?;
        let ch = if (0xD800..=0xDBFF).contains(&hi) {
            if self.peek() == Some(b'\\') {
                self.pos += 1;
            } else {
                return Err(self.err("expected low surrogate"));
            }
            if self.peek() == Some(b'u') {
                self.pos += 1;
            } else {
                return Err(self.err("expected low surrogate"));
            }
            let lo = self.read_hex4()?;
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

    fn read_hex4(&mut self) -> Result<u16, JsonError> {
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

    fn read_bool(&mut self) -> Result<bool, JsonError> {
        // The literal's trailing boundary is checked by `expect_value_terminator`
        // (called for all scalars in `read_value`), so `truex`/`false0`/`false"` etc.
        // are rejected eagerly there.
        if self.bytes[self.pos..].starts_with(b"true") {
            self.pos += 4;
            Ok(true)
        } else if self.bytes[self.pos..].starts_with(b"false") {
            self.pos += 5;
            Ok(false)
        } else {
            Err(self.err("invalid literal"))
        }
    }

    fn read_null(&mut self) -> Result<(), JsonError> {
        if self.bytes[self.pos..].starts_with(b"null") {
            self.pos += 4;
            Ok(())
        } else {
            Err(self.err("invalid literal"))
        }
    }

    /// Read a number, returning its raw source slice (zero-copy, lossless).
    ///
    /// Enforces the JSON number grammar strictly — `-? (0 | [1-9][0-9]*) (. [0-9]+)?
    /// ([eE] [+-]? [0-9]+)?` — so non-JSON forms (`01`, `1.`, `-.1`, `+1`, a bare
    /// `-`) are rejected, matching serde. (A lenient scan-then-`f64::parse` would
    /// accept those — the bug Codex flagged.)
    fn read_number(&mut self) -> Result<&'a str, JsonError> {
        let start = self.pos;

        // Optional leading minus.
        if self.peek() == Some(b'-') {
            self.pos += 1;
        }

        // Integer part: a single `0`, or a nonzero digit followed by more digits.
        match self.peek() {
            Some(b'0') => {
                self.pos += 1;
                // No leading zeros: a digit right after `0` (e.g. `01`) is invalid
                // JSON. Reject it HERE so a streaming caller never receives a bogus
                // `Number("0")` token with the error delayed to the next read().
                if matches!(self.peek(), Some(d) if d.is_ascii_digit()) {
                    return Err(self.err("invalid number: leading zeros are not allowed"));
                }
            }
            Some(b) if b.is_ascii_digit() => {
                self.pos += 1;
                self.skip_ascii_digits();
            }
            _ => return Err(self.err("invalid number: expected a digit")),
        }

        // Optional fraction: `.` then at least one digit.
        if self.peek() == Some(b'.') {
            self.pos += 1;
            if !matches!(self.peek(), Some(d) if d.is_ascii_digit()) {
                return Err(self.err("invalid number: expected a digit after '.'"));
            }
            self.skip_ascii_digits();
        }

        // Optional exponent: `e`/`E`, optional sign, then at least one digit.
        if matches!(self.peek(), Some(b'e') | Some(b'E')) {
            self.pos += 1;
            if matches!(self.peek(), Some(b'+') | Some(b'-')) {
                self.pos += 1;
            }
            if !matches!(self.peek(), Some(d) if d.is_ascii_digit()) {
                return Err(self.err("invalid number: expected a digit in the exponent"));
            }
            self.skip_ascii_digits();
        }

        std::str::from_utf8(&self.bytes[start..self.pos]).map_err(|_| self.err("invalid number bytes"))
    }

    fn skip_ascii_digits(&mut self) {
        while matches!(self.peek(), Some(d) if d.is_ascii_digit()) {
            self.pos += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tokens(input: &str) -> Vec<JsonToken<'_>> {
        let mut r = JsonReader::new(input);
        let mut out = Vec::new();
        while let Some(t) = r.read().expect("read") {
            out.push(t);
        }
        out
    }

    #[test]
    fn exact_token_sequence_for_nested_doc() {
        let doc = r#"{"a": [1, true, null], "b": "x", "c": {}}"#;
        let got = tokens(doc);
        let want = vec![
            JsonToken::StartObject,
            JsonToken::Key(Cow::Borrowed("a")),
            JsonToken::StartArray,
            JsonToken::Number("1"),
            JsonToken::Bool(true),
            JsonToken::Null,
            JsonToken::EndArray,
            JsonToken::Key(Cow::Borrowed("b")),
            JsonToken::Str(Cow::Borrowed("x")),
            JsonToken::Key(Cow::Borrowed("c")),
            JsonToken::StartObject,
            JsonToken::EndObject,
            JsonToken::EndObject,
        ];
        assert_eq!(want, got);
    }

    #[test]
    fn strings_are_zero_copy_unless_escaped() {
        // No escapes → Borrowed (zero-copy).
        match &tokens(r#""hello world""#)[0] {
            JsonToken::Str(Cow::Borrowed(_)) => {}
            other => panic!("expected Borrowed, got {other:?}"),
        }
        // Escapes → Owned, correctly decoded.
        match &tokens(r#""a\nb\"c""#)[0] {
            JsonToken::Str(Cow::Owned(s)) => assert_eq!(s, "a\nb\"c"),
            other => panic!("expected Owned, got {other:?}"),
        }
    }

    #[test]
    fn empty_containers() {
        assert_eq!(tokens("{}"), vec![JsonToken::StartObject, JsonToken::EndObject]);
        assert_eq!(tokens("[]"), vec![JsonToken::StartArray, JsonToken::EndArray]);
    }

    #[test]
    fn streaming_large_array_is_constant_depth() {
        // A big top-level array of objects. The reader processes it token-by-token;
        // nesting depth never exceeds 2 (array + one object) regardless of length —
        // the proof of constant-memory streaming over arbitrarily large input.
        let n = 50_000usize;
        let mut doc = String::from("[");
        for i in 0..n {
            if i > 0 {
                doc.push(',');
            }
            doc.push_str(r#"{"i":1}"#);
        }
        doc.push(']');

        let mut r = JsonReader::new(&doc);
        let mut objects = 0usize;
        let mut max_depth = 0usize;
        while let Some(t) = r.read().expect("read") {
            max_depth = max_depth.max(r.depth());
            if t == JsonToken::StartObject {
                objects += 1;
            }
        }
        assert_eq!(objects, n);
        assert_eq!(max_depth, 2, "depth must stay bounded by nesting, not array length");
    }

    #[test]
    fn number_slice_parses_on_demand() {
        let toks = tokens("[-12.5e3]");
        assert_eq!(toks[1], JsonToken::Number("-12.5e3"));
        assert_eq!(toks[1].number_as_f64(), Some(-12500.0));
    }

    /// Drain the whole token stream; returns Err if any read fails (used to assert
    /// that a malformed document is rejected somewhere in the stream).
    fn drain(input: &str) -> Result<(), JsonError> {
        let mut r = JsonReader::new(input);
        while r.read()?.is_some() {}
        Ok(())
    }

    #[test]
    fn rejects_raw_control_characters_in_strings() {
        // A literal newline (U+000A) inside the string, unescaped — JSON forbids it.
        assert!(drain("\"a\nb\"").is_err());
        // A literal tab (U+0009) likewise.
        assert!(drain("\"a\tb\"").is_err());
        // The escaped forms are fine.
        assert!(drain(r#""a\nb""#).is_ok());
    }

    #[test]
    fn rejects_non_delimiter_after_value_eagerly() {
        // ANY non-terminator byte after a scalar (alnum OR symbol) errors on the
        // read() that produces the token — literals AND numbers.
        for bad in ["truex", "false0", "nullx", "true_", "null/", "false\"", "1x", "12.3z"] {
            let mut r = JsonReader::new(bad);
            assert!(r.read().is_err(), "`{bad}` must error on the read that produces it");
        }
        // `[1x]` / `[true_]` error when reading the element, not later.
        for bad in ["[1x]", "[true_]"] {
            let mut r = JsonReader::new(bad);
            assert_eq!(r.read().expect("read").expect("token"), JsonToken::StartArray);
            assert!(r.read().is_err(), "`{bad}` element must error eagerly");
        }
        // Valid scalars followed by a terminator (EOF / structural / ws) are fine.
        for ok in ["true", "false", "null", "1", "[true]", "true ", "[true,false]", "[1,2]"] {
            assert!(drain(ok).is_ok(), "`{ok}` should parse");
        }
    }

    #[test]
    fn rejects_context_invalid_terminators_eagerly() {
        // A structural byte that's wrong for the current container errors on the
        // read() that produces the value, not later: `,`/`]`/`}` at top-level, `}`
        // closing an array, `]` closing an object.
        // Includes whitespace-then-invalid (`[1 2]`, `1   x`): the check looks PAST
        // whitespace, so the bad byte is caught on the value's read, not later.
        for bad in ["1,2", "1]", "1}", "[1}", "[1}]", "[1 2]", "1   x", "[1 2 3]"] {
            let mut r = JsonReader::new(bad);
            // First read() may be StartArray (for `[…`); the offending value's read
            // must surface the error.
            let saw_err = (|| -> Result<bool, JsonError> {
                while let Some(_t) = r.read()? {}
                Ok(false)
            })()
            .is_err();
            assert!(saw_err, "`{bad}` must be rejected");
        }
        // Context-valid terminators (incl. whitespace before them) still parse.
        for ok in ["1", "1 ", "[1,2]", "[1 ,2]", "[1, 2]", "[1]", r#"{"a":1}"#, r#"{"a":1,"b":2}"#] {
            assert!(drain(ok).is_ok(), "`{ok}` should parse");
        }
    }

    #[test]
    fn enforces_json_number_grammar() {
        for bad in ["01", "1.", "-.1", "+1", "-", "1.e3", "00", "1..2"] {
            assert!(drain(bad).is_err(), "non-JSON number '{bad}' must be rejected");
        }
        for good in ["0", "-0", "1", "-12", "12.5", "-12.5e3", "1E10", "0.5", "1e-9"] {
            let mut r = JsonReader::new(good);
            assert_eq!(r.read().expect("read").expect("token"), JsonToken::Number(good));
            assert!(r.read().expect("eof").is_none(), "'{good}' should be a single number");
        }
        // Leading-zero forms are rejected EAGERLY on the first read() — a streaming
        // caller never gets a bogus Number("0") with the error delayed.
        assert!(JsonReader::new("01").read().is_err(), "`01` must error on the first read");
        let mut arr = JsonReader::new("[01]");
        assert_eq!(arr.read().expect("read").expect("token"), JsonToken::StartArray);
        assert!(arr.read().is_err(), "`[01]` must error when reading the element, not later");
    }

    #[test]
    fn caps_nesting_depth_for_untrusted_input() {
        // Hostile deep nesting beyond the default cap is rejected (not OOM).
        let deep = "[".repeat(DEFAULT_MAX_DEPTH + 50);
        assert!(drain(&deep).is_err(), "nesting past DEFAULT_MAX_DEPTH must be rejected");
        // Explicit small cap: depth beyond it errors, within it is fine.
        let mut over = JsonReader::with_max_depth("[[[]]]", 2);
        let over_result = (|| -> Result<(), JsonError> {
            while over.read()?.is_some() {}
            Ok(())
        })();
        assert!(over_result.is_err(), "nesting beyond max_depth=2 must be rejected");
        assert!(JsonReader::with_max_depth("[[]]", 2).read().is_ok(), "within cap is fine");
    }
}
