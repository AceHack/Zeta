namespace Zeta.Core.CSharp.Bonsai;

/// <summary>The language-agnostic binary operators in the subset (parity with the F#
/// <c>BinOp</c> DU and the TS <c>BinOp</c> union).</summary>
public enum BinOp
{
    /// <summary>Addition.</summary>
    Add,

    /// <summary>Subtraction.</summary>
    Sub,

    /// <summary>Multiplication.</summary>
    Mul,

    /// <summary>Equality.</summary>
    Eq,

    /// <summary>Less-than.</summary>
    Lt,

    /// <summary>Logical and.</summary>
    And,

    /// <summary>Logical or.</summary>
    Or,
}
