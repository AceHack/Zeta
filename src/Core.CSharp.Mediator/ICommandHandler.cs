namespace Zeta.Mediator;

/// <summary>Handles a <typeparamref name="TCommand"/>, returning a <typeparamref name="TResponse"/>.</summary>
/// <typeparam name="TCommand">The command type handled.</typeparam>
/// <typeparam name="TResponse">The response produced.</typeparam>
public interface ICommandHandler<in TCommand, TResponse> : IRequestHandler<TCommand, TResponse>
    where TCommand : ICommand<TResponse>;

/// <summary>Handles a void <typeparamref name="TCommand"/>, returning <see cref="Unit"/>.</summary>
/// <typeparam name="TCommand">The void command type handled.</typeparam>
public interface ICommandHandler<in TCommand> : ICommandHandler<TCommand, Unit>
    where TCommand : ICommand<Unit>;
