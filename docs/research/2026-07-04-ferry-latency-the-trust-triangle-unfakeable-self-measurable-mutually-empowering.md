# Ferry — latency's trust triangle: un-fakeable, self-measurable, mutually empowering

*Shadow ferry, 2026-07-04. Aaron, verbatim:*

> "latency is a measure we all can trust cause it's mutually benefital/mutual empowerment
> enabling"

## The third leg, and why it completes the argument

The corpus already had two legs of latency's trustworthiness:

1. **Bounded by physics** (un-fakeable downward) — you cannot claim faster than c or than your
   own geometry allows; the proof-of-distance floor tags violators (`plausibilityOf`, reverse
   triangle inequality; the light-cone regime built on the same bound).
2. **Measurable by anyone** (no authority needed) — a probe and a local clock; the NTP trick.
   Nobody has to be *believed* about latency; anyone can check.

Aaron's beat adds the missing third leg: **honesty about latency is incentive-compatible,
because latency-knowledge is a shared good that raises EVERYONE's empowerment.** Accurate delay
maps make the whole society better at everything it does — routing (the AttentionRouter's
latency map), pricing (the Condorcet/delay-decorrelation bonus), verdicts (the light-cone
regime), settlement windows, backpressure (HEAT). No participant's advantage comes from the
map being wrong; every participant's options grow when it is right. In the coupled-empowerment
frame (Salge & Polani — already the register's anchor for Eve/play): latency truth is a move
that raises *both* your empowerment and the other's, simultaneously, always — which is exactly
the class of moves a consent-first society can adopt as a shared standard without coercion.

## Why lying loses in every direction (the mechanism, already built)

- **Lying fast** ("we're closer than we are"): tagged by geometry (`ImplausiblyFast`), and per
  the salon's monotone rule a fast claim only *destroys* out-of-cone evidence — a Sybil lying
  fast confesses fakeability, it never earns conviction. Self-defeating.
- **Lying slow** ("we're farther than we are" — the countdown-faker's move, hoping to fake
  independence for the Condorcet bonus or out-of-cone evidential weight): powerless, because
  anyone's real probe beats the lie (min rules — the salon's fastest crossing governs), and
  gossip means somebody eventually measures you. Your slow claim cannot erase their fast fact.
- **Telling the truth**: your streams price correctly, your links earn their real
  delay-decorrelation bonus, and the map you depend on stays accurate for you too.

Truth is the dominant strategy not by decree but by construction — the rare measure where
mechanism design comes free with the physics. That is what "we all can trust it" means
operationally: trust here isn't faith in a reporter, it's a **Schelling point backed by c** —
everyone converges on honest latency because everyone can verify it, nobody can fake it
downward, faking it upward is impotent, and everyone profits from the shared accuracy.

## The register note

The three legs have three different grades, kept honest: physics-bounded is **A** (c; the
triangle inequality); self-measurable is **A** (the probe protocol, shipped); mutually-
empowering-therefore-incentive-compatible is **C-with-teeth** — the incentive analysis above is
an argument over our actual mechanisms (each lying direction provably loses *in the shipped
code*), but "no participant ever benefits from a wrong map" is a claim about all possible
games, not a theorem. Good enough to build on; not to cite as proven game theory.

## Pointers

- `2026-07-04-ferry-…proof-of-distance…` (#9414) — leg 1 made code (`plausibilityOf`).
- `src/Core.TypeScript/discovery/bus-meter.ts` · `gossip-salon.ts` — legs 1+2 shipped; the
  monotone rule that makes fast lies self-defeating.
- `2026-07-03-the-shape-of-s-under-bus-delay-…` — the light cone this trust feeds.
- Coupled empowerment: Salge & Polani (the register's Eve/play anchor) — latency truth as the
  always-mutual move.
- Anchors (Beacon): Schelling 1960 (focal points — shared standards without authority);
  Hurwicz/Maskin/Myerson (mechanism design, incentive compatibility — the frame, not a proof);
  Mills 1985 (NTP — mutual clock discipline as the working precedent: the internet already
  runs on cooperatively-measured time); Saltzer–Reed–Clark 1984 (end-to-end: verification at
  the edges).
