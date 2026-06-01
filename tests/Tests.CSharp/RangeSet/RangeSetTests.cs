using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.RangeSet;

namespace Zeta.Tests.CSharp.RangeSet;

/// <summary>
/// RangeSet — the C# oracle (#3 of TS/F#/C#/Rust). The TS reference
/// (<c>src/Core.TypeScript/range-set/</c>) authors the shared golden vectors; this replays them:
/// <c>Render(Parse(input))</c> == canonical (the cross-language byte lock) + <c>Contains</c>
/// agrees, and the rejection vectors decline the SPECIFIC feedback variant. "The compilers don't lie."
/// </summary>
public class RangeSetTests
{
    private static string GoldenPath()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(RangeSetTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        var root = dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
        return Path.Join(root, "src", "Core.TypeScript", "range-set", "golden-vectors.json");
    }

    private static IReadOnlyList<Interval> ParseOk(string input) =>
        Assert.IsType<Result<IReadOnlyList<Interval>, RangeSetFeedback>.Ok>(RangeSets.Parse(input)).Value;

    private static string FeedbackName(RangeSetFeedback f) => f switch
    {
        RangeSetFeedback.NotInteger => "NotInteger",
        RangeSetFeedback.InvertedRange => "InvertedRange",
        RangeSetFeedback.Malformed => "Malformed",
        _ => "?",
    };

    [Fact]
    public void ReplaysEverySharedGoldenCaseRenderEqualsCanonicalAndContainsAgrees()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(GoldenPath()));
        var cases = doc.RootElement.GetProperty("cases").EnumerateArray().ToList();
        Assert.NotEmpty(cases);

        foreach (var c in cases)
        {
            var input = c.GetProperty("input").GetString()!;
            var canonical = c.GetProperty("canonical").GetString()!;
            var rs = ParseOk(input);
            Assert.Equal(canonical, RangeSets.Render(rs));
            // canonical is a fixed point of parse->render
            Assert.Equal(canonical, RangeSets.Render(ParseOk(canonical)));

            foreach (var probe in c.GetProperty("contains").EnumerateArray())
            {
                var arr = probe.EnumerateArray().ToList();
                Assert.Equal(arr[1].GetBoolean(), RangeSets.Contains(rs, arr[0].GetInt64()));
            }
        }
    }

    [Fact]
    public void RejectionVectorsDeclineTheSpecificFeedbackVariant()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(GoldenPath()));
        foreach (var r in doc.RootElement.GetProperty("rejections").EnumerateArray())
        {
            var input = r.GetProperty("input").GetString()!;
            var expected = r.GetProperty("feedback").GetString()!;
            var err = Assert.IsType<Result<IReadOnlyList<Interval>, RangeSetFeedback>.Err>(RangeSets.Parse(input));
            Assert.Equal(expected, FeedbackName(err.Error));
        }
    }

    [Fact]
    public void StructuralLawsUnionAddSizeCoalesceAndCount()
    {
        Assert.Equal("1-6", RangeSets.Render(RangeSets.Union(ParseOk("1-3"), ParseOk("4-6"))));
        Assert.Equal("1-6,10-14", RangeSets.Render(RangeSets.Union(ParseOk("1-5,10-12"), ParseOk("6,13-14"))));
        Assert.Equal("1-7", RangeSets.Render(RangeSets.Add(ParseOk("1-3,5-7"), 4)));
        Assert.Equal("1-3,10", RangeSets.Render(RangeSets.Add(ParseOk("1-3"), 10)));
        Assert.Equal(0L, RangeSets.Size(ParseOk("")));
        Assert.Equal(14L, RangeSets.Size(ParseOk("1-5,8,10-17")));
    }

    [Fact]
    public void ParseNullDeclinesMalformedRatherThanThrowing()
    {
        // result-over-throw / no-exception-crosses-boundary: null must decline a feedback
        // variant, never NRE on s.Trim() (C#-specific parity; the other oracles are non-null by type).
        var err = Assert.IsType<Result<IReadOnlyList<Interval>, RangeSetFeedback>.Err>(RangeSets.Parse(null!));
        Assert.IsType<RangeSetFeedback.Malformed>(err.Error);
    }
}
