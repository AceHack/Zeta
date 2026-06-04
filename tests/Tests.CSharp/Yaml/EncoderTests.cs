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
}
