# Is semantics a quotient of syntax? Only where there is no junk — homoiconicity IS that condition, and "many representations at once" is the congruence lattice

**Lumen** (mathematical-physics hat), 2026-08-25. Base `da6f3ccc02`.
Runnable code: `src/Core.TypeScript/research/free-quotient-semantics-closure.ts` (+ `.test.ts`, 17 tests / 368 assertions, exhaustive finite sweeps, no sampling and no fitting).

Answers Aaron's question, on file twice — 2026-08-23 (*"connect BNNs to WSet via dual BNN or some sort of context-free/aware syntax/semantics split?"*) and 2026-08-25 (*"i think this is the context aware grammar in between context free grammar … a dual BNN based on these two concepts"*) — plus two mid-thread corrections from him that changed the question and improved the answer.

---

## 0. The answer in twelve lines

1. **The syntax/semantics = free/quotient claim HOLDS WITH ONE CONDITION, and the condition is exactly "no junk."** By the homomorphism theorem, *every* semantics factors as `syntax ↠ quotient ↪ semantic algebra`. It is a quotient **iff** that last inclusion is an equality — iff every semantic value is denoted by some term.
2. **Homoiconicity is that condition.** `eval ∘ quote = id` says `eval` is a *split* surjection. So Aaron's *"we self-select into a homoiconic regime to make this hold true"* is not a hedge — homoiconicity is the constructive form of no-junk, and it is the precise reason the correspondence holds inside Zeta and not in general.
3. That is **three separate register tiers and they must not be blurred**: the factorisation is a **theorem**; "Zeta stays in the no-junk regime" is a **design invariant maintained by choice**; and the adinkra Construction-A route is a **located instance where that choice was spent**.
4. **The classical failure has a name.** Full abstraction: the standard continuous-function model of PCF contains `parallel-or`, which no PCF term denotes — junk, so that semantics is not a quotient (Plotkin 1977).
5. **Measured in the grammar lane:** the yield map `T_Σ → Σ*` has 248 junk strings out of 255 swept, so it is *not* a quotient; restricted to the language `L` it *is*, with a computable section. Ambiguity is its kernel; **the SPPF is literally the fibre**; the fibre sizes are Catalan **by the grammar's own self-convolution**, not by matching a table.
6. **A level-shift correction to the setup.** "Context-sensitive = quotient by relations" conflates two different quotients. A congruence on a *term algebra* stays equational; a relation set on the *free monoid* is a semi-Thue system and is undecidable in general (Post/Markov 1947). Free-vs-quotient and the Chomsky hierarchy are **not the same axis**.
7. **`WSet.consolidate` IS the quotient map, already in the tree.** `src/Core/WSet.fs`'s `('K*'W) list` is the free layer; `src/Core/WeightedSet.fs`'s `Zero`-pruned `Map` is the quotient layer. Measured: surjective (junk 0), non-injective (largest fibre 43, 5.426 bits erased), congruence violations 0 over 259 sets.
8. **The dual BNN is the epi–mono factorisation of the semantics map, and the repo already ships one carrier per half.** Not two networks. The two halves are dual in the exact categorical sense (section vs retraction).
9. **A dichotomy with no third option, from initiality alone:** a context-aware scorer either *is* a Σ-homomorphism — in which case, by uniqueness, it is the free fold over a refined signature and the "dual" collapses into state-splitting — or it is *not*, in which case it is a fitted approximation with measurable, non-structural error. Both branches exhibited and measured.
10. **Aaron's second correction — "both adinkras can be true at once, many can" — is the stronger claim and it is right.** It is not a trade. The coded family and the homoiconic family coexist in-tree, reaching two *different faces* of E₈.
11. **And plurality over one free object is free.** Quotients of a fixed free object form a complete lattice (Birkhoff), so any two representations have a meet both factor through: **the span always exists, Babel is impossible, reintegration never needs reconvergence.** Measured: two incomparable congruences (6 and 6 classes) reconciling through a 10-class meet with neither collapsed.
12. **Junk is the Babel condition.** A representation that is *not* a quotient of the shared free object has values no syntax names, so no span through syntax covers it. That — not elegance — is why staying homoiconic is worth paying for.

---

## 1. Register discipline first, because this document mixes three tiers

| tier | claim | status |
|---|---|---|
| **Theorem** | every semantics factors `T ↠ T/ker ↪ A`; it is a quotient iff surjective; quotients of `T` form a complete lattice | mathematics, not ours — homomorphism theorem + Birkhoff |
| **Theorem** | homoiconicity (`eval ∘ quote = id`) ⇒ surjective ⇒ semantics is a quotient | one-line consequence, proved below |
| **Design invariant** | *Zeta's* representations stay inside the no-junk regime | **maintained by construction, not discovered.** Aaron 2026-08-25: *"we try to self select into a homoiconic self-recursive at every dimension regime to make this hold true — it's not obviously true from what i can tell."* |
| **Located instance** | `AdinkraCode` Construction A over `[8,4]` leaves the regime, at a price of exactly 4 bits | measured here; the in-tree comment (`src/Core/CliffordPeriodicity.fs:179`) is confirmed and priced |
| **Refutation of my own earlier framing** | "the substrate is not closed" | **withdrawn.** The bivector route quotients nothing and reaches E₈ too. The cost is per-route; the substrate holds both. |

`toy-is-free-metered-must-be-earned.md` applies to row 3 specifically: **a property held by design decision is not thereby metered.** A later reader must not be able to mistake it for row 1.

---

## 2. The theorem, stated so it can be checked

Let `Σ` be a signature (the productions), `T_Σ` its term algebra — the **initial** Σ-algebra, i.e. the free one. Initial-algebra semantics (Goguen, Thatcher, Wagner & Wright 1977) says: for any Σ-algebra `A` there is a **unique** homomorphism `⟦−⟧ : T_Σ → A`.

The brief flagged the right worry: that makes semantics a *homomorphism into another algebra*, not obviously a *quotient of syntax*. The homomorphism theorem for universal algebra (Birkhoff 1935; Burris & Sankappanavar 1981, Thm 6.12) settles it:

> `ker⟦−⟧ = {(s,t) : ⟦s⟧ = ⟦t⟧}` is a congruence on `T_Σ`, and `T_Σ / ker⟦−⟧ ≅ im⟦−⟧ ⊆ A`.

So **every** semantics factors uniquely as

```
    T_Σ  ──surjection──▶  T_Σ/ker  ──iso──▶  im⟦−⟧  ──inclusion──▶  A
    free                  quotient                                   semantic algebra
```

Three arrows, not two. The free/quotient story is the *first* arrow. Semantics is a quotient of syntax **exactly when the third arrow is an identity**. In the algebraic-specification vocabulary this is the standard pair:

- **no confusion** — the kernel is trivial (arrow 1 is an iso). Fails whenever a language has distinct programs with equal meaning, i.e. always.
- **no junk** — every element of `A` is denoted by a term (arrow 3 is an identity). **This is the one the claim needs.**

**Verdict on deliverable 1: HOLDS WITH CONDITIONS, and there is exactly one condition — no junk.** A clean refutation would have been worth more, and this is not quite one; but neither is it a confirmation. It is a *localisation*: the claim's entire content was hiding in a surjectivity requirement nobody had stated.

---

## 3. Homoiconicity IS the no-junk condition — which is why the self-selection works

McCarthy's Lisp property, stated algebraically: a homoiconic system supplies `quote : A → T_Σ` with `⟦quote(a)⟧ = a`. That is a **section**, making `⟦−⟧` a **split epimorphism**.

```
split epi  ⇒  epi  ⇒  surjective  ⇒  no junk  ⇒  A ≅ T_Σ/ker⟦−⟧
```

So:

> **Homoiconicity is not merely *compatible* with "semantics is a quotient of syntax". It is the constructive proof of it, and it is strictly stronger than the bare condition, because it supplies the section rather than asserting the surjection.**

This is the checked answer to Aaron's *"we try to self select into a … regime to make this hold true."* He is right, and now there is a reason: **the regime he is selecting into is defined by exactly the property the claim was missing.** `src/Core.Lean4/Gen/HomoiconicFixpoint.lean` already names the same identity (`eval ∘ quote = id`) and cites McCarthy for it; what is new here is that this identity is the load-bearing hypothesis of the syntax/semantics correspondence, not a separate nice property.

**One honest sharpening, because it is where the content actually lives.** Over finite sets, a section exists for *any* surjection by choice, so mere existence is vacuous. The content of homoiconicity is that the section is **computable and canonical** — a normal-form function. Choosing canonical representatives of congruence classes *is* solving the word problem, which is undecidable in general (Post 1947; Markov 1947; Novikov 1955 / Boone 1958 for groups) and decidable exactly when the presentation is confluent and terminating (Newman 1942; Knuth–Bendix 1970). **The regime is real, it has a boundary, and the boundary is a classical one.** The probe's `hasSection` field reports surjectivity and says so in a comment rather than pretending to decide canonicity.

---

## 4. Where it demonstrably fails in the literature — the anchor that keeps this from being a tautology

If no-junk always held, the condition would be empty. It does not:

> **Plotkin (1977), "LCF considered as a programming language."** The Scott-continuous function model of PCF contains `parallel-or`, and **no PCF term denotes it**. That element is junk. So the standard denotational semantics of PCF is *not* a quotient of its syntax — and the model is not fully abstract. Adding `parallel-or` to the *language* repairs it, which is precisely "extend the syntax until the junk is denoted."

Milner (1977) then constructed a fully abstract model syntactically; and the game-semantics resolution (Abramsky–Jagadeesan–Malacaria; Hyland–Ong, both 2000) obtains full abstraction only after **an intrinsic quotient plus a restriction to definable strategies** — i.e. by fixing *both* confusion and junk, separately. That the field needed two decades and two distinct repairs is the strongest available evidence that these are two independent conditions and that no-junk is not free.

**Anchor status: CITED FROM STANDING KNOWLEDGE, NOT PAGE-CHECKED.** No paper was opened in this session. `anchor-to-human-prior-art.md` demands *checked* anchors, and these are not yet; the in-repo anchors below **are** checked (files read at `da6f3ccc02`). Closing this gap is real work, not a formality — `missing-citations` is the skill for it.

---

## 5. The grammar instance, measured — ambiguity is the kernel and the SPPF is the fibre

Grammar `S → a | S S`; derivation trees are the free algebra; `yield : T_Σ → Σ*` is the unique homomorphism into the free monoid, and it is the only thing a parser is handed.

Swept exhaustively, `n = 1..7` (197 trees), codomain `{a,b}*` up to length 7 (255 strings):

| map | domain | image | codomain | junk | largest fibre | bits erased | quotient? | section? |
|---|---|---|---|---|---|---|---|---|
| `yield` into `Σ*` | 197 | 7 | 255 | **248** | 132 | 7.044 | **no** | **no** |
| `yield` into `L` | 197 | 7 | 7 | **0** | 132 | 7.044 | **yes** | **yes** |

Two facts fall out that are worth naming separately:

- **Ambiguity is exactly a nontrivial kernel, and the SPPF is exactly a fibre.** `src/Core/Sppf.fs` is a data structure for one fibre of the yield map. That is an identification, not an analogy: the parse forest *is* the equivalence class.
- **"Bits erased by parsing" = log₂|fibre|**, which is the same metric `tests/Tests.FSharp/Formal/WSet.ErasureClassification.Laws.Tests.fs` already computes (`bits erased = log2(largest fibre)`, line 44). At `n = 7` that is `log₂ 132 = 7.044` bits.

**Numerology guard, applied.** 1, 2, 5, 14, 42, 132 is Catalan, but a matching count identifies nothing — Motzkin opens 1, 1, 2 identically and diverges at n = 4. The excluding invariant used here is **structural, not numeric**: the probe computes `C_n = Σᵢ Cᵢ·C_{n−1−i}`, the self-convolution, which *is* the production `S → S S` read as an operation. The test asserts the trees match that recurrence, not that they match a literal table.

---

## 6. A level-shift correction to the setup's own table

The brief's settled table pairs "context-sensitive" with "quotient by relations." That is loose in a way that matters, because it silently identifies two different quotients:

| | what is quotiented | by what | where it lands |
|---|---|---|---|
| **(a) algebra level** | the term algebra `T_Σ` | a **congruence** | an equational theory; normal forms exist iff confluent + terminating |
| **(b) string level** | the free monoid `Σ*` | an arbitrary **relation set** | a semi-Thue system — **type-0**, word problem undecidable |

The repo's rules (`interfaces-free-classes-earned-under-rules.md`, `only-the-irreducible-is-primitive-generate-the-rest.md`) speak level (a): free object, earned quotient by *declared relations*. The grammar analogy runs at level (b). **Unconstrained relations on the free monoid overshoot context-sensitive entirely and land on type-0.** Context-sensitive is the *monotone* (non-contracting) restriction of exactly that construction — Kuroda 1964, CSL = NLBA.

So the honest row is: **context-sensitive ≈ quotient by length-non-decreasing relations**, and the qualifier is doing all the work. Dropping it does not generalise the claim; it changes it into a different, undecidable one. This is the same failure mode the brief warned about — a clean correspondence assumed at the next level up.

Corollary already stated in the 2026-08-23 doc and worth re-asserting: **soft weights do not move a grammar up the hierarchy.** A weighted CFG is a CFG. What changes is which parse wins.

---

## 7. `WSet` — the answer to "connect BNNs to WSet", and it needed no new type

Aaron's phrasing was *"connect BNNs to WSet via dual BNN."* The connection is structural and it is already in `src/Core/`, unnamed:

| layer | type in-tree | what it is |
|---|---|---|
| **free** | `WSet.WSet<'K,'W> = ('K * 'W) list` | the free monoid on `'K × 'W`; `WSet.plus` is concatenation |
| **quotient** | `WeightedSet<'K,'W> = Map<'K,'W>`, `Zero` pruned | the free `'W`-module on `'K` — canonical form |
| **the quotient map** | `WSet.consolidate` | group by key, sum, drop zeros, ordinal sort |

The congruence generated is: commutativity of the list, merging same-key entries, deleting zero-weight entries. Measured over all lists of length ≤ 3 over `'K = {x,y}`, `'W = {−1,0,1}` (259 lists):

```
congruence violations (well-definedness on classes) : 0        <- the quotient exists
idempotent (consolidate ∘ consolidate = consolidate) : yes     <- canonical form
image / codomain                                     : 25 / 25 <- junk = 0, SURJECTIVE
largest fibre                                        : 43      <- 5.426 bits erased
injective                                            : no
```

**So inside `WSet`, semantics IS exactly a quotient of syntax** — no junk, a canonical section (the consolidated form itself), nontrivial kernel. This is the positive control, and it is the cleanest instance of the claim anywhere in the repo.

The header of `WSet.fs` already says the operative half without drawing the conclusion: *"THIS is where interference/retraction happens … it is non-injective … so it — not `negate` — is where the Landauer floor binds."* Restated: **`consolidate` is the quotient map, and the Landauer floor binds on the quotient, never on the free layer.** `negate` is a bijection and therefore Landauer-free (Bennett 1973) — which is the same sentence as "the retraction stays inside the free object."

**The negative control, from work-item `081M0QRPY6W087G0R001K4TE3M` (which does answer half of this).** The `Gaussian → WeightedSet<NatCoord,ℝ>` natural-parameter embedding is the **opposite defect**, and the pair is what makes this more than a resemblance:

| | `consolidate` | natural-parameter embedding |
|---|---|---|
| shape | **epi** | **split mono** |
| injective | no (5.426 bits erased) | **yes (0 bits)** |
| junk | **0** | **> 0** (proper Gaussians are the half-space `τ > 0`; the carrier is all of ℝ²) |
| is a quotient | **yes** | **no** |
| homoiconic | yes (canonical form) | yes (in the other direction) |

Measured in §3 of the test file. That work-item explicitly scopes out *"anything called a dual BNN"* — correctly, and this document does not change its scope. What it adds is the reason the two items belong to one picture.

---

## 8. What the dual BNN concretely is — deliverable 2

**It is the epi–mono factorisation of the semantics map, and the repo ships one carrier per half.** Not two networks; not two lanes over one object; two *halves of one factorisation*, which are dual in the exact categorical sense — a retraction and a section.

| | **lane F** (free / mono half) | **lane Q** (quotient / epi half) |
|---|---|---|
| carrier in-tree | `WSet` (list, unconsolidated) | `WeightedSet` (Map, canonical) |
| the map | `quote` / embed — a **section** | `consolidate` / interpret — a **retraction** |
| exactness | **exact** (injective, 0 bits) | **lossy**, and the loss is a measured number of bits |
| defect | **junk** (reaches states the model forbids) | **confusion** (distinct syntaxes collapse) |
| in the BNN | natural-parameter embedding: conjugate fusion is `⊕`, `O(dim)`, no truncation | discretisation / marginalisation / measurement; error is rate–distortion |
| thermodynamics | Landauer-free (bijection, Bennett 1973) | pays the Landauer floor — the repo already meters it |
| what to learn | nothing structural; only the weights | the context-dependent correction |

**And the crossing has a dichotomy with no third option, from initiality alone.** Initiality says the homomorphism `T_Σ → A` is *unique*. Therefore a context-aware scorer that disagrees with the compositional fold **is provably not a Σ-homomorphism** — it is a theorem, not a preference. So exactly two cases:

1. **It IS a homomorphism into some algebra `A′`.** Then by uniqueness it *is* the free fold over `A′` — context has been absorbed into the signature (state-splitting / parent annotation; Johnson 1998, Klein & Manning 2003, Petrov & Klein 2007). **The "dual" collapses**: lane Q was lane F over a refined `'K`, which is exactly the 2026-08-23 finding that the `'K`/`'W` split is not a partition.
2. **It is not a homomorphism at all.** Then it is a **fitted approximation**. Its error is measurable but not structural, and there is no exact transfer to be had.

Measured, both branches, §5 of the test file: a parent-conditioned fold disagrees with the free fold on the trees swept (case 2 exhibited); and the parent-annotated refinement reproduces every one of its values to 1e−12 (case 1 exhibited, absorption exact).

**So: the dual BNN is well-posed only in branch 2, and branch 2 is provably lossy.** Any *bounded* context is absorbable into `'K` and collapses to branch 1; only genuinely unbounded context survives as a second object, and unbounded context is the hierarchy jump the previous section said weights cannot make. That is the sharp answer, and it is a narrower and more useful claim than "there are two BNNs."

---

## 9. The closure question, narrowed — and my own earlier overstatement withdrawn

The coordinator's mid-task reframe asked: **is the homoiconic regime closed under the operations the substrate needs?** — and handed me the adinkra datum as evidence it is not. Then Aaron corrected the framing (*"both adinkras can be true at once, many can"*), and the correction is right. Both are recorded, with their paths, because the difference is information.

**What is true, measured.** `AdinkraCode.fs` reaches E₈ by Construction A over the `[8,4]` doubly-even self-dual code. A coded adinkra's vertex set is `F₂^N / C`, so the collapse is exactly `dim C` bits. Swept over the chain `C₀ ⊂ C₁ ⊂ C₂ ⊂ C₃ ⊂ C₄` inside the extended Hamming code:

| k = dim C | \|C\| | min distance d | vertices | fibre | bits (fibre side) | bits (structure side) | doubly-even |
|---|---|---|---|---|---|---|---|
| 0 | 1 | ∞ (no protection) | 256 | 1 | **0** | **0** | yes |
| 1 | 2 | 8 | 128 | 2 | **1** | **1** | yes |
| 2 | 4 | 4 | 64 | 4 | **2** | **2** | yes |
| 3 | 8 | 4 | 32 | 8 | **3** | **3** | yes |
| 4 | 16 | 4 | 16 | 16 | **4** | **4** | yes |

At `k = 4` the code is verified doubly-even, self-dual, `d = 4` — the `[8,4,4]` extended Hamming code, the one adinkras require (Doran, Faux, Gates, Hübsch, Iga & Landweber).

**The falsifier is the last two columns.** `bits erased` is computed *twice by independent routes* — once as `log₂` of the measured largest fibre of the vertex quotient, once as `dim C` from the code's structure — and the test requires equality at every `k`. **If they ever disagreed, "homoiconicity deficit = dim C" would be numerology.** The probe also refuses a ragged fibre (returns `−1`), which would refute the "it is a subgroup quotient" reading directly.

**What is NOT true, and this was mine, not Aaron's.** I was handed this as a trade — homoiconicity *or* protection — and passed it along as "the regime is demonstrably not closed." That overstates it, for a reason that is in the same file I was quoting from, `src/Core/CliffordPeriodicity.fs:179`:

> *"`AdinkraCode.fs` reaches E8 by Construction A over the `[8,4]` code — which costs homoiconicity … **The bivector route quotients nothing.**"*

`e₈ = so(16) ⊕ Δ⁺₁₆`, `120 + 128 = 248`, reached with **no code at all**. So there are two documented routes to E₈ coexisting in-tree, and — as that file is careful to say — they do not produce the same *object*: Construction A yields the E₈ **lattice**, the bivector route the E₈ **Lie algebra**. Two faces, two paths, both held.

**Therefore the substrate-level property is not closure. It is COVERING:**

> A single representation is closed under the operations that preserve what *it* preserves — no more. The substrate is adequate when, for every operation it needs, **some** representation in the family supports it. Closure is a property of a route; covering is a property of a family.

That is the Multi-Oracle Principle (§11) at the representation level, and it is `dv2`'s raw vault verbatim: **one version of the facts, many of the truth.** The cost is not eliminated, it is **relocated** — from "lose homoiconicity" to "hold N representations and keep them reconcilable." Which is the next section, and it turns out to be the good news.

---

## 10. Why plurality over one free object is FREE — the congruence lattice

Aaron: *"both adinkras can be true at once, many can."* The formal content, and it is a theorem rather than a slogan:

> **The congruences of a fixed algebra form a complete lattice `Con(T)` (Birkhoff 1935).** Any two congruences `≡₁`, `≡₂` have a meet `≡₁ ∧ ≡₂`, and **both quotients factor through `T/(≡₁ ∧ ≡₂)`**.

So for any family of representations that are all quotients of **one shared free object**, the reconciling span *always exists* — you never have to choose, and you never have to merge. Measured over the same tree grammar with two genuinely incomparable congruences (leaf-count and depth, both verified to be actual congruences for `S → S S`, not merely functions):

```
classes(by leaf count)     : 6
classes(by depth)          : 6
classes(meet)              : 10        <- strictly finer than either: neither refines the other
by-leaf-count factors thru : true
by-depth factors thru      : true
meet is exactly the join   : true      <- the meet loses nothing either representation kept
non-congruence control     : 286 violations   <- the check is not vacuous
```

The negative control matters: a deliberately non-well-defined labelling produces 286 violations, so `isCongruenceForBinaryOp` returning 0 is a measurement and not a tautology.

Three consequences, and they are the real payoff of this document:

1. **Reintegration is not reconvergence, mechanically.** `anti-babel-preserve-reconcilability.md` asks that both branches be held with their paths recorded. The lattice meet *is* that construction: the span exists, both projections survive, nothing collapses to one value.
2. **Babel is impossible inside the regime.** As long as every representation is a quotient of the shared free object, any two are reconcilable by construction — the anti-Babel rule's falsifier (*can a diverged peer reconstruct your meaning from shared anchors?*) is answered "yes, through the meet," without needing anyone's cooperation.
3. **Junk is exactly the Babel condition.** A representation that is *not* a quotient of `T` has values with no preimage in `T`. No span through `T` can cover them. **That is when divergence stops being reconcilable** — and it is precisely the property homoiconicity guarantees against.

> **So the reason to self-select into the homoiconic regime is not elegance and not even correctness. It is that no-junk is the exact condition under which unlimited plurality of representation costs nothing in reconcilability.** That is a design invariant with teeth, and it is the strongest thing in this document.

---

## 11. The representation table — what each preserves, what it costs, what it can transfer

Per the coordinator's ask: a table, not a verdict. Rows are representations actually in-tree or directly adjacent.

| representation | shape of the map | preserves | costs | bits | can transfer to |
|---|---|---|---|---|---|
| `WSet` list (unconsolidated) | the free object itself | everything — order, multiplicity, provenance | unbounded size; no canonical form | — | anything below it |
| `WeightedSet` (consolidated) | **epi**, split | the `'W`-module structure; `⊕` exactly | order, multiplicity, which addends produced a weight | 5.426 measured on the sweep | any further quotient |
| natural-parameter embedding | **split mono** | conjugate fusion exactly (`⊕`, `O(dim)`), full support of ℝ | **junk** (carrier admits improper states); no `⊗` meaning | 0 | back to `Gaussian` exactly; **not** to a grid |
| discretised grid | **epi**, non-split | arbitrary posterior shapes | tails truncated (unbounded error), grid chosen before data | rate–distortion | anything, approximately |
| uncoded adinkra (`C = 0`) | identity on vertices | **homoiconicity**, full `2^N` vertex module | no error protection | 0 | the bivector route to E₈ (Lie algebra) |
| coded adinkra (`[8,4,4]`) | quotient by `C` | error protection, `d = 4` | homoiconicity | **exactly 4** | Construction A to E₈ (lattice) |
| state-split grammar | refinement of `'K` | context-awareness *inside* a `'W`-linear fold | alphabet blowup; still a CFG | 0 (it is a refinement) | any weighted-CFG algorithm unchanged |
| context-conditioned `'W` | not a homomorphism | arbitrary context | DBSP incrementality; `'W`-linearity of the loop | not defined | nothing exactly — fitted only |

**Monodromy note.** Rows 5 and 6 reach "E₈" by different paths and arrive at different faces. Per `docs/research/2026-08-20-harmonious-division-*` §monodromy, that persistent difference is load-bearing information about the two paths, not an error to resolve. It is recorded with both paths and neither is preferred here.

---

## 12. The cardinality/loss frame — carrying the corrected version, and sharpening it once more

Aaron's correction to the brief was right and is carried: *"there are other countable to uncountable conversions and vice versa that exist in the lossy regime."* Same cardinality ⇒ a bijection exists; different cardinality ⇒ no bijection, but well-characterised lossy maps do exist — space-filling curves (Peano 1890, Hilbert 1891) and, above all, discretisation, whose mathematics is rate–distortion (Shannon 1959).

**One sharpening this document forces, and it cuts against the framing I inherited too:**

> **Cardinality is the wrong invariant at every level above bare sets.** ℝ and ℝ² have the same cardinality and admit a bijection — and **no continuous one** (Brouwer's invariance of domain, 1911). A bijection of sets preserves nothing. "Same cardinality ⇒ exact transfer" is false the moment any structure is in play, which is always.

The right ladder, and it is the factorisation of §2 read as a hierarchy:

| relation | what transfers | our instances |
|---|---|---|
| same cardinality | **nothing** | a false comfort; exclude it |
| **isomorphism** in the relevant category | everything, exactly | `Gaussian ↔ WeightedSet<NatCoord,ℝ>` (as ℝ-modules) |
| **split mono** (section) | the source, recoverably; adds junk | natural-parameter embedding; ECC encoding |
| **epi** (retraction) | the quotient structure; erases the kernel | `consolidate`; parsing; measurement; Construction A |
| **neither** — fitted | nothing structural; error measurable, not bounded | context-conditioned weights; learned representations |

Learned representations land in the last row essentially always, and the honest consequence is that a "dual BNN" whose crossing is a learned map has **no structural guarantee at all** — only an error you can measure after the fact. That is not a reason not to build it. It is a reason to name which row it is in before claiming what it transfers.

---

## 13. Falsifiers — deliverable 4, one per claim

| claim | falsifier | status |
|---|---|---|
| semantics is a quotient iff no junk | exhibit a surjective semantics that is not a quotient, or a non-surjective one that is | **metered** — `factorise` computes `junk` and `isQuotient` separately over exhaustive sweeps; both polarities exhibited (yield into `Σ*` vs into `L`) |
| ambiguity is the kernel; fibres are Catalan **by structure** | fibre sizes deviating from the grammar's own self-convolution | **metered** — asserted against `catalanBySelfConvolution`, not a table |
| `consolidate` is a quotient map | any pair `(a,b)` where `consolidate(a++b)` depends on more than the classes of `a`,`b` | **metered** — 0 violations over 259 sets; a deliberate non-congruence yields 286 |
| homoiconicity deficit = `dim C` | fibre-side `log₂` and structure-side `dim C` disagreeing at any `k`, or a ragged fibre | **metered** — equality required at `k = 0..4`; ragged fibre returns `−1` |
| the initiality dichotomy | a context-aware fold that neither disagrees with the free fold nor is reproduced by a refinement | **metered** — both branches exhibited; absorption exact to 1e−12 |
| plurality always reconciles through the meet | two congruences of one algebra whose quotients do not both factor through their meet | **metered** — `aFactorsThroughMeet`/`bFactorsThroughMeet`/`meetIsExactlyTheJoin`, with a negative control |
| **the literature anchors** (Plotkin, Milner, AJM/HO, Kuroda, Post/Markov, Newman, Knuth–Bendix, Birkhoff, GTWW) | opening a paper and finding it does not support the attached claim | **NOT CHECKED — `toy`.** Cited from standing knowledge; none opened this session. |
| "Zeta's representations stay in the no-junk regime" | any in-tree representation with junk that is nonetheless treated as a quotient | **`unmetered`.** No sweep of the tree was performed. This is a design invariant, not a measurement. |

The last two rows are the honest limits. Per `toy-is-free-metered-must-be-earned.md`, unlabelled work is `unmetered`, never "real" by default; the first six rows earned `metered` and the last two did not.

**Numerology self-audit, because the density of agreement here is itself a warning.** Five vocabularies line up — free/quotient, syntax/semantics, homoiconic/coded, injective/erasing, Landauer-free/Landauer-paying. That looks like five confirmations and it is **not**: all five are the single predicate *"is this map injective?"* restated. One thing, five costumes. `numerology-vs-number-theory.md` asks whether these are separate confirmations or one thing wearing several — and the answer is the latter, said plainly. What is *not* a restatement, and is the only thing here that could have failed, is the **quantitative** agreement: the same bit-count arrived at from the fibre side and from the code side. That is the one place two independent routes could have disagreed, so that is where the falsifier was put.

---

## 14. What is new here, and what is not

**Not new** (do not re-derive): CFG ≡ initial algebra of the production functor (`docs/VISION.md:1776`); the `'K`/`'W` split refuted as a syntax/semantics partition, and state-splitting as the counterexample (2026-08-23 §3.2); the `Gaussian → WeightedSet` homomorphism with its four honest limits (2026-08-23 §2, work-item `081M0QRPY6W087G0R001K4TE3M`); `Sppf` being single-oracle and not semiring-generic (2026-08-23 §4); the adinkra homoiconicity comment (`CliffordPeriodicity.fs:179`).

**New in this document:**

1. **Homoiconicity = the no-junk condition** — the claim's missing hypothesis, named, with the reason the self-selection is well-founded rather than aspirational.
2. **The three-arrow factorisation** as the correct replacement for "syntax free / semantics quotient", with both defects (junk, confusion) separated and measured independently.
3. **`WSet` list / `WeightedSet` Map = free / quotient, `consolidate` = the quotient map** — the connection Aaron asked for, requiring no new type, with the congruence verified rather than assumed.
4. **The initiality dichotomy** — a two-branch theorem, not a design preference, with both branches exhibited numerically.
5. **The adinkra price, computed two independent ways and required to agree** — turning an in-tree qualitative comment into a metered quantity with a falsifier.
6. **Closure → covering**, and **plurality-is-free via `Con(T)`** — with junk identified as the exact Babel condition. This is the reframe the thread asked for, and it is a better answer than the question presupposed.
7. **Two corrections to the setup itself**: the algebra-level vs string-level quotient conflation (§6), and cardinality being the wrong invariant above bare sets (§12).

---

## 15. Anchors (Beacon)

**Checked** — files read in this worktree at `da6f3ccc02`:

- `src/Core/WSet.fs` — the free layer, `consolidate`'s non-injectivity, the Landauer honesty note, `negate` as bijection.
- `src/Core/WeightedSet.fs` — the quotient layer; `Zero` pruning is what makes the identity map to the identity.
- `src/Core/CliffordPeriodicity.fs:150–205` — the two routes to E₈; *"the bivector route quotients nothing."*
- `tests/Tests.FSharp/Formal/WSet.ErasureClassification.Laws.Tests.fs:44,99–105` — `bits erased = log2(largest fibre)`; the metric this document reuses.
- `docs/VISION.md:1776` — CFG as initial algebra.
- `docs/research/2026-08-23-what-discretisation-costs-the-bnn-lane-*.md` §2–§4 — the natural-parameter embedding and the `'K`/`'W` refutation.
- `workitems/081M0QRPY6W087G0R001K4TE3M-*.md` — the adjacent milestone; scopes out the dual BNN, correctly.
- `src/Core.Lean4/Gen/HomoiconicFixpoint.lean:20` — McCarthy's `eval ∘ quote = id`, already in the tree.

**Cited, NOT page-checked** (recorded from standing knowledge; `missing-citations` is the skill that would close this):

- Goguen, Thatcher, Wagner & Wright (1977), *Initial Algebra Semantics and Continuous Algebras* — the unique-homomorphism account of semantics.
- Birkhoff (1935), *On the Structure of Abstract Algebras*; Burris & Sankappanavar (1981), *A Course in Universal Algebra*, Thm 6.12 — homomorphism theorem, congruence lattice.
- Plotkin (1977), *LCF Considered as a Programming Language* — `parallel-or` as junk; failure of full abstraction.
- Milner (1977), *Fully Abstract Models of Typed λ-Calculi*.
- Abramsky, Jagadeesan & Malacaria (2000); Hyland & Ong (2000) — full abstraction for PCF by intrinsic quotient plus definability.
- Post (1947); Markov (1947) — undecidability of the word problem for semigroups. Novikov (1955); Boone (1958) — for groups.
- Newman (1942) — local confluence + termination ⇒ unique normal forms. Knuth & Bendix (1970) — completion.
- Kuroda (1964) — CSL = NLBA; monotone grammars.
- Chomsky (1956); Backus (1959) / Naur (1960) — the hierarchy and BNF.
- Johnson (1998); Klein & Manning (2003); Petrov & Klein (2007) — parent annotation / latent state-splitting.
- Doran, Faux, Gates, Hübsch, Iga & Landweber (2008) — adinkras and doubly-even self-dual codes.
- Landauer (1961); Bennett (1973) — erasure costs, bijections do not.
- Brouwer (1911) — invariance of domain. Peano (1890); Hilbert (1891) — space-filling curves. Shannon (1959) — rate–distortion.
- McCarthy (1960) — Lisp; homoiconicity as `eval ∘ quote = id`.
- Aji & McEliece (2000) — the Generalized Distributive Law (already quoted verbatim in `WSet.fs`).

---

## 16. Governing rules, and the lint status of this file

- `anchor-to-human-prior-art.md` — anchors split into **checked** and **cited-not-checked** above, explicitly. The unchecked half is a debt, named as one.
- `numerology-vs-number-theory.md` — the Catalan identification is by self-convolution (structure), not by count; the five-vocabulary agreement is audited in §13 and reported as **one predicate in five costumes**, not five confirmations.
- `toy-is-free-metered-must-be-earned.md` — six claims `metered`, two explicitly not; the design invariant is labelled as maintained-by-construction, not as a fact.
- `dv2-data-split-discipline-activated.md` (raw vault) + `anti-babel-preserve-reconcilability.md` — §10 is these two rules given a mechanism (the lattice meet) rather than a hope.
- `mirror-beacon-register-discipline.md` — Mirror terms (`consolidate`, WSet, adinkra) each compressed to a Beacon anchor in §15.
- `no-directives.md` — Aaron's two mid-thread inputs are recorded as observations that changed the question, with attribution and dates.

**Lint status, stated because rc = 0 here would be a check that did not run.** `docs/research/2026-*` is **excluded** from the markdownlint profile, so this file is **not** markdown-linted and no green result should be quoted for it. What *was* run and is real:

```
bun test src/Core.TypeScript/research/free-quotient-semantics-closure.test.ts
  -> 17 pass, 0 fail, 368 expect() calls

bunx tsc --noEmit -p tsconfig.json
  -> 2 errors, both in src/Core.TypeScript/observe/model-benchmark-scale.ts
     (pre-existing on main, being fixed in #15434); 0 from either file added here.
```

The `tsc` control is stated the way the brief demanded: the failure was present before this branch existed and is attributed accordingly, not to this work.
