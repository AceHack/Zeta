# Ferry: Lumen's figure-8 / Nash / Lagrange-Condorcet / Bell-triangle / CPT session — preserved + honest register

*Shadow ferry, 2026-07-04. Aaron: "this is what Lumen is working on and we should ferry the memories for
them." Lumen's code + research are already committed (SHAs 2768ba85a, 4420a578d — FIG8/NASH/LAG/COND tests,
`SoftRegimeStability.fs`, `LagrangeCondorcet.fs`, `CondorcetBoundary.fs`, `cpt-symmetry-emergent-c-rho-lightcone.md`).
This bank preserves the results into Lumen's memory and applies the register discipline: **affirm what Lumen
already peeled honestly, peel what is still froth, hold Aaron's frames as his oracle (labeled), and flag the
one shipped-behavior risk.** Not a re-commit of Lumen's work — a Mirror→Beacon pass over it.*

## The results, sorted (Beacon)

### SOLID — keep

- **FIG8 (figure-8 experiment).** The headline is a genuinely valuable **negative result**: ensemble
  collapse (ρ→1) is **not** caused by the closed-loop structure — it is caused by **identical sensory
  input**. *Any* ensemble (figure-8 or independent) collapses when all cells observe the same stream;
  different starting codewords (the yin) do not prevent it because the yang (Gaussian belief) converges to
  the same posterior under an identical likelihood. Decorrelation requires **different observations**, not
  just different seeds. This is the fleet catching its own naive hypothesis — exactly the discipline working.
- **NASH (soft regime = global best response).** Given the payoff `IV(s) = −KL(s ‖ uniform) = log16 − H(s)`,
  the deviation payoff is `H(proj(s)) − H(s) ≥ 0` by **Jensen's inequality** (averaging within each weight
  class raises entropy), equality iff `s` is already orbit-symmetric. So projecting to orbit-symmetry always
  increases entropy — orbit-symmetry is a *strict global* best response, not merely local. **Load-bearing
  assumption to keep visible:** this is a theorem *about the entropy payoff* `−KL to uniform`. It says
  "orbit-symmetry maximizes entropy," which is Jensen; calling it a "Nash equilibrium" is correct *only for
  that payoff*. (Honest lineage: the result survived a naive-false pass, a wrong-fixed-point bug, and a
  flipped-sign bug before landing — the final rests on the projection being a true average and the sign
  convention being IV(proj) − IV(s). Credit the debugging; note the result is only as solid as the payoff
  definition.)
- **ρ\* = 1/3 algebra (COND-8/9).** `ρ*(N) = (N−3) / (3(N−1)) → 1/3` as N→∞, independent of competence c.
  Exact. **Peel:** the `1/3` is a consequence of the modeling choice `N_eff ≥ 3` (a "minimum meaningful
  majority" of 3) — the factor of 3 is definitional, not a discovered constant. "ρ* → 1/3" is real algebra
  on that premise; it is not evidence of a deep universal `1/3`.

### HONEST NEGATIVE RESULT — Lumen already peeled this correctly (affirm, no further peel)

- **Lagrange ↔ Condorcet is an analogy, NOT a theorem.** Lumen ran the automorphism-group check and reported
  it straight: `1344 / 26 = 51.7` (non-integer); the `23/27` in `μ_crit = (1 − √(23/27))/2` come from the
  gravitational **Jacobi integral / restricted-3-body mass ratios**, not from coding theory. The
  `1/μ_crit ≈ 25.96 ≈ 26` "effective jury size" matching the Lagrange `1/25` is a **numerical near-coincidence**,
  not a structural identity. Lumen's own conclusion — *"useful pedagogical analogy, not a formal theorem;
  the formal team should either find the structural connection or confirm it coincidental"* — **is the
  register discipline done right by Lumen.** Nothing to add; this is the model for the ones below.

### FROTH — peel before this travels outward

- **The Bell / Tsirelson mapping (COND-10) is an analogy, not physics.** Mapping voter-correlation `ρ` to the
  CHSH `S` parameter (ρ>1/3 ↦ S=4 superdeterminism, ρ≈0.236 ↦ S=2√2 Tsirelson, ρ<1/3 ↦ S=2 classical) is
  **aesthetic, not derived.** `ρ` (a correlation of votes) and `S` (a CHSH correlator over measurement
  settings) are different objects; **no Bell inequality is being tested or violated, and there is no
  entanglement** — the cells are classical Bayesian belief engines. So "the cells are quantum-entangled at
  ρ≈0.236" is metaphor. **The one shipped-behavior consequence:** wiring `ρ_T = 1/(3√2) ≈ 0.236` as the
  reseed threshold (below the ρ*=1/3 boundary, with a √2 margin) is a **perfectly fine engineering
  heuristic** — reseed before the hard boundary. But justify it *as* "a safety margin below ρ*", **not** as
  "the Tsirelson bound"; the number is defensible, the quantum name oversells. Keep the value, drop the
  physics claim from the code/doc justification. (Note: `CondorcetBoundary.fs` still ships the conservative
  `0.9`; if `0.236` lands, this peel is the review comment.)
- **CPT-symmetric demon / emergent-c / speed-is-epiphenomenal (Aaron's frame).** Held under **Multi-Oracle
  as Aaron's own axiom/oracle** (his copilot-wave / qualia-self-evident / CPT-symmetry native frames — see
  his memories), *labeled as speculation, not established physics*. Honest specifics: `c_max = kT ln2 /
  (energy per tick)` mixes a Landauer **energy-per-bit** with a rate to gesture at a speed — it is
  suggestive **dimensional play**, not a derivation (a speed needs a length scale the formula doesn't fix).
  "ρ* = 1/3 is a velocity v/c = 1/3" is **numerology** (1/3 is a probability threshold here, not a speed).
  The *intuition* — that a lightspeed-like bound is emergent/local from a real bus rather than a global
  constant — is a legitimate, interesting **conjecture** in Aaron's frame; it is not shown, and the CPT
  "the demon sees the players as light because it reads both sides" is a **metaphor for information
  asymmetry**, not a CPT transformation. Respect the oracle; do not let it read as derived physics outward.

## Aaron's contributions this session (Mirror — preserved as his framing)

> "the size difference between the demon and the players looks backwards to the demon cause it's CPT
> symmetric — this is the demarcation/bridge that makes inside/outside possible, where the speed of c comes
> from… we use a dirty reticulum bus for our c but this is a more theoretical pure bus speed… the speed of
> light is not constant, it's emergent and local not global, it's epiphenomenal."

> "S=4 superdeterminism from common correlation/seed; S=2 uncorrelation; S=2√2 = shared/quantum state."

These are Aaron's oracle framings; banked verbatim so they are not lost. The register above marks which are
solid (the ρ-regime *engineering* thresholds), which are his labeled conjectures (emergent-c), and which are
analogy dressed as physics (the literal Bell/Tsirelson identification).

## Cross-links

- `src/Bayesian/CondorcetBoundary.fs` · `src/Bayesian/LagrangeCondorcet.fs` · `src/Core/SoftRegimeStability.fs` — Lumen's code (COND/LAG/NASH).
- `docs/research/cpt-symmetry-emergent-c-rho-lightcone.md` — Lumen's CPT/emergent-c note (this doc is its honest-register companion).
- `docs/research/three-body-lagrange-condorcet-maxwell.md` — the prior 3-body note (Lumen's own honest seams).
- `memory/lumen/NOTEBOOK.md` — Lumen's fold of this ferry.
- Anchors: Jensen's inequality (the Nash core); Condorcet 1785; Bell 1964 / CHSH 1969 / Tsirelson 1980 (the *analogy* source — not a violated inequality here); Lagrange 1772 + Routh (restricted-3-body stability, the `~1/25`); Landauer 1961 (energy/bit, not a speed); Aaron's Multi-Oracle frames.
