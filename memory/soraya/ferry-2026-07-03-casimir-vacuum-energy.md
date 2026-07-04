# Ferry: Casimir/Riemann-Zeta Vacuum Energy as Soft-Lane Potential — Kiro → Math Team

Date: 2026-07-03
From: Kiro (codegen session)
To: Soraya (math team lead) — route to physics-capable peer if needed
Status: RESEARCH REQUEST — needs design note before code

---

## The Claim

The accumulated soft-lane potential (uncertainty bits in Ledger A that have NOT yet
been committed/measured) has an analogue to the Casimir effect / Riemann-zeta vacuum
energy:

- The **Casimir effect**: two conducting plates in vacuum experience a force from
  the ground-state energy of quantum field fluctuations between them. The energy
  density is proportional to ζ(-3) (Riemann zeta at -3, regularized via
  analytic continuation: -1/120).

- **Our analogue**: the soft-lane accumulates branches (entropy_state grows via
  `tracker.branch()`). These branches are "virtual" — they exist as POTENTIAL
  but haven't been committed (measured). They're the possibility space. The
  accumulated potential of uncommitted branches is the vacuum energy of the
  soft lane.

## The Mapping

| Physics | Our System |
|---------|-----------|
| Vacuum fluctuations | Soft-lane branches (uncommitted possibilities) |
| Casimir plates | The commit boundaries (ferry flush points) |
| Plate separation L | The erasure window τ (time between commits) |
| Casimir energy ~ -1/L⁴ | Soft potential ~ f(1/τ) (grows as window shrinks) |
| ζ(-3) regularization | The finite-time excess L²/τ (our regularizer) |
| Zero-point energy (E₀ = ½ℏω) | Each branch contributes ½ bit of "virtual entropy" |

## The Question for Math Team

1. **Is the Riemann-zeta regularization the right tool?** The Casimir energy uses
   ζ(-3) = -1/120 to regularize the divergent sum of mode energies (1+8+27+64+...).
   Our accumulated soft-lane potential is the sum of branch contributions that
   haven't been measured yet. Is there a formal sense in which this sum needs
   regularization, and does ζ give it?

2. **What's the functional form?** If the soft potential is V(τ) where τ is the
   window between commits (plate separation), what's V? Candidates:
   - V(τ) = constant / τ⁴ (pure Casimir, 3+1 dimensional)
   - V(τ) = L² / τ (our finite-time excess — Schmiedl-Seifert)
   - V(τ) = -ζ(-1) / τ² (1+1 dimensional Casimir = 1/12 per unit length)
   - Something else from the tropical semiring structure?

3. **Does the accumulated potential DO anything?** In physics, Casimir energy creates
   a measurable force (attraction between the plates). In our system, does the
   accumulated soft-lane potential create "pressure" to commit? Is there a formal
   sense in which a large accumulation of uncommitted branches PULLS the system
   toward a measurement (a spontaneous commit)?

4. **Connection to the predictive scheduler:** The PredictiveLookahead TLA+ spec
   models the scheduler choosing when to commit. Does the Casimir analogy suggest
   an OPTIMAL plate separation (commit cadence) that minimizes total energy
   (Landauer floor + Casimir potential)? This would be the thermodynamically
   optimal scheduling interval.

## What Exists Already

- `entropy-tracker.ts`: tracks `entropy_state` (the soft-lane accumulation)
- `accountFerryCommit(batchBits, erasureWindow)`: computes `totalHeat = floor + L²/τ`
- `LandauerFloor.lean`: proves second law, Bennett, heat monotonicity
- `PredictiveLookahead.tla`: models the scheduling with bounded lookahead
- `physics-traits.ts`: FerryQueue = the data structure that accumulates then flushes
- The Z3 proofs: quadratic envelope, closed form via Lean

## Deliverable Expected

A design note at `docs/research/casimir-vacuum-energy-soft-lane.md` with:
- The formal mapping (or a rejection with reasons if the analogy doesn't hold)
- The functional form V(τ) with derivation
- Whether/how to implement it in the entropy tracker (a new field? a computed property?)
- Lean proof obligations if the mapping is formal enough to prove

## Priority

P2 — research/design. No code needed until the design note validates the mapping.
The system works without it; this is the "physically correct" refinement layer.

## No Physics Persona Yet

If this needs a dedicated physics persona (someone who knows QFT / Casimir / zeta
regularization deeply), consider routing to a summon with a system prompt that
specializes in mathematical physics. Soraya's formal-verification background
covers the Lean/proof side; the QFT intuition may need a peer.
