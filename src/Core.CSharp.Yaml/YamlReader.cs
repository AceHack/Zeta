// Layer 1: forward-only one-pass YamlReader (C# oracle, oracle #4).
//
// Scans the text ONCE and emits a flat YamlEvent stream. It NEVER materialises a tree --
// only an indent/context stack. This is the Utf8JsonReader-vs-JsonDocument split: the DOM
// (YamlValue + Parse, in YamlValue.cs) is a separate fold built ON TOP of this event stream.
//
// Faithful port of the F# reference src/Core.FSharp.Yaml/Reader.fs (oracle #3), TS oracle
// src/Core.TypeScript/yaml/reader.ts (oracle #1), and Rust oracle
// src/Core.Rust.Yaml/src/reader.rs (oracle #2). The event sequence is the cross-language
// contract; this oracle reproduces it byte-identically.
//
// Subset only (config-friendly YAML). Out-of-subset constructs decline cleanly via the
// typed YamlFeedback channel (Result over throw) so a caller can fall back to a vendor
// adapter. See the LOCKED cross-language contracts in
// docs/agendas/ace-package-manager/2026-06-01-yaml-port-implementation-plan.md.

namespace Zeta.Core.CSharp.Yaml;

using System.Runtime.InteropServices;
using System.Text;

/// <summary>
/// Forward-only one-pass YAML reader. Emits a flat <see cref="YamlEvent"/> stream in a
/// single scan with an indent/context stack. Never builds a tree.
/// </summary>
public static class YamlReader
{
    // -------------------------------------------------------------------------
    // Plain-kind resolution
    // -------------------------------------------------------------------------

    private static bool IsNullLiteral(string raw) =>
        string.Equals(raw, "", StringComparison.Ordinal) ||
        string.Equals(raw, "~", StringComparison.Ordinal) ||
        string.Equals(raw, "null", StringComparison.Ordinal) ||
        string.Equals(raw, "Null", StringComparison.Ordinal) ||
        string.Equals(raw, "NULL", StringComparison.Ordinal);

    private static bool IsBoolLiteral(string raw) =>
        string.Equals(raw, "true",  StringComparison.Ordinal) ||
        string.Equals(raw, "True",  StringComparison.Ordinal) ||
        string.Equals(raw, "TRUE",  StringComparison.Ordinal) ||
        string.Equals(raw, "false", StringComparison.Ordinal) ||
        string.Equals(raw, "False", StringComparison.Ordinal) ||
        string.Equals(raw, "FALSE", StringComparison.Ordinal);

    /// <summary>^-?[0-9]+$ (hand-rolled to stay zero-dep -- no Regex).</summary>
    private static bool IsIntLiteral(string raw)
    {
        if (raw.Length == 0) return false;
        int i = raw[0] == '-' ? 1 : 0;
        if (i == raw.Length) return false; // just "-"
        for (; i < raw.Length; i++)
            if (raw[i] < '0' || raw[i] > '9') return false;
        return true;
    }

    /// <summary>^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$ (hand-rolled).</summary>
    private static bool IsFloatLiteral(string raw)
    {
        int n = raw.Length;
        int i = (n > 0 && raw[0] == '-') ? 1 : 0;
        int intStart = i;
        while (i < n && raw[i] >= '0' && raw[i] <= '9') i++;
        if (i == intStart) return false; // no integer digits
        if (i >= n || raw[i] != '.') return false;
        i++;
        int fracStart = i;
        while (i < n && raw[i] >= '0' && raw[i] <= '9') i++;
        if (i == fracStart) return false; // no fraction digits
        // optional exponent
        if (i < n && (raw[i] == 'e' || raw[i] == 'E'))
        {
            i++;
            if (i < n && (raw[i] == '+' || raw[i] == '-')) i++;
            int expStart = i;
            while (i < n && raw[i] >= '0' && raw[i] <= '9') i++;
            if (i == expStart) return false; // exponent marker with no digits
        }
        return i == n;
    }

    private static ScalarKind ResolvePlainKind(string raw)
    {
        if (IsNullLiteral(raw)) return ScalarKind.Null;
        if (IsBoolLiteral(raw)) return ScalarKind.Bool;
        if (IsIntLiteral(raw))  return ScalarKind.Int;
        if (IsFloatLiteral(raw)) return ScalarKind.Float;
        return ScalarKind.Str;
    }

    // -------------------------------------------------------------------------
    // Scalar token parsing
    // -------------------------------------------------------------------------

    [StructLayout(LayoutKind.Auto)]
    private readonly record struct ParsedScalar(string Raw, ScalarKind Kind, ScalarStyle Style);

    private static bool IsWhitespace(char ch) => ch == ' ' || ch == '\t';

    /// <summary>
    /// A plain-scalar trailing comment begins at a # that follows whitespace. "a#b" is a
    /// literal value; "a #b" drops the comment.
    /// </summary>
    private static string StripTrailingComment(string token)
    {
        for (int i = 1; i < token.Length; i++)
        {
            if (token[i] == '#' && IsWhitespace(token[i - 1]))
                return token[..i];
        }
        return token;
    }

    private static (bool ok, string raw, YamlFeedback feedback) DecodeSingleQuoted(string token)
    {
        // token[0] == '\''
        var sb = new StringBuilder();
        int i = 1;
        while (i < token.Length)
        {
            char ch = token[i];
            if (ch == '\'')
            {
                if (i + 1 < token.Length && token[i + 1] == '\'')
                {
                    sb.Append('\'');
                    i += 2;
                }
                else
                {
                    return (true, sb.ToString(), default);
                }
            }
            else
            {
                sb.Append(ch);
                i++;
            }
        }
        return (false, string.Empty, YamlFeedback.UnterminatedQuote);
    }

    private static (bool ok, string raw, YamlFeedback feedback) DecodeDoubleQuoted(string token)
    {
        // token[0] == '"'
        var sb = new StringBuilder();
        int i = 1;
        while (i < token.Length)
        {
            char ch = token[i];
            if (ch == '"')
                return (true, sb.ToString(), default);
            if (ch == '\\')
            {
                if (i + 1 >= token.Length)
                    return (false, string.Empty, YamlFeedback.UnterminatedQuote);
                char next = token[i + 1];
                switch (next)
                {
                    case '\\': sb.Append('\\'); i += 2; break;
                    case '"':  sb.Append('"');  i += 2; break;
                    case 'n':  sb.Append('\n'); i += 2; break;
                    case 't':  sb.Append('\t'); i += 2; break;
                    case 'r':  sb.Append('\r'); i += 2; break;
                    case '0':  sb.Append('\0'); i += 2; break;
                    case '/':  sb.Append('/');  i += 2; break;
                    default:
                        return (false, string.Empty, YamlFeedback.UnexpectedCharacter);
                }
            }
            else
            {
                sb.Append(ch);
                i++;
            }
        }
        return (false, string.Empty, YamlFeedback.UnterminatedQuote);
    }

    private static readonly HashSet<char> UnsupportedValueStarts =
        new(['&', '*', '!', '{', '[', '|', '>']);

    private static (bool ok, ParsedScalar scalar, YamlFeedback feedback) ParseValue(string token)
    {
        if (token.Length > 0 && token[0] == '"')
        {
            var (ok, raw, fb) = DecodeDoubleQuoted(token);
            return ok
                ? (true, new ParsedScalar(raw, ScalarKind.Str, ScalarStyle.DoubleQuoted), default)
                : (false, default, fb);
        }
        if (token.Length > 0 && token[0] == '\'')
        {
            var (ok, raw, fb) = DecodeSingleQuoted(token);
            return ok
                ? (true, new ParsedScalar(raw, ScalarKind.Str, ScalarStyle.SingleQuoted), default)
                : (false, default, fb);
        }
        if (token.Length > 0 && UnsupportedValueStarts.Contains(token[0]))
            return (false, default, YamlFeedback.UnsupportedConstruct);

        string plainRaw = StripTrailingComment(token).TrimEnd();
        return (true, new ParsedScalar(plainRaw, ResolvePlainKind(plainRaw), ScalarStyle.Plain), default);
    }

    // -------------------------------------------------------------------------
    // Line model
    // -------------------------------------------------------------------------

    private enum ContainerKind { Mapping, Sequence }

    [StructLayout(LayoutKind.Auto)]
    private readonly record struct Frame(int Indent, ContainerKind Kind);

    [StructLayout(LayoutKind.Auto)]
    private readonly record struct ContentLine(int Indent, string Text);

    [StructLayout(LayoutKind.Auto)]
    private readonly record struct MappingEntry(string Key, string? Value);

    /// <summary>
    /// Split into lines, strip blanks + full-line comments, compute indent, and reject tabs
    /// in the indentation region of a content line (TabIndentation). Tolerates a trailing
    /// \r defensively though input is LF.
    /// </summary>
    private static (bool ok, List<ContentLine>? lines, YamlFeedback feedback)
        ToContentLines(string text)
    {
        var result = new List<ContentLine>();
        string[] rawLines = text.Split('\n');
        foreach (string rawLine in rawLines)
        {
            string line = rawLine.EndsWith('\r') ? rawLine[..^1] : rawLine;

            int indent = 0;
            bool sawTab = false;
            while (indent < line.Length)
            {
                char ch = line[indent];
                if (ch == ' ')       indent++;
                else if (ch == '\t') { sawTab = true; indent++; }
                else                 break;
            }

            string body = line[indent..];
            if (body.Length == 0) continue;
            if (body[0] == '#')  continue;
            if (sawTab) return (false, null, YamlFeedback.TabIndentation);
            result.Add(new ContentLine(indent, body));
        }
        return (true, result, default);
    }

    private static bool IsDocumentMarker(string text)
    {
        string t = text.TrimEnd();
        return string.Equals(t, "---", StringComparison.Ordinal) ||
               string.Equals(t, "...", StringComparison.Ordinal) ||
               t.StartsWith("--- ", StringComparison.Ordinal) ||
               t.StartsWith("... ", StringComparison.Ordinal);
    }

    /// <summary>
    /// Find the mapping key: value split. The colon is the first : followed by a space or
    /// EOL and OUTSIDE a quoted region.
    /// </summary>
    private static MappingEntry? SplitMappingEntry(string text)
    {
        bool inSingle = false, inDouble = false;
        int i = 0;
        while (i < text.Length)
        {
            char ch = text[i];
            if (inSingle)
            {
                if (ch == '\'') inSingle = false;
                i++;
            }
            else if (inDouble)
            {
                if (ch == '\\') i += 2;
                else
                {
                    if (ch == '"') inDouble = false;
                    i++;
                }
            }
            else if (ch == '\'') { inSingle = true;  i++; }
            else if (ch == '"')  { inDouble = true;   i++; }
            else if (ch == '#' && i > 0 && IsWhitespace(text[i - 1]))
                return null; // comment before colon
            else if (ch == ':' && (i + 1 == text.Length || text[i + 1] == ' '))
            {
                string key = text[..i].TrimEnd();
                string rest = text[(i + 1)..];
                string valueTrimmed = rest.TrimStart(' ', '\t');
                if (valueTrimmed.Length == 0 || valueTrimmed.StartsWith('#'))
                    return new MappingEntry(key, null);
                return new MappingEntry(key, valueTrimmed);
            }
            else i++;
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // The one-pass scanner (Scanner + helpers extracted to avoid method-too-long)
    // -------------------------------------------------------------------------

    private sealed class Scanner
    {
        private readonly List<YamlEvent> _events = new();
        private readonly List<Frame> _stack = new();

        public Scanner() => _events.Add(new YamlEvent.StreamStart());

        public IReadOnlyList<YamlEvent> Events => _events;
        public int StackCount => _stack.Count;
        public int StackTopIndent => _stack[^1].Indent;

        public void PushContainer(int indent, ContainerKind kind)
        {
            _stack.Add(new Frame(indent, kind));
            _events.Add(kind == ContainerKind.Mapping
                ? new YamlEvent.MappingStart()
                : (YamlEvent)new YamlEvent.SequenceStart());
        }

        public void PopGreaterThan(int indent)
        {
            while (_stack.Count > 0 && _stack[^1].Indent > indent)
            {
                Frame frame = _stack[^1];
                _stack.RemoveAt(_stack.Count - 1);
                _events.Add(frame.Kind == ContainerKind.Mapping
                    ? new YamlEvent.MappingEnd()
                    : (YamlEvent)new YamlEvent.SequenceEnd());
            }
        }

        public bool TopIsSequence() => _stack[^1].Kind == ContainerKind.Sequence;

        /// <summary>Map keys are ALWAYS Scalar kind=Str.</summary>
        public (bool ok, YamlFeedback feedback) EmitKey(string key)
        {
            var (ok, scalar, fb) = ParseValue(key);
            if (!ok) return (false, fb);
            _events.Add(new YamlEvent.Scalar(scalar.Raw, ScalarKind.Str, scalar.Style));
            return (true, default);
        }

        public void EmitNull() =>
            _events.Add(new YamlEvent.Scalar(string.Empty, ScalarKind.Null, ScalarStyle.Plain));

        public (bool ok, YamlFeedback feedback) EmitValue(string value)
        {
            var (ok, scalar, fb) = ParseValue(value);
            if (!ok) return (false, fb);
            _events.Add(new YamlEvent.Scalar(scalar.Raw, scalar.Kind, scalar.Style));
            return (true, default);
        }

        public void PopAll()
        {
            while (_stack.Count > 0)
            {
                Frame frame = _stack[^1];
                _stack.RemoveAt(_stack.Count - 1);
                _events.Add(frame.Kind == ContainerKind.Mapping
                    ? new YamlEvent.MappingEnd()
                    : (YamlEvent)new YamlEvent.SequenceEnd());
            }
            _events.Add(new YamlEvent.StreamEnd());
        }
    }

    private static int? ChildIndentAt(ContentLine[] lines, int idx) =>
        idx + 1 < lines.Length ? lines[idx + 1].Indent : null;

    private static ContainerKind PeekChildKind(ContentLine[] lines, int idx, int childIndent)
    {
        if (idx + 1 < lines.Length && lines[idx + 1].Indent == childIndent)
        {
            string nextText = lines[idx + 1].Text;
            if (string.Equals(nextText, "-", StringComparison.Ordinal) ||
                nextText.StartsWith("- ", StringComparison.Ordinal))
                return ContainerKind.Sequence;
        }
        return ContainerKind.Mapping;
    }

    // Process a sequence item line; returns null on success, a feedback on failure.
    private static YamlFeedback? ProcessSeqItem(Scanner s, ContentLine[] lines, int li, int indent, string body)
    {
        string afterDash = string.Equals(body, "-", StringComparison.Ordinal) ? string.Empty : body[2..];
        string itemContent = afterDash.TrimStart(' ', '\t');

        if (itemContent.Length == 0 || itemContent.StartsWith('#'))
        {
            int? childIndent = ChildIndentAt(lines, li);
            if (childIndent.HasValue && childIndent.Value > indent)
                s.PushContainer(childIndent.Value, PeekChildKind(lines, li, childIndent.Value));
            else
                s.EmitNull();
            return null;
        }

        MappingEntry? inner = SplitMappingEntry(itemContent);
        if (inner.HasValue)
        {
            // Compact mapping item ("- id: x"): open the item's mapping at the
            // content indent (column of first char after "- ").
            int lead = body.Length - itemContent.Length;
            int mapIndent = indent + lead;
            s.PushContainer(mapIndent, ContainerKind.Mapping);

            var (keyOk, keyFb) = s.EmitKey(inner.Value.Key);
            if (!keyOk) return keyFb;

            if (inner.Value.Value is not null)
            {
                var (valOk, valFb) = s.EmitValue(inner.Value.Value);
                if (!valOk) return valFb;
            }
            else
            {
                int? childIndent = ChildIndentAt(lines, li);
                if (childIndent.HasValue && childIndent.Value > mapIndent)
                    s.PushContainer(childIndent.Value, PeekChildKind(lines, li, childIndent.Value));
                else
                    s.EmitNull();
            }
        }
        else
        {
            // plain scalar item
            var (valOk, valFb) = s.EmitValue(itemContent);
            if (!valOk) return valFb;
        }
        return null;
    }

    // Process a mapping entry line; returns null on success, a feedback on failure.
    private static YamlFeedback? ProcessMappingEntry(Scanner s, ContentLine[] lines, int li, int indent, string body)
    {
        MappingEntry? entry = SplitMappingEntry(body);
        if (!entry.HasValue) return YamlFeedback.UnsupportedConstruct;

        var (keyOk, keyFb) = s.EmitKey(entry.Value.Key);
        if (!keyOk) return keyFb;

        if (entry.Value.Value is not null)
        {
            var (valOk, valFb) = s.EmitValue(entry.Value.Value);
            if (!valOk) return valFb;
        }
        else
        {
            int? childIndent = ChildIndentAt(lines, li);
            if (childIndent.HasValue && childIndent.Value > indent)
                s.PushContainer(childIndent.Value, PeekChildKind(lines, li, childIndent.Value));
            else
                s.EmitNull();
        }
        return null;
    }

    private static ReadResult Scan(string text)
    {
        var (linesOk, lineList, linesFb) = ToContentLines(text);
        if (!linesOk) return ReadResult.Failure(linesFb);

        ContentLine[] lines = lineList!.ToArray();
        var s = new Scanner();

        for (int li = 0; li < lines.Length; li++)
        {
            int indent = lines[li].Indent;
            string body = lines[li].Text;

            if (IsDocumentMarker(body))
                return ReadResult.Failure(YamlFeedback.UnsupportedConstruct);

            bool isSeqItem = string.Equals(body, "-", StringComparison.Ordinal) ||
                             body.StartsWith("- ", StringComparison.Ordinal);

            // --- Indent management ---
            if (s.StackCount == 0)
            {
                s.PushContainer(indent, isSeqItem ? ContainerKind.Sequence : ContainerKind.Mapping);
            }
            else if (indent <= s.StackTopIndent)
            {
                s.PopGreaterThan(indent);
                if (s.StackCount == 0 || s.StackTopIndent != indent)
                    return ReadResult.Failure(YamlFeedback.UnexpectedIndent);
                if (isSeqItem != s.TopIsSequence())
                    return ReadResult.Failure(YamlFeedback.UnexpectedIndent);
            }
            // indent > top: deeper container was opened proactively by prior key/seq-item peek.

            YamlFeedback? fb = isSeqItem
                ? ProcessSeqItem(s, lines, li, indent, body)
                : ProcessMappingEntry(s, lines, li, indent, body);

            if (fb.HasValue) return ReadResult.Failure(fb.Value);
        }

        s.PopAll();
        return ReadResult.Success(s.Events);
    }

    /// <summary>
    /// Read the L1 event stream from <paramref name="text"/> in one forward pass, or decline
    /// via <see cref="YamlFeedback"/> on out-of-subset input.
    /// </summary>
    public static ReadResult ReadEvents(string text) => Scan(text);
}
