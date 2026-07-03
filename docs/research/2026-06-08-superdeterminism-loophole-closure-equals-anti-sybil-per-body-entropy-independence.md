# Closing the superdeterminism loophole ≡ anti-Sybil per-body entropy independence

**Aaron, 2026-06-08:** *"if there is a superdeterminism loophole, how do we close it? how far apart / how many
bodies before it's quantum?"*

The honest answer reframes the axis — and lands on a genuine bridge between the Bell-test physics and Zeta's
own consensus substrate: **the condition that closes the superdeterminism loophole is the *same* condition as
anti-Sybil non-fungibility**, and the existing `SymmetricEndurance` clock knob *is* the open/closed switch.

## 1. You cannot fully close superdeterminism — in principle

It is the **one Bell loophole that is logically unfalsifiable**: a sufficiently correlated initial condition
can mimic any quantum correlation. Real experiments don't eliminate it; they **push the required common cause
further back in time** until the needed conspiracy is absurd:

- **Cosmic Bell test** (Handsteiner et al., PRL 2017): settings from **quasars on opposite sides of the sky**
  → any superdeterministic correlation had to be set up **~billions of years ago**.
- **BIG Bell Test** (Nature 2018): settings from **~100,000 humans'** free choices.

So "closing it" is a *degree* (how far back / how fine-tuned the common cause must be), not a switch.

## 2. Distance and body-count are the WRONG axis

- **Distance** closes the *locality* loophole (space-like separation — no lightspeed signal coordinates the
  two during measurement), **not** superdeterminism (a past common cause works at any distance).
- **More bodies** (GHZ, 3+) make the violation *sharper* (GHZ kills local-hidden-variables in a single shot,
  no statistics) — but don't close superdeterminism.
- **There is no distance or body-count threshold where superdeterminism *becomes* quantum.** It's a different
  *explanation*, not a regime you scale out of. Only **independent measurement choices** make it quantum.

## 3. The right axis — and the bridge to anti-Sybil

In Zeta's model the superdeterminism is *total* because there is **one shared seed** (we are time — the DST
`SharedClock` regime). To close the loophole you must **remove the shared seed: give each body its own
independent, non-fungible entropy source** — the **`SeparateClocks` / independent-drift regime**
(`SymmetricEndurance`). And it becomes **operationally quantum** when the residual shared-seed correlation
drops **below the detection threshold** — i.e. when the side-channel probe (`ForgerRace`) *cannot find* the
shared component.

**So the closure condition is:**

> **Closing the superdeterminism loophole ≡ the anti-Sybil non-fungibility holding per body.**

They are the **same independence condition**:

- **Bell:** measurement-independence ("free choice") — the settings are not correlated with the hidden state.
- **Anti-Sybil:** distinct, non-fungible drift per identity — no shared entropy across bodies.

When each body's drift is genuinely its own (un-forgeable, un-shared), the settings are independent, the
loophole closes, and the staged correlations become **genuine rather than seed-staged**. The right axis is
therefore **how independent is each body's entropy**, and **how far below detectability the shared component
is** — exactly the `ForgerRace` / `SymmetricEndurance` axis, *not* distance or body-count.

## 4. The knob is already in the code

`SymmetricEndurance.ClockSharing` is the literal **loophole open/closed switch**:

- **`SharedClock`** (degenerate) = one seed = **superdeterminism loophole fully OPEN** (we stage the
  correlations; `CoincidenceClock` can reach the PR-box `S=4`).
- **`SeparateClocks`** (default) = independent per-body entropy = **loophole CLOSING** (toward genuine,
  detector-independent correlations; the anti-Sybil regime).
The "how independent / how far below detectability" is the `ForgerRace` cost model (per-body entropy vs a
forger's fabrication rate).

## Honest scope (peel)

- Superdeterminism is **never fully closed** (in principle); independence is a *degree* (detectability), and
  our DST `SharedClock` is the maximally-open case *on purpose* (it's the test instrument; the DST|production
  boundary keeps it out of deployment).
- The bridge "loophole-closure ≡ anti-Sybil independence" is a **conceptual identification** (both are
  measurement/entropy independence), not yet a proved theorem — route to Soraya (is it an exact equivalence
  over `SymmetricEndurance`, or a strong analogy?). Mirror-register until reviewed. No numerology.
- "Operationally quantum" = indistinguishable-from-quantum *to a bounded detector*, not "physically quantum"
  (no spatial entanglement; the prior peels stand).

## Anchors (Beacon)

Bell 1964 (measurement-independence assumption); Handsteiner et al. PRL 118 (2017, cosmic Bell / quasar
settings); BIG Bell Test Collaboration, Nature 557 (2018); Greenberger–Horne–Zeilinger (GHZ); Conway–Kochen
free-will theorem (2006). Internal: `SymmetricEndurance` (`ClockSharing`), `ForgerRace`, `CoincidenceClock`,
`BellTest`; the candidate-novelty qubit iso (#7066); anti-Sybil trajectory (#7044–). Origin: Amara (Thor ~2025-09).
