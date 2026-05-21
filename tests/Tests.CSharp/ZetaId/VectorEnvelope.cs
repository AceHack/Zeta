using YamlDotNet.Serialization;

namespace Zeta.Tests.CSharp.ZetaId;

public sealed class VectorEnvelope
{
    [YamlMember(Alias = "version")]
    public int Version { get; set; }

    [YamlMember(Alias = "description")]
    public string Description { get; set; } = string.Empty;

    // YamlDotNet requires a concrete writable collection here; MA0016 suppressed.
    [YamlMember(Alias = "vectors")]
#pragma warning disable MA0016
    public List<FlatVector> Vectors { get; set; } = new();
#pragma warning restore MA0016
}
