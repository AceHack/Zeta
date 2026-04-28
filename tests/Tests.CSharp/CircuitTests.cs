using Zeta.Core;
using Xunit;

namespace Zeta.Tests.CSharp;

/// <summary>
/// End-to-end circuit tests exercised from C#. Verifies that F# `Circuit`,
/// operator extension methods, and input/output handles all compose naturally
/// in idiomatic C# — no `FSharpFunc` wrapping, no awkward casting.
/// </summary>
public class CircuitTests
{
    private static readonly int[] InputKeys = { 1, 2, 3 };

    [Fact]
    public async Task EmptyCircuitTicksMonotonically()
    {
        var c = new Circuit();
        Assert.Equal(0L, c.Tick);
        await c.StepAsync();
        Assert.Equal(1L, c.Tick);
        await c.StepAsync();
        Assert.Equal(2L, c.Tick);
    }

    [Fact]
    public async Task MapThenFilterPipelineFromCsharp()
    {
        var c = new Circuit();
        var input = c.ZSetInput<int>();
        var mapped = c.Map(input.Stream, x => x * 2);
        var filtered = c.Filter(mapped, x => x > 2);
        var output = c.Output(filtered);

        input.Send(ZSetModule.ofKeys(InputKeys));
        await c.StepAsync();

        Assert.Equal(0L, output.Current[2]);
        Assert.Equal(1L, output.Current[4]);
        Assert.Equal(1L, output.Current[6]);
    }

    [Fact]
    public async Task IntegrateAccumulatesAcrossTicks()
    {
        var c = new Circuit();
        var input = c.ZSetInput<int>();
        var integrated = c.IntegrateZSet(input.Stream);
        var output = c.Output(integrated);

        input.Send(ZSetModule.singleton(1, 1L));
        await c.StepAsync();
        Assert.Equal(1L, output.Current[1]);

        input.Send(ZSetModule.singleton(1, 1L));
        await c.StepAsync();
        Assert.Equal(2L, output.Current[1]);
    }

    [Fact]
    public async Task DistinctCollapsesMultiplicities()
    {
        var c = new Circuit();
        var input = c.ZSetInput<int>();
        var d = c.Distinct(input.Stream);
        var output = c.Output(d);

        input.Send(ZSetModule.ofPairs(new[]
        {
            (1, 3L),
            (2, 1L),
            (3, -1L),
        }));
        await c.StepAsync();
        Assert.Equal(1L, output.Current[1]);
        Assert.Equal(1L, output.Current[2]);
        Assert.Equal(0L, output.Current[3]);
    }
}
