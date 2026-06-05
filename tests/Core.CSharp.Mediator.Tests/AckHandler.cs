using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>Handles <see cref="Ack"/>, returning the unit value.</summary>
public sealed class AckHandler : IRequestHandler<Ack>
{
    /// <summary>Complete with unit.</summary>
    public ValueTask<Unit> Handle(Ack request, CancellationToken cancellationToken) => Unit.ValueTask;
}
