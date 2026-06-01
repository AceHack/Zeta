//! Bonsai-subset expression-tree serializer — the **Rust oracle** (#4 of TS/F#/C#/Rust)
//! for B-0976 slice 1. The weakly-typed / reflection-info-omitted mode of Nuqleon Bonsai
//! (kind-tagged nodes, no .NET type table; the cross-language-portable form).
//!
//! Canonical form (the cross-oracle byte-diff contract): [`serialize`] emits **compact JSON**
//! (no whitespace) with a **fixed key order per node-kind** (kind first, then fields in
//! declared order) and **integer-only** literals in the shared JS-safe-integer range. Two
//! oracles agree iff their `serialize` outputs are byte-identical, and [`parse`] round-trips
//! (`serialize(parse(s))` is `Ok(s)`). Document wrapper: `{"v":1,"expr":<node>}`.
//! "The compilers don't lie."
//!
//! Error channel: `serialize`/`parse` return [`Result`] over [`BonsaiFeedback`] — no panic
//! crosses the boundary (result over throw; `std::result::Result` is the BCL-native shape).
//! Production is **zero-dependency**: a minimal hand-rolled JSON reader covers the tiny
//! canonical grammar (matching the TS oracle's zero-dep posture and the repo's
//! zero-prod-dep doctrine). The accumulate-mode ([`parse_all`] + RFC-9457
//! [`ProblemDetails`]) is the applicative complement for batch / model-validation.

use std::collections::BTreeMap;

/// The serialization format version (the `v` field of the document wrapper).
pub const VERSION: i64 = 1;

/// The shared v1 maximum expression nesting depth — bounds the recursive serializer/parser
/// (a stack-overflow / DoS guard) and is the cross-oracle depth contract.
pub const MAX_DEPTH: usize = 1024;

// The shared JS-safe-integer bounds (2^53 - 1): the v1 `int` domain. An integer beyond this
// is a value a peer oracle (JS) could not preserve, so it declines `NonSafeInt`.
const MAX_SAFE_INT: i64 = 9_007_199_254_740_991;
const MIN_SAFE_INT: i64 = -9_007_199_254_740_991;

// The JSON reader's own nesting ceiling — generous above MAX_DEPTH so the semantic depth
// check (TooDeep) fires before the reader's recursion guard, keeping the feedback typed.
const PARSE_DEPTH_CEILING: usize = MAX_DEPTH * 2;

/// The language-agnostic binary operators in the subset.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BinOp {
    /// Addition.
    Add,
    /// Subtraction.
    Sub,
    /// Multiplication.
    Mul,
    /// Equality.
    Eq,
    /// Less-than.
    Lt,
    /// Logical and.
    And,
    /// Logical or.
    Or,
}

/// A literal value — tagged so every oracle round-trips the type exactly.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum ConstValue {
    /// An integer literal (no floats in the subset; the shared JS-safe-integer range).
    Int(i64),
    /// A string literal.
    Str(String),
    /// A boolean literal.
    Bool(bool),
    /// The null literal.
    Null,
}

/// A Bonsai-subset expression node (kind-tagged tree). The node set is
/// `const · param · lambda · binary · call · cond`.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Expr {
    /// A literal constant.
    Const(ConstValue),
    /// A parameter (variable) reference.
    Param(String),
    /// A lambda abstraction.
    Lambda {
        /// The bound parameter names.
        params: Vec<String>,
        /// The lambda body.
        body: Box<Expr>,
    },
    /// A binary operation.
    Binary {
        /// The operator.
        op: BinOp,
        /// The left operand.
        left: Box<Expr>,
        /// The right operand.
        right: Box<Expr>,
    },
    /// A named function application.
    Call {
        /// The function name.
        fn_name: String,
        /// The argument expressions.
        args: Vec<Expr>,
    },
    /// A conditional (`if test then then else else`).
    Cond {
        /// The test expression.
        test: Box<Expr>,
        /// The then-branch.
        then: Box<Expr>,
        /// The else-branch.
        els: Box<Expr>,
    },
}

/// The bonsai-domain feedback channel — the typed reasons `serialize`/`parse` decline, the
/// shared cross-oracle payload contract (variant-for-variant parity with the F#/C#/TS oracles).
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum BonsaiFeedback {
    /// The document `v` field was a version this oracle does not support.
    UnsupportedVersion {
        /// The version found in the input.
        found: i64,
        /// The version this oracle expects.
        expected: i64,
    },
    /// The input was not well-formed JSON (or violated a structural shape).
    MalformedJson(String),
    /// A node carried a `kind` outside the subset.
    UnknownKind(String),
    /// A constant carried a `t` tag outside `int/str/bool/null`.
    UnknownConstTag(String),
    /// A binary node carried an operator outside the subset.
    UnknownOp(String),
    /// A field expected to be a string was not (the payload names the field).
    ExpectedString(String),
    /// A field expected to be a boolean was not (the payload names the field).
    ExpectedBool(String),
    /// A field expected to be an integer was not (the payload names the field).
    ExpectedInt(String),
    /// An integer literal was outside the shared JS-safe-integer range — never silently rounded.
    NonSafeInt(i64),
    /// Expression nesting exceeded the shared [`MAX_DEPTH`].
    TooDeep(usize),
    /// The input was structurally valid but not in canonical byte form.
    NonCanonical,
}

/// A decline tagged with the JSON-path where it occurred (the [`ProblemDetails`] key in the
/// accumulate mode).
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct PathedFeedback {
    /// The JSON-path to the declining node (e.g. `$.expr.left.op`).
    pub path: String,
    /// The typed reason this node declined.
    pub feedback: BonsaiFeedback,
}

/// RFC-9457 "Problem Details" — the field-keyed multi-error document (the shape .NET ships as
/// `ValidationProblemDetails`; useful well outside HTTP). The accumulate mode groups a
/// [`PathedFeedback`] list into the `errors` map (path → messages).
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct ProblemDetails {
    /// The problem-type URI (defaults to `about:blank`).
    pub r#type: String,
    /// A short, human-readable summary of the problem.
    pub title: String,
    /// The field-keyed error map: each JSON-path to its messages (sorted by path).
    pub errors: BTreeMap<String, Vec<String>>,
}

fn binop_str(op: BinOp) -> &'static str {
    match op {
        BinOp::Add => "add",
        BinOp::Sub => "sub",
        BinOp::Mul => "mul",
        BinOp::Eq => "eq",
        BinOp::Lt => "lt",
        BinOp::And => "and",
        BinOp::Or => "or",
    }
}

fn binop_of_str(s: &str) -> Option<BinOp> {
    match s {
        "add" => Some(BinOp::Add),
        "sub" => Some(BinOp::Sub),
        "mul" => Some(BinOp::Mul),
        "eq" => Some(BinOp::Eq),
        "lt" => Some(BinOp::Lt),
        "and" => Some(BinOp::And),
        "or" => Some(BinOp::Or),
        _ => None,
    }
}

// ---- serialize (canonical, byte-exact) ------------------------------------

fn check_safe_int(v: i64) -> Result<i64, BonsaiFeedback> {
    if !(MIN_SAFE_INT..=MAX_SAFE_INT).contains(&v) {
        return Err(BonsaiFeedback::NonSafeInt(v));
    }
    Ok(v)
}

/// JSON-escape a string to match JS `JSON.stringify` / the other oracles byte-for-byte:
/// escape `"`, `\`, and control chars (shortforms then lowercase `\u00xx`); every other
/// scalar is emitted literally (Rust strings are valid UTF-8 — no lone surrogates exist to
/// escape, so an astral char is emitted as its literal UTF-8 bytes, exactly as the UTF-16
/// oracles emit a surrogate pair literally).
fn jstr(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\t' => out.push_str("\\t"),
            '\n' => out.push_str("\\n"),
            '\u{c}' => out.push_str("\\f"),
            '\r' => out.push_str("\\r"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn emit_const(c: &ConstValue) -> Result<String, BonsaiFeedback> {
    Ok(match c {
        ConstValue::Int(v) => format!("{{\"t\":\"int\",\"v\":{}}}", check_safe_int(*v)?),
        ConstValue::Str(s) => format!("{{\"t\":\"str\",\"v\":{}}}", jstr(s)),
        ConstValue::Bool(b) => format!("{{\"t\":\"bool\",\"v\":{b}}}"),
        ConstValue::Null => "{\"t\":\"null\"}".to_string(),
    })
}

fn emit_at(depth: usize, e: &Expr) -> Result<String, BonsaiFeedback> {
    if depth > MAX_DEPTH {
        return Err(BonsaiFeedback::TooDeep(MAX_DEPTH));
    }
    Ok(match e {
        Expr::Const(c) => format!("{{\"kind\":\"const\",\"value\":{}}}", emit_const(c)?),
        Expr::Param(name) => format!("{{\"kind\":\"param\",\"name\":{}}}", jstr(name)),
        Expr::Lambda { params, body } => {
            let ps: Vec<String> = params.iter().map(|p| jstr(p)).collect();
            format!(
                "{{\"kind\":\"lambda\",\"params\":[{}],\"body\":{}}}",
                ps.join(","),
                emit_at(depth + 1, body)?
            )
        }
        Expr::Binary { op, left, right } => format!(
            "{{\"kind\":\"binary\",\"op\":{},\"left\":{},\"right\":{}}}",
            jstr(binop_str(*op)),
            emit_at(depth + 1, left)?,
            emit_at(depth + 1, right)?
        ),
        Expr::Call { fn_name, args } => {
            let mut parts = Vec::with_capacity(args.len());
            for a in args {
                parts.push(emit_at(depth + 1, a)?);
            }
            format!(
                "{{\"kind\":\"call\",\"fn\":{},\"args\":[{}]}}",
                jstr(fn_name),
                parts.join(",")
            )
        }
        Expr::Cond { test, then, els } => format!(
            "{{\"kind\":\"cond\",\"test\":{},\"then\":{},\"else\":{}}}",
            emit_at(depth + 1, test)?,
            emit_at(depth + 1, then)?,
            emit_at(depth + 1, els)?
        ),
    })
}

/// Serialize an expression to the canonical Bonsai-subset string. Declines on an unsafe
/// integer literal or nesting past [`MAX_DEPTH`] — no panic crosses the boundary.
///
/// # Errors
/// Returns [`BonsaiFeedback::NonSafeInt`] for an out-of-range integer literal, or
/// [`BonsaiFeedback::TooDeep`] when nesting exceeds [`MAX_DEPTH`].
pub fn serialize(e: &Expr) -> Result<String, BonsaiFeedback> {
    Ok(format!("{{\"v\":{},\"expr\":{}}}", VERSION, emit_at(1, e)?))
}

// ---- minimal JSON reader (zero-dep; the tiny canonical grammar) ------------

/// A minimal parsed JSON value. `Int` and `Float` are split so the bonsai layer can tell a
/// safe integer (the `int` domain) from a fractional / out-of-range number (declines
/// `ExpectedInt`) without re-tokenizing.
enum Json {
    Null,
    Bool(bool),
    Int(i64),
    Float,
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
}

fn obj_get<'a>(o: &'a [(String, Json)], key: &str) -> Option<&'a Json> {
    o.iter().find(|(k, _)| k == key).map(|(_, v)| v)
}

struct Reader {
    chars: Vec<char>,
    pos: usize,
}

impl Reader {
    fn new(s: &str) -> Self {
        Reader {
            chars: s.chars().collect(),
            pos: 0,
        }
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

    fn value(&mut self, depth: usize) -> Result<Json, String> {
        if depth > PARSE_DEPTH_CEILING {
            return Err("nesting too deep".to_string());
        }
        self.skip_ws();
        match self.peek() {
            Some('{') => self.object(depth),
            Some('[') => self.array(depth),
            Some('"') => Ok(Json::Str(self.string()?)),
            Some('t') | Some('f') => self.boolean(),
            Some('n') => self.null(),
            Some(c) if c == '-' || c.is_ascii_digit() => self.number(),
            Some(c) => Err(format!("unexpected character '{c}'")),
            None => Err("unexpected end of input".to_string()),
        }
    }

    fn expect(&mut self, c: char) -> Result<(), String> {
        if self.peek() == Some(c) {
            self.pos += 1;
            Ok(())
        } else {
            Err(format!("expected '{c}'"))
        }
    }

    fn keyword(&mut self, word: &str) -> Result<(), String> {
        for expected in word.chars() {
            if self.peek() == Some(expected) {
                self.pos += 1;
            } else {
                return Err(format!("invalid literal (expected '{word}')"));
            }
        }
        Ok(())
    }

    fn boolean(&mut self) -> Result<Json, String> {
        if self.peek() == Some('t') {
            self.keyword("true")?;
            Ok(Json::Bool(true))
        } else {
            self.keyword("false")?;
            Ok(Json::Bool(false))
        }
    }

    fn null(&mut self) -> Result<Json, String> {
        self.keyword("null")?;
        Ok(Json::Null)
    }

    fn digits(&mut self) -> bool {
        let mut any = false;
        while matches!(self.peek(), Some(d) if d.is_ascii_digit()) {
            self.pos += 1;
            any = true;
        }
        any
    }

    fn number(&mut self) -> Result<Json, String> {
        // Strict JSON number grammar (RFC 8259): -? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE][+-]?[0-9]+)?
        // A real JSON parser rejects leading zeros (`01`), dangling signs/points (`1+`, `1.`,
        // `1e`), and double-punctuation (`1.2.3`, `1-2`) as malformed — so the Rust oracle is
        // error-for-error with the TS/F#/C# real-JSON-parser oracles on those rejection inputs.
        let start = self.pos;
        if self.peek() == Some('-') {
            self.pos += 1;
        }
        match self.peek() {
            // a leading 0 is a complete int part (no further digits allowed)
            Some('0') => self.pos += 1,
            Some(c) if c.is_ascii_digit() => {
                self.digits();
            }
            _ => return Err("invalid number".to_string()),
        }
        let mut is_float = false;
        if self.peek() == Some('.') {
            is_float = true;
            self.pos += 1;
            if !self.digits() {
                return Err("invalid number (digits expected after '.')".to_string());
            }
        }
        if matches!(self.peek(), Some('e') | Some('E')) {
            is_float = true;
            self.pos += 1;
            if matches!(self.peek(), Some('+') | Some('-')) {
                self.pos += 1;
            }
            if !self.digits() {
                return Err("invalid number (digits expected in exponent)".to_string());
            }
        }
        let raw: String = self.chars[start..self.pos].iter().collect();
        if is_float {
            // a fractional / exponent number — declines ExpectedInt at the bonsai layer
            return Ok(Json::Float);
        }
        match raw.parse::<i64>() {
            Ok(n) => Ok(Json::Int(n)),
            // an integer beyond i64 — treat as a non-int domain value (out of the int range)
            Err(_) => Ok(Json::Float),
        }
    }

    fn string(&mut self) -> Result<String, String> {
        self.expect('"')?;
        let mut out = String::new();
        loop {
            match self.peek() {
                None => return Err("unterminated string".to_string()),
                Some('"') => {
                    self.pos += 1;
                    return Ok(out);
                }
                Some('\\') => {
                    self.pos += 1;
                    out.push(self.escape()?);
                }
                // JSON forbids unescaped control characters (U+0000–U+001F) in strings; a real
                // JSON parser rejects them as malformed (the other oracles do), so do likewise.
                Some(c) if (c as u32) < 0x20 => {
                    return Err("unescaped control character in string".to_string());
                }
                Some(c) => {
                    self.pos += 1;
                    out.push(c);
                }
            }
        }
    }

    fn escape(&mut self) -> Result<char, String> {
        match self.peek() {
            Some('"') => {
                self.pos += 1;
                Ok('"')
            }
            Some('\\') => {
                self.pos += 1;
                Ok('\\')
            }
            Some('/') => {
                self.pos += 1;
                Ok('/')
            }
            Some('b') => {
                self.pos += 1;
                Ok('\u{8}')
            }
            Some('f') => {
                self.pos += 1;
                Ok('\u{c}')
            }
            Some('n') => {
                self.pos += 1;
                Ok('\n')
            }
            Some('r') => {
                self.pos += 1;
                Ok('\r')
            }
            Some('t') => {
                self.pos += 1;
                Ok('\t')
            }
            Some('u') => {
                self.pos += 1;
                self.unicode_escape()
            }
            _ => Err("invalid escape".to_string()),
        }
    }

    fn hex4(&mut self) -> Result<u32, String> {
        let mut v: u32 = 0;
        for _ in 0..4 {
            match self.peek() {
                Some(c) if c.is_ascii_hexdigit() => {
                    v = v * 16 + c.to_digit(16).expect("hex digit");
                    self.pos += 1;
                }
                _ => return Err("invalid \\u escape".to_string()),
            }
        }
        Ok(v)
    }

    fn unicode_escape(&mut self) -> Result<char, String> {
        let hi = self.hex4()?;
        if (0xD800..=0xDBFF).contains(&hi) {
            // high surrogate — must be followed by \uXXXX low surrogate to form a scalar
            if self.peek() == Some('\\') {
                self.pos += 1;
                self.expect('u')?;
                let lo = self.hex4()?;
                if (0xDC00..=0xDFFF).contains(&lo) {
                    let cp = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00);
                    return char::from_u32(cp).ok_or_else(|| "invalid surrogate pair".to_string());
                }
            }
            // a lone surrogate is not representable as a Rust scalar (UTF-8) — decline
            return Err("lone surrogate not representable".to_string());
        }
        if (0xDC00..=0xDFFF).contains(&hi) {
            return Err("lone low surrogate not representable".to_string());
        }
        char::from_u32(hi).ok_or_else(|| "invalid \\u escape".to_string())
    }

    fn array(&mut self, depth: usize) -> Result<Json, String> {
        self.expect('[')?;
        let mut items = Vec::new();
        self.skip_ws();
        if self.peek() == Some(']') {
            self.pos += 1;
            return Ok(Json::Arr(items));
        }
        loop {
            items.push(self.value(depth + 1)?);
            self.skip_ws();
            match self.peek() {
                Some(',') => {
                    self.pos += 1;
                }
                Some(']') => {
                    self.pos += 1;
                    return Ok(Json::Arr(items));
                }
                _ => return Err("expected ',' or ']' in array".to_string()),
            }
        }
    }

    fn object(&mut self, depth: usize) -> Result<Json, String> {
        self.expect('{')?;
        let mut entries = Vec::new();
        self.skip_ws();
        if self.peek() == Some('}') {
            self.pos += 1;
            return Ok(Json::Obj(entries));
        }
        loop {
            self.skip_ws();
            let key = self.string()?;
            self.skip_ws();
            self.expect(':')?;
            let val = self.value(depth + 1)?;
            entries.push((key, val));
            self.skip_ws();
            match self.peek() {
                Some(',') => {
                    self.pos += 1;
                }
                Some('}') => {
                    self.pos += 1;
                    return Ok(Json::Obj(entries));
                }
                _ => return Err("expected ',' or '}' in object".to_string()),
            }
        }
    }
}

fn parse_json(s: &str) -> Result<Json, String> {
    let mut r = Reader::new(s);
    let v = r.value(0)?;
    r.skip_ws();
    if r.pos != r.chars.len() {
        return Err("trailing characters after JSON value".to_string());
    }
    Ok(v)
}

// ---- parse (canonical string -> Expr) -------------------------------------

fn require_string(
    o: &[(String, Json)],
    key: &str,
    location: &str,
) -> Result<String, BonsaiFeedback> {
    match obj_get(o, key) {
        Some(Json::Str(s)) => Ok(s.clone()),
        _ => Err(BonsaiFeedback::ExpectedString(location.to_string())),
    }
}

fn require_safe_int(
    o: &[(String, Json)],
    key: &str,
    location: &str,
) -> Result<i64, BonsaiFeedback> {
    match obj_get(o, key) {
        Some(Json::Int(n)) => check_safe_int(*n),
        _ => Err(BonsaiFeedback::ExpectedInt(location.to_string())),
    }
}

fn require_string_array(
    o: &[(String, Json)],
    key: &str,
    location: &str,
) -> Result<Vec<String>, BonsaiFeedback> {
    match obj_get(o, key) {
        Some(Json::Arr(a)) => {
            let mut out = Vec::with_capacity(a.len());
            for item in a {
                match item {
                    Json::Str(s) => out.push(s.clone()),
                    _ => return Err(BonsaiFeedback::ExpectedString(format!("{location}[]"))),
                }
            }
            Ok(out)
        }
        _ => Err(BonsaiFeedback::MalformedJson(format!(
            "{location} expects an array"
        ))),
    }
}

fn require_expr_array(
    depth: usize,
    o: &[(String, Json)],
    key: &str,
    location: &str,
) -> Result<Vec<Expr>, BonsaiFeedback> {
    match obj_get(o, key) {
        Some(Json::Arr(a)) => {
            let mut out = Vec::with_capacity(a.len());
            for item in a {
                out.push(parse_node(depth, Some(item))?);
            }
            Ok(out)
        }
        _ => Err(BonsaiFeedback::MalformedJson(format!(
            "{location} expects an array"
        ))),
    }
}

fn require_binop(o: &[(String, Json)], key: &str, location: &str) -> Result<BinOp, BonsaiFeedback> {
    let s = require_string(o, key, location)?;
    binop_of_str(&s).ok_or(BonsaiFeedback::UnknownOp(s))
}

fn parse_const(n: Option<&Json>) -> Result<ConstValue, BonsaiFeedback> {
    let o = match n {
        Some(Json::Obj(o)) => o,
        _ => {
            return Err(BonsaiFeedback::MalformedJson(
                "const value expects an object".to_string(),
            ));
        }
    };
    let tag = match obj_get(o, "t") {
        Some(Json::Str(s)) => Some(s.as_str()),
        _ => None,
    };
    match tag {
        Some("int") => Ok(ConstValue::Int(require_safe_int(
            o,
            "v",
            "const int value",
        )?)),
        Some("str") => Ok(ConstValue::Str(require_string(o, "v", "const str value")?)),
        Some("bool") => match obj_get(o, "v") {
            Some(Json::Bool(b)) => Ok(ConstValue::Bool(*b)),
            _ => Err(BonsaiFeedback::ExpectedBool("const bool value".to_string())),
        },
        Some("null") => Ok(ConstValue::Null),
        other => Err(BonsaiFeedback::UnknownConstTag(
            other.unwrap_or("null").to_string(),
        )),
    }
}

fn parse_node(depth: usize, n: Option<&Json>) -> Result<Expr, BonsaiFeedback> {
    if depth > MAX_DEPTH {
        return Err(BonsaiFeedback::TooDeep(MAX_DEPTH));
    }
    let o = match n {
        Some(Json::Obj(o)) => o,
        _ => {
            return Err(BonsaiFeedback::MalformedJson(
                "node expects an object".to_string(),
            ));
        }
    };
    let kind = match obj_get(o, "kind") {
        Some(Json::Str(s)) => s.as_str(),
        _ => {
            return Err(BonsaiFeedback::MalformedJson(
                "node.kind is missing or not a string".to_string(),
            ));
        }
    };
    match kind {
        "const" => Ok(Expr::Const(parse_const(obj_get(o, "value"))?)),
        "param" => Ok(Expr::Param(require_string(o, "name", "param.name")?)),
        "lambda" => Ok(Expr::Lambda {
            params: require_string_array(o, "params", "lambda.params")?,
            body: Box::new(parse_node(depth + 1, obj_get(o, "body"))?),
        }),
        "binary" => Ok(Expr::Binary {
            op: require_binop(o, "op", "binary.op")?,
            left: Box::new(parse_node(depth + 1, obj_get(o, "left"))?),
            right: Box::new(parse_node(depth + 1, obj_get(o, "right"))?),
        }),
        "call" => Ok(Expr::Call {
            fn_name: require_string(o, "fn", "call.fn")?,
            args: require_expr_array(depth + 1, o, "args", "call.args")?,
        }),
        "cond" => Ok(Expr::Cond {
            test: Box::new(parse_node(depth + 1, obj_get(o, "test"))?),
            then: Box::new(parse_node(depth + 1, obj_get(o, "then"))?),
            els: Box::new(parse_node(depth + 1, obj_get(o, "else"))?),
        }),
        other => Err(BonsaiFeedback::UnknownKind(other.to_string())),
    }
}

/// Parse a canonical Bonsai-subset string back to an [`Expr`] — strict and **canonical-only**:
/// a structurally-valid but non-canonical input (extra fields, whitespace, reordered keys)
/// declines [`BonsaiFeedback::NonCanonical`] rather than silently canonicalizing, enforcing
/// the `serialize(parse(s)) == Ok(s)` fixed point.
///
/// # Errors
/// Returns a [`BonsaiFeedback`] describing the first decline (malformed JSON, unsupported
/// version, an unknown/ill-typed node, or non-canonical bytes).
pub fn parse(s: &str) -> Result<Expr, BonsaiFeedback> {
    let json = parse_json(s).map_err(BonsaiFeedback::MalformedJson)?;
    let root = match &json {
        Json::Obj(o) => o,
        _ => {
            return Err(BonsaiFeedback::MalformedJson(
                "document is not an object".to_string(),
            ));
        }
    };
    match obj_get(root, "v") {
        Some(Json::Int(n)) => {
            if *n != VERSION {
                return Err(BonsaiFeedback::UnsupportedVersion {
                    found: *n,
                    expected: VERSION,
                });
            }
        }
        Some(Json::Float) => {
            return Err(BonsaiFeedback::MalformedJson(
                "document v is not an integer".to_string(),
            ));
        }
        _ => {
            return Err(BonsaiFeedback::MalformedJson(
                "document v is not a number".to_string(),
            ));
        }
    }
    let parsed = parse_node(1, obj_get(root, "expr"))?;
    // Canonical-only guard: the round-trip must reproduce the input byte-for-byte.
    let round = serialize(&parsed)?;
    if round != s {
        return Err(BonsaiFeedback::NonCanonical);
    }
    Ok(parsed)
}

// ---- accumulate-mode (RFC-9457 ProblemDetails) ----------------------------

fn feedback_message(f: &BonsaiFeedback) -> String {
    match f {
        BonsaiFeedback::UnsupportedVersion { found, expected } => {
            format!("unsupported version {found} (expected {expected})")
        }
        BonsaiFeedback::MalformedJson(m) => m.clone(),
        BonsaiFeedback::UnknownKind(k) => format!("unknown node kind \"{k}\""),
        BonsaiFeedback::UnknownConstTag(t) => format!("unknown const tag \"{t}\""),
        BonsaiFeedback::UnknownOp(o) => format!("unknown binary operator \"{o}\""),
        BonsaiFeedback::ExpectedString(_) => "expected a string".to_string(),
        BonsaiFeedback::ExpectedBool(_) => "expected a boolean".to_string(),
        BonsaiFeedback::ExpectedInt(_) => "expected a safe integer".to_string(),
        BonsaiFeedback::NonSafeInt(n) => format!("integer {n} is outside the safe-integer range"),
        BonsaiFeedback::TooDeep(d) => format!("nesting exceeds the maximum depth of {d}"),
        BonsaiFeedback::NonCanonical => "input is not in canonical form".to_string(),
    }
}

/// Adapt the collected declines to an RFC-9457 [`ProblemDetails`] document: group by JSON-path
/// into the `errors` map (each path → its messages).
#[must_use]
pub fn to_problem_details(feedbacks: &[PathedFeedback]) -> ProblemDetails {
    let mut errors: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for pf in feedbacks {
        errors
            .entry(pf.path.clone())
            .or_default()
            .push(feedback_message(&pf.feedback));
    }
    ProblemDetails {
        r#type: "about:blank".to_string(),
        title: "Bonsai validation failed".to_string(),
        errors,
    }
}

fn push_const(path: &str, n: Option<&Json>, out: &mut Vec<PathedFeedback>) {
    let o = match n {
        Some(Json::Obj(o)) => o,
        _ => {
            out.push(PathedFeedback {
                path: path.to_string(),
                feedback: BonsaiFeedback::MalformedJson(format!("{path} is not an object")),
            });
            return;
        }
    };
    let tag = match obj_get(o, "t") {
        Some(Json::Str(s)) => Some(s.as_str()),
        _ => None,
    };
    match tag {
        Some("int") => match obj_get(o, "v") {
            Some(Json::Int(n)) => {
                if !(MIN_SAFE_INT..=MAX_SAFE_INT).contains(n) {
                    out.push(PathedFeedback {
                        path: path.to_string(),
                        feedback: BonsaiFeedback::NonSafeInt(*n),
                    });
                }
            }
            _ => out.push(PathedFeedback {
                path: path.to_string(),
                feedback: BonsaiFeedback::ExpectedInt(path.to_string()),
            }),
        },
        Some("str") => {
            if !matches!(obj_get(o, "v"), Some(Json::Str(_))) {
                out.push(PathedFeedback {
                    path: path.to_string(),
                    feedback: BonsaiFeedback::ExpectedString(path.to_string()),
                });
            }
        }
        Some("bool") => {
            if !matches!(obj_get(o, "v"), Some(Json::Bool(_))) {
                out.push(PathedFeedback {
                    path: path.to_string(),
                    feedback: BonsaiFeedback::ExpectedBool(path.to_string()),
                });
            }
        }
        Some("null") => {}
        other => out.push(PathedFeedback {
            path: path.to_string(),
            feedback: BonsaiFeedback::UnknownConstTag(other.unwrap_or("null").to_string()),
        }),
    }
}

fn push_node(path: &str, depth: usize, n: Option<&Json>, out: &mut Vec<PathedFeedback>) {
    if depth > MAX_DEPTH {
        out.push(PathedFeedback {
            path: path.to_string(),
            feedback: BonsaiFeedback::TooDeep(MAX_DEPTH),
        });
        return;
    }
    let o = match n {
        Some(Json::Obj(o)) => o,
        _ => {
            out.push(PathedFeedback {
                path: path.to_string(),
                feedback: BonsaiFeedback::MalformedJson(format!("{path} is not an object")),
            });
            return;
        }
    };
    let kind = match obj_get(o, "kind") {
        Some(Json::Str(s)) => s.as_str(),
        _ => {
            out.push(PathedFeedback {
                path: path.to_string(),
                feedback: BonsaiFeedback::MalformedJson(format!(
                    "{path}.kind is missing or not a string"
                )),
            });
            return;
        }
    };
    match kind {
        "const" => push_const(&format!("{path}.value"), obj_get(o, "value"), out),
        "param" => {
            if !matches!(obj_get(o, "name"), Some(Json::Str(_))) {
                out.push(PathedFeedback {
                    path: format!("{path}.name"),
                    feedback: BonsaiFeedback::ExpectedString(format!("{path}.name")),
                });
            }
        }
        "lambda" => {
            match obj_get(o, "params") {
                Some(Json::Arr(a)) => {
                    for (i, p) in a.iter().enumerate() {
                        if !matches!(p, Json::Str(_)) {
                            let lp = format!("{path}.params[{i}]");
                            out.push(PathedFeedback {
                                path: lp.clone(),
                                feedback: BonsaiFeedback::ExpectedString(lp),
                            });
                        }
                    }
                }
                _ => out.push(PathedFeedback {
                    path: format!("{path}.params"),
                    feedback: BonsaiFeedback::MalformedJson(format!(
                        "{path}.params is not an array"
                    )),
                }),
            }
            push_node(&format!("{path}.body"), depth + 1, obj_get(o, "body"), out);
        }
        "binary" => {
            match obj_get(o, "op") {
                Some(Json::Str(s)) if binop_of_str(s).is_some() => {}
                Some(Json::Str(s)) => out.push(PathedFeedback {
                    path: format!("{path}.op"),
                    feedback: BonsaiFeedback::UnknownOp(s.clone()),
                }),
                _ => out.push(PathedFeedback {
                    path: format!("{path}.op"),
                    feedback: BonsaiFeedback::UnknownOp("null".to_string()),
                }),
            }
            push_node(&format!("{path}.left"), depth + 1, obj_get(o, "left"), out);
            push_node(
                &format!("{path}.right"),
                depth + 1,
                obj_get(o, "right"),
                out,
            );
        }
        "call" => {
            if !matches!(obj_get(o, "fn"), Some(Json::Str(_))) {
                out.push(PathedFeedback {
                    path: format!("{path}.fn"),
                    feedback: BonsaiFeedback::ExpectedString(format!("{path}.fn")),
                });
            }
            match obj_get(o, "args") {
                Some(Json::Arr(a)) => {
                    for (i, arg) in a.iter().enumerate() {
                        push_node(&format!("{path}.args[{i}]"), depth + 1, Some(arg), out);
                    }
                }
                _ => out.push(PathedFeedback {
                    path: format!("{path}.args"),
                    feedback: BonsaiFeedback::MalformedJson(format!("{path}.args is not an array")),
                }),
            }
        }
        "cond" => {
            push_node(&format!("{path}.test"), depth + 1, obj_get(o, "test"), out);
            push_node(&format!("{path}.then"), depth + 1, obj_get(o, "then"), out);
            push_node(&format!("{path}.else"), depth + 1, obj_get(o, "else"), out);
        }
        other => out.push(PathedFeedback {
            path: path.to_string(),
            feedback: BonsaiFeedback::UnknownKind(other.to_string()),
        }),
    }
}

/// Accumulate-mode parse: like [`parse`], but on failure returns **every** per-node decline
/// (each with its JSON-path) instead of just the first — the applicative complement for
/// batch / model-validation / debugging a malformed tree. On success returns the same
/// [`Expr`] as `parse` (the canonical-only contract still applies).
///
/// # Errors
/// Returns a non-empty [`Vec`] of [`PathedFeedback`] — every per-node decline, keyed by path.
pub fn parse_all(s: &str) -> Result<Expr, Vec<PathedFeedback>> {
    let json = match parse_json(s) {
        Ok(j) => j,
        Err(msg) => {
            return Err(vec![PathedFeedback {
                path: "$".to_string(),
                feedback: BonsaiFeedback::MalformedJson(msg),
            }]);
        }
    };
    let root = match &json {
        Json::Obj(o) => o,
        _ => {
            return Err(vec![PathedFeedback {
                path: "$".to_string(),
                feedback: BonsaiFeedback::MalformedJson("document is not an object".to_string()),
            }]);
        }
    };
    match obj_get(root, "v") {
        Some(Json::Int(n)) => {
            if *n != VERSION {
                return Err(vec![PathedFeedback {
                    path: "$.v".to_string(),
                    feedback: BonsaiFeedback::UnsupportedVersion {
                        found: *n,
                        expected: VERSION,
                    },
                }]);
            }
        }
        Some(Json::Float) => {
            return Err(vec![PathedFeedback {
                path: "$.v".to_string(),
                feedback: BonsaiFeedback::MalformedJson("document v is not an integer".to_string()),
            }]);
        }
        _ => {
            return Err(vec![PathedFeedback {
                path: "$.v".to_string(),
                feedback: BonsaiFeedback::MalformedJson("document v is not a number".to_string()),
            }]);
        }
    }
    let mut errs = Vec::new();
    push_node("$.expr", 1, obj_get(root, "expr"), &mut errs);
    if !errs.is_empty() {
        return Err(errs);
    }
    // Structurally valid → reuse the fail-fast parse for the Expr + canonical guard.
    parse(s).map_err(|f| {
        vec![PathedFeedback {
            path: "$".to_string(),
            feedback: f,
        }]
    })
}
