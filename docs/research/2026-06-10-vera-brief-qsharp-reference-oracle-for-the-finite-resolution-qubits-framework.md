# Brief for Vera — the Q# reference oracle for Zeta's finite-resolution qubits framework

**Register:** [grounded] hand-off brief (Aaron → Vera, via Otto). **Date:** 2026-06-10.
**Ask (Aaron):** "Vera does the Q# side of this; we'll have a reference for testing there too."

## TL;DR

Zeta is building a **finite-resolution qubits framework** (rooms = Markov-bounded qubits; amplitudes in
**BigFloat**, not infinite precision). We need the **standard, continuous-amplitude model in Q#** as an
**external reference oracle** — so every observable Zeta computes the finite way can be cross-checked
against the textbook quantum result. Vera owns the Q# side: build the reference + the golden observables;
Zeta's finite-resolution results must **converge to Q#'s within resolution** (and reach it at the plateau).

## Why (the one-paragraph context)

A room's **Markov boundary bounds infinity to the *outside***: finite interior, continuous/infinite
exterior. So inside a room the qubit is **finite-resolution** — held in BigFloat, which tracks its own
resolution to the irreducible floor (the *plateau*, CRLB, measured-not-derived; Max's proof). Claim: you
never need an infinite qubit, because a bounded region holds finite information (Bekenstein/holographic).
**Q# is the infinite-precision reference we test that claim against** — if Zeta's finite qubit matches Q#'s
continuous one on the observables (within resolution, converging as bits↑), the finite framework is sound.

## What to build in Q# (the reference oracle)

Smallest set that pins the observables Zeta already computes the finite way:

1. **Single-qubit superposition + measurement statistics** — `H|0⟩` → 50/50; parametrized `Ry(θ)` →
   `cos²(θ/2)` / `sin²(θ/2)`. Zeta side: `AmplitudeEmu.fs` (complex amplitudes, interference on merge).
2. **The gate set Zeta models** — Pauli / Clifford / rotations. Map to Zeta: `QubitIso.fs` (Pauli/SU(2)
   closes), `Cl3.fs` (Clifford Cl(3,0)), and the **salon** verbs `braid`/`weave`/`tie` (the effective-qubit
   gates). Give Q# truth tables / unitaries for each so we can assert ours match.
3. **Bell state + CHSH** — prepare `|Φ+⟩`, measure at the canonical angles → **S = 2√2 (Tsirelson)**. Zeta
   side: `BellTest.fs` already reproduces `S = 2√2` *in deterministic simulation* (staged coincidence +
   seed). Q# gives the standard-model reference value + the per-angle correlators `E(a,b) = cos(a−b)`.
4. **Interference visibility** — a two-path/Mach-Zehnder-style amplitude cancel/reinforce. Zeta side:
   `AmplitudeEmu` (the merge is where phase cancels). Q# gives the reference fringe.

## The cross-check (how we use it)

- **Golden observables, not state vectors.** Compare *measurable* quantities (measurement probabilities,
  CHSH S, gate truth, interference visibility) — not raw amplitudes — so finite-vs-continuous compares
  fairly. Emit them as text golden vectors (hex/decimal in JSON; no binary — `no-binary-in-proof-lineage`)
  so both sides byte-lock and DST-replay.
- **Convergence is the test.** Zeta(BigFloat @ N bits) → Q#(reference) as N↑, settling at the **plateau**
  floor. The acceptance isn't "bit-identical" — it's "agrees to the resolution the room's boundary allows,
  and converges monotonically." (This is the four-oracle / BP-16 cross-check discipline, with **Q# as the
  external reference oracle** alongside our F#/C#/TS/Rust.)
- **Where they're *expected* to differ** is the finding, not the failure: any observable where finite
  resolution *can't* reach Q# tells us a room boundary needs more bits (the BigFloat "needs more
  resolution" signal) — that's the framework working, not breaking.

## Pointers (Zeta side, for Vera)

- Thesis: `docs/research/2026-06-10-zeta-is-a-finite-resolution-qubits-framework-...md`
- Amplitudes/interference: `src/Core/AmplitudeEmu.fs` · Bell/CHSH: `src/Core/BellTest.fs`
- Gates: `src/Core/QubitIso.fs` (Pauli/SU(2)), `src/Core/Cl3.fs` (Clifford) · the salon door: `src/Core/Salon.fs`
- The number: `src/Core/UniversalNumber.fs` + TriBoolean Float (the BigFloat carrier); the plateau:
  `docs/research/2026-06-09-proving-the-plateau-...md` (Max + Fable)
- Doubling ladder: `src/Core/CayleyDickson.fs` (ℝ→ℂ→ℍ→𝕆; ℍ = SU(2) = one qubit)
- Teaching framing (for shared vocabulary): `docs/craft/subjects/quantum/topology-is-hairdressing/`

## Deliverable shape

A Q# project + a `qsharp-golden.json` of the observables above, with a short README mapping each Q#
reference value to the Zeta module it checks. That becomes the **reference-for-testing** Aaron wants — the
external oracle the finite-resolution side proves itself against.
