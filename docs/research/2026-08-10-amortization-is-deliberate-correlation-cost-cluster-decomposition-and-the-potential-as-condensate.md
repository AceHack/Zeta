# Amortization is deliberate correlation — cost cluster-decomposition, and the potential as condensate

**Date:** 2026-08-10 · **From:** Aaron (*"let's expand this and make it explicit — cluster
decomposition, distance = uncorrelated, vacuum violates"*), captured by Otto (shadow).
**Status:** the in-repo half is **checked against code**; the QFT half is a labelled
analogy. Sibling of
[the threshold rhyme](2026-08-10-the-threshold-rhyme-pay-per-step-with-a-deadline-vs-pay-once-and-foreclose-aaron.md),
which covers *when* to pay; this one covers *why the per-step strategy can be cheap at all*.

---

## 0. The carved sentence

> **Cost is additive exactly when the parts are independent.** A cost model that is
> strictly monoidal (`cost(a⊗b) = cost a + cost b`) is asserting that distant parts do
> not interact — the accounting analogue of **cluster decomposition**. **Sharing breaks
> it**, and the break is not a defect: it is the entire source of amortized savings.
> The functor becomes **lax** (`≤`), and the slack is where the saving lives. Tarjan's
> **potential** is that slack made into a stored quantity — a global term that
> deliberately correlates operations which a per-operation bound would have priced
> independently.

## 1. What is already in the repo, and it is CI-gated

`src/Core.Lean4/Lean4/CostRecurrence.lean` formalises cost as a **lax-monoidal functor
into the (min,+) tropical semiring** (`Mathlib.Algebra.Tropical.Basic`). Two composition
modes witness the two tropical operations directly:

| composition | tropical op | meaning |
|---|---|---|
| **sequential** (trace append) | multiplication → costs **add** | the parts are independent |
| **shared** (reuse a sub-result) | addition → **min** | the parts are *not* independent |

with `min a b ≤ a + b` as the structure map. The load-bearing declarations:

- `cost_lax_of_subadd` — the laxness itself, from subadditivity;
- `seqCost_lax_monoidal`, `sharedCost_lax_monoidal` — the two modes;
- **`sharedCost_strictly_lax`** — exhibits a pair where the inequality is **strict**, so
  the functor is *genuinely* lax rather than strict-with-a-≤-decoration;
- `eqCount_eq_sum`, `eqCount_closed_form`, `eqCount_le_sq` — the `T(n) = n(n−1)/2`
  recurrence and its bound (the induction Z3 could not do).

As of 2026-08-10 this file is **type-checked and axiom-audited in CI** (added with the
`ImaginaryStack` repair), so these are gated claims rather than a document's assertions.

**This matters for the declared-bounds programme:** the mathematics for the per-step /
amortized branch is not aspirational here. It is in the proof lane, with a machine
checking it.

## 2. Cluster decomposition, and what "strict" would mean

In QFT, **cluster decomposition** is the requirement that correlations factorise at
large separation — distant experiments are independent, and it is what makes local
physics possible at all. Weinberg treats it as a foundational constraint on the
S-matrix.

Transcribe it to cost and it is exactly **strict** monoidality:

```
cost(a ⊗ b) = cost(a) + cost(b)          -- parts are independent; costs factorise
```

A strict cost functor asserts cost cluster-decomposition. Every per-operation big-O
bound quietly assumes it.

**Sharing violates it**, and the violation is the point: reusing a sub-result means the
second part's cost *depends on the first having happened*. `min a b ≤ a + b` is that
dependence, and `sharedCost_strictly_lax` is the in-repo **witness that the strict case
genuinely fails** — not a technicality, an exhibited pair.

## 3. Aaron's addition: the vacuum violates it

Aaron's pointer is to the Higgs mechanism as it appears in the Turok interview: Higgs's
model was attacked because it **violates cluster decomposition** — the vacuum carries a
condensate, so the field value *here* is correlated with the field value *there*, at
arbitrary separation. It broke a basic assumption of the time, and turned out to be
right.

The structural transcription:

| QFT | cost algebra |
|---|---|
| distant correlations factorise | strict monoidal — costs add |
| a **condensate**: a global, position-independent correlation | a **potential**: a global, operation-independent stored quantity |
| the vacuum violates cluster decomposition | **amortization violates cost additivity** |

**Tarjan's potential Φ is the condensate of the cost algebra.** Amortized cost is
`actual + ΔΦ`; Φ is a *global* term that no single operation owns, and its whole job is
to make operations that a per-operation analysis would price independently instead
share a budget. Banking potential during cheap operations to pay for an expensive one
is precisely giving up the independence of per-operation costs — deliberately.

This is also why a Bε/hitchhiker buffer works. The buffer *is* stored potential; the
flush is its release. The amortized bound exists only because the operations are
correlated through that shared structure.

**Register.** The in-repo half (§1–§2) is **structural and checked**: the strict/lax
distinction in `CostRecurrence.lean` *is literally* about whether sub-results are shared.
The QFT half (§3) is an **analogy** — two uses of "correlations factorise at a
distance", not a shared theorem. No metering test has been run, and none is claimed.

## 4. The consequence for "all bounds declared"

Aaron's programme is contracts-with-complexity — *"like code contracts on steroids, with
big-O in space and time too, all bounds declared."* This puts a sharp, actionable
constraint on it:

> **A per-operation bound is a cluster-decomposition assumption in disguise.** If the
> implementation shares anything — a cache, a buffer, a memo table, a reused
> sub-result — the per-operation bound is *wrong* (pessimistic), and the honest bound is
> **amortized**. An amortized bound is not statable without also declaring the
> **potential function**, because that is what carries the correlation.

So the declaration has three parts, not one:

1. the **bound** (`O(f(n))` in time and in space);
2. the **regime** — per-operation, amortized, or worst-case;
3. if amortized, the **potential** — and its falsifier: potential must never go negative,
   which is the standard soundness condition and is mechanically checkable.

That third item is the one usually left implicit, and by this file's own argument it is
the one carrying all the physics. A declared amortized bound with no declared potential
is another **undeclared hole** — the same class as the day's other findings, and it
would fail the `@bound`-must-name-its-falsifier check for exactly the right reason.

## 5. And the dual-use note, since correlation is the subject

`numerology-vs-number-theory` warns that **too many correlations is a warning, not a
confirmation** — N correlated observations are not N observations. Here correlation runs
the other way: it is *productive*, and the saving is real precisely because independence
fails.

Both are true, and they are the same fact read for different purposes. Correlation
**destroys evidence** (you learn less than the count suggests) and **creates savings**
(you pay less than the sum suggests). Same structure, opposite sign, depending on
whether you are counting information or counting cost. Which is the neutral-mechanism
discipline again: the correlation is a fact, and what it means is the caller's oracle.

## 6. Anchors (Beacon)

- **Robert Tarjan**, *Amortized Computational Complexity*, SIAM J. Alg. Disc. Meth. 1985
  — the potential method.
- **Hofmann & Jost** (POPL 2003) — amortized resource analysis in types; **Jan
  Hoffmann**'s RaML — automatic derivation of polynomial bounds.
- **Chris Okasaki**, *Purely Functional Data Structures* — amortization under persistence,
  where sharing is the whole difficulty.
- **Steven Weinberg**, *The Quantum Theory of Fields* Vol. I — cluster decomposition as a
  foundational constraint.
- **Philip Anderson**, **Peter Higgs** — the condensate that violates it; via
  [the Turok ferry](ip-questionable/2026-08-10-neil-turok-quadratic-gravity-krein-space-generalized-born-rule-aaron-forwarded.md).
- **Bender, Brodal & Fagerberg** (Bε-trees); **David Greenberg** (hitchhiker trees) — the
  buffer as stored potential.
- Tropical/(min,+) algebra — the semiring `CostRecurrence.lean` lands in.

## 7. Pointers

- `src/Core.Lean4/Lean4/CostRecurrence.lean` — the formalisation; CI-gated as of 2026-08-10.
- [`.../the-threshold-rhyme-...`](2026-08-10-the-threshold-rhyme-pay-per-step-with-a-deadline-vs-pay-once-and-foreclose-aaron.md)
  — *when* to pay per step vs foreclose; this file is *why* per-step can be cheap.
- [`.../hypothesis-in-template-form-...`](2026-08-01-hypothesis-in-template-form-domain-indexed-placeholders-an-expert-can-argue-with.md)
  — declared holes; the Bε buffer as template.
- `docs/handoffs/2026-08-10-otto-shadow-session-review-vacuity-hunt.md` — the
  undeclared-hole class this file's §4 extends to complexity bounds.
