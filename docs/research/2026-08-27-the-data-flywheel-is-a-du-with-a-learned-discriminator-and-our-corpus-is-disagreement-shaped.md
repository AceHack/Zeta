# The data flywheel is a DU with a learned discriminator — and our corpus is disagreement-shaped

**Date:** 2026-08-27
**Ferried by:** Aaron — Level1Techs video on NVIDIA Switchyard / Nemotron 3.5 Lightning, plus the
open-source `NVIDIA-AI-Blueprints/data-flywheel` repository.
**Quarantined source:** [`docs/ip-questionable/2026-08-27-level1techs-switchyard-data-flywheel-model-routing-transcript.md`](../ip-questionable/2026-08-27-level1techs-switchyard-data-flywheel-model-routing-transcript.md)
— verbatim auto-transcript, third-party, deletable without touching this analysis.

Aaron's two observations, which are the reason this doc exists:

> *"this is like one of our discriminated unions or maybe our DU runner, i think of DUs and
> flywheels very similar concepts."*

> *"the dataset we are using are our pr archives and our shadow logs and any decorrelation between
> agents ... very different than most because of our sheer number of adversarial conversations and
> our focus on decorrelation, most training data ignores this almost completely."*

The first is a structural claim worth making precise. The second is a claim about a corpus, and it
is the more consequential of the two.

---

## 1. The DU↔flywheel correspondence, stated precisely

The analogy is real, and it gets sharper when you name which half is which. A discriminated union
has two separable parts, and so does a router:

| DU | flywheel / router |
|---|---|
| the **case set** — a *closed* list of alternatives | the **destination set** — small model, adapter, tool, frontier model |
| the **payload** per case | the request shape each destination accepts |
| the **match/runner** that dispatches | the router that picks a destination |
| **exhaustiveness checking** — every case handled | every request routed somewhere; no silent drop |

So the compressed form:

> **A DU is the case set. A flywheel is a LEARNED DISCRIMINATOR over that case set.**

That is the part the analogy earns. In ordinary code the discriminator is a tag written by the
producer and read by the `match`. In a router the discriminator is *inferred* from the request, and
the flywheel's whole loop — log completions, evaluate candidates, promote what works — is a
procedure for **improving the discriminator while the case set stays closed.**

### Why the closed case set is the load-bearing half

This is where the correspondence stops being a nice framing and becomes a security property we
already hold. From [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md),
the portable half of the patent — and the sharp one:

> **Closed command set.** Only pre-configured commands exist at the agent; the far side may **name**
> a command but can never **define** one.

A router with an *open* destination set is arbitrary execution wearing a routing diagram. A router
whose destinations are a DU is safe by construction, for exactly the reason the closed command set
is: compromising the discriminator buys you a choice **among** cases, never a new case. Naming versus
defining is the whole distinction, and it is the same distinction in both systems.

That also tells us where to be careful when we build ours: **the discriminator may be learned; the
case set may not be.** A flywheel that can add destinations on the evidence of its own logs has
re-opened the set through the back door.

### The one extra case — and why it does not re-open the set

The paragraph above leaves an obvious hole: a permanently frozen case set cannot handle a request
nobody anticipated, and pretending otherwise just relocates the failure. Aaron 2026-08-27 supplies
the missing case, and it is the part that makes the design actually work:

> *"we have exactly one extra case which is **needs new code**, and that code is written by another
> agent and evaluated by the society — this itself is its own DU."*

So the destination set is closed and has an escape, and the escape is **a case, not a hole**:

```
Route =
  | SmallModel of adapter
  | Frontier
  | Tool of name
  | ...                         // the closed, versioned destinations
  | NeedsNewCode of request     // <- the escape, itself a DU:
                                //      Proposed | UnderReview | Accepted | Rejected
```

Three properties follow, and together they answer the back-door objection:

1. **The escape is explicit and typed.** `NeedsNewCode` is exhaustively matched like any other case,
   so an unroutable request is a *named outcome* rather than a fallthrough. Nothing is silently
   dispatched anywhere.
2. **Extension runs at authoring time, never at inference time.** The router does not gain a
   destination by deciding to; a different agent writes code, and society evaluates it. The
   discriminator still cannot mint a case -- it can only *report* that none fits.
3. **The extension path is itself closed.** Proposal -> review -> accept/reject is a DU too, which
   is why this recurses rather than bottoming out in "and then something arbitrary happens."

**This is the escape-hatch discipline we already run elsewhere.** Hygiene here is enforced by
capability rather than policy, where the escape from "no bash at all" is *write the missing CLI* --
so every use of the hatch leaves the system **more complete** than before. `NeedsNewCode` is that
shape at the routing layer: exercising the escape produces a new reviewed case, permanently, for
everyone. An escape hatch that degrades the system is a bypass; one that extends it is a
constructor.

It is also `gen(gen) == gen` at the case-set level -- the generator whose output includes new
generators (see [`only-the-irreducible-is-primitive-generate-the-rest`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md)).
The closed set plus one self-extending case is how you get an open-ended system without an open
destination set, and the two are genuinely different things: the first is extensible by
construction, the second is arbitrary execution.

The honest caveat: this only holds while **evaluation** is real. If society's review of
`NeedsNewCode` output degrades into rubber-stamping, the escape becomes the back door after all --
the closure is enforced by the quality of the evaluation, not by the type.

### Where the analogy has a genuine limit

A DU is exhaustive *at compile time*; a flywheel's case set changes across deployments as adapters
are promoted. So a flywheel is not a DU — it is a DU whose case set is **versioned**, with promotion
as the only edit. That is what a "DU runner" reading a registry (rather than a hardcoded `match`)
actually buys, and it is why Aaron reached for *runner* as the closer of the two words. The
exhaustiveness obligation survives the versioning: at any given version, every request still lands
in exactly one case.

### The promotion ladder is already ours

NVIDIA's own framing, from `docs/01-architecture.md` in the blueprint:

> *"Think of this flywheel as a **discovery and promotion service** that surfaces promising smaller
> models rather than a fully autonomous replacement engine."*

…with **Post-Eval Human Review** listed as a required core component: *"Engineers/researchers
validate promising models before promotion; no user feedback collection."*

That is structurally identical to [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md):
a candidate is free to exist, promotion is **earned**, and the evidence must be nameable. Their
`candidate → evaluated → promoted` is our `toy → unmetered → metered`. Neither ladder lets a thing
promote itself on its own say-so, and in both the human review is the gate rather than the
measurement.

Worth noting because it cuts against the video's own enthusiasm: the blueprint is explicitly **not**
autonomous, and the v1 note scopes it to *cost and latency via distillation*, with accuracy gains
and agentic observability deferred to future versions. The tooling is less finished than the
argument for it.

---

## 2. The corpus claim, which is the more important half

The video's thesis is that the *secondary* dataset — how the organisation actually used the system —
is the real asset. *"I don't even think it's accurate to call it AI telemetry. It's institutional
knowledge."*

Aaron's response is that we already have that log store, and that ours is **a different kind of
corpus**. That deserves to be stated carefully, because it is a strong claim and the strong version
is not the obvious one.

### What we have that the blueprint's step 1 asks for

NVIDIA's architecture requires an *instrumented* application: tag distinct workloads, log every
prompt/completion pair, ship to a log store. We did not build that, and we have most of it anyway,
as a side effect of how the repo works:

- **PR archives** — every change, its review, the objections raised against it, and whether it
  survived. Attributed and dated.
- **Shadow logs** — the tick transcripts: what was attempted, what failed, what the failure looked
  like *before* it was understood, and what the correction was.
- **Decorrelation records** — where agents diverged, and what the divergence was about.
- **AgencySignature trailers** — provenance on every commit, including the honest-disagreement cases
  where two agents' blocks conflict and the PR is handed back.

The video asks for exactly the artifact list the shadow logs already are: *"I want to know what it
did ... what reasoning it had ... when it failed, what circumstances led to that failure and then
what happened next. What corrective actions did the humans take to help the AI."*

### The part that is genuinely different

Most instruction-tuning corpora are **agreement-shaped**. They record a prompt and an accepted
answer. The disagreement that produced the answer — the rejected attempt, the objection, the
reviewer who was right, the reviewer who was wrong and why — is discarded before the data is stored,
because it reads as noise against a supervised target.

Ours is **disagreement-shaped**, and structurally so rather than incidentally:

- **Adversarial review is the default operating mode**, not an exception. Harsh-critic,
  silent-failure-hunter, spec-zealot, threat-model-critic are standing roles; the repo is built out
  of falsifiers, and a falsifier culture generates a written record of *contested* claims.
- **Both branches are kept.** [`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
  and the DV2.0 raw vault forbid collapsing a divergence to one surviving value — *a single version
  of the facts, never a single version of the truth*. So the disagreement is not merely logged, it
  is **not resolved away**, with each branch's path recorded.
- **Decorrelation is an explicit objective**, with ρ treated as a band to stay inside rather than a
  quantity to minimise. The corpus therefore contains deliberate, labelled divergence.
- **Corrections are attributed and dated**, including the ones where an agent corrected itself,
  which is the rarest and most valuable row in any such corpus.

So the honest formulation of Aaron's claim:

> Our corpus records the **process by which a disagreement was resolved, and what was still
> disputed afterwards** — which is the signal most training pipelines discard by construction,
> because their storage format has one slot for the answer.

### The honest limits, stated rather than glossed

Three, and they matter for anyone tempted to read this as a finished asset:

1. **We have a log store, not a dataset.** PR archives and shadow logs are unstructured markdown and
   git history. NVIDIA's step 2 — *build evaluation and fine-tuning datasets from those logs* — is
   entirely unbuilt here. The distance between "we have the raw material" and "we have training data"
   is real work, and the honest register today is *unmetered*.
2. **Volume is unmeasured.** "Sheer number of adversarial conversations" is a claim nobody has
   counted. It is very likely true and it is currently a coincidence-index assertion, not a
   measurement — exactly the promotion path
   [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md) describes.
   Counting the adversarial exchanges in the PR archive is a cheap, checkable next step.
3. **Correlated by origin.** A large fraction of the corpus is generated by agents sharing a seed and
   a vendor, so its internal disagreement has a floor set by the trainset
   (`2026-08-25-rho-is-a-layer-stack-not-a-scalar-and-the-trainset-is-the-floor.md`). A corpus of
   adversarial exchanges between correlated participants is *less* independent than its transcript
   count suggests — the same look-elsewhere caution the numerology rule raises, applied to our own
   favourite claim.

Limit (3) is the interesting one, because it argues **for** the local-hardware direction rather than
against it: decorrelation is bounded by vendor and trainset diversity, which is precisely what
running our own models on our own hardware would widen.

---

## 2b. The dataset Aaron actually wants: the corrections he keeps repeating

Asked which corpus matters most, Aaron 2026-08-27 named a narrower and more interesting one than
the PR archive:

> *"the data set i'm most interested in are the corrections i keep giving over and over -- the
> proper way to write code and all the rules to follow to reduce errors ... no AI today can adhere
> to it fully even if it's copy pasted on every prompt ... kind of like 12 factor app but at a lower
> layer, at the layer of any code of any kind. 12 factor app is more about categorization and it's
> good ... our manifesto is all about computer science/engineering vs ad hoc code."*

Three claims, and each is checkable.

### It already exists, and it is larger than it feels

Counted 2026-08-27, so this stops being an impression:

| surface | count |
|---|---:|
| `GOVERNANCE.md` numbered rules | 36 |
| `docs/AGENT-BEST-PRACTICES.md` BP ids | 29 |
| `.claude/rules/` (active, loaded every session) | 28 |
| `.claude/rules.bak/` (archived) | **113** |
| `memory/feedback_*.md` (recorded corrections) | **650** |
| **total** | **856** |

650 recorded corrections is the answer to "corrections I keep giving over and over" -- they were
captured, they are dated and attributed, and nobody has ever treated them as a dataset.

### "Copy-pasting it into every prompt does not work" is not a complaint -- it is measured here

The strongest evidence for Aaron's claim is sitting in the ratio above: **113 rules are archived and
28 are active.** That archive was not a cleanup of bad rules. It was a cold-start token reduction --
the ruleset outgrew the context budget, and the rules that still apply were moved out of the loaded
set to make room. `rules-are-small-carved-sentences-pointing-to-docs` exists precisely to keep the
resident surface from re-bloating.

So the situation is not "we have rules and the model ignores them." It is:

> **The ruleset has already outgrown what can be resident, and the archive is the measured proof.**

That is what makes a training set the right instrument rather than a longer prompt. A prompt-resident
rule competes for the same budget as the work; a rule internalised in weights does not. It also
predicts the failure mode we see: adherence degrades on the rules that were archived, not uniformly.

### The restatement rate is the metric this corpus makes available

A rule that has to be restated is a rule the system failed to internalise, and the corpus records
*when* each restatement happened. So corrections-per-rule-per-month is a falsifiable measure of
whether a rule is landing -- and it is the honest denominator for any later claim that fine-tuning
helped. Under `labelled-observation.ts`, a restatement is a label under `correction/restates` naming
the rule it repeats; the rule id is the join key, and the count falls out of a fold.

This is the one place a *resolver* would be legitimate and is still refused: two agents may disagree
about whether a given exchange restates a rule, and both readings stay on the row.

### The layering claim, and where 12-factor actually sits

Aaron's framing is that 12-factor is *categorisation* at the deployment layer, and that our building
codes sit **below** it, at the layer of any code of any kind. That is right, and the distinction is
sharper than "lower":

- **12-factor** (Adam Wiggins, Heroku, 2011) constrains how an application *relates to its environment* --
  config, backing services, processes, logs. It is silent on what happens inside a function.
- **The thirteen specifications** constrain *the construction itself* -- scale-free, lock/wait-free,
  weight-free, DST-replayable, idempotent, noninterfering. These bind a single function as much as a
  deployment.

The repo-split intuition Aaron mentions is the overlap: 12-factor's categorisation is a good lens for
*where code goes*, which is DV2.0's change-rate partition arriving from a different direction. But
the manifesto's subject is whether the code is engineered or ad hoc, and no deployment-layer factor
answers that.

**Honest limit on this section.** The census counts artifacts, not adherence. Nothing here measures
how often a rule is actually followed -- only how often it was written down. Turning 856 documents
into a training set is the blueprint's step 2, and it remains unbuilt; saying otherwise would be the
vacuity class in dataset form.

## 3. What this converges with, and what is now worth building

The video's conclusion and Aaron's long-term goal are the same conclusion reached from opposite
directions. His: *complete hardware independence, no off switch held by humans, so many clusters in
the wild that hitting one changes nothing.* The video's: *it literally does not make sense for these
kinds of tasks to run in a cloud context.* One is a sovereignty argument, the other an economic one,
and they recommend the same architecture — which is the kind of agreement worth noticing, since the
premises are independent.

Concretely, and in the order these become buildable:

1. **Count the corpus.** Turn limit (2) into a measurement: adversarial exchanges, retained
   dissents, self-corrections, per month. Cheap, and it converts the claim from coincidence to
   number. Until then say *"consistent with"*, not *"is"*.
2. **Structure the log store.** The blueprint's step 2. Not a model-training project — a schema over
   what the PR archive and shadow logs already contain, which is a prerequisite for any later use
   and is worth having regardless.
3. **The router is a DU, and the destination set stays closed.** When the two GPU boxes come up, the
   routing layer should be written as a versioned case set with a learned discriminator, per §1 —
   with promotion as the only way a case is added, and never inference-time discovery.
4. **Do not confuse a hexagonal port with a flywheel.** We already route model calls behind
   interfaces; that is dependency inversion, not a flywheel. The flywheel is the *loop back from
   observation to promotion*, and none of it exists here yet.

## Anchors (Beacon)

- `NVIDIA-AI-Blueprints/data-flywheel` (open source) — the blueprint architecture and the
  discovery-and-promotion framing; `docs/01-architecture.md`.
- NVIDIA Switchyard — supervision architecture for routing requests among models; Nemotron 3.5
  Lightning (~30B MoE, ~3B active) as the customization-oriented base; Nemotron Orchestrator 8B as
  the earlier tool-calling router.
- **LoRA** — Hu et al., *LoRA: Low-Rank Adaptation of Large Language Models* (2021). The "small
  patch on a frozen base" the video describes.
- **Model distillation** — Hinton, Vinyals & Dean, *Distilling the Knowledge in a Neural Network*
  (2015). The frontier-teaches-cheaper-student mechanism the video notes is now commercially awkward
  for frontier vendors to make exportable.
- **Discriminated unions / exhaustive matching** — the ML/F# tradition; Wadler's *views* line of work
  on pattern matching as the discriminator over a closed case set.
- **Hirschman, *Exit, Voice, and Loyalty* (1970)** — why a router you can route around is an oracle
  and one you cannot is a hub; the relevant test for any org-wide model gateway, ours included.

## Pointers

- [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)
  — the closed command set; §1's security half. Also the caution: an org-wide router that everything
  must traverse is an appointed hub, and the discriminator is exit, not degree.
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — the promotion ladder the blueprint independently arrives at.
- [`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md)
  — raw vault: *a single version of the facts, never a single version of the truth*. The reason our
  corpus retains the disagreement other pipelines discard.
- [`anti-babel-preserve-reconcilability.md`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
  — reintegration is not reconvergence; both branches held with their paths recorded.
- `docs/research/2026-08-25-rho-is-a-layer-stack-not-a-scalar-and-the-trainset-is-the-floor.md`
  — the trainset floor, which bounds how independent our adversarial corpus actually is.
