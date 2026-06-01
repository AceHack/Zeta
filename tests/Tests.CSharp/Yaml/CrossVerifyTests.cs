// C# oracle (oracle #4) cross-verify + YamlDotNet differential.
//
// The fixture tests/cross-verification/yaml/vectors.json is JSON (NOT YAML -- do not use
// YAML to test YAML). Read it via System.Text.Json. For each vector run ReadEvents, assert
// the event list equals the fixture's expected, and serialize { id: events } to
// cs-output.json in the same shape as ts-output.json so compare.ts can Bun.deepEquals
// TS == F# == Rust == C#.
//
// Plus a differential [Fact]: drive YamlDotNet's own forward-only event-level parser
// (YamlDotNet.Core.Parser over a StringReader) and compare its event stream to OUR
// ReadEvents output -- structure + raw + style only (YamlDotNet does not resolve our
// core-schema kind, so kind is ignored; kind is OUR contract, already validated by
// vectors.json above).

namespace Zeta.Tests.CSharp.Yaml;

using System.IO;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.Yaml;

public class CrossVerifyTests
{
    // -------------------------------------------------------------------------
    // Repo-root walk (Zeta.sln sentinel; mirrors ZetaId CrossVerifyTests)
    // -------------------------------------------------------------------------

    private static string RepoRoot()
    {
        DirectoryInfo? dir = new DirectoryInfo(Path.GetDirectoryName(typeof(CrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
            dir = dir.Parent;
        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static string YamlDir() => Path.Join(RepoRoot(), "tests", "cross-verification", "yaml");

    // -------------------------------------------------------------------------
    // Enum <-> contract string mapping (the cross-language names)
    // -------------------------------------------------------------------------

    private static string KindName(ScalarKind k) => k switch
    {
        ScalarKind.Null  => "Null",
        ScalarKind.Bool  => "Bool",
        ScalarKind.Int   => "Int",
        ScalarKind.Float => "Float",
        _                => "Str",
    };

    private static string StyleName(ScalarStyle s) => s switch
    {
        ScalarStyle.SingleQuoted => "SingleQuoted",
        ScalarStyle.DoubleQuoted => "DoubleQuoted",
        _                        => "Plain",
    };

    private static ScalarKind KindOfName(string name) => name switch
    {
        "Null"  => ScalarKind.Null,
        "Bool"  => ScalarKind.Bool,
        "Int"   => ScalarKind.Int,
        "Float" => ScalarKind.Float,
        "Str"   => ScalarKind.Str,
        _       => throw new InvalidOperationException($"Unknown ScalarKind name: {name}"),
    };

    private static ScalarStyle StyleOfName(string name) => name switch
    {
        "SingleQuoted" => ScalarStyle.SingleQuoted,
        "DoubleQuoted" => ScalarStyle.DoubleQuoted,
        "Plain"        => ScalarStyle.Plain,
        _              => throw new InvalidOperationException($"Unknown ScalarStyle name: {name}"),
    };

    // -------------------------------------------------------------------------
    // JSON event (de)serialization (shape matches ts-output.json)
    // -------------------------------------------------------------------------

    private static YamlEvent EventFromJson(JsonElement el)
    {
        string tag = el.GetProperty("e").GetString()!;
        return tag switch
        {
            "StreamStart"   => new YamlEvent.StreamStart(),
            "StreamEnd"     => new YamlEvent.StreamEnd(),
            "MappingStart"  => new YamlEvent.MappingStart(),
            "MappingEnd"    => new YamlEvent.MappingEnd(),
            "SequenceStart" => new YamlEvent.SequenceStart(),
            "SequenceEnd"   => new YamlEvent.SequenceEnd(),
            "Scalar" =>
                new YamlEvent.Scalar(
                    el.GetProperty("raw").GetString()!,
                    KindOfName(el.GetProperty("kind").GetString()!),
                    StyleOfName(el.GetProperty("style").GetString()!)),
            _ => throw new InvalidOperationException($"Unknown event tag: {tag}"),
        };
    }

    // Serialize one event to the cross-verify JSON shape.
    // Uses manual StringBuilder to avoid JsonSerializer overhead and control key order.
    private static string EventToJson(YamlEvent e)
    {
        if (e is YamlEvent.Scalar sc)
        {
            // { "e": "Scalar", "raw": "...", "kind": "...", "style": "..." }
            // Use JsonSerializer to handle escaping of raw and kind/style strings.
            string rawJson  = JsonSerializer.Serialize(sc.Raw);
            string kindJson = JsonSerializer.Serialize(KindName(sc.Kind));
            string styleJson = JsonSerializer.Serialize(StyleName(sc.Style));
            return $"{{\"e\":\"Scalar\",\"raw\":{rawJson},\"kind\":{kindJson},\"style\":{styleJson}}}";
        }
        string tag = e switch
        {
            YamlEvent.StreamStart   => "StreamStart",
            YamlEvent.StreamEnd     => "StreamEnd",
            YamlEvent.MappingStart  => "MappingStart",
            YamlEvent.MappingEnd    => "MappingEnd",
            YamlEvent.SequenceStart => "SequenceStart",
            YamlEvent.SequenceEnd   => "SequenceEnd",
            _                       => throw new InvalidOperationException($"Unknown event: {e}"),
        };
        return $"{{\"e\":\"{tag}\"}}";
    }

    // -------------------------------------------------------------------------
    // Fixture model
    // -------------------------------------------------------------------------

    private sealed record Vector(string Id, string Yaml, List<YamlEvent> Expected);

    private static List<Vector> LoadVectors()
    {
        string path = Path.Join(YamlDir(), "vectors.json");
        string text = File.ReadAllText(path);
        using JsonDocument doc = JsonDocument.Parse(text);
        var result = new List<Vector>();
        foreach (JsonElement v in doc.RootElement.GetProperty("vectors").EnumerateArray())
        {
            string id   = v.GetProperty("id").GetString()!;
            string yaml = v.GetProperty("yaml").GetString()!;
            var expected = new List<YamlEvent>();
            foreach (JsonElement evEl in v.GetProperty("expected").EnumerateArray())
                expected.Add(EventFromJson(evEl));
            result.Add(new Vector(id, yaml, expected));
        }
        return result;
    }

    // -------------------------------------------------------------------------
    // Cross-verify: events == expected, write cs-output.json
    // -------------------------------------------------------------------------

    [Fact]
    public void CrossVerifyTenYamlVectorsMatchFixtureExpected()
    {
        List<Vector> vectors = LoadVectors();
        var sb = new StringBuilder();
        sb.Append('{');
        bool firstId = true;
        int mismatches = 0;

        foreach (Vector v in vectors)
        {
            ReadResult r = YamlReader.ReadEvents(v.Yaml);
            Assert.True(r.Ok, $"vector {v.Id} declined unexpectedly: feedback={r.Feedback}");
            IReadOnlyList<YamlEvent> actual = r.Events!;

            // Assert events equal the fixture's expected list.
            bool match = actual.Count == v.Expected.Count;
            if (match)
                for (int i = 0; i < actual.Count; i++)
                    if (!actual[i].Equals(v.Expected[i])) { match = false; break; }
            if (!match) mismatches++;

            // Build the JSON for this vector's entry.
            if (!firstId) sb.Append(',');
            firstId = false;
            sb.Append('\n');
            sb.Append("  ");
            sb.Append(JsonSerializer.Serialize(v.Id));
            sb.Append(": [\n");
            bool firstEv = true;
            foreach (YamlEvent ev in actual)
            {
                if (!firstEv) sb.Append(",\n");
                firstEv = false;
                // Indent each event JSON with 4 spaces for readability (matches ts-output.json indent).
                string evJson = EventToJson(ev);
                sb.Append("    ");
                sb.Append(evJson);
            }
            sb.Append('\n');
            sb.Append("  ]");
        }

        sb.Append('\n');
        sb.Append('}');
        sb.Append('\n');

        // Normalise to pure LF (the cross-verification fixtures are pure-LF).
        string json = sb.ToString().Replace("\r\n", "\n", StringComparison.Ordinal);
        File.WriteAllText(Path.Join(YamlDir(), "cs-output.json"), json);

        Assert.Equal(0, mismatches);
    }

    // The ts-output.json shape uses WriteIndented=true with 2-space indentation per key.
    // We need to match it closely so compare.ts deep-equals pass. Let us just serialize
    // with a matching style using JsonSerializerOptions directly.
    // Actually: compare.ts uses Bun.deepEquals on parsed JSON -- key/value equality only,
    // not text equality. So we just need valid JSON with the right structure.
    // EventToJson already produces compact JSON per event; the file wrapper above wraps it.
    // We produce minimal indented-enough output. compare.ts parses the JSON anyway.


    // -------------------------------------------------------------------------
    // YamlDotNet differential
    // -------------------------------------------------------------------------

    private enum DiffTag { MapStart, MapEnd, SeqStart, SeqEnd, Scalar }

    private readonly record struct DiffEvent(DiffTag Tag, string? Raw, ScalarStyle Style);

    private static List<DiffEvent> OurDiffStream(IReadOnlyList<YamlEvent> events)
    {
        var result = new List<DiffEvent>();
        foreach (YamlEvent ev in events)
        {
            switch (ev)
            {
                case YamlEvent.MappingStart:  result.Add(new DiffEvent(DiffTag.MapStart, null, default)); break;
                case YamlEvent.MappingEnd:    result.Add(new DiffEvent(DiffTag.MapEnd,   null, default)); break;
                case YamlEvent.SequenceStart: result.Add(new DiffEvent(DiffTag.SeqStart, null, default)); break;
                case YamlEvent.SequenceEnd:   result.Add(new DiffEvent(DiffTag.SeqEnd,   null, default)); break;
                case YamlEvent.Scalar sc:     result.Add(new DiffEvent(DiffTag.Scalar, sc.Raw, sc.Style)); break;
                // StreamStart / StreamEnd skipped
                default: break;
            }
        }
        return result;
    }

    private static ScalarStyle VendorStyle(YamlDotNet.Core.ScalarStyle s) => s switch
    {
        YamlDotNet.Core.ScalarStyle.SingleQuoted => ScalarStyle.SingleQuoted,
        YamlDotNet.Core.ScalarStyle.DoubleQuoted => ScalarStyle.DoubleQuoted,
        _                                         => ScalarStyle.Plain,
    };

    private static List<DiffEvent> VendorDiffStream(string yaml)
    {
        using var reader = new StringReader(yaml);
        var parser = new YamlDotNet.Core.Parser(reader);
        var acc = new List<DiffEvent>();
        while (parser.MoveNext())
        {
            switch (parser.Current)
            {
                case YamlDotNet.Core.Events.MappingStart:
                    acc.Add(new DiffEvent(DiffTag.MapStart, null, default)); break;
                case YamlDotNet.Core.Events.MappingEnd:
                    acc.Add(new DiffEvent(DiffTag.MapEnd,   null, default)); break;
                case YamlDotNet.Core.Events.SequenceStart:
                    acc.Add(new DiffEvent(DiffTag.SeqStart, null, default)); break;
                case YamlDotNet.Core.Events.SequenceEnd:
                    acc.Add(new DiffEvent(DiffTag.SeqEnd,   null, default)); break;
                case YamlDotNet.Core.Events.Scalar sc:
                    acc.Add(new DiffEvent(DiffTag.Scalar, sc.Value, VendorStyle(sc.Style))); break;
                // Skip StreamStart/End, DocumentStart/End, and anything else.
                default: break;
            }
        }
        return acc;
    }

    [Fact]
    public void YamlDotNetDifferentialAgreesOnAllVectors()
    {
        List<Vector> vectors = LoadVectors();
        int mismatches = 0;
        foreach (Vector v in vectors)
        {
            ReadResult r = YamlReader.ReadEvents(v.Yaml);
            Assert.True(r.Ok, $"vector {v.Id} declined unexpectedly: feedback={r.Feedback}");

            List<DiffEvent> ours   = OurDiffStream(r.Events!);
            List<DiffEvent> theirs = VendorDiffStream(v.Yaml);

            if (ours.Count != theirs.Count) { mismatches++; continue; }
            for (int i = 0; i < ours.Count; i++)
                if (ours[i] != theirs[i]) { mismatches++; break; }
        }
        Assert.Equal(0, mismatches);
    }
}
