namespace Zeta.Core.CSharp.TriBoolean;

/// <summary>
/// Which superposition is held when <see cref="FloatOps.Measure"/> cannot collapse a tri-boolean
/// float to a single number. The two held-states are distinct (the decode instruction is held vs
/// the value is held). Parity with the F# Float.FloatFeedback DU and the TS FloatFeedback union.
/// </summary>
public enum FloatFeedback
{
    /// <summary>Tri.N in the decoder field -- the decode instruction itself is superposed.</summary>
    InterpretationSuperposed,

    /// <summary>Tri.N in a value trit while the decoder is certain -- the value is superposed.</summary>
    ValueSuperposed,
}
