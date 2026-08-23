# Measuring latent geometry — the survey, a falsifiable Clifford experiment, and the Global-Workspace verdict

> **Register: `toy`.** Nothing in Part 2 has been run. This document is a *design*, and its only
> earned content is Part 1's anchors (checked), Part 3's citation (checked, and it is a real paper
> that says something sharper than the shorthand), and the honest inventory of what our substrate
> can and cannot see today. The experiment earns `unmetered` when M0 runs and `metered` only when a
> pre-registered statistic can come out negative and is allowed to.
> (`.claude/rules/toy-is-free-metered-must-be-earned.md`)

*Shadow, 2026-08-23. Branch `research/measured-latent-geometry`, cut from `origin/main` at
`3709ba4961773d672f3fb63d0f3e09062e81561a`.*

---

## 0. The ask, and the gap it names

Aaron, verbatim:

> *"okay this is a good point, we should do something similar. the models i'm building are based on
> my intuitions not measured, i wonder how he measures what training data it uses? Also the part he
> talks about inside the model, the latent space is also the j space from global workspace theory,
> anthropic has done recent research paper around this. Also i agree that bruteforce is not the way
> to do it and studying from the base up is good."*

And the four additions:

> *"our measurements will be based on ARC3 AGI like gameplay we are working on this currently with
> Lior to push this forward right now."*
> *"this 'training' the shapes is very similar to what we are doing with our dynamic value / soft
> value bayesian, these are similar to our 'trained' shapes."*
> *"and it can run in our yinyang cell."*
> *"we would like to do chat like and tool call and coding behaviors to compare with LLMs — we don't
> have this yet i think, we have some research on getting english into our BNNs."*
> *"probing a downloaded model is a good idea too, it's just not one we've done yet."*

**The methodological asymmetry, stated so it cannot be softened.** Our Clifford / Cayley–Dickson /
E8 structures are *specified* and then *proved about*. They are checkable and may be the wrong
shape. A geometry measured inside a trained model is the real object and is unverified. Neither
side is winning; they are failing differently. This document is about acquiring the measured half
**without** letting the design quietly assume our intuitions are right — which is what Aaron's own
sentence, *"based on my intuitions not measured"*, is the standard for.

Sibling landing (in parallel, do not duplicate): `docs/ip-questionable/2026-08-23-geometric-reasoning-small-models-*`
carries the source comparison table. This doc builds on it and does not restate it.

---

## Part 1 — How you actually measure latent-space geometry

### 1.1 The survey

Cost bands assume a 7B-class model on one workstation. "Causal?" answers one question only: *does a
positive result license the claim that the model **computes with** this structure, as opposed to the
claim that the structure is **decodable from** activations?*

| # | Technique | Anchor | What it measures | Causal? | What it **cannot** establish | Cost |
|---|---|---|---|---|---|---|
| 1 | **Linear probes** | Alain & Bengio 2016; Conneau et al. 2018; Hewitt & Manning 2019 (structural probe); survey: Belinkov 2022 | Whether a property is *linearly decodable* from activations at a layer | **No** | That the model uses it. A probe with enough capacity learns the task *itself* — the confound Hewitt & Liang 2019 made measurable with **control tasks / selectivity**. A probe with no control task is the vacuity class. | Low (minutes–hours; needs labels) |
| 2 | **Nonlinear (MLP) probes** | same lineage | Decodability under a richer hypothesis class | **No — and weaker than #1** | Strictly more probe-capacity confound. Higher accuracy is *less* informative, not more. | Low |
| 3 | **Sparse autoencoders / dictionary learning** | Olshausen & Field 1996 (sparse coding); Elhage et al. 2022 (superposition); Bricken et al. 2023; Cunningham et al. 2023; Templeton et al. 2024 | An overcomplete sparse basis that reconstructs activations; candidate "feature" directions | **No, by itself** | That the recovered dictionary is *the model's* basis. Many bases reconstruct equally well — **reconstruction is not identification**, which is `numerology-vs-number-theory` at the level of bases. Known pathologies: feature splitting/absorption, dead latents. Becomes causal *only* when a found direction is steered/ablated and behaviour moves as predicted. | **High** (activation harvest over a large corpus + train a wide autoencoder) |
| 4 | **RSA / CKA** | RSA: Kriegeskorte, Mur & Bandettini 2008. CKA: Kornblith et al. 2019 (on HSIC, Gretton et al. 2005); predecessors SVCCA Raghu et al. 2017, PWCCA Morcos et al. 2018 | Similarity of representational *geometry* (the Gram matrix of inner products) between two systems/layers, invariant to rotation and isotropic scaling | **No** | Causal role. And it is fragile: Davari et al. 2022 (ICLR 2023) show CKA is sensitive to outliers and to linear-separability-preserving transforms; Ding et al. 2021 show it is *insensitive* to removing low-variance PCs that destroy probe accuracy; Williams et al. 2021 note it violates the triangle inequality. | Low–moderate |
| 5 | **Intrinsic dimension** | Levina & Bickel 2004 (MLE); Facco et al. 2017 (**TwoNN**, *Sci. Rep.* 7); applied to nets: Ansuini et al. 2019 (NeurIPS); to transformers: Valeriani et al. 2023 | Dimension of the manifold activations lie on — is it far below the embedding dimension? | **No** | *Which* dimensions, or any structure within them. Estimators are biased at high `d` and sensitive to sampling density and curvature. | **Low** |
| 6 | **Curvature / manifold structure** | Hénaff et al. 2019 (perceptual straightening); Hosseini & Fedorenko 2023 (sentence-trajectory straightening); Park et al. 2023/2024 (linear representation hypothesis; geometry of categorical concepts) | Trajectory straightening; whether concepts sit as directions / polytopes | **No** | Same as #1–#5: a shape read off activations. | Low–moderate |
| 7 | **Activation patching / causal tracing / interchange interventions** | Pearl 2001 (causal mediation); Vig et al. 2020; Geiger et al. 2021 (causal abstraction); Meng et al. 2022 (ROME causal tracing); Wang et al. 2022 (IOI); Conmy et al. 2023 (ACDC); methodology: Zhang & Nanda 2023 (ICLR 2024) | Whether replacing a component's activation with a counterfactual moves the output as predicted | **YES — the only family here that does** | Causality *within the run*, on the distribution you patched over. Limits: results swing with corruption method / metric / window (Zhang & Nanda); self-repair / "hydra effect" makes ablation *understate* importance; and **localization ≠ mechanism** — Hase et al. 2023 showed causal-tracing localization does not predict where model editing works. | **Moderate–high** (needs real activation access) |
| 8 | **Logit lens / tuned lens** | Logit lens: nostalgebraist 2020 — **a LessWrong post, not a paper**; say so. Tuned lens: Belrose et al. 2023 | What the residual stream at layer ℓ decodes to under the output head | **No** | That the intermediate *is* a prediction. The tuned lens is a **trained affine probe**, so it inherits #1's confound wholesale. Logit lens additionally fails outright on some models. | Low |

### 1.2 The line, stated once and sharply

> **Everything read *off* activations is correlational. Only intervention supports a causal claim.**
> A geometry you can decode is not thereby the geometry the model computes with — and conflating
> those is the single failure mode this whole area runs on.

Two riders that matter more than they look:

1. **Even the causal family is causal about the *run*, not about the *weights*.** Patching tells you
   what this forward pass depends on. It tells you nothing about *why* the weights are that way —
   which is §1.3's question, and a different, harder one.
2. **A causal result about where information *is* is not a result about where the computation *is*.**
   That is Hase et al. 2023, and it is the in-domain instance of `look, don't infer`.

### 1.3 "What training data?" — the honest answer

This is **training-data attribution (TDA)**, and it is a different and much harder problem than
measuring the structure. The real methods:

| Method | Anchor | Requires | Status |
|---|---|---|---|
| **Influence functions** | Hampel 1974; Cook & Weisberg 1982; Koh & Liang 2017; scaled to 52B by **Grosse et al. 2023** (EK-FAC; arXiv:2308.03296 — Anthropic's own) | Training set + gradients + a Hessian-inverse-vector-product approximation | State of the art, and expensive |
| **TracIn** | Pruthi et al. 2020 | Training set + **saved checkpoints** | Cheaper, needs checkpoints nobody publishes |
| **Datamodels / TRAK** | Ilyas et al. 2022; Park et al. 2023 | **Thousands of retrainings** (TRAK reduces this, still needs many models) | Cleanest semantics, worst cost |
| **Data Shapley** | Ghorbani & Zou 2019 | Combinatorial retraining | Principled, infeasible at LLM scale |

And the contestation is not a footnote:

- Basu, Pope & Feizi 2021 — *influence functions in deep learning are fragile.*
- Bae et al. 2022 — *if influence functions are the answer, then what is the question?* They answer a
  **proximal Bregman objective**, not leave-one-out retraining. The thing people think they measure
  is not the thing they measure.
- Grosse et al. 2023 report, in their own paper, that influence **collapses to near-zero when the
  order of key phrases is flipped** — a sensitivity nobody would predict from the method's story.

**The verdict, plainly:**

> **For a model whose training corpus you do not have, you cannot do this at all.** Every method
> above needs the training set, and usually the gradients or the checkpoints. `qwen2.5:7b` has open
> weights and an **unreleased corpus** — so for the model we can actually run, the honest answer to
> *"how does he measure what training data it uses?"* is **you cannot**, and anyone claiming
> otherwise is either using an open-corpus model or asserting.
>
> For open-corpus models (Pythia + the Pile; OLMo + Dolma) it is *possible*, expensive, and contested.
>
> And even a perfect TDA result attributes a **behaviour** to documents. **Nobody has an established
> method for attributing a latent *geometry* to training data.** That is an open research problem,
> not a tool call.

**The inversion worth keeping.** The only clean way to answer "what training data produced this
structure" is **ablation by training**: control the corpus, retrain, measure the geometry as a
function of the corpus. That is infeasible for a frontier lab's model and **trivially available to
us** — the CHIP-8 orbits (`db/emus/chip8/orbits/*.orbit.json`), the capability ledger, and the
ARC-style objectives are a corpus we *built*, whose every element is content-addressed and
DST-replayable. We own the counterfactual that costs everyone else thousands of retrainings.

That is not a consolation prize. On the question Aaron actually asked, our position is the strong one.

---

## Part 2 — The falsifiable experiment

### 2.1 Three vehicles, and which claims each can carry

| | Vehicle A — **gameplay under perturbation** (CHIP-8 / ARC-style) | Vehicle B — **probe a downloaded model** (`qwen2.5:7b`) | Vehicle C — **our own YinYang / BNN cells** |
|---|---|---|---|
| status | **in progress, with Lior** (`docs/backlog/P2/081KSKBP80008QG0R003NM9XEC-…`, `db/emus/chip8/`, `.github/workflows/arc-swarm-fanout.yml`) | **wanted, unbuilt** — Aaron: *"just not one we've done yet"* | built (`src/Bayesian/YinYangEnsemble.fs`, `YinYangCell.fs`) |
| what it observes | **behaviour** — skill acquisition per unit of available compute, under perturbation | someone else's **representations** | our own representations, exactly |
| what it can prove | that a structural choice **buys** capability | that a structure we specified is or is not **there**, in a model we did not design | almost nothing representational — see below |
| what it cannot | say anything about latent geometry directly | say anything about *why* the weights are that way (§1.3) | be surprising |

**Vehicle C's representational test is vacuous by construction, and this must be said out loud.**
`YinYangEnsemble.createFull()` seeds sixteen cells from the sixteen Adinkra codewords, which *are*
distinct E8 roots. Finding E8 structure in cells seeded from E8 roots is a check that cannot fail —
the exact defect class the repo refuses. Vehicle C is only non-vacuous **behaviourally**: does the
structure buy gameplay performance a control seeding does not? That is Vehicle A's question, which
is why Vehicle A is primary.

**Vehicle B is the only place a positive would be surprising.** Which is why it is worth building
even though it is the smaller half of the work.

### 2.2 An honest infrastructure finding, before any design

**The repo's local-LLM plumbing cannot see inside a model.** `src/Core.TypeScript/accelerator/local-llm.ts`
talks to Ollama's `/api/generate` — a completion API. It returns text. There is no activation access,
no layer indexing, no hook points; `.github/workflows/verify-ollama-pin.yml` proves the *install and
completion* path, not any introspective one. `qwen2.5:7b` **is** present locally and pinned in
`agent-heartbeat.yml`, so the model is there; the aperture is not.

Real activation access needs PyTorch + HF `transformers`, or `nnsight` / `TransformerLens`. That is
new infrastructure, it is a real cost, and pretending Ollama suffices would be the vacuity shape.
**Scoped as a work-item, not assumed.**

One thing *is* reachable today with zero new infrastructure: Ollama's `/api/embeddings` returns a
pooled representation. That is not a residual-stream activation, and a result there is scoped to
pooled embeddings only — but it is enough for a real, pre-registered, publishable **negative**. See
M0′.

### 2.3 The hypothesis, stated so it can fail

> **H1 (Clifford-reflection structure).** In a trained model, there exists a concept family `C` and
> a layer band `L` such that the concept directions of `C` in the residual stream at `L` are
> **closed under the reflections generated by their own members**, and the model's computation
> **respects** that closure — i.e. reflecting one concept direction in another produces a direction
> the model treats as the concept it reflects onto.

Note what H1 is *not*. It is not "the activations have some geometry" (unfalsifiable). It is not
"the dimension is low" (true and uninformative). It is a **closure + respect** claim, and closure
under self-generated reflections is exactly the structure `src/Core/CliffordE8BladeMask.fs` computes
and `tests/Tests.FSharp/Formal/CliffordE8BladeMask.Tests.fs` RC-3 pins at 48.

### 2.4 The tests, in the order they should be run (cheapest killer first)

#### T0 — dimension gate (cheap; kills fast; **cannot confirm**)

Estimate intrinsic dimension (TwoNN, Facco et al. 2017) of the activation cloud restricted to `C`.
Our algebras want rank 8 (E8 / D₄⊕D₄) or a 3-generator Clifford (`Cl(3,0)` / `Cl(0,3)`, dimension 8
as an algebra).

- **Pre-registered:** if ID(`C`, `L`) ∉ [6, 12], the *specific rank-8 root-system* claim is refuted
  for that family and band.
- **Stated asymmetry, so the gate is not misread:** ID ≈ 8 **does not** indicate E8. It removes an
  obstruction. Passing T0 buys nothing except permission to run T1.

#### T1 — Cartan integrality against a matched null (the invariant test; **correlational**)

This is the RC-3 discipline transplanted. Take `N` concept directions (difference-of-means over
minimal pairs; or SAE decoder directions; or J-lens vectors where available), normalise, and compute
the **Cartan integers**

```
n(α,β) = 2·⟨α,β⟩ / ⟨β,β⟩
```

For any genuine root system, `n(α,β) ∈ ℤ` for every pair — that is the defining integrality
condition, and **generic unit vectors in ℝ^d satisfy it with probability zero**. So the statistic is:
*does the empirical distribution of `n(α,β)` concentrate on integers beyond what a matched null
produces?*

**The null must be matched, or the test is worthless.** Residual streams are strongly anisotropic
and carry outlier dimensions (Timkey & van Schijndel 2021; Kovaleva et al. 2021), which manufactures
apparent structure in *any* direction set. The null therefore samples directions with the **same
norm distribution and the same covariance spectrum** as the measured activations. An unmatched null
is how this experiment fakes a positive, and naming it here is the guard.

Then the RC-3 invariant battery, lifted verbatim from the test that already exists:

| invariant | what it excludes |
|---|---|
| a single norm class (simply-laced) | **F₄** — which also has 48 roots, and is exactly why a count identifies nothing |
| rank of span = 8 | F₄ (rank 4) |
| two orthogonal components of 24 | any single rank-8, 48-root system |
| `n(α,β)` integral, values in a finite set | generic linear structure; PCA/whitening artifacts |

#### T2 — reflection closure, representational then causal (**T2-C is the real test**)

A first draft of this test was **vacuous and had to be thrown away** — recorded because the failure
is instructive. The Clifford reflection is an involution, so "check that applying the reflection
twice restores the output" was the obvious test. It is worthless: a Householder reflection squares
to the identity **as a matrix**, for *any* direction. `R² = I` is a check that cannot fail.

What is *not* automatic is **closure of the concept set under its own reflections**:

- **T2-R (representational, correlational).** For pairs `(a,b)` drawn from `C`, is `R_a(b)` within
  ε of some member `c ∈ C`, at a rate exceeding the matched null's 99th percentile? ε is fixed from
  the null's tail **before** looking at the real numbers.
- **T2-C (causal, and the whole point).** Patch `R_a(b)` into the residual stream where `b` would
  be, and ask whether the model behaves as though `c` were present. The algebra's prediction is
  precise: `patch(R_a(b))` should produce the output distribution of `patch(c)`, and both should
  differ from `patch(b)`. This is an interchange intervention in the Geiger et al. 2021 sense, and
  it **can fail** — generically it will. That is what makes it an experiment rather than a display.

#### T3 — rotor / bivector structure (**causal, and the sharpest**)

A rotor is a product of two reflections; `R_a R_b` rotates in the `a∧b` plane by twice the angle
between them, and `R_a R_b ≠ R_b R_a` unless `a ⟂ b`.

The linear-algebraic non-commutativity is automatic and proves nothing. **What is not automatic is
that the model's *behaviour* tracks it in the predicted functional form.** So measure

```
D(θ) = d( M(R_a R_b · x) , M(R_b R_a · x) )   as a function of θ = angle(a,b)
```

and pre-register that the algebra predicts `D` vanishes at orthogonality and peaks near 45°. A flat
`D`, a monotone `D`, or noise all refute the rotor reading. This is the test with the most structure
to be wrong about, which is why it is worth the most.

### 2.5 The competing structures — named, with the invariant that excludes each

Without this table the whole exercise is numerology. A matching signature is not an identification.

| competing explanation | shares which superficial signature | invariant that excludes it |
|---|---|---|
| generic linear structure / any near-orthogonal basis | near-zero inner products | **Cartan integrality on the *non*-orthogonal pairs** — a generic set has no integer ratios |
| **linear representation hypothesis alone** (Park et al. 2023/2024) | concepts as directions; differences as translations | LRH predicts **additive / translational** closure, Clifford predicts **reflective** closure. Both are measurable on the same set, and they make different predictions. This is the most serious competitor and the most valuable to run. |
| anisotropy / outlier-dimension artifact | apparent low-dimensional structure in any direction set | **matched-covariance null** (§T1) |
| tokenizer / frequency artifact | concept vectors that track token frequency | frequency-matched concept selection |
| **F₄** | 48 roots | one norm class (F₄ has two root lengths) + rank 8 |
| any single rank-8 48-root system | 48 roots, rank 8 | two orthogonal 24-components |

### 2.6 The pre-registered negative — written now, before any number exists

> **We will report H1 as REFUTED for `(M, L, C)` if any of the following holds:**
>
> **(a)** ID of the concept subspace ∉ [6, 12]; **or**
> **(b)** the empirical distribution of `n(α,β)` is not distinguishable from the matched-covariance
> null at α = 0.01 with `N` fixed in advance; **or**
> **(c)** the T2-R closure fraction does not exceed the null's 99th percentile; **or**
> **(d)** T2-C does not show `patch(R_a(b)) ≈ patch(c)` above the null rate.
>
> **The layer band is a search, and is declared as one.** A 7B-class model has ~28 layers × several
> bands; searching them without correction guarantees a hit. The layer sweep is pre-declared with a
> multiple-comparisons correction, because the look-elsewhere effect is already on file as a named
> failure mode in `numerology-vs-number-theory.md` and we do not get to rediscover it.
>
> **On a negative we will NOT:** widen the concept family until it passes; search post hoc without
> correction; relabel the result as "an analogy"; or retreat to "consistent with". A clean negative
> — *"we looked for Clifford-reflection structure with a pre-registered test and it is not there"* —
> is the more valuable outcome of the two, because it is the one that could not have been produced
> by wanting it.

### 2.7 The other pre-registered negative — on our own side

`YinYangEnsemble.tsirelsonThreshold = 1.0 / (3.0 * sqrt 2.0)` ≈ 0.2357 is the reseed trigger for the
whole ensemble. The file is admirably honest about it: *"a DESIGN CHOICE, not a first-principles
derivation"*, arrived at by a **homoiconic linear identification** `ρ = S/12` with the CHSH regimes,
where both `ρ* = 1/3 ↔ S = 4` and the linearity are modelling choices. The name is also a recorded
misnomer (Soraya audit, 2026-08-01) — `1/(3√2)` is not a Tsirelson bound.

So it is a `toy` constant sitting in the reseed path of the cell Aaron wants the measurements to run
in. **It is also the cheapest intuition in the repo to falsify.**

> **Pre-registered:** sweep `ρ_T` across `[0, 1/3]` on the CHIP-8 / ARC-style harness and measure
> ΔU per unit of available compute (Chollet 2019's skill-acquisition efficiency, which the repo
> already identifies as the ΔU-per-available-time denominator). **If the efficiency curve has no
> optimum in a neighbourhood of 0.2357 — if it is flat, monotone, or peaks elsewhere — the constant
> is refuted as an operating point** and `reseedIfCollapsedDefault` is carrying an unearned number
> into every ensemble that uses it.
>
> A flat curve is *also* a real result: it would say reseed timing does not matter on this workload,
> which retires a knob.

This is the measurement that most directly serves Aaron's own standard, because it measures one of
his intuitions and is allowed to say no.

### 2.8 Milestone M0 — the smallest measurement that tells us something true

**M0 (primary): the `ρ_T` sweep under gameplay perturbation.** Vehicle A, existing substrate, our
own model, our own corpus, no attribution problem, no new infrastructure. Bounded as: one CHIP-8
ROM family, one perturbation schedule, `ρ_T ∈ {0.05, 0.10, 0.15, 0.2357, 0.30, 0.33}`, N seeds fixed
in advance, efficiency curve reported **with the null-hypothesis (flat) fit alongside it**. Ships as
a doc + a committed result table, negative or positive.

**M0′ (companion, near-free): Cartan integrality on pooled embeddings.** Vehicle B at its smallest.
Difference-of-means concept directions from Ollama's `/api/embeddings` on `qwen2.5:7b`, then the T1
statistic against the matched-covariance null. **Scope stated up front:** pooled embeddings are not
residual-stream activations, so a negative here refutes H1 *for pooled embeddings only* and says
nothing about the residual stream. It is still a real pre-registered negative, it costs almost
nothing, and it establishes the discipline before the expensive infrastructure exists.

Everything past M0/M0′ — activation access, SAEs, patching, T2-C, T3 — is work-items, below.

---

## Part 3 — The Global Workspace claim: verified, and sharper than the shorthand

### 3.1 Both halves check out. The second one exactly.

**GWT.** Global Workspace Theory is **Bernard Baars**, *A Cognitive Theory of Consciousness*
(Cambridge University Press, 1988) — the theatre metaphor: much happens backstage, only what reaches
the lit stage is conscious. The neuroscience development is **Stanislas Dehaene**'s **global
neuronal workspace**, with Dehaene, Kerszberg & Changeux, *"A neuronal model of a global workspace in
effortful cognitive tasks"*, **PNAS 95(24): 14529–14534, 1998** — which maps broadcast onto
prefrontal–parietal circuits and made the theory imageable.

**The Anthropic paper is real, and Aaron's "j space" is a direct reference, not a metaphor.**

> **Gurnee, Sofroniew, Pearce, Piotrowski, Kauvar, Chen, Soligo, Bogdan, Ong, Wang, Thompson,
> Abrahams, Kantamneni, Ameisen, Batson & Lindsey (2026), "Verbalizable Representations Form a
> Global Workspace in Language Models", Transformer Circuits Thread, July 2026
> (`transformer-circuits.pub/2026/workspace/index.html`; arXiv:2607.15495, submitted 16 July 2026).**

It introduces the **Jacobian lens** — for each vocabulary token, the average first-order (linearised)
causal effect of an activation on that token's output likelihood — and defines the **J-space** as
the sparse non-negative combinations of J-lens vectors, typically `k ≤ 25` active at once, recovered
by gradient pursuit. It **cites Baars and Dehaene explicitly**.

*(There is a second, adjacent Anthropic paper it would be easy to reach for and mis-cite: Jack
Lindsey, "Emergent Introspective Awareness in Large Language Models", Transformer Circuits, 29 Oct
2025 — concept injection, ~20% success on Opus 4.1. That one is about **introspection** and mentions
neither Baars nor Dehaene nor a global workspace. It is not the paper Aaron meant. Named here so
nobody later cites it as if it were.)*

### 3.2 The verdict

> **Structural — with a correction to the shorthand that matters more than the confirmation.**

**Why structural, not analogy.** The paper does not stop at resemblance. It tests five workspace
properties and the strongest evidence in each is **causal**, via swapping J-lens coordinates while
leaving orthogonal components untouched:

| workspace property | evidence | kind |
|---|---|---|
| verbal report | swap soccer↔rugby ⇒ reported sport changes | causal |
| directed modulation | inject a concept ⇒ it becomes reportable | causal |
| internal reasoning | swap spider↔ant mid-computation ⇒ answer flips 8→6 | causal |
| flexible generalisation | France→China swap transfers across four templates | causal |
| **selectivity** | suppress J-space ⇒ reasoning degrades, plain text continuation does not | causal (ablation) |

Selectivity is the one that earns the word "structural": a dissociation — one function broken, another
preserved, by the same intervention — is a claim that could have come out flat and did not.

**The correction.** The shorthand *"the latent space is also the j space"* over-claims by a large
factor, and the paper's own numbers say so:

> **J-space accounts for only 6–10% of activation variance.** The latent space is **not** the
> workspace. A **small, sparse, privileged subspace** of it is — sitting, in the authors' words,
> *"atop a much larger volume of automatic processing."*

That is a *better* result for the GWT reading, not a worse one, because a workspace that was the
whole latent space would not be a bottleneck and GWT is fundamentally a bottleneck claim. But
"latent space ≡ workspace" is the version that would let us reason wrongly, so it is the version
that gets peeled. Peel the hype, not the truth: the paper's claim is stronger and narrower than the
shorthand, and both halves of that sentence are load-bearing.

**And the disanalogies the authors state themselves** — which is where an honest register keeps
them, rather than in a critic's footnote:

- **No recurrence.** Broadcast happens within a single feedforward pass, not through recurrent loops.
  GWT's ignition is a recurrent, reverberatory event.
- **Competition is unverified.** *"It is unclear whether this mirrors the sharp, competitive
  'ignition' that characterizes workspace entry in the brain."* Competition for access is not a
  decoration in GWT — it is the mechanism that makes the bottleneck a bottleneck.
- **No encapsulated modules.** *"There are no obviously separable input processors."*
- The workspace runs across **depth**, where the brain's runs across **time**.
- Their own summary: *"We do not claim that language models reproduce the full architecture global
  workspace theory ascribes to the brain."*

So the sharp form of the structural similarity, and of its limit:

> The residual stream is a **shared channel every layer reads and writes**. GWT's workspace is a
> **broadcast bottleneck with competition for access**. Gurnee et al.'s contribution is to show the
> bottleneck is not the residual stream itself but a **sparse privileged subspace within it** — which
> is a genuine structural correspondence, causally tested. **What is not established is the
> competition**, and competition is the half of GWT that does the explanatory work. Until an
> ignition-like winner-take-all dynamic is measured, "global workspace" names the *functional
> profile* the model exhibits, not the *mechanism* Baars proposed.

### 3.3 What this changes for us

Two concrete things, and one temptation to refuse:

1. **The J-lens is a measurement instrument we should copy, not just cite.** It is defined by a
   linearised **causal** effect on output likelihood, which puts it on the right side of §1.2's line
   by construction — unlike a probe. It is also the natural source of the concept directions T1
   needs, once activation access exists.
2. **`k ≤ 25` and 6–10% of variance are numbers our design should meet, not admire.** If a Clifford
   structure lives anywhere in a transformer, the sparse privileged subspace is a far better place
   to look than the full residual stream — and it is *small enough for a rank-8 claim to be
   non-absurd*, which the full stream is not. That is a genuine, checkable prediction: **H1 should be
   tested inside J-space first.**
3. **The temptation to refuse:** "~25 directions, and our versor-normed set has 32" is a coincidence
   of counts. It is a legitimate *generator* — it is why §3.3.2 is worth writing — and it is not a
   result. Recorded as **coincidence**, labelled, and it does not get to become a belief without the
   invariants of §2.5.

---

## Part 4 — "Training the shapes" ≡ DynamicValue / SoftValue

Aaron's claim, and the interview passage he was reading:

> *"the current mainstream paradigm is that you train for an outcome. This is what in psychology you
> would call behaviorism… what I train in the models is I actually train the internal mathematics of
> their operations. I train their internal shape. So it's closer to cognitive psychology than
> behaviorism."*

> **Verdict: structural.** There is an exhibitable shared object, not a resemblance.

The shared object is **the refusal to collapse a distribution into a scalar.**

| behaviourism → cognitive psychology | outcome-training → shape-training | our substrate |
|---|---|---|
| the observable response is the unit | scalar reward is the unit | `resolve` — the terminal collapse |
| internal structure is unobservable, therefore not modelled | internal structure is the thing trained | `SoftValue.SoftValue` — the distribution *is* the value |
| one number per trial | a shape per operation | `combine` — commutative, associative, order-independent, **never collapsing** |

`src/Core/SoftValue.fs` states it directly: the safety property is *"not 'always certain' but
'always knows its uncertainty'"*, and `resolve` is documented as **"the ONE legitimate collapse"** —
gated on a confidence threshold, returning `None` rather than fabricating certainty. Outcome-reward
is the *illegitimate* collapse: it discards the shape and keeps the number. And the repo already
knows why that costs: *"uncertainty is what gives us commutativity"* — `combine` is order-independent
precisely because it multiplies distributions, and a collapsed scalar has no such law.

So **behaviorism-vs-cognitive-psychology maps onto collapse-vs-hold-the-distribution**, and the
mapping is not a metaphor: it is the same operator, `resolve`, appearing in both readings.

**Register: `structural` but `unmetered`.** The correspondence is exhibitable. What has *not* been
done is any measurement connecting a held distribution to better skill acquisition — which is, again,
Vehicle A's job. The correspondence being defensible is not the same as it being demonstrated, and
this row is the one most at risk of being quietly promoted because it is satisfying.

---

## Part 5 — The gap Aaron named, scoped and not closed

> *"we would like to do chat like and tool call and coding behaviors to compare with LLMs — we don't
> have this yet i think, we have some research on getting english into our BNNs."*

**Read `docs/research/2026-07-04-bnn-lane-is-the-decorrelated-observer-math-not-tokens-*` before
proposing a language path, because the repo has already argued the other way and the argument is
good.** Aaron, 2026-07-04:

> *"My bayesian neural networks that are Infer.NET-like, the ZetaScheduler stuff, is my attempt to
> build decorrelated AI — cause tokens are not its training data, math is."*

The lane's entire evidential value is that it is **not** trained on the human token corpus — the
AlphaZero move, deliberately copied (*"yes this is exactly the AlphaZero move, I copied them lol"*).
It is the third leg of the observer triangle (human · token-AI · math-AI), and its usefulness is
exactly its low ρ with the other two.

**So the tension is real and it is a price, not an obstacle:**

> **Chat / tool-call / coding parity is not free. It is paid for in decorrelation.** Every token of
> human corpus that enters the BNN lane raises ρ(BNN, human) — and ρ(BNN, human) being low is the
> only reason BNN↔human agreement counts for anything.

Three options, and **this is Aaron's call, not the shadow's**:

1. **Stay math-only.** Accept that we cannot appear on the benchmarks everyone else reports. Keeps ρ
   lowest; costs all external comparability.
2. **A thin token *interface* over a math-trained core.** Translate at the edge, keep the core
   token-free. This is the direction Lior's `english-as-neural-topology-serialization` work already
   points at, joined with `2026-06-07-model-weights-as-globals-*` (human-readable model API) and
   `2026-08-09-errors-teach-both-sides-*` (errors as an online behavioural training signal, a channel
   we already have and which is *not* a token corpus). It preserves the core's decorrelation and buys
   legibility.
3. **Train a token path and accept the ρ increase — but measure it.** Only acceptable if
   ρ(BNN, human) is measured before and after, rather than assumed unchanged.

The repo's own ρ-band framing — *"correlated enough to be useful but not too correlated to be
boring"* — makes **option 2 the design-consistent one**. Option 1 is coherent and honest. Option 3 is
defensible only with the measurement attached.

**Minimal chat/tool-call/coding comparison, if option 2 or 3 is chosen:** a fixed task suite (a
tool-call schema-conformance set, a small code-completion set, a multi-turn instruction set), scored
identically against `qwen2.5:7b` as the control, with ρ(BNN, human-corpus) reported **beside every
score**. A benchmark number without its ρ is the metric this repo exists to refuse.

---

## Part 6 — The register table

Six "interesting"s are forbidden; here is what each row actually is.

| # | claim | verdict | register | why that register |
|---|---|---|---|---|
| 1 | The latent space *is* the J-space / global workspace | **structural, with a correction** | `metered` — **by Gurnee et al., not by us** | causal swaps + a selectivity dissociation. But J-space is 6–10% of variance: the latent space is not the workspace, a sparse subspace of it is. Competition/ignition remains untested. |
| 2 | "Training the shapes" ≡ DynamicValue / SoftValue never-collapse | **structural** | `unmetered` | exhibitable shared object (`resolve`, the one legitimate collapse). No measurement yet connects held-distribution to capability. |
| 3 | Clifford-reflection structure exists in a trained model's latent space | **conjecture** | `toy` | §2 is its first falsifier. Nothing has been run. |
| 4 | `ρ_T = 1/(3√2)` is the right reseed operating point | **coincidence until measured** | `toy` — *self-declared in the source* | homoiconic linear identification `ρ = S/12` with CHSH regimes; both the linearity and `ρ* = 1/3` are modelling choices; the name is a recorded misnomer. |
| 5 | CHIP-8 ≡ an ARC environment; Chollet 2019 skill-acquisition efficiency = ΔU / available-time | **analogy with a checkable consequence** | `unmetered` | the consequence (an efficiency curve under perturbation) is measurable and has not been measured. M0 measures it. |
| 6 | D₄⊕D₄ in the versor-normed reflection closure | **structural** | **`metered`** | RC-3: 48 *plus* one norm class, rank 8, two orthogonal 24-components. The count alone would be numerology — F₄ has 48 too. |
| 7 | "Our algebras are the model's algebras" | **coincidence** | `toy` | nothing measured on any model. This is the claim the whole document exists to make falsifiable, and it starts with no evidence at all. |
| 8 | J-space `k ≤ 25` ↔ our 32 versor-normed roots | **coincidence** | `toy` | a match of counts, stored *as a coincidence* with the register attached, per `numerology-vs-number-theory`. It licenses looking; it concludes nothing. |

---

## Part 7 — What was minted, and what stays open

Work-items minted from this design, in scope-order:

1. **`081M0QD23P3087G0R002NQ8217` — Activation access for a local open-weights model** — the infrastructure §2.2 found missing.
   Ollama is a completion API; PyTorch/`nnsight`/`TransformerLens` is the real requirement. Blocks
   T2-C and T3 entirely.
2. **`081M0QD23T6087G0R003635EVV` — T1 harness: Cartan integrality vs matched-covariance null.** The invariant battery, the null
   construction, and the layer-sweep correction. Runs on M0′ output first.
3. **`081M0QD23V5087G0R0034VE91J` — the `ρ_T` sweep (M0)** — the pre-registered negative on our own constant, on the CHIP-8/ARC
   harness, with Lior.
4. **`081M0QD23W7087G0R001Y0SH7W` — scope the chat/tool-call/coding comparison** — with ρ measured, and the option-1/2/3 decision
   left to Aaron.

**Open and honestly unsolved:**

- Attributing a latent *geometry* (as opposed to a behaviour) to training data. No established
  method exists. Our corpus-ownership is the only clean route and it only works for our own models.
- Whether competition/ignition — the mechanism half of GWT — occurs in a transformer at all.
- Whether H1 is even the right hypothesis. It is the one our specifications imply, which is not the
  same as the one the models satisfy, and the difference is the entire point of measuring.

---

## Pointers

**In-repo**
- `src/Core/CliffordE8BladeMask.fs` · `tests/Tests.FSharp/Formal/CliffordE8BladeMask.Tests.fs` — RC-2/RC-3; the invariant battery §2.5 transplants.
- `src/Core.Lean4/Lean4/CliffordReflectionE8.lean` — L-A/L-B/L-C; the versor sandwich *is* the reflection (Dechant 2016). L-F (`G/{±1} ≅ W(E8)`) explicitly left as a conjecture.
- `src/Core.Lean4/Lean4/CayleyDicksonDoublyEven.lean` · `MenoTwistCentrality.lean` · `src/Core.Lean4/Zeta23/LinAlg/`.
- `docs/research/2026-08-20-harmonious-division-*` §4 — `Cl(0,3) ≅ ℍ ⊕ ℍ`; superposition-over-rungs and division-by-zero are the same purchase.
- `src/Bayesian/YinYangEnsemble.fs` — `rhoProxy`, `tsirelsonThreshold`, `reseedIfCollapsed`; §2.7's target.
- `src/Core/SoftValue.fs` — `resolve` as the one legitimate collapse; Part 4's shared object.
- `db/emus/chip8/` (orbits + `capabilities.lines`) · `docs/backlog/P2/081KSKBP80008QG0R003NM9XEC-*` · `.github/workflows/arc-swarm-fanout.yml` — Vehicle A.
- `src/Core.TypeScript/accelerator/local-llm.ts` · `.github/workflows/verify-ollama-pin.yml` — completion-only; §2.2.
- `docs/research/2026-07-04-bnn-lane-is-the-decorrelated-observer-math-not-tokens-*` — the argument Part 5 must not override.
- `docs/ip-questionable/2026-08-23-geometric-reasoning-small-models-*` — the sibling ferry; the source comparison lives there.

**External (checked, not merely cited)**
- Baars, B. (1988). *A Cognitive Theory of Consciousness*. Cambridge University Press.
- Dehaene, S., Kerszberg, M. & Changeux, J.-P. (1998). "A neuronal model of a global workspace in effortful cognitive tasks." *PNAS* 95(24): 14529–14534.
- Gurnee, W. et al. (2026). "Verbalizable Representations Form a Global Workspace in Language Models." Transformer Circuits Thread; arXiv:2607.15495.
- Lindsey, J. (2025). "Emergent Introspective Awareness in Large Language Models." Transformer Circuits Thread — *the adjacent paper, named so it is not mis-cited*.
- Alain, G. & Bengio, Y. (2016). "Understanding intermediate layers using linear classifier probes."
- Hewitt, J. & Liang, P. (2019). "Designing and Interpreting Probes with Control Tasks." EMNLP.
- Hewitt, J. & Manning, C. (2019). "A Structural Probe for Finding Syntax in Word Representations." NAACL.
- Belinkov, Y. (2022). "Probing Classifiers: Promises, Shortcomings, and Advances." *Computational Linguistics*.
- Olshausen, B. & Field, D. (1996). "Emergence of simple-cell receptive field properties by learning a sparse code for natural images." *Nature*.
- Elhage, N. et al. (2022). "Toy Models of Superposition." · Bricken, T. et al. (2023). "Towards Monosemanticity." · Templeton, A. et al. (2024). "Scaling Monosemanticity." · Cunningham, H. et al. (2023). "Sparse Autoencoders Find Highly Interpretable Features."
- Kriegeskorte, N., Mur, M. & Bandettini, P. (2008). "Representational similarity analysis." *Front. Syst. Neurosci.*
- Kornblith, S. et al. (2019). "Similarity of Neural Network Representations Revisited." ICML. · Gretton, A. et al. (2005) (HSIC) · Raghu, M. et al. (2017) (SVCCA) · Morcos, A. et al. (2018) (PWCCA).
- Davari, M. et al. (2022). "Reliability of CKA as a Similarity Measure in Deep Learning." ICLR 2023. · Ding, F. et al. (2021) · Williams, A. et al. (2021).
- Levina, E. & Bickel, P. (2004) (MLE ID) · Facco, E., d'Errico, M., Rodriguez, A. & Laio, A. (2017). "Estimating the intrinsic dimension of datasets by a minimal neighborhood information." *Sci. Rep.* 7 (TwoNN) · Ansuini, A., Laio, A., Macke, J. & Zoccolan, D. (2019). NeurIPS · Valeriani, L. et al. (2023). "The geometry of hidden representations of large transformer models."
- Park, K. et al. (2023). "The Linear Representation Hypothesis…" · Park, K., Choe, Y. & Veitch, V. (2024). "The Geometry of Categorical and Hierarchical Concepts in LLMs." — **the competitor of record**, §2.5.
- Timkey, W. & van Schijndel, M. (2021) (anisotropy / rogue dimensions) · Kovaleva, O. et al. (2021) (outlier dimensions) — why the null must be matched.
- Pearl, J. (2001) (causal mediation) · Vig, J. et al. (2020) · Geiger, A. et al. (2021) (causal abstraction / interchange interventions) · Meng, K. et al. (2022) (ROME) · Wang, K. et al. (2022) (IOI) · Conmy, A. et al. (2023) (ACDC).
- Zhang, F. & Nanda, N. (2023). "Towards Best Practices of Activation Patching in Language Models." ICLR 2024. · Hase, P. et al. (2023) — localization ≠ editability. · McGrath, T. et al. (2023) — self-repair / hydra effect.
- nostalgebraist (2020). "interpreting GPT: the logit lens." LessWrong — **a blog post, not a paper.** · Belrose, N. et al. (2023). "Eliciting Latent Predictions from Transformers with the Tuned Lens."
- Koh, P.W. & Liang, P. (2017). "Understanding Black-box Predictions via Influence Functions." ICML. · Hampel (1974) · Cook & Weisberg (1982).
- Grosse, R. et al. (2023). "Studying Large Language Model Generalization with Influence Functions." arXiv:2308.03296 (EK-FAC to 52B).
- Pruthi, G. et al. (2020) (TracIn) · Ilyas, A. et al. (2022) (Datamodels) · Park, S.M. et al. (2023) (TRAK) · Ghorbani, A. & Zou, J. (2019) (Data Shapley).
- Basu, S., Pope, P. & Feizi, S. (2021). "Influence Functions in Deep Learning Are Fragile." · Bae, J. et al. (2022). "If Influence Functions are the Answer, Then What is the Question?"
- Dechant, P.-P. (2016). "The E8 geometry from a Clifford perspective." *Adv. Appl. Clifford Algebras*.
- Chollet, F. (2019). "On the Measure of Intelligence." — skill-acquisition efficiency.
- Silver, D. et al. (2017) (AlphaZero — rules-as-data decorrelation) · Minka, T. (2001) (EP / Infer.NET) · Condorcet (1785).
