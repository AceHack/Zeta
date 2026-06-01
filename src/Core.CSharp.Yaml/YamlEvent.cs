namespace Zeta.Core.CSharp.Yaml;

/// <summary>
/// A flat event in the L1 stream. A document emits exactly one StreamStart first and one
/// StreamEnd last. Pattern-match on the sealed sub-records.
/// </summary>
public abstract record YamlEvent
{
    private YamlEvent() { }

    /// <summary>Start of the document stream.</summary>
    public sealed record StreamStart : YamlEvent;
    /// <summary>End of the document stream.</summary>
    public sealed record StreamEnd : YamlEvent;
    /// <summary>Open a mapping container.</summary>
    public sealed record MappingStart : YamlEvent;
    /// <summary>Close a mapping container.</summary>
    public sealed record MappingEnd : YamlEvent;
    /// <summary>Open a sequence container.</summary>
    public sealed record SequenceStart : YamlEvent;
    /// <summary>Close a sequence container.</summary>
    public sealed record SequenceEnd : YamlEvent;
    /// <summary>
    /// A scalar (map key, map value, or sequence item). Map keys are always Kind=Str.
    /// </summary>
    public sealed record Scalar(string Raw, ScalarKind Kind, ScalarStyle Style) : YamlEvent;
}
