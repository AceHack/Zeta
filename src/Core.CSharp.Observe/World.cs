namespace Zeta.Core.CSharp.Observe;

/// <summary>The world snapshot. <c>Operator = null</c> = the channel isn't wired;
/// <c>Mode = null</c> = unset. NOTE: C# records do reference-equality on the
/// <c>Backlog</c> list property (unlike F# lists, which are structural), so value
/// comparison of worlds must compare <c>Backlog</c> element-wise — the conformance
/// test does exactly that.</summary>
public sealed record World(IReadOnlyList<BacklogItem> Backlog, OperatorChannel? Operator, Mode? Mode);
