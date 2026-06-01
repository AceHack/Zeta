namespace Zeta.Core.CSharp.Yaml;

using System.Runtime.InteropServices;

/// <summary>
/// Result of <see cref="YamlDom.Parse"/>. Either Ok (with a value) or Error (with feedback).
/// </summary>
[StructLayout(LayoutKind.Auto)]
public readonly record struct ParseResult(bool Ok, YamlValue? Value, YamlFeedback? Feedback)
{
    /// <summary>Construct a success result.</summary>
    public static ParseResult Success(YamlValue value) => new(true, value, null);
    /// <summary>Construct a failure result.</summary>
    public static ParseResult Failure(YamlFeedback feedback) => new(false, null, feedback);
}
