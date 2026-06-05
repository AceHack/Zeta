namespace Zeta.Mediator;

// The hexagonal message + handler ports. Each inherits the corresponding martinothamar/Mediator
// interface so the source generator (running in the edge assembly) still discovers handlers by their
// implemented interfaces — but business code names only Zeta.Mediator.* types. Replacing the package
// means redefining these inheritances (and the ZetaMediator adapter); business code is untouched.

/// <summary>Marker for any message that flows through the mediator (request or notification).</summary>
public interface IMessage : global::Mediator.IMessage;
