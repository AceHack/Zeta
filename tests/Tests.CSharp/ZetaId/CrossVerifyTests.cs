using System.Globalization;
using System.IO;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp.Yaml;
using Zeta.Core.CSharp.ZetaId;

namespace Zeta.Tests.CSharp.ZetaId;

public class CrossVerifyTests
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    // --- YamlValue → FlatVector navigation. Own-the-interface: route through our YAML
    // port (Zeta.Core.CSharp.Yaml.YamlDom.Parse), not YamlDotNet directly. The fixture is
    // a top-level YMap with a `vectors:` YSeq of flat YMaps. ---

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

    private static string? TryFieldStr(IReadOnlyList<KeyValuePair<string, YamlValue>> entries, string key)
    {
        foreach (var kvp in entries)
            if (string.Equals(kvp.Key, key, StringComparison.Ordinal))
                return kvp.Value is YamlValue.YStr s ? s.Value : null;
        return null;
    }

    private static string AsStr(YamlValue v, string ctx) =>
        v is YamlValue.YStr s
            ? s.Value
            : throw new InvalidOperationException($"expected Str at {ctx}, got {v.GetType().Name}");

    private static int AsInt(YamlValue v, string ctx) =>
        v is YamlValue.YInt i
            ? checked((int)i.Value)
            : throw new InvalidOperationException($"expected Int at {ctx}, got {v.GetType().Name}");

    private static long AsLong(YamlValue v, string ctx) =>
        v is YamlValue.YInt i
            ? i.Value
            : throw new InvalidOperationException($"expected Int at {ctx}, got {v.GetType().Name}");

    private static int? AsIntOrNull(YamlValue v, string ctx) =>
        v switch
        {
            YamlValue.YNull => (int?)null,
            YamlValue.YInt i => checked((int)i.Value),
            _ => throw new InvalidOperationException($"expected Int or Null at {ctx}, got {v.GetType().Name}"),
        };

    private static FlatVector ToFlatVector(int idx, YamlValue item)
    {
        var ctx = $"vectors[{idx}]";
        var m = MapEntries(item, ctx);
        return new FlatVector
        {
            Id = AsStr(Field(m, "id", ctx), $"{ctx}.id"),
            Version = AsInt(Field(m, "version", ctx), $"{ctx}.version"),
            Timestamp = AsLong(Field(m, "timestamp", ctx), $"{ctx}.timestamp"),
            Chromosome = AsInt(Field(m, "chromosome", ctx), $"{ctx}.chromosome"),
            Category = AsInt(Field(m, "category", ctx), $"{ctx}.category"),
            Firefly = AsInt(Field(m, "firefly", ctx), $"{ctx}.firefly"),
            AuthorityType = AsStr(Field(m, "authority_type", ctx), $"{ctx}.authority_type"),
            AuthorityRaw = AsIntOrNull(Field(m, "authority_raw", ctx), $"{ctx}.authority_raw"),
            Persona = AsInt(Field(m, "persona", ctx), $"{ctx}.persona"),
            MomentumType = AsStr(Field(m, "momentum_type", ctx), $"{ctx}.momentum_type"),
            MomentumRaw = AsIntOrNull(Field(m, "momentum_raw", ctx), $"{ctx}.momentum_raw"),
            Location = AsInt(Field(m, "location", ctx), $"{ctx}.location"),
            ExpectedHex = AsStr(Field(m, "expected_hex", ctx), $"{ctx}.expected_hex"),
            ExpectedCrockford = AsStr(Field(m, "expected_crockford", ctx), $"{ctx}.expected_crockford"),
            Type = TryFieldStr(m, "type"),
            InputCrockford = TryFieldStr(m, "input_crockford"),
        };
    }

    private static List<FlatVector> YamlValueToFlatVectors(YamlValue root)
    {
        var top = MapEntries(root, "<root>");
        if (Field(top, "vectors", "<root>") is not YamlValue.YSeq seq)
            throw new InvalidOperationException("expected Seq at vectors");
        var result = new List<FlatVector>(seq.Items.Count);
        for (int i = 0; i < seq.Items.Count; i++)
            result.Add(ToFlatVector(i, seq.Items[i]));
        return result;
    }

    // Bounds-check int→byte cast before constructing Raw or casting to enum.
    // Without this, e.g. AuthorityRaw=256 wraps to 0 BEFORE Authority.Raw's
    // 0..31 check fires, silently producing wrong packed ID.
    private static byte CheckByte(int value, string fieldName)
    {
        if (value < 0 || value > 255)
            throw new InvalidOperationException(
                $"vectors.yaml field '{fieldName}' = {value} is outside the 0..255 byte range; would wrap silently on int→byte cast.");
        return (byte)value;
    }

    private static Authority ToAuthority(FlatVector v)
    {
        if (string.Equals(v.AuthorityType, "Raw", StringComparison.Ordinal))
            return new Authority.Raw(CheckByte(v.AuthorityRaw!.Value, nameof(v.AuthorityRaw)));

        return v.AuthorityType switch
        {
            "HumanVerified" => new Authority.HumanVerified(),
            "TrustedAgent" => new Authority.TrustedAgent(),
            "Standard" => new Authority.Standard(),
            "BestEffort" => new Authority.BestEffort(),
            "Simulated" => new Authority.Simulated(),
            _ => throw new InvalidOperationException($"Unknown authority_type: {v.AuthorityType}")
        };
    }

    private static Momentum ToMomentum(FlatVector v)
    {
        if (string.Equals(v.MomentumType, "Raw", StringComparison.Ordinal))
            return new Momentum.Raw(CheckByte(v.MomentumRaw!.Value, nameof(v.MomentumRaw)));

        return v.MomentumType switch
        {
            "Background" => new Momentum.Background(),
            "Normal" => new Momentum.Normal(),
            "Elevated" => new Momentum.Elevated(),
            "High" => new Momentum.High(),
            "Critical" => new Momentum.Critical(),
            _ => throw new InvalidOperationException($"Unknown momentum_type: {v.MomentumType}")
        };
    }

    private static Zeta.Core.CSharp.ZetaId.ZetaObservation ToObservation(FlatVector v) =>
        new(
            Version: (IdVersion)CheckByte(v.Version, nameof(v.Version)),
            Timestamp: v.Timestamp,
            Chromosome: (Chromosome)CheckByte(v.Chromosome, nameof(v.Chromosome)),
            Category: (Category)CheckByte(v.Category, nameof(v.Category)),
            Firefly: (Firefly)CheckByte(v.Firefly, nameof(v.Firefly)),
            Authority: ToAuthority(v),
            Persona: (Persona)CheckByte(v.Persona, nameof(v.Persona)),
            Momentum: ToMomentum(v),
            Location: (Location)CheckByte(v.Location, nameof(v.Location))
        );

    private static string RepoRoot()
    {
        // Walk up from the test assembly looking for Zeta.sln (sentinel at repo root).
        // .git is unreliable as a marker because in a git worktree it's a file, not a directory.
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(CrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    [Fact]
#pragma warning disable MA0051
    public void CrossVerifyTwelveVectorsMatchTsBootstrapHex()
    {
        var root = RepoRoot();
        // Path.Join (not Path.Combine) — Path.Join always concatenates segments
        // with a separator, never silently drops earlier args if a later arg
        // looks rooted. CodeQL flags the latter pattern.
        var yamlPath = Path.Join(root, "tests", "cross-verification", "zeta-id", "vectors.yaml");
        var yamlText = File.ReadAllText(yamlPath);

        // Own-the-interface: parse through our YAML port (YamlDom.Parse), not YamlDotNet
        // directly. Decline surfaces as a YamlFeedback, not an exception.
        ParseResult parsed = YamlDom.Parse(yamlText);
        if (!parsed.Ok)
            throw new InvalidOperationException($"our YAML port declined vectors.yaml: {parsed.Feedback}");
        var vectors = YamlValueToFlatVectors(parsed.Value!);

        var results = new Dictionary<string, object>(StringComparer.Ordinal);
        int hexMismatches = 0;
        int roundtripMismatches = 0;

        foreach (var v in vectors)
        {
            string hex;
            string crockford;
            bool roundtripOk;
            bool matchesExpected;

            if (string.Equals(v.Type, "parse-reject", StringComparison.Ordinal))
            {
                bool parseFailed = false;
                try
                {
                    ZetaIdCodec.Parse(v.ExpectedCrockford);
                }
                catch
                {
                    parseFailed = true;
                }
                var canonicalOk = ZetaIdCodec.IsCanonical(v.ExpectedCrockford);

                hex = "rejected";
                crockford = "rejected";
                roundtripOk = parseFailed && !canonicalOk;
                matchesExpected = string.Equals(v.ExpectedHex, "rejected", StringComparison.Ordinal);
            }
            else if (string.Equals(v.Type, "max-128", StringComparison.Ordinal))
            {
                var maxVal = UInt128.MaxValue;
                hex = maxVal.ToString("x32", CultureInfo.InvariantCulture);
                crockford = ZetaIdCodec.Format(maxVal);

                var parsedId = ZetaIdCodec.Parse(crockford);
                var parseOk = parsedId == maxVal;
                var canonicalOk = ZetaIdCodec.IsCanonical(crockford);

                roundtripOk = parseOk && canonicalOk;
                matchesExpected = string.Equals(hex, v.ExpectedHex, StringComparison.Ordinal) && string.Equals(crockford, v.ExpectedCrockford, StringComparison.Ordinal);
            }
            else if (string.Equals(v.Type, "lenient-alias", StringComparison.Ordinal))
            {
                var obs = ToObservation(v);
                var id = ZetaIdCodec.Pack(obs, DeterministicEnv.Instance);
                hex = id.ToString("x32", CultureInfo.InvariantCulture);
                crockford = ZetaIdCodec.Format(id);

                var parsedId = ZetaIdCodec.Parse(v.InputCrockford!);
                var parseOk = parsedId == id;
                var inputCanonicalOk = ZetaIdCodec.IsCanonical(v.InputCrockford!);
                var expectedCanonicalOk = ZetaIdCodec.IsCanonical(v.ExpectedCrockford);

                roundtripOk = parseOk && !inputCanonicalOk && expectedCanonicalOk;
                matchesExpected = string.Equals(hex, v.ExpectedHex, StringComparison.Ordinal) && string.Equals(crockford, v.ExpectedCrockford, StringComparison.Ordinal);
            }
            else
            {
                var obs = ToObservation(v);
                var id = ZetaIdCodec.Pack(obs, DeterministicEnv.Instance);
                hex = id.ToString("x32", CultureInfo.InvariantCulture);
                crockford = ZetaIdCodec.Format(id);

                var unpacked = ZetaIdCodec.Unpack(id);
                var roundtripVal = unpacked == obs;
                var parsedId = ZetaIdCodec.Parse(crockford);
                var parseOk = parsedId == id;
                var canonicalOk = ZetaIdCodec.IsCanonical(crockford);

                roundtripOk = roundtripVal && parseOk && canonicalOk;
                var expectedMatches = string.Equals(hex, v.ExpectedHex, StringComparison.Ordinal);
                var crockfordMatches = string.Equals(crockford, v.ExpectedCrockford, StringComparison.Ordinal);
                matchesExpected = expectedMatches && crockfordMatches;
            }

            results[v.Id] = new { hex, crockford, roundtripOk, matchesExpected };

            if (!roundtripOk) roundtripMismatches++;
            if (!matchesExpected) hexMismatches++;
        }

        var outputPath = Path.Join(root, "tests", "cross-verification", "zeta-id", "cs-output.json");
        var json = JsonSerializer.Serialize(results, JsonOptions);
        File.WriteAllText(outputPath, json);

        Assert.Equal(0, roundtripMismatches);
        Assert.Equal(0, hexMismatches);
    }
#pragma warning restore MA0051
}
