namespace Zeta.Core.CSharp.Observe;

/// <summary>One backlog item, classified to what the controller needs to decide.
/// <c>NeedsNewAction</c> is optional in the wire form (decompose children omit it;
/// absent ≡ false) — see the conformance parser.</summary>
public sealed record BacklogItem(string Id, string Title, bool Ready, bool Ambiguous, bool NeedsNewAction);
