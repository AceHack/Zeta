using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.Bonsai;

namespace Zeta.Tests.CSharp.Bonsai;

/// <summary>
/// Bonsai-subset serializer — the C# oracle (#3 of TS/F#/C#/Rust) for B-0976 slice 1. The TS
/// reference oracle (<c>src/Core.TypeScript/bonsai/</c>) authors the shared golden vectors;
/// this proves the C# impl replays them byte-for-byte: <c>Serialize(Parse(canonical))</c> is
/// <c>Ok canonical</c> (the cross-language byte lock) AND an independently C#-constructed tree
/// serializes to the same canonical bytes. "The compilers don't lie."
///
/// <para>Error channel: <c>Serialize</c>/<c>Parse</c> return <c>Result&lt;_, BonsaiFeedback&gt;</c>
/// (result over throw). The rejection tests assert the SPECIFIC feedback variant, not merely
/// "it failed" — the cross-language rejection-vector contract. The accumulate tests cover
/// <c>ParseAll</c> + RFC-9457 <c>ProblemDetails</c> (collect EVERY decline keyed by JSON-path).</para>
/// </summary>
public class BonsaiTests
{
    private const string ConstIntCanonical = "{\"v\":1,\"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":42}}}";

    // A canonical-shaped doc with three INDEPENDENT bad leaves: an unknown op, a non-string
    // param name, and a fractional int — the accumulate mode collects all three.
    private const string ThreeBadLeaves =
        "{\"v\":1,\"expr\":{\"kind\":\"binary\",\"op\":\"xor\"," +
        "\"left\":{\"kind\":\"param\",\"name\":42}," +
        "\"right\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":1.5}}}}";

    private static readonly string[] ThreeBadLeafPaths =
        ["$.expr.left.name", "$.expr.op", "$.expr.right.value"];

    private static readonly string[] OneParam = ["x"];

    private static string RepoRoot()
    {
        // Walk up from the test assembly to the Zeta.sln sentinel (a worktree's .git is a
        // file, not a dir, so Zeta.sln is the reliable repo-root marker).
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(BonsaiTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static List<(string Name, string Canonical)> GoldenList()
    {
        var list = new List<(string, string)>();
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "bonsai", "golden-vectors.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        foreach (var c in doc.RootElement.GetProperty("cases").EnumerateArray())
        {
            list.Add((c.GetProperty("name").GetString()!, c.GetProperty("canonical").GetString()!));
        }

        return list;
    }

    /// <summary>Each shared golden case's (name, canonical), as theory rows.</summary>
    public static TheoryData<string, string> GoldenCanonicals()
    {
        var td = new TheoryData<string, string>();
        foreach (var (name, canonical) in GoldenList())
        {
            td.Add(name, canonical);
        }

        return td;
    }

    private static Expr ParseOk(string s) =>
        Assert.IsType<Result<Expr, BonsaiFeedback>.Ok>(BonsaiCodec.Parse(s)).Value;

    private static string SerializeOk(Expr e) =>
        Assert.IsType<Result<string, BonsaiFeedback>.Ok>(BonsaiCodec.Serialize(e)).Value;

    [Theory]
    [MemberData(nameof(GoldenCanonicals))]
    public void SerializeIsByteExactFixedPointOfGoldenCanonical(string name, string canonical)
    {
        Assert.False(string.IsNullOrEmpty(name));
        Assert.Equal(canonical, SerializeOk(ParseOk(canonical)));
    }

    [Fact]
    public void EveryGoldenParsesToAStructurallyStableTree()
    {
        var golden = GoldenList();
        Assert.NotEmpty(golden);
        foreach (var (_, canonical) in golden)
        {
            Assert.True(BonsaiCodec.ExprEquals(ParseOk(canonical), ParseOk(canonical)));
        }
    }

    [Fact]
    public void IndependentlyConstructedTreeMatchesGoldenCanonical()
    {
        Assert.Equal(ConstIntCanonical, SerializeOk(Build.CInt(42)));
    }

    // ---- rejection-by-variant (the cross-language rejection-vector contract) ----

    [Fact]
    public void UnsupportedVersionDeclines()
    {
        var err = Assert.IsType<Result<Expr, BonsaiFeedback>.Err>(
            BonsaiCodec.Parse("{\"v\":2,\"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":1}}}"));
        Assert.IsType<BonsaiFeedback.UnsupportedVersion>(err.Error);
    }

    [Fact]
    public void MalformedJsonDeclines()
    {
        var err = Assert.IsType<Result<Expr, BonsaiFeedback>.Err>(BonsaiCodec.Parse("not json"));
        Assert.IsType<BonsaiFeedback.MalformedJson>(err.Error);
    }

    [Fact]
    public void UnknownKindDeclines()
    {
        var err = Assert.IsType<Result<Expr, BonsaiFeedback>.Err>(
            BonsaiCodec.Parse("{\"v\":1,\"expr\":{\"kind\":\"frobnicate\"}}"));
        Assert.IsType<BonsaiFeedback.UnknownKind>(err.Error);
    }

    [Fact]
    public void UnknownConstTagDeclines()
    {
        var err = Assert.IsType<Result<Expr, BonsaiFeedback>.Err>(
            BonsaiCodec.Parse("{\"v\":1,\"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"float\",\"v\":1}}}"));
        Assert.IsType<BonsaiFeedback.UnknownConstTag>(err.Error);
    }

    [Fact]
    public void UnknownOpDeclines()
    {
        var err = Assert.IsType<Result<Expr, BonsaiFeedback>.Err>(
            BonsaiCodec.Parse("{\"v\":1,\"expr\":{\"kind\":\"binary\",\"op\":\"xor\"," +
                "\"left\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":1}}," +
                "\"right\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":2}}}}"));
        Assert.IsType<BonsaiFeedback.UnknownOp>(err.Error);
    }

    [Fact]
    public void NonSafeIntDeclinesOnSerialize()
    {
        var err = Assert.IsType<Result<string, BonsaiFeedback>.Err>(
            BonsaiCodec.Serialize(Build.CInt(9007199254740992L)));
        Assert.IsType<BonsaiFeedback.NonSafeInt>(err.Error);
    }

    [Fact]
    public void NonCanonicalDeclines()
    {
        // structurally valid, but a space after the wrapper comma → not canonical bytes
        var err = Assert.IsType<Result<Expr, BonsaiFeedback>.Err>(
            BonsaiCodec.Parse("{\"v\":1, \"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":42}}}"));
        Assert.IsType<BonsaiFeedback.NonCanonical>(err.Error);
    }

    [Fact]
    public void TooDeepDeclinesOnSerialize()
    {
        Expr deep = Build.CInt(1);
        for (var i = 0; i < BonsaiCodec.MaxDepth + 1; i++)
        {
            deep = Build.Lambda(OneParam, deep);
        }

        var err = Assert.IsType<Result<string, BonsaiFeedback>.Err>(BonsaiCodec.Serialize(deep));
        Assert.IsType<BonsaiFeedback.TooDeep>(err.Error);
    }

    // ---- accumulate-mode (RFC-9457 ProblemDetails) ----

    [Fact]
    public void ParseAllReturnsOkOnGoldenCanonical()
    {
        Assert.IsType<Result<Expr, IReadOnlyList<PathedFeedback>>.Ok>(BonsaiCodec.ParseAll(ConstIntCanonical));
    }

    [Fact]
    public void ParseAllCollectsEveryIndependentDecline()
    {
        var err = Assert.IsType<Result<Expr, IReadOnlyList<PathedFeedback>>.Err>(BonsaiCodec.ParseAll(ThreeBadLeaves));
        var paths = err.Error.Select(pf => pf.Path).OrderBy(p => p, StringComparer.Ordinal).ToArray();
        Assert.Equal(ThreeBadLeafPaths, paths);
    }

    [Fact]
    public void ToProblemDetailsGroupsDeclinesByPath()
    {
        var err = Assert.IsType<Result<Expr, IReadOnlyList<PathedFeedback>>.Err>(BonsaiCodec.ParseAll(ThreeBadLeaves));
        var pd = BonsaiCodec.ToProblemDetails(err.Error);
        var keys = pd.Errors.Keys.OrderBy(k => k, StringComparer.Ordinal).ToArray();
        Assert.Equal(ThreeBadLeafPaths, keys);
    }

    [Fact]
    public void ParseAllReturnsSingleMalformedJson()
    {
        var err = Assert.IsType<Result<Expr, IReadOnlyList<PathedFeedback>>.Err>(BonsaiCodec.ParseAll("not json"));
        var only = Assert.Single(err.Error);
        Assert.Equal("$", only.Path);
        Assert.IsType<BonsaiFeedback.MalformedJson>(only.Feedback);
    }

    [Fact]
    public void ParseAllReturnsSingleNonCanonical()
    {
        var err = Assert.IsType<Result<Expr, IReadOnlyList<PathedFeedback>>.Err>(
            BonsaiCodec.ParseAll("{\"v\":1, \"expr\":{\"kind\":\"const\",\"value\":{\"t\":\"int\",\"v\":42}}}"));
        var only = Assert.Single(err.Error);
        Assert.Equal("$", only.Path);
        Assert.IsType<BonsaiFeedback.NonCanonical>(only.Feedback);
    }
}
