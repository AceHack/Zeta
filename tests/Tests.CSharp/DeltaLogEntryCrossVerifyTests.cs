using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Log noun — the C# oracle for the DeltaLogEntry byte-lock (workitem 081KTGD5JMD). Replays the shared
/// seed (<c>src/Core.TypeScript/delta-log-entry/golden-vectors.json</c>) that the F# reference oracle
/// produced, and asserts C# reproduces <b>byte-identical</b> canonical CBOR + round-trips it. A whole
/// entry <c>{ Seq; Delta; Captured }</c> maps to a <c>DynamicValue.Object</c> with the keys
/// <c>captured</c>/<c>delta</c>/<c>seq</c> (ordinal order; <c>Captured</c> keys ordinal-sorted —
/// culture-invariant, B-0969) riding the already-4-language-locked DynamicValue canonical CBOR. So the
/// Log entry inherits the byte-lock with no new canonical encoding (an entry is just a DynamicValue).
/// Mirrors F# <c>DeltaLogEntryDynamic.toDynamicValue</c> (src/Core/DeltaCodec.fs).
/// </summary>
public sealed class DeltaLogEntryCrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(DeltaLogEntryCrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
            dir = dir.Parent;
        if (dir is null) throw new InvalidOperationException("Could not locate repo root (Zeta.sln).");
        return dir.FullName;
    }

    private static DynamicValue.Object EntryToDynamicValue(
        long seq,
        IEnumerable<(string Key, long Weight)> delta,
        IEnumerable<(string Key, string Val)> captured)
    {
        // Canonicalize the delta exactly as the F# ZSet does (sort by key, drop zero weights).
        var zset = ZSet.OfEntries(delta, StringComparer.Ordinal);
        var deltaBuilder = ImmutableArray.CreateBuilder<DynamicValue>();
        foreach (var e in zset.ToImmutableArray())
        {
            deltaBuilder.Add(new DynamicValue.Array(
                ImmutableArray.Create<DynamicValue>(new DynamicValue.String(e.Key), new DynamicValue.Int(e.Weight))));
        }

        // Captured keys ORDINAL-sorted (deterministic across languages + DST).
        var capturedPairs = captured
            .OrderBy(c => c.Key, StringComparer.Ordinal)
            .Select(c => new KeyValuePair<string, DynamicValue>(c.Key, new DynamicValue.String(c.Val)))
            .ToImmutableArray();

        return new DynamicValue.Object(ImmutableArray.Create(
            new KeyValuePair<string, DynamicValue>("captured", new DynamicValue.Object(capturedPairs)),
            new KeyValuePair<string, DynamicValue>("delta", new DynamicValue.Array(deltaBuilder.ToImmutable())),
            new KeyValuePair<string, DynamicValue>("seq", new DynamicValue.Int(seq))));
    }

    [Fact]
    public void CSharpReproducesTheSharedDeltaLogEntrySeedAndRoundTrips()
    {
        var path = Path.Join(RepoRoot(), "src", "Core.TypeScript", "delta-log-entry", "golden-vectors.json");
        Assert.True(File.Exists(path), $"seed not found: {path}");
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var vectors = doc.RootElement.GetProperty("vectors").EnumerateArray().ToArray();
        Assert.True(vectors.Length >= 5, "expected at least 5 golden vectors");

        foreach (var v in vectors)
        {
            var name = v.GetProperty("name").GetString()!;
            var expectedHex = v.GetProperty("cbor").GetString()!;
            var entry = v.GetProperty("entry");
            long seq = entry.GetProperty("seq").GetInt64();
            var delta = entry.GetProperty("delta").EnumerateArray()
                .Select(p =>
                {
                    var a = p.EnumerateArray().ToArray();
                    return (a[0].GetString()!, a[1].GetInt64());
                })
                .ToArray();
            var captured = entry.GetProperty("captured").EnumerateObject()
                .Select(p => (p.Name, p.Value.GetString()!))
                .ToArray();

            var dv = EntryToDynamicValue(seq, delta, captured);

            // encode → must equal the seed hex (the cross-language byte-lock)
            var actualHex = Convert.ToHexString(DynamicValues.ToCanonicalCborOk(dv)).ToLowerInvariant();
            Assert.True(string.Equals(expectedHex, actualHex, StringComparison.Ordinal),
                $"{name}: expected {expectedHex} but got {actualHex}");

            // decode(seed hex) → re-encode → must equal the seed hex (round-trip stability)
            switch (DynamicValues.FromCanonicalCbor(Convert.FromHexString(expectedHex)))
            {
                case Result<DynamicValue, DecodeError>.Ok ok:
                    var reHex = Convert.ToHexString(DynamicValues.ToCanonicalCborOk(ok.Value)).ToLowerInvariant();
                    Assert.True(string.Equals(expectedHex, reHex, StringComparison.Ordinal),
                        $"{name}: round-trip mismatch (re-encoded {reHex})");
                    break;
                case Result<DynamicValue, DecodeError>.Err err:
                    Assert.Fail($"{name}: decode failed: {err.Error}");
                    break;
            }
        }
    }
}
