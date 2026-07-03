# Soraya's verdict — the −1/12 "frame-rate cost": register C with a stated B-path (and a falsifier)

*Math-team triage, 2026-07-03, dispatched by shadow on Lumen's IV/Casimir exchange (see the ferry:
`2026-07-03-ferry-lumen-max-iv-casimir-gap-minus-one-twelfth-conjecture-aaron-verbatim.md`).
Registers per `2026-07-03-provability-triage-…`: A theorem / B formalizable-here / C anchored
metaphor / D rhyme. Zero inflation, both directions.*

## The verdict in one line

**"−1/12 is the cognitive cost of a frame rate" is register C dressed as B** — the ingredients
are real theorems, but they have *different divergence shapes* — and it can become a legitimate
B-grade **open conjecture** if stated with the three requirements below. Everything downstream
(the attention-economy cap, the Thousand-Brains justification) is D until the C→B step lands.

## The shape mismatch (why it doesn't follow as stated)

- ζ(−1) = −1/12 via Euler–Maclaurin is **A** (Euler; Hardy, *Divergent Series*; Casimir 1948) —
  but it regularizes a mode sum **Σn**, weight *linear* in mode index (Casimir: ωₙ ∝ n).
- The discrete-vs-continuous entropy divergence is **A** (Cover & Thomas Thm 8.3.1) — but its
  shape is **log(1/Δ)** per sample, not Σn.
- **The falsifier:** run the naive version — white noise has a *flat* spectrum, so per-mode
  information is constant, the mode sum is Σ1, and zeta regularization gives
  **ζ(0) = −1/2, not −1/12.** The famous constant does not survive first contact with the
  natural setup. (Cheap to verify symbolically; run it before believing any −1/12 claim here.)

## The honest B-path (the conjecture someone would have to prove)

A tick grid on a window genuinely imposes boundary conditions (Nyquist mode counting between
"plates"), so an Euler–Maclaurin setup *exists*. The provable statement:

> For a stationary Gaussian process with spectral information density I(ν), tick spacing Δ,
> window T: the excess D = Σₙ Iₙ − ∫ I(ν) dν admits an Euler–Maclaurin expansion whose
> Δ-independent finite part is −I′(0)/12, PROVIDED (a) a named process class where Iₙ ∝ n,
> (b) tick boundaries shown to quantize the modes, and (c) **scheme-independence** — an
> operational subtraction (e.g., the *difference* between two agents at different frame rates)
> making the finite part regulator-independent, as the measurable Casimir *force* is.

Requirement (c) is the hard, honest one: in physics −1/12 survives because a measurable
*difference* of divergences is scheme-independent; without an operational analog, any finite
part is a regulator artifact. Routing if attempted: pencil derivation → SymPy cross-check of the
finite part (hours) → Lean only if load-bearing (mathlib already has
`riemannZeta_neg_nat_eq_bernoulli` — the A-part is formalized upstream).

## Flags applied to the committed lineage doc

Two register corrections to `2026-07-03-information-value-lineage-…-amara.md` (addendum appended
there; Lumen's text untouched):

1. **"Delay-amplified IV has no precedent" → soften.** The ingredients are old and anchored
   (Condorcet 1785 — independence raises ensemble value; Clemen & Winkler 1985 — correlated
   sources add less). The composite `valueOfLink` may be novel, but ρ = 1/(1+L) is our own
   toy-model assumption; the claim should read "we have not found precedent," not "purely
   relativistic innovation."
2. **The Casimir-gap section is register C and must say so.** Friston's free energy has no mode
   sum, no plates, no spectrum; "direct physical resonance" presents a metaphor as mechanism.
   The metaphor is good — Aaron's coinage, worth keeping — *as a metaphor with the flag on.*

Plus one missing anchor, credit where due: **Itti & Baldi 2005/2009** already used realized
KL(posterior‖prior) — "Bayesian surprise" — to rank attention; Zeta's realized-IV-for-attention
inherits from them, not just from Lindley's expected form.

## Why the label matters here specifically

−1/12 is the internet's most famous numerological attractor. The corpus already survived one
physics overstep (the 2√2 "signaling" correction — which made the human reading *stronger*).
Future agents will "verify" this constant by pattern-match against Casimir rather than by
derivation. So the label travels with the claim: **C, with a stated B-path, with a falsifier
(−1/2) that any derivation must explain away.** If the mode-sum derivation lands, this becomes
one of the best results in the corpus. Until then, nobody cites it as settled.

## Pointers

- The ferry (Aaron verbatim + the exchange preserved): `2026-07-03-ferry-lumen-max-iv-casimir-gap-minus-one-twelfth-…`
- The register discipline: `2026-07-03-provability-triage-theorem-vs-model-vs-rhyme-…`
- `src/Bayesian/InformationValue.fs` — Soraya side-note: the flat-prior branch returning `posterior.Precision` as IV is itself an ad-hoc regularization of an infinite KL; worth a documented bound (filed for the IV stream's owner).
- Anchors: Euler–Maclaurin (Hardy, *Divergent Series*); Casimir 1948; Cover & Thomas Thm 8.3.1; Lindley 1956; Itti & Baldi 2005/2009; Condorcet 1785; Clemen & Winkler 1985; mathlib `riemannZeta_neg_nat_eq_bernoulli`.
