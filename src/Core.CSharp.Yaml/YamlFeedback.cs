namespace Zeta.Core.CSharp.Yaml;

/// <summary>
/// Typed decline channel (Result over throw) so a caller can fall back to a vendor adapter
/// on out-of-subset input.
/// </summary>
public enum YamlFeedback
{
    /// <summary>A tab in a content line's indentation region.</summary>
    TabIndentation,
    /// <summary>A quoted scalar with no closing quote.</summary>
    UnterminatedQuote,
    /// <summary>A bad double-quote escape or stray character.</summary>
    UnexpectedCharacter,
    /// <summary>A dedent to a level that does not match any open container.</summary>
    UnexpectedIndent,
    /// <summary>Out-of-subset: a value beginning &amp; * ! { [ | &gt;, or a line --- / ...</summary>
    UnsupportedConstruct,
}
