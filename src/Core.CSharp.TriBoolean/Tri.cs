namespace Zeta.Core.CSharp.TriBoolean;

// Tri-boolean core primitive -- the digital qubit cell (B-0944).
//
// Three-valued state: T | F | N. The N case is the HELD living-uncertainty (superposition)
// state -- a sealed-record case, NOT C# `null`. It is never silently collapsed. Measure is the
// only collapsing operation, and collapsing an N cell is surfaced as feedback rather than
// performed silently (Result-over-exception / asymmetric-authorship).
//
// C# implementation -- oracle #3 of four (TS/F#/C#/Rust) in the summonable-BFT cross-language
// consensus. The Roslyn compiler is a non-Byzantine oracle: it cannot lie about whether the code
// type-checks and the written patterns compile. (It does NOT prove the class/record hierarchy is
// exhaustive -- that is why the switches carry an explicit UnreachableException arm; closing the
// base constructor closes the hierarchy by construction, the compiler does not infer it.) Parity
// with the TS (src/Core.TypeScript/tri-boolean) and F# (src/Core.FSharp.TriBoolean) oracles is the
// BFT ballot.

/// <summary>
/// The three-valued state as a closed sealed-record hierarchy (private base constructor + internal
/// case constructors => only the three nested cases exist and only this assembly constructs them).
/// The N case is the held / superposed living-uncertainty case (a record case, NOT C# null).
/// Records give structural equality, so the singletons below compare by value (and any
/// same-assembly construction is value-equal to the canonical singleton).
/// </summary>
public abstract record Tri
{
    private Tri() { }

    /// <summary>Certain-true cell. Construct via the <see cref="T"/> singleton.</summary>
    public sealed record TrueCell : Tri
    {
        internal TrueCell() { }
    }

    /// <summary>Certain-false cell. Construct via the <see cref="F"/> singleton.</summary>
    public sealed record FalseCell : Tri
    {
        internal FalseCell() { }
    }

    /// <summary>
    /// Held living-uncertainty cell (superposition). NOT C# null; never silently collapsed.
    /// Construct via the <see cref="N"/> singleton.
    /// </summary>
    public sealed record NCell : Tri
    {
        internal NCell() { }
    }

    /// <summary>Certain-true singleton (Tri.T, parity with F# Tri.T / TS T).</summary>
    public static readonly Tri T = new TrueCell();

    /// <summary>Certain-false singleton (Tri.F, parity with F# Tri.F / TS F).</summary>
    public static readonly Tri F = new FalseCell();

    /// <summary>Held living-uncertainty singleton (Tri.N, parity with F# Tri.N / TS N).</summary>
    public static readonly Tri N = new NCell();
}
