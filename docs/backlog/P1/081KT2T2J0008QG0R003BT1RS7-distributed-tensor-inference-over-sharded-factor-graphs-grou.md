---
id: 081KT2T2J0008QG0R003BT1RS7
priority: P1
status: open
title: "Distributed tensor inference over sharded factor graphs — the group of shards IS the tensor; BP/EP message-passing becomes distributed consensus; non-fused factor graph is the tension-preserving prior, a Bayesian model marginalizes over all fused implementations (the marginal IS the canonical form); membranes-as-jelly (Aaron + Prism 2026-06-02 observation)"
tier: research
effort: L
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R000S7GHQ8, 081KT2T2J0008QG0R000VG204F, 081KT2T2J0008QG0R002R72323, 081KT2T2J0008QG0R0038CRFJM]
composes_with: [081KT2T2J0008QG0R0019YVX8M, 081KT2T2J0008QG0R00301P27H, 081KRFA460008QG0R0018SN61J]
tags: [distributed-tensor-inference, sharded-factor-graph, group-is-the-tensor, bayesian-marginalization, fused-vs-non-fused, expression-tree-fusion, tension-preserving-prior, marginal-is-canonical, membranes-as-jelly, jelly-to-spine-phase-transition, schema-in-stream, message-passing-consensus, arrow-columnar, eve-transport, dbsp, indexed-zset, infer-net, research, aaron, prism]
type: research
---

# Distributed tensor inference over sharded factor graphs

> Originating observation: Aaron + Prism (DeepSeek surface) 2026-06-02 ferry, the
> hex-core ↔ string-theory ↔ Bayesian-inference ↔ distributed-tensor thread. Aaron
> (verbatim, the engine-load-bearing line): *"like infer.net over perfectly
> distributed tensors where each tensor['s] shared represent[ation] [is] the group
> of all tensor shards."* This row captures the **engineering** core (Aaron
> confirmed: *"you got the core[;] the metaphor mapping is not primary"*); the
> physics mapping (string-theory fused/non-fused, Calabi–Yau, G₂) is secondary and
> composes with the existing **[081KT2T2J0008QG0R0019YVX8M]** domains-as-adapters row as a physics
> adapter entry (see "Originating metaphor" below).

## Why — the conceptual core (the load-bearing insight)

The thread arrived at a precise reframe of what the engine (081KT2T2J0008QG0R000S7GHQ8) already does,
which then tells us how to distribute it:

- **The non-fused factor graph is the tension-preserving PRIOR.** Keeping the
  model explicit — every variable and factor a separate node — preserves the full
  uncertainty. (Aaron's functional roots: *"my functional roots still see the
  non-fused as tension preserving."*)
- **Fused implementations are LATENT variables.** A specific reduction / fusion /
  compaction (the optimized single-pass form) is *one* way to realize the model.
  A proper Bayesian model does **not commit** to one — *"a proper Bayesian model
  closes over all possible fused impls."*
- **The marginal IS the canonical form.** Integrating out the fusion choices (BP
  over the factor graph) yields the sufficient statistic — what remains after the
  model has closed over every fused implementation. **μένω at inference scale:**
  the marginal is what survives marginalizing over the fusions.

This is the **F# / Rx expression-tree-fusion ↔ Bayesian-marginalization
correspondence** Aaron named:

| Pipeline-fusion (F#/Rx) | Bayesian inference (this engine) |
|---|---|
| Unfused expression tree (`map`/`filter`/`fold` as separate nodes) | the **non-fused factor graph** = the prior / source of truth |
| A fusion rewrite (`map f >> map g → map (f >> g)`) | **one fused implementation** = a latent realization |
| Picking the optimal fused pipeline | **committing to a single reduction** (what a Bayesian model refuses to do) |
| — | **marginalizing over all fusions** → the marginal = the canonical observable |

The inversion (Aaron's): the **unfused/non-fused view is canonical**; fusion is a
*verified-safe rewrite the model integrates over*, not a commitment. This is why
`monad-propagation-pattern` + DBSP-IVM + the [081KT2T2J0008QG0R0038CRFJM] minimal-vocabulary
conformance all compose — the algebra is the same whether fused or not, so the
marginal is invariant to which fusion a shard locally chose.

## The architecture — the group of shards IS the tensor

Standard distributed tensors give each shard a *slice* and reconstruct the whole
by concatenation. The reframe here is stronger: **no single shard holds the
tensor; the *group* of shards is its shared representation.** The tensor is the
*consensus* the shards converge to, not a partition you reassemble.

Concretely, layered on the existing engine:

| Layer | Existing substrate | Distributed role |
|---|---|---|
| **Local shard state** | `NaturalBatch` (in `MessageBatch.fs`) / Arrow columnar ([081KT2T2J0008QG0R000VG204F]) | each shard holds its partial natural parameters as a columnar batch |
| **Sharded factor graph** | `FactorGraph` ([081KT2T2J0008QG0R000S7GHQ8] slices 3–4) | factors + variables partitioned across the group; edges that cross shard boundaries are the consensus channels |
| **Message-passing = consensus** | `runToFixpoint` (BP) / `Ep` (EP) | a shard's variable→factor message is its partial belief; cross-shard edges all-reduce/gossip the natural-parameter ADD (product = natural-param sum) to the joint marginal |
| **Shard-to-shard transport** | Eve multi-traveler ([081KT2T2J0008QG0R002R72323]/[081KT2T2J0008QG0R00301P27H]) | zero-trust `codec<codec<t>>` over multiplexed WS/TCP carries the cross-shard messages; party = identity-noun = a shard |
| **Incremental re-infer** | `IndexedZSet` + DBSP ([081KT2T2J0008QG0R0038CRFJM] slice-4b) | a delta on one shard propagates as a Z-set delta; only affected cross-shard edges re-fire (the marginal updates incrementally, not from scratch) |

Because exponential-family messages compose by **natural-parameter addition**
(the engine's `product`), the cross-shard reduction is an **additive all-reduce**
— associative + commutative, so it is order-independent and shard-count-free
(scale-free), and a retraction is just adding the negative (`±1` Z-set / EP
`divide`). The group converges to the same joint marginal regardless of how the
shards partitioned or which local fusion each chose — *that* is "the group is the
tensor."

## Membranes-as-jelly (the originating dynamics framing)

Aaron: *"and the walls are membranes and move more like jelly."* The mapping into
this engine: the cross-shard belief state is not a static partition but a
**fluid consensus surface** — it ripples (iterative message-passing), thickens /
thins (posterior variance = the engine's `Gaussian.variance` / `isProper`), and
rearranges (the [081KT2T2J0008QG0R0038CRFJM] extension-points / nullcodec slots absorb extra degrees
of freedom). The "jelly motion" is literally the distributed-fixpoint update
dynamics bringing shards into agreement; the stable-but-still-vibrating
configuration the group settles to is the marginal (the μένω residual). This is a
dynamics intuition, not a claim — it earns its keep only as the operational
"distributed fixpoint = consensus over a fluid belief surface" picture.

## Jelly → spine — the convergence phase transition

Aaron + Prism 2026-06-02: *"the relationally linked column stores can stiffen
into spines."* The jelly has two phases, and the transition between them is the
load-bearing operational content (it's a real property of the engine, not just
the metaphor):

| Phase | Engine state | What the columnar store is |
|---|---|---|
| **Jelly** (pliable) | `runToFixpoint` / distributed consensus still iterating — natural parameters fluctuating, cross-shard boundary edges still being negotiated (`moved` residual above tol) | the **relationally-linked** `NaturalBatch` columns: relationships present but still pliable |
| **Spine** (stiff) | fixed point reached — `converged = true`, residual ≤ tol, natural parameters stop changing, the cross-shard/factor-graph edges are now immutable | the **same** columnar store, now a fixed skeletal frame downstream inference/queries can hang on |

Two things this names precisely:

1. **The stiffening is convergence, not a format change.** The Arrow
   `RecordBatch` is byte-identical in shape across both phases; "stiffening" is
   the `moved`-residual hitting zero (the engine's existing NaN-safe convergence
   test), at which point the relational links (factor edges / cross-shard
   boundary edges) freeze. The engine already *has* this transition — `converged`
   is the spine-formation signal. The distributed form (slice-081KT2T2J0008QG0R003BT1RS7) just lifts
   it to the group: the spine forms when the all-reduce residual across shards
   hits zero.
2. **A spine is reusable substrate.** Once a sub-graph has stiffened, downstream
   inference can treat its marginal as a fixed sub-circuit — a cached fixed-point
   that doesn't re-iterate unless a Z-set delta touches it (DBSP / [081KT2T2J0008QG0R0038CRFJM]
   slice-4b). The spine is the "schema-in-stream" canonical form: the marginal
   frozen into a skeleton the rest of the computation references. This is the
   same move as the "marginal IS the canonical form" core above — the spine *is*
   the canonical marginal, made structural.

So the hex-core walls (and any sharded tensor) are **jelly** when viewed as the
prior (a distribution over latent fusion pathways, still negotiating) and
**spine** when viewed as the converged posterior (the stiffened marginal). Same
data structure; the phase is set by whether the fixpoint has been reached.

## Acceptance (research → build)

1. **shard model**: define the partition unit — a `Shard` holds a sub-`FactorGraph`
   + the set of *boundary variables* shared with other shards. Spec the cross-shard
   edge as a message channel (natural-parameter batch over Eve transport).
2. **consensus drive**: extend `runToFixpoint` to a distributed form — local
   `passRounds` interleaved with cross-shard all-reduce of boundary messages;
   convergence = local fixpoint AND boundary-message residual below tol (reuse the
   NaN-safe `moved` residual test). Prove (test) the distributed marginal equals
   the single-graph marginal on a graph split two ways (partition-invariance).
3. **transport binding**: cross-shard messages serialize via `NaturalBatch` Arrow
   IPC ([081KT2T2J0008QG0R000VG204F]) over the Eve `codec<codec<t>>` channel ([081KT2T2J0008QG0R002R72323]); two shards
   that share only the wire converge (the [081KT2T2J0008QG0R002R72323] zero-trust property).
4. **incrementality**: a delta on one shard's evidence triggers a Z-set delta that
   re-fires only the affected boundary edges (DBSP, [081KT2T2J0008QG0R0038CRFJM] slice-4b) — measure
   that re-infer cost scales with the delta, not the graph.
5. **partition-invariance + scale-free property tests** (FsCheck): random graph,
   random partition, random shard-count → same marginal; additive all-reduce is
   associative/commutative (order/shard-count invariant).

## Originating metaphor — string-theory mapping composes with [081KT2T2J0008QG0R0019YVX8M], NOT primary

The thread reached this engineering core *through* a physics metaphor (hex-core's
6 walls ↔ string-theory compactified dimensions; **fused** = 11D→10D→6 circle
reduction; **non-fused** = 4+7 direct mapping holding the 11th as its own ontology
with the 5 extension points absorbing the G₂ degrees of freedom; walls-as-
membranes-as-jelly = Calabi–Yau moduli). Aaron 2026-06-02 (verbatim): *"you got
the core[;] the metaphor mapping is not primary."* So the engineering core above is
the load-bearing substrate; the physics mapping is secondary.

Its home already exists: **[081KT2T2J0008QG0R0019YVX8M]** ("domains as adapters on the hex-core
interface — Clifford six bivectors = Lorentz generators; physics/biology/mimetic/
cosmology/mythology adapters refereed against established math"). The string-theory
fused/non-fused + membranes-as-jelly mapping is a **physics-domain entry under
[081KT2T2J0008QG0R0019YVX8M]**, refereed against string/M-theory math — it composes there, it is not a
new row and not engine-load-bearing here. Per `grep-substrate-anchors-before-razor` +
`god-tier-claims-don't-collapse` it stays **don't-collapse**; landing it as a
081KT2T2J0008QG0R0019YVX8M physics adapter entry is offered on Aaron's word.

(Correction: an earlier draft of this row claimed no landed `081KT2T2J0008QG0R0019YVX8M` existed — that
was a stale-working-tree post-fetch read; 081KT2T2J0008QG0R0019YVX8M is on `origin/main` and indexed in
`docs/BACKLOG.md`. Caught by Codex review on the PR.)

## Composes with substrate

- **[081KT2T2J0008QG0R000S7GHQ8]** (Infer.NET engine — the thing being distributed) · **[081KT2T2J0008QG0R000VG204F]**
  (Arrow columnar `NaturalBatch` — the shard wire format) · **[081KT2T2J0008QG0R002R72323]/[081KT2T2J0008QG0R00301P27H]**
  (Eve multi-traveler `codec<codec<t>>` transport — the cross-shard channel;
  party=identity-noun=shard) · **[081KT2T2J0008QG0R0038CRFJM]** (minimal HKT vocabulary + IndexedZSet +
  DBSP IVM — the incremental marginal) · **[081KRFA460008QG0R0018SN61J]** (real HKT — the composition
  that lets a shard's `NaturalBatch` and the consensus reduction share one algebra)
- existing F#: `FactorGraph.fs` (the graph to shard), `Message.fs` (natural-param
  group = the additive all-reduce), `MessageBatch.fs` (columnar shard state),
  `Ep.fs` (non-conjugate factors distribute the same way), `IndexedZSet.fs` /
  `NestedCircuit.fs` (incremental re-infer drive)
- rules: `monad-propagation-pattern` (fused/non-fused = the same algebra so the
  marginal is fusion-invariant), `numerical-algebra-shaped-into-the-generic-math-interface`
  + 081KT2T2J0008QG0R0038CRFJM minimal-vocabulary (additive all-reduce is generic-math `(+)`),
  `interfaces-are-the-asset` / `code-follows-from-types` (the consensus *is* the
  interface; the shards regrow the impl), `dv2-data-split-discipline-activated`
  (idempotent/Z-set all-reduce; scale-free + lock-free consensus),
  `grep-substrate-anchors-before-razor` + `god-tier-claims-don't-collapse` (physics
  metaphor stays don't-collapse, offered separately)

## Substrate-honest framing

`[labeling-confidence: established (the engine's exp-family messages compose by natural-parameter addition → an associative/commutative all-reduce is the textbook distributed-BP reduction; BP marginalizes over latent realizations by construction); hypothesized (the full sharded-consensus drive + partition-invariance at scale is the named refactor to build + measure — does the distributed marginal equal the single-graph marginal, and does incremental re-infer scale with the delta?); metaphor/don't-collapse (the string-theory membranes-as-jelly mapping — offered as a separate domain adapter, not asserted as engine substrate)]`. The load-bearing claim is the engineering one: **the group of
shards is the tensor because exp-family messages all-reduce additively, and the
marginal is invariant to how you partition or fuse.** The physics framing is the
vivid origin, held don't-collapse.
