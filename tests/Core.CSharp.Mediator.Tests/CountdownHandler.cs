using System.Runtime.CompilerServices;
using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>Handles <see cref="Countdown"/> by streaming a descending sequence via the Zeta port.</summary>
public sealed class CountdownHandler : IStreamRequestHandler<Countdown, int>
{
    /// <summary>Yield <c>From</c> down to <c>1</c>.</summary>
    public async IAsyncEnumerable<int> Handle(Countdown request, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        for (var i = request.From; i >= 1; i--)
        {
            cancellationToken.ThrowIfCancellationRequested();
            yield return i;
            await Task.Yield();
        }
    }
}
