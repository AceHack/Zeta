namespace Zeta.Core.CSharp.Bonsai;

/// <summary>
/// Ergonomic builders (parity with the TS <c>cint/param/lambda/...</c> constructors and the
/// F# builders). Total — validation happens at the <see cref="BonsaiCodec.Serialize"/> boundary.
/// </summary>
public static class Build
{
    /// <summary>A literal-int constant.</summary>
    public static Expr CInt(long v) => new Expr.Constant(new ConstValue.Number(v));

    /// <summary>A literal-string constant.</summary>
    public static Expr CStr(string v) => new Expr.Constant(new ConstValue.Str(v));

    /// <summary>A literal-bool constant.</summary>
    public static Expr CBool(bool v) => new Expr.Constant(new ConstValue.Bool(v));

    /// <summary>The null constant.</summary>
    public static Expr CNull() => new Expr.Constant(new ConstValue.Null());

    /// <summary>A parameter (variable) reference.</summary>
    public static Expr Param(string name) => new Expr.Param(name);

    /// <summary>A lambda abstraction.</summary>
    public static Expr Lambda(IReadOnlyList<string> parameters, Expr body) => new Expr.Lambda(parameters, body);

    /// <summary>A binary operation.</summary>
    public static Expr Binary(BinOp op, Expr left, Expr right) => new Expr.Binary(op, left, right);

    /// <summary>A named function application.</summary>
    public static Expr Call(string fn, IReadOnlyList<Expr> args) => new Expr.Invoke(fn, args);

    /// <summary>A conditional.</summary>
    public static Expr Cond(Expr test, Expr then, Expr els) => new Expr.Cond(test, then, els);
}
