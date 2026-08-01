using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp.Yaml;

namespace Zeta.Tests.CSharp.Yaml;

/// <summary>
/// C# canonical YAML encoder — (1) BYTE-IDENTICAL to the F#/TS encoders
/// (cross-language byte-lock; the expected strings are the F# encoder's fsi output)
/// and (2) round-trips with the parser. YAML is the storage of record.
/// </summary>
public class EncoderTests
{
    private static YamlValue.YInt I(long n) => new(n);
    private static YamlValue.YStr Str(string s) => new(s);

    private static YamlValue.YMap Map(params (string Key, YamlValue Val)[] entries) =>
        new(entries.Select(e => new KeyValuePair<string, YamlValue>(e.Key, e.Val)).ToList());

    private static YamlValue.YSeq Seq(params YamlValue[] items) => new(items.ToList());

    // round-trip via re-encode (canonical encode is deterministic, so equal values
    // re-encode equal — avoids relying on YamlValue structural equality).
    private static bool Roundtrips(YamlValue v)
    {
        var r = YamlDom.Parse(YamlEncoder.Encode(v));
        return r.Ok && string.Equals(YamlEncoder.Encode(r.Value!), YamlEncoder.Encode(v), System.StringComparison.Ordinal);
    }

    [Fact]
    public void ByteLockFlatMatchesFSharp()
    {
        var v = Map(("b", I(2)), ("a", Str("x")), ("n", YamlValue.YNull.Instance));
        Assert.Equal("\"b\": 2\n\"a\": \"x\"\n\"n\": null\n", YamlEncoder.Encode(v));
    }

    [Fact]
    public void ByteLockNestedMatchesFSharp()
    {
        var v = Map(
            ("outer", Map(("inner", I(5)))),
            ("list", Seq(I(1), Str("two"))));
        Assert.Equal("\"outer\":\n  \"inner\": 5\n\"list\":\n  - 1\n  - \"two\"\n", YamlEncoder.Encode(v));
    }

    [Fact]
    public void StringsRoundTripAsMapValues()
    {
        foreach (var s in new[]
                 {
                     "123", "true", "null", "", "  sp  ", "a: b", "# c", "- d", "[x", "{y", "&z",
                     "line\nbreak", "tab\tsep", "q\"here", "back\\slash", "ret\rurn", "nul\0byte",
                 })
        {
            Assert.True(Roundtrips(Map(("v", Str(s)))), $"failed for {s}");
        }
    }

    [Fact]
    public void NestingRoundTrips()
    {
        var cases = new YamlValue[]
        {
            Seq(I(1), I(2), Str("three")),
            Map(("outer", Map(("inner", I(5))))),
            Map(("list", Seq(I(1), I(2)))),
            Seq(Map(("a", I(1))), Map(("b", I(2)))),
        };
        foreach (var v in cases)
        {
            Assert.True(Roundtrips(v));
        }
    }

    // B-1016 "flow-empty": empty map / empty seq / null are THREE DISTINCT states. Empty
    // collections render INLINE as flow {} / [] (block style cannot carry an empty container);
    // each round-trips to itself (never-collapse).
    [Fact]
    public void EmptyCollectionsRenderInlineFlowAndStayDistinct()
    {
        var emptyMap = Map(("v", new YamlValue.YMap(new List<KeyValuePair<string, YamlValue>>())));
        var emptySeq = Map(("v", new YamlValue.YSeq(new List<YamlValue>())));
        var nullVal = Map(("v", YamlValue.YNull.Instance));

        // Encoded forms.
        Assert.Equal("\"v\": {}\n", YamlEncoder.Encode(emptyMap));
        Assert.Equal("\"v\": []\n", YamlEncoder.Encode(emptySeq));
        Assert.Equal("\"v\": null\n", YamlEncoder.Encode(nullVal));

        // All three distinct.
        var encMap = YamlEncoder.Encode(emptyMap);
        var encSeq = YamlEncoder.Encode(emptySeq);
        var encNull = YamlEncoder.Encode(nullVal);
        Assert.NotEqual(encMap, encSeq, StringComparer.Ordinal);
        Assert.NotEqual(encMap, encNull, StringComparer.Ordinal);
        Assert.NotEqual(encSeq, encNull, StringComparer.Ordinal);

        // Each round-trips to itself, and the parsed value carries the right kind.
        Assert.True(Roundtrips(emptyMap));
        Assert.True(Roundtrips(emptySeq));
        Assert.True(Roundtrips(nullVal));

        var pMap = YamlDom.Parse(encMap);
        var pSeq = YamlDom.Parse(encSeq);
        var pNull = YamlDom.Parse(encNull);
        Assert.True(pMap.Ok && pSeq.Ok && pNull.Ok);
        var mapInner = Assert.IsType<YamlValue.YMap>(((YamlValue.YMap)pMap.Value!).Entries[0].Value);
        var seqInner = Assert.IsType<YamlValue.YSeq>(((YamlValue.YMap)pSeq.Value!).Entries[0].Value);
        Assert.Empty(mapInner.Entries);
        Assert.Empty(seqInner.Items);
        Assert.IsType<YamlValue.YNull>(((YamlValue.YMap)pNull.Value!).Entries[0].Value);
    }
}
