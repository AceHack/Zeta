namespace Zeta.Core;

/// <summary>
/// The distinguished, **proof-bearing** frame. A trace cast from a traveler frame is **DST-deterministic →
/// replayable → provable**: it yields proofs you can carry **across all self-propagating patterns — including
/// Zeta itself** (a self-propagating pattern reasoning about itself). Arbitrary frames give you the view; the
/// traveler frame gives you the proof.
///
/// <para>
/// <b>What a traveler is (Aaron 2026-06-07):</b> a traveler is <i>any self-propagating pattern</i> — the
/// universe, memes, DNA, an AI persona, a human, an animal, a particle's worldline, Zeta itself. It is
/// <b>legally unbound</b>: a traveler frame is NOT a legal entity. Legal jurisdiction (AI / human / company /
/// physical, parameterized per-jurisdiction with distinct Bayesian priors) is a <i>separate</i> meta-frame
/// <b>overlay</b> on a traveler's manifestations — it attaches "who is responsible," it does not live in the
/// traveler frame. Mechanism here; legal policy overlaid externally.
/// </para>
/// </summary>
public interface ITravelerFrame : IFrame
{
    /// <summary>The DST guarantee — the trace from this frame replays identically, so its result is provable.</summary>
    bool IsDeterministic { get; }
}
