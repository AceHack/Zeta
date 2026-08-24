# Adjudicating PR #14218: the four refutations hold, the identification fails in BOTH directions, and the code already landed

> **Assignment (Aaron).** PR #14218 (`feat(softvalue): widening as evidence retraction`) is open,
> DIRTY, auto-merge disarmed, and its central claim was refuted four ways. *"Re-verify each yourself
> against `origin/main` — do not take them on trust, and if any is wrong, say so."* Then: separate the
> intuition from the identification, judge them independently, and recommend CLOSE / REVISE / REVIVE.
>
> **Stance: check, don't confirm** — including checking my own prior refutation. Advisory only; no
> change to `src/`, no push to the PR branch, no close.
> Cut from `origin/main` at `0f082c8b5`.

## The answer in seven lines

| # | Question | Verdict |
|---|---|---|
| **R1** | Does the chain invert the theorem it cites (`h` indexes `{ν, τ}`)? | **HOLDS.** Re-checked at source: `h(One) = empty`, so empty support **is** the flat message |
| **R2** | Does `SoftValue` never call the group operations? | **HOLDS.** `add`/`negate`/`subtract` appear **0 times** in `SoftValue.fs`; they exist in `WeightedSet.fs` |
| **R3** | Is exact zero reachable by float underflow at step 324? | **HOLDS**, reproduced exactly — and it is reachable **through `foldRetained`**, since `MAX_MULTIPLICITY = 1024 > 324` |
| **R4** | Does `MANIFESTO.md` contain never-collapse text? | **HOLDS.** One occurrence of "collapse", line 116, about data models. The principle is Addison Cooper's, with "**prematurely**" |
| **D1** | *(new)* Does retraction imply widening? | **No.** Retracting evidence can strictly **sharpen** — entropy `0.693 → 0.325` |
| **D2** | *(new)* Is `widen` any retraction? | **No.** The retraction-reachable set is a **finite sublattice**; `widen λ` lands off it |
| **REC** | Recommendation | **CLOSE — as *superseded*, not merely as refuted.** The 434 lines are already on `main` via #14266 (`5c9c60e3a`) |

**The one-sentence adjudication.** Aaron's two sentences are each true in a *different* lane, and
**neither lane makes both true** — so the chain is not a claim that can be repaired by picking the
right structure; it has to be split into two claims about two structures.

---

## 1. The four refutations, re-verified independently

Each was re-derived from `origin/main` rather than read off the prior doc
(`…adversarial-the-widening-collapse-chain-refuted-four-ways…-lumen.md`, #14470). All four hold.
Method notes are included so the checks are re-runnable, not merely asserted.

### 1.1 R1 — the cited homomorphism points the other way. **HOLDS.**

`docs/research/2026-08-23-what-discretisation-costs-the-bnn-lane-…md` §2.1 defines
`h : Gaussian → WeightedSet<NatCoord, ℝ>` over the **two-element key set `{ν, τ}`**, and records:

```
A homomorphism h(a*b)=h(a)+h(b): HOLDS over 20000 pairs
A identity      h(One)=empty:    HOLDS
```

with the reason stated in the same paragraph: *"the flat message and the empty set are the same
object."* So in the structure the theorem is about, a key leaving the support means `τ = 0` —
`Gaussian.One`, **infinite variance, maximum uncertainty**.

The chain reads a key as a surviving *hypothesis*, which is the `'K = CandidateKey` structure —
where the same event means a hypothesis was destroyed. Same type constructor, **opposite semantics
for the identical event**. Under `numerology-vs-number-theory`: matching shape (`WeightedSet`) is not
identification; the invariant that separates them is *which set indexes `'K'`*, and it flips the sign
of the conclusion.

### 1.2 R2 — the group operations are not on the path. **HOLDS.**

Counted at `0f082c8b5` with `git grep -o "WeightedSet\.[a-zA-Z]*" origin/main -- src/Core/SoftValue.fs`:

```
5 ofSeq   2 weight   2 toSeq   2 scale   1 singleton   1 isEmpty
```

`add`, `negate`, `subtract` — **zero**. They are defined (`src/Core/WeightedSet.fs:69,86,90`) and
`negate`/`subtract` take an `IRing`, so the inverse exists in the library and is unused by the belief
layer. `SoftValue` lives entirely in the multiplicative/scaling fragment.

> The `−1` that widening is claimed to specialise **is not on the code path of the layer the claim is
> about.**

### 1.3 R3 — zero is reachable, and `foldRetained` can reach it. **HOLDS, and is worse than stated.**

Modelling `observe |> build` exactly (multiply, drop `w > 0.0`, sum, `None` if `total <= EPS`,
renormalise) with strictly positive likelihoods throughout — `l(x) = 1.0`, `l(y) = 0.1`:

```
SUPPORT SHRANK: 'y' deleted at step 324
  weight of y on the step before deletion: 1e-323   (subnormal)
  y * 0.1 = 0.0                                     (no zero was ever supplied)
```

Reproduced independently; the prior doc's step count is exact.

**The new part.** `foldRetained` applies a single evidence's likelihood `m` times via `applyN`, and
`MAX_MULTIPLICITY = 1024`. Since `1024 > 324`, **one piece of evidence at a high multiplicity deletes
a candidate inside the widening operator itself** (check `D4`). The operator built to re-open a
posterior contains a path that irreversibly closes one.

The integer lane also holds. `BeliefConvergence.fs:34` is `Array.map2 (*)` on `int64[]` with no
`Checked` anywhere in the file, against `ZSet.fs`'s **14** `Checked.` references — the contrast is
deliberate there and absent here:

```
2^32 * 2^32   = 0                      exact zero by wraparound
sharpen^7(3)  = -9204772141784466943   negative weight
```

Already filed: workitem `081M0R5R1JN087G0R0031FT1C2` (float lane) and
`081M0QRQ1WV087G0R002G1EW7N` (integer overflow). **No new filing needed** — this section is
corroboration, not a discovery.

### 1.4 R4 — the manifesto does not say it. **HOLDS, verbatim.**

`git grep -i "collaps" origin/main -- docs/governance/MANIFESTO.md` returns exactly one line:

> line 116: *"We reject fragile, tightly coupled data models that collapse under change."*

Schema brittleness. The principle being glossed is in `docs/CONCEPT-REGISTRY.md:42`, attributed to
**Addison Cooper, 2026-06-20**: *"uncertainty is held open, never **prematurely** collapsed."*

Deleting "prematurely" converts a threshold-gated discipline into an unconditional invariant — and
`SoftValue`'s own docstring names the exception the qualifier protects (`resolve`/`snap`, *"the ONE
legitimate collapse"*). **Honouring the anchor means keeping Addison's word.** Strengthening a claim
is still changing it.

---

## 2. Separating the intuition from the identification

The assignment's key instruction, and the place the prior refutation stopped short.

### 2.1 The identification fails in **both** directions — this is new

The chain says widening **is a special case of** retraction. That is a claim about two operators, so
it has two directions, and I could find no prior in-tree check of either. Both fail
(`docs/research/scripts/2026-08-23-widening-is-not-a-special-case-of-retraction-two-directions-verify.py`,
`ALL PASS`, exit 0).

**D1 — retraction ⇏ widening.** Take a uniform prior over `{x, y}` and two pieces of evidence that
exactly cancel: `e₁ = (0.9, 0.1)`, `e₂ = (0.1, 0.9)`.

| state | belief | entropy |
|---|---|---|
| `fold{e₁, e₂}` | `(0.5, 0.5)` | **0.693147** (maximal) |
| retract `e₂` (`m: 1 → 0`) | `(0.9, 0.1)` | **0.325083** |

Retraction **more than halved the entropy**. So "widening" is not what a `−1` does to a belief;
retraction's effect on uncertainty is **sign-indefinite**, and the widening cases are the subset where
the retracted evidence happened to be net-concentrating. The PR's own falsifier 1 (40 observations of
A, then 12 of B, window drops A) is an *instance* of that subset, not a witness for the general claim.

**D2 — widening ⇏ retraction.** Fix a prior `π` and an evidence multiset with multiplicities `m`. The
set of beliefs reachable by retraction alone is

> `R(π, E) = { normalise(π · ∏ₑ Lₑ^{m'ₑ}) : 0 ≤ m'ₑ ≤ mₑ }`,  `|R| ≤ ∏ₑ (mₑ + 1)` — **finite**.

Measured at `|R| = 12`: `widen λ` lands off `R` at every `λ ∈ {0.15, 0.30, 0.45, 0.60, 0.75, 0.90}`,
`L∞` distance up to `0.125`. And this is **generic rather than numerical**: `R` is finite while
`widen λ` varies continuously in `λ`, so the two can coincide for at most finitely many `λ`.

> **Neither operator is a special case of the other.** They are two different maps: `widen` is an
> *additive* convex mixture toward uniform; retraction is a *multiplicative* move within a finite
> orbit fixed by the recorded evidence. You can only retract what you actually added — which is the
> honest property, and exactly what makes retraction unable to express widening.

**The shipped code already knew this.** `SoftValueWidening.Tests.fs:162` —
`falsifier 4b - widen's floor PERMANENTLY caps confidence` — pins that `widen` caps confidence at
`1 − λ + λ/n` while `foldRetained` converges above `0.99` on a stationary source. **Different limiting
behaviour ⇒ different operators.** The PR's own falsifier is a falsifier of the PR's own headline.

### 2.2 The equivocation is on "**widening**", not on "retraction"

This resolves a tension currently sitting unreconciled on `main` between two of my own docs:

| doc | says |
|---|---|
| `…geometry-as-the-root-of-the-soft-regime…-lumen.md` §14.1 (#14429) | *"widening **is** a restricted retraction — **holds**, and is already shipped as the load-bearing operator"* |
| `…adversarial-the-widening-collapse-chain-refuted-four-ways…-lumen.md` §1 (#14470) | the chain is **refuted, four ways** |

Both merged 2026-08-23; the later never cites §14.1. The tension is **verbal, and the word is
"widening"**, which does double duty inside one file:

- `widen` — the belief-axis uniform-share floor (`SoftValue.fs:325`);
- `foldRetained` — documented as *"**the commutative widening operator**"* (`SoftValue.fs:427`).

§14.1's *measurement* is sound (24 permutations agree to `5.6e-17`) but it establishes
**commutativity of `foldRetained`**, not the identification. Read "widening" as a nickname for
`foldRetained`, §14.1 is true and is a stipulative definition. Read it as the operator `widen` that
ships twelve lines above, it is false by D2. **§14.1's row should be amended from a claim about
*widening* to a claim about *`foldRetained`*.**

### 2.3 The intuition, judged on its own — and where its second half inverts

Aaron's chain is two sentences, and they belong to different structures.

| sentence | lane where it is TRUE | in that same lane, the other sentence is |
|---|---|---|
| *"widening is a special version of the retraction −1"* | **exponential-family natural parameters.** `WeightedSet.subtract` **is** the EP cavity `Gaussian.( / )`; the group axioms give reversibility for free (Minka 2001, improper `τ ≤ 0` tolerated) | **inverted** — there, full retraction to empty support is `Gaussian.One`, the flat message |
| *"a full key retraction would be the uncertainty collapse"* | **the candidate simplex** — losing a `CandidateKey` really does destroy a hypothesis irreversibly | **false in both directions** (D1, D2) |

**And the second sentence is inverted in the evidence lane too — by the PR's own docstring.**
`window` with `horizon <= 0` *"retains NOTHING (every piece of evidence is retracted, **leaving the
prior untouched**)"*. Check `D3` confirms it against a deliberately **non-uniform** prior
`(0.4, 0.3, 0.2, 0.1)`: after two sharpening observations the belief is `(0.970, 0.015, 0.010, 0.005)`;
full retraction returns **exactly the prior**, not uniform and not a collapse.

> **Full retraction is the maximum re-opening available. It is the opposite of collapse — in the
> natural-parameter lane, in the evidence lane, and in the shipped docstring.** Two independent lanes
> give the same inversion, which is why this is a structural error and not a wording slip.

**Verdict on the intuition, stated in its own register.** *"Keep the uncertainty; don't collapse"* is
a sound **design principle** and it already has a correct in-tree statement — Addison's, **with**
"prematurely", **with** the sanctioned exit. Per `toy-is-free-metered-must-be-earned`: the principle
is a principle, the identification was a `toy` promoted to a theorem without a falsifier, and saying
so is not a demotion. What earned `metered` is narrower and real (§2.4).

### 2.4 What survives, stated precisely

> **SURVIVING CLAIM (true, shipped, green).** Over the free commutative monoid on evidence keys with
> multiplicities in ℤ≥0, `SoftValue.foldRetained` **is** evidence retraction: the posterior is
> `π · ∏ₑ Lₑ^{mₑ}`, lowering `mₑ` is the `−1`, and `mₑ = 0` is full retraction. Because the posterior
> is a function of the **retained multiset alone**, reorder-commutativity is preserved with retention
> enabled.
>
> **Register: `metered`.** Its falsifier is real — `falsifier 2` (200 seeded reorderings) **plus** the
> arrival-order mutant arm `2b` that must diverge, which is what stops the test being vacuous. Twelve
> tests green on `main`, three platforms, 5502-test suite.

Three things that claim does **not** say, each of which the chain did say:

1. it does not say retraction *widens* (D1);
2. it does not say `widen` *is* a retraction (D2 — they are different operators, as `4b` pins);
3. it does not need a support-monotonicity invariant. `support(fold(E ∪ {e})) ⊇ support(fold(E))` is
   **false as implemented** (R3) **and not desirable as stated** — it would forbid logical refutation
   (`P(H|E) = 0` is the correct posterior) and forbid honouring consent withdrawal under §6, where the
   datum must be *deleted*, not down-weighted.

---

## 3. Recommendation: **CLOSE**, as superseded

**The decisive fact is not the refutation.** PR #14218's 434 lines are **already on `main`**: #14266
(`refactor/softvalue-as-weightedset`) was branched on top of `e2e7f5891` and squash-merged as
`5c9c60e3a`, carrying them. Verified — `origin/main:src/Core/SoftValue.fs` has `widen` (line 325),
`foldRetained` (442), `RetentionSchedule` (398), `MAX_MULTIPLICITY` (405), and
`SoftValueWidening.Tests.fs` is present and green. The PR reads OPEN only because the squash gave it
a new SHA. **Closing it deletes nothing.**

So the three options resolve cleanly:

- **REVIVE is wrong.** All four refutations hold, re-derived independently, and D1/D2 add a fifth and
  sixth that the original pass did not run.
- **REVISE is wrong *for the PR*** — there is nothing left to revise. The narrow true claim (§2.4) is
  already implemented, already tested, already merged.
- **CLOSE is right, and the reason matters.** Close it as **superseded by #14266**, not as "refuted".
  The distinction is not politeness: the *code* was sound and is doing useful work; what was refuted
  is a **sentence in a commit message that never entered the source.**

**Checked, and worth stating: the false headline did not land.**
`git grep -i "special case of retraction" origin/main` matches only research docs — which state it as
a claim under adjudication — and **never `src/`**. The merged source says the narrower, true thing
(*"dropping `m` from `k` to `0` is literally the `-1` retraction"*, which holds in the evidence
multiset). **Nothing needs reverting from `main`.**

### 3.1 The three follow-ups, none of which is this PR

1. **Amend `…geometry-as-the-root…` §14.1** — retitle the row from *"widening is a restricted
   retraction — holds"* to *"`foldRetained` is evidence retraction, and it commutes — holds"*, and
   cross-link this adjudication. That row is the one a future reader would re-derive from.
2. **Rename or re-caption `foldRetained`'s docstring.** *"The commutative widening operator"* is the
   sentence that makes the equivocation invisible; *"the commutative retention operator (re-opens by
   retracting evidence, not by flattening the belief)"* says the same thing without the collision.
   Cosmetic in code, load-bearing in the record.
3. **The underflow repair is filed** (`081M0R5R1JN087G0R0031FT1C2`) and this pass adds one fact to it:
   the deletion is reachable *inside* `foldRetained` because `MAX_MULTIPLICITY = 1024 > 324`. That
   raises its priority; it does not change its diagnosis.

### 3.2 The falsifier that would overturn *this* adjudication

Honest exit condition, so this doc is not itself unfalsifiable:

> Exhibit a prior `π`, an evidence multiset `E`, and a `λ > 0` such that `widen λ (fold E π)` lies in
> `R(π, E)` **for an open set of `λ`**. That would show the two operators share an orbit and D2 fails.
> A single coincidental `λ` does not suffice — `R` is finite, so isolated hits are expected.

## 4. Anchors (checked, not merely cited)

- **Minka, *Expectation Propagation for Approximate Bayesian Inference* (UAI 2001)** — the cavity
  distribution `q^{\i} ∝ q / t̃ᵢ`. *Checked*: it is division in natural parameters and it explicitly
  tolerates improper messages, which is what makes retraction total in that lane. It says nothing
  about a candidate simplex, so it does **not** entail the chain's claim about `SoftValue`.
- **Anderson & Anderson, *Mon. Wea. Rev.* 127 (1999)** — multiplicative covariance inflation. *Checked*:
  it is the classical analogue of `widen`, i.e. of the operator D2 shows is **not** a retraction. The PR
  cites it correctly and for the right operator.
- **Shapiro, Preguiça, Baquero & Zawirski (2011)** — semilattice convergence. *Checked*: the applicable
  order-theoretic result for the fold; note idempotence, which the multiplicative belief fold lacks.
- **Addison Cooper, 2026-06-20**, `docs/CONCEPT-REGISTRY.md:42` — *"uncertainty is held open, never
  prematurely collapsed."* The human anchor for the intuition, with the qualifier restored.
- **Aaron Stainback, 2026-08-23** — the chain itself, offered as *"my interpretation … make sure it's
  verified adversarially too."* Recorded as the source of the question; the refutation is the service
  asked for.

## 5. Pointers

- PR #14218 (`e2e7f5891`) — the artifact adjudicated; **auto-merge deliberately off; not closed by me.**
- #14266 / `5c9c60e3a` — where the 434 lines actually landed.
- `docs/research/2026-08-23-adversarial-the-widening-collapse-chain-refuted-four-ways-…-lumen.md` — the four refutations (#14470).
- `docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-…-lumen.md` §14.1 — the row this doc amends (#14429).
- `docs/research/2026-08-23-what-discretisation-costs-the-bnn-lane-…md` §2.1 — the `{ν, τ}` homomorphism R1 turns on.
- `docs/research/scripts/2026-08-23-widening-is-not-a-special-case-of-retraction-two-directions-verify.py` — D1–D4, exit 0.
- `src/Core/SoftValue.fs` · `src/Core/WeightedSet.fs` · `src/Core/BeliefConvergence.fs` · `tests/Tests.FSharp/SoftValueWidening.Tests.fs`.
- Workitems `081M0R5R1JN087G0R0031FT1C2` (float underflow) · `081M0QRQ1WV087G0R002G1EW7N` (int64 overflow).
- Rules applied: `numerology-vs-number-theory` (§1.1, §2.1) · `toy-is-free-metered-must-be-earned` (§2.3, §2.4) · `anchor-to-human-prior-art` (§4) · `no-directives` (advisory only).
