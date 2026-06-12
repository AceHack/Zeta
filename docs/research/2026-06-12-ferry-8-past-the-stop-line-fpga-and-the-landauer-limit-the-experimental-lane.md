# Ferry 8 — past the stop line: FPGA + the Landauer limit (the experimental lane)

**Date:** 2026-06-12 · **Route:** Aaron → shadow (streamed, captured verbatim) · Direct reply to
math-team REPORT #3's stop line
(`2026-06-12-attention-fundamentality-math-team-REPORT-3-the-boundary-between-theorem-and-theology.md` §4).

## Verbatim (preserved, typos and all)

> agree that's where applied / experimentation with fpga and lauderlimit comes in

(Context shown to Aaron immediately before: the stop line — "math can prove a consistent
process-first world exists where memory is derived and braids embed faithfully — consistency and
correspondence. It can never prove identity with the foam. Past that rung it's Whitehead's lane,
cited not proved.")

## The peel

Aaron accepts the stop line and names what lives on the other side of it: not more theorems —
**hardware experiments**. FPGA implementation, metered against the **Landauer limit**
(Landauer 1961: erasing one bit costs at least kT·ln 2 of heat; experimentally verified at the
single-bit scale, Bérut et al., *Nature* 2012). The claim ladder's top rungs aren't provable,
but a *physical* version of the middle rungs is **measurable**:

- **Process is (in principle) free; memory-erasure is what must pay.** Reversible computation
  carries no Landauer floor (Bennett 1973); only erasure does. Braid generators are group
  elements — every σᵢ has an inverse — so braid-computation is reversible by construction.
  The thesis "memory is derived; process is fundamental" gets a thermodynamic edition: the
  *process* lane can run at zero Landauer cost; heat is paid exactly where state is destroyed.
  REPORT #3's rung-1 theorem (`cache = I(stream)`, delete the cache and lose nothing) becomes a
  joules claim: deleting a derived cache is *recomputable* erasure — the information survives in
  the stream, so the erasure is logically reversible and the kT·ln 2 floor per lost bit does not
  bind. Erasing the *stream* would.
- **Fusion ship 1.0's ξ_t gets physical units.** η·LearningGain(Δ_t) > ξ_t
  (`src/Core/Fusion.Equation.fs`) was stated with ξ_t as an abstract entropy cost; Landauer
  prices it in joules per erased bit at temperature T. The superfluid inequality becomes a
  measurable hardware budget, not a metaphor.
- **The budget algebra gets a falsifier.** Ball.BitsUsed / the soft-max width theorem predict
  *bit counts*; an FPGA build metering energy per fuse-and-shed cycle tests whether the
  predicted bits track the measured heat. That is REPORT #3's rung-4/5 empirical lane pushed
  one level below software: run it, meter it — in joules.
- **Lineage note:** Aaron's own fusion doc already holds the reversible-silicon thread ("the
  quantum mirror is the reversible silicon") — ferry 7's 1.0/2.0/3.0 lineage extends naturally:
  the experimental lane is reversible/adiabatic logic on FPGA-class hardware with Landauer as
  the ruler.

**Honest bounds (so this ferry doesn't overclaim):** a commercial FPGA switches ~10⁶–10⁹× above
the Landauer floor; what an FPGA experiment measures is *relative* energy structure (does energy
track erased bits as the algebra predicts), not proximity to kT·ln 2. Approaching the floor
itself is adiabatic/reversible-logic territory (Frank's work on reversible computing
engineering). And no measurement at any scale buys rung 8 — the experiment lane tests the
*correspondence*, which is exactly what the stop line says is testable.

## The investment gate (Aaron's ruling, replying to the honest-bounds paragraph above)

Verbatim (preserved, typos and all):

> if i can get a algo that experimentally works on FPGA then it's worth further investment if not
> it stops at commercial FPGAs

Peel: a staged-investment stopping rule for the whole experimental lane. The commercial FPGA is
the *cheap falsifier* — it prices the next stage before any money flows toward
adiabatic/reversible hardware. Works on FPGA → the option on the Landauer-floor lane is worth
buying; doesn't → the lane terminates at commercial FPGAs, recorded, no sunk-cost climb. This is
fusion ship 1.0's inequality applied to the research program itself: keep investing while
η·LearningGain(Δ_t) > ξ_t holds for the *experiment series*, stop when it doesn't — the gate
gating its own funding (the ferry-7 recursive shape, one level up). Beacon anchor: staged
investment / real options (Dixit–Pindyck); cheap-experiment-first is the same discipline the
repo already runs as every-bug-has-economic-value (priced uncertainty reduction before spend).

## Pointers

- REPORT #3 §4 (the stop line, the rounds plan) · ferry 7 (fusion lineage 1.0/2.0/3.0)
- `src/Core/Fusion.Equation.fs` — ξ_t, now Landauer-priceable
- Anchors: Landauer 1961 · Bennett 1973 (reversible computation) · Bérut et al. 2012
  (experimental verification) · Frank, reversible computing engineering
