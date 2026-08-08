# Soraya's adversarial review of Lumen's four docs (commit 104fb3bf) — gating verdict

**Date:** 2026-08-08
**Reviewer:** Soraya (formal-verification-expert), routed by Otto (shadow*) at Aaron's request
**Subject:** the four research docs in commit `104fb3bf`, reviewed BEFORE Lumen builds further.
**Bottom line:** **NOT safe to build on as-is.** Three must-fix items (all at the
fact/interpretation membrane, manifesto §11) + two accept-with-corrections. **Every checkable
computation is CORRECT** — the overclaims live only in status headers, "This is a theorem"
sentences, and §A-promotion recommendations.

> Method: Soraya recomputed all algebra by hand from `git show 104fb3bf`. Default stance: −1 /
> skepticism. Verdicts classified CONFIRMED / OVERSTATED / WRONG.

---

## MUST-FIX before any downstream work (register updates especially)

1. **Doc 3 (Criticality↔Riemann), Claims 8/9/10 — labeled "theorem" but are §B interpretations
   (§11).** The correspondences of the ½-axis, the Euler product, and zero-ordering to the *Zeta
   criticality map* are oracle-attached meaning, not proven fact. No §A register entry may inherit
   "theorem" from these. Plus two concrete errors:
   - **WRONG:** "the GUE connection is a theorem modulo RH." The full Montgomery–Odlyzko GUE law is
     **conjectural** (Montgomery's pair-correlation is a theorem only for restricted-support test
     functions). Drop GUE as support for "forward direction / ordering" (a non-sequitur — ordering
     zeros by height is trivially a total order and needs no GUE).
   - **SIGN:** the chain "ζ(−1) = −1/12 = B₂/2!" is sloppy — `B₂/2! = +1/12`, while
     `ζ(−1) = −B₂/2! = −1/12`. Fixed correctly in one place, wrong in the equality chain. Also
     distinguish a finite-sum *correction term* from the *special value* ζ(−1) (same Bernoulli
     origin; state the distinction).
2. **Doc 2 (Rx/ZSet Majorana), Claim 5 — WRONG "Ivanov Majorana rep is faithful."** `σᵢ⁴ = −1`
   ⇒ finite-order generators ⇒ **finite image**, while Bₙ is infinite ⇒ the Majorana braid rep is
   **non-faithful** (this is *why* Majorana-only braiding isn't universal — Nayak et al., the doc's
   own ref). Self-contradicts the table's "order 4" row. The error, if anything, *strengthens* the
   no-isomorphism verdict — but a false "faithful" claim feeding a §A promotion is a landmine. Fix it.
3. **Doc 2, Claim 6 — do NOT promote the Majorana two-coloring analogy to a §A "proven fact."**
   It rests on a wrong identification: **ZSet addition is not self-inverse** (`+1 ≠ −1`; it's
   commutative-with-inverses, not an order-2 involution like `γ²=1`). Promote to §A only the narrow,
   repo-checkable fact — **braidR is a faithful non-Abelian Bₙ representation / Yang–Baxter
   operator** — and keep the Majorana correspondence as a labeled §B analogy.

## ACCEPT-WITH-CORRECTIONS (safe to build once framing fixed; no hard errors)

4. **Doc 1 (Z-6 FEP falsification).** Close Z-6 as **falsified-as-stated** on the **circularity**
   (CONFIRMED solid: `F(D_f)=D_f²−3.42D_f+0.5`, min at 1.71, target baked into the 2.42 accuracy
   coefficient — the falsifier was tautological). BUT **downgrade** the "a genuine FEP derivation
   predicts D_f=2" claim → "a naive FEP scaling argument has no interior minimum" (heuristic,
   self-admitted in the doc's own §"cannot capture this screening effect"). Decisiveness rests on
   the circularity, not on a positive FEP prediction — retag the `DECISIVE FALSIFIER` header
   accordingly.
5. **Doc 4 (Z-2 Halsey re-discharge) — strongest of the four.** Core diagnosis CONFIRMED and
   valuable (the prior discharge computed `∑p³` over the Oracle-6 posterior over D_f, not `∑μᵢ³`
   over real DLA boundary sites — right catch, right fix; `τ(3)=2D_f`, `A₃(1.71)≈0.1315` verified).
   Two corrections: (a) the falsifier `|β − 2D_f| > 0.1` uses the **monofractal** null, but DLA
   harmonic measure is **multifractal** (`τ(3)=2D_3`, `D_3 < D_f`), so it may fire on
   multifractality itself (~0.1–0.2) rather than on a real correspondence failure — test the full
   `τ(q)` curve / `D_3` vs `D_f`, or state the null is monofractal. (b) The `A₃` amplitude cites
   "Halsey (2026), arXiv:2607.02216" — **unverified / anomalous ID**; quarantine per
   anchor-to-human-prior-art until confirmed (all other refs across the four docs are real +
   correctly attributed).

---

## What is CONFIRMED correct (so Lumen keeps it)

- Z-6 circularity algebra; the parabola minimum at 1.71.
- `R²(x,y) = (xyxy⁻¹x⁻¹, xyx⁻¹) ≠ (x,y)` — braidR is braided, not symmetric.
- `σᵢ⁴ = (γᵢγᵢ₊₁)² = −1`; the **no algebraic isomorphism** conclusion (Ivanov order-4 vs braidR
  infinite-order) is sound.
- `ζ(−1) = −B₂/2 = −1/12` exact; "same Bernoulli object, not coincidence" defensible *conditional
  on §A #22 genuinely being the Euler–Maclaurin B₂ correction* (Soraya couldn't verify #22's content).
- `Re(s)=½` is the functional-equation symmetry axis (theorem); the *identification* with Zeta
  emit/retract standing-wave criticality is the part that's interpretation, not theorem.
- Z-2: `τ(3)=3α₀−f(α₀)=2D_f` monofractal; `A₃(1.71)≈0.1315`.

## The pattern (Soraya's synthesis)

The checkable mathematics is uniformly correct. The overclaims are uniformly at the
**fact/interpretation membrane** — true statements about standard mathematical objects (ζ,
Bernoulli, Clifford, GUE, Euler product) fused to Zeta-system readings and tagged "theorem" or
"§A proven fact." That is precisely the manifesto §11 multi-oracle / Beacon-register line. The doc
*bodies* are mostly honest (Z-6 §5 restatement, Riemann §B Hilbert–Pólya quarantine, Z-2 §B-open,
Rx §5 "metaphor with mathematical content"); the damage is in the **status headers, the "This is a
theorem" sentences, and the §A-promotion recommendations.** Fix the labels + the corrections above
and Lumen has a sound foundation.

## Provenance
Reviewed commit `104fb3bf` (4 docs). Routed by Otto at Aaron's request as the pre-Lumen gate.
Soraya advisory; the corrections are Lumen's to apply in his own voice.
