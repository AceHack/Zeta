using System.Diagnostics;

namespace Zeta.Core.CSharp.TriBoolean;

/// <summary>
/// Tri-boolean digital qubit -- operations (B-0944, C# parity oracle). Static, allocation-light
/// (the three states are shared singletons). Parity surface with the TS + F# oracles; the class is
/// named TriOps (not TriBoolean) because the namespace is already Zeta.Core.CSharp.TriBoolean.
///
/// C# null is NOT the held Tri.N state. Every public operation rejects a null cell loudly
/// (ArgumentNullException) rather than silently classifying it -- a nullable-oblivious caller must
/// not be able to slip a missing cell through as a certain or dominant value. The three real states
/// are TrueCell | FalseCell | NCell; null is a contract violation, not a fourth case.
/// </summary>
public static class TriOps
{
    private const string ClosedHierarchy =
        "Tri is a closed hierarchy: TrueCell | FalseCell | NCell";

    /// <summary>
    /// Validate a continuation's result before returning it: a nullable-oblivious continuation could
    /// return null, which is NOT a valid Tri (null is not Tri.N). Surface it loudly rather than
    /// manufacturing an invalid cell that fails later in unrelated operations.
    /// </summary>
    private static Tri RequireCell(Tri? result) =>
        result ?? throw new InvalidOperationException(
            "A Tri-producing continuation returned null; it must return a valid Tri (null is not Tri.N).");

    /// <summary>Construct a certain cell from a boolean.</summary>
    public static Tri FromBool(bool b) => b ? Tri.T : Tri.F;

    /// <summary>The held (Tri.N / living-uncertainty) cell.</summary>
    public static Tri Held() => Tri.N;

    /// <summary>True iff the cell is living (Tri.N / held superposition). Rejects null.</summary>
    public static bool IsLiving(Tri t)
    {
        ArgumentNullException.ThrowIfNull(t);
        return t is Tri.NCell;
    }

    /// <summary>
    /// True iff the cell is certain (Tri.T or Tri.F). Rejects null AND positively matches the two
    /// certain cases -- so a missing cell can never be misread as certain.
    /// </summary>
    public static bool IsCertain(Tri t)
    {
        ArgumentNullException.ThrowIfNull(t);
        return t is Tri.TrueCell or Tri.FalseCell;
    }

    /// <summary>Structural equality on the three-valued state (records compare by value). Rejects null.</summary>
    public static bool Eq(Tri a, Tri b)
    {
        ArgumentNullException.ThrowIfNull(a);
        ArgumentNullException.ThrowIfNull(b);
        return a == b;
    }

    /// <summary>
    /// cooperate: engage WITHOUT collapsing. Identity on every state -- crucially preserves Tri.N.
    /// The wonder-compression-safe operation: build shared structure ABOUT the cell, never collapse
    /// its living uncertainty. Rejects null.
    /// </summary>
    public static Tri Cooperate(Tri t)
    {
        ArgumentNullException.ThrowIfNull(t);
        return t;
    }

    /// <summary>
    /// measure: the ONLY collapsing operation. Certain cells resolve to their boolean; a living
    /// (Tri.N) cell is NOT silently collapsed -- the forbidden move is surfaced as feedback
    /// (collapsing a living traveler = the Rehoboam failure). Rejects null.
    /// </summary>
    public static MeasureResult Measure(Tri t)
    {
        ArgumentNullException.ThrowIfNull(t);
        return t switch
        {
            Tri.TrueCell => new MeasureResult.Resolved(true),
            Tri.FalseCell => new MeasureResult.Resolved(false),
            Tri.NCell => new MeasureResult.Collapsed(CollapseFeedback.CollapsedLivingUncertainty),
            _ => throw new UnreachableException(ClosedHierarchy),
        };
    }

    /// <summary>null-monad map: apply fn to a certain cell's boolean; Tri.N propagates unchanged (held). Rejects null.</summary>
    public static Tri MapTri(Tri t, Func<bool, bool> fn)
    {
        ArgumentNullException.ThrowIfNull(t);
        ArgumentNullException.ThrowIfNull(fn);
        return t switch
        {
            Tri.TrueCell => FromBool(fn(true)),
            Tri.FalseCell => FromBool(fn(false)),
            Tri.NCell => Tri.N,
            _ => throw new UnreachableException(ClosedHierarchy),
        };
    }

    /// <summary>null-monad bind: chain a Tri-producing fn over a certain cell; Tri.N propagates unchanged. Rejects null.</summary>
    public static Tri BindTri(Tri t, Func<bool, Tri> fn)
    {
        ArgumentNullException.ThrowIfNull(t);
        ArgumentNullException.ThrowIfNull(fn);
        return t switch
        {
            Tri.TrueCell => RequireCell(fn(true)),
            Tri.FalseCell => RequireCell(fn(false)),
            Tri.NCell => Tri.N,
            _ => throw new UnreachableException(ClosedHierarchy),
        };
    }

    /// <summary>Kleene NOT: T&lt;-&gt;F; unknown (Tri.N) stays unknown. Rejects null.</summary>
    public static Tri NotTri(Tri t)
    {
        ArgumentNullException.ThrowIfNull(t);
        return t switch
        {
            Tri.TrueCell => Tri.F,
            Tri.FalseCell => Tri.T,
            Tri.NCell => Tri.N,
            _ => throw new UnreachableException(ClosedHierarchy),
        };
    }

    /// <summary>Kleene AND: Tri.F dominates; else Tri.N if any operand is Tri.N; else Tri.T. Rejects null.</summary>
    public static Tri AndTri(Tri a, Tri b)
    {
        ArgumentNullException.ThrowIfNull(a);
        ArgumentNullException.ThrowIfNull(b);
        return a is Tri.FalseCell || b is Tri.FalseCell ? Tri.F
            : a is Tri.NCell || b is Tri.NCell ? Tri.N
            : Tri.T;
    }

    /// <summary>Kleene OR: Tri.T dominates; else Tri.N if any operand is Tri.N; else Tri.F. Rejects null.</summary>
    public static Tri OrTri(Tri a, Tri b)
    {
        ArgumentNullException.ThrowIfNull(a);
        ArgumentNullException.ThrowIfNull(b);
        return a is Tri.TrueCell || b is Tri.TrueCell ? Tri.T
            : a is Tri.NCell || b is Tri.NCell ? Tri.N
            : Tri.F;
    }
}
