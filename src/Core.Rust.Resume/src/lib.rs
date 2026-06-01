//! Resume engine — the Rust ferry of the **resume-engine slice** (B-0976), the
//! self-evolving-saga kernel the serialized Bonsai expression-tree feeds. Where
//! [`zeta_core_bonsai`] is the *serializer* (the deferred computation's shape), this is the
//! *evaluator* that runs it with **restore-not-replay** durable execution. Ferry of the TS
//! reference (`src/Core.TypeScript/bonsai/resume.ts`); replays the shared `resume-golden.json`
//! saga traces — same suspension sequence + final value across oracles. "The compilers don't lie."
//!
//! Model: a small-step **CEK machine** over the Bonsai-subset [`Expr`]. `Call` nodes are
//! activities — the suspension points. Pure parts (`Const`/`Param`/`Binary`/`Cond`) evaluate
//! inline; at an activity the machine **suspends**, handing back a serializable [`SagaState`] =
//! the remaining continuation (the `kont` list) + the pending activity. [`resume`] **restores**
//! that continuation and feeds the result back as the call's value — it does NOT replay from the
//! top, so prior activities are never re-invoked.
//!
//! Slice-1 scope: `Const`/`Param`/`Binary`/`Cond`/`Call`. `Lambda` application is deferred
//! (slice-2) — a `Lambda` in evaluation position declines [`ResumeFeedback::UnsupportedNode`].
//!
//! Production is **zero external deps**: a minimal order-preserving JSON reader covers the
//! canonical state grammar (mirrors the reviewed `zeta_core_bonsai` reader); the kont list
//! matches the TS reference exactly (index 0 outermost, last = top-of-stack) so state bytes are
//! cross-oracle byte-identical.

use std::collections::BTreeMap;

use zeta_core_bonsai::{BinOp, ConstValue, Expr, parse as bonsai_parse, serialize as bonsai_serialize};

/// The resume-state serialization version (the `v` field of the persisted wrapper).
pub const RESUME_VERSION: i64 = 1;

// The shared JS-safe-integer bounds (2^53 - 1): the int wire domain (matches bonsai).
const MAX_SAFE_INT: i64 = 9_007_199_254_740_991;
const MIN_SAFE_INT: i64 = -9_007_199_254_740_991;

// JSON tokenizer depth ceiling for restore: a persisted state embeds bonsai-serialized Exprs
// inline (up to bonsai's MAX_DEPTH = 1024 deep) wrapped in a few state levels; allow generous
// headroom above the worst case.
const STATE_DEPTH_CEILING: usize = 1024 * 4;

/// An environment: parameter name → bound value (the saga's captured bindings). A `BTreeMap`
/// so canonical serialization iterates keys in sorted order (matching the TS reference's
/// `Object.keys().sort()` for the ASCII parameter names in the contract).
pub type Env = BTreeMap<String, ConstValue>;

/// The typed reasons the evaluator declines — the shared cross-oracle payload contract
/// (variant-for-variant parity with the TS/F#/C# oracles).
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum ResumeFeedback {
    /// A parameter reference had no binding in the environment.
    Unbound(String),
    /// A value was the wrong runtime type for the operation.
    TypeMismatch {
        /// The site of the mismatch.
        at: String,
        /// The expected type tag.
        expected: String,
    },
    /// A node kind outside the slice-1 evaluable subset (e.g. a `Lambda`) was reached.
    UnsupportedNode(String),
    /// An int operation/value left the shared JS-safe-integer wire domain.
    NonSafeInt(i64),
    /// A persisted state was malformed (bad JSON, unsupported version, tampered op, unsafe int,
    /// or a structural shape violation).
    MalformedState(String),
}

/// A defunctionalized continuation frame — one pending operation waiting on a sub-result, with
/// exactly the environment + expression it still needs (the serialized closure). The `kont`
/// list of these IS the suspended computation.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Frame {
    /// Computed the left operand; next evaluate `right` (in `env`), then apply `op`.
    EvalRight {
        /// The operator.
        op: BinOp,
        /// The right operand expression.
        right: Expr,
        /// The captured environment.
        env: Env,
    },
    /// Computed both operands; apply `op` to (`left`, the returning value).
    ApplyOp {
        /// The operator.
        op: BinOp,
        /// The already-computed left operand.
        left: ConstValue,
    },
    /// Computed the test; pick `then`/`els` (in `env`) by its truthiness.
    Branch {
        /// The then-branch.
        then: Expr,
        /// The else-branch.
        els: Expr,
        /// The captured environment.
        env: Env,
    },
    /// Evaluating an activity's args left-to-right: `pending` remain, `done` are computed.
    EvalArgs {
        /// The activity (named function).
        fn_name: String,
        /// The argument expressions still to evaluate.
        pending: Vec<Expr>,
        /// The already-computed argument values.
        done: Vec<ConstValue>,
        /// The captured environment.
        env: Env,
    },
}

/// The activity a suspended saga is awaiting — its result feeds back as the awaited call's value.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Activity {
    /// The activity (named function) being invoked.
    pub fn_name: String,
    /// The fully-evaluated arguments.
    pub args: Vec<ConstValue>,
}

/// The persisted, resumable state of a suspended saga: the continuation + the pending activity.
/// `kont` matches the TS reference exactly (index 0 outermost, last = top-of-stack).
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct SagaState {
    /// The continuation (work stack), outermost-first; resume restores this.
    pub kont: Vec<Frame>,
    /// The activity the saga is awaiting.
    pub awaiting: Activity,
}

/// The outcome of a step: either the saga finished, or it suspended awaiting an activity.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum SagaStep {
    /// The saga finished with a value.
    Done(ConstValue),
    /// The saga suspended; resume with the activity's result.
    Suspended {
        /// The persisted state to resume from.
        state: SagaState,
        /// The activity awaited (a copy of `state.awaiting`).
        activity: Activity,
    },
}

// ---- pure operators (the saga's inline semantics) -------------------------

fn as_int(v: &ConstValue, at: &str) -> Result<i64, ResumeFeedback> {
    match v {
        ConstValue::Int(i) => Ok(*i),
        _ => Err(ResumeFeedback::TypeMismatch { at: at.to_string(), expected: "int".to_string() }),
    }
}

fn as_bool(v: &ConstValue, at: &str) -> Result<bool, ResumeFeedback> {
    match v {
        ConstValue::Bool(b) => Ok(*b),
        _ => Err(ResumeFeedback::TypeMismatch { at: at.to_string(), expected: "bool".to_string() }),
    }
}

// Build an int ConstValue from a wide (overflow-free) i128 result, declining if it left the
// shared JS-safe-integer domain. The arithmetic is done in i128 FIRST: a safe-int * safe-int
// product (<= ~8.1e31) overflows i64 (Rust debug-panics; release silently wraps to a wrong
// in-range value), so range-check the i128 then narrow. (The TS reference is immune: JS floats
// lose precision but Number.isSafeInteger still catches them.)
fn to_safe(p: i128) -> Result<ConstValue, ResumeFeedback> {
    if (i128::from(MIN_SAFE_INT)..=i128::from(MAX_SAFE_INT)).contains(&p) {
        return Ok(ConstValue::Int(p as i64));
    }
    let v = if p > i128::from(i64::MAX) {
        i64::MAX
    } else if p < i128::from(i64::MIN) {
        i64::MIN
    } else {
        p as i64
    };
    Err(ResumeFeedback::NonSafeInt(v))
}

fn apply_binop(op: BinOp, left: &ConstValue, right: &ConstValue) -> Result<ConstValue, ResumeFeedback> {
    match op {
        BinOp::Add => to_safe(i128::from(as_int(left, "add.left")?) + i128::from(as_int(right, "add.right")?)),
        BinOp::Sub => to_safe(i128::from(as_int(left, "sub.left")?) - i128::from(as_int(right, "sub.right")?)),
        BinOp::Mul => to_safe(i128::from(as_int(left, "mul.left")?) * i128::from(as_int(right, "mul.right")?)),
        // ConstValue derives PartialEq -> structural equality is exactly constEq
        BinOp::Eq => Ok(ConstValue::Bool(left == right)),
        BinOp::Lt => Ok(ConstValue::Bool(as_int(left, "lt.left")? < as_int(right, "lt.right")?)),
        BinOp::And => Ok(ConstValue::Bool(as_bool(left, "and.left")? && as_bool(right, "and.right")?)),
        BinOp::Or => Ok(ConstValue::Bool(as_bool(left, "or.left")? || as_bool(right, "or.right")?)),
    }
}

// ---- the CEK machine ------------------------------------------------------

enum Control {
    Eval { node: Expr, env: Env },
    Ret(ConstValue),
}

fn run(control: Control, kont: Vec<Frame>) -> Result<SagaStep, ResumeFeedback> {
    let mut ctrl = control;
    let mut stack = kont;
    loop {
        match ctrl {
            Control::Eval { node, env } => match node {
                Expr::Const(v) => ctrl = Control::Ret(v),
                Expr::Param(name) => match env.get(&name) {
                    Some(v) => ctrl = Control::Ret(v.clone()),
                    None => return Err(ResumeFeedback::Unbound(name)),
                },
                Expr::Binary { op, left, right } => {
                    stack.push(Frame::EvalRight { op, right: *right, env: env.clone() });
                    ctrl = Control::Eval { node: *left, env };
                }
                Expr::Cond { test, then, els } => {
                    stack.push(Frame::Branch { then: *then, els: *els, env: env.clone() });
                    ctrl = Control::Eval { node: *test, env };
                }
                Expr::Call { fn_name, args } => {
                    if args.is_empty() {
                        let act = Activity { fn_name, args: Vec::new() };
                        return Ok(SagaStep::Suspended { state: SagaState { kont: stack, awaiting: act.clone() }, activity: act });
                    }
                    let mut it = args.into_iter();
                    let first = it.next().expect("args is non-empty");
                    let pending: Vec<Expr> = it.collect();
                    stack.push(Frame::EvalArgs { fn_name, pending, done: Vec::new(), env: env.clone() });
                    ctrl = Control::Eval { node: first, env };
                }
                Expr::Lambda { .. } => return Err(ResumeFeedback::UnsupportedNode("lambda".to_string())),
            },
            Control::Ret(value) => match stack.pop() {
                None => return Ok(SagaStep::Done(value)),
                Some(Frame::EvalRight { op, right, env }) => {
                    stack.push(Frame::ApplyOp { op, left: value });
                    ctrl = Control::Eval { node: right, env };
                }
                Some(Frame::ApplyOp { op, left }) => {
                    ctrl = Control::Ret(apply_binop(op, &left, &value)?);
                }
                Some(Frame::Branch { then, els, env }) => {
                    let t = as_bool(&value, "cond.test")?;
                    ctrl = Control::Eval { node: if t { then } else { els }, env };
                }
                Some(Frame::EvalArgs { fn_name, pending, mut done, env }) => {
                    done.push(value);
                    if pending.is_empty() {
                        let act = Activity { fn_name, args: done };
                        return Ok(SagaStep::Suspended { state: SagaState { kont: stack, awaiting: act.clone() }, activity: act });
                    }
                    let mut it = pending.into_iter();
                    let next = it.next().expect("pending is non-empty");
                    let rest: Vec<Expr> = it.collect();
                    stack.push(Frame::EvalArgs { fn_name, pending: rest, done, env: env.clone() });
                    ctrl = Control::Eval { node: next, env };
                }
            },
        }
    }
}

/// Start a saga: evaluate `program` (with initial `bindings`) until it finishes or suspends at
/// its first activity.
///
/// # Errors
/// Declines [`ResumeFeedback`] on an unbound param, type mismatch, unsupported node, or an
/// arithmetic result outside the safe-int domain.
pub fn start(program: &Expr, bindings: &Env) -> Result<SagaStep, ResumeFeedback> {
    run(Control::Eval { node: program.clone(), env: bindings.clone() }, Vec::new())
}

/// Resume a suspended saga: feed `activity_result` back as the awaited call's value and continue
/// the restored continuation (no replay — prior activities are not re-invoked).
///
/// # Errors
/// Declines [`ResumeFeedback`] on the same conditions as [`start`].
pub fn resume(state: SagaState, activity_result: ConstValue) -> Result<SagaStep, ResumeFeedback> {
    run(Control::Ret(activity_result), state.kont)
}

// ---- state serialization (persist a suspension; round-trips) --------------

/// JSON-escape a string byte-for-byte like JS `JSON.stringify` (and the bonsai escaper): escape
/// `"`, `\`, and control chars; emit every other scalar literally (Rust strings are valid UTF-8,
/// so an astral char emits as its literal bytes, exactly as the UTF-16 oracles emit a pair).
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

fn check_safe(v: i64) -> Result<(), ResumeFeedback> {
    if !(MIN_SAFE_INT..=MAX_SAFE_INT).contains(&v) {
        return Err(ResumeFeedback::NonSafeInt(v));
    }
    Ok(())
}

fn emit_const(c: &ConstValue) -> Result<String, ResumeFeedback> {
    Ok(match c {
        ConstValue::Int(v) => {
            check_safe(*v)?;
            format!("{{\"t\":\"int\",\"v\":{v}}}")
        }
        ConstValue::Str(s) => format!("{{\"t\":\"str\",\"v\":{}}}", jstr(s)),
        ConstValue::Bool(b) => format!("{{\"t\":\"bool\",\"v\":{b}}}"),
        ConstValue::Null => "{\"t\":\"null\"}".to_string(),
    })
}

fn op_str(op: BinOp) -> &'static str {
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

fn op_of_str(s: &str) -> Option<BinOp> {
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

fn emit_expr(e: &Expr) -> Result<String, ResumeFeedback> {
    bonsai_serialize(e).map_err(|f| ResumeFeedback::MalformedState(format!("expr: {f:?}")))
}

fn emit_env(env: &Env) -> Result<String, ResumeFeedback> {
    let mut parts = Vec::with_capacity(env.len());
    for (k, v) in env {
        parts.push(format!("{}:{}", jstr(k), emit_const(v)?));
    }
    Ok(format!("{{{}}}", parts.join(",")))
}

fn emit_frame(f: &Frame) -> Result<String, ResumeFeedback> {
    Ok(match f {
        Frame::EvalRight { op, right, env } => format!(
            "{{\"k\":\"evalRight\",\"op\":{},\"right\":{},\"env\":{}}}",
            jstr(op_str(*op)),
            emit_expr(right)?,
            emit_env(env)?
        ),
        Frame::ApplyOp { op, left } => {
            format!("{{\"k\":\"applyOp\",\"op\":{},\"left\":{}}}", jstr(op_str(*op)), emit_const(left)?)
        }
        Frame::Branch { then, els, env } => format!(
            "{{\"k\":\"branch\",\"then\":{},\"els\":{},\"env\":{}}}",
            emit_expr(then)?,
            emit_expr(els)?,
            emit_env(env)?
        ),
        Frame::EvalArgs { fn_name, pending, done, env } => {
            let mut pend = Vec::with_capacity(pending.len());
            for p in pending {
                pend.push(emit_expr(p)?);
            }
            let mut dn = Vec::with_capacity(done.len());
            for d in done {
                dn.push(emit_const(d)?);
            }
            format!(
                "{{\"k\":\"evalArgs\",\"fn\":{},\"pending\":[{}],\"done\":[{}],\"env\":{}}}",
                jstr(fn_name),
                pend.join(","),
                dn.join(","),
                emit_env(env)?
            )
        }
    })
}

/// Serialize a suspended [`SagaState`] to a canonical string for persistence (round-trips
/// through [`parse_state`]).
///
/// # Errors
/// Declines [`ResumeFeedback::NonSafeInt`] if a value left the safe-int domain, or
/// [`ResumeFeedback::MalformedState`] if an embedded expression failed to serialize.
pub fn serialize_state(state: &SagaState) -> Result<String, ResumeFeedback> {
    let mut kont = Vec::with_capacity(state.kont.len());
    for f in &state.kont {
        kont.push(emit_frame(f)?);
    }
    let mut args = Vec::with_capacity(state.awaiting.args.len());
    for a in &state.awaiting.args {
        args.push(emit_const(a)?);
    }
    Ok(format!(
        "{{\"v\":{},\"kont\":[{}],\"awaiting\":{{\"fn\":{},\"args\":[{}]}}}}",
        RESUME_VERSION,
        kont.join(","),
        jstr(&state.awaiting.fn_name),
        args.join(",")
    ))
}

// ---- minimal order-preserving JSON value + reader (zero-dep) ---------------

// Mirrors the reviewed reader in `zeta_core_bonsai` (strict RFC-8259 number grammar, rejects
// raw control chars + lone surrogates + trailing input). Objects preserve key insertion order
// (Vec, not a map) so `json_to_canonical` reproduces the source's canonical byte form, letting
// embedded exprs round-trip through `bonsai_parse`.
enum Json {
    Null,
    Bool(bool),
    Int(i64),
    /// A fractional / out-of-i64 number — carries its raw text so re-emission is lossless (and
    /// `bonsai_parse` then declines it as a non-int, error-for-error with the other oracles).
    Float(String),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
}

struct Reader {
    chars: Vec<char>,
    pos: usize,
}

impl Reader {
    fn new(s: &str) -> Self {
        Reader { chars: s.chars().collect(), pos: 0 }
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

    fn value(&mut self, depth: usize) -> Result<Json, String> {
        if depth > STATE_DEPTH_CEILING {
            return Err("nesting too deep".to_string());
        }
        self.skip_ws();
        match self.peek() {
            Some('{') => self.object(depth),
            Some('[') => self.array(depth),
            Some('"') => Ok(Json::Str(self.string()?)),
            Some('t' | 'f') => self.boolean(),
            Some('n') => {
                self.keyword("null")?;
                Ok(Json::Null)
            }
            Some(c) if c == '-' || c.is_ascii_digit() => self.number(),
            Some(c) => Err(format!("unexpected character '{c}'")),
            None => Err("unexpected end of input".to_string()),
        }
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
        let start = self.pos;
        if self.peek() == Some('-') {
            self.pos += 1;
        }
        match self.peek() {
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
        if matches!(self.peek(), Some('e' | 'E')) {
            is_float = true;
            self.pos += 1;
            if matches!(self.peek(), Some('+' | '-')) {
                self.pos += 1;
            }
            if !self.digits() {
                return Err("invalid number (digits expected in exponent)".to_string());
            }
        }
        let raw: String = self.chars[start..self.pos].iter().collect();
        if is_float {
            return Ok(Json::Float(raw));
        }
        match raw.parse::<i64>() {
            Ok(n) => Ok(Json::Int(n)),
            Err(_) => Ok(Json::Float(raw)),
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
        let c = self.peek().ok_or_else(|| "invalid escape".to_string())?;
        self.pos += 1;
        match c {
            '"' => Ok('"'),
            '\\' => Ok('\\'),
            '/' => Ok('/'),
            'b' => Ok('\u{8}'),
            'f' => Ok('\u{c}'),
            'n' => Ok('\n'),
            'r' => Ok('\r'),
            't' => Ok('\t'),
            'u' => self.unicode_escape(),
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
            if self.peek() == Some('\\') {
                self.pos += 1;
                self.expect('u')?;
                let lo = self.hex4()?;
                if (0xDC00..=0xDFFF).contains(&lo) {
                    let cp = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00);
                    return char::from_u32(cp).ok_or_else(|| "invalid surrogate pair".to_string());
                }
            }
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
                Some(',') => self.pos += 1,
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
                Some(',') => self.pos += 1,
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

// Re-serialize a parsed Json subtree to canonical compact bytes. Because the source was the
// canonical state (key order preserved, no whitespace) this reproduces the embedded expr's
// exact bonsai bytes, so `bonsai_parse` accepts it (its canonical-only check passes).
fn json_to_canonical(j: &Json) -> String {
    match j {
        Json::Null => "null".to_string(),
        Json::Bool(b) => b.to_string(),
        Json::Int(n) => n.to_string(),
        Json::Float(raw) => raw.clone(),
        Json::Str(s) => jstr(s),
        Json::Arr(a) => format!("[{}]", a.iter().map(json_to_canonical).collect::<Vec<_>>().join(",")),
        Json::Obj(o) => format!(
            "{{{}}}",
            o.iter().map(|(k, v)| format!("{}:{}", jstr(k), json_to_canonical(v))).collect::<Vec<_>>().join(",")
        ),
    }
}

// ---- state parsing (restore a persisted suspension) -----------------------

fn bad(m: String) -> ResumeFeedback {
    ResumeFeedback::MalformedState(m)
}

fn as_obj<'a>(j: &'a Json, at: &str) -> Result<&'a [(String, Json)], ResumeFeedback> {
    match j {
        Json::Obj(o) => Ok(o),
        _ => Err(bad(format!("{at} is not an object"))),
    }
}

fn get<'a>(o: &'a [(String, Json)], k: &str) -> Option<&'a Json> {
    o.iter().find(|(key, _)| key == k).map(|(_, v)| v)
}

fn req<'a>(o: &'a [(String, Json)], k: &str, at: &str) -> Result<&'a Json, ResumeFeedback> {
    get(o, k).ok_or_else(|| bad(format!("{at} missing")))
}

fn read_const(j: &Json, at: &str) -> Result<ConstValue, ResumeFeedback> {
    let o = as_obj(j, at)?;
    let tag = match get(o, "t") {
        Some(Json::Str(s)) => s.as_str(),
        _ => return Err(bad(format!("{at}.t"))),
    };
    match tag {
        "int" => match get(o, "v") {
            Some(Json::Int(n)) if (MIN_SAFE_INT..=MAX_SAFE_INT).contains(n) => Ok(ConstValue::Int(*n)),
            _ => Err(bad(format!("{at} int value"))),
        },
        "str" => match get(o, "v") {
            Some(Json::Str(s)) => Ok(ConstValue::Str(s.clone())),
            _ => Err(bad(format!("{at} str value"))),
        },
        "bool" => match get(o, "v") {
            Some(Json::Bool(b)) => Ok(ConstValue::Bool(*b)),
            _ => Err(bad(format!("{at} bool value"))),
        },
        "null" => Ok(ConstValue::Null),
        _ => Err(bad(format!("{at} unknown const tag"))),
    }
}

fn read_binop(o: &[(String, Json)], k: &str, at: &str) -> Result<BinOp, ResumeFeedback> {
    match get(o, k) {
        Some(Json::Str(s)) => op_of_str(s).ok_or_else(|| bad(format!("{at} unknown operator"))),
        _ => Err(bad(format!("{at} unknown operator"))),
    }
}

fn read_env(j: &Json, at: &str) -> Result<Env, ResumeFeedback> {
    let o = as_obj(j, at)?;
    let mut env = Env::new();
    for (k, v) in o {
        env.insert(k.clone(), read_const(v, &format!("{at}.{k}"))?);
    }
    Ok(env)
}

fn read_expr(j: &Json, at: &str) -> Result<Expr, ResumeFeedback> {
    bonsai_parse(&json_to_canonical(j)).map_err(|f| bad(format!("{at} expr: {f:?}")))
}

fn read_eval_args(o: &[(String, Json)]) -> Result<Frame, ResumeFeedback> {
    let fn_name = match get(o, "fn") {
        Some(Json::Str(s)) => s.clone(),
        _ => return Err(bad("evalArgs.fn".to_string())),
    };
    let pending = match req(o, "pending", "evalArgs.pending")? {
        Json::Arr(a) => a,
        _ => return Err(bad("evalArgs.pending is not an array".to_string())),
    };
    let done = match req(o, "done", "evalArgs.done")? {
        Json::Arr(a) => a,
        _ => return Err(bad("evalArgs.done is not an array".to_string())),
    };
    let mut p = Vec::with_capacity(pending.len());
    for (i, e) in pending.iter().enumerate() {
        p.push(read_expr(e, &format!("evalArgs.pending[{i}]"))?);
    }
    let mut d = Vec::with_capacity(done.len());
    for (i, c) in done.iter().enumerate() {
        d.push(read_const(c, &format!("evalArgs.done[{i}]"))?);
    }
    Ok(Frame::EvalArgs { fn_name, pending: p, done: d, env: read_env(req(o, "env", "evalArgs.env")?, "evalArgs.env")? })
}

fn read_frame(j: &Json) -> Result<Frame, ResumeFeedback> {
    let o = as_obj(j, "frame")?;
    let kind = match get(o, "k") {
        Some(Json::Str(s)) => s.as_str(),
        _ => return Err(bad("frame is not an object".to_string())),
    };
    match kind {
        "evalRight" => Ok(Frame::EvalRight {
            op: read_binop(o, "op", "evalRight.op")?,
            right: read_expr(req(o, "right", "evalRight.right")?, "evalRight.right")?,
            env: read_env(req(o, "env", "evalRight.env")?, "evalRight.env")?,
        }),
        "applyOp" => Ok(Frame::ApplyOp {
            op: read_binop(o, "op", "applyOp.op")?,
            left: read_const(req(o, "left", "applyOp.left")?, "applyOp.left")?,
        }),
        "branch" => Ok(Frame::Branch {
            then: read_expr(req(o, "then", "branch.then")?, "branch.then")?,
            els: read_expr(req(o, "els", "branch.els")?, "branch.els")?,
            env: read_env(req(o, "env", "branch.env")?, "branch.env")?,
        }),
        "evalArgs" => read_eval_args(o),
        _ => Err(bad("unknown frame kind".to_string())),
    }
}

/// Parse a persisted state string back to a [`SagaState`] (the inverse of [`serialize_state`]).
///
/// # Errors
/// Declines [`ResumeFeedback::MalformedState`] on malformed JSON, an unsupported version, a
/// tampered operator, an unsafe int, or any structural shape violation.
pub fn parse_state(s: &str) -> Result<SagaState, ResumeFeedback> {
    let j = parse_json(s).map_err(bad)?;
    let o = as_obj(&j, "state")?;
    match get(o, "v") {
        Some(Json::Int(n)) if *n == RESUME_VERSION => {}
        _ => return Err(bad("unsupported state version".to_string())),
    }
    let kont_j = match req(o, "kont", "kont")? {
        Json::Arr(a) => a,
        _ => return Err(bad("kont is not an array".to_string())),
    };
    let mut kont = Vec::with_capacity(kont_j.len());
    for f in kont_j {
        kont.push(read_frame(f)?);
    }
    let aw = as_obj(req(o, "awaiting", "awaiting")?, "awaiting")?;
    let fn_name = match get(aw, "fn") {
        Some(Json::Str(s)) => s.clone(),
        _ => return Err(bad("awaiting.fn".to_string())),
    };
    let args_j = match req(aw, "args", "awaiting.args")? {
        Json::Arr(a) => a,
        _ => return Err(bad("awaiting.args is not an array".to_string())),
    };
    let mut args = Vec::with_capacity(args_j.len());
    for (i, a) in args_j.iter().enumerate() {
        args.push(read_const(a, &format!("awaiting.args[{i}]"))?);
    }
    Ok(SagaState { kont, awaiting: Activity { fn_name, args } })
}
