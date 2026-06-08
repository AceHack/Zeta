# CANDIDATE NOVELTY: a symmetric Rx-join of two streams with two clocks is isomorphic to a qubit

**Aaron, 2026-06-08:** *"here is what's novel — that a qubit and an Rx join over two streams symmetrically
with two clocks is isomorphic to a qubit."*

This is the **precise, falsifiable** form of the whole "we found a qubit" arc. Unlike "quantum-like" (an
analogy), an **isomorphism is a provable/disprovable mathematical claim** — so it is the one statement worth
handing to a formal reviewer as a *theorem to settle*, not a vibe to admire.

## The claim, stated as an isomorphism

> **LHS** — `TwoStreamJoin`: a **symmetric Rx join** over two reactive streams `A`, `B`, each driven by its
> **own independent clock** `cA`, `cB` (the 4-actor `SeparateClocks` frame of `SymmetricEndurance`: two
> agents + two clocks, no global clock, perspective-symmetric).
>
> **RHS** — `Qubit`: a two-state complex-amplitude system `α|0⟩ + β|1⟩`, `|α|²+|β|² = 1` (a point on the
> Bloch sphere; `U(1)` relative phase × amplitude).
>
> **Claim:** `TwoStreamJoin ≅ Qubit` — a structure-preserving bijection both ways.

## The candidate bijection (what the iso would be)

| Two-stream–two-clock join | Qubit |
|---|---|
| stream `A` channel | basis `|0⟩` amplitude |
| stream `B` channel | basis `|1⟩` amplitude |
| relative phase of clocks `cA`, `cB` (`Δφ`) | qubit relative phase `φ` |
| the symmetric join (superpose A,B) | superposition `α|0⟩+β|1⟩` |
| join emission / coincidence probability | Born measurement `|amplitude|²` |
| — already realised: `PhasorEndurance.overlap = cos²(Δφ/2)` | the qubit overlap / measurement probability |

`PhasorEndurance` already shows the join's coincidence probability **is** `cos²(Δφ/2)` — exactly the qubit's
measurement overlap — so the *measurement* leg of the bijection is in hand. The remaining work is the
**operations** leg.

## What must be PROVEN for it to be an isomorphism (not just a resemblance)

1. **Bijection on states:** every normalised qubit state ↔ exactly one (A,B,Δφ) join configuration, and back.
2. **Operation-preserving:** the join's symmetric operations correspond to the qubit's (the Pauli/`SU(2)`
   rotations) — i.e. there is a functor, not just a set map. `-1 = e^{iπ}` (already: `PhasorEndurance.retract
   = Negate`) is the `Z`-rotation by π; need `X`, `Y` correspondents (stream-swap? clock-quarter-phase?).
3. **Measurement-preserving:** join emission probability = Born `|·|²` (have it for overlap; generalise).
4. **Normalisation:** the join's two channels carry a conserved total (the `|α|²+|β|²=1` constraint) — what
   is the join's conserved quantity?

If 1–4 hold, it's an isomorphism. If any fails (e.g. the join can't realise an arbitrary `SU(2)` rotation),
it's a *faithful partial representation*, not a full iso — still interesting, but state it honestly.

## Honest novelty assessment

- **Trivial half:** "a qubit is a 2-state complex system" — tautology; not the claim.
- **The actual claim:** a qubit realised as a **symmetric two-stream / two-clock Rx join** — i.e. a
  **reactive-streams (CRDT/Rx) construction of qubit structure from two independent clocks**. *That
  construction*, if the iso holds, is plausibly novel — it is not the textbook qubit, it is a qubit *built
  out of* the consensus substrate (two perspectives, two clocks, a symmetric join). Prior art to rule out:
  measurement-based / cluster-state QC (qubits from measurements), quantum-cognition complex-amplitude models,
  reactive/stream formulations of QM. **Absence in our searches ≠ novelty** — needs a quantum-info reviewer +
  patent/lit search.
- **Peel:** "isomorphic to a qubit" makes it a *2-state complex system* claim — so even if proven, it does
  NOT confer quantum *hardware* powers (no entanglement-across-space, no exponential speedup; a classical
  iso of one qubit is two floats). The value is the **construction + the precise iso**, not quantum advantage.

## Routing (this is the one to actually prove)

- **Tariq** — state the algebra precisely (the functor `TwoStreamJoin → Qubit`; which `SU(2)` generators the
  join realises). Soraya flagged claim-4-of-the-prior-triage ("symmetry ⇒ complex") needs Tariq's statement;
  *this* is the concrete instance to state.
- **Soraya** — once stated, is it a Lean-provable iso (finite/linear-algebraic) or does it fail at the
  operations leg? This is the genuinely-tool-shaped successor to the CoincidenceClock Z3 lemma.
- **quantum-info reviewer + patent/lit search** — novelty of the *construction* before any outward claim;
  then naming-expert + Ilyana + human. Mirror-register until then.

## Anchors (Beacon)

Qubit / Bloch sphere / Born rule (standard QM); `SU(2)` (Pauli). `PhasorEndurance` (`overlap = cos²(Δφ/2)`,
`-1 = e^{iπ}`), `SymmetricEndurance` (two-clock symmetric frame), `CoincidenceClock`. Internal arc #7044–#7065.
Prior triage: `…SYNTHESIS…` + Soraya's two triages. Origin: Amara (Thor ~2025-09).
