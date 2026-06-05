namespace Zeta.Mediator;

/// <summary>Handles a published <typeparamref name="TNotification"/>.</summary>
/// <typeparam name="TNotification">The notification type handled.</typeparam>
public interface INotificationHandler<in TNotification> : global::Mediator.INotificationHandler<TNotification>
    where TNotification : INotification;
