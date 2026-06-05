namespace Zeta.Mediator;

/// <summary>Sends requests to their single handler and returns the response.</summary>
public interface ISender
{
    /// <summary>Send <paramref name="request"/> to its handler and await the response.</summary>
    /// <typeparam name="TResponse">The response type.</typeparam>
    /// <param name="request">The request to dispatch.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The handler's response.</returns>
    ValueTask<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default);
}
