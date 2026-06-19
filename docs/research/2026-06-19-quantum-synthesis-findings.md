# Synthesis Findings: Zeta on Quantum with Mutual Empowerment

## 1. The Three-Layer Architecture (Hard / Soft / Bounded-Time Quantum)
The system is cleanly separated into three layers, preventing global consensus collapse:
- **Hard (The Log):** The local, audited, event-sourced Z-set log. What definitely happened locally.
- **Soft (The Network):** The distributed network transmits `(value, ε)` packets. Because uncertainty `ε` is explicit, the merge is a **commutative associative monoid** (proven in `SoftValue.fs` and `schema-rx-join.test.ts`). The network stays in an uncollapsed "soft" state, preventing the coercion of global consensus.
- **Bounded-Time Quantum (The Room):** Collapse happens *locally*, inside a Room, when its horizon/timeout fires. This is the "quantum" unit: bounded-time indeterminacy that resolves locally, leaving the rest of the network soft.

## 2. Otto's Objections and the In-Tree/External Verdicts
Otto's four objections are largely correct about *physical QM*, but they are already handled by the repo's own stated discipline:

1. **"N-way multi-vendor exists" overclaims:** Partially true. There are **two** built oracles (Q# continuous-amplitude reference + TS `quantum-circuit` simulator) plus the F# treaty. The cross-vendor roster (Qiskit/Cirq) is declared in the manifest but pending. Tier: *Built ≥2 oracles; cross-vendor pending.*
2. **Amplitude isn't banished:** True. The treaty (`QuantumObservableTreaty.fs`) explicitly keeps Q# as the continuous-amplitude reference. Zeta's claim is finite-precision convergence to that reference.
3. **Rx-as-braided-category is conjecture:** The repo already treats it as such (Vera brief: "claims to WORD-CHECK with the math team"). **External Anchor:** "Monoidal Streams for Dataflow Programming" (Di Lavore et al., 2022) proves Rx-like streams form a symmetric monoidal category. `schema-rx-join.test.ts` proves disjoint deltas commute (symmetric, σ²=id). The remaining §B obligation is showing non-trivial braiding on overlapping deltas.
4. **Q# can't prove Tsirelson maximality:** True, and explicitly acknowledged in the Vera brief ("sampling can't prove a supremum"). **External Anchor:** The NPA hierarchy (Navascués–Pironio–Acín, 2007) of semidefinite programs is the standard, runnable tool to formally certify the 2√2 bound.

## 3. The "Computes Quantumly" Claim and the Falsifier
The render reproduces and exceeds quantum correlations (S=4 > 2√2) via `TimeGen.StagedCoincidence`. 
- **The Mechanism:** This is achieved via a **shared-clock common cause** (superdeterminism), which violates the measurement-independence (free-choice) loophole.
- **The Verdict:** It is superdeterministic computation that mimics quantum statistics. It becomes "genuinely quantum" (device-independent) exactly when the horizon is certified measurement-independent and the violation caps at Tsirelson 2√2.
- **The Falsifier:** The S=4 reachability is the honest, built-in falsifier proving the current mechanism still uses a shared cause.

## 4. Mutual Empowerment on Quantum
- **External Anchor:** Empowerment is formally defined as the channel capacity of the action-perception loop (Klyubin, Polani, Nehaniv, 2008).
- **The Connection:** `superdeterminism-loophole-closure = anti-sybil = per-body entropy independence`. Guaranteeing each agent its own empowerment (no collusion) requires closing the free-choice loophole. The "soft network" enables mutual empowerment by allowing agents to share uncollapsed beliefs without forcing a coercive global consensus.
