namespace Zeta.Core.CSharp.Yaml;

using System.Runtime.InteropServices;

/// <summary>
/// Result returned from <see cref="YamlReader.ReadEvents"/>. Either Ok (with events) or
/// Error (with feedback). Uses a struct to avoid allocation on the success path.
/// </summary>
[StructLayout(LayoutKind.Auto)]
public readonly record struct ReadResult(bool Ok, IReadOnlyList<YamlEvent>? Events, YamlFeedback? Feedback)
{
    /// <summary>Construct a success result.</summary>
    public static ReadResult Success(IReadOnlyList<YamlEvent> events) =>
        new(true, events, null);

    /// <summary>Construct a failure result.</summary>
    public static ReadResult Failure(YamlFeedback feedback) =>
        new(false, null, feedback);
}
