// Layer 2 value type: YamlValue (the DOM tree node).
// The fold logic lives in YamlDom.cs; the result struct lives in ParseResult.cs.

namespace Zeta.Core.CSharp.Yaml;

/// <summary>
/// The folded value tree. Map preserves insertion order (a list of pairs, not a hash map),
/// mirroring the cross-language contract.
/// </summary>
public abstract class YamlValue
{
    private YamlValue() { }

    /// <summary>null / ~ / empty.</summary>
    public sealed class YNull : YamlValue
    {
        /// <summary>Singleton instance.</summary>
        public static readonly YNull Instance = new();
        private YNull() { }
    }

    /// <summary>A boolean.</summary>
    public sealed class YBool(bool value) : YamlValue
    {
        /// <summary>The boolean value.</summary>
        public bool Value { get; } = value;
    }

    /// <summary>A 64-bit signed integer (parsed from raw).</summary>
    public sealed class YInt(long value) : YamlValue
    {
        /// <summary>The integer value.</summary>
        public long Value { get; } = value;
    }

    /// <summary>A 64-bit float (parsed from raw).</summary>
    public sealed class YFloat(double value) : YamlValue
    {
        /// <summary>The float value.</summary>
        public double Value { get; } = value;
    }

    /// <summary>A string (the decoded raw).</summary>
    public sealed class YStr(string value) : YamlValue
    {
        /// <summary>The string value.</summary>
        public string Value { get; } = value;
    }

    /// <summary>An ordered sequence.</summary>
    public sealed class YSeq(IReadOnlyList<YamlValue> items) : YamlValue
    {
        /// <summary>Sequence items in order.</summary>
        public IReadOnlyList<YamlValue> Items { get; } = items;
    }

    /// <summary>An ordered mapping (insertion order preserved).</summary>
    public sealed class YMap(IReadOnlyList<KeyValuePair<string, YamlValue>> entries) : YamlValue
    {
        /// <summary>Key-value pairs in insertion order.</summary>
        public IReadOnlyList<KeyValuePair<string, YamlValue>> Entries { get; } = entries;
    }
}
