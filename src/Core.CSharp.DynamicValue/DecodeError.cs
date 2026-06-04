namespace Zeta.Core.CSharp;

/// <summary>
/// Why canonical CBOR bytes could not be decoded into a <see cref="DynamicValue"/>. Surfaced as data
/// via <see cref="Result{T, TError}"/> per the Result-over-exception hard rule (AGENTS.md), never
/// thrown. Mirrors the F#/Rust <c>DecodeError</c>.
/// </summary>
public enum DecodeError
{
    /// <summary>Input ended mid-item (a head or payload was truncated).</summary>
    UnexpectedEnd,

    /// <summary>Extra bytes remained after a complete top-level value.</summary>
    TrailingData,

    /// <summary>An additional-info or major-7 simple value this canonical decoder does not accept
    /// (reserved 28–30, indefinite-length 31, CBOR tags (major 6), or an unsupported simple value).</summary>
    Unsupported,

    /// <summary>A CBOR integer does not fit <see cref="long"/> (<see cref="DynamicValue.Int"/> is int64).</summary>
    IntegerOverflow,

    /// <summary>An object (map) key was not a text string (<see cref="DynamicValue.Object"/> keys are strings).</summary>
    NonTextKey,

    /// <summary>Well-formed CBOR that is NOT the canonical form this codec emits — e.g. a non-shortest
    /// integer/length width (<c>18 00</c> vs <c>00</c>), a non-shortest float / non-canonical NaN, or
    /// invalid UTF-8 silently repaired to U+FFFD. Detected by the fixed-point check
    /// <c>ToCanonicalCbor(decoded) == input</c>; canonical bytes are exactly those fixed points.</summary>
    NonCanonical,

    /// <summary>The input is not well-formed for the canonical XML grammar — a malformed tag,
    /// entity, or structure the lenient XML parser cannot read (the XML analogue of a syntax
    /// error). Distinct from <see cref="NonCanonical"/>, which is well-formed but not the one
    /// canonical spelling.</summary>
    MalformedXml,
}
