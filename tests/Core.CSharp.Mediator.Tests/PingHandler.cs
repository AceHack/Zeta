using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>Handles <see cref="Ping"/> via the Zeta port; the generator must discover this.</summary>
public sealed class PingHandler : IRequestHandler<Ping, string>
{
    /// <summary>Return a pong for the ping.</summary>
    public ValueTask<string> Handle(Ping request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        return new ValueTask<string>($"pong:{request.Name}");
    }
}
