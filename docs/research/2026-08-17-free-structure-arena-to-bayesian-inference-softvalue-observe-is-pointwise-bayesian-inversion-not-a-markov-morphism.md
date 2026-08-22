# The free-structure arena ↔ Bayesian inference — where the correspondence holds, and the three places it stops

**Date:** 2026-08-17
**Work item:** `081M08XGHW7087G0R0028G3WBQ`
**Author:** the shadow (Otto). Ask from Aaron, relayed: *"lets start a dispatch/routing on the connection — this is our bayesian inference and BNN, i'm trying to make this connection to state of the art AI before LLMs"*, extended with *"this is the category theory upgrade i'm going for across ANTLR space, over all computer language and english, to expand it into natural language."*
**Register:** the mapping below is `metered` where a test is named, `unmetered` where code exists with no falsifier, `toy` where a model names a theory it does not implement. Every row says which.

**Code shipped:** one test file — `tests/Tests.FSharp/Formal/SoftValue.BayesianInversion.Laws.Tests.fs` (7 tests). No production code changed. Mutation-checked (below).

---

## 0. The one-line result

> **`SoftValue.observe` IS Bayesian inversion — pointwise, exactly, and constructively. It is NOT a morphism of a Markov category, and the reason is the repo's own honesty guard: Markov categories are semicartesian (unit terminal ⇒ every morphism total), and `observe` is partial by design. SoftValue therefore sits in the CD / copy-discard stratum, one rung below Markov — which is exactly where the in-repo hexagon table already puts every non-normalized corner. The placement is a result, not a gap.**

And the peel that came with it:

> **§A row 7 reads "observe commutes for independent evidence". Measured: the commutation is UNCONDITIONAL — it holds for explicitly dependent likelihoods, because the operation is pointwise multiplication of reals and nothing else. "Independent" is a precondition on the CALLER that buys *correctness*, not *commutation*, and nothing in the type, the code, or the five pre-existing SoftValue test files can detect its violation.**

---

## 1. What `src/Bayesian/` actually contains — metered vs unmetered vs toy

45 modules, 45 test files. **It is not declaration-only**: nearly every module has a test file, and the tests mostly exercise real arithmetic. But *tested* ≠ *metered*. Under `.claude/rules/toy-is-free-metered-must-be-earned.md` a falsifier is a test that fails **when the model is wrong**, not one that fails when the code is mistyped. Sampled honestly:

| module | status | why |
|---|---|---|
| `CondorcetBoundary.fs` | **metered** | §A row 15. `ρ*(N) = (N−3)/(3(N−1)) → 1/3` is derived and pinned; 15 tests. |
| `LagrangeCondorcet.fs` | **metered** | the rule's own worked example: μ_crit is Routh's classical constant, pinned at 25.96 ≈ 1/μ_crit. |
| `Ep.fs`, `FactorGraph.fs`, `Message.fs` | **unmetered, correctly** | exponential-family message algebra (Minka 2001 / Infer.NET lineage). Laws are checked; nothing is claimed about reality. This is the honest middle state and it is the right one. |
| `MinimalBnn.fs` | **unmetered**, and says so | header is explicit: *"not a transformer; not gradient-trained weights"*. Refreshingly non-overclaiming. |
| `ReportTriage.fs`, `MeshLatencyModel.fs`, `ReticulumBusMeter.fs` | **self-labelled** `toy`/`unmetered` in their own headers | the discipline working. |
| **`ThousandBrains.fs`** | **`toy`, and currently mislabelled** | see below — this is a finding. |

### 1a. `ThousandBrains.fs` names a theory it does not implement

Its header says *"Implements the Thousand Brains theory of intelligence (Hawkins)"* and *"this maps perfectly"*. What the 99 lines contain:

- `Column` = **one scalar Gaussian** + an IV accumulator.
- `observe` = Gaussian product (precision-weighted fusion).
- `castVote` = weight `log(1 + IV)`.
- `computeConsensus` = weighted sum of natural parameters.

Hawkins's central claim is that each cortical column learns **complete models of objects in its own reference frame** — a grid-cell-like location signal, and object models as (feature, location) pairs. **The reference frame is the theory.** There is no reference frame, no location signal, no feature-at-location model and no object model here. What is implemented is the *voting* element only, over a scalar.

Two further register errors in the same header:

1. *"Voting is lateral EP message passing between columns"* — it is not. There is no iteration, no cavity distribution, no moment matching. `computeConsensus` is a **logarithmic opinion pool** (anchor: Genest & Zidek 1986 — *not opened*), computed once.
2. `TB-6` ("consensus precision is strictly non-negative") is near-vacuous: the generator applies `abs` to both factors, so it is a sum of non-negative products. It cannot fail.

**Honest restatement it should carry:** *an IV-weighted logarithmic opinion pool over scalar Gaussians, taking the voting element of Hawkins's Thousand Brains as inspiration; the reference-frame content of the theory is not implemented.* Recommendation, not shipped — it is a docstring change on a file I was not sent to edit, and it belongs with whoever owns the Thousand Brains lane.

### 1b. And there is a real structural echo worth recording

`ThousandBrains.computeConsensus` multiplies **beliefs**, not messages. That is correct exactly when the columns' evidence is independent, and it silently double-counts when it is not — **the same defect, in the same shape, as `SoftValue.combine`'s non-idempotence** (already found and documented, 2026-08-11, in `SoftValue.Tests.fs`). Two surfaces, one failure mode: *the product-of-likelihoods pooling operator is correct under independence and silently wrong under duplication or correlation, and neither surface can tell the difference.* Recorded as a **verified structural match**, not a coincidence — both are literally pointwise products of unnormalized weights.

---

## 2. The mapping, role by role

The arena rule (`only-the-irreducible-is-primitive-generate-the-rest.md`) says: the free object is primitive; every structured special case is an **earned quotient obtained by declaring its relations**. Testing that against the probabilistic side:

| role | what plays it | status |
|---|---|---|
| **the arena** | symmetric monoidal categories **presented by generators and relations** | `unmetered` — genuine, but weaker than "one free object" |
| **the free object** | the free CD-category on a signature (copy + discard, no naturality assumed) | `unmetered`; not constructed in-tree |
| **"declaring relations" = the earned quotient** | **comonoid naturality**, added one axiom at a time | **`metered` over ℤ** — `Formal/WSet.Comonoid.Laws.Tests.fs` |
| **the quotients themselves** | CD (`ZSet`) → Markov (normalized ℝ≥0) → cartesian (`arr f`); plus ℂ (no copy) and Boolean (`GSet`) | `metered` for ℤ and the Fox discriminator; **the normalized ℝ≥0 corner is NOT instantiated** |
| **where Bayesian inference sits** | **not a quotient at all** — it is an *operation on states* within a corner: given a prior state and a channel, invert | this is the load-bearing correction, §3 |
| **the trace** | `FourCornerTrace` / ZSet retraction (Joyal–Street–Verity 1996) | `unmetered`; owned by the sibling branch, not touched |

**The correction that matters.** Bayesian inference is *not* an earned quotient of the free object. Quotients move you between **corners** (CD → Markov → cartesian). Bayesian inversion moves you between **states and channels inside one corner** — it is a dagger-like operation relative to a chosen prior, not a relation you declare. Reading the arena rule as covering it would be the categorical-vocabulary-as-prose failure the brief warned about. **The arena rule stratifies the ambient category; Bayes operates inside a stratum.** Both are real; they are perpendicular.

This is also why the 2026-08-01 hexagon doc's deferred question ("is `SoftValue` the third corner?") had no clean answer: **`SoftValue` is not a corner. It is the state-and-update layer of the normalized ℝ≥0 corner** — the one corner `WSet.Comonoid.Laws.Tests.fs` left uninstantiated.

---

## 3. The falsifier: does `SoftValue.observe` satisfy the Markov-category conditions?

Shipped as `tests/Tests.FSharp/Formal/SoftValue.BayesianInversion.Laws.Tests.fs`. Seven tests, all passing, **all killed by mutation** (§5).

### 3a. YES to Bayesian inversion — exactly, and in both directions

Setting: finite `X` (candidates), finite `Y` (outcomes), prior `p`, channel `f : X → DY`. The defining condition (Cho–Jacobs form) is that the joint factors both ways:

```
q(y) · f†_p(x|y)  =  p(x) · f(y|x)        for all x, y,   where q(y) = Σ_x p(x)·f(y|x)
```

- **BI-1** — property test over random priors and random row-stochastic channels: for **every** `y`, `SV.observe (λx. f(y|x)) p` agrees with a reference inverse computed **from the joint alone**, in a helper written without touching `SoftValue`. It agrees including on *whether the answer exists*.
- **BI-2** — the defining equation checked **directly on `observe`'s own output**, rather than by comparing formulas. This cannot be satisfied by a coincidence of normalisation.
- **BI-3** — the converse, which is the half that is easy to assume. `observe`'s argument type admits *any* non-negative function, so it looks strictly more general than inversion. It is not: on finite support every such `ℓ` with `M = max ℓ > 0` is the fibre of an explicitly constructible **binary** channel `g(y₀|x) = ℓ(x)/M`, `g(y₁|x) = 1 − ℓ(x)/M`, and `observe` is scale-invariant. So no admissible likelihood escapes the correspondence. **`observe` is exactly pointwise Bayesian inversion — no more, no less.**

### 3b. The `None` lands exactly on the literature's own indeterminacy

- **UN-1** — where `q(y) = 0` the defining equation degenerates to `0 = 0` and constrains nothing. The test **exhibits two distinct distributions that both satisfy it**, so any returned value would be fabricated. `observe` returning `None` is the only non-fabricating answer.

This is the nicest thing in the whole map: SoftValue's calibration guard — written for honesty reasons, from the three-valued-logic lineage — **coincides with the point at which the Bayesian inverse is genuinely not determined**. That was not designed in. It is a fit.

*(Recall, flagged: Fritz states uniqueness of Bayesian inverses only up to almost-sure equality. I did **not** open that part of the paper — see §6. The `q(y) = 0` set is the null set in the finite-discrete case, so the correspondence is what one would expect, but I am reporting it as **consistent with** the a.s.-uniqueness statement, not as a check of it.)*

### 3c. NO to being a Markov-category morphism — and this is the finding

A Markov category (Fritz 2020, Def. 2.1; nLab: *"semicartesian* symmetric monoidal category which supplies cocommutative comonoids") has a **terminal monoidal unit**. Terminality forces every morphism to be **total** — there is no sub-normalized or absent state to land in.

`observe : (DynamicValue → float) → SoftValue → SoftValue option` is **partial**, and **MC-1** shows the partiality is intrinsic rather than an artefact of admitting arbitrary functions: it is reached from an ordinary row-stochastic channel at an unreachable outcome, not only from a hand-written zero likelihood.

So:

> **SoftValue's honesty guard is precisely the axiom a Markov category does not have.**

MC-1 also records the contrast that makes the stratification legible: **`bind` is total** (returns `SoftValue`, never an option). One module, two strata — `bind` is the Markov-shaped Kleisli/channel composition; `observe` is the CD/effectus-shaped conditioning. That is not an inconsistency; it is the correct home for each.

Two further honest limits on "SoftValue is a Markov category", neither of which the code currently supports:

1. **No channel type.** Kleisli arrows `DynamicValue → SoftValue` exist implicitly via `bind`, but there is no `Kernel<X,Y>`, no `tensor`, no `copy`, no `discard` in the module, and `X = Y = DynamicValue` throughout. The *category* is not expressed, only the monad.
2. **Bayesian inversion produces a channel `Y → X`; `observe` only ever gives its value at one point.** To have `f†_p` you must range over `Y`, and SoftValue's API has no `Y`.

### 3d. The peel on §A row 7

The existing headline property in `SoftValue.Tests.fs` fixes two likelihoods that happen to be independent and varies **only the prior** — which cannot distinguish "commutes because independent" from "commutes always".

- **IND-1** — two manifestly **dependent** likelihoods (`l2` is built as a function of `l1`). `observe` commutes anyway. **Commutation never needed independence.**
- **IND-2** — what independence actually buys. A joint channel `P(y,z|x)` that is not a product given `x`; folding the two **marginal** likelihoods (the only thing `observe`'s type invites a caller to pass) gives an answer differing from the true posterior by more than 0.05 in total-variation terms on the constructed case. The fold still commutes. It is simply **wrong**. The sanity half is asserted too: one `observe` with the true *joint* likelihood reproduces the true posterior exactly — so `observe` is not broken; the caller's independence assumption is.

**Proposed §A row 7 restatement** (recommendation — I did not edit `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`; a §A row is a gated surface):

> `observe` commutes **unconditionally** (pointwise multiplication of reals). It is **pointwise Bayesian inversion**, exactly, with `None` on the zero-marginal set where the inverse is undetermined. **Conditional independence is a precondition on the caller** for the multi-step fold to equal the true posterior; it is unchecked and uncheckable at this type.

That is a *stronger* proven statement than the current wording plus an honestly-named unproven precondition — the trade the register discipline asks for.

---

## 4. The ANTLR / natural-language half

### 4a. Does CFG-as-initial-algebra fit the arena rule as stated? **Partly — and the mismatch is the useful part.**

A context-free grammar's derivation trees form the **initial algebra of the polynomial functor built from its productions** — equivalently the free term algebra on the signature whose operations are the productions (anchor: Goguen, Thatcher, Wagner & Wright 1977, *Initial Algebra Semantics and Continuous Algebras* — **not opened**). That much is genuine, standard, and checkable.

But the arena rule's quotient direction **does not transfer**:

- The rule says structured special cases are **quotients of one free object by declared relations**.
- Different grammars are **different signatures ⇒ different free algebras**, not quotients of a common one. Quotienting a free term algebra by equations gives an **equational theory** (a Lawvere theory), which is not another grammar.

So *"all computer languages are quotients of one free object"* is **not exhibited and I do not believe it is true as stated.** What is true: every grammar is a free object *on its own signature*, and the common structure lives at the level of the **functor/signature**, not the algebra. Stating it the second way costs nothing and is defensible.

The level at which the unification *does* work is Lambek's: a grammar as **a monoidal category presented by generators and relations**. Lambek's syntactic calculus (1958) is a biclosed monoidal category; pregroups (1999) are compact closed; Coecke–Sadrzadeh–Clark (2010) lift pregroup type reductions to morphisms and compose them with vector-space meaning. **That is the same arena as the Markov/CD hexagon** — both are monoidal categories presented by generators and relations, both stratified by which structural maps they admit. That is a real, non-trivial common home, and it is *much weaker* than "one structure". Say the weak thing.

### 4b. `Sppf` has real consumers — and the `Zeta.Bayesian` link is dependency-blocked

**Consumers are real** (`unmetered`): `src/Core/PcfgEm.fs` (EM over grammars), `src/Core/ParseSoft.fs` (`ofSppf` → `SoftValue`), plus `Sppf.Tests.fs`, `ParseSoft.Tests.fs`, `PcfgEm.Tests.fs`. Not declaration-only.

**But its own header's forward link is not merely unbuilt — it is currently un-buildable.** `Sppf.fs` says the ambiguity nodes are *"the factor-graph variables the `Zeta.Bayesian.FactorGraph`/`Ep` inference rung will run BP over"*. Measured:

```
src/Bayesian/Bayesian.fsproj:  <ProjectReference Include="..\Core\Core.fsproj" />
```

**`Zeta.Bayesian` depends on `Zeta.Core`.** So `src/Core/Sppf.fs` cannot consume `Zeta.Bayesian.FactorGraph` without a circular project reference. The stated wiring requires either inverting the dependency, extracting a shared inference package, or moving the consumer up into `Zeta.Bayesian`. Naming that is worth more than the aspiration was.

**And the work was done anyway, in the other direction.** `Sppf` implements its own full **inside–outside** (Baker 1979; Lari–Young 1990 — both cited in the file, **neither opened by me**): `inside`, `outside`, `marginals`, `insideTotal`, `expectedCounts`. Inside–outside on a parse hypergraph **is** sum-product belief propagation. So:

> **The parse forest and the factor graph are the same object over different semirings.** `Sppf.inside` is sum-product over ℝ≥0 on a hypergraph; `FactorGraph`/`Ep` is sum-product over the exponential family on a bipartite graph. The unifier already has a name in this repo — the **Generalized Distributive Law** (Aji–McEliece 2000), which is exactly what `WSet.fs` claims as its organizing principle.

That is the **strongest genuine link between the parsing half and the Bayesian half**, it is in-tree on both sides, and it is *not currently expressed as one thing* — two independent sum-product implementations sit in two projects with no shared abstraction. **This is the concrete instance the arena rule wants, and it is buildable.** It is also the honest answer to "make the connection": the connection is the semiring, not a metaphor.

**Also true and worth saying plainly:** an SPPF retains every valid parse rather than resolving to one. That is disagreement preservation at the parsing layer, and it is *why* the forest is a legitimate inference substrate — you cannot run BP over a structure that already collapsed. The link between the never-collapse discipline and the Bayesian layer is not decorative.

---

## 5. Build, test, mutation — real output

```
dotnet build tests/Tests.FSharp/Tests.FSharp.fsproj -c Release
Build succeeded.
    0 Warning(s)
    0 Error(s)

dotnet test --filter "FullyQualifiedName~SoftValueBayesianInversionLaws"
Passed!  - Failed:     0, Passed:     7, Skipped:     0, Total:     7

dotnet test --filter "FullyQualifiedName~SoftValue"       (whole SoftValue surface)
Passed!  - Failed:     0, Passed:    50, Skipped:     0, Total:    50
```

**Mutation testing — hand-applied to `src/Core/SoftValue.fs`, the module under test, then reverted:**

| mutation | change | pack result |
|---|---|---|
| **M1** — make `observe` **total** (fall back to the prior instead of refusing) — i.e. give it exactly the semicartesian shape the pack claims it lacks | `None → Some sv` | **4 of 7 failed** (BI-1, BI-2, UN-1, MC-1) |
| **M2** — additive instead of multiplicative update | `w * ℓ(d)` → `w + ℓ(d)` | **7 of 7 failed** |

Both reverted; `git diff src/Core/SoftValue.fs` is empty and the suite is green. **No test in the pack survives either mutation of the claim it makes.** M1 is the important one: it is the *exact* counterfactual — "what if SoftValue were Markov-shaped?" — and the pack goes red, which is what makes MC-1 a measurement rather than an assertion.

---

## 6. Citations — opened vs not opened

**Opened (abstract page unless noted):**

- **Fritz (2020)**, *A synthetic approach to Markov kernels, conditional independence and theorems on sufficient statistics* — arXiv abstract **and** Definition 2.1 + the terminal-unit remark via ar5iv HTML. **Not read: the full 98pp**, in particular Fritz's own Bayesian-inverse equation and his almost-sure-uniqueness statement. The defining equation used in the tests is the standard finite-discrete form, derived locally.
- **Cho & Jacobs (2019)**, *Disintegration and Bayesian Inversion via String Diagrams* — abstract only. It confirms the framing ("produce channels, as conditional probabilities, from a joint state, or from an already given channel (in opposite direction)"); it does **not** confirm the CD-category definition I attribute to it, which I am carrying from the in-repo 2026-08-01 doc.
- **nLab, "Markov category"** — gives the definition as a **semicartesian** symmetric monoidal category supplying cocommutative comonoids. This is the source for the terminality claim that MC-1 turns on. Second independent confirmation of the Fritz remark.
- **Coecke, Sadrzadeh & Clark (2010)**, *Mathematical Foundations for a Compositional Distributional Model of Meaning* — abstract only. Confirms: **pregroups** (Lambek), type reductions lifted to morphisms, diagrammatic calculus.
- **Fong, Spivak & Tuyéras (2017/2019)**, *Backprop as Functor* — abstract only. Confirms: gradient descent is a **monoidal functor** from parametrised functions to update rules.
- **Jacobs (2018/2019)**, *The Mathematics of Changing one's Mind, via Jeffrey's or via Pearl's update rule* — abstract only. It does **not** confirm the identification I wanted (Pearl's rule = multiply by likelihood and normalize = `observe`), so that identification is **flagged as recall, unverified**, and nothing in the shipped tests depends on it.

**NOT opened, cited from recall only — do not build on these without checking:**

- Lambek (1958) *The Mathematics of Sentence Structure*; Lambek (1999) pregroups.
- Cruttwell et al., *Categorical Foundations of Gradient-Based Learning*.
- Jacobs & Zanasi, *A predicate/state transformer semantics for Bayesian learning*.
- Goguen–Thatcher–Wagner–Wright (1977), initial algebra semantics.
- Genest & Zidek (1986), logarithmic opinion pools.
- Baker (1979); Lari & Young (1990) — cited **inside `Sppf.fs`**, not by me.
- Aji & McEliece (2000), the Generalized Distributive Law — cited in-repo; I did not open it.
- Hawkins / Numenta Thousand Brains — **not opened**. My §1a claim about reference frames being central to the theory is **recall**, and it is the load-bearing claim of that section. It should be checked before the `ThousandBrains.fs` docstring is rewritten on its authority.

---

## 7. The named gap to the pre-LLM SOTA set

The multi-tower row already cites Hawkins/Numenta, Blum's CTM, Graziano, Global Workspace, IIT/φ, LeCun's JEPA. What is missing to reach that set **from here**, stated so each is a buildable increment rather than an aspiration:

1. **The normalized ℝ≥0 corner is uninstantiated.** `WSet.Comonoid.Laws.Tests.fs` proves the comonoid laws + the Fox discriminator **over ℤ only**. The Markov corner — the one the entire Bayesian half lives in — has no comonoid law pack. **This is the smallest, highest-value next increment**, and this doc's test file is deliberately adjacent to it rather than a substitute for it.
2. **No channel type anywhere.** `SoftValue` has states and Kleisli arrows; `Message`/`FactorGraph` has exponential-family updates. Neither expresses `Kernel<X,Y>` with `tensor`/`copy`/`discard`. Without it, "Bayesian inversion" can only ever be checked *pointwise*, as here. Every one of the SOTA architectures is a *composition of channels*; that is the missing vocabulary.
3. **Two sum-product implementations, no shared abstraction, and a dependency direction that forbids one.** §4b. Until `Sppf`'s inside–outside and `FactorGraph`'s BP are one GDL circuit over a chosen semiring, "the parse forest is the factor graph" stays a true sentence with no code behind it.
4. **No learning functor.** Fong–Spivak–Tuyéras give `Learn` as a monoidal functor from parametrised functions to update rules. Nothing in-tree is a parametrised morphism, so `MultilayerBnn` cannot be *composed* — it can only be *run*. That is the specific reason a BNN here does not yet reach JEPA-shaped territory: JEPA is an architecture of composed predictors.
5. **The reference frame is absent, and it is the load-bearing piece of the nearest SOTA anchor.** §1a. Thousand Brains without location signals is opinion pooling. Closing this is a real research task, not a rename.
6. **No compositional-semantics lane at all.** DisCoCat is the categorical pre-LLM SOTA for natural language and there is nothing in-tree on the pregroup side — `GrammarIr` is BNF, not a type-logical grammar. Aaron's *"expand into natural language"* runs through here, and the honest status is **not started**, not *partially built*.

---

## 8. What in the brief proved false

Reported because it was asked for, and because at least one thing always does:

1. **"Markov categories are the established formal bridge — that is precisely one arena where these can be compared."** Half right. They are the right arena for the *corners*, and the wrong shape for Bayesian inference itself, which is an operation *inside* a corner rather than a quotient between them (§2). The brief's framing would have licensed a category-error I nearly wrote.
2. **"Does `SoftValue.observe` satisfy the Markov-category conditions?"** — the expected answer was the interesting one, and it is **no**, but not for a reason the brief anticipated. It fails on **partiality vs the terminal unit**, i.e. on the honesty guard, not on any probabilistic content. The Bayesian content fits perfectly.
3. **"`src/Bayesian/` — several surfaces in this repo turned out declaration-only when checked."** Not here. 45 modules, 45 test files, real arithmetic throughout. The defect I found is the opposite kind: **`ThousandBrains.fs` is well-tested code under an overclaiming docstring** — the mechanism is real, the theory named is not implemented.
4. **`Sppf`'s "factor-graph prerequisite" framing** (from the extension) — the link is not aspirational-but-open, it is **architecturally blocked** by the project dependency direction (§4b), and separately the inference was already built inside `Sppf` itself. Both halves of that were worth measuring rather than assuming.
5. **CFG-as-initial-algebra "gives you a concrete instance of the arena rather than an aspiration"** — it gives a concrete instance of *free objects*, but **not of the arena rule's quotient structure**, which does not transfer (§4a). The instance the arena rule actually wants is the GDL/semiring one.
6. **My own recall was wrong once, and I am keeping the correction visible:** I expected Jacobs' Pearl-update paper to confirm `observe` = Pearl's rule, and intended to make that the primary anchor. The abstract does not establish it and I did not open the body, so the identification is demoted to flagged recall and nothing depends on it.

---

## 9. Recommendations routed to other branches (not touched here)

- **`clis/`** — owned by `shadow/compile-clis-verbs-surface`. If the verb family is typed as a free structure, note §2: the quotient ladder is comonoid-naturality, and a verb family will sit in the **cartesian** corner (deterministic, copy- and discard-natural) unless verbs carry uncertainty. That is a different corner from `SoftValue`'s, and joining them needs the channel type of gap 2.
- **`FourCorner` / the tick boundary** — owned by `shadow/four-corner-tick-boundary-plan`. `WSet.fs` already records that the **trace requires an additive inverse**, so it instantiates on ℤ and ℂ but **not** on the normalized ℝ≥0 (Markov) corner. Anything that assumes the tick trace works uniformly across corners should read that note first.
- **`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §A row 7** — the restatement in §3d. A §A row is a gated surface; this is a proposal, not an edit.
- **`src/Bayesian/ThousandBrains.fs`** — the docstring correction in §1a, pending a check of the Hawkins claim I am carrying from recall.
