using System.IO;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;
using Hlc = Zeta.Core.CSharp.UncertainClock.Hlc;

namespace Zeta.Tests.CSharp;

/// <summary>
/// UncertainClock cross-language agreement — the C# oracle replays the shared seed
/// (<c>src/Core.TypeScript/uncertain-clock/golden-vectors.json</c>) that the F#/TS/Rust oracles also
/// verify. All values are exact int64, so the full surface byte-locks (no float caveat).
/// </summary>
public class UncertainClockCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(UncertainClockCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new DirectoryNotFoundException("Could not locate repo root (Zeta.sln).");
    }

    private static JsonElement Seed()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "uncertain-clock", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    private static Hlc ReadHlc(JsonElement e) =>
        new(e.GetProperty("physical").GetInt64(), e.GetProperty("logical").GetInt64());

    [Fact]
    public void CompareHlcAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("compareHlc").EnumerateArray())
        {
            Assert.Equal(v.GetProperty("result").GetInt32(),
                UncertainClock.CompareHlc(ReadHlc(v.GetProperty("a")), ReadHlc(v.GetProperty("b"))));
        }
    }

    [Fact]
    public void SendAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("send").EnumerateArray())
        {
            Assert.Equal(ReadHlc(v.GetProperty("result")),
                UncertainClock.Send(ReadHlc(v.GetProperty("clock")), v.GetProperty("now").GetInt64()));
        }
    }

    [Fact]
    public void ReceiveAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("receive").EnumerateArray())
        {
            Assert.Equal(ReadHlc(v.GetProperty("result")),
                UncertainClock.Receive(ReadHlc(v.GetProperty("clock")), ReadHlc(v.GetProperty("msg")), v.GetProperty("now").GetInt64()));
        }
    }

    [Fact]
    public void DefinitelyBeforeAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("definitelyBefore").EnumerateArray())
        {
            var a = v.GetProperty("a");
            var b = v.GetProperty("b");
            Assert.Equal(v.GetProperty("result").GetBoolean(),
                UncertainClock.DefinitelyBefore(
                    a.GetProperty("physical").GetInt64(), a.GetProperty("eps").GetInt64(),
                    b.GetProperty("physical").GetInt64(), b.GetProperty("eps").GetInt64()));
        }
    }

    [Fact]
    public void UncertainAgreesWithSeed()
    {
        foreach (var v in Seed().GetProperty("uncertain").EnumerateArray())
        {
            var a = v.GetProperty("a");
            var b = v.GetProperty("b");
            Assert.Equal(v.GetProperty("result").GetBoolean(),
                UncertainClock.Uncertain(
                    a.GetProperty("physical").GetInt64(), a.GetProperty("eps").GetInt64(),
                    b.GetProperty("physical").GetInt64(), b.GetProperty("eps").GetInt64()));
        }
    }
}
