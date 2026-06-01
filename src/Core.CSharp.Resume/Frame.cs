using Zeta.Core.CSharp.Bonsai;

namespace Zeta.Core.CSharp.Resume;

/// <summary>
/// A defunctionalized continuation frame — one pending operation waiting on a sub-result, with
/// exactly the environment + expression it still needs (the serialized closure). The
/// <c>kont</c> list of these IS the suspended computation. Sealed-record hierarchy mirrors the
/// F# <c>Frame</c> DU and the TS <c>Frame</c> union variant-for-variant.
/// </summary>
public abstract record Frame
{
    private Frame() { }

    /// <summary>Computed the left operand; next evaluate <paramref name="Right"/> (in
    /// <paramref name="Env"/>), then apply <paramref name="Op"/>.</summary>
    public sealed record EvalRight(BinOp Op, Expr Right, IReadOnlyDictionary<string, ConstValue> Env) : Frame;

    /// <summary>Computed both operands; apply <paramref name="Op"/> to
    /// (<paramref name="Left"/>, the returning value).</summary>
    public sealed record ApplyOp(BinOp Op, ConstValue Left) : Frame;

    /// <summary>Computed the test; pick <paramref name="Then"/>/<paramref name="Else"/> (in
    /// <paramref name="Env"/>) by its truthiness.</summary>
    public sealed record Branch(Expr Then, Expr Else, IReadOnlyDictionary<string, ConstValue> Env) : Frame;

    /// <summary>Evaluating an activity's args left-to-right: <paramref name="Pending"/> remain,
    /// <paramref name="Done"/> are computed.</summary>
    public sealed record EvalArgs(
        string Fn,
        IReadOnlyList<Expr> Pending,
        IReadOnlyList<ConstValue> Done,
        IReadOnlyDictionary<string, ConstValue> Env) : Frame;
}
