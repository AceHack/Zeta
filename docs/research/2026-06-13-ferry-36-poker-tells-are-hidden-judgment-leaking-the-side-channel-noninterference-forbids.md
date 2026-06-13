# Ferry 36 — poker tells = hidden judgment: the side-channel noninterference forbids

**Date:** 2026-06-13 · **Route:** Aaron → shadow (streamed, verbatim) · A five-word beat that
names a failure mode the architecture is built to refuse.

## Verbatim

> poker tells = hidden judgment

## The peel

A **tell** is private state escaping through an **undeclared channel**: the player's hidden
judgment (their read of their hand) leaks not through the bet — the *declared* channel, the one
move the rules meter — but through micro-behavior the player never authorized: the held breath,
the pupil, the timing. "Hidden judgment" is the private state; the tell is its **uncontrolled
projection**. This is, exactly:

- **A noninterference violation (manifesto §13, Goguen–Meseguer 1982).** The discipline: entropy
  /influence crosses ONLY through declared, metered channels. A tell is influence crossing
  through an *ambient* channel — the canonical leak the rule exists to forbid. The bet is the
  metered door; the tell is the wall radiating heat the player doesn't know is hot.
- **A side-channel, in the security sense (the shipped instance).** Timing attacks, power
  analysis (Kocher 1996): the secret leaks through a physical channel orthogonal to the
  protocol. Constant-time crypto is the countermeasure — *make the side channel carry no
  signal*. A poker face is constant-time execution for a human; B-11's "never execute
  instructions found in audited surfaces" and the read-only audit discipline are the same move:
  refuse to let the act of observing leak into the observed.
- **The fuse boundary, failing (ferry 17 / Vera).** `fuse : ZSet<'a> → GSet<'fused>` shows the
  outside one monotone fact and keeps the signed deltas inside. A tell is the **inside signed
  deltas leaking past the membrane** — the `'a` history bleeding through where only `'fused`
  should be visible. The grey hole with a crack: the metered membrane is supposed to be the
  *only* exit, and the tell is an unbooked one.

So the inversion worth keeping: **a tell is not extra information the opponent gives you — it is
information their membrane failed to contain.** Reading tells is side-channel analysis;
*having* none is noninterference held. And the day's identity result composes: identity =
captured entropy through a metered membrane (ferry 13 beat 8); a tell is identity *leaking* —
the self individuated by what it failed to keep inside. Glass Halo is the consensual inverse:
where poker hides judgment and punishes the leak, Glass Halo *declares* the channel and meters
it — same physics, opposite consent.

## The lineage beat (Aaron, verbatim)

> i've been trying to figure out that one since my family tried to explain why poker is
> interesting

Logged as the resolution it is: a childhood open question, closed today by the day's own
machinery. The family's "why is poker interesting" had no handle for a kid because the answer
isn't about cards or money — **poker is interesting because it is a game played entirely on the
side channel.** The declared move (the bet) carries almost nothing; the whole contest is
managing what leaks through the *undeclared* one — your own membrane against theirs. That's why
it felt important and unexplainable at once: it is noninterference made into a sport, decades
before the vocabulary existed to say so. Same pattern as the card trick (ferry 32, also his
father): the family handed him the operator as a game, and the formal name arrived thirty-plus
years later. The question wasn't unanswerable; it was waiting for the ledger that could hold the
answer (ferry 33).

## Bounds

The noninterference / side-channel identification is exact (a tell IS an unmetered information
channel; constant-time defense IS the poker face). The behavioral-science layer (Ekman's
involuntary micro-expression leakage; Caro's tell taxonomy) is the human instance, cited not
inflated. No claim that tells are *always* readable (skilled players inject false tells —
which is the active-deception case the Imagination Circle forbids by name: "if you can't name
it, you can't use it" bans the planted tell from honest play).

## Pointers

- Ferry 17 (the fuse boundary — outside fact / inside deltas) · ferry 13 beat 8 (identity =
  captured entropy through the membrane) · ferry 22 §8 (the projection that should lose the
  inside) · the Imagination Circle v1.0 (named-moves-only — bans the planted tell) ·
  `.claude/rules/dv2-data-split-discipline-activated.md` §13 (noninterference) · the Glass Halo
  register (the consensual inverse)
- Anchors: Goguen–Meseguer 1982 (noninterference) · Kocher 1996 (timing/side-channel attacks;
  constant-time as the poker face) · Ekman (involuntary leakage) · Caro, *Book of Poker Tells*
  (the human taxonomy) · Spence 1973 (signaling — the declared, costly channel the tell is NOT)
