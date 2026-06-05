namespace Zeta.Mediator;

/// <summary>Handles a <typeparamref name="TQuery"/>, returning a <typeparamref name="TResponse"/>.</summary>
/// <typeparam name="TQuery">The query type handled.</typeparam>
/// <typeparam name="TResponse">The response produced.</typeparam>
public interface IQueryHandler<in TQuery, TResponse> : IRequestHandler<TQuery, TResponse>
    where TQuery : IQuery<TResponse>;
