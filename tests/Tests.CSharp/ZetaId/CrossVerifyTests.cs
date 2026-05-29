using System.Globalization;
using System.IO;
using System.Text.Json;
using Xunit;
using YamlDotNet.Serialization;
using Zeta.Core.CSharp.ZetaId;

namespace Zeta.Tests.CSharp.ZetaId;

public class CrossVerifyTests
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

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
    public void CrossVerifyTwelveVectorsMatchTsBootstrapHex()
    {
        var root = RepoRoot();
        // Path.Join (not Path.Combine) — Path.Join always concatenates segments
        // with a separator, never silently drops earlier args if a later arg
        // looks rooted. CodeQL flags the latter pattern.
        var yamlPath = Path.Join(root, "tests", "cross-verification", "zeta-id", "vectors.yaml");
        var yamlText = File.ReadAllText(yamlPath);

        var deserializer = new DeserializerBuilder().Build();
        var envelope = deserializer.Deserialize<VectorEnvelope>(yamlText);

        var results = new Dictionary<string, object>(StringComparer.Ordinal);
        int hexMismatches = 0;
        int roundtripMismatches = 0;

        foreach (var v in envelope.Vectors)
        {
            var obs = ToObservation(v);
            var id = ZetaIdCodec.Pack(obs, DeterministicEnv.Instance);
            var hex = id.ToString("x32", CultureInfo.InvariantCulture);

            var unpacked = ZetaIdCodec.Unpack(id);
            var roundtripOk = unpacked == obs;
            var matchesExpected = string.Equals(hex, v.ExpectedHex, StringComparison.Ordinal);

            results[v.Id] = new { hex, roundtripOk, matchesExpected };

            if (!roundtripOk) roundtripMismatches++;
            if (!matchesExpected) hexMismatches++;
        }

        var outputPath = Path.Join(root, "tests", "cross-verification", "zeta-id", "cs-output.json");
        var json = JsonSerializer.Serialize(results, JsonOptions);
        File.WriteAllText(outputPath, json);

        Assert.Equal(0, roundtripMismatches);
        Assert.Equal(0, hexMismatches);
    }
}
