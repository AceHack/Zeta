namespace Zeta.Core.CSharp;

/// <summary>The runtime type tag of a <see cref="DynamicValue"/> — the QueryInterface surface
/// ("what shape are you?" with no compile-time type). The member names mirror the canonical
/// self-describing data-model vocabulary (the F# shape's <c>DynamicValueType</c>) so the tag is
/// shared across the TS/F#/C#/Rust oracles.</summary>
public enum DynamicValueType
{
    /// <summary>The explicit null / absent value.</summary>
    Null,

    /// <summary>A boolean.</summary>
    Bool,

    /// <summary>A 64-bit signed integer (split from <see cref="Float"/> so large integers keep
    /// precision past 2^53).</summary>
    Int,

    /// <summary>A 64-bit IEEE-754 float.</summary>
    Float,

    /// <summary>A UTF-16 string.</summary>
    String,

    /// <summary>A raw byte payload (the native binary every self-describing binary format carries
    /// and JSON fakes with base64).</summary>
    Bytes,

    /// <summary>An ordered sequence of values.</summary>
    Array,

    /// <summary>An ordered sequence of key → value pairs.</summary>
    Object,
}
