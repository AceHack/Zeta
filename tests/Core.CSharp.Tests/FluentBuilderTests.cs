namespace Zeta.Core.CSharp.Tests;

/// <summary>
/// Verifies the fluent <see cref="ZetaCircuitBuilder{T}"/> surface introduced in B-0445.
/// Each test checks one operator from the builder chain; the final tests exercise
/// multi-step chains and <see cref="ZetaCircuitBuilder{T}.GroupBySum{TGroup}"/>.
/// </summary>
public class FluentBuilderTests
{
    private static readonly int[] FilterMapInputKeys = { 1, 2, 3 };
    private static readonly (int, string)[] JoinLeftKeys = { (1, "Alice"), (2, "Bob") };
    private static readonly (int, int)[] JoinRightKeys = { (1, 95), (2, 80) };
    private static readonly (string, long)[] GroupBySumRows =
    {
        ("Lead",     100_00L),
        ("Lead",     200_00L),
        ("Proposal", 500_00L),
        ("Won",      300_00L),
    };

    [Fact]
    public async Task FilterMapBuildRoundTrip()
    {
        var c = new Circuit();
        var input = c.ZSetInput<int>();
        var output = c
            .From(input.Stream)
            .Filter(x => x > 1)
            .Map(x => x * 10)
            .Build();

        input.Send(ZSetModule.ofKeys(FilterMapInputKeys));
        await c.StepAsync().ConfigureAwait(true);

        Assert.Equal(0L, output.Current[10]);
        Assert.Equal(1L, output.Current[20]);
        Assert.Equal(1L, output.Current[30]);
    }

    [Fact]
    public async Task DistinctCollapsesMultiplicities()
    {
        var c = new Circuit();
        var input = c.ZSetInput<int>();
        var output = c
            .From(input.Stream)
            .Distinct()
            .Build();

        input.Send(ZSetModule.ofPairs(new[] { (1, 5L), (2, 1L), (3, -2L) }));
        await c.StepAsync().ConfigureAwait(true);

        Assert.Equal(1L, output.Current[1]);
        Assert.Equal(1L, output.Current[2]);
        Assert.Equal(0L, output.Current[3]);
    }

    [Fact]
    public async Task IntegrateAccumulatesAcrossTicks()
    {
        var c = new Circuit();
        var input = c.ZSetInput<int>();
        var output = c
            .From(input.Stream)
            .Integrate()
            .Build();

        input.Send(ZSetModule.singleton(7, 1L));
        await c.StepAsync().ConfigureAwait(true);
        Assert.Equal(1L, output.Current[7]);

        input.Send(ZSetModule.singleton(7, 1L));
        await c.StepAsync().ConfigureAwait(true);
        Assert.Equal(2L, output.Current[7]);
    }

    [Fact]
    public async Task GroupBySumAggregatesCorrectly()
    {
        var c = new Circuit();
        var input = c.ZSetInput<(string Stage, long AmountCents)>();
        var output = c
            .From(input.Stream)
            .GroupBySum(x => x.Stage, x => x.AmountCents)
            .Build();

        input.Send(ZSetModule.ofKeys(GroupBySumRows));
        await c.StepAsync().ConfigureAwait(true);

        // GroupBySumOp emits one entry per group with weight 1L; the key IS
        // (group, sum), so we verify the expected sum landed in the ZSet.
        Assert.Equal(1L, output.Current[("Lead", 300_00L)]);
        Assert.Equal(1L, output.Current[("Proposal", 500_00L)]);
        Assert.Equal(1L, output.Current[("Won", 300_00L)]);
    }

    [Fact]
    public async Task JoinCombinesTwoStreams()
    {
        var c = new Circuit();
        var left = c.ZSetInput<(int Id, string Name)>();
        var right = c.ZSetInput<(int Id, int Score)>();

        var leftBuilder = c.From(left.Stream);
        var rightBuilder = c.From(right.Stream);

        var output = leftBuilder
            .Join(
                rightBuilder,
                x => x.Id,
                y => y.Id,
                (l, r) => (l.Name, r.Score))
            .Build();

        left.Send(ZSetModule.ofKeys(JoinLeftKeys));
        right.Send(ZSetModule.ofKeys(JoinRightKeys));
        await c.StepAsync().ConfigureAwait(true);

        Assert.Equal(1L, output.Current[("Alice", 95)]);
        Assert.Equal(1L, output.Current[("Bob", 80)]);
    }

    [Fact]
    public void ToStreamReturnsUnderlyingStream()
    {
        var c = new Circuit();
        var input = c.ZSetInput<int>();
        var builder = c.From(input.Stream);
        var stream = builder.ToStream();

        Assert.Equal(input.Stream, stream);
    }
}
