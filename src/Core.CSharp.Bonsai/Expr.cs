namespace Zeta.Core.CSharp.Bonsai;

/// <summary>
/// A Bonsai-subset expression node (kind-tagged discriminated union). Sealed-record
/// hierarchy mirrors the F# <c>Expr</c> DU and the TS <c>Expr</c> union — the node set is
/// <c>const · param · lambda · binary · call · cond</c>.
/// </summary>
public abstract record Expr
{
    private Expr() { }

    /// <summary>A literal constant.</summary>
    public sealed record Constant(ConstValue Value) : Expr;

    /// <summary>A parameter (variable) reference.</summary>
    public sealed record Param(string Name) : Expr;

    /// <summary>A lambda abstraction.</summary>
    public sealed record Lambda(IReadOnlyList<string> Parameters, Expr Body) : Expr;

    /// <summary>A binary operation.</summary>
    public sealed record Binary(BinOp Op, Expr Left, Expr Right) : Expr;

    /// <summary>A named function application.</summary>
    public sealed record Invoke(string Fn, IReadOnlyList<Expr> Args) : Expr;

    /// <summary>A conditional (<c>if test then then else else</c>).</summary>
    public sealed record Cond(Expr Test, Expr Then, Expr Else) : Expr;
}
