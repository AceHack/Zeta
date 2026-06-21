// Layer 1: forward-only one-pass YamlReader.
//
// Scans the text ONCE and emits a flat `YamlEvent` stream. It NEVER materializes a
// tree — only an indent/context stack. This is the `Utf8JsonReader`-vs-`JsonDocument`
// split: the DOM (`YamlValue` + `parse`, in dom.ts) is a separate fold built on top of
// this event stream.
//
// Subset only (config-friendly YAML). Out-of-subset constructs decline cleanly via the
// typed `YamlFeedback` channel (Result over throw) so a caller can fall back to a vendor
// adapter. See the LOCKED cross-language contracts in
// docs/agendas/ace-package-manager/2026-06-01-yaml-port-implementation-plan.md.
// Thrown internally to short-circuit the one-pass scan; converted to a Result by
// tryReadEvents. readEvents (the eager wrapper, by contract) re-throws it. Field is
// declared explicitly (no parameter-property shorthand) for erasableSyntaxOnly.
class DeclineError extends Error {
    feedback;
    constructor(feedback) {
        super(feedback);
        this.name = "DeclineError";
        this.feedback = feedback;
    }
}
const NULL_LITERALS = new Set(["", "~", "null", "Null", "NULL"]);
const BOOL_LITERALS = new Set(["true", "True", "TRUE", "false", "False", "FALSE"]);
const INT_RE = /^-?[0-9]+$/;
const FLOAT_RE = /^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$/;
// First char of an out-of-subset value (anchor / alias / tag / flow map / flow seq /
// literal block scalar / folded block scalar).
const UNSUPPORTED_VALUE_START = new Set(["&", "*", "!", "{", "[", "|", ">"]);
function resolvePlainKind(raw) {
    if (NULL_LITERALS.has(raw))
        return "Null";
    if (BOOL_LITERALS.has(raw))
        return "Bool";
    if (INT_RE.test(raw))
        return "Int";
    if (FLOAT_RE.test(raw))
        return "Float";
    return "Str";
}
function isSpace(ch) {
    return ch === " " || ch === "\t";
}
function leftTrim(s) {
    let i = 0;
    while (i < s.length && isSpace(s[i]))
        i++;
    return s.slice(i);
}
// A plain-scalar trailing comment begins at a `#` that follows whitespace. `a#b` is a
// literal value; `a #b` drops the comment. The token here has already had leading
// whitespace removed, so index 0 can never begin a comment.
function stripTrailingComment(token) {
    for (let i = 0; i < token.length; i++) {
        if (token[i] === "#" && i > 0 && isSpace(token[i - 1])) {
            return token.slice(0, i);
        }
    }
    return token;
}
function decodeSingleQuoted(token) {
    // token[0] === "'"
    let out = "";
    for (let i = 1; i < token.length; i++) {
        const ch = token[i];
        if (ch === "'") {
            if (token[i + 1] === "'") {
                out += "'";
                i++;
                continue;
            }
            return out;
        }
        out += ch;
    }
    throw new DeclineError("UnterminatedQuote");
}
function decodeDoubleQuoted(token) {
    // token[0] === '"'
    let out = "";
    for (let i = 1; i < token.length; i++) {
        const ch = token[i];
        if (ch === '"')
            return out;
        if (ch === "\\") {
            const next = token[i + 1];
            if (next === undefined)
                throw new DeclineError("UnterminatedQuote");
            switch (next) {
                case "\\":
                    out += "\\";
                    break;
                case '"':
                    out += '"';
                    break;
                case "n":
                    out += "\n";
                    break;
                case "t":
                    out += "\t";
                    break;
                case "r":
                    out += "\r";
                    break;
                case "0":
                    out += "\0";
                    break;
                case "/":
                    out += "/";
                    break;
                default:
                    throw new DeclineError("UnexpectedCharacter");
            }
            i++;
            continue;
        }
        out += ch;
    }
    throw new DeclineError("UnterminatedQuote");
}
// Decode a value token (already left-trimmed; may carry a trailing comment for plain
// scalars). Returns the decoded scalar OR throws DeclineError.
function parseValue(token) {
    const first = token[0];
    if (first === '"') {
        return { raw: decodeDoubleQuoted(token), kind: "Str", style: "DoubleQuoted" };
    }
    if (first === "'") {
        return { raw: decodeSingleQuoted(token), kind: "Str", style: "SingleQuoted" };
    }
    if (first !== undefined && UNSUPPORTED_VALUE_START.has(first)) {
        throw new DeclineError("UnsupportedConstruct");
    }
    const raw = stripTrailingComment(token).trimEnd();
    return { raw, kind: resolvePlainKind(raw), style: "Plain" };
}
// Split into lines, strip blanks + full-line comments, compute indent, and reject tabs
// in the indentation region of a content line (TabIndentation). Tolerates a trailing
// `\r` defensively though input is LF.
function toContentLines(text) {
    const out = [];
    for (let raw of text.split("\n")) {
        if (raw.endsWith("\r"))
            raw = raw.slice(0, -1);
        let indent = 0;
        let sawTab = false;
        while (indent < raw.length) {
            const ch = raw[indent];
            if (ch === " ") {
                indent++;
            }
            else if (ch === "\t") {
                sawTab = true;
                indent++;
            }
            else {
                break;
            }
        }
        const body = raw.slice(indent);
        if (body.length === 0)
            continue; // blank line — never a tab-indent error
        if (body[0] === "#")
            continue; // full-line comment
        if (sawTab)
            throw new DeclineError("TabIndentation");
        out.push({ indent, text: body });
    }
    return out;
}
// A whole-line document marker (`---` / `...`, alone or with a trailing payload) is
// out of subset.
function isDocumentMarker(text) {
    const t = text.trimEnd();
    return t === "---" || t === "..." || t.startsWith("--- ") || t.startsWith("... ");
}
// Find the mapping `key: value` split. The colon is the first `:` that is followed by a
// space or EOL and lies OUTSIDE a quoted region. Returns key text + remaining value
// token (left-trimmed), or `value: null` when there is no inline value, or `null` when
// the line is not a mapping entry at all.
function splitMappingEntry(text) {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inSingle) {
            if (ch === "'")
                inSingle = false;
            continue;
        }
        if (inDouble) {
            if (ch === "\\") {
                i++;
                continue;
            }
            if (ch === '"')
                inDouble = false;
            continue;
        }
        if (ch === "'") {
            inSingle = true;
            continue;
        }
        if (ch === '"') {
            inDouble = true;
            continue;
        }
        if (ch === "#" && i > 0 && isSpace(text[i - 1])) {
            return null; // comment reached before any colon — not a mapping entry
        }
        if (ch === ":" && (text[i + 1] === " " || text[i + 1] === undefined)) {
            const key = text.slice(0, i).trimEnd();
            const value = leftTrim(text.slice(i + 1));
            if (value.length === 0 || value.startsWith("#"))
                return { key, value: null };
            return { key, value };
        }
    }
    return null;
}
// Build the live event stream in one forward pass. Throws DeclineError on decline.
function scan(text) {
    const lines = toContentLines(text);
    const events = [{ e: "StreamStart" }];
    const stack = [];
    const pushContainer = (indent, kind) => {
        stack.push({ indent, kind });
        events.push({ e: kind === "Mapping" ? "MappingStart" : "SequenceStart" });
    };
    const popGreaterThan = (indent) => {
        while (stack.length > 0 && stack[stack.length - 1].indent > indent) {
            const top = stack.pop();
            events.push({ e: top.kind === "Mapping" ? "MappingEnd" : "SequenceEnd" });
        }
    };
    const childIndentAt = (idx) => {
        const next = lines[idx + 1];
        return next ? next.indent : -1;
    };
    // Decide the kind of the child block under a key/seq-item by peeking the next line's
    // shape at the expected child indent. (Forward-only: peek, do not consume.)
    const peekChildKind = (idx, childIndent) => {
        const next = lines[idx + 1];
        if (!next || next.indent !== childIndent)
            return "Mapping";
        return next.text === "-" || next.text.startsWith("- ") ? "Sequence" : "Mapping";
    };
    const emitKey = (key) => {
        // Map keys are ALWAYS Scalar kind="Str" (key text is never type-resolved); a quoted
        // key keeps its quote style + decoded inner text.
        const parsed = parseValue(key);
        events.push({ e: "Scalar", raw: parsed.raw, kind: "Str", style: parsed.style });
    };
    const emitNull = () => {
        events.push({ e: "Scalar", raw: "", kind: "Null", style: "Plain" });
    };
    const emitValue = (value) => {
        const parsed = parseValue(value);
        events.push({ e: "Scalar", raw: parsed.raw, kind: parsed.kind, style: parsed.style });
    };
    // B-1016: an UNQUOTED value token of exactly `{}` / `[]` is an EMPTY flow collection
    // — emit the empty container event-pair (not a scalar), so empty map / empty seq /
    // null stay three distinct states across the round-trip (never-collapse). General
    // flow (`{a: b}`, `[1,2]`) remains out of subset (declines via parseValue). A quoted
    // `"{}"` is a String (starts with `"`, never matches here).
    const emitValueOrEmptyFlow = (value) => {
        const token = stripTrailingComment(value).trimEnd();
        if (token === "{}") {
            events.push({ e: "MappingStart" });
            events.push({ e: "MappingEnd" });
        }
        else if (token === "[]") {
            events.push({ e: "SequenceStart" });
            events.push({ e: "SequenceEnd" });
        }
        else {
            emitValue(value);
        }
    };
    for (let li = 0; li < lines.length; li++) {
        const { indent, text: body } = lines[li];
        if (isDocumentMarker(body))
            throw new DeclineError("UnsupportedConstruct");
        const isSeqItem = body === "-" || body.startsWith("- ");
        // --- Indent management ---
        if (stack.length === 0) {
            pushContainer(indent, isSeqItem ? "Sequence" : "Mapping");
        }
        else if (indent <= stack[stack.length - 1].indent) {
            popGreaterThan(indent);
            const top = stack[stack.length - 1];
            if (!top || top.indent !== indent)
                throw new DeclineError("UnexpectedIndent");
            if (isSeqItem !== (top.kind === "Sequence"))
                throw new DeclineError("UnexpectedIndent");
        }
        // indent > top: the deeper container was opened proactively by the prior key/seq
        // line's peek; nothing to do here.
        if (isSeqItem) {
            const afterDash = body === "-" ? "" : body.slice(2);
            const itemContent = leftTrim(afterDash);
            if (itemContent.length === 0 || itemContent.startsWith("#")) {
                const childIndent = childIndentAt(li);
                if (childIndent > indent) {
                    pushContainer(childIndent, peekChildKind(li, childIndent));
                }
                else {
                    emitNull();
                }
                continue;
            }
            const innerEntry = splitMappingEntry(itemContent);
            if (innerEntry) {
                // Compact mapping item ("- id: x"): open the item's mapping at the content
                // indent (column of the first char after "- ").
                const mapIndent = indent + (body.length - itemContent.length);
                pushContainer(mapIndent, "Mapping");
                emitKey(innerEntry.key);
                if (innerEntry.value !== null) {
                    emitValueOrEmptyFlow(innerEntry.value);
                }
                else {
                    const childIndent = childIndentAt(li);
                    if (childIndent > mapIndent) {
                        pushContainer(childIndent, peekChildKind(li, childIndent));
                    }
                    else {
                        emitNull();
                    }
                }
                continue;
            }
            emitValueOrEmptyFlow(itemContent); // plain scalar item (or empty flow {} / [])
            continue;
        }
        // --- Mapping entry ---
        const entry = splitMappingEntry(body);
        if (!entry)
            throw new DeclineError("UnsupportedConstruct");
        emitKey(entry.key);
        if (entry.value !== null) {
            emitValueOrEmptyFlow(entry.value);
        }
        else {
            const childIndent = childIndentAt(li);
            if (childIndent > indent) {
                pushContainer(childIndent, peekChildKind(li, childIndent));
            }
            else {
                emitNull();
            }
        }
    }
    // EOF: pop all open containers, then StreamEnd.
    while (stack.length > 0) {
        const top = stack.pop();
        events.push({ e: top.kind === "Mapping" ? "MappingEnd" : "SequenceEnd" });
    }
    events.push({ e: "StreamEnd" });
    return events;
}
export function tryReadEvents(text) {
    try {
        return { ok: true, events: scan(text) };
    }
    catch (err) {
        if (err instanceof DeclineError)
            return { ok: false, feedback: err.feedback };
        throw err;
    }
}
export function readEvents(text) {
    const result = tryReadEvents(text);
    if (!result.ok)
        throw new DeclineError(result.feedback);
    return result.events;
}
