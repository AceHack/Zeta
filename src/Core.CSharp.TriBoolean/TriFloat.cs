namespace Zeta.Core.CSharp.TriBoolean;

/// <summary>
/// A tri-boolean float: a composite of digital-qubit cells (<see cref="Tri"/>). Each field is a
/// list of trits read MSB-first; because every position is a <see cref="Tri"/>, any trit may be
/// held (Tri.N). Parity with the TS TriFloat and F# Float.TriFloat. Records give structural
/// equality, so two floats with equal fields are value-equal.
/// </summary>
/// <param name="Shape">The field widths.</param>
/// <param name="High">High value trits (MSB-first).</param>
/// <param name="Decoder">Middle decoder trits (the biased-exponent mode, MSB-first).</param>
/// <param name="Low">Low value trits (MSB-first).</param>
public sealed record TriFloat(
    FloatShape Shape,
    IReadOnlyList<Tri> High,
    IReadOnlyList<Tri> Decoder,
    IReadOnlyList<Tri> Low);
