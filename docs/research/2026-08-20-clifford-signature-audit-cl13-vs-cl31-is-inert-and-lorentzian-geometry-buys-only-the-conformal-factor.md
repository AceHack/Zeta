# The Cl(1,3) / Cl(3,1) split is real but INERT, and a Lorentzian metric buys exactly one thing over the happens-before poset

> **Carved sentence.** The two Minkowski conventions coexisting in this tree are genuinely
> non-isomorphic algebras, but **no in-tree use can tell them apart** — every one lands in the
> even subalgebra or the Lorentz Lie algebra, and both of those are _provably_ invariant under
> the `p ↔ q` swap, so the split is a documentation obligation and not a bug. And going the
> other way: a Lorentzian metric buys **exactly the conformal factor** over the causal partial
> order and nothing else (Malament 1977) — a factor that in a discrete substrate is supplied by
> **counting**, not by geometry (Sorkin). On the artefact we actually ship, there is nothing to
> count: `origin/main`'s causal set has concurrency width **1.000** — it is a chain. Buying a
> light cone for a worldline is the wrong-tool cost here.

**Author:** Soraya (formal-verification routing). **Date:** 2026-08-20.
**Scope:** routing + audit. This doc does **not** write a spec; it says which tool each surviving
property goes to, and which properties turn out not to need one.

---

## 0. Verdict table

| #   | question                                                                          | verdict                                                                                                                                                       | register                                               |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Are `Cl(1,3)` and `Cl(3,1)` distinct in this tree?                                | **yes, and correctly so** — `CliffordPeriodicity.classify` separates them and a test pins it                                                                  | **computed** (against the repo's own module)           |
| 2   | Does any code or proof CROSS between them?                                        | **NO. No crossing found.** No work-item filed.                                                                                                                | **computed** — search terms in §1.1                    |
| 3   | Could a crossing bite if one appeared?                                            | **only in the odd part** — the even part is swap-invariant, 0 counterexamples over 196 signature pairs                                                        | **theorem + computed**                                 |
| 4   | Should the two be unified?                                                        | **no — document the split**; the P3 row that authorises both is still the right disposition                                                                   | **argued**                                             |
| 5   | Does a Lorentzian metric give a better home for phase order than a Euclidean one? | **the question is mis-posed** — Euclidean was never a competitor; the competitor is _no geometry at all_                                                      | **argued**                                             |
| 6   | Does the geometry buy anything the partial order does not?                        | **exactly one thing: the conformal factor.** Nothing else.                                                                                                    | **theorem** (Malament 1977)                            |
| 7   | Does the substrate's causal order embed in `1+1` Minkowski?                       | **NO** — exhibited a reachable vector-clock configuration of order dimension 3                                                                                | **computed**, exhaustive over all 48 linear extensions |
| 8   | Is "phase time slows inside heavy consensus" a real formalisation?                | **half.** Made precise it reduces to _concurrency width_, a pure poset invariant — no metric needed. And the predicted load signal is **absent** in our data. | **computed**, weak estimator, caveats in §7.3          |
| 9   | Is HexCore's "6 walls = 6 Lorentz bivectors" an identification?                   | **no — it is a count.** `dim Λ²(R⁴) = 6` for _every_ 4-D signature. The missing invariant is named in §5.                                                     | **theorem**                                            |

---

# TASK 1 — Cl(1,3) vs Cl(3,1)

## 1. The census: which scope uses which

### 1.1 Search terms used

"Not found" is a claim about search terms, so here are mine, all run from the repo root with
`--no-ignore`, excluding `**/bin/**`, `**/obj/**`, `node_modules`, `references/prior-art/**`,
`docs/github/**`, `docs/history/**`:

```
Cl\(1,3\)  Cl\(1, ?3\)  Cl13  CL_1_3
Cl\(3,1\)  Cl\(3, ?1\)  Cl31  CL_3_1
Cl\(3, ?0\)
mostly.?plus  mostly.?minus  minkowski  Minkowski
"signature convention"  "metric signature"
majorana  "reality condition"  chirality
malament  "causal set"  sorkin  conformal
```

The `majorana / chirality / reality condition` sweep is the one that matters for the bug
question — those are the _only_ concepts where the two conventions give different answers — and
it is the sweep that came back empty of spacetime uses (the `Majorana` hits are all Majorana
_zero modes_, i.e. `Cl(0,n)`, an unrelated signature).

### 1.2 What is actually in the tree

| surface                                                                               | convention                          | what it uses it FOR                                                         |
| ------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| `src/Core/CliffordPeriodicity.fs`                                                     | **both, deliberately**              | `spacetimeSignature = (1,3)` as a named datum; `classify` separates the two |
| `tests/Tests.FSharp/CliffordPeriodicity.Tests.fs:59`                                  | **both**                            | the falsifier: _"the two Minkowski conventions are NOT isomorphic"_         |
| `src/Core/HexCore.fs`                                                                 | `Cl(1,3)` (docstring only)          | the **6 bivectors** — a count, see §5                                       |
| `docs/research/2026-06-02-hex-core-cross-domain-math-rhyme-*.md`                      | `Cl(1,3)` labelled with `so(3,1)`   | the same 6-count                                                            |
| `docs/research/2026-08-18-a-lorentz-for-one-oracle-*.md` (#12018)                     | `Cl(1,3)`                           | places the Lorentz generators in the even half                              |
| `docs/backlog/P3/081KSNY2Z0008QG0R002FX66H0-*.md`                                     | **both, by operator authorization** | _"support BOTH and swap with an interface"_ — never implemented             |
| `src/Core/Cl3.fs` + `CliffordE8Bridge.fs` + `CliffordE8BladeMask.fs` (×171 `Cl(3,0)`) | neither                             | Euclidean `Cl(3,0)`, explicitly scoped                                      |

**There is no executable code carrying a spacetime signature at all.** Every `Cl(1,3)` and
`Cl(3,1)` occurrence outside `CliffordPeriodicity` is prose. The one module that manipulates a
Clifford product numerically — `Cl3.fs` — is `Cl(3,0)` and says so in its own docstring
(_"Euclidean signature Cl(3,0) only"_).

## 2. Why no crossing is possible — the theorem, not the luck

Three separate facts, and together they close the question. The interesting part is that they
explain the _absence_ of a bug structurally rather than reporting that we got away with it.

**(a) The Lorentz Lie algebra does not know the convention. [theorem, one line]**
`o(p,q) = { A : Aᵀη + ηA = 0 }`. Replacing `η` by `−η` leaves that equation _literally
unchanged_, and `−η` has signature `(q,p)`. So `o(1,3)` and `o(3,1)` are not merely isomorphic —
**they are the same set of matrices.** Every claim in the tree about "6 Lorentz generators,
3 rotations + 3 boosts" is therefore convention-free by construction.

**(b) The even subalgebras agree. [theorem, and computed against our own module]**
`Cl⁰(p,q) ≅ Cl(p, q−1)` and `Cl⁰(q,p) ≅ Cl(q, p−1)`, whose clock positions are `s+1` and
`−s+1` — a pair summing to **2 mod 8**. Read off the repo's own table
(`CliffordPeriodicity.classify`, standard from Lawson & Michelsohn I.4), the residues that sum
to 2 are `{0,2}`, `{1,1}`, `{3,7}`, `{4,6}`, `{5,5}` — and **each pair sits in the same row**:
same ground field, same split flag, same exponent formula. Hence `Cl⁰(p,q) ≅ Cl⁰(q,p)` for all
`p,q`.

Run against the module itself (`dotnet fsi`, loading `src/Core/CliffordPeriodicity.fs` directly):

```
Cl(1,3)             = { Quaternionic; MatrixDim = 2; IsSplit = false }   -- M2(H)
Cl(3,1)             = { Real;         MatrixDim = 4; IsSplit = false }   -- M4(R)
Cl0(1,3) ~ Cl(1,2)  = { Complex;      MatrixDim = 2; IsSplit = false }   -- M2(C)
Cl0(3,1) ~ Cl(3,0)  = { Complex;      MatrixDim = 2; IsSplit = false }   -- M2(C)

even-subalgebra swap-invariance counterexamples over p,q in 1..14 : 0   (196 pairs)
full-algebra swap:  differ = 168,  agree = 42   (of 210 ordered pairs, p != q)
halvesSeparateCleanly (1,3) = Ok false        halvesSeparateCleanly (3,1) = Ok false
```

Note the last line: even the `halvesSeparateCleanly` predicate — which _does_ depend on `s` —
returns the same answer for both conventions (`s+1 = 7` vs `s+1 = 3`, both non-split complex
rows). So the one signature-sensitive predicate the module exposes is, at _this_ signature,
accidentally blind to the difference. That is worth knowing precisely because it is an accident
rather than a theorem: it does not generalise.

**(c) The workhorse signature is the common even part.**
`Cl(3,0) ≅ M₂(C)` is the most-used Clifford signature in the tree (×171) and it is exactly
`Cl⁰(3,1)`, and isomorphic to `Cl⁰(1,3)`. The repo has been living in the convention-neutral
subalgebra the whole time. `Cl3.fs`'s own docstring already says `Cl(3,0) ≅ C⊗H`, which is the
same `M₂(C)` — consistent, checked.

**So: [computed] no crossing exists, and [theorem] a crossing could only arise in the ODD part
— grade-1 vectors, real spinor modules, Majorana/reality conditions. Nothing in the tree
touches those.**

## 3. Disposition: document, do not unify

Unifying would be the wrong call and would cost something real. The P3 row
`081KSNY2Z0008QG0R002FX66H0` carries an explicit operator authorization to support **both**
behind an interface, and Aaron's 2026-08-20 framing (_"euclidean is the boring one, I'd much
rather have some non-euclidean ones too"_) points the same way. Collapsing to one convention
would delete a distinction that `CliffordPeriodicity` exists to make.

**One-line reason per scope, for the record:**

- **`CliffordPeriodicity.fs` — both, on purpose.** It is a _classifier_; erasing the
  distinction is erasing its subject. Its test at line 59 is the falsifier.
- **`HexCore.fs` / the hex-core research line — `Cl(1,3)`, and it does not matter.** The claim
  is a bivector count, which is `6` for every 4-D signature (§5).
- **`Cl3.fs` / E8 bridge — `Cl(3,0)`, Euclidean, explicitly scoped.** Not a spacetime algebra
  and does not pretend to be.
- **The P3 dual-signature row — both, unimplemented, and that is fine.** It is P3 because
  nothing needs it yet; §2 says why nothing needs it yet.

**The guard worth adding** (routing recommendation, not a bug): the moment anything reads
`spacetimeSignature` to derive a _spinor_ quantity — a real module dimension, a chirality, a
reality condition — the convention becomes load-bearing and silently wrong under the other
choice. That is a one-line invariant, and it belongs as an **FsCheck property beside the
existing `CliffordPeriodicity` properties**, not as a new tool:

> `classify p (q-1) ≡ classify q (p-1)` (ground + split + dim) for all `p,q ≥ 1`
> — _the even part cannot tell the conventions apart_ —
> paired with the existing line-59 fact that the full algebras can.

That pair is the whole content of §2 stated so it fails if someone breaks it. Cost: S. It is a
**P1** property by the triage table (violation would be noisy and reversible), so one tool is
correct and a cross-check would be over-buying. **Filed as
`081M0FTPJ4X087G0R000E91P3Y`** — a task, not a bug, because there is no crossing to fix.

## 4. Two smaller findings from the same sweep

- **`docs/research/2026-06-02-hex-core-*.md:21`** writes _"Cl(1,3) (6 bivectors = Lorentz
  so(3,1))"_ — mixing the two labels in one clause. By §2(a) this is **not an error**
  (`so(1,3)` and `so(3,1)` are the same matrices), but it is the kind of line that trains the
  next reader to think the labels are interchangeable _in general_, which they are not.
  Cosmetic; noted, not filed.
- **The P3 row's cross-signature claims are correct as written.** `Cl(1,3)⊗C ≅ Cl(3,1)⊗C ≅
M₄(C)` ✓ (complexification depends only on `n`), and `Cl⁰(1,3) ≅ Cl⁰(3,1) ≅ Cl(3,0)` ✓
  (§2(b), computed). Checked, not assumed.

## 5. The bivector count is a count — the numerology test applied to our own docstring

`HexCore.fs` says the six walls rhyme with _"the 6 bivectors of spacetime algebra Cl(1,3) = the
6 Lorentz generators."_ Applying `.claude/rules/numerology-vs-number-theory.md` to it:

> **What else has this number?** `dim Λ²(R⁴) = 6` for **every** signature with `p+q = 4`. The
> competitors are `so(4)`, `so(3,1)`, `so(2,2)` — plus `SE(3)`, the cube's faces, and
> `su(2)⊕su(2)`. A `6` does not select Lorentzian. It selects _four-dimensional_.

The invariant that **would** discriminate is known and cheap [theorem]: over `R`,

| algebra                       | splits into two 3-dim ideals?        |
| ----------------------------- | ------------------------------------ |
| `so(4) ≅ su(2) ⊕ su(2)`       | **yes** (self-dual / anti-self-dual) |
| `so(2,2) ≅ sl(2,R) ⊕ sl(2,R)` | **yes**                              |
| `so(1,3) ≅ sl(2,C)_R`         | **no** — simple over `R`             |

So the promotion test is exact: **exhibit a bracket on the six walls and check whether it splits
into two independent triples.** If it splits, the structure is Euclidean or split-signature, not
Lorentzian. If it does not split, the claim is promoted from count to identification.

Today there is no bracket on `Wall`, so the claim is a count and nothing more.
`HexCore.fs` already hedges it (_"stays a hypothesis to referee"_) — this section supplies the
specific missing invariant that would discharge the hedge, which is what the rule asks for.
**Register: the six-count is `argued`; the promotion test is `theorem`.**

---

# TASK 2 — is Lorentzian the right home for phase / causal structure?

## 6. The question is mis-posed, and fixing it is most of the answer

The task asks Lorentzian _vs_ Euclidean. But a Euclidean signature has **no causal structure at
all** — no cones, no invariant notion of "before". It was never a candidate, so beating it costs
nothing and proves nothing.

The real competitor, named correctly in the task brief, is **no geometry**: Lamport's
happens-before partial order (Lamport 1978; Mattern 1988; Fidge 1988). So the honest bar is:

> **What does a Lorentzian metric give that the poset does not?**

And that question has a _published, exact answer_, which is better than an opinion.

## 7. The answer: exactly the conformal factor. Nothing else.

### 7.1 The theorem [checked anchor — the paper entails the claim]

**Malament (1977), "The class of continuous timelike curves determines the topology of
spacetime", J. Math. Phys. 18, 1399** — strengthening **Hawking, King & McCarthy (1976)**:

> For past- and future-distinguishing spacetimes, a **causal bijection** (a bijection preserving
> the causal order in both directions) is a **conformal isometry**.

Read as a statement about what information lives where:

- the **causal order determines the metric up to a positive scalar factor at each point**;
- and the causal order determines **nothing more** than that — the factor is exactly the
  residue.

This is the entailment check `anchor-to-human-prior-art.md` requires: the theorem's conclusion
_is_ the claim "order ⟹ conformal class", not something adjacent to it.

So the accounting is complete and there is no third option:

|                                       | causal partial order | Lorentzian metric                |
| ------------------------------------- | -------------------- | -------------------------------- |
| which pairs are causally ordered      | ✅                   | ✅ (same information — Malament) |
| which pairs are concurrent            | ✅                   | ✅ (same information)            |
| **how far apart** (interval / volume) | ❌                   | ✅ **← the entire delta**        |

### 7.2 And in a discrete substrate the delta is supplied by COUNTING, not geometry

This is causal set theory's founding move (**Bombelli, Lee, Meyer & Sorkin 1987**; survey:
**Surya, _Living Reviews in Relativity_ 2019** — both already cited in
`docs/research/2026-05-29-lightlike-substrate-as-causal-sets-*.md`). Sorkin's slogan:

> **Order + Number = Geometry.**

Proper time between two elements is estimated by the **longest chain** between them
(Brightwell & Gregory 1991); volume is estimated by **element count**. Both are pure order
invariants. **A discrete causal set therefore already carries the conformal factor, and does not
need a metric to have one.**

Which closes the loop: the metric buys the conformal factor (§7.1), and counting supplies the
conformal factor (§7.2), so **the metric buys nothing a poset with a counting measure does not
already have.** That is the clean negative, reached by theorem rather than by shrug.

**One honesty note that cuts against importing the geometry.** The continuum theorem (Malament)
and the discrete recipe (Sorkin) are _not_ the same statement, and the bridge between them —
that a causal set faithfully embeds into at most one spacetime up to approximate isometry — is
the **Hauptvermutung of causal set theory, and it is OPEN.** So "our causal order is Lorentzian
geometry" imports an unproven conjecture as a hidden premise. **Register: unearned.** The
poset-plus-counting statement needs no such premise, which is a second, independent reason to
prefer it.

### 7.3 A computed falsifier: our causal order does not embed in `1+1` Minkowski

The `#12018` doc offers a toy `O(1,1)` boost on `s² = (Δτ)² − (Δu)²`. Before earning the
invariant, there is a cheaper prior question: **can a `1+1` cone even host our causal order?**

**Theorem [proved here, two lines].** In `M^{1,1}` use light-cone coordinates `u = t+x`,
`v = t−x`. Then `p ≤ q ⟺ u_p ≤ u_q AND v_p ≤ v_q`. That is _precisely_ a 2-element realizer, so
a finite poset embeds in the causal order of `1+1` Minkowski **iff its order dimension is ≤ 2**.
(Converse: from a realizer `L₁,L₂` set `u,v` to the ranks and `t=(u+v)/2`, `x=(u−v)/2`.)

**Computed.** Six standard vector clocks over six processes — three events `aᵢ`, and three
events `bⱼ` on fresh processes each of which has received from both `aᵢ` with `i ≠ j`:

```
a0 [1,0,0,0,0,0]   b0 [0,1,1,1,0,0]
a1 [0,1,0,0,0,0]   b1 [1,0,1,0,1,0]
a2 [0,0,1,0,0,0]   b2 [1,1,0,0,0,1]

happens-before:  a0<b1  a0<b2  a1<b0  a1<b2  a2<b0  a2<b1
is exactly the standard example S_3 : true
linear extensions enumerated : 48        order dimension <= 2 : false  (exhaustive over all pairs)
```

`S₃` has order dimension 3. So **[computed] a perfectly ordinary six-process message pattern
produces a causal order that provably does not embed in `1+1` Minkowski**, and no `O(1,1)`
boost can act on it as a causal symmetry.

**What this does and does not falsify.** It does _not_ kill the `#12018` toy, because that toy's
`O(1,1)` lives on a per-pair `(Δτ, Δu)` plane, not on the event set. It kills the _stronger and
more tempting_ reading — "the substrate's causal order is `1+1` Minkowski" — and it names the
obligation the toy inherits: if `s²`'s cone is meant to _be_ the happens-before cone, §7.3 is
the counterexample it has to answer.

**And the negative does not generalise upward, which is itself worth stating.** `S₃` _does_
embed in `2+1` Minkowski — put `aᵢ` at the vertices of a unit equilateral triangle at `t=0` and
`bⱼ` at the midpoint of the opposite edge at `t=0.6`:

```
a_i -> b_j  dist 0.5000 <= 0.6 for i != j   |   dist 0.8660 > 0.6 for i == j     => embeds
```

**[computed].** Whether some _fixed_ higher dimension hosts every reachable happens-before poset
is a literature question I did not settle — **register: unearned**, my search terms in §1.1 for
`order dimension` / Minkowski embeddability found no in-tree treatment. But note that even a
"yes" would be cold comfort: `d` would then be a free parameter no substrate measurement pins,
which is a worse position than having no geometry.

## 8. Aaron's gravity picture — half real, and the real half needs no metric

> Aaron 2026-08-20: gravity as _"phase time slowing inside heavy distributed consensus."_

**The real half.** Under Sorkin's dictionary this has a precise, metric-free form. Gravitational
time dilation is a _lapse_: proper time per unit coordinate time. Substituting the causal-set
estimators — proper time = **longest chain**, volume = **count** — gives

```
z(region)  =  chain advanced  /  elements landed   =  1 / (mean concurrency width)
```

Both numerator and denominator are pure order invariants of the causal set. **So the "gravity"
picture, made precise, is concurrency width** — a quantity Lamport-order already measures, with
no metric, no signature, and no light cone. That is a genuine formalisation, and it is _also_
another instance of the §7 negative: the geometry was the scaffolding, not the content.

**The half that is a picture, and the rule that says so.** There is a second, more intuitive
reading — lapse as _logical ticks per wall-clock second_ — and that one is **inadmissible in the
shared fold by standing rule**, not by taste.
`.claude/rules/local-time-never-enters-the-shared-fold.md` forbids local wall-clock from
filtering or weighting evidence entering the commutative fold, because nodes with different
receive-times would fold different sets and diverge. A wall-clock lapse is exactly such a
weight. So:

| candidate lapse                               | admissible in the shared fold?                                            |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| chain-count / element-count (order-intrinsic) | **yes** — a pure function of (evidence set, agreed phase)                 |
| logical ticks / wall-clock second             | **no** — local-frame only; may steer backoff and timeouts, never the fold |

That is a clean routing decision falling straight out of a rule that was written before the
question arose, which is the rule doing its job.

## 9. Measured — and the predicted signal is not there

If phase time slows under heavy consensus, then `z` should fall as load rises. Measured on our
own causal set (`origin/main`, last 6000 commits, 40 days with ≥ 20 commits):

```
days = 40    corr(commits per day, z) = -0.1443
GLOBAL over the 6000-commit window:  longest chain = 5999,  elements = 6000
global mean concurrency width  =  1.000
```

**Width exactly 1.000. `origin/main` is a chain.** Confirmed independently:
`git log --format='%P' -n 3000 origin/main | awk '{print NF}' | sort | uniq -c` → **3000
commits, every one with exactly one parent.** Squash-merge everywhere.

Widening to the real substrate (main plus 400 `heartbeat/*` refs, 14 752 elements):

```
longest chain = 13533    width = 1.090    max antichain-by-depth = 10
```

Three consequences, and the first is the one that matters:

1. **The geometry has nothing to act on.** A Lorentzian metric's entire job is to distinguish
   timelike from spacelike separation. Our persisted causal set is essentially all timelike.
   You would be buying a light cone for a worldline.
2. **The gravity signal is absent** at this granularity: `corr = −0.14`, and `z` sits near 1.0
   regardless of daily volume.
3. **The squash is where the spacelike structure died.** Concurrency was real at runtime and is
   _not retained_ — squash-merge erases the merge structure. This sharpens a claim the
   `2026-05-29` doc marks "beacon-proven": **`git-DAG = causal set` is true but, on `main`,
   trivially so.** The interesting causal set is the pre-merge branch fan, and we do not keep it.

**Caveats, stated so the result is not over-read [register: computed, low power].** (a)
Antichain-by-depth is a _lower_ bound on true width (Dilworth's maximum antichain can exceed the
depth level-sets). (b) The per-day `z` estimator double-counts chains crossing day boundaries —
which is why the per-day column can exceed 1 while the global figure is exactly 1; trust the
global number, not the daily one. (c) One repository, one window. **This is an absence of the
predicted signal in a crude estimator, not a falsification of the picture.** The global
width = 1.000 result, by contrast, is exact and independently confirmed.

## 10. Routing — where each surviving property goes

Per the routing table in `.claude/skills/formal-methods/blueprints/formal-verification-expert.md`.
Anchor check first, as step 0.

**Anchor.** Causal order ⟹ conformal class: **Malament 1977 / Hawking–King–McCarthy 1976** —
_anchored_, and the citation entails the claim (§7.1). Order + Number = Geometry: **Bombelli–
Lee–Meyer–Sorkin 1987 / Surya 2019** — _anchored_. Happens-before: **Lamport 1978** — already a
checked anchor in `#12018`. Clifford classification: **Atiyah–Bott–Shapiro 1964 / Lawson–
Michelsohn I.4** — _anchored_, in-module. **Nothing here is factory-native**, which is the whole
reason this was a literature question and not a modelling exercise.

| property                                                                          | class                                     | primary                                                                                                                                        | cross-check                                           | wrong-tool cost                                                                                                                                     |
| --------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cl⁰(p,q) ≅ Cl⁰(q,p)` — the even part cannot tell the conventions apart (§2b, §3) | **Algebraic-law identity**                | **FsCheck**, beside the existing `CliffordPeriodicity` properties (it is a finite-table identity; the module is already property-tested there) | none — **P1**                                         | Lean/Mathlib for a table identity is human-weeks for a lemma FsCheck settles in an hour                                                             |
| happens-before is not order-dimension ≤ 2 (§7.3)                                  | **Structural shape**                      | **Alloy** (Trial, 6 specs in `src/Core.Alloy/`) at bound 6–8 — the crown is found instantly                                                    | the §7.3 script is already the empirical half         | **TLA+ here would be the reflex error**: a static structural fact about a poset, enumerated as a state space. TLC-hours for an Alloy-seconds answer |
| six walls split into two triples? (§5)                                            | **Structural shape**                      | **nothing yet — there is no bracket to check.** Routing is blocked on the algebra, not on the tool                                             | —                                                     | writing _any_ spec before the bracket exists would verify our encoding, which is the shadow-catch failure mode step 0 exists to prevent             |
| `z = chain/count` is order-intrinsic (§8)                                         | **not a formal property** — a measurement | the §9 script; belongs beside the DORA folds                                                                                                   | Adaeze (claims-tester) owns the empirical replication | a formal spec for a metric definition proves nothing; wrong axis                                                                                    |

**Nothing here is P0**, so BP-16's ≥ 2-tool floor does not fire. Saying that out loud is part of
the job: reaching for the triple on a P1 algebraic identity is over-buying, and over-buying is
how a portfolio drifts back to one hammer.

**Coverage impact.** The FsCheck property closes the only bug class §2 leaves open (a future odd-
part use silently inheriting the wrong convention). Residual gap after it lands: nothing in the
tree computes a spacetime Clifford product at all, so there is no artefact to gate — the gap is
"no implementation", not "no proof".

## 11. What would change these verdicts

Stated in advance so they are falsifiable rather than restated later:

- **Task 1 flips to a bug** the moment any code derives a real spinor-module dimension, a
  chirality, or a Majorana/reality condition from `spacetimeSignature`. Watch the odd part.
- **Task 2 flips to positive** if a quantity is found that is (i) invariant under a genuine
  transformation between two oracles' views, (ii) _not_ recoverable from chain-counting, and
  (iii) closes into a group. `#12018` names (i) and (iii); (ii) is the new obligation this doc
  adds, and it is the hard one, because §7.2 says counting already gets you the conformal factor.
- **§9 flips** if the pre-merge branch fan is retained and its width turns out to be large and
  load-dependent. Retaining it is a substrate change, not a measurement change.

## 12. Independence check (the rule's own warning, applied to this doc)

`.claude/rules/numerology-vs-number-theory.md`: _too many correlations is a warning._ This doc's
findings converge suspiciously well, so:

| finding                                                                           | independent of the others?                                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cl⁰` swap-invariance (§2b)                                                       | **yes** — pure algebra, computed against the module                                                                                                                                                             |
| order dimension 3 counterexample (§7.3)                                           | **yes** — combinatorics, exhaustive                                                                                                                                                                             |
| width = 1.000 on main (§9)                                                        | **yes** — measurement, independently confirmed by parent-count                                                                                                                                                  |
| Malament (§7.1) and Sorkin (§7.2) both saying "the delta is the conformal factor" | **NO — one fact in two costumes.** Sorkin's programme is _built on_ Malament-type results. Counting them as two confirmations would be exactly the independence failure the rule warns about. **They are one.** |

So the §7 negative rests on **one** theorem plus **two** independent computations, not on four
agreeing sources.

## Pointers

- `src/Core/CliffordPeriodicity.fs` — the classifier; `spacetimeSignature`, `halvesSeparateCleanly`
- `tests/Tests.FSharp/CliffordPeriodicity.Tests.fs:59` — the existing falsifier for the split
- `src/Core/HexCore.fs` — the six walls and the 6-bivector rhyme (§5)
- `src/Core/Cl3.fs`, `src/Core/CliffordE8Bridge.fs` — the Euclidean `Cl(3,0)` workhorse
- `docs/backlog/P3/081KSNY2Z0008QG0R002FX66H0-*.md` — the authorized dual-signature row, still P3
- `docs/research/2026-08-18-a-lorentz-for-one-oracle-*.md` — #12018; §7.3 is the obligation this
  doc adds to its `toyOracleBoost`
- `docs/research/2026-05-29-lightlike-substrate-as-causal-sets-*.md` — the causal-set anchors,
  sharpened by §9's width measurement
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — the rule that decides §8
- `workitems/081M0FTPJ4X087G0R000E91P3Y-*.md` — the §3 guard, routed to FsCheck
- `src/Core.TypeScript/research/causal-order-minkowski-embedding.ts` (+ `.test.ts`) — the §7.3
  and §9 computations as a gated falsifier, so the numbers above are checked rather than quoted
- `.claude/rules/numerology-vs-number-theory.md` — §5 and §12
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — register labels throughout
- Malament 1977 · Hawking–King–McCarthy 1976 · Bombelli–Lee–Meyer–Sorkin 1987 · Surya 2019 ·
  Brightwell–Gregory 1991 · Lamport 1978 · Atiyah–Bott–Shapiro 1964 · Lawson–Michelsohn I.4
