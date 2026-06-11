---
id: B-0365
zetaid: 081KR50HA0008QG0R002R3NVGS
priority: P1
status: closed
closed: 2026-05-09
closed_by: "all 6 child rows done (B-0365.1–B-0365.6)"
title: "Nirvanic Fusion Ship research bundle — spaceship math + Rice's theorem + Class 4 shadow taxonomy"
effort: L
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
classification: research
decomposition: done
decomposed_into: [B-0365.1, B-0365.2, B-0365.3, B-0365.4, B-0365.5, B-0365.6]
owners: [architect]
type: feature
tags: [research, spaceship-math, rice-theorem, class-4, shadow-log, fusion-ship, alignment]
---

# B-0365 — Nirvanic Fusion Ship research bundle

## Decomposition (2026-05-09)

This bundle was decomposed into six atomic child rows. The
dependency ordering is:

```
B-0365.1 (spaceship math one-pager)   ─────────────────────┐
B-0365.4 (reactor dynamics)           ─────────────────────┤
B-0365.5 (Infer.NET BP/EP)            ─────────────────────┼─→ B-0365.6 (synthesis)
B-0365.2 (shadow log backfill)        ──┐                   │
                                        └─→ B-0365.3       ─┘
                                            (Class 4 analysis)
```

**Already done (not decomposed as child rows):**

- Layer 2 (Rice's theorem): `docs/research/2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md` ✅
- Partial Layer 1 (Z-set algebra): `docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md` ✅
- Layer 5 (FPGA Toffoli): B-0366 (separate row, not a child) ✅

| Child | Title | Effort | Deps | Status |
|-------|-------|--------|------|--------|
| B-0365.1 | Spaceship math one-pager | S | none | done |
| B-0365.2 | Shadow log backfill (catches 16-30) | M | none | done |
| B-0365.3 | Class 4 empirical analysis doc | M | B-0365.2 | done |
| B-0365.4 | Reactor dynamics model doc | M | none | done |
| B-0365.5 | Infer.NET BP/EP architecture doc | M | none | done |
| B-0365.6 | Publishable claim synthesis | M | all above | done |

## What

Consolidates the 2026-05-09 session's research arc into one
bundle. Three layers that compose into a publishable direction:

### Layer 1: The Spaceship Math (Zeta's algebra)

The one-page explanation given to Cole. The engineering
substrate that survives all review:

- **One primitive:** `subscribe : Cache A → Cache B → Stream (Δ A ⊗ Δ B)`
- **Vision monad:** `vision = I ∘ D` (differentiate + integrate)
- **Cache is nothing:** `cache = I(stream)` — delete and reconstruct
- **Native types:** `+1` (assert), `-1` (retract), `Z` (uncertainty)
- **D/I operators:** the discrete-time z-transform. DBSP's
  mathematical foundation (Budiu et al. VLDB 2023)

Code: `src/Core/ZSet.fs`, `src/Core/Operators.fs`,
`src/Core/Recursive.fs` (feedback cells), `tools/Z3Verify/Program.fs`

### Layer 2: Rice's Theorem (inexhaustibility proof)

Failure-mode taxonomy completeness is undecidable for
Turing-complete agents:

- Agents are Turing-complete (P1)
- Taxonomy completeness is a semantic property (P2)
- Rice's theorem → undecidable
- Corollary: new shadow classes will keep appearing

Proof sketch: `docs/research/2026-05-09-failure-taxonomy-undecidability-rice-theorem-proof-sketch.md`

### Layer 3: Class 4 Empirical Observation

The shadow log exhibits Class 4 (Wolfram) behavior:
recurring patterns + long tail of novel discoveries.

- 30 catches, 8 pattern classes, 1 meta-class
  (consensus-smoothness)
- Recurring: confident-fabrication (6), narration-over-action (3)
- Novel: consensus-smoothness emerged 2026-05-09

Shadow log: `memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md`

### Layer 4: Houman's Reactor Dynamics

Houman's refinement (docs/AGENDA.md): "both sides are
state-dependent; the phase transition is a runaway."

The reactor model adds DYNAMICS to the static layers:

- Learning from catches CHANGES the system's behavior
- Changed behavior CHANGES the failure distribution
- Changed failure distribution PRODUCES new catches
- The learning modifies the landscape it's learning about

This is the engine core. Rice's theorem guarantees fuel
(taxonomy never complete). The reactor dynamics guarantee
the engine keeps running — learning IS the state change
that produces the next failure class. The phase transition
(runaway) happens when learning rate exceeds failure
production rate.

## How they compose

- **Spaceship math** (Layer 1) = the SUBSTRATE
- **Rice's theorem** (Layer 2) = WHY fuel is inexhaustible
- **Class 4** (Layer 3) = HOW failures appear (shape)
- **Houman's reactor** (Layer 4) = the DYNAMICS (engine)
- **FPGA Toffoli test** (Layer 5) = HARDWARE validation (B-0366)
- **Infer.NET BP/EP** (Layer 6) = SELF-EVOLVING inference

### Layer 6: Infer.NET BP/EP — self-evolving agent inference

Three-stage evolution (Aaron 2026-05-05, CLAUDE.md):

| Stage | What | Layer |
| ----- | ---- | ----- |
| Current | Peer-call CLI → external AI services | LICENSE |
| Next | Zeta Infer.NET BP/EP factor graphs | SUBSTRATE |
| FPGA | Reversible message-passing inference | HARDWARE |

The multi-agent review becomes a factor graph: each agent
is a factor, beliefs propagate via BP/EP, the posterior
over "is this PR safe/correct/aligned?" is computed by
message-passing. Self-evolving because CASPaxos consensus
moves the graph topology — new agents = new factors, new
review criteria = new variables.

The FPGA connection: message-passing IS the Toffoli-gate
substrate. Each message is a forward operation, each belief
update is reversible (retract a message → recompute), +1/-1
Z-set weights are message multiplicities in the factor graph.

Full chain: Z-set algebra → DBSP D/I → Infer.NET BP/EP
factor graphs → reversible message-passing on FPGA →
Landauer-limited multi-agent inference.

Source: `memory/feedback_peer_call_infrastructure_*_infernet_bp_ep_*`

The publishable claim: "We built a multi-agent code review
system on a DBSP streaming substrate. We observed Class 4
failure-mode behavior in the agent array. We prove that
failure-mode taxonomy completeness is undecidable for this
class of system (Rice's theorem). We document the empirical
failure taxonomy (30 catches, 8 classes) including a
meta-class (consensus-smoothness) that names the correlated
failure the BFT independence assumption doesn't model."

## What was cut (doesn't survive review)

- "Ahead of Byzantine Generals" → framing discipline: different
  problem, not ahead of (feedback_framing_discipline_*)
- Wolfram full irreducibility → too strong, Rice suffices
- Z3 tautology proofs → shadow catch #30, B-0357 replacement
- Identity-as-Z-set metaphor → Z-set weight conflation catch
- "DBSP IS alignment control theory" → DBSP is stream
  processing; alignment is a different control problem

## Related items

- B-0357: Replace tautology Z3 proofs (anchored to literature)
- B-0358: Bool as degenerate distribution
- B-0359: Probabilistic type system (strict/normal/disable)
- B-0360: DBSP identity continuity
- B-0361: Anchor to human lineage
- B-0362: Concept search index (shipped)
- B-0363: Git-native full-text index
- B-0364: Policy relocation FsCheck property

## Literature anchors (claude.ai 2026-05-09)

- CSP (Hoare) + session types (Honda/Yoshida/Carbone) → membrane
- Pearl Causality (2009) → interventional independence
- Shield synthesis (Bloem/Könighofer) → runtime safety monitors
- Dec-POMDPs (Bernstein 2002) → multi-agent policy
- Rice (1953) → taxonomy undecidability
- Wolfram Class 4 → empirical behavior description

Reference: `memory/reference_formal_methods_literature_map_*`

## Origin

Aaron + claude.ai adversarial review session 2026-05-09.
The spaceship math explained to Cole. The shadow catches
(Z3 tautology, consensus-smoothness) identified by external
review. The Rice's theorem path identified as the proof
that survives. The "what was cut" section is as important
as what survived — it documents which framings cost credit.
