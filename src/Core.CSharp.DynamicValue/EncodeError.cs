namespace Zeta.Core.CSharp;

/// <summary>
/// Why a <see cref="DynamicValue"/> could not be canonically encoded (v1). <see
/// cref="DynamicValue.Float"/> and <see cref="DynamicValue.Bytes"/> have no canonical JSON form yet
/// (they lock under CBOR or a tagged-JSON convention); surfaced as data via
/// <see cref="Result{T, TError}"/> per the Result-over-exception hard rule (AGENTS.md), never
/// thrown. Mirrors the F# <c>EncodeError</c> DU.
/// </summary>
public enum EncodeError
{
    /// <summary><see cref="DynamicValue.Float"/> has no canonical shortest-float form in plain JSON.</summary>
    FloatDeferred,

    /// <summary><see cref="DynamicValue.Bytes"/> has no native JSON byte type.</summary>
    BytesDeferred,

    /// <summary>A <see cref="DynamicValue.String"/> value or <see cref="DynamicValue.Object"/> key
    /// contains a character XML 1.0 forbids (NUL or a C0 control other than tab/lf/cr) — not
    /// representable even as a character reference. The XML analogue of the Bytes-not-in-YAML gap.</summary>
    NotXmlRepresentable,
}
