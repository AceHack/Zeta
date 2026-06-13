using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.TriBoolean;
using Zeta.Core.CSharp.Yaml;

namespace Zeta.Tests.CSharp.TriBoolean;

/// <summary>
/// Reads tests/cross-verification/tri-boolean/vectors.yaml via our YAML port,
/// evaluates TriBoolean operations on each vector, and writes cs-output.json.
/// </summary>
public class CrossVerifyTests
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private static IReadOnlyList<KeyValuePair<string, YamlValue>> MapEntries(YamlValue v, string ctx) =>
        v is YamlValue.YMap m
            ? m.Entries
            : throw new InvalidOperationException($"expected Map at {ctx}, got {v.GetType().Name}");

    private static YamlValue Field(IReadOnlyList<KeyValuePair<string, YamlValue>> entries, string key, string ctx)
    {
        foreach (var kvp in entries)
            if (string.Equals(kvp.Key, key, StringComparison.Ordinal))
                return kvp.Value;
        throw new InvalidOperationException($"missing field '{key}' at {ctx}");
    }

    private static string AsStr(YamlValue v, string ctx) =>
        v is YamlValue.YStr s
            ? s.Value
            : throw new InvalidOperationException($"expected Str at {ctx}, got {v.GetType().Name}");

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(CrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
            dir = dir.Parent;
        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static Tri ToTri(string s) => s switch
    {
        "T" => Tri.T,
        "F" => Tri.F,
        "N" => Tri.N,
        _ => throw new InvalidOperationException($"unknown tri state: {s}")
    };

    private static string ToStr(Tri t) => t switch
    {
        Tri.TrueCell => "T",
        Tri.FalseCell => "F",
        Tri.NCell => "N",
        _ => throw new InvalidOperationException("unknown cell subclass")
    };

    private static Dictionary<string, object> ProcessUnary(YamlValue val, string ctx)
    {
        var m = MapEntries(val, ctx);
        var stateStr = AsStr(Field(m, "state", ctx), $"{ctx}.state");
        var t = ToTri(stateStr);

        var mRes = TriOps.Measure(t);
        bool measureOk = mRes is MeasureResult.Resolved;
        bool measureValue = mRes is MeasureResult.Resolved r && r.Value;
        string measureFeedback = mRes is MeasureResult.Collapsed c
            ? (c.Feedback == CollapseFeedback.CollapsedLivingUncertainty ? "collapsed-living-uncertainty" : "")
            : "";

        return new Dictionary<string, object>(StringComparer.Ordinal)
        {
            ["type"] = "unary",
            ["state"] = stateStr,
            ["isLiving"] = TriOps.IsLiving(t),
            ["isCertain"] = TriOps.IsCertain(t),
            ["notState"] = ToStr(TriOps.NotTri(t)),
            ["cooperateState"] = ToStr(TriOps.Cooperate(t)),
            ["measureOk"] = measureOk,
            ["measureValue"] = measureValue,
            ["measureFeedback"] = measureFeedback,
            ["mapNot"] = ToStr(TriOps.MapTri(t, b => !b)),
            ["bindNot"] = ToStr(TriOps.BindTri(t, b => TriOps.FromBool(!b))),
            ["bindToT"] = ToStr(TriOps.BindTri(t, _ => Tri.T))
        };
    }

    private static Dictionary<string, object> ProcessBinary(YamlValue val, string ctx)
    {
        var m = MapEntries(val, ctx);
        var leftStr = AsStr(Field(m, "left", ctx), $"{ctx}.left");
        var rightStr = AsStr(Field(m, "right", ctx), $"{ctx}.right");
        var left = ToTri(leftStr);
        var right = ToTri(rightStr);

        return new Dictionary<string, object>(StringComparer.Ordinal)
        {
            ["type"] = "binary",
            ["left"] = leftStr,
            ["right"] = rightStr,
            ["expectedAnd"] = ToStr(TriOps.AndTri(left, right)),
            ["expectedOr"] = ToStr(TriOps.OrTri(left, right))
        };
    }

    [Fact]
    public void CrossVerifyTriBooleanVectorsMatchParity()
    {
        var root = RepoRoot();
        var yamlPath = Path.Join(root, "tests", "cross-verification", "tri-boolean", "vectors.yaml");
        var yamlText = File.ReadAllText(yamlPath);

        ParseResult parsed = YamlDom.Parse(yamlText);
        if (!parsed.Ok)
            throw new InvalidOperationException($"YAML port declined vectors.yaml: {parsed.Feedback}");

        var top = MapEntries(parsed.Value!, "<root>");
        if (Field(top, "vectors", "<root>") is not YamlValue.YSeq seq)
            throw new InvalidOperationException("expected Seq at vectors");

        var results = new Dictionary<string, object>(StringComparer.Ordinal);

        for (int i = 0; i < seq.Items.Count; i++)
        {
            var ctx = $"vectors[{i}]";
            var item = seq.Items[i];
            var m = MapEntries(item, ctx);

            var id = AsStr(Field(m, "id", ctx), $"{ctx}.id");
            var type = AsStr(Field(m, "type", ctx), $"{ctx}.type");

            if (string.Equals(type, "unary", StringComparison.Ordinal))
            {
                results[id] = ProcessUnary(item, ctx);
            }
            else if (string.Equals(type, "binary", StringComparison.Ordinal))
            {
                results[id] = ProcessBinary(item, ctx);
            }
        }

        // Write cs-output.json for compare.ts.
        var outputPath = Path.Join(root, "tests", "cross-verification", "tri-boolean", "cs-output.json");
        var json = JsonSerializer.Serialize(results, JsonOptions);
        var lfJson = json.Replace("\r\n", "\n").Replace("\r", "\n");
        File.WriteAllText(outputPath, lfJson, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
    }
}
