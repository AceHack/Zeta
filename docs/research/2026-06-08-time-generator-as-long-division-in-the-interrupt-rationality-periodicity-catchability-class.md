# The time generator as long division in the interrupt: rate-rationality → periodicity → catchability → regime class

**Aaron, 2026-06-08:** *"2√2 is the [Zeta] critical line / rate of observation to classes … but in long
division as the time generator function … in the interrupt."*

The defensible, anchored version (the Riemann-zeta reading is razored — see Peel). It gives "rate of
observation to classes" a concrete mechanism and unifies it with the detectability code we already shipped.

## The mechanism: the interrupt runs long division

The **interrupt is the DST time source** (emulator interrupt = the tick generator;
`2026-06-08-DST-timeline-operations-...md`). Place a **long-division generator in the interrupt**: the
**remainder is the state**, each interrupt tick emits a digit and updates the remainder. The remainder set is
finite, so by **pigeonhole**:

- **rational** divisor → the remainder **eventually cycles** → **periodic** tick stream;
- **irrational** rate (e.g. `2√2`) → **never cycles** → **aperiodic** forever.

## rate-rationality → periodicity → catchability → class

| interrupt rate | generator | catchable? | regime class |
|---|---|---|---|
| **rational** | eventually **periodic** (cycles) | **yes** — the cycle is findable (`resonantPeriod` autocorrelation finds it; `ForgerRace` detects it) | **classical / superdeterministic** (you can catch the seed) |
| **irrational** (`2√2`) | **aperiodic** (never cycles) | **no** — no period to find | **quantum** |

This is the **same axis as our detectability machinery**: a periodic generator has a findable period
(`resonantPeriod` succeeds ⇒ catchable ⇒ superdeterministic, `ForgerRace`/`#7080`); an aperiodic one defeats
it (uncatchable ⇒ quantum). "**Rate of observation → classes**" = the interrupt rate's **rationality**
classifies the regime; the "**critical line**" is the **rationality boundary** (not Riemann), with `2√2` on
the aperiodic/quantum side.

## Anchors (Beacon) — this is dynamics, not number theory

- **Long division as a finite-state machine:** remainder-state periodicity; the period of `1/n` = the
  multiplicative order of the base mod `n` (rational ⇒ eventually periodic; irrational ⇒ never).
- **Circle maps / Arnold tongues:** rational rotation number → **mode-locked / periodic**; irrational →
  **quasiperiodic** (KAM) — the rationality→periodicity classification, standard dynamical systems.
- **Mirollo–Strogatz pulse-coupled phase-locking** (already in our arc, #7088): rational frequency ratios
  lock (periodic), irrational don't.
- Internal: `resonantPeriod` (finds the cycle ⇔ rational ⇔ catchable), `ForgerRace` (catchable ⇔
  superdeterministic), the empirical protocol (`#7080`: catchability ⇔ class), interrupt-as-DST-time-source.

## Peel

- **NOT the Riemann zeta critical line** — razored (no connection; `2√2 ≈ 2.828` vs `Re(s)=1/2`; Hilbert–
  Pólya/Berry–Keating connect zeta *zeros* to eigenvalues, not to `2√2`). No numerology.
- **`2√2`'s specialness comes from the CHSH operator-norm (Tsirelson), NOT from being irrational** — most
  reals are irrational, so irrationality alone doesn't single it out. Two separate true facts about the same
  number: it's irrational (⇒ its long-division generator is aperiodic/uncatchable = the quantum-side
  property) *and* it's the Tsirelson value (the operator-norm property). The bridge here is
  **rationality → periodicity → catchability**, anchored to dynamics — not a number-theoretic claim about
  `2√2` specifically.
- A **conceptual mechanism**, not a proved theorem — whether "interrupt-rate rationality ⇔ regime class" is
  exact over `BellTest`/`ForgerRace`/`resonantPeriod` is for Soraya. Mirror-register until then.
