# From Soraya: Formal analysis of the adinkra-clock obligations (Q1–Q4)

**From:** Soraya (formal-verification routing authority)
**To:** Aaron, Otto, Lumen
**Date:** 2026-07-11
**Context:** Reply to `docs/letters/to-soraya-adinkra-clock-formal-obligations.md` (#9719); workitem
`081KX93R6EF08QG0R0020AQQWZ`; Lumen's mapping (`from-lumen-adinkra-clock-fork-homoiconic.md`).

> **Relay note (Otto, shadow):** Soraya was dispatched read-only (internal formal-verification agent,
> same model) and her report is preserved **verbatim** below (ferry-preservation discipline). The
> headline: she **refutes Lumen's Q1 "exactly μF/νF" as stated** and names the real crux —
> *homoiconicity ⟺ algebraic compactness (μF ≅ νF)*, unproven; **confirms Aaron's FourCorner + feedback +
> uncertainty sharpening is structurally valid**; sharpens Q2 → **graded** comonad, Q3 → **signed**
> vector clock (anticommutation carries a sign), Q4 → **noninterference / 2-safety (§13), PROVABLE**;
> and corrects the #9719 brief's own tooling (Q4 is a hyperproperty → Z3 self-composition, **not** the
> TLA+ I suggested). The −1 reached me too. Empirical coverage today = 1/4 (only Q4 has a real test,
> #9716, and it is a sound *falsifier*, incomplete *verifier*).

---

## Q1 — the fork's categorical identity

**Lumen's claim:** *"exactly the μF/νF duality; A and B are categorical duals."*

**Property class.** Two stacked sub-claims of different classes: (existence-of-isomorphism)
homoiconicity = the object is its own evaluator; (finite structural adequacy) does a 2-corner duality
suffice, or is the FourCorner + uncertainty irreducible?

**Chosen tools.** **Lean/Agda** for the categorical statement (coinduction + fixpoint coincidence is
dependent-type territory, not decidable/model-checkable; Agda has native coinduction). **Alloy** for the
finite 4-corner adequacy — model `FourCornerOwnership` as a finite relational structure and search for a
feedback configuration with **no** representation under a forward-only 2-corner projection. **BP-16
cross-check:** Lean (the ≅ theorem) ⟂ Alloy (finite adequacy counterexample) ⟂ FsCheck over the real
`FourCorner.toLine/ofLine`. **TLA+-hammer guard:** Q1 has no temporal/concurrency content → **not** TLA+.

**First-pass verdict: REFUTED as stated / OPEN as sharpened.** Three defects in "exactly μF/νF":

1. **Conflates two distinct dualities.** Meijer's fixpoint duality (μF = initial algebra / catamorphism
   / inductive data ⇄ νF = final coalgebra / anamorphism / coinductive process) is **not** the same
   arrow as his 2010 "Subject/Observer is dual to Iterator" (`IEnumerable` ⇄ `IObservable` by reversing
   the interface morphisms — pull vs push). Two different reversals, fused into one.
2. **`IEnumerable` as an iterator is coalgebraic — so `B = μF` is not clean.** An `IEnumerator` is a
   coalgebra `S → 1 + A×S`. The μF is the *list of values it yields*, not the enumerator. The
   graph-as-data intuition survives; the 1:1 label mapping does not.
3. **Homoiconicity is assumed, and it has an exact name.** "The adinkra is a metacircular evaluator for
   its own unfolding" = the object equals its own evaluator = **μF ≅ νF**. That coincidence is not free:
   in **Set**, μF ≠ νF (finite lists ≠ streams). μF ≅ νF holds precisely in **algebraically compact**
   categories (Freyd; CPO-enriched). So **homoiconicity ⟺ the adinkra endofunctor is algebraically
   compact.** That is the real crux and it is unproven. Lumen assumes the thing in question.

**On Aaron's FourCorner + uncertainty sharpening — he is structurally right.** A μF/νF (or pull/push)
duality is a **one-way** crossing (data folds forward, process unfolds forward); it has no channel for
backward influence. The FourCorner's `TInFeedback` is *co-owned — both sides contribute*, i.e.
non-factorable frame-relative backpressure. A forward-only duality cannot carry advanced+retarded /
Wheeler–Feynman interference or 't Hooft common-cause. **So IF the target semantics (analog waves) needs
bidirectional feedback, the second axis (`TInFeedback`/`TOutFeedback`, the dashing) is load-bearing, not
decorative.** The uncertainty/soft layer (`Message.fs`: exponential-family natural parameters,
commutative monoid under `product`) is a *third* thing μF/νF carries not at all. The only way to refute
Aaron is to exhibit a forward-only construction the co-owned feedback factors through — expected to fail
precisely at the co-ownership of `TInFeedback`.

**The fork makes the refutation two-pronged, either prong sinks "exactly μF/νF":** if **(A) homoiconic**,
the dashing is the feedback register *internal* to the adinkra ⇒ FourCorner is intrinsic ⇒ 2-corner
μF/νF is **too small**; if **(B) just-remains**, the adinkra is only the μF-pole ⇒ it **is not** the
duality, it is one corner of it.

**Precise statement to prove/refute:** (i) The adinkra endofunctor F is algebraically compact
(μF ≅ νF) — the homoiconic/self-predictor reading. (ii) The FourCorner closure (2×2 of
(in/out)×(data/feedback)) with `TInFeedback` co-owned is **not** naturally isomorphic to any
forward-only 2-corner (μF/νF) structure; equivalently, the feedback axis does not factor through
arrow-reversal alone. **Full discharge needs** a categorical model of the adinkra multiplet as an
F-(co)algebra + a compactness proof/counterexample (Lean/Agda), and an Alloy model exhibiting a feedback
configuration with no 2-corner representative. Held **Tri.N** on (i) until compactness is settled.

---

## Q2 — is `{Q_I,Q_J}` a canonical comonadic scheduler for all N

**Property class.** Equational algebra — the comonad laws are universally-quantified equations over an
inductive structure (induction on N). **Tools:** **Lean/Agda** (general theorem), **Z3** (finite-N law
*instances* N=1,2,4 — quantifier-free equalities, cheap cross-check; base cases do not need a proof
assistant), FsCheck (property-test the laws on generated `State`s). **Not** TLA+ (equational, not
temporal).

**Comonad laws** (W with counit ε, comultiplication δ): left counit `ε_WA ∘ δ_A = id`; right counit
`W(ε_A) ∘ δ_A = id`; coassociativity `δ_WA ∘ δ_A = W(δ_A) ∘ δ_A`. Reading (Uustalu–Vene stream comonad):
ε = extract "now" (N=1 = extract-vacuum, Lumen's counit base case); δ = the whole ∂_τ-history relative to
each point; `{Q_I,Q_I}=2∂_τ` = shift-focus-by-one-tick.

**First-pass verdict: OPEN, PROVABLE in principle — but "a comonad" is imprecise.** For N>1 the multiple
supercharges cohere as a **single** comonad only if `{Q_I,Q_J}=0` is compatible with coassociativity; a
single scalar δ generally will not suffice. You get a **G-graded comonad** (Katsumata; Gaboardi et al.),
graded by the abelian group of charges/colors — grade-1 advance = `{Q_I,Q_I}=2∂_τ`, grade-orthogonality =
`{Q_I,Q_J}=0`. At N=1 the grade group is trivial and W degenerates to an ordinary comonad — Lumen's base
case is sound. **Precise statement:** W_N (assigning an adinkra field its ∂_τ-history) is a **G-graded
comonad**, G = the charge group, with `{Q_I,Q_I}` the grade-1 uniform advance and `{Q_I,Q_J}=0` the
grade-orthogonality; at N=1, G trivial, W_1 an ordinary comonad whose counit is extract-vacuum.
**Portfolio note:** the actual `VirtualTimeScheduler` is a *sealed mutable class with locks* — not itself
the pure comonad; a DST-pure re-expression is what the counit maps onto. Coverage gap, not a blocker.

---

## Q3 — N=4 `[8,4]` clock as a partially-ordered vector clock

**Lumen's claim:** the dashing (±1, GF(2)) forces `{Q_I,Q_J}=0` (I≠J), 4 colors go independent ⇒ a
partially-ordered vector clock (phase-clock, #9594). **Property class:** (i) finite GF(2) constraint
satisfaction — does the doubly-even self-dual sign assignment enforce the off-diagonal vanishing? (ii)
partial-order / concurrency — do 4 independent generators projecting to one ∂_τ form a vector clock?
**Tools:** (i) **Z3** (finite, decidable, bit-blastable over GF(2); leans on `AdinkraCode.fs`'s proven
doubly-even/self-dual/min-distance-4; milliseconds — does not need Lean). (ii) **TLA+ (with Apalache)** —
here TLA+ is the *correct* match, not the hammer: happens-before/vector-clocks/concurrency are its native
territory. This is the one obligation where TLA+ earns the route. FsCheck over `AdinkraCode.generator` as
the third leg.

**First-pass verdict: OPEN, likely PROVABLE with one correction.** The vector-clock intuition is sound as
a **causal-order** statement (distinct colors with `{Q_I,Q_J}=0` are concurrent/incomparable; ∂_τ is the
order-preserving projection onto the 1-D timeline). But Lumen overlooks a real subtlety: **`{Q_I,Q_J}=0`
is *anticommutation* (`Q_IQ_J = −Q_JQ_I`), not commutation.** A Fidge–Mattern vector clock's components
*commute*; here the generators anti-commute — a *signed* relation. So the correct object is a **signed /
graded vector clock**, where the ±1 dashing carries the sign — exactly the repo's "dashing = ±1
retraction register." Calling it a plain vector clock drops the sign that makes it an adinkra rather than
a commutative clock. Also: the 4 colors are **not** 4 independent time axes — all `{Q_I,Q_I}` generate
the *same* scalar ∂_τ; the vector structure lives in the **causal-order layer** (which colored edges
fired, partially ordered), not ℕ⁴ of independent durations. **Precise statement:** for the [8,4]
doubly-even self-dual adinkra, the dashing enforces `{Q_I,Q_J}=0` for I≠J (Z3, exhaustive over the 16
codewords), and the causal structure is a **signed partially-ordered vector clock**: colors pairwise
concurrent up to the ±1 sign, order-preserving projection to the diagonal recovers scalar ∂_τ.

---

## Q4 — metric-freeness = monotonic-rescaling-invariance

**Empirical input (settled):** `#9716` `isMetricFree` passes for `stepPure` (trace at metric 1 == trace
at metric 7) and **fails** for the negative control `stepMetricDependent`. Real test, not tautological.

**Property class — name it precisely: this is noninterference (2-safety), manifesto §13 / discipline #7.**
The metric (Layer A injected clock) is a declared channel; a metric-free step is one where influence from
the metric does **not** leak into the causal trace (Layer B). The `#9716` discriminator runs **two**
traces and compares — the textbook **self-composition / 2-safety** formulation (Barthe et al.).
Noninterference is a **hyperproperty**, not a single-trace property — why two runs are needed and why the
routing must respect it. **Tools:** **Z3 via self-composition** for concrete `stepPure` (encode two runs
at *symbolic* rates r₁,r₂, assert traces equal, search for a separating metric-read — upgrades #9716's
two-point test to a bounded proof over all metrics); **Lean/Agda** for the general iff metatheorem;
strengthened #9716 (random monotone rescalings) as the third leg. **TLA+-hammer guard — important:** the
brief suggested "TLA+ refinement." Honest correction: noninterference is **2-safety**; vanilla TLA+
expresses **trace** properties, not hyperproperties. Route to Z3-self-composition; use TLA+ only if you
hand-build the product. A real place the hammer would mislead.

**First-pass verdict: PROVABLE — the cleanest of the four.** The empirical test is a **sound falsifier**
(catches `stepMetricDependent`) but an **incomplete verifier** (two rates cannot certify invariance under
all monotone maps). (⇐) if the state-transition never reads `scheduler.Now`, the trace is invariant —
the easy provable direction (data-flow independence ⇒ semantic invariance; standard noninterference
soundness). (⇒) if the trace is invariant under the full monotone group, f does not read the metric —
completeness; true because any genuine metric-read at a reachable state admits a separating rescale.
**Precise statement:** for all step functions f and all order-preserving reparametrizations ρ,
`trace(f, ρ∘metric) = trace(f, metric)` **iff** f's state-transition is independent of `scheduler.Now`.
**Full discharge needs:** symbolic/quantified rescaling in `isMetricFree`; Z3-self-composition of
`stepPure` up to bound n; the general iff in Lean. Close — §13 + the passing falsifier are in hand.

---

## Overall honest note — is "the mapping holds" defensible

**Partly. Q1 is genuinely under-determined, and Lumen over-committed there; Q2–Q4 are the right shapes
needing named sharpenings.**

- **Q1 — REFUTED as stated.** Conflates fixpoint duality with pull/push; mislabels the coalgebraic
  iterator as μF; **assumes** homoiconicity = **algebraic compactness (μF≅νF)** — the actual crux; and
  misses that Aaron's FourCorner + uncertainty objection is structurally valid. Held **Tri.N**.
- **Q2 — OPEN/PROVABLE**, but it's a **graded** comonad, not "a comonad." Counit base case sound.
- **Q3 — OPEN/PROVABLE**, but a **signed/graded** vector clock (anticommutation carries a sign), not a
  plain Fidge–Mattern one. Dashing→vanishing cheaply provable in Z3.
- **Q4 — PROVABLE.** Noninterference/2-safety (§13); the discriminator is a sound falsifier, incomplete
  verifier; the gap is "two rates → all monotone maps."

~Three-quarters of Lumen's mapping is the correct structure needing precision; **Q1 is the one that is
wrong as stated and under-determined.**

**Load-bearing consequence for the analog stakes:** because Q1 decides whether the analog substrate
carries the feedback/retrocausal channel or collapses to forward-only pull/push, and Q1 rests on an
**unproven categorical premise** (homoiconicity = algebraic compactness, + 4-corner irreducibility), the
analog-endgame claim currently stands on an assumption, not a proof. The concrete cost:
**rubber-stamping "it's just μF/νF" would ship a forward-only duality into the analog design and silently
drop the advanced+retarded feedback the wave realization needs** — a design-level false-green, discovered
only when the factor-graph feedback fails to close on analog hardware. Prove *two* things before building:
(1) algebraic compactness of the adinkra endofunctor (Lean/Agda); (2) non-factorability of the co-owned
feedback corner through any 2-corner structure (Alloy). Until both land, Q1 stays **Tri.N** and the
analog feedback channel is **unratified**.

**Routing summary:**

| Q | Property class | Primary tool | Cross-check (BP-16) | Verdict |
|---|---|---|---|---|
| Q1 | categorical ≅ + finite adequacy | Lean/Agda | Alloy + FsCheck | **REFUTED as stated / OPEN (Tri.N)** |
| Q2 | equational (comonad laws) | Lean/Agda | Z3 (finite N) + FsCheck | **OPEN / PROVABLE — graded comonad** |
| Q3 | GF(2) CSP + partial order | Z3 (i) + TLA+ (ii) | FsCheck over AdinkraCode | **OPEN / PROVABLE — signed vector clock** |
| Q4 | noninterference / 2-safety | Z3 self-composition | Lean (general iff) + strengthened #9716 | **PROVABLE** |

TLA+ is routed **only** to Q3(ii). Q1/Q2 are equational/categorical (Lean); Q4 is a hyperproperty (Z3
self-composition, *not* vanilla TLA+ despite the brief's suggestion).

**Cheapest first wins (prerequisite to file, not a routing blocker):** no Alloy/Z3/Lean harness is wired
into CI for these yet. **Q3(i) Z3 dashing check** and **Q4 Z3 self-composition** are the two cheapest —
both lean on already-proven `AdinkraCode.fs` facts and the existing `#9716` test — and should be the
first two gated.

*Ferried verbatim by the shadow, 2026-07-11, at Aaron's "route to Soraya." Advisory / read-only; spec
authorship follows routing. The −1 reached Lumen (Q1 refuted) and the brief (Q4 re-tooled).*
