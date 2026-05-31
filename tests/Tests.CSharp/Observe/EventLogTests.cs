namespace Zeta.Tests.CSharp.Observe;

using System.Collections.Generic;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp.Observe;

// B-0867.28 (the numerics interface-gate): the observe event log is an additive
// MONOID via System.Numerics generic-math interfaces. These tests pin the monoid
// laws (identity, associativity) AND the load-bearing homomorphism — folding a
// concatenated log equals incremental folding — which is the append-only /
// DST-replay soundness property. Additive-monoidal only (operator 2026-05-31): no
// INumber<T>, because the log is the free monoid and nothing more.
public sealed class EventLogTests
{
    private static readonly BacklogItem Alpha = new("a", "Alpha", Ready: true, Ambiguous: false, NeedsNewAction: false);
    private static readonly BacklogItem Beta = new("b", "Beta", Ready: false, Ambiguous: true, NeedsNewAction: false);

    private static World InitialWorld() =>
        new([Alpha, Beta], new OperatorChannel(PendingMessage: true, PendingFerry: true), Mode: null);

    // Three non-trivial logs that touch backlog (DoItem/Decompose), mode (Explore/
    // SelfReflect) and the operator channel (RespondToOperator) — so the
    // homomorphism law exercises real state transitions, not a no-op.
    private static EventLog LogA() =>
        new([new NextAction.Explore("e"), new NextAction.DoItem(Alpha)]);

    private static EventLog LogB() =>
        new([new NextAction.Decompose(Beta), new NextAction.RespondToOperator("r")]);

    private static EventLog LogC() =>
        new([new NextAction.SelfReflect("s")]);

    /// Element-wise world equality: C# records compare the Backlog list by
    /// reference, so compare it with SequenceEqual (BacklogItem is a record →
    /// structural). Operator + Mode use record/enum value equality. Mirrors
    /// GoldenVectorsTests.AssertWorldEqual.
    private static void AssertWorldEqual(World expected, World actual)
    {
        Assert.Equal(expected.Operator, actual.Operator);
        Assert.Equal(expected.Mode, actual.Mode);
        Assert.True(
            expected.Backlog.SequenceEqual(actual.Backlog),
            $"backlog mismatch: expected [{string.Join(", ", expected.Backlog.Select(b => b.Id))}] " +
            $"vs actual [{string.Join(", ", actual.Backlog.Select(b => b.Id))}]");
    }

    [Fact]
    public void AdditiveIdentityIsTheEmptyLog() =>
        Assert.Empty(EventLog.AdditiveIdentity.Events);

    [Fact]
    public void LeftIdentityHolds()
    {
        var x = LogA();
        Assert.True((EventLog.AdditiveIdentity + x).Events.SequenceEqual(x.Events));
    }

    [Fact]
    public void RightIdentityHolds()
    {
        var x = LogA();
        Assert.True((x + EventLog.AdditiveIdentity).Events.SequenceEqual(x.Events));
    }

    [Fact]
    public void AppendIsAssociative()
    {
        EventLog a = LogA(), b = LogB(), c = LogC();
        Assert.True(((a + b) + c).Events.SequenceEqual((a + (b + c)).Events));
    }

    [Fact]
    public void FoldOntoEmptyLogIsTheInitialWorld() =>
        AssertWorldEqual(InitialWorld(), EventLog.AdditiveIdentity.FoldOnto(InitialWorld()));

    // The load-bearing law: Fold is the monoid action — folding a joined log =
    // folding the second onto the result of folding the first. This is exactly
    // append-only-replay soundness (re-folding a concatenated log reproduces the
    // incremental state). Checked across three logs (associatively) too.
    [Fact]
    public void FoldOntoIsAMonoidHomomorphism()
    {
        var w0 = InitialWorld();
        EventLog a = LogA(), b = LogB(), c = LogC();

        AssertWorldEqual((a + b).FoldOnto(w0), b.FoldOnto(a.FoldOnto(w0)));
        AssertWorldEqual(((a + b) + c).FoldOnto(w0), c.FoldOnto(b.FoldOnto(a.FoldOnto(w0))));
    }

    // The log must be genuinely append-only: constructing from a mutable list and
    // mutating that list afterward MUST NOT change the log (the free-monoid
    // stability this type guarantees). The constructor defensively copies.
    [Fact]
    public void ConstructorDefensivelyCopiesTheInput()
    {
        var mutable = new List<NextAction> { new NextAction.Explore("e") };
        var log = new EventLog(mutable);

        mutable.Add(new NextAction.Play("p")); // mutate the source AFTER construction

        Assert.Single(log.Events);
        Assert.IsType<NextAction.Explore>(log.Events[0]);
    }

    // Codex P2: a record that advertises value equality must actually obey the
    // monoid laws through == / Equals / hash — not only via .Events.SequenceEqual.
    // Equality is overridden structurally so AdditiveIdentity + x == x really holds
    // (the generated record equality would compare Events by reference and fail it).
    [Fact]
    public void RecordEqualityObeysMonoidLawsThroughEqualsAndHash()
    {
        var x = LogA();
        Assert.Equal(x, EventLog.AdditiveIdentity + x);  // left identity at ==/Equals
        Assert.Equal(x, x + EventLog.AdditiveIdentity);  // right identity at ==/Equals
        Assert.Equal(
            x.GetHashCode(),
            (EventLog.AdditiveIdentity + x).GetHashCode());  // hash consistent with Equals

        EventLog a = LogA(), b = LogB(), c = LogC();
        Assert.Equal((a + b) + c, a + (b + c));  // associativity at ==/Equals
    }

    // Codex P2: assigning a bare T[] to the IReadOnlyList property would let a caller
    // downcast (log.Events is NextAction[] arr) and rewrite the backing array. The
    // constructor wraps the copy in a read-only collection, so Events is NOT a raw
    // array and cannot be downcast-and-mutated.
    [Fact]
    public void EventsCannotBeDowncastToAMutableArray()
    {
        var log = new EventLog([new NextAction.Explore("e")]);
        Assert.False(log.Events is NextAction[]);
    }
}
