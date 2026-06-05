using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>Handles the <see cref="Greet"/> command via the Zeta port.</summary>
public sealed class GreetHandler : ICommandHandler<Greet, string>
{
    /// <summary>Return a greeting.</summary>
    public ValueTask<string> Handle(Greet command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        return new ValueTask<string>($"hello:{command.Name}");
    }
}
