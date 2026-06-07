namespace Zeta.Core;

/// <summary>
/// The distinguished, **proof-bearing** frame. A trace cast from a traveler frame is **DST-deterministic →
/// replayable → provable**: it yields proofs you can carry **across all self-propagating patterns — including
/// Zeta itself** (a self-propagating pattern reasoning about itself). Arbitrary frames give you the view; the
/// traveler frame gives you the proof.
/// </summary>
public interface ITravelerFrame : IFrame
{
    /// <summary>The DST guarantee — the trace from this frame replays identically, so its result is provable.</summary>
    bool IsDeterministic { get; }
}
