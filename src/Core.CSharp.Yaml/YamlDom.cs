// Layer 2: the DOM fold (YamlDom.Parse), built ON TOP of the L1 event stream.
//
// This is the JsonDocument half of the Utf8JsonReader-vs-JsonDocument split: YamlReader.cs
// scans once and emits events; this file folds that flat event stream into a value tree. It
// does NOT re-scan text -- it consumes ReadEvents output. Faithful port of the F# reference
// src/Core.FSharp.Yaml/Dom.fs.

namespace Zeta.Core.CSharp.Yaml;

using System.Globalization;

/// <summary>
/// Folds a flat <see cref="YamlEvent"/> stream into a <see cref="YamlValue"/> tree.
/// </summary>
public static class YamlDom
{
    private static ParseResult ScalarToValue(string raw, ScalarKind kind)
    {
        return kind switch
        {
            ScalarKind.Null => ParseResult.Success(YamlValue.YNull.Instance),
            ScalarKind.Bool => ParseResult.Success(new YamlValue.YBool(
                string.Equals(raw, "true", StringComparison.Ordinal) ||
                string.Equals(raw, "True", StringComparison.Ordinal) ||
                string.Equals(raw, "TRUE", StringComparison.Ordinal))),
            ScalarKind.Int =>
                long.TryParse(raw, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out long iv)
                    ? ParseResult.Success(new YamlValue.YInt(iv))
                    : ParseResult.Failure(YamlFeedback.UnexpectedCharacter),
            ScalarKind.Float =>
                double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out double dv)
                    ? ParseResult.Success(new YamlValue.YFloat(dv))
                    : ParseResult.Failure(YamlFeedback.UnexpectedCharacter),
            _ => ParseResult.Success(new YamlValue.YStr(raw)), // ScalarKind.Str
        };
    }

    /// <summary>Cursor-based fold over the flat event array.</summary>
    private sealed class Folder(IReadOnlyList<YamlEvent> events)
    {
        private int _pos;

        private YamlEvent? Peek() => _pos < events.Count ? events[_pos] : null;

        private YamlEvent? Next()
        {
            YamlEvent? ev = Peek();
            if (ev is not null) _pos++;
            return ev;
        }

        private bool Expect<T>(out YamlFeedback feedback) where T : YamlEvent
        {
            YamlEvent? ev = Next();
            if (ev is T) { feedback = default; return true; }
            feedback = YamlFeedback.UnsupportedConstruct;
            return false;
        }

        // top-level: StreamStart <value> StreamEnd
        public ParseResult Fold()
        {
            if (!Expect<YamlEvent.StreamStart>(out YamlFeedback fb1)) return ParseResult.Failure(fb1);
            ParseResult valueResult = FoldValue();
            if (!valueResult.Ok) return valueResult;
            if (!Expect<YamlEvent.StreamEnd>(out YamlFeedback fb2)) return ParseResult.Failure(fb2);
            return valueResult;
        }

        private ParseResult FoldValue()
        {
            YamlEvent? ev = Peek();
            if (ev is null) return ParseResult.Failure(YamlFeedback.UnsupportedConstruct);
            if (ev is YamlEvent.Scalar sc) { _pos++; return ScalarToValue(sc.Raw, sc.Kind); }
            if (ev is YamlEvent.MappingStart) return FoldMapping();
            if (ev is YamlEvent.SequenceStart) return FoldSequence();
            return ParseResult.Failure(YamlFeedback.UnsupportedConstruct);
        }

        private ParseResult FoldMapping()
        {
            if (!Expect<YamlEvent.MappingStart>(out YamlFeedback fb)) return ParseResult.Failure(fb);
            var entries = new List<KeyValuePair<string, YamlValue>>();
            while (true)
            {
                YamlEvent? top = Peek();
                if (top is null) return ParseResult.Failure(YamlFeedback.UnsupportedConstruct);
                if (top is YamlEvent.MappingEnd) { _pos++; break; }

                YamlEvent.Scalar? keyEv = Next() as YamlEvent.Scalar;
                if (keyEv is null) return ParseResult.Failure(YamlFeedback.UnsupportedConstruct);

                ParseResult valueResult = FoldValue();
                if (!valueResult.Ok) return valueResult;
                entries.Add(new KeyValuePair<string, YamlValue>(keyEv.Raw, valueResult.Value!));
            }
            return ParseResult.Success(new YamlValue.YMap(entries));
        }

        private ParseResult FoldSequence()
        {
            if (!Expect<YamlEvent.SequenceStart>(out YamlFeedback fb)) return ParseResult.Failure(fb);
            var items = new List<YamlValue>();
            while (true)
            {
                YamlEvent? top = Peek();
                if (top is null) return ParseResult.Failure(YamlFeedback.UnsupportedConstruct);
                if (top is YamlEvent.SequenceEnd) { _pos++; break; }

                ParseResult itemResult = FoldValue();
                if (!itemResult.Ok) return itemResult;
                items.Add(itemResult.Value!);
            }
            return ParseResult.Success(new YamlValue.YSeq(items));
        }
    }

    /// <summary>
    /// Parse <paramref name="text"/> into a <see cref="YamlValue"/> tree, or decline via
    /// <see cref="YamlFeedback"/>.
    /// </summary>
    public static ParseResult Parse(string text)
    {
        ReadResult readResult = YamlReader.ReadEvents(text);
        if (!readResult.Ok) return ParseResult.Failure(readResult.Feedback!.Value);
        return new Folder(readResult.Events!).Fold();
    }
}
