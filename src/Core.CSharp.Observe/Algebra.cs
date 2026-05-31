namespace Zeta.Core.CSharp.Observe;

/// <summary>
/// The pure event algebra. Three functions, all deterministic + side-effect-free:
/// <c>Simulate</c> (the reducer / step), <c>Fold</c> (left-fold = projection),
/// <c>Replay</c> (state after each event). These mirror tools/observe/observe.ts
/// and src/Core.FSharp.Observe byte-for-byte in behaviour, so the shared
/// golden-vector fixture produces the SAME states here — the cross-language-parity
/// = non-Byzantine-BFT check (B-0944).
///
/// Active disciplines: lock-free + wait-free (pure values, no shared mutable
/// state), weight-free (no implicit weighting), DST (deterministic from the same
/// event log), idempotency (fold = the monoidal reduction over an append-only log).
/// </summary>
public static class Algebra
{
    /// <summary>Apply one action to the world, returning the next world. The
    /// <c>Reason</c> fields never affect the transition (parity with TS/F#).</summary>
    public static World Simulate(World world, NextAction action) => action switch
    {
        // Clear the pending-ferry signal (only if the channel is wired).
        NextAction.PreserveFerry =>
            world.Operator is { } op1
                ? world with { Operator = op1 with { PendingFerry = false } }
                : world,

        // Clear the pending-message signal (only if the channel is wired).
        NextAction.RespondToOperator =>
            world.Operator is { } op2
                ? world with { Operator = op2 with { PendingMessage = false } }
                : world,

        // Item done → drop it from the backlog; entering work mode.
        NextAction.DoItem(var item) =>
            world with
            {
                Backlog = world.Backlog.Where(i => !string.Equals(i.Id, item.Id, StringComparison.Ordinal)).ToList(),
                Mode = Mode.Work,
            },

        // Replace the ambiguous item in place with two ready children.
        NextAction.Decompose(var item) =>
            world with
            {
                Backlog = world.Backlog
                    .SelectMany(i => string.Equals(i.Id, item.Id, StringComparison.Ordinal)
                        ? new[]
                        {
                            new BacklogItem(item.Id + ".1", item.Title + " (part 1)", Ready: true, Ambiguous: false, NeedsNewAction: false),
                            new BacklogItem(item.Id + ".2", item.Title + " (part 2)", Ready: true, Ambiguous: false, NeedsNewAction: false),
                        }
                        : new[] { i })
                    .ToList(),
                Mode = Mode.Work,
            },

        // Sovereign grammar edit: the targeted item gains a fresh action + becomes
        // ready (no-op if no target item). Entering work mode.
        NextAction.EditGrammar(var item, _) =>
            item is null
                ? world
                : world with
                {
                    Backlog = world.Backlog
                        .Select(i => string.Equals(i.Id, item.Id, StringComparison.Ordinal)
                            ? i with { NeedsNewAction = false, Ready = true, Ambiguous = false }
                            : i)
                        .ToList(),
                    Mode = Mode.Work,
                },

        // The four free modes set the persisted mode and leave the backlog alone.
        NextAction.Explore => world with { Mode = Mode.Explore },
        NextAction.Play => world with { Mode = Mode.Play },
        NextAction.SelfReflect => world with { Mode = Mode.SelfReflect },
        NextAction.FreeTime => world with { Mode = Mode.FreeTime },

        _ => throw new ArgumentOutOfRangeException(nameof(action), action, "unknown NextAction"),
    };

    /// <summary>Project state from the event log: left-fold over <c>Simulate</c>.
    /// History is a list of events; state is a projection of that list.</summary>
    public static World Fold(World initial, IEnumerable<NextAction> events) =>
        events.Aggregate(initial, Simulate);

    /// <summary>State after each event, the initial state excluded — mirrors the
    /// TS/F# <c>replay</c>.</summary>
    public static IReadOnlyList<World> Replay(World initial, IEnumerable<NextAction> events)
    {
        var states = new List<World>();
        var current = initial;
        foreach (var ev in events)
        {
            current = Simulate(current, ev);
            states.Add(current);
        }

        return states;
    }
}
