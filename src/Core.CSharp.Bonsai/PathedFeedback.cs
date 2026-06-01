namespace Zeta.Core.CSharp.Bonsai;

/// <summary>
/// A decline tagged with the JSON-path where it occurred (the ProblemDetails key in the
/// accumulate mode). Parity with the F# <c>PathedFeedback</c> record and the TS
/// <c>PathedFeedback</c> interface.
/// </summary>
/// <param name="Path">The JSON-path to the declining node (e.g. <c>$.expr.left.op</c>).</param>
/// <param name="Feedback">The typed reason this node declined.</param>
public sealed record PathedFeedback(string Path, BonsaiFeedback Feedback);
