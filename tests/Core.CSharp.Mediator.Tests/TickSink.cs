namespace Zeta.Tests.CSharp.Mediator;

/// <summary>A DI-singleton counter so a test can assert the notification was delivered.</summary>
public sealed class TickSink
{
    private int _count;

    /// <summary>How many ticks have been observed.</summary>
    public int Count => _count;

    /// <summary>Record a tick (thread-safe).</summary>
    public void Hit() => Interlocked.Increment(ref _count);
}
