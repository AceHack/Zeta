namespace Zeta.Mediator;

// CQRS markers are defined purely over OUR IRequest — we do NOT wrap global::Mediator.ICommand
// (which only adds marker semantics the generator special-cases, and double-rooting a message on both
// IRequest and ICommand trips MSG0004). A command dispatches through the request mechanism; the
// command/query distinction is our own semantic layer, so replacing the package never touches it.

/// <summary>A CQRS command (a write/intent) producing a <typeparamref name="TResponse"/>.</summary>
/// <typeparam name="TResponse">The response the command handler returns.</typeparam>
public interface ICommand<out TResponse> : IRequest<TResponse>;

/// <summary>A CQRS command producing no meaningful result — its response is <see cref="Unit"/>.</summary>
public interface ICommand : ICommand<Unit>;
