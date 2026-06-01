//! Layer 1: forward-only one-pass YamlReader.
//!
//! Scans the text ONCE and emits a flat [`YamlEvent`] stream. It NEVER materializes a
//! tree -- only an indent/context stack. This is the `Utf8JsonReader`-vs-`JsonDocument`
//! split: the DOM ([`crate::dom::YamlValue`] + [`crate::dom::parse`]) is a separate fold
//! built on top of this event stream.
//!
//! Faithful port of the TS reference `src/Core.TypeScript/yaml/reader.ts` (oracle #1).
//! The event sequence is the cross-language contract; this oracle reproduces it
//! byte-identically.

/// Scalar type resolved from a PLAIN scalar's text (quoted scalars are always `Str`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScalarKind {
    /// `""`, `~`, `null`, `Null`, `NULL`.
    Null,
    /// `true`/`True`/`TRUE`/`false`/`False`/`FALSE`.
    Bool,
    /// `^-?[0-9]+$`.
    Int,
    /// `^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$`.
    Float,
    /// Anything else (and every quoted scalar).
    Str,
}

/// How a scalar was written in the source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScalarStyle {
    /// Unquoted.
    Plain,
    /// `'...'` (only `''` -> `'`).
    SingleQuoted,
    /// `"..."` (supports `\\ \" \n \t \r \0 \/`).
    DoubleQuoted,
}

/// A flat event in the L1 stream. A document emits exactly one [`YamlEvent::StreamStart`]
/// first and one [`YamlEvent::StreamEnd`] last.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum YamlEvent {
    /// Start of the document stream.
    StreamStart,
    /// End of the document stream.
    StreamEnd,
    /// Open a mapping container.
    MappingStart,
    /// Close a mapping container.
    MappingEnd,
    /// Open a sequence container.
    SequenceStart,
    /// Close a sequence container.
    SequenceEnd,
    /// A scalar (map key, map value, or sequence item). Map keys are always `kind = Str`.
    Scalar {
        /// The decoded value text.
        raw: String,
        /// Resolved kind (PLAIN only; quoted always `Str`).
        kind: ScalarKind,
        /// Source style.
        style: ScalarStyle,
    },
}

/// Typed decline channel (Result over throw) so a caller can fall back to a vendor
/// adapter on out-of-subset input.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum YamlFeedback {
    /// A tab in a content line's indentation region.
    TabIndentation,
    /// A quoted scalar with no closing quote.
    UnterminatedQuote,
    /// A bad double-quote escape or stray character.
    UnexpectedCharacter,
    /// A dedent to a level that does not match any open container.
    UnexpectedIndent,
    /// Out-of-subset: a value beginning `& * ! { [ | >`, or a line `---` / `...`.
    UnsupportedConstruct,
}

// --- Plain-kind resolution ----------------------------------------------------------

fn is_null_literal(raw: &str) -> bool {
    matches!(raw, "" | "~" | "null" | "Null" | "NULL")
}

fn is_bool_literal(raw: &str) -> bool {
    matches!(raw, "true" | "True" | "TRUE" | "false" | "False" | "FALSE")
}

/// `^-?[0-9]+$` (hand-rolled to stay zero-dep -- no regex crate).
fn is_int_literal(raw: &str) -> bool {
    let bytes = raw.as_bytes();
    let mut i = 0;
    if bytes.first() == Some(&b'-') {
        i = 1;
    }
    if i == bytes.len() {
        return false; // just "-" (or empty)
    }
    bytes[i..].iter().all(u8::is_ascii_digit)
}

/// `^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$` (hand-rolled).
fn is_float_literal(raw: &str) -> bool {
    let bytes = raw.as_bytes();
    let mut i = 0;
    if bytes.first() == Some(&b'-') {
        i = 1;
    }
    // integer part: one-or-more digits
    let int_start = i;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }
    if i == int_start {
        return false;
    }
    // required '.'
    if i >= bytes.len() || bytes[i] != b'.' {
        return false;
    }
    i += 1;
    // fraction part: one-or-more digits
    let frac_start = i;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }
    if i == frac_start {
        return false;
    }
    // optional exponent
    if i < bytes.len() && (bytes[i] == b'e' || bytes[i] == b'E') {
        i += 1;
        if i < bytes.len() && (bytes[i] == b'+' || bytes[i] == b'-') {
            i += 1;
        }
        let exp_start = i;
        while i < bytes.len() && bytes[i].is_ascii_digit() {
            i += 1;
        }
        if i == exp_start {
            return false;
        }
    }
    i == bytes.len()
}

fn resolve_plain_kind(raw: &str) -> ScalarKind {
    if is_null_literal(raw) {
        ScalarKind::Null
    } else if is_bool_literal(raw) {
        ScalarKind::Bool
    } else if is_int_literal(raw) {
        ScalarKind::Int
    } else if is_float_literal(raw) {
        ScalarKind::Float
    } else {
        ScalarKind::Str
    }
}

// --- Scalar token parsing -----------------------------------------------------------

struct ParsedScalar {
    raw: String,
    kind: ScalarKind,
    style: ScalarStyle,
}

fn is_space(ch: char) -> bool {
    ch == ' ' || ch == '\t'
}

/// Drop leading spaces/tabs.
fn left_trim(s: &str) -> &str {
    s.trim_start_matches([' ', '\t'])
}

/// A plain-scalar trailing comment begins at a `#` that follows whitespace. `a#b` is a
/// literal value; `a #b` drops the comment. The token here has already had leading
/// whitespace removed, so index 0 can never begin a comment.
fn strip_trailing_comment(token: &str) -> &str {
    let bytes = token.as_bytes();
    for i in 0..bytes.len() {
        if bytes[i] == b'#' && i > 0 && (bytes[i - 1] == b' ' || bytes[i - 1] == b'\t') {
            return &token[..i];
        }
    }
    token
}

fn decode_single_quoted(token: &str) -> Result<String, YamlFeedback> {
    // token[0] == '\''
    let chars: Vec<char> = token.chars().collect();
    let mut out = String::new();
    let mut i = 1;
    while i < chars.len() {
        let ch = chars[i];
        if ch == '\'' {
            if chars.get(i + 1) == Some(&'\'') {
                out.push('\'');
                i += 2;
                continue;
            }
            return Ok(out);
        }
        out.push(ch);
        i += 1;
    }
    Err(YamlFeedback::UnterminatedQuote)
}

fn decode_double_quoted(token: &str) -> Result<String, YamlFeedback> {
    // token[0] == '"'
    let chars: Vec<char> = token.chars().collect();
    let mut out = String::new();
    let mut i = 1;
    while i < chars.len() {
        let ch = chars[i];
        if ch == '"' {
            return Ok(out);
        }
        if ch == '\\' {
            let next = match chars.get(i + 1) {
                Some(c) => *c,
                None => return Err(YamlFeedback::UnterminatedQuote),
            };
            match next {
                '\\' => out.push('\\'),
                '"' => out.push('"'),
                'n' => out.push('\n'),
                't' => out.push('\t'),
                'r' => out.push('\r'),
                '0' => out.push('\0'),
                '/' => out.push('/'),
                _ => return Err(YamlFeedback::UnexpectedCharacter),
            }
            i += 2;
            continue;
        }
        out.push(ch);
        i += 1;
    }
    Err(YamlFeedback::UnterminatedQuote)
}

const UNSUPPORTED_VALUE_START: [char; 7] = ['&', '*', '!', '{', '[', '|', '>'];

/// Decode a value token (already left-trimmed; may carry a trailing comment for plain
/// scalars).
fn parse_value(token: &str) -> Result<ParsedScalar, YamlFeedback> {
    let first = token.chars().next();
    match first {
        Some('"') => Ok(ParsedScalar {
            raw: decode_double_quoted(token)?,
            kind: ScalarKind::Str,
            style: ScalarStyle::DoubleQuoted,
        }),
        Some('\'') => Ok(ParsedScalar {
            raw: decode_single_quoted(token)?,
            kind: ScalarKind::Str,
            style: ScalarStyle::SingleQuoted,
        }),
        Some(c) if UNSUPPORTED_VALUE_START.contains(&c) => {
            Err(YamlFeedback::UnsupportedConstruct)
        }
        _ => {
            let raw = strip_trailing_comment(token).trim_end().to_string();
            let kind = resolve_plain_kind(&raw);
            Ok(ParsedScalar {
                raw,
                kind,
                style: ScalarStyle::Plain,
            })
        }
    }
}

// --- Line model ---------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq)]
enum ContainerKind {
    Mapping,
    Sequence,
}

struct Frame {
    indent: usize,
    kind: ContainerKind,
}

struct ContentLine {
    indent: usize,
    // Text from the first non-space char to end of line (trailing whitespace kept; the
    // value parser handles trimming + comment stripping, quote-aware).
    text: String,
}

/// Split into lines, strip blanks + full-line comments, compute indent, and reject tabs
/// in the indentation region of a content line ([`YamlFeedback::TabIndentation`]).
/// Tolerates a trailing `\r` defensively though input is LF.
fn to_content_lines(text: &str) -> Result<Vec<ContentLine>, YamlFeedback> {
    let mut out: Vec<ContentLine> = Vec::new();
    for raw_line in text.split('\n') {
        let line = raw_line.strip_suffix('\r').unwrap_or(raw_line);

        let mut indent = 0usize;
        let mut saw_tab = false;
        for ch in line.chars() {
            if ch == ' ' {
                indent += 1;
            } else if ch == '\t' {
                saw_tab = true;
                indent += 1;
            } else {
                break;
            }
        }

        // Slice off the indentation region by byte length (indent counts ' '/'\t', both
        // 1 byte each in UTF-8, so `indent` is also the byte offset).
        let body = &line[indent..];
        if body.is_empty() {
            continue; // blank line -- never a tab-indent error
        }
        if body.starts_with('#') {
            continue; // full-line comment
        }
        if saw_tab {
            return Err(YamlFeedback::TabIndentation);
        }

        out.push(ContentLine {
            indent,
            text: body.to_string(),
        });
    }
    Ok(out)
}

/// A whole-line document marker (`---` / `...`, alone or with a trailing payload) is out
/// of subset.
fn is_document_marker(text: &str) -> bool {
    let t = text.trim_end();
    t == "---" || t == "..." || t.starts_with("--- ") || t.starts_with("... ")
}

struct MappingEntry {
    key: String,
    value: Option<String>,
}

/// Find the mapping `key: value` split. The colon is the first `:` followed by a space or
/// EOL and OUTSIDE a quoted region. Returns key text + value token (left-trimmed) or
/// `value = None` when there is no inline value, or `None` when the line is not a mapping
/// entry at all.
fn split_mapping_entry(text: &str) -> Option<MappingEntry> {
    let chars: Vec<char> = text.chars().collect();
    let mut in_single = false;
    let mut in_double = false;
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        if in_single {
            if ch == '\'' {
                in_single = false;
            }
            i += 1;
            continue;
        }
        if in_double {
            if ch == '\\' {
                i += 2;
                continue;
            }
            if ch == '"' {
                in_double = false;
            }
            i += 1;
            continue;
        }
        if ch == '\'' {
            in_single = true;
            i += 1;
            continue;
        }
        if ch == '"' {
            in_double = true;
            i += 1;
            continue;
        }
        if ch == '#' && i > 0 && is_space(chars[i - 1]) {
            return None; // comment reached before any colon -- not a mapping entry
        }
        if ch == ':' && (chars.get(i + 1) == Some(&' ') || i + 1 == chars.len()) {
            // Build key/value by char index. `text` is byte-indexable only via the chars
            // we collected; reconstruct from the Vec to stay correct under multibyte.
            let key: String = chars[..i].iter().collect::<String>().trim_end().to_string();
            let rest: String = chars[i + 1..].iter().collect();
            let value = left_trim(&rest);
            if value.is_empty() || value.starts_with('#') {
                return Some(MappingEntry { key, value: None });
            }
            return Some(MappingEntry {
                key,
                value: Some(value.to_string()),
            });
        }
        i += 1;
    }
    None
}

// --- The one-pass scanner -----------------------------------------------------------

struct Scanner {
    events: Vec<YamlEvent>,
    stack: Vec<Frame>,
}

impl Scanner {
    fn new() -> Self {
        Scanner {
            events: vec![YamlEvent::StreamStart],
            stack: Vec::new(),
        }
    }

    fn push_container(&mut self, indent: usize, kind: ContainerKind) {
        self.stack.push(Frame { indent, kind });
        self.events.push(match kind {
            ContainerKind::Mapping => YamlEvent::MappingStart,
            ContainerKind::Sequence => YamlEvent::SequenceStart,
        });
    }

    fn pop_greater_than(&mut self, indent: usize) {
        while let Some(top) = self.stack.last() {
            if top.indent > indent {
                let frame = self.stack.pop().expect("checked by last()");
                self.events.push(match frame.kind {
                    ContainerKind::Mapping => YamlEvent::MappingEnd,
                    ContainerKind::Sequence => YamlEvent::SequenceEnd,
                });
            } else {
                break;
            }
        }
    }

    fn emit_key(&mut self, key: &str) -> Result<(), YamlFeedback> {
        // Map keys are ALWAYS Scalar kind=Str (key text is never type-resolved); a quoted
        // key keeps its quote style + decoded inner text.
        let parsed = parse_value(key)?;
        self.events.push(YamlEvent::Scalar {
            raw: parsed.raw,
            kind: ScalarKind::Str,
            style: parsed.style,
        });
        Ok(())
    }

    fn emit_null(&mut self) {
        self.events.push(YamlEvent::Scalar {
            raw: String::new(),
            kind: ScalarKind::Null,
            style: ScalarStyle::Plain,
        });
    }

    fn emit_value(&mut self, value: &str) -> Result<(), YamlFeedback> {
        let parsed = parse_value(value)?;
        self.events.push(YamlEvent::Scalar {
            raw: parsed.raw,
            kind: parsed.kind,
            style: parsed.style,
        });
        Ok(())
    }
}

/// Peek the next line's indent (or `None` if there is no next content line).
fn child_indent_at(lines: &[ContentLine], idx: usize) -> Option<usize> {
    lines.get(idx + 1).map(|l| l.indent)
}

/// Decide the kind of the child block under a key/seq-item by peeking the next line's
/// shape at the expected child indent. (Forward-only: peek, do not consume.)
fn peek_child_kind(lines: &[ContentLine], idx: usize, child_indent: usize) -> ContainerKind {
    match lines.get(idx + 1) {
        Some(next) if next.indent == child_indent => {
            if next.text == "-" || next.text.starts_with("- ") {
                ContainerKind::Sequence
            } else {
                ContainerKind::Mapping
            }
        }
        _ => ContainerKind::Mapping,
    }
}

fn scan(text: &str) -> Result<Vec<YamlEvent>, YamlFeedback> {
    let lines = to_content_lines(text)?;
    let mut s = Scanner::new();

    for li in 0..lines.len() {
        let indent = lines[li].indent;
        let body = lines[li].text.clone();

        if is_document_marker(&body) {
            return Err(YamlFeedback::UnsupportedConstruct);
        }

        let is_seq_item = body == "-" || body.starts_with("- ");

        // --- Indent management ---
        if s.stack.is_empty() {
            s.push_container(
                indent,
                if is_seq_item {
                    ContainerKind::Sequence
                } else {
                    ContainerKind::Mapping
                },
            );
        } else if indent <= s.stack.last().expect("non-empty checked").indent {
            s.pop_greater_than(indent);
            match s.stack.last() {
                Some(top) if top.indent == indent => {
                    let top_is_seq = top.kind == ContainerKind::Sequence;
                    if is_seq_item != top_is_seq {
                        return Err(YamlFeedback::UnexpectedIndent);
                    }
                }
                _ => return Err(YamlFeedback::UnexpectedIndent),
            }
        }
        // indent > top: the deeper container was opened proactively by the prior key/seq
        // line's peek; nothing to do here.

        if is_seq_item {
            let after_dash: &str = if body == "-" { "" } else { &body[2..] };
            let item_content = left_trim(after_dash);

            if item_content.is_empty() || item_content.starts_with('#') {
                match child_indent_at(&lines, li) {
                    Some(child_indent) if child_indent > indent => {
                        s.push_container(child_indent, peek_child_kind(&lines, li, child_indent));
                    }
                    _ => s.emit_null(),
                }
                continue;
            }

            if let Some(inner) = split_mapping_entry(item_content) {
                // Compact mapping item ("- id: x"): open the item's mapping at the content
                // indent (column of the first char after "- ").
                let lead = body.len() - item_content.len();
                let map_indent = indent + lead;
                s.push_container(map_indent, ContainerKind::Mapping);
                s.emit_key(&inner.key)?;
                match inner.value {
                    Some(v) => s.emit_value(&v)?,
                    None => match child_indent_at(&lines, li) {
                        Some(child_indent) if child_indent > map_indent => {
                            s.push_container(child_indent, peek_child_kind(&lines, li, child_indent));
                        }
                        _ => s.emit_null(),
                    },
                }
                continue;
            }

            s.emit_value(item_content)?; // plain scalar item
            continue;
        }

        // --- Mapping entry ---
        let entry = match split_mapping_entry(&body) {
            Some(e) => e,
            None => return Err(YamlFeedback::UnsupportedConstruct),
        };
        s.emit_key(&entry.key)?;
        match entry.value {
            Some(v) => s.emit_value(&v)?,
            None => match child_indent_at(&lines, li) {
                Some(child_indent) if child_indent > indent => {
                    s.push_container(child_indent, peek_child_kind(&lines, li, child_indent));
                }
                _ => s.emit_null(),
            },
        }
    }

    // EOF: pop all open containers, then StreamEnd.
    while let Some(frame) = s.stack.pop() {
        s.events.push(match frame.kind {
            ContainerKind::Mapping => YamlEvent::MappingEnd,
            ContainerKind::Sequence => YamlEvent::SequenceEnd,
        });
    }
    s.events.push(YamlEvent::StreamEnd);
    Ok(s.events)
}

/// Read the L1 event stream from `text` in one forward pass, or decline via
/// [`YamlFeedback`] on out-of-subset input.
pub fn read_events(text: &str) -> Result<Vec<YamlEvent>, YamlFeedback> {
    scan(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Convenience constructors keeping the expected-event arrays terse + readable.
    fn ss() -> YamlEvent {
        YamlEvent::StreamStart
    }
    fn se() -> YamlEvent {
        YamlEvent::StreamEnd
    }
    fn ms() -> YamlEvent {
        YamlEvent::MappingStart
    }
    fn me() -> YamlEvent {
        YamlEvent::MappingEnd
    }
    fn seqs() -> YamlEvent {
        YamlEvent::SequenceStart
    }
    fn seqe() -> YamlEvent {
        YamlEvent::SequenceEnd
    }
    fn sc(raw: &str, kind: ScalarKind, style: ScalarStyle) -> YamlEvent {
        YamlEvent::Scalar {
            raw: raw.to_string(),
            kind,
            style,
        }
    }
    fn key(raw: &str) -> YamlEvent {
        sc(raw, ScalarKind::Str, ScalarStyle::Plain)
    }

    use ScalarKind::{Bool, Float, Int, Null, Str};
    use ScalarStyle::{DoubleQuoted, Plain, SingleQuoted};

    #[test]
    fn vector_empty_map_value() {
        let got = read_events("a:\n").unwrap();
        assert_eq!(
            got,
            vec![ss(), ms(), key("a"), sc("", Null, Plain), me(), se()]
        );
    }

    #[test]
    fn vector_flat_scalars() {
        let got = read_events("name: zeta\ncount: 42\nratio: 3.14\nok: true\ngone: null\n").unwrap();
        assert_eq!(
            got,
            vec![
                ss(),
                ms(),
                key("name"),
                sc("zeta", Str, Plain),
                key("count"),
                sc("42", Int, Plain),
                key("ratio"),
                sc("3.14", Float, Plain),
                key("ok"),
                sc("true", Bool, Plain),
                key("gone"),
                sc("null", Null, Plain),
                me(),
                se(),
            ]
        );
    }

    #[test]
    fn vector_quoted_forces_string() {
        let got = read_events("a: \"42\"\nb: '3.14'\n").unwrap();
        assert_eq!(
            got,
            vec![
                ss(),
                ms(),
                key("a"),
                sc("42", Str, DoubleQuoted),
                key("b"),
                sc("3.14", Str, SingleQuoted),
                me(),
                se(),
            ]
        );
    }

    #[test]
    fn vector_double_quote_escapes() {
        let got = read_events("msg: \"he said \\\"hi\\\"\\nbye\"\n").unwrap();
        assert_eq!(
            got,
            vec![
                ss(),
                ms(),
                key("msg"),
                sc("he said \"hi\"\nbye", Str, DoubleQuoted),
                me(),
                se(),
            ]
        );
    }

    #[test]
    fn vector_single_quote_escape() {
        let got = read_events("a: 'it''s'\n").unwrap();
        assert_eq!(
            got,
            vec![
                ss(),
                ms(),
                key("a"),
                sc("it's", Str, SingleQuoted),
                me(),
                se(),
            ]
        );
    }

    #[test]
    fn vector_nested_map() {
        let got = read_events("outer:\n  inner: 1\n").unwrap();
        assert_eq!(
            got,
            vec![
                ss(),
                ms(),
                key("outer"),
                ms(),
                key("inner"),
                sc("1", Int, Plain),
                me(),
                me(),
                se(),
            ]
        );
    }

    #[test]
    fn vector_sequence() {
        let got = read_events("- a\n- b\n").unwrap();
        assert_eq!(
            got,
            vec![
                ss(),
                seqs(),
                sc("a", Str, Plain),
                sc("b", Str, Plain),
                seqe(),
                se(),
            ]
        );
    }

    #[test]
    fn vector_sequence_of_maps() {
        let got = read_events("items:\n  - id: x\n    n: 1\n  - id: y\n    n: 2\n").unwrap();
        assert_eq!(
            got,
            vec![
                ss(),
                ms(),
                key("items"),
                seqs(),
                ms(),
                key("id"),
                sc("x", Str, Plain),
                key("n"),
                sc("1", Int, Plain),
                me(),
                ms(),
                key("id"),
                sc("y", Str, Plain),
                key("n"),
                sc("2", Int, Plain),
                me(),
                seqe(),
                me(),
                se(),
            ]
        );
    }

    #[test]
    fn vector_comments() {
        let got = read_events("# top\na: 1  # trail\nb: 2\n").unwrap();
        assert_eq!(
            got,
            vec![
                ss(),
                ms(),
                key("a"),
                sc("1", Int, Plain),
                key("b"),
                sc("2", Int, Plain),
                me(),
                se(),
            ]
        );
    }

    #[test]
    fn vector_null_forms_and_strings() {
        let got = read_events("a: ~\nb:\nc: 12abc\nd: -2.5\n").unwrap();
        assert_eq!(
            got,
            vec![
                ss(),
                ms(),
                key("a"),
                sc("~", Null, Plain),
                key("b"),
                sc("", Null, Plain),
                key("c"),
                sc("12abc", Str, Plain),
                key("d"),
                sc("-2.5", Float, Plain),
                me(),
                se(),
            ]
        );
    }

    // --- Decline paths ---

    #[test]
    fn decline_tab_indentation() {
        assert_eq!(read_events("\tx: 1\n"), Err(YamlFeedback::TabIndentation));
    }

    #[test]
    fn decline_unterminated_quote() {
        assert_eq!(
            read_events("a: \"unterminated\n"),
            Err(YamlFeedback::UnterminatedQuote)
        );
    }

    #[test]
    fn decline_unsupported_anchor() {
        assert_eq!(
            read_events("a: &anchor\n"),
            Err(YamlFeedback::UnsupportedConstruct)
        );
    }

    #[test]
    fn decline_unsupported_flow_seq() {
        assert_eq!(
            read_events("a: [1, 2]\n"),
            Err(YamlFeedback::UnsupportedConstruct)
        );
    }

    #[test]
    fn decline_document_marker() {
        assert_eq!(
            read_events("---\na: 1\n"),
            Err(YamlFeedback::UnsupportedConstruct)
        );
    }

    #[test]
    fn decline_bad_double_quote_escape() {
        assert_eq!(
            read_events("a: \"x\\qy\"\n"),
            Err(YamlFeedback::UnexpectedCharacter)
        );
    }

    // --- Kind-resolution edge cases (hand-rolled regex parity) ---

    #[test]
    fn int_and_float_edge_cases() {
        // bare "-" is Str, not Int
        assert_eq!(resolve_plain_kind("-"), ScalarKind::Str);
        // exponent float
        assert_eq!(resolve_plain_kind("1.5e10"), ScalarKind::Float);
        assert_eq!(resolve_plain_kind("-1.5E-3"), ScalarKind::Float);
        // int without fraction is Int not Float
        assert_eq!(resolve_plain_kind("42"), ScalarKind::Int);
        // "1." is not a valid float (fraction required)
        assert_eq!(resolve_plain_kind("1."), ScalarKind::Str);
        // ".5" is not a valid float (integer part required)
        assert_eq!(resolve_plain_kind(".5"), ScalarKind::Str);
        // "1e10" without a dot is NOT a Float per the locked regex
        assert_eq!(resolve_plain_kind("1e10"), ScalarKind::Str);
    }
}
