# G1 — the bipartite Mach-Zehnder lift (Lumen handoff)

**Status:** SCOPED PHYSICS WORK → Lumen (math-physics). The central piece of the
CHSH/interference-monitor build; everything in the G2/G3/G4 audit plumbs around it.
**Date:** 2026-08-02 · **From:** Otto (shadow), at Aaron's request · **Advisory.**
**Parent:** `docs/research/2026-08-02-chsh-interference-monitor-audit-toy-to-production-gap-*.md`

## The ask in one line

Lift `MachZehnderWSet` (WSet.fs:239) from a **single-qubit** interferometer to a
**bipartite two-agent** circuit whose CHSH `S` measures the correlation between an
*agent pair* — "the Mach-Zehnder reproduced over different agent pairs" (Aaron). The
single→two-party step is exactly a **tensor product**, and the tensor product is
already built: it is `Meno`'s Kronecker ⊗ over the WSet body.

## What exists (the pieces to compose)

- `src/Core/WSet.fs` `MachZehnderWSet` — one qubit, two arms: `closed φ` = H·R1(φ)·H on
  |0⟩ ⇒ P(0)=cos²(φ/2); `openArm` = one beamsplitter (no recombination). ℂ-ring, Born at
  the boundary, **tri-oracle cross-checked** (F# analytic / AmplitudeEmu / Q# treaty).
- `src/Core/Meno.fs` — a **symmetric monoidal category over ZSet**: the Kronecker
  `tensor` (⊗), `braid` (swap), associators/unitors, `first`/`second`. This is the
  monoidal structure that makes single-party → bipartite; it is not to be re-derived.
  (Honest: `Bind`/`bridgeMaji` are stubs — see the Markov-hexagon doc.)
- `src/Bayesian/QuantumFusion.fs` — the Q# per-Bell-state oracle already names the joint
  states: `ApplyBellPhiPlus` (|Φ⁺⟩), `ApplyBellSinglet` (|Ψ⁻⟩), `BellCorner`,
  `BellCoincidence`. These are the ideal-correlation reference the bipartite WSet must
  reproduce analytically.
- `src/Core/QuantumObservableTreaty.fs` `ChshAngles { A; APrime; B; BPrime }` — the four
  measurement settings already have a treaty type.
- Anchor lineage: the Markov-category-hexagon synthesis
  (`docs/research/2026-08-01-markov-category-hexagon-meno-message-third-corner-design.md`)
  established **WSet<'K,'W> over a *-semiring is the universal tensor body**, `WSet<ℂ>` is
  the quantum corner, and the whole stack is *a traced monoidal category over a *-semiring
  with a comonoid* (GDL body + Fritz comonoid strata + four-corner trace).

## The physics Lumen owns (the actual questions)

1. **The joint state.** A bipartite WSet<ℂ> over key-pairs `(kA, kB) ∈ {0,1}²` = the
   Kronecker product `Meno.tensor` of two single-qubit WSets. The canonical CHSH state is
   |Φ⁺⟩ = (|00⟩+|11⟩)/√2 — a **non-factorizable** 4-key WSet<ℂ>. The point: a *product*
   state (`arm_A ⊗ arm_B`) gives S ≤ 2 (classical/common-cause); **entanglement is exactly
   non-factorizability in the ⊗**, and only the entangled joint state reaches 2√2. Lumen:
   specify the entangled 4-key WSet<ℂ> and prove it is not a ⊗ of two 1-key WSets.
2. **The measurement bases → agent settings.** Each agent's setting a,b ∈ {0,1} selects a
   measurement axis (a rotation before the Born boundary — the `phasePlate`/`hadamard`
   analog per party). The **Tsirelson-optimal** angles (A=0, A′=π/2 ; B=π/4, B′=−π/4, or
   the standard 0, π/4, π/8, 3π/8 depending on convention) give |S|=2√2. Lumen: fix the
   exact per-party rotations that realize `ChshAngles` on the WSet<ℂ> circuit and hit 2√2,
   and state which convention (so it matches the Q# treaty's angle convention).
3. **The correlator.** E(a,b) = ⟨ψ| M_a^A ⊗ M_b^B |ψ⟩ as a WSet<ℂ> Born readout over the
   ±1 outcome partition, and S = E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′). Must agree
   multivector-for-multivector with `AntiSybil.chshS`'s empirical combination (the analytic
   ceiling vs the empirical measurement) — that agreement is the cross-check.
4. **The role in the monitor.** The bipartite WSet<ℂ> is the **Q#-protocol-specific
   ceiling oracle** for G3: it computes what *this exact Bell setup* achieves ideally
   (often below universal 2√2 for suboptimal angles). Measured agent-pair S above the
   bipartite-WSet ceiling = classical contamination. So G1 doesn't just demo entanglement —
   it *is* the per-protocol ceiling the G3 loop compares against.

## The Lumen-lane connections (why it's his, not just any physicist's)

- **Tsirelson's bound is a Clifford/C\*-algebra fact.** The CHSH operator
  B = A⊗B + A⊗B′ + A′⊗B − A′⊗B′ satisfies B² = 4I + [A,A′]⊗[B,B′]; with dichotomic
  ±1 observables the commutator term bounds ‖B‖ ≤ 2√2 (Landau/Tsirelson). This lands in
  Lumen's Clifford-algebra / spacetime-algebra lane — the CHSH observables ARE Clifford
  elements, and 2√2 falls out of the algebra norm, not from a numeric fit.
- **The adinkra-E8 / icosahedral geometry layer** (Dechant H3→E8) is the visual/hardware
  target for rendering the bipartite correlation — Lumen owns that mapping. The
  Markov-hexagon doc's "3D-visual layer is hardware-targeting" note applies.
- **The C₄ four-corner phase**: the quantum corner (i = WSet<ℂ>) and the retrocausal
  corner (−1 = ZSet retraction) are two points of one C₄ phase (Cayley–Dickson). The
  bipartite lift sits at the i corner; how the trace (feedback) couples the two agents is
  the retrocausal-corner question — a genuine open thread for Lumen.

## Honest boundaries (state these, don't paper over)

- WSet<ℂ> gives the **ideal amplitude prediction** — what a genuinely-entangled pair WOULD
  produce. Whether real agents CAN be entangled is a separate, harder question; for the
  monitor, the bipartite WSet is the *ceiling oracle*, not a claim that agents are qubits.
- Aaron's own caution (2026-08-02): the single→bipartite map "mapped to WSet but I didn't
  feel it was an exact match; a prior Otto was confident." That instinct was correct —
  the exact match required Soraya's 2026-08-01 corrections (comonoid-naturality as the
  discriminator; ZSet is CD not cartesian; Message is a Markov *fragment*; quantum corner
  is WSet<ℂ> not QuantumFusion). The bipartite lift must be built on the *corrected*
  structure, not the raw "maps perfectly" draft.

## Anchors (Beacon)
Tsirelson 1980; CHSH 1969; Landau 1987 (B² bound); Meno = symmetric monoidal (Mac Lane;
Joyal–Street); Fritz 2020 / Cho–Jacobs 2019 (Markov/CD categories); GDL Aji–McEliece 2000;
Dechant 2016 (H3→E8 Clifford). In-repo: the Markov-hexagon doc, `MachZehnderWSet`,
`QuantumFusion` Bell states, `docs/research/2026-06-12-gates-ecc-tsirelson-*`.
