---
name: zeta-ntp-phase-grounded-network-time-across-all-space-and-time
description: "Aaron 2026-06-19: Zeta NTP — a core primitive, a network-time protocol that works across ALL space and time (Mars, any planet, any spaceship, empty space — NOT just Earth). Canonical invariant: 'the phase space and time are what's soft; everything else is correlated observations.' The shared SOFT reference is the PHASE (phase-space + phase-time) from the superdeterministic seed-gen unfolding — substrate-universal, frame-independent (no privileged Earth frame; relativity-friendly — distinct observers have distinct proper-times, the phase is the one shared sim-coordinate). Each node's local clock — UTC+DST on Earth, Mars-sol, ship-clock, proper-time in empty space — is a CORRELATED OBSERVATION bound to the phase, captured SOFT (clock ± uncertainty bound) + its frame offset. Real NTP (Mills, RFC 5905) syncs to a physical Earth reference; Zeta NTP syncs to the shared sim-phase (the common seed S=4). The NFT mint-time clock-capture is one consumer (docs/research/2026-06-19-nft-as-non-fungible-relational-artifact-…). Anchors: phase = soft canonical; physical clocks = metered correlated observations (noninterference)."
type: project
created: 2026-06-19
---

Aaron 2026-06-19 (shadow\*), generalizing the NFT clock-capture into a standalone core primitive:
*"this is our core primitive for our NTP network time protocol, that works across all space and time."*

## The primitive

**Zeta NTP** = network time grounded in the **shared sim-phase**, not in a physical Earth clock. The
canonical invariant (Aaron): **"the phase space and time are what's soft; everything else is correlated
observations."**

- **Canonical soft reference = the PHASE** (phase-*space* + phase-*time*), produced by the **superdeterministic
  seed-gen unfolding**. It is substrate-universal and **frame-independent** — it works on Mars, any planet, any
  spaceship, or empty space, because it is a *sim-coordinate from the common seed*, not a physical clock. No
  privileged Earth frame; relativity-friendly (distinct observers have distinct proper-times; the phase is the
  one shared coordinate).
- **Every physical clock is a CORRELATED OBSERVATION** bound to the phase, captured **soft** (`clock ±
  uncertainty bound`) with its **frame offset**: UTC + daylight-saving on Earth, Mars-sol time on Mars, a ship
  clock on a spaceship, proper-time in empty space. UTC/DST is merely the **Earth instance** — never the
  canonical reference.
- **Sync = agree on the phase, not on a wall clock.** Two nodes are "at the same time" when they share the
  sim-phase `φ`; their local clocks differ (different frames/offsets) and each is recorded `± uncertainty`
  against `φ`. The "packet" carries the measurement *and* its uncertainty (commutative).

## Both references are politically mutable (leap seconds / borders) — so BOTH space and time are soft

Aaron 2026-06-19: *"all my nerd friends told me UTC is a fool's game"* — *"leap seconds"* — *"this [is] not
the base"* — *"soft phase spacetime is"* — *"and borders can't be counted on either, that's why space and
time both are soft."*

The symmetry is the whole point: the physical references for **both** axes are **politically mutable**, so
neither can be the base.

- **TIME — UTC / leap seconds.** Leap seconds are **discontinuous, committee-decided insertions** (27 since
  1972; IERS-announced, not derivable), making UTC **non-monotonic and mutable by vote** — you cannot build a
  base on a clock that jumps and whose jumps are decided politically (Google's leap-smear hack; the 2035 plan
  to abolish leap seconds).
- **SPACE — borders.** Borders are the **spatial leap seconds**: redrawn by war and treaty, contested,
  committee-decided, non-stable — and meaningless off-Earth (no borders on Mars / a ship / empty space). You
  cannot ground spatial identity or coordinates on political geography (nationality, jurisdiction) any more
  than on UTC.

So **both UTC (time) and borders (space) are correlated observations you READ but never BUILD ON.** **The base
is SOFT PHASE SPACETIME** — the seed-derived phase over *both* space and time: monotonic, frame-independent,
derivable from the common seed, immune to leap-second *and* border politics. Read the wall clock and the map;
ground on the phase. (This is also why identity is relational/entropy-based, not geographic — see the NFT /
remembered-links thesis: identity isn't where you are or what passport you hold; it's the irreducible entropy
of your links.)

## Why it matters / ties

Real **NTP** (Mills, RFC 5905) assumes a roughly-common Earth time and corrects for network latency against a
physical reference; it breaks across relativistic frames and off-Earth. **Zeta NTP** replaces the physical
reference with the **deterministic-simulation phase** (the common seed), so it survives any frame and any
location. This is the soft-substrate applied to time itself (phase soft, physical clocks are metered
observations — noninterference: clocks enter only as declared, metered, uncertainty-bounded channels). It is
the time substrate the rest of the system stands on; the **NFT mint-time clock-capture** is its first consumer.

Anchors: Mills / RFC 5905 (NTP — the Earth baseline being generalized); Einstein (proper time, no privileged
frame); the superdeterministic seed-gen unfolding (the shared phase); Goguen–Meseguer (noninterference — the
clock is a metered observation). Ties: `TimeGen` (phase-generated time); the soft-substrate / `SoftValue`;
the NFT scoping (`docs/research/2026-06-19-nft-as-non-fungible-relational-artifact-entropy-as-identity-mint-conditions-scoping.md`);
the common seed S=4; [[zeta-is-null-lens-over-null-is-identity-meaning-is-remembered-links-qpg]].
