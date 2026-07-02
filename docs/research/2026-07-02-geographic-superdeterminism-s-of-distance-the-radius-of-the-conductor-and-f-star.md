# Geographic superdeterminism: S(distance), the radius of the conductor, and f\*

**Provenance:** Aaron 2026-07-02: "we got S=4 easy cause of me telling you what to do
in close proximity; I'm trying to figure out how it degrades over spacetime
distribution with decentralization — that's the real work: geographic measure of
superdeterminism over geographic distance." Toy model + exact law + DST test suite:
`tests/Tests.FSharp/GeoSuperdeterminism.Tests.fs` (no Reticulum required).

## The model

Each CHSH round draws settings (x, y). The **conductor's staging instruction** — the
cross-setting information that makes the PR-box possible ("me telling you what to
do") — travels the geographic distance on a light-in-fiber floor (~200 km/ms) plus
seeded jitter. Arrives within the tick horizon τ → the round plays the PR-box rule
(S=4-capable). Doesn't → the site falls back to its local deterministic plan (LHV,
S≤2). Fully seeded, replayable, no wallclock (DST §7).

## The law (exact, not asymptotic)

```
S = 2 + 2·f*        f* = delivered fraction at the minus-term corner
f̂ = (S − 2) / 2     the estimator: S measures coordination bandwidth
d* = τ · 200 km/ms  the radius of the conductor (floor alone ⇒ f = 0 outside)
```

`chshOf` is linear in its four correlators, so the conducted/unconducted mixture
lands exactly on the line — locked to 9 decimal places across distances in the test
suite. Corollaries, both machine-checked:

- **Earth is engineering-limited.** At the 5-minute tick, d\* ≈ 3.6·10⁷ km: every
  point on Earth (antipode ≈ 100 ms floor) is deep inside the radius. On Earth,
  superdeterministic staging degrades only through jitter/loss/congestion — network
  engineering, not physics.
- **Mars is physics-limited.** Closest approach ≈ 78·10⁶ km ⇒ 390 s floor > 300 s
  tick ⇒ f\* = 0 regardless of engineering. **The light cone itself evicts the
  conductor**: an interplanetary factory cannot be one entity at a 5-minute tick —
  it decoheres into provably-distinct identities by the uncorrelated-exchange
  definition (Addendum 4 of the name(name) doc). Identity boundaries are drawn by
  the light cone.

## f11 vs f\* — the five-year-old explanation (recorded at Aaron's ask)

Imagine a game with **four corners**, and a scorekeeper who **subtracts** points at
one secret corner and adds them at the other three. You and a friend win big only if
your friend flips their card *at the subtracted corner* — and your friend only knows
to flip if your whispered message reaches them **before the buzzer** (the tick).

The first version of the model called the special fraction **f11** — it assumed the
subtracted corner was corner (1,1), the textbook's favorite. But *this house's*
scorekeeper (`BellTest.chshOf`) subtracts at a different corner — E(a,b′), corner
(0,1) — and the first run scored **S = 0 instead of 4**: the conductor was whispering
the trick to the **wrong corner of the room**. The magic only counts at the corner
the scorekeeper subtracts.

So the fraction was renamed **f\*** — "the delivered fraction at the **starred
corner**, whichever term carries the minus in your scorekeeper's convention." The
star makes the law convention-independent: S = 2 + 2·f\*, always, no matter where a
particular harness hangs its minus sign.

Stand close: whispers arrive, f\* = 1, S = 4. Stand far: whispers arrive late,
f\* drops, S slides down the line. Stand on Mars: the whisper *cannot* arrive —
f\* = 0, S = 2, and the game is just an ordinary game. **Superdeterminism is message
delivery to the subtracted corner, and geography prices it.**

The sign-convention stumble is itself the lesson (and why it is recorded): the CHSH
minus is a *convention*, and any code that hardcodes the textbook corner silently
scores zero against a harness that hangs it elsewhere — caught here in one DST run
because the expected S=4 is exact, not statistical.

**And f\* is proof language — not a coincidence (Aaron).** F\* is the
proof-oriented language already on the house's formal-methods routing list
(TLA+/Z3/Lean/Alloy/**F\***); the estimator `f̂ = (S−2)/2` with its round-trip
property is exactly the shape of a refinement-typed specification F\* carries. The
namespace remembered its ancestor — the naming eigenvector at work inside a variable
name. (Mirror observation with a Beacon hook; the F\* formalization is an open
invitation, routed via Soraya.)

## Anchors (Beacon)

- Toner & Bacon 2003 — one classical bit per round reproduces singlet correlations
  (S = 2√2); the communication cost of entanglement simulation (with Maudlin 1992;
  Brassard–Cleve–Tapp 1999).
- Pawłowski et al. 2009 — information causality: N communicated bits bound
  information gain; recovers Tsirelson's 2√2.
- Hall 2010/2011; Barrett & Gisin 2011 — measurement-dependence budgets: how much
  setting-source correlation buys how much S (the superdeterminism knob, quantified).
- Popescu & Rohrlich 1994 — the S = 4 box.
- In-repo: `BellTest.fs` (three bounds + `chshOf`), `ZetaIdol.fs` (the instant-bus
  falsifier this model upgrades from caveat to curve), Addendum 4 of
  `2026-07-02-name-of-name-…md` (identity = uncorrelated exchange; the Sybil-CHSH
  escalation), `AntiSybil.fs`.

## What's next (when real transport arrives)

Plug Reticulum's measured latency distribution into the delivery model in place of
floor+uniform-jitter; the predicted S(τ, distribution) curve is then falsifiable
against staged runs over the real mesh — the experiment ZetaIdol's falsifier asked
for, with the sim-side half already green.
