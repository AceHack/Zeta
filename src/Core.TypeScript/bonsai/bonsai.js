/**
 * bonsai.ts — TS reference (oracle #1) for the **Bonsai-subset** expression-tree
 * serializer (081KT07NV0008QG0R003BE6MJ2 slice 1), the cross-language serialization primitive the
 * self-evolving-saga build needs ("serialize the deferred computation's
 * expression tree").
 *
 * Named after Nuqleon **Bonsai** (Reaqtor's compact serializer for .NET
 * expression trees). This is the **weakly-typed / reflection-info-omitted**
 * mode — the cross-language-portable form (the same mode Bonsai uses when its
 * trees are deserialized in native C++ or eval'd in JavaScript): kind-tagged
 * nodes, no .NET type/assembly/member table. The full Nuqleon Bonsai stays the
 * conformance oracle for the .NET-typed mode; this subset is what the
 * TS/F#/C#/Rust oracles agree on byte-for-byte.
 *
 * The node set (the subset): `const` · `param` · `lambda` · `binary` · `call` ·
 * `cond`. Enough to express a real deferred computation (e.g. a recursive
 * factorial), small enough to cross-verify exactly.
 *
 * Canonical form (the cross-oracle byte-diff contract): `serialize` emits
 * **compact JSON** (no whitespace) with a **fixed key order per node-kind**
 * (`kind` first, then fields in declared order) and **integer-only** numeric
 * literals in the shared JS-safe-integer range (no floats — float formatting
 * diverges across languages). Two oracles agree iff their `serialize` outputs are
 * byte-identical, and `parse` round-trips (`serialize(parse(s))` is `Ok s`). String
 * values use standard JSON escaping. Document wrapper: `{"v":1,"expr":<node>}`.
 *
 * Error channel (matches the F# oracle): `serialize`/`parse` return
 * `Result<_, BonsaiFeedback>` — no exceptions cross the boundary (result over
 * throw). TS owns a minimal zero-dep `Result` port (no BCL Result in JS); a
 * consumer wanting the ecosystem shape can adapt it to neverthrow at the seam.
 * `BonsaiFeedback` is the shared cross-oracle payload (the `'TError`/`E` in the
 * F#/Rust native `Result`). Per the contract-vs-mechanism split, the internals use
 * an internal typed signal adapted to `Result` at the two boundaries. Fail-fast
 * (monadic); the accumulate-mode (RFC-9457 ProblemDetails) is the complementary
 * primitive for batch/validation, per 081KT07NV0008QG0R003BE6MJ2.
 */
/** The serialization format version (the `v` field of the document wrapper). */
export const BONSAI_VERSION = 1;
/**
 * The shared v1 maximum expression nesting depth. Bounds the recursive
 * serializer/parser (a stack-overflow / DoS guard) and is the cross-oracle depth
 * contract, so a tree that round-trips in one oracle round-trips in every oracle.
 */
export const BONSAI_MAX_DEPTH = 1024;
const ok = (value) => ({ ok: true, value });
const err = (error) => ({ ok: false, error });
/**
 * Internal typed signal — the validation helpers throw this on a decline;
 * serialize/parse catch it at the boundary and return `Error`. The wire contract
 * stays `Result` (the TS internal mechanism; contract-vs-mechanism split).
 */
class BonsaiFail extends Error {
    feedback;
    constructor(feedback) {
        super(feedback.kind);
        this.name = "BonsaiFail";
        this.feedback = feedback;
    }
}
// ---- validation helpers (parse + emit are the conformance surfaces) ---------
/** The valid binary operators, as a set for O(1) membership validation. */
const BIN_OPS = new Set(["add", "sub", "mul", "eq", "lt", "and", "or"]);
/**
 * Validate a value is a JS-**safe** integer — the v1 `int` domain. A fractional /
 * NaN / Infinity / non-number declines `ExpectedInt`; an integer beyond 2^53-1
 * declines `NonSafeInt` (a value a peer oracle could not preserve) — never
 * silently rounded or truncated.
 */
function asSafeInt(v, where) {
    if (typeof v !== "number" || !Number.isInteger(v))
        throw new BonsaiFail({ kind: "ExpectedInt", where });
    if (!Number.isSafeInteger(v))
        throw new BonsaiFail({ kind: "NonSafeInt", value: v });
    return v;
}
/** Validate a value is a non-null, non-array object. */
function asObject(v, where) {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
        const got = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
        throw new BonsaiFail({ kind: "MalformedJson", message: `${where} expects an object, got ${got}` });
    }
    return v;
}
/** Validate a value is a string. */
function asString(v, where) {
    if (typeof v !== "string")
        throw new BonsaiFail({ kind: "ExpectedString", where });
    return v;
}
/** Validate a value is an array. */
function asArray(v, where) {
    if (!Array.isArray(v))
        throw new BonsaiFail({ kind: "MalformedJson", message: `${where} expects an array, got ${typeof v}` });
    return v;
}
/** Validate a value is one of the known binary operators. */
function asBinOp(v, where) {
    const s = asString(v, where);
    if (!BIN_OPS.has(s))
        throw new BonsaiFail({ kind: "UnknownOp", op: s });
    return s;
}
// ---- constructors (ergonomic builders; total — validation is at the boundary)
/** A literal-int constant. (Total; an unsafe/fractional int declines at `serialize`.) */
export const cint = (v) => ({ kind: "const", value: { t: "int", v } });
/** A literal-string constant. */
export const cstr = (v) => ({ kind: "const", value: { t: "str", v } });
/** A literal-bool constant. */
export const cbool = (v) => ({ kind: "const", value: { t: "bool", v } });
/** The null constant. */
export const cnull = () => ({ kind: "const", value: { t: "null" } });
/** A parameter (variable) reference. */
export const param = (name) => ({ kind: "param", name });
/** A lambda abstraction. */
export const lambda = (params, body) => ({ kind: "lambda", params, body });
/** A binary operation. */
export const binary = (op, left, right) => ({ kind: "binary", op, left, right });
/** A named function application. */
export const call = (fn, args) => ({ kind: "call", fn, args });
/** A conditional (`if test then then else else`). */
export const cond = (test, then, els) => ({ kind: "cond", test, then, else: els });
// ---- serialize (canonical, byte-exact) ------------------------------------
/** JSON-escape a string field, declining `ExpectedString` on a non-string (e.g.
 * a CLR/JS `null` slipped past the types) so serialize stays total. */
function jstr(v, where) {
    if (typeof v !== "string")
        throw new BonsaiFail({ kind: "ExpectedString", where });
    return JSON.stringify(v);
}
/** Emit a constant value in canonical compact form (`t` first, then `v`). */
function emitConst(c) {
    switch (c.t) {
        case "int":
            // Safe integers always stringify to plain digits (no exponent), so the
            // emitted bytes are reproducible across oracles; decline anything else.
            return `{"t":"int","v":${asSafeInt(c.v, "const int value")}}`;
        case "str":
            return `{"t":"str","v":${jstr(c.v, "const str value")}}`;
        case "bool":
            // Validate the runtime type (an untyped JS caller could pass a truthy
            // non-boolean); decline ExpectedBool so serialize agrees with parse.
            if (typeof c.v !== "boolean")
                throw new BonsaiFail({ kind: "ExpectedBool", where: "const bool value" });
            return `{"t":"bool","v":${c.v ? "true" : "false"}}`;
        case "null":
            return `{"t":"null"}`;
    }
}
/** Emit a node in canonical compact form (fixed key order per kind); declines
 * `TooDeep` past the shared MaxDepth so serialize never emits a tree the parser
 * could not read back, and recursion is bounded. */
function emitAt(depth, e) {
    if (depth > BONSAI_MAX_DEPTH)
        throw new BonsaiFail({ kind: "TooDeep", limit: BONSAI_MAX_DEPTH });
    switch (e.kind) {
        case "const":
            return `{"kind":"const","value":${emitConst(e.value)}}`;
        case "param":
            return `{"kind":"param","name":${jstr(e.name, "param.name")}}`;
        case "lambda":
            return `{"kind":"lambda","params":[${e.params.map((p) => jstr(p, "lambda.params[]")).join(",")}],"body":${emitAt(depth + 1, e.body)}}`;
        case "binary": {
            // Validate the operator at the boundary the same way parse does (an untyped
            // JS caller could cast an invalid op); decline UnknownOp rather than emit
            // bytes a peer oracle would reject.
            if (!BIN_OPS.has(e.op))
                throw new BonsaiFail({ kind: "UnknownOp", op: String(e.op) });
            return `{"kind":"binary","op":${JSON.stringify(e.op)},"left":${emitAt(depth + 1, e.left)},"right":${emitAt(depth + 1, e.right)}}`;
        }
        case "call":
            return `{"kind":"call","fn":${jstr(e.fn, "call.fn")},"args":[${e.args.map((a) => emitAt(depth + 1, a)).join(",")}]}`;
        case "cond":
            return `{"kind":"cond","test":${emitAt(depth + 1, e.test)},"then":${emitAt(depth + 1, e.then)},"else":${emitAt(depth + 1, e.else)}}`;
    }
}
/** Serialize an expression to the canonical Bonsai-subset string. Declines on an
 * unsafe/fractional integer literal, a null string field, or nesting past MaxDepth. */
export function serialize(e) {
    try {
        return ok(`{"v":${BONSAI_VERSION},"expr":${emitAt(1, e)}}`);
    }
    catch (ex) {
        if (ex instanceof BonsaiFail)
            return err(ex.feedback);
        throw ex;
    }
}
// ---- parse (canonical string -> Expr) -------------------------------------
/** Rebuild a `ConstValue` from parsed JSON — strict (validates tag + value type). */
function parseConst(n) {
    const o = asObject(n, "const value");
    switch (o.t) {
        case "int":
            return { t: "int", v: asSafeInt(o.v, "const int value") };
        case "str":
            return { t: "str", v: asString(o.v, "const str value") };
        case "bool":
            if (typeof o.v !== "boolean")
                throw new BonsaiFail({ kind: "ExpectedBool", where: "const bool value" });
            return { t: "bool", v: o.v };
        case "null":
            return { t: "null" };
        default:
            throw new BonsaiFail({ kind: "UnknownConstTag", tag: String(o.t) });
    }
}
/** Rebuild an `Expr` from parsed JSON — strict (validates shape, kind, fields).
 * Carries a depth counter so a deeply-nested input declines `TooDeep` *during*
 * parsing — bounding recursion (no stack-overflow / RangeError escaping the
 * Result) rather than relying only on the after-the-fact serialize guard.
 * (F#'s parseNode is bounded by its JsonDocument MaxDepth; JS's JSON.parse has no
 * such bound, so the counter must be explicit here.) */
function parseNode(depth, n) {
    if (depth > BONSAI_MAX_DEPTH)
        throw new BonsaiFail({ kind: "TooDeep", limit: BONSAI_MAX_DEPTH });
    const o = asObject(n, "node");
    const kind = asString(o.kind, "node.kind");
    switch (kind) {
        case "const":
            return { kind: "const", value: parseConst(o.value) };
        case "param":
            return { kind: "param", name: asString(o.name, "param.name") };
        case "lambda":
            return {
                kind: "lambda",
                params: asArray(o.params, "lambda.params").map((p) => asString(p, "lambda.params[]")),
                body: parseNode(depth + 1, o.body),
            };
        case "binary":
            return {
                kind: "binary",
                op: asBinOp(o.op, "binary.op"),
                left: parseNode(depth + 1, o.left),
                right: parseNode(depth + 1, o.right),
            };
        case "call":
            return { kind: "call", fn: asString(o.fn, "call.fn"), args: asArray(o.args, "call.args").map((a) => parseNode(depth + 1, a)) };
        case "cond":
            return {
                kind: "cond",
                test: parseNode(depth + 1, o.test),
                then: parseNode(depth + 1, o.then),
                else: parseNode(depth + 1, o.else),
            };
        default:
            throw new BonsaiFail({ kind: "UnknownKind", nodeKind: kind });
    }
}
/**
 * Parse a canonical Bonsai-subset string back to an `Expr` — strict and
 * **canonical-only**. Accepts the canonical byte form ONLY: a structurally-valid
 * but non-canonical vector (extra fields, whitespace, reordered keys) declines
 * `NonCanonical` rather than silently canonicalizing — enforcing the
 * `serialize(parse(s)) === Ok s` fixed point so the oracles agree on which input is
 * valid. Returns `Result` — no exception crosses the boundary, even on `null` input
 * or malformed JSON.
 */
export function parse(s) {
    if (typeof s !== "string")
        return err({ kind: "MalformedJson", message: "input was not a string" });
    let doc;
    try {
        doc = JSON.parse(s);
    }
    catch (ex) {
        return err({ kind: "MalformedJson", message: ex instanceof Error ? ex.message : String(ex) });
    }
    try {
        const d = asObject(doc, "document");
        if (typeof d.v !== "number")
            return err({ kind: "MalformedJson", message: "document v is not a number" });
        if (d.v !== BONSAI_VERSION)
            return err({ kind: "UnsupportedVersion", found: d.v, expected: BONSAI_VERSION });
        const result = parseNode(1, d.expr);
        // Canonical-only guard: the round-trip must reproduce the input byte-for-byte
        // (serialize also re-checks depth + safe-int, so an over-deep input declines here).
        const round = serialize(result);
        if (!round.ok)
            return round;
        if (round.value !== s)
            return err({ kind: "NonCanonical" });
        return ok(result);
    }
    catch (ex) {
        if (ex instanceof BonsaiFail)
            return err(ex.feedback);
        throw ex;
    }
}
// ---- structural equality --------------------------------------------------
function constEquals(a, b) {
    if (a.t !== b.t)
        return false;
    if (a.t === "null")
        return true;
    // a.t === b.t and not null ⇒ both carry a `v`
    return a.v === b.v;
}
/** Structural equality of two expressions (the canonical-form equality). */
export function equals(a, b) {
    if (a.kind !== b.kind)
        return false;
    switch (a.kind) {
        case "const":
            return constEquals(a.value, b.value);
        case "param":
            return a.name === b.name;
        case "lambda": {
            const bb = b;
            return (a.params.length === bb.params.length &&
                a.params.every((p, i) => p === bb.params[i]) &&
                equals(a.body, bb.body));
        }
        case "binary": {
            const bb = b;
            return a.op === bb.op && equals(a.left, bb.left) && equals(a.right, bb.right);
        }
        case "call": {
            const bb = b;
            return a.fn === bb.fn && a.args.length === bb.args.length && a.args.every((x, i) => equals(x, bb.args[i]));
        }
        case "cond": {
            const bb = b;
            return equals(a.test, bb.test) && equals(a.then, bb.then) && equals(a.else, bb.else);
        }
    }
}
/** A human-readable message for a feedback variant (the ProblemDetails value). */
function feedbackMessage(f) {
    switch (f.kind) {
        case "UnsupportedVersion":
            return `unsupported version ${f.found} (expected ${f.expected})`;
        case "MalformedJson":
            return f.message;
        case "UnknownKind":
            return `unknown node kind "${f.nodeKind}"`;
        case "UnknownConstTag":
            return `unknown const tag "${f.tag}"`;
        case "UnknownOp":
            return `unknown binary operator "${f.op}"`;
        case "ExpectedString":
            return "expected a string";
        case "ExpectedBool":
            return "expected a boolean";
        case "ExpectedInt":
            return "expected a safe integer";
        case "NonSafeInt":
            return `integer ${f.value} is outside the safe-integer range`;
        case "TooDeep":
            return `nesting exceeds the maximum depth of ${f.limit}`;
        case "NonCanonical":
            return "input is not in canonical form";
    }
}
/** Adapt the collected declines to an RFC-9457 ProblemDetails document: group by
 * JSON-path into the `errors` map (each path → its messages). */
export function toProblemDetails(feedbacks) {
    const errors = {};
    for (const { path, feedback } of feedbacks) {
        (errors[path] ??= []).push(feedbackMessage(feedback));
    }
    return { type: "about:blank", title: "Bonsai validation failed", errors };
}
/** Collect declines for a const value into `out` (non-throwing; mirrors parseConst). */
function pushConst(path, n, out) {
    if (typeof n !== "object" || n === null || Array.isArray(n)) {
        out.push({ path, feedback: { kind: "MalformedJson", message: `${path} is not an object` } });
        return;
    }
    const o = n;
    switch (o.t) {
        case "int":
            if (typeof o.v !== "number" || !Number.isInteger(o.v))
                out.push({ path, feedback: { kind: "ExpectedInt", where: path } });
            else if (!Number.isSafeInteger(o.v))
                out.push({ path, feedback: { kind: "NonSafeInt", value: o.v } });
            return;
        case "str":
            if (typeof o.v !== "string")
                out.push({ path, feedback: { kind: "ExpectedString", where: path } });
            return;
        case "bool":
            if (typeof o.v !== "boolean")
                out.push({ path, feedback: { kind: "ExpectedBool", where: path } });
            return;
        case "null":
            return;
        default:
            out.push({ path, feedback: { kind: "UnknownConstTag", tag: String(o.t) } });
    }
}
/** Collect declines for a node into `out`, recursing all independent children
 * (non-throwing; the accumulate counterpart of parseNode). A fatal-structural node
 * (not-object / missing-or-unknown kind / too deep) is single for that node; its
 * siblings still accumulate. */
function pushNode(path, depth, n, out) {
    if (depth > BONSAI_MAX_DEPTH) {
        out.push({ path, feedback: { kind: "TooDeep", limit: BONSAI_MAX_DEPTH } });
        return;
    }
    if (typeof n !== "object" || n === null || Array.isArray(n)) {
        out.push({ path, feedback: { kind: "MalformedJson", message: `${path} is not an object` } });
        return;
    }
    const o = n;
    if (typeof o.kind !== "string") {
        out.push({ path, feedback: { kind: "MalformedJson", message: `${path}.kind is missing or not a string` } });
        return;
    }
    switch (o.kind) {
        case "const":
            pushConst(`${path}.value`, o.value, out);
            return;
        case "param":
            if (typeof o.name !== "string")
                out.push({ path: `${path}.name`, feedback: { kind: "ExpectedString", where: `${path}.name` } });
            return;
        case "lambda":
            if (Array.isArray(o.params)) {
                o.params.forEach((p, i) => {
                    if (typeof p !== "string")
                        out.push({ path: `${path}.params[${i}]`, feedback: { kind: "ExpectedString", where: `${path}.params[${i}]` } });
                });
            }
            else {
                out.push({ path: `${path}.params`, feedback: { kind: "MalformedJson", message: `${path}.params is not an array` } });
            }
            pushNode(`${path}.body`, depth + 1, o.body, out);
            return;
        case "binary":
            if (typeof o.op !== "string" || !BIN_OPS.has(o.op))
                out.push({ path: `${path}.op`, feedback: { kind: "UnknownOp", op: String(o.op) } });
            pushNode(`${path}.left`, depth + 1, o.left, out);
            pushNode(`${path}.right`, depth + 1, o.right, out);
            return;
        case "call":
            if (typeof o.fn !== "string")
                out.push({ path: `${path}.fn`, feedback: { kind: "ExpectedString", where: `${path}.fn` } });
            if (Array.isArray(o.args))
                o.args.forEach((a, i) => pushNode(`${path}.args[${i}]`, depth + 1, a, out));
            else
                out.push({ path: `${path}.args`, feedback: { kind: "MalformedJson", message: `${path}.args is not an array` } });
            return;
        case "cond":
            pushNode(`${path}.test`, depth + 1, o.test, out);
            pushNode(`${path}.then`, depth + 1, o.then, out);
            pushNode(`${path}.else`, depth + 1, o.else, out);
            return;
        default:
            out.push({ path, feedback: { kind: "UnknownKind", nodeKind: o.kind } });
    }
}
/**
 * Accumulate-mode parse: like `parse`, but on failure returns **every** per-node
 * decline (each with its JSON-path) instead of just the first — the applicative
 * complement for batch / model-validation / debugging a malformed tree. On success
 * returns the same `Expr` as `parse` (the canonical-only contract still applies; a
 * structurally-valid-but-non-canonical input declines `NonCanonical` at `$`).
 */
export function parseAll(s) {
    if (typeof s !== "string")
        return { ok: false, error: [{ path: "$", feedback: { kind: "MalformedJson", message: "input was not a string" } }] };
    let doc;
    try {
        doc = JSON.parse(s);
    }
    catch (ex) {
        return { ok: false, error: [{ path: "$", feedback: { kind: "MalformedJson", message: ex instanceof Error ? ex.message : String(ex) } }] };
    }
    if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
        return { ok: false, error: [{ path: "$", feedback: { kind: "MalformedJson", message: "document is not an object" } }] };
    }
    const d = doc;
    if (typeof d.v !== "number")
        return { ok: false, error: [{ path: "$.v", feedback: { kind: "MalformedJson", message: "document v is not a number" } }] };
    if (d.v !== BONSAI_VERSION)
        return { ok: false, error: [{ path: "$.v", feedback: { kind: "UnsupportedVersion", found: d.v, expected: BONSAI_VERSION } }] };
    const errs = [];
    pushNode("$.expr", 1, d.expr, errs);
    if (errs.length > 0)
        return { ok: false, error: errs };
    // Structurally valid → reuse the fail-fast parse for the Expr + canonical guard.
    // The only decline reachable here is NonCanonical (structure already validated).
    const r = parse(s);
    if (r.ok)
        return ok(r.value);
    return { ok: false, error: [{ path: "$", feedback: r.error }] };
}
