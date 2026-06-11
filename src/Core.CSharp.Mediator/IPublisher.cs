namespace Zeta.Mediator;

/// <summary>Publishes notifications to zero or more handlers.</summary>
public interface IPublisher
{
    /// <summary>Publish <paramref name="notification"/> to all its handlers.</summary>
    /// <typeparam name="TNotification">The notification type.</typeparam>
    /// <param name="notification">The notification to broadcast.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A task that completes when all handlers have run.</returns>
    public ValueTask Publish<TNotification>(TNotification notification, CancellationToken cancellationToken = default)
        where TNotification : INotification;
}
