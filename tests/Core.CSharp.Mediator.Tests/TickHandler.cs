using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>Handles <see cref="Tick"/> by bumping the injected <see cref="TickSink"/>.</summary>
public sealed class TickHandler(TickSink sink) : INotificationHandler<Tick>
{
    /// <summary>Record the tick.</summary>
    public ValueTask Handle(Tick notification, CancellationToken cancellationToken)
    {
        sink.Hit();
        return default;
    }
}
