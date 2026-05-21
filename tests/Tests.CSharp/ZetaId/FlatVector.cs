using YamlDotNet.Serialization;

namespace Zeta.Tests.CSharp.ZetaId;

public sealed class FlatVector
{
    [YamlMember(Alias = "id")]
    public string Id { get; set; } = string.Empty;

    [YamlMember(Alias = "version")]
    public int Version { get; set; }

    [YamlMember(Alias = "timestamp")]
    public long Timestamp { get; set; }

    [YamlMember(Alias = "chromosome")]
    public int Chromosome { get; set; }

    [YamlMember(Alias = "category")]
    public int Category { get; set; }

    [YamlMember(Alias = "firefly")]
    public int Firefly { get; set; }

    [YamlMember(Alias = "authority_type")]
    public string AuthorityType { get; set; } = string.Empty;

    [YamlMember(Alias = "authority_raw")]
    public int? AuthorityRaw { get; set; }

    [YamlMember(Alias = "persona")]
    public int Persona { get; set; }

    [YamlMember(Alias = "momentum_type")]
    public string MomentumType { get; set; } = string.Empty;

    [YamlMember(Alias = "momentum_raw")]
    public int? MomentumRaw { get; set; }

    [YamlMember(Alias = "location")]
    public int Location { get; set; }

    [YamlMember(Alias = "expected_hex")]
    public string ExpectedHex { get; set; } = string.Empty;
}
