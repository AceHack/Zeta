using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Zeta.Mediator;

// Configure the source generator (the one package-coupled surface, isolated to this edge assembly).
// Fully qualified so the test body needs no `using Mediator;` — it names only Zeta.Mediator.* types.
[assembly: global::Mediator.MediatorOptions(ServiceLifetime = ServiceLifetime.Singleton)]

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>
/// Proves the hexagonal seam: the martinothamar/Mediator source generator discovers handlers that
/// implement OUR <c>Zeta.Mediator.*</c> interfaces (which inherit the package interfaces), dispatch
/// works through our <see cref="IMediator"/> port, and a void request returns OUR <see cref="Unit"/> —
/// all without business/test code naming <c>global::Mediator.*</c> (except the one assembly attribute).
/// </summary>
public sealed class MediatorPortTests
{
    private static ServiceProvider BuildProvider()
    {
        var services = new ServiceCollection();
        services.AddSingleton<TickSink>();
        services.AddMediator();            // generated registration — discovers the port handlers
        services.AddZetaMediatorAdapter(); // our port adapter over the generated IMediator
        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task RequestDispatchesThroughThePortToItsHandler()
    {
        using var provider = BuildProvider();
        var mediator = provider.GetRequiredService<IMediator>();
        var response = await mediator.Send(new Ping("ada"));
        Assert.Equal("pong:ada", response);
    }

    [Fact]
    public async Task VoidRequestReturnsTheZetaUnit()
    {
        using var provider = BuildProvider();
        var mediator = provider.GetRequiredService<IMediator>();
        var unit = await mediator.Send(new Ack());
        Assert.Equal(Unit.Value, unit);
    }

    [Fact]
    public async Task NotificationPublishedThroughThePortReachesItsHandler()
    {
        using var provider = BuildProvider();
        var mediator = provider.GetRequiredService<IMediator>();
        var sink = provider.GetRequiredService<TickSink>();
        await mediator.Publish(new Tick());
        Assert.Equal(1, sink.Count);
    }

    [Fact]
    public async Task CommandDispatchesThroughThePort()
    {
        using var provider = BuildProvider();
        var mediator = provider.GetRequiredService<IMediator>();
        var response = await mediator.Send(new Greet("ada"));
        Assert.Equal("hello:ada", response);
    }

    [Fact]
    public async Task QueryDispatchesThroughThePort()
    {
        using var provider = BuildProvider();
        var mediator = provider.GetRequiredService<IMediator>();
        var response = await mediator.Send(new Answer());
        Assert.Equal(42, response);
    }

    [Fact]
    public async Task StreamRequestYieldsItsSequenceThroughThePort()
    {
        using var provider = BuildProvider();
        var mediator = provider.GetRequiredService<IMediator>();
        var collected = new List<int>();
        await foreach (var n in mediator.CreateStream(new Countdown(3)))
        {
            collected.Add(n);
        }

        Assert.Equal([3, 2, 1], collected);
    }
}
