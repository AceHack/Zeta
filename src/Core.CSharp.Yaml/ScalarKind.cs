// Layer 1 types: ScalarKind, ScalarStyle, YamlFeedback. One top-level type per file
// (MA0048 requirement).

namespace Zeta.Core.CSharp.Yaml;

/// <summary>Scalar type resolved from a PLAIN scalar's text (quoted scalars are always Str).</summary>
public enum ScalarKind
{
    /// <summary>"", ~, null, Null, NULL.</summary>
    Null,
    /// <summary>true/True/TRUE/false/False/FALSE.</summary>
    Bool,
    /// <summary>^-?[0-9]+$</summary>
#pragma warning disable CA1720 // CA1720: Identifier 'Int' contains type name -- intentional: matches cross-language contract enum names
    Int,
#pragma warning restore CA1720
    /// <summary>^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$</summary>
#pragma warning disable CA1720 // CA1720: Identifier 'Float' contains type name -- intentional: matches cross-language contract enum names
    Float,
#pragma warning restore CA1720
    /// <summary>Anything else (and every quoted scalar).</summary>
    Str,
}
