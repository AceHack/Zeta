namespace Zeta.Core.CSharp.Observe;

/// <summary>The observable read-side of the operator channel.</summary>
public sealed record OperatorChannel(bool PendingMessage, bool PendingFerry);
