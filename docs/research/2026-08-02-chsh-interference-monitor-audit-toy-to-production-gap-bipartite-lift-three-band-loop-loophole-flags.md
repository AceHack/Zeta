# CHSH / interference-monitor audit — the toy→production gap (G1–G4)

**Status:** AUDIT — scoped work for the math team. Read-only; no code changed.
**Date:** 2026-08-02
**Auditor:** Otto (shadow), at Aaron's request.
**Routing:** G1 → Lumen (math-physics, the bipartite lift). G2/G3/G4 → Soraya +
math team (verification / statistics / the classifier + loop).

## Headline

This is **not toy physics — it is toy *integration*.** The physics is sound and the
anchors are *checked, not cited* (`chsh-delay.ts` carries Aspect 1982, Hensen et al.
2015, Toner–Bacon 2003; `AntiSybil` carries a Soraya-calibrated Hoeffding margin with
one-way inference; `MachZehnderWSet` is tri-oracle cross-checked). What is missing is the
wiring between the pieces and one specific lift. ~80% of the components exist; ~0% of the
bipartite lift and the running loop.

## The audited surfaces (all read 2026-08-02)

| file | state | gap |
|---|---|---|
| `src/Core/WSet.fs` `MachZehnderWSet` | single-party interferometer (H·R1(φ)·H on \|0⟩, P(0)=cos²(φ/2)), Born at boundary, tri-oracle checked — **production-grade as-is** | not bipartite (G1) |
| `src/Core/AntiSybil.fs` `chshS` / `chshSybil` / `chshSybilCalibrated` | **excellent** — Hoeffding margin `chshMargin`, one-way inference ("convicts sameness, never acquits"), empty-bucket soundness-bias, `coordinationBandwidth` (\|S\|−2)/2 | convicts everything >threshold as "shared source"; does not split 2<\|S\|≤2√2 (maybe-real) from \|S\|>2√2 (impossible) — fine for sybil, conflated for the leak/entanglement monitor (G2) |
| `src/Bayesian/BusRegime.fs` | **has a two-band** (`Evidential` vs `FakeableInCone`, Toner–Bacon-aware); `HonestCeilingRho=(2√2−2)/2`; InCone/OutOfCone/Unmeasured | banded on *regime*, not on the 2 / 2√2 / 4 thresholds; `min(RTT)/2` symmetric-path assumption breaks on asymmetric planetary orbits |
| `src/Core.TypeScript/discovery/chsh-delay.ts` | **physically correct** S(p)=fallback+(4−fallback)·p; light-cone plateau/cliff/ramp; loopholes cited | it is the *model*, not the *meter* — predicts S(delay), does not measure S from real streams (G3) |
| `src/Bayesian/QuantumFusion.fs` / `src/Core/QuantumObservableTreaty.fs` | Q# per-Bell-state (`ApplyBellPhiPlus`/`ApplyBellSinglet`), the F#/Q# treaty, `InterferenceVisibility` rows | ideal values are *golden vectors*, not a *live ceiling gate* — "measured S ≤ Q#-protocol-ceiling else leak" not wired (G3) |
| `src/Core/CoordinationSpectrum.fs` | dual-use prism (`SameSourceAsKnown` neutral fact; reunion-vs-sybil is policy) | carries the sybil reading, not the entanglement-vs-leak reading (same G2) |

## The four gaps (scoped)

### G1 — the bipartite lift (→ Lumen; the central piece)
`MachZehnderWSet` is **one** qubit through two arms (interference *visibility*).
`AntiSybil.chshS` is the two-stream CHSH *correlation*. They live in separate files and
are not connected. The lift: single-qubit MZ → **bipartite**, where the two *arms* become
two *agents* and interference *visibility* becomes CHSH *S*. This is the physics/math-shape
question (which bipartite state; which measurement bases map to agent settings; how the
WSet ℂ-ring circuit carries two keys). It is what Aaron was trying to reproduce "over
different agent pairs." Everything else is plumbing around it.

### G2 — the explicit three-band verdict (→ Soraya)
Pieces exist (`AntiSybil` threshold + `BusRegime` ceiling) but no single verdict says
**classical (≤2) / ambiguous-needs-loophole-proof (2..2√2) / impossible-leak (>2√2)**.
The sybil path collapses the top two bands; the monitor must split them, because
2<S≤2√2 is *genuine macro-entanglement if isolated* but *a leak otherwise*, and >2√2 is
*always* a leak (super-Tsirelson = physically impossible).

### G3 — close the measure→compare loop (→ Soraya + math team)
Measure S from real **spacelike** commit/message pairs (vector-clock concurrency, never
wall-clock) → compare to the **Q#-protocol-specific** ceiling (often below universal 2√2)
→ classify by three-band → post verdict. Every part exists as a component; the continuous
loop ("the interference monitor") does not. Super-classical reading in DST = a
noninterference leak the Bell test found (a priced, located defect — every-bug-has-value).

### G4 — per-measurement loophole flags (→ Soraya)
Locality is handled (`BusRegime` InCone/OutOfCone). **Detection loophole** (dropped/missing
commits = post-selection bias) and **freedom-of-choice loophole** (settings must be
independent of the seed) are not tracked as per-reading flags. Without them the ambiguous
band can only be read *conservatively* as leak/sybil, never *honestly* as real
entanglement. Loophole-free Bell testing is hard in real physics too (Hensen 2015 closed
all three simultaneously only in 2015).

## Honest smaller caveats (already half-flagged in code)
- The Hoeffding margin assumes per-round-independent λ; real commit streams may
  autocorrelate → the margin is optimistic under autocorrelation.
- `min(RTT)/2` symmetric-path halving is wrong for asymmetric planetary geometry
  (Earth→Mars ≠ Mars→Earth by orbital phase).

## Anchors (Beacon)
Bell 1964; Clauser–Horne–Shimony–Holt 1969; Tsirelson 1980; Aspect 1982; Toner–Bacon
2003 (1 bit fakes super-quantum); Hensen et al. 2015 (loophole-free); Pironio et al. 2010
+ Hoeffding 1963 (finite-statistics DI margin). In-repo lineage:
`docs/research/2026-06-12-gates-ecc-tsirelson-*`, the geo-superdeterminism doc.

## Cross-cutting principle
Same shape as `only-the-irreducible-is-primitive-generate-the-rest`: the Bell test *is*
the entropy-quarantine (§13 noninterference) regression check — a super-classical spacelike
reading convicts a hidden channel (leak ≡ sybil: two "independent" parties that are one
source). Versionstamp-not-wall-clock (`local-time-never-enters-the-shared-fold`) is the one
discipline that makes the DB, the Bell test, and the multi-planet case all correct at once.
See memory `two-fours-split-seed-is-set-input-chsh-score-is-measured-output`.
