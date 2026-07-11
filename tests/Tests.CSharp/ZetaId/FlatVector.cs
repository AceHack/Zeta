namespace Zeta.Tests.CSharp.ZetaId;

// Populated manually from the YAML port's YamlValue tree (own-the-interface: no
// direct YamlDotNet deserialization). Field names map to the fixture keys.
public sealed class FlatVector
{
    public string Id { get; set; } = string.Empty;

    public int Version { get; set; }

    public long Timestamp { get; set; }

    public int Chromosome { get; set; }

    public int Category { get; set; }

    public int Firefly { get; set; }

    public string AuthorityType { get; set; } = string.Empty;

    public int? AuthorityRaw { get; set; }

    public int Persona { get; set; }

    public string MomentumType { get; set; } = string.Empty;

    public int? MomentumRaw { get; set; }

    public int Location { get; set; }

    public string ExpectedHex { get; set; } = string.Empty;

    public string ExpectedCrockford { get; set; } = string.Empty;

    public string? Type { get; set; }

    public string? InputCrockford { get; set; }
}
