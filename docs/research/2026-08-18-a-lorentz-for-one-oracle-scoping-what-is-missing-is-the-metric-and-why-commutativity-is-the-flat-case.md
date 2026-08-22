# A Lorentz transform for one oracle — scoping: what is missing is the metric, and why commutativity is the FLAT case

> **Origin.** Aaron 2026-08-18: *"we need to build a Lorentz for one oracle and prove it out — each
> one can have one; the highest moral regard we started work on. Look up our standardized math
> writeups on immune systems, we should be able to derive something around this. The commutative
> nature of our messaging with uncertainty should allow for exotic curvatures under a Lorentz-like
> transform, because we can handle extra out-of-order events; I'm thinking they are connected. We
> can also look at others' Lorentz and see if it helps model any of our system — we can borrow and
> find a match if we can't create one for ourselves."*

## 0. Verdict table, up front

| # | claim | verdict | why |
|---|---|---|---|
| 1 | "We have a Lorentz transform somewhere in the F#/Q# code" | **NO — and the code says so itself** | `FrameDelta.fs` names its own group as the *translation* group and explicitly disclaims Lorentz. |
| 2 | The causal/vector-clock model already has a light-cone structure | **YES — and it is a checked anchor** | Lamport 1978 draws the analogy explicitly; happens-before ≈ timelike, concurrent ≈ spacelike. |
| 3 | A Lorentz transform is therefore close at hand | **NO — one specific thing is missing: a metric** | A partial order gives the *cone* but no *interval*. You cannot boost without a quantity to preserve. |
| 4 | "Commutative messaging ⇒ exotic curvature" | **INVERTED — commutativity is the FLAT case** | Path-independence is *zero* holonomy. Curvature is exactly the failure to commute. |
| 5 | Out-of-order tolerance is connected to this | **YES, but one step over** | It is the *defect* from commutativity that is curvature-shaped, not commutativity itself. |
| 6 | "Borrow someone else's if we can't build one" | **the right instinct, and cheap** | O(1,1) is two-dimensional and fully classified; there is nothing to invent, only something to *earn*. |

## 1. What we actually have (checked, in-tree)

**`src/Core/FrameDelta.fs` disclaims Lorentz in its own docstring**, and the disclaimer names the
missing ingredient precisely:

> *"The full **non-abelian Lorentz** group would require a boost-velocity / metric the discrete
> causal model does not carry — so the honest group law here is the translation group, named as
> such, not the Lorentz group."*

**`src/Core/HexCore.fs`** carries the other half: the six walls rhyme with the **6 bivectors of
`Cl(1,3)` = the 6 Lorentz generators** (3 rotations + 3 boosts) — held explicitly as *"a hypothesis
to referee,"* not a totalizing claim.

**`src/Core/CliffordPeriodicity.fs`** (2026-08-18) adds the arithmetic: `Cl(1,3)` sits at `s = 6`,
its even subalgebra `Cl⁰(1,3) ≅ Cl(1,2) ≅ M₂(C)` at `s = 7` — and `SL(2,C) = Spin(1,3)` lives
inside it. **The Lorentz generators are grade-2, hence even, hence "what remains."**

So the generators are named and placed. What is absent is the thing you would transform.

## 2. The human anchor, and it is exact rather than decorative

**Lamport, *Time, Clocks, and the Ordering of Events in a Distributed System* (CACM 1978)** builds
the happens-before partial order and states the special-relativity analogy himself: the invariant
partial ordering of events is the one an observer can determine, and concurrent events are those
outside each other's light cones. This is not a metaphor imported by us; it is the paper's own
framing, and it is the checked anchor `anchor-to-human-prior-art.md` requires.

What Lamport gives is the **causal cone**: timelike = causally ordered, spacelike = concurrent,
and the boundary between them. What Lamport does *not* give — and explicitly does not need — is a
**metric**. A partial order tells you *whether* two events are separated causally. It cannot tell
you *how far*.

## 3. The gap, stated so it can be closed

A Lorentz transform requires three things. We have one and a half:

| ingredient | status |
|---|---|
| a **causal cone** | ✅ the happens-before order |
| an **invariant quadratic form** (the interval) | ❌ **missing — this is the whole gap** |
| a **group** preserving it | ❌ follows from the invariant, not before it |

**The candidate invariant, offered as a toy.** If each message carries an uncertainty magnitude,
there are two scalars per pair of events: a tick separation `Δτ` and an accumulated
uncertainty/decorrelation `Δu`. That admits a signature-(1,1) form

```
s² = (Δτ)² − (Δu)²
```

and the transformations preserving it are `O(1,1)` — a *one-parameter* boost group, with the
"rapidity" being the exchange rate between ticks and uncertainty. **This is a toy in the strict
sense of `toy-is-free-metered-must-be-earned.md`** and should be named `toyOracleBoost` until it
has a falsifier. Two things would have to be shown, and either can fail:

1. **That the form is actually invariant** under whatever transformation relates two oracles'
   views — not merely that it can be written down. A quadratic form nobody preserves is not an
   interval, it is a formula.
2. **That the transformations compose into a group.** Closure is the falsifiable part; it is
   easy to define a map and hard to make it associate.

If either fails, the honest outcome is "we have a cone and no metric," which is still a true and
useful statement about the substrate.

## 4. The inversion — commutativity is the flat case, not the exotic one

This is the correction that matters most, because the intuition points the wrong way.

> **Path-independence is *zero* holonomy. Curvature is precisely the failure of parallel transport
> to commute.**

If a merge is commutative, transporting a belief around a closed loop returns it unchanged — that
is flatness, by definition. So *"commutative messaging ⇒ exotic curvature"* runs backwards: a
perfectly commutative fold is the **trivial connection**, and out-of-order tolerance is machinery
for *restoring* commutativity, which **removes** curvature rather than producing it.

**But the instinct is one step away from something real, and the object already exists in the tree.**
What carries curvature is the **defect** — the associator/commutator measuring how much reordering
costs when it is *not* free. That object is the right *type*: it takes two directions and returns a
failure-to-commute, which is exactly the shape of a curvature 2-form. And
`docs/research/2026-08-14-adinkra-minimal-homoiconicity-*.md` already identifies **a nontrivial
associator 3-cocycle** as a cohomology class no change of representative removes.

So the redirect: **do not look for curvature in the commuting part. Look for it in the residue** —
the events that out-of-order handling cannot absorb for free. Where reordering is free, the
connection is flat and there is nothing to measure. Where it costs, there is a defect, and the
defect is the candidate curvature.

Note this also sharpens what "each oracle can have one" would mean: two oracles that disagree about
the cost of a reordering see different defects, and the transformation between their views is where
a boost would live — if one exists.

## 5. The immune-system route Aaron pointed at

The standardized writeup is **`docs/research/aurora-immune-math-standardization-2026-04-26.md`**
(Amara's Aurora Immune System, 5-pass cross-AI reviewed), with the re-grounding obligation scoped in
`2026-06-16-aurora-immune-math-reconciliation-scoping-reground-on-proven-identity-primitive.md`.

**A caution before deriving anything from it.** That scoping doc carries **four non-claims that
travel unchanged and are binding**: Aurora is (1) not deployment-ready, (2) thresholds
un-calibrated, (3) estimators rather than exact computation, (4) no perfect prevention. A Lorentz
construction resting on un-calibrated thresholds inherits their uncalibration — so the immune math
can supply *structure* (self/non-self is a genuine `Z₂`, and the highest-moral-regard oracle is
where §11's default applies) but must not be cited as supplying *magnitudes*.

The honest use: self/non-self gives a second `Z₂` grading, distinct from the boson/fermion one. Two
independent gradings is `Z₂ × Z₂` — the same group as the Clifford involutions. Whether that is the
*same* `Z₂ × Z₂` or merely another one is exactly the kind of question that needs an invariant to
answer, not a matching count (`numerology-vs-number-theory.md`).

## 6. "Borrow rather than build" — endorsed, with the reason

Aaron's fallback is the right call and cheaper than it sounds. **`O(1,1)` is two-dimensional and
completely classified**; boosts in 1+1 dimensions are `[[cosh φ, sinh φ], [sinh φ, cosh φ]]` and
there is nothing to discover. The work is never inventing the group — it is **earning the
invariant**. Borrowing the group costs nothing and commits nothing; asserting the invariant without
a falsifier is what would cost.

## Pointers

- `src/Core/FrameDelta.fs` — the translation group, and its own disclaimer
- `src/Core/HexCore.fs` — the 6 bivectors of `Cl(1,3)` as the Lorentz generators
- `src/Core/CliffordPeriodicity.fs` — `spacetimeSignature`; even = what remains, odd = what acts
- Lamport 1978 — happens-before as a light cone (the checked anchor)
- `docs/research/aurora-immune-math-standardization-2026-04-26.md` + the 2026-06-16 re-grounding
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why `toyOracleBoost` keeps its prefix
- `.claude/rules/numerology-vs-number-theory.md` — why a matching `Z₂ × Z₂` is not an identification
