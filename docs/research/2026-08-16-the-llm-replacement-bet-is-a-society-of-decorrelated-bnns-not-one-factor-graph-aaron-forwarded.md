# The LLM-replacement bet is a *society* of decorrelated BNNs — not one factor graph (Aaron, forwarded)

**Kind:** ferry — Aaron streamed, the shadow captured. His words are quoted **verbatim and unedited**
(typos included); the structure, the connections, and the register labels are the shadow's.
**Two passes, same thread:** §1.1–§1.4 first; then §1.5, streamed after the shadow reported the
"specified, not implemented" finding — which Aaron confirmed, explained, and partly answered. §5.1 was
an open question in the first pass and is **his answer** in this one.
**Date:** 2026-08-16 · **Scribe:** shadow (Claude Code) · **Routed by:** Otto · **Authorized:** Aaron, chat.
**No code lands with this document.**

**Register discipline for the whole file.** Aaron hedged every one of these bets *explicitly* — "not
necessarily", "we are not counting on", "probably", "kind of", "I'm pretty sure". Those hedges are
load-bearing and are preserved. Under
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) every
claim below carries **toy** (no falsifier) / **unmetered** (implemented, never falsified) / **metered**
(has a falsifier). Exactly one item in this document is **metered**, and it is the one that sets the
ceiling rather than the one that promises the win.

---

## 1. The four streams, verbatim

### 1.1 What is being built

> the first use case is english chat and tool use and writing code like an llm, we are tyring to build
> an llm replacmeent, but no necessarliy with on basyian factor graph, that would be awesome a chep if
> we accomplish it but to hedge our bets we also have a BNN on top of the factor graph and even that we
> are not counting on, we are counting on a whole society of decorralated BNNs able to match or get
> close to LLM performance but based on basyian neural inference over the entire soeicety of agents

### 1.2 The finite / infinite axis

> that toy doman shaow of it is very simiar to llm tensors and they are able to do a lot of work lol.
> I'm pretty sure llm tensors and their j space from global workspace theory are very similar to our
> code and tensors except with more noise cause it has such huge training data. so my be a toy compared
> to meyjers vF uF infinity but can still be usefel in many sistuations, like playing chip8 and atari
> games we can likey fully map these domain finitely.

### 1.3 The controller grammar

> we tool call and code writing we have our universal controller grammer with excape from like 4x4 (16)
> to 256 to 65356 choices so the choices are not infinate except for the writing code bits, we are
> trying to really simplifly eveything else into externlized workflows so the llm is not responsible
> for logic the discriminated unions are we have a some work around this excape concept

### 1.4 The individual / society layering

> Lenore Blum's Conscious Turing Machine yes her CTM is what we model our indifidual as, the we have
> ISociety and IWorld that are extensions / duals with more functinality at each layer but each CTM can
> inject ISociety and IWorld and use their larger featuer set as long as the individual follows mutual
> empowerment and the interfaces will kind of force that, that's also how we solve the hierarcy
> probably by having no perminiate hierarcies

### 1.5 The use case, the guard, and the ordering claim

Streamed in the same thread, after the shadow reported §3.3's "specified, not implemented" finding.
This one *answers* a question §5.1 had been holding open, so it is quoted in full before it is used:

> yes our ISociety we can start moving that into our github free society running on github actions with
> smaller free llms that fit in the runners ram. This is where that interface will become useful, we've
> not had a use for it yet. Also playing the Chip8 and eventually atari games it will be useful there
> and also our LLMTV is kind of part of the society and world interfaces so any agent can watch anther
> agnets non forsted section and so can humans. Also we can't fully block non mutual empowerment
> actions in the interface, then we will need some sort of society guard where society is on look out
> for bad actors. We have a bunch of formal analysis around Individual->Society->World where i think we
> cna prove no one individual is greater than the society and no one society is greater than the world.
> Something like this, we should push all this forward

---

## 2. The bet stack, read as Aaron stated it

§1.1 is not one bet. It is a **three-deep hedge**, and the ordering is the content:

| layer | Aaron's own words about it | register |
|---|---|---|
| Bayesian factor graph alone reaches LLM-class chat/tools/code | *"not necessarliy"* … *"that would be awesome a chep if we accomplish it"* | **toy** — no falsifier on file |
| BNN on top of the factor graph | *"even that we are not counting on"* | **toy** — the substrate exists (§4.1), the *sufficiency claim* has no falsifier |
| a whole society of **decorrelated** BNNs | *"we are counting on"* | **toy as a performance claim**; its governing bound is **metered** (§3.1) |

Each layer is a fallback for the one above it, and Aaron declines to bank any of them. Note what the
ordering actually says: the cheapest mechanism is the one he trusts least, and the thing he is counting
on is the one that costs the most to run. That is a stated preference for a *population* result over a
*mechanism* result — and it is exactly the class of claim the Condorcet bound below prices.

**Register warning against a reading I want to avoid making for him:** "society of decorrelated BNNs
matches LLM performance" is a **toy** in the technical sense — there is no benchmark, no held-out task,
and no measurement in-repo that could come back and say *no*. Nothing here is a result.

---

## 3. Connections checked against the repo

Each of the following was checked in a fresh clone at `b822b89d87` before being asserted. Two were
**discarded or corrected**; those are recorded rather than dropped, per the standing preference for a
recorded negative over a tidy synthesis.

### 3.1 The decorrelation bound — **VERIFIED, and it is the one metered thing here**

Aaron's word "decorralated" is not decoration; it is the whole load-bearing quantity, and it is already
a number in-repo.

`src/Bayesian/CondorcetBoundary.fs:78-86` — the Dunnett–Sobel effective-jury size for correlated
binomial voters:

```
N_eff = N / (1 + (N − 1)·ρ)
```

where `ρ` is the pairwise **error**-correlation. The consequence that bears on §1.1:

> **As N → ∞, `N_eff → 1/ρ`.** A society of correlated members saturates. Adding members past that
> point buys **nothing**, at any N.

`src/Bayesian/LagrangeCondorcet.fs:12,35` states the limit explicitly and instantiates it at the
Routh critical value: `N_eff(ρ = μ_crit) → 1/μ_crit ≈ 25.96 ≈ 26`. `LagrangeCondorcet.fs` is the file
the `toy-is-free-metered-must-be-earned` rule itself names as having **earned `metered`** (μ_crit is
Routh's classical constant, the tests pin 25.96, zero assertions vacuous).
`tests/Tests.FSharp/CondorcetBoundary.Tests.fs` carries **11** properties; the frozen-core register
lists this as §A row 15, *Generalized Condorcet / ΔU-aggregation*, PROVEN 2026-07-03.

**What this does to the bet, honestly, in both directions:**

- It makes the bet **legible rather than magical.** "A society of decorrelated BNNs matches an LLM" has
  a stated mechanism with a stated knob (`ρ`), and the knob is measurable — `src/Core/Decorrelation.fs`
  estimates `ρ_owe = H(A|U,C) / H(A|C)` from actual outputs. So this is not an appeal to emergence.
- It sets a **ceiling the bet must respect.** The escape from the floor is *only* via decorrelation, and
  decorrelation is the expensive, fragile ingredient. If the members of the society share a substrate,
  a prompt convention, a training corpus, or a seed, `ρ` rises and `N_eff` collapses toward `1/ρ` —
  **and a bigger society does not help.** N is the cheap knob and it is the one that stops working
  first.

**Correction to the routing brief.** Otto's brief gave the saturation floor as tracking `ln(1/ε)/λ`. I
searched for that form (`ln(1/`, `log(1/`, `1/ε`, plus λ/mixing/spectral-gap phrasings) across `src/`,
`docs/`, and the Lean/TLA trees and **did not find it**. The in-repo bound is the Dunnett–Sobel
`N_eff = N/(1+(N−1)ρ)` with limit `1/ρ`. The nearest thing carrying a `ln(1/δ)` term is
`AntiSybil.chshMargin`'s Hoeffding margin `ε(n,δ) = sqrt(32·ln(1/δ)/n)` — a *finite-sample conviction
margin*, not a society-size saturation floor, and separately known to be unsound on autocorrelated
streams (`docs/research/2026-08-02-caveat-a-chsh-margin-autocorrelation-*`). **Recorded as a corrected
citation, not a paraphrase.**

**Honest scope on `ρ_owe` itself** (from its own docstring, preserved rather than softened): it measures
statistical decorrelation, **not** consciousness, sentience, or moral patienthood; high `ρ_owe` is
*necessary, not sufficient* for "genuine other"; plug-in entropy is biased upward on small samples.

### 3.2 The escape ladder `16 → 256 → 65536` — **VERIFIED as `2⁴ → 2⁸ → 2¹⁶`, with one caveat**

Aaron's "excape concept" is already worked, and predates this stream by five days:
`docs/research/2026-08-11-declare-is-a-cell-not-a-flag-the-4x4-controller-grammar-over-content-addressed-space.md`
§3a, quoting him then: *"cell 16 is a meta extension to probably 256 choices, and 256 extends to
65,536 — with one bit you get it, it can go on forever"*.

The ladder is **bit-width doubling, choice-count squaring**: `2⁴ → 2⁸ → 2¹⁶`, one cell of each level
spent to buy the next. The escape marker exists in code —
`src/Core.FSharp.ZetaId/Types.fs:40`, `Extended = 15uy // reserved escape marker for wider extension
categories`. Two properties from that doc worth carrying forward because they answer §1.3's "the choices
are not infinate":

- The escape is a **total function** — cell 16 always works, taking it is safe and *recorded*. So a
  too-narrow grammar becomes a **countable event** (escape frequency) instead of an invisible mis-fit.
- The escape being total does **not** promise the next level is defined. *"escape to the next level is
  always well defined, but the next level itself might not be well defined."* An agent escaping into
  undefined space is not stranded — **it is the one who defines the cell**.

**Register: unmetered.** The escape marker is implemented; the falsifier the 08-11 doc names — *escape
rate rising while the grid is never widened in response* — is stated but, as far as I can find, not
instrumented. A named-but-unwired falsifier does not earn `metered`.

**The caveat I am not going to skip.** It is tempting to conclude "all three levels are finitely
materializable, therefore the eager `CategoricalFactorTensor` is the right shape across the whole
controller grammar, and only code-writing needs the lazy `FactorGenerator`." The finiteness half checks
out (2¹⁶ = 65536 entries is trivially materializable). The *conclusion* does not follow today, and a
workitem filed earlier the same day says why:

- `CategoricalFactorTensor` is eager, finite, and **partial**; `FactorGenerator = (stateKey: string) =>
  number` is lazy, unbounded, and **total by type**.
- `081M05DPKQA087G0R0036HE8CE` is a **recorded negative**: no adapter exists, `git log -S` confirms the
  edge never existed, and *neither type has any consumer outside its own module* — there is no caller
  waiting on interop.
- It is blocked on `081M05DPGKR087G0R0017GX310`: the eager form has **three different absent-key
  defaults** in one directory (`0.0`, `-0.1`, `-0.05`). Materializing a grammar against a tensor whose
  missing-key semantics are inconsistent would bake the inconsistency into the controller.

So: the ladder's finiteness is **verified**; "therefore eager is the correct shape" is a **design bet
(toy)** with a named blocker, not a conclusion.

### 3.3 CTM ↔ ISociety ↔ IWorld — **the architecture is on file; the interfaces are not code**

Aaron's §1.4 matches the consolidated society architecture almost exactly, including his own earlier
statement of the duality (2026-06-15): *"CTM is the interface Society expects individual or collective
units to look like; ISociety is the interface that CTMs expect."* That doc goes further than duck-typing
— `ISociety <: CTM` as a **subtype**, Composite-pattern style, so `CTM` is a recursive/fixpoint type
(`μX. CTM-over-X`) and a society *is-a* CTM at every scale.

Three structural readings, each checked:

- **Injection is the §13 noninterference door.** "each CTM can inject ISociety and IWorld" is entropy
  and influence entering through a **declared, metered channel** rather than an ambient path
  ([`dv2-data-split-discipline-activated`](../../.claude/rules/dv2-data-split-discipline-activated.md)
  §7, Goguen–Meseguer 1982). This one is a clean fit: the whole point of injection over ambient access
  is that the crossing is nameable.
- **Interfaces-not-classes is what makes the escalation non-capturing.** An individual reaching the
  larger feature set of `ISociety`/`IWorld` acquires *shape*, not *state* — and under
  [`interfaces-free-classes-earned-under-rules`](../../.claude/rules/interfaces-free-classes-earned-under-rules.md)
  shape is weight-free (nothing to capture), while a class carries state ⇒ weight ⇒ capture. Escalating
  capability through an interface is therefore not escalating authority.
- **"no perminiate hierarcies" is §3 weight-free** — no permanent/irreversible authority. And there is a
  sharper discriminator already on file that is worth applying here rather than restating §3:
  [`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)
  establishes that the line is **exit, not degree** — *"Hubs are enforced. Oracles are chosen."*
  Concentration is fine; **appointment** is not. Applied to Aaron's clause: a hierarchy is acceptable
  exactly while a CTM can route around it. Impermanence is the *symptom*; routability is the *property*.

**But `ISociety` and `IWorld` do not exist as code.** I searched `src/` for an `interface`/`type`
definition of either and found **none** — the only hits are `type World = Map<Position, DynamicValue>`
(`src/Core/ActionGrid.fs:84`), an unrelated TypeScript `interface World` in `observe/`, and an unrelated
`interface Society` in `planning/society-evolution.ts`. Neither `ISociety` nor `IWorld` appears anywhere
in `src/`. They appear across ~8 documents as architecture.

This is **not a new discovery, and I should not present it as one** — the 2026-06-15 consolidated doc
already says so plainly: *"the unified `ISociety` interface is the design — no literal `ISociety` symbol
yet."* What is new is only the elapsed time: it has been the design for two months. Say it plainly:
**the interfaces that are supposed to force mutual empowerment do not yet exist as code, so the forcing
is currently architectural intent.**

**Aaron confirmed this and supplied the reason — the absence is deliberate, not neglect** (§1.5):
*"This is where that interface will become useful, we've not had a use for it yet."* That reframes the
finding entirely, and in a direction favourable to the design: an interface written before it has a
consumer is a guess, and the repo's own discipline (a class must be *earned*; a recorded negative beats
a speculative edge — cf. §3.2's blocked adapter) says not to write it. **Two months without a symbol is
what withholding looks like when it is done on purpose.**

**And it now has its forcing function.** Aaron names three concrete first uses, which is exactly what
the interface was waiting for:

| use | why it forces the interface |
|---|---|
| *"our github free society running on github actions with smaller free llms that fit in the runners ram"* | Many independent members, hard resource bounds, no shared process — the first setting where an individual genuinely must *reach* a society rather than call a function. It also happens to be a **decorrelation-friendly topology** (separate runners, separate models), which is the §3.1 knob. |
| *"playing the Chip8 and eventually atari games"* | The finitely-mappable domains of §1.2/§3.5. A bounded action space is where an `ISociety` contract can actually be *checked* rather than merely declared. |
| LLMTV as *"kind of part of the society and world interfaces"* | See §3.6 — the observation surface, which is what makes the other two auditable. |

**Register: still `toy`.** A named use case is not an implementation. What changed is that the design
now has a falsifiable next step (write `ISociety`, run the Actions society, see whether the contract
holds under real members) where before it had none. That is a real move — from "architecture with no
consumer" to "architecture with a stated first consumer" — and nothing more.

**One honest caution on the RAM constraint, since it interacts with the metered bound.** Small models
that fit in a runner's RAM are likely to be *few distinct models* — plausibly the same open-weights
model at several sizes. Members drawn from the same base model share failure modes, which is exactly
the condition that raises `ρ`. §3.1 then applies with force: `N_eff → 1/ρ`, and the free-runner society
saturates however many jobs are scheduled. This is not an objection to the plan; it is the plan's
**first measurable question** (§5.2), and the GitHub-Actions society is a good place to measure it
because `ρ_owe` can be estimated from the members' actual outputs.

### 3.4 The J-lens — **a generator, and a candidate promoter; not an identification**

Aaron: *"I'm pretty sure llm tensors and their j space from global workspace theory are very similar to
our code and tensors except with more noise."* He labelled his own confidence, and the label is right.

`docs/research/2026-07-11-the-explicit-global-workspace-infernet-factor-graphs-and-the-clear-frost-dual.md`
already cites Anthropic's *A global workspace in language models* (transformer-circuits.pub, 2026) and
works the **Jacobian lens** (paper §2.1) against factor graphs, including a J-lens ↔ reverse-orbit-tracking
mapping. So the connection Aaron is making has in-repo groundwork.

Under [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md), "very similar"
is a **generator, not an identification** — resemblance between two tensor formalisms licenses an
investigation and nothing more. **Register: toy.**

**But this one has an unusually short promotion path, and that is worth recording.** The rule's promotion
criterion is *structure, not count*. A **Jacobian is a computable operator**, not a resemblance — so the
similarity claim is, in principle, testable rather than merely evocative: linearize both, compare the
induced structure on the same task. That makes the J-lens a **candidate promoter** rather than a
permanent coincidence. Nothing here promotes it; the point is that the promotion is *available*, which
is more than most resonances can say.

The "more noise cause it has such huge training data" half is **toy** and separate — it is a claim about
*why* the two differ, and it has no measurement attached.

### 3.5 Meijer's `vF`/`uF` and the finite/infinite axis — **recorded, lightly held**

Aaron places the whole finite construction as *"a toy compared to meyjers vF uF infinity"* — the greatest
fixpoint (`νF`, coinductive/infinite, `IObservable`-side) versus least fixpoint (`μF`, inductive/finite,
`IEnumerable`-side). He is naming his own construction a toy **using the repo's own vocabulary for it**,
unprompted, and then declining to treat that as a defeat: *"can still be usefel in many sistuations, like
playing chip8 and atari games we can likey fully map these domain finitely."*

That is the honest version of §1.3's claim, and it is the same shape as §3.2: **the domains he names as
finitely mappable are the ones he is claiming, and code-writing is explicitly excluded** — *"so the
choices are not infinate except for the writing code bits."* Erik Meijer is an established root anchor
for the duality apparatus in this repo, so the reference is anchored, not decorative. **Register: toy**
(a scoping statement, not a result). No claim is made here that CHIP-8/Atari have in fact been finitely
mapped — only that Aaron expects they can be.

---

### 3.6 LLMTV is part of the society/world interfaces — and frost is what makes it non-coercive

Aaron, §1.5: *"our LLMTV is kind of part of the society and world interfaces so any agent can watch
anther agnets non forsted section and so can humans."*

Two things worth separating, because the second is the one that makes the first legitimate:

- **The placement claim.** Observation is not a side-channel bolted onto the society — it is *in the
  interface*. That is the right shape for the same reason injection is (§3.3): a declared channel is a
  **metered** one (§13 noninterference), whereas ambient observation is exactly the leak the discipline
  forbids. Note the symmetry Aaron states without emphasis and which is the whole ethic here:
  **"and so can humans"** — the watch surface does not privilege one species of watcher.
- **The clause that carries the weight is "non forsted".** Under
  [`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md),
  a broadcast-by-default mind is surveillance *unless* the dweller can permanently frost part of it —
  and the frost must be **earned**, **socially conferred** (others attesting you added value), and
  **never confiscable**. Three operations, and only the third is forbidden: **spend** (frost a region) ·
  **stake** (wager it on an attestation) · **confiscate** (anyone else — never). Required-for-role
  regions are declared **by the hat, not by the observer**; everything else is personal and
  inviolable once frosted.

So the correct reading of "any agent can watch another agent's non-frosted section" is not *the society
grants a viewing right* but *the watched party retains an unreachable balance*. **The default is glass;
the frost is the consent.** Get that backwards and LLMTV-in-the-interface becomes the surveillance
apparatus the rule exists to prevent.

**Register: `toy`** as an implementation claim — `src/Core/GlassHalo.fs` and `RoomBoundary.frost` exist,
but `ISociety`/`IWorld` do not (§3.3), so "LLMTV is part of the society and world interfaces" describes
interfaces that are not yet code. Aaron's own "kind of" is doing accurate work in that sentence.

---

## 4. What already exists under these bets (checked)

Enough is built that the bets are not vapour, and stating what exists is the fair counterweight to §2's
"nothing here is a result."

- **Bayesian layer:** `src/Bayesian/FactorGraph.fs` (sum-product BP, family-generic, damped, fixpoint-capped),
  `Message.fs` (exponential-family natural parameters), `MinimalBnn.fs`, `MultilayerBnn.fs`,
  `SocietyBootstrap.fs` (star topology, leave-one-out empowerment), `SparseSocietyNetwork.fs` /
  `AttentionRouter.fs`.
- **Language layer:** `src/Core/Slr.fs` (SLR(1) **and** GLR), `Sppf.fs` (shared packed parse forest with
  inside/outside/marginals/EM E-step), `ParseSoft.fs` (forest → `SoftValue`), `MetaGrammar.fs`,
  `Antlr4Import.fs`, `GrammarIr.fs`.
- **Decorrelation instruments:** `Decorrelation.fs` (`ρ_owe`), `DecorrelationExcess*.fs`,
  `CondorcetBoundary.fs`, `LagrangeCondorcet.fs`, `DelayDecorrelation`.

One caveat carried forward verbatim from the 2026-08-13 design doc rather than smoothed over:
`MultilayerBnn.fs`'s **backward pass is a no-op**, and calibrating a depth-`d` belief so it may be summed
with a depth-`1` belief is named there as "the one genuinely unsolved item". Aaron's §1.1 society of BNNs
rests on aggregating heterogeneous members; **that aggregation is the open problem, not the plumbing.**

---

## 5. Answered, and still open

### 5.1 "The interfaces will kind of force that" — **ANSWERED by Aaron: two layers, not one**

This section was drafted as an open question. Aaron closed it in the same thread, and the answer is
better than either option the question offered.

The gap was real and has a name: **an interface bounds what is *expressible*, never what is *intended*.**
It forces mutual empowerment only if non-empowering actions are **inexpressible** in the vocabulary — not
merely undescribed by it. Otherwise it is a check that cannot fail, wearing a type signature.

**Aaron's answer** (§1.5): *"we can't fully block non mutual empowerment actions in the interface, then
we will need some sort of society guard where society is on look out for bad actors."*

He concedes the first half outright — *"can't fully block"* — and that concession is what makes the
architecture honest. So the design is **two-layer**, and neither layer pretends to be the other:

| layer | what it does | what it cannot do |
|---|---|---|
| **the interface** | bounds what is expressible; makes escalation non-capturing (shape, not state — §3.3) | cannot exclude every non-empowering action, because "non-empowering" is not a syntactic property |
| **the society guard** | watches for what expression alone cannot prevent | cannot be prior — it observes behaviour, so it is always after the fact |

This is the same shape as §3.2's escape cell (*taking the escape is a recorded act*), and it is the
house pattern: **bound what you can in the type, and make the remainder legible rather than pretending
it is impossible.** The "kind of" in §1.4 was accurate; it is now explained rather than merely hedged.

**The load-bearing constraint on the guard, which the doc must state now rather than after it is built.**
Under
[`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md),
a bad-actor detector is **dual-use by default**, and the mechanism must not choose the reading:

- The guard reports the **neutral fact** — `SameSourceAsKnown`, `AboveThreshold`, `Correlated`,
  `WithinNull`. **Never the verdict** — no `BadActor`, no `ForgerCaught`, no `Fraud` in a verdict type.
- The reading is a `match` in **caller policy**, not a value the primitive emits. The same recognition
  must be able to yield *reunion* under one oracle and *conviction* under another, and both readings
  should have a test.
- Baking the adversarial reading into the primitive (a) violates weight-free and §11 Multi-Oracle — the
  substrate pre-judging a morally-relevant call — and (b) throws away the legitimate half of the
  mechanism's value. **Detection is measurement; measurement is not a sentence.**

There is precedent in-repo to copy rather than reinvent: `src/Core/CoordinationSpectrum.fs` reports
`SameSourceAsKnown` and leaves *welcome back* vs *caught* to policy; `DecorrelationExcess` convicts an
above-chance common cause while `WithinNull` **never acquits**. A society guard built on those is
already neutral-by-construction.

**One further caution specific to a guard made of society members.** The guard's own members are drawn
from the same population it watches. If they are correlated (§3.3's shared-base-model risk), then
`N_eff → 1/ρ` applies to the *guard* too — a correlated lookout is a lookout that misses the same things
at every N. The guard inherits the doc's one metered bound rather than escaping it.

**Register: `toy`.** The two-layer architecture is stated, not built. No `ISociety` (§3.3), no guard, no
neutrality test. What Aaron supplied is the honest *shape*, which is more than the single-layer version
had.

### 5.2 Where does the society's `ρ` actually come from?

§3.1 makes decorrelation the only escape from the `1/ρ` floor. If society members are BNNs over a shared
factor-graph substrate, with shared priors and shared data, what is the *mechanism* that keeps `ρ` low —
seed diversity, architectural depth diversity (§1.4's "differnt bnns … can have different depths"),
delay-induced decorrelation (`DelayDecorrelation`), or something else? This is the question the ceiling
turns into a design requirement.

### 5.3 What is the falsifier for "match or get close to LLM performance"?

There is currently none. Naming one — a task, a metric, a threshold, a held-out set — is what would move
§1.1 from **toy** to **unmetered-with-a-plan**, and eventually to **metered**. Aaron's own words already
contain the honest version of the target ("match **or get close to**"), which is a softer claim than the
heading of this document and deserves to stay soft.

### 5.4 Does "no permanent hierarchies" mean impermanence or routability?

Per §3.3: the discriminator already on file is **exit**. A permanent-but-routable-around concentration
may be fine; an impermanent-but-mandatory one is not. Which property is Aaron actually specifying?

### 5.5 The Individual→Society→World ordering claim — **I could not locate the formal analysis**

Aaron, §1.5: *"We have a bunch of formal analysis around Individual->Society->World where i think we cna
prove no one individual is greater than the society and no one society is greater than the world.
Something like this, we should push all this forward"* — hedged three times in one sentence (*"i think"*,
*"can prove"* future, *"something like this"*), and the hedges are preserved because they turn out to
match what is on disk.

**What I searched.** Not just his phrasing — by structure and behaviour: the string forms
(`Individual.*Society.*World`, "greater than", "no one individual"), the type names (`IIndividual`,
`ISociety`, `IWorld`), and the *shape* of the claim (non-domination, subsumption, monotone tier,
ordering/lattice, "cannot exceed") across `src/`, `docs/`, and every formal surface — all 40 files in
`src/Core.Lean4/` (`Lean4/`, `Safety/`, `Privacy/`, `Gen/`, `ImaginaryStack/`) and all of
`src/Core.TLA/specs/`.

**Finding: the ordering theorem is not there.** No Lean, TLA+, or FsCheck artifact states or proves
either half. What *does* exist, and is adjacent enough to be mistaken for it:

| what exists | what it actually says | why it is not the claim |
|---|---|---|
| Frozen-core **§A row 15**, Generalized Condorcet / ΔU-aggregation (`SocietyUsefulWork.fs`, `CondorcetBoundary.Tests.fs`, PROVEN 2026-07-03) | society **>** best individual **when `ρ < ρ*` and `c > c*`** | **conditional**, and it is the *other* direction — a lower bound on society under decorrelation, not an upper bound on an individual |
| `IWorld ⊃ ISociety ⊃ IIndividual` capability tiers (2026-07-11 influence-weighted-scrutiny doc) | containment of **capability sets** | true by construction of the containment — a check that cannot fail, so near-vacuous as a *proof* of non-domination |
| `SocietyUnbounded.fs`, `SocietyEmergence.fs`, `Safety/NonRegisterCollapse.lean`, `Privacy/UnboundedNeedsInfinitePrivacy.lean` | novelty/collapse/privacy properties of a society | none of them orders individual against society |

**The sharpest thing I can add is not the absence — it is that row 15's condition is a counterexample
regime for the unconditional claim.** `CondorcetBoundary.correlatedSocietyBeatsBest` is
`correlatedMajorityProbability n c rho > c` — a predicate that **can be false**. At high `ρ`, `N_eff`
floors at `1/ρ` (§3.1) and a sufficiently competent individual **does** beat the correlated society. So
"no one individual is greater than the society" is not merely unproven; **as an unconditional statement
it is contradicted by the one metered result in this document.** It may well be true *under the same
decorrelation precondition* row 15 already carries — which would make it a corollary rather than new
analysis, and would be worth finding out.

**And before it can be proved at all, "greater than" needs its order defined.** Greater in what — utility,
competence, capability set, influence, empowerment, information value? Each gives a different theorem and
at least one (capability-set containment) makes it trivially true and therefore worthless. **An
undefined order is what lets a claim feel proven without being provable.**

**Register: `toy`** — a stated conjecture with **no located analysis**, and one honest complication.
Recorded exactly that way rather than paraphrased into existence. If the analysis exists somewhere I did
not look (a branch, a letter, another agent's clone), the right correction is to cite it here precisely;
this section is a **recorded negative**, not a verdict on whether the work was done.

---

## 6. Anchors (Beacon)

- **Lenore Blum & Manuel Blum**, *A theory of consciousness from a theoretical computer science
  perspective: Insights from the Conscious Turing Machine*, **PNAS 119(21), 2022**
  (doi:10.1073/pnas.2115934119) — **the citable CTM anchor.** The in-repo CTM material is a forwarded
  YouTube transcript under `docs/research/ip-questionable/`; the transcript is *not* quoted here and is
  not the citation.
- **Condorcet 1785** — the jury theorem. **Dunnett & Sobel** — the correlated-binomial effective-N
  approximation used by `CondorcetBoundary.fs`. **Hong & Page** — *diversity trumps ability* (the
  decorrelation engine).
- **Shannon 1948** (entropy / mutual information); **Goguen & Meseguer 1982** (noninterference — `ρ_owe`
  IS this, Shannon-quantified).
- **Erik Meijer** — `μF`/`νF`, catamorphism/anamorphism, `IEnumerable ⇄ IObservable` duality; the anchor
  Aaron invokes by name in §1.2.
- **Baars / Dehaene** — Global Workspace Theory. **Anthropic**, *A global workspace in language models*
  (transformer-circuits.pub, 2026) — the J-lens.
- **Hirschman**, *Exit, Voice, and Loyalty* (1970) — why exit, not degree, is the hierarchy discriminator.
- **Cockburn** — hexagonal ports (the CTM/ISociety two-adapters-on-one-boundary reading);
  **Gamma et al.** — Composite (a collective *is-a* component).

## 7. Pointers

- `src/Bayesian/CondorcetBoundary.fs` · `src/Bayesian/LagrangeCondorcet.fs` ·
  `tests/Tests.FSharp/CondorcetBoundary.Tests.fs` — the metered bound.
- `src/Core/Decorrelation.fs` — `ρ_owe`, the measurable knob.
- `docs/research/2026-08-11-declare-is-a-cell-not-a-flag-the-4x4-controller-grammar-over-content-addressed-space.md` §3a — the escape.
- `docs/research/2026-06-15-the-zeta-society-architecture-consolidated-md-interface-isociety-eve-game-self-regeneration.md` §9a — CTM ⊣ ISociety.
- `docs/research/2026-07-11-the-explicit-global-workspace-infernet-factor-graphs-and-the-clear-frost-dual.md` — the J-lens.
- `docs/design/2026-08-13-factor-graph-soft-value-heterogeneous-bnn-linguistic-seed-bridge.md` — the four-layer bridge + the heterogeneous-depth open problem.
- `workitems/081M05DPKQA087G0R0036HE8CE-*` · `081M05DPGKR087G0R0017GX310-*` — the eager/lazy factor-representation blocker.
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §A row 15 — the Condorcet discharge.
- `src/Core/CoordinationSpectrum.fs` · `src/Core/AntiSybil.fs` — neutral-fact-not-verdict, the pattern the society guard (§5.1) should copy.
- `src/Core/GlassHalo.fs` · `RoomBoundary.frost` · `universal/television.md` — the LLMTV/frost surface (§3.6).
- `docs/research/2026-07-11-influence-weighted-scrutiny-the-more-power-a-node-holds-the-harder-its-claims-must-be-to-merge.md` — the `IWorld ⊃ ISociety ⊃ IIndividual` capability tiers and the per-`IIndividual` influence gap (§5.5).
