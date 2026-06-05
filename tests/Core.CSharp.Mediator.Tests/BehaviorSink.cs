namespace Zeta.Tests.CSharp.Mediator;

/// <summary>A DI-singleton counter so a test can assert a pipeline behavior actually ran.</summary>
public sealed class BehaviorSink
{
    private int _count;

    /// <summary>How many times a behavior wrapped a handler.</summary>
    public int Count => _count;

    /// <summary>Record a behavior invocation (thread-safe).</summary>
    public void Hit() => Interlocked.Increment(ref _count);
}
