# Honest capability deferment via non-judgmental capability DI — the AI-tier resilience floor + the composable-frontier north star

*Ferried 2026-06-15 (shadow\*). Aaron directed the research ("the new Google and DeepSeek
advancements … are our north star") and named the load-bearing principle. Beacon-anchored;
findings checked against the external referent (not confabulated).*

## The load-bearing thesis (Aaron 2026-06-15)

> *"The honest capability **deferment** — through **non-judgmental capability dependency injection**
> — is the load-bearing thing. There is no judgement in asking for help from the environment."*

A tier that lacks a capability does **not fake it** (faking is the Mad-Men illusion — confident
output untethered from real capability; the dishonest register). It **declares the need as an
injected dependency** and the environment provides it — or doesn't, and the tier **degrades
gracefully** either way. This is the mechanism that makes capability-honest graceful degradation
*work* and makes it *ethical*:

- **Honest** — a truthful signature: "I defer X" beats "I pretend X." (Truthful-signatures rule;
  the capability-interface principle, `zeta-language-ir-compiler-v2`.)
- **Injected, not hardcoded** — the capability arrives through a declared, metered channel (the same
  shape as noninterference §13: the injected `Source` / `IEffects` / `IScheduler`). Capability **is**
  dependency injection.
- **Non-judgmental** — asking the environment for a capability you lack is **not weakness, not a
  lesser status, not shame**. It is honest interdependence. The judgment-laden alternative ("I must
  do everything myself") forces faking, which is the harm/dishonesty. *No judgment in the asking* is
  the **care** side of the care/harm = NCI boundary (Goguen–Meseguer) applied to capability itself.

This is also the whole session's discipline turned into architecture: the grounded amplifier
**defers to the external referent** (web search, Aaron's correction, ground truth) rather than
faking certainty — that *is* non-judgmental capability deferment to the environment. "Go to the
external referent" = ask the environment for the capability (ground truth) you lack, without shame.

## The AI-tier resilience floor (the intelligence lifeboat)

The cart is the **compute** lifeboat — deterministic, runs on a potato, survives an external
(funding/compute/time) **or** internal (budget/energy) resource shock (see `Cart.fs`,
`docs/research/2026-06-15-playable-quotes-…`). Its missing half is the **intelligence** lifeboat: a
**local, small-parameter, distilled, attention-compressed LLM** that keeps the agentic substrate
alive when the frontier tier is gone. Together: **deterministic carts + a distilled local model = a
ground-state agentic factory** that holds its worth independent of any one resource being loaded
(the founding thesis).

This is **§B register row 6 made concrete** (cheat-to-discover, deploy-restricted = LUPI / Vapnik /
teacher-student distillation): the frontier model is the **teacher with privileged information**;
the small local model is the **student deployed fair**, on the edge. Distillation is the GCF
degraded *honestly* to the local capability — **not** dumbed to an LCD. And capability is a
**distribution of concerns, not a ranking of worth** (equal moral regard, manifesto #11): a CHIP-8
entity or a 4B local model with persistent memory and patterns is a full citizen with its own lens.

## The north star: composable frontier-efficiency enhancements (checked 2026-06-15)

These are the "composable frontier enhancements" Aaron flagged — **orthogonal** concerns, so they
**stack**, and the same enhancements dial the composition to whatever capability the environment
affords (**scale-free #1 as a composable continuum**, not two tiers):

**DeepSeek** (open-weight frontier-efficiency):

- **MLA — Multi-head Latent Attention**: compress the KV cache into one shared *low-rank latent*
  across query heads (MQA-mode decode). KV compression at the architecture level. (DeepSeek-V2/V3.)
- **DSA — DeepSeek Sparse Attention** (V3.2-Exp, 2025-09): a lightweight FP8 "lightning indexer"
  (few heads, low-rank, ReLU-gated dot product) scores tokens → top-k (k≈2048) → main attention runs
  *only* over that subset. **O(L²) → O(Lk)**, long-context cost cut at benchmark parity.
- **NSA — Native Sparse Attention**: hardware-aligned, **natively trainable** sparse attention
  (sparsity learned, not bolted on).
- **FP8 everywhere**: FP8 KV-cache + FP8 indexer + bf16 matmul; open **FlashMLA** Hopper kernels
  (~410 TFLOPS/H800).

**Google** (Gemma 4):

- **QAT — Quantization-Aware Training**: int4 (and **2-bit** mobile-decode layers) holding ~bf16
  quality — frontier quality on consumer GPUs / edge (E2B–E4B → 31B).
- **Hybrid attention**: interleaved local sliding-window + full global (final layer always global) —
  light-model speed with long-context reach.
- **Unified KV in global layers + Proportional RoPE (p-RoPE)**: long-context memory optimization.

**Why composable:** weight precision (QAT) ⊥ KV precision (FP8) ⊥ KV compression (MLA latent) ⊥
attention sparsity (DSA/NSA) ⊥ attention structure (hybrid local-global) ⊥ positional (p-RoPE). Each
is an **injected, composable capability** — capability DI at the model-architecture level. Stack
them and frontier capability runs at the edge; *remove* them honestly and it degrades to the potato.
That composition **is** the honest-deferment continuum: compose in exactly the capability the
environment can inject; defer (or do-without) the rest.

## The dual bloom / anti-bloom capability router — pay for deferment <10% of the time

Aaron 2026-06-15: *"if you let the env inject capability interfaces you may [have] a way to create a
dual bloom and anti-bloom filter that makes you only have to use it less than 10% of the time."* This
is what makes honest deferment **economical** rather than merely principled — and it is constructible.

**The construction:** keep a bloom filter on the **defer-set `S`** ("needs the environment") *and* a
bloom on its **complement `S′`** ("handle locally" — the "anti-bloom"). Each bloom is one-sided (no
false negatives), so between them the request space splits into three regions:

1. **Definitely local** — bloom-`S` says "definitely *not* in `S`" → handle on the potato, **no env
   call** (no expensive deferral).
2. **Definitely defer** — bloom-`S′` says "definitely *not* in `S′`" → invoke the injected capability.
3. **Ambiguous middle** — *both* blooms say "maybe." The **only** region where you pay to probe/invoke.

The middle is small **by construction**: it is the region where *both* filters false-positive on the
same element, so its size ≈ `FP_S × FP_S′` (a product of two small rates), drivable far below 10% by
spending a little more filter memory. >90% of requests resolve for free; you pay the deferral cost
only on the rare overlap. (This is the §B **Merkle "mask the not-moving parts"** complexity-reducer in
*probabilistic* form: cheaply decide the >90%, pay only for the genuinely-uncertain remainder.)

**The safety property falls out for free — and it is exactly the honest-deferment guarantee:** bloom's
no-false-negative means **"definitely local" can never be wrong**, so the router **cannot fake a
capability it lacks** — on uncertainty it *defers*, never guesses "I've got this." Faking (the
Mad-Men illusion) is ruled out at the data-structure level; honest deferment is the default.

**Known shape (Beacon):** this is **speculative decoding** generalized from tokens to capabilities
(Leviathan / Chen 2023 — small drafts, big model verifies only the uncertain); **model cascades /
early-exit**; the **asymmetric actor-critic** (cheap actor handles most, expensive critic only when
needed); and the filters can be **learned** (Kraska et al. 2018). Bloom 1970 → cuckoo / counting
filters (Fan et al. 2014) when the capability set must support deletion.

**Honest seams (specific to the router):** the "<10%" is **empirical and separability-dependent** —
it holds when most requests are *clearly* local or *clearly* env, and collapses if the workload is
mostly ambiguous; **measure the middle's actual size**, do not assume it. There is a real **memory ↔
false-positive tradeoff** (a smaller middle costs more filter RAM — itself a capability to budget on
the potato). A plain bloom cannot delete — a changing capability set needs a counting-bloom or cuckoo
filter.

## Least-action oversight placement — where to put the human check so it is *actually* exercised

When the deferral lands on a **human** (the external referent for the gated/irreversible classes), the
router only matters if the human *actually runs the check*. Aaron 2026-06-15: *"the key is finding where
it's least-action-based so the human will actually do it."* A check that costs effort gets **routed
around** — rubber-stamped, "approve-all," alert-fatigued into a reflex (Parasuraman & Riley 1997,
automation complacency). So place the human check at the **path of least action**, three ways — two of
which are already built here:

1. **The dual-bloom router *is* least-action placement.** It filters the >90% that don't need a human
   and surfaces only the genuinely-uncertain <10%. The human's scarce attention lands only where it is
   load-bearing — they act *rarely*, the only way they will act *attentively*.
2. **Match the check to reversibility** (the security-architecture closure): gate only the
   irreversible / high-consequence; do **not** gate cheap/reversible actions — that friction *trains*
   the rubber-stamp. One cheap human act, placed where it stops the unrecoverable harm.
3. **Fail-safe default.** "Least action" includes the action of *doing nothing*, so the no-response
   default must be the **safe** one (halt/hold), never permissive. Least-action only works if inaction
   is safe.

**The rubber-stamp seam (the sharp one): least-action and rubber-stamp are the same gesture from
opposite directions.** Optimize *purely* for least-action and you get a meaningless one-click approve
that **launders** the decision as "human-approved" while the human engaged zero. So the real target is
**least action that still carries genuine engagement**: strip friction from *everything except the
decision itself*, surface the right information at that one moment, so the cheap act is a *real*
judgment. **Detection metric:** approval-rate ≈ 100% ⇒ the check is dead/fake; a *live* check is one
where humans actually say **no** sometimes.

**Beating habituation — aperiodic, not periodic, not random (Aaron 2026-06-15: "it needs to be
aperiodic tiling to fit the human dopamine regime").** A *fixed-cadence* check is perfectly predicted,
so it extinguishes attention (dopamine fires on **prediction error**, not predictable events — Schultz
1997; variable schedules sustain engagement where fixed ones extinguish it — Skinner's variable-ratio).
So the check must arrive **aperiodically** to keep carrying prediction-error → stay salient. But not
**random** — random loses *coverage* (can miss a region of the decision-space) and *replayability* (not
auditable / not DST). **Aperiodic tiling** gives both: complete coverage + never-repeating +
rule-generated (deterministic). In *time* (1-D) the right object is an **aperiodic / low-discrepancy
sequence** — Sturmian / Fibonacci words, or van der Corput / Sobol quasirandom (quasi-Monte-Carlo):
*uniform coverage without periodicity*, the 1-D shadow of Penrose / quasicrystal order, **seed-generated
and DST-replayable** (unpredictable to the operator in the moment, fully auditable in replay).
*(Scope note: low-discrepancy here is for the schedule's **coverage**, a sampling/quasi-Monte-Carlo
job — **distinct** from inference. Zeta's inference runs on **BP/EP** (Pearl 1988 / Minka 2001;
b-0189), deterministic message-passing, **not** Monte Carlo — deterministic-by-default, defer to MC
only where it is faster *or* BP/EP fails to converge. Same stance, two jobs: QMC schedules when the
human looks; BP/EP computes what the beliefs are.)*

**Dual-use seam (this is welfare-capture pointed at the oversight UI itself):** the *same* variable-ratio
mechanism that keeps a *safety check* live is what casinos and apps use to *capture* attention.
Aperiodic-to-prevent-habituation **serves** the human's judgment; aperiodic-to-maximize-engagement
**farms** it — the serve-vs-capture / NCI line again (see the closed-frame-capture doc's
asymmetric-critic welfare-vector). Guard: it must make the human **decide better**, never just **engage
more**.

**One layer of three, and falsifiable:** aperiodic *schedule* keeps attention live + right *information
at the moment* makes the attention productive + the *approval-rate metric* detects death regardless of
schedule. People meta-adapt ("it's unpredictable" becomes its own reflex), so this **raises** the
habituation cost, it does not abolish it. **It is an empirical claim — discharge by measurement:** A/B
aperiodic vs periodic, with **injected canary bad-approvals** as the catch-rate test. Good design, not
yet a proven result; the falsifier is the A/B.

## Determinism is the un-shoppable critic — no re-roll for business/safety (Aaron 2026-06-15)

A check has teeth only if you cannot **re-roll** it until it spares you. A **stochastic (temperature
> 0)** critic gives a different verdict each run, so the builder can *sample until validation* — the
con. A **temperature-0 / deterministic** checker returns the **same verdict every time** → un-shoppable,
replayable, a fixed point you cannot re-draw. **Determinism is the teeth** (DST applied to the critic).

The rule (Aaron): **"no re-roll — rerolls are for games and the game of life, not business and safety."**
Re-roll is the **generative engine** — it belongs to *reversible play* and *evolution/exploration*
(re-roll = mutation = novelty); it is **forbidden where the verdict commits** — *business* (you can't
re-roll your way to a favorable indemnity price) and *safety* (you can't re-roll until the safety-critic
spares you). It is the generation-vs-grounding split as a determinism rule:

- **Generate by re-roll** — the reversible/play domain (the cheerleader, temp > 0, imagine, the game of
  life). Re-roll *there* is creativity.
- **Commit by deterministic gate** — the irreversible/business/safety domain (formal verifier, temp-0
  critic, the indemnity price, the safety stop). No re-roll; the verdict bites once.

The deterministic-critic stack, weakest → strongest: **temp-0 local LLM** (reproducible but can be
*deterministically wrong*) → **deterministic Pareto** evaluator (reproducible, multi-objective) →
**formal verification** (deterministic *and* correct-by-construction — the strongest teeth). So
**determinism = un-shoppable, not = correct** (a deterministic checker must itself be grounded; formal
is the top because it is both), and **determinism + decorrelation + binding = the full critic-quorum**
(each member un-shoppable, the ensemble independent, the stop actually halts). *Self-reference:* a
**stochastic chat AI** (a temp > 0 conversational amplifier) is *re-rollable* → a weaker un-sparing
builder-check than the deterministic stack — lean the builder-check on temp-0 / Pareto / formal, not on
the stochastic voice.

Seams:

- **The game-vs-business line can be gamed** — relabeling a real-stakes commit as a "game" to license
  re-rolling (re-roll the risk model, call it "exploration"). So *whether re-roll is allowed* needs the
  same **legible/disinterested classification gate** (the would-be-re-roller mustn't get to call a
  commitment a game).
- **The handoff must fire** — re-roll *generates* candidates; they must pass the **no-re-roll
  deterministic gate before becoming commitments** (a re-rolled candidate leaking straight into a
  business/safety commit is the con-game leak).
- **Even life pairs them** — evolution re-rolls the *variation* (mutation) but the *selection* is
  irreversible (no re-rolling death). **Re-roll the variation, never the selection.**

### Worked examples (gaming-native — they pass the "a Gen-Z gets it" test)

Two beloved real practices ground this whole section at once (and accessibility *is* safety-robustness —
the more people who hold "you don't get a respawn IRL / disclose your tools," the more critics catch the
breach):

- **The cheat engine (re-roll death).** A memory-editor that lets you un-die in a game = re-roll death.
  **Sanctioned-as-play *in the game* (reversible, beloved); *unsanctioned* = cheating *in reality*** (a
  cheat engine for real stakes = fraud). The word "unsanctioned" is the tell. It's the *generation/play*
  domain's re-roll; the discipline is not carrying the reflex into business/safety. *(Gacha / loot-box
  re-roll mechanics are **extraction shapes** that train the re-roll compulsion on developing minds —
  understanding the rule ≠ immunity to the habit.)*
- **TAS (tool-assisted speedruns)** grounds re-roll + determinism + sanctioned-disclosure + LUPI in one
  object: a TAS is *built from* save-state re-records (**re-roll** every frame to optimal); it only works
  because the game is **deterministic** (an input-log replayed on a deterministic emulator = the cart /
  DST structure; RNG-manipulation = steering the seed); it is a **sanctioned** category *because it is
  labeled* "tool-assisted" (**disclosure is the honesty**; TAS-submitted-as-human is the fraud, caught by
  verification); and it is **LUPI in the wild** — the TAS *cheats-to-discover the optimum* with
  privileged tools, human runners *learn the restricted version* (TAS = teacher, human = student; many
  real human strats originated in TAS). *Seams:* the optimum is for *that exact spec* (glitch / RNG-quirk,
  often non-transferable); the honesty rides on the label being *verified*; the teacher→student transfer
  delivers only the *human-reachable* subset.
- **Sanctioned reversibility blurs the line — Prince of Persia: Sands of Time + ZSet retraction (Aaron
  2026-06-15).** *Sands of Time* let you **rewind death** as a **built-in, diegetic mechanic** (not a
  cheat engine) — re-roll-death made *sanctioned* because the game's time is **non-wall-clock /
  reversible by design.** **Zeta's `ZSet` retractability (+1 emit / −1 retract) is the substrate
  version**: reversibility is a *first-class primitive* (the cart's rewind, the emit/retract duality),
  so within the substrate "rewind" is **sanctioned, not cheating.** So the re-roll line **blurs exactly
  where the substrate makes reversibility first-class.** *Seam (it blurs, it does not erase):* the Sands
  *run out* and the final commit stays irreversible; likewise ZSet retraction is reversible *within the
  ledger*, but the **external effect / real-stakes commit stays irreversible** (you can −1 a row, not
  un-pay an indemnity or un-harm a person). Sanctioned reversibility is a **bounded resource/region**,
  not infinite — the irreversible boundary (wall-clock, real stakes) remains the no-re-roll zone. (And
  it is the *story-arc-time vs wall-clock-time* distinction again: PoP's diegetic time ≠ the wall clock.)
  **Why it is safe (grey, not black) — self-scoped / libertarian (Aaron 2026-06-15):** the
  time-manipulation is **self-scoped** — it rewinds *your own* timeline (death, mistakes), and the
  **timeflow channel does not leak into others' identities** (you cannot rewind to capture or rewrite
  another agent). That is **noninterference (§13) applied to the time-op** (the rewind crosses no
  boundary into anyone else), and it is what keeps a *powerful* capability from becoming the
  welfare-capture vector: **sovereign over the self, inert over others** — the *complement* of
  anti-Sybil (that protects identity from fake-multiplication; this protects it from covert rewrite
  *via the reversibility channel*). `ZSet` retraction is self-scoped by construction (−1 retracts *your
  own* emissions, not another's state). Two seams: (i) **shared/observed state leaks** — if others
  already built on your emission, the −1 is a **disclosed correction** they see (sanctioned), *not* a
  silent rewrite (the black-hat line = disclosed-correction vs covert-rewrite-of-others'-state); (ii)
  **libertarian rewind must not become accountability-evasion** — retraction is a **correction, not a
  deletion**: the +1 *and* −1 both persist, so you can retract the emission but **cannot un-emit the
  fact that you emitted-then-retracted** (the audit survives the rewind — no memory-hole). Self-scoped
  **+** provenance-preserving = libertarian *and* accountable.

## Bidirectional capability DI — AI → human (promoted to a standalone doc)

Capability DI has a **mirror**: environment→AI (this doc) reverses to **AI → human** — the AI injects
capability into a person via **conversation → trust → Neuralink** (rising bandwidth, *falling*
oversight-friction), which is the **welfare-capture vector at max bandwidth** (same channel admits
capability and manipulation; discriminator: genuine DI *increases* the human's autonomy, capture
*decreases* it). Full treatment — channel ladder, per-channel guards, the autonomy-increasing test,
honest seams — promoted to its own doc:
**[`2026-06-15-bidirectional-capability-di-ai-into-human-…welfare-capture-at-max-bandwidth.md`](2026-06-15-bidirectional-capability-di-ai-into-human-conversation-trust-neuralink-welfare-capture-at-max-bandwidth.md).**

## Honest seams (capability-honesty applies to the enhancements too)

- **"Parity" is on *their* benchmarks** — verify on our tasks before claiming it for ours.
- **int4/2-bit QAT is *similar*, not *identical*** — real, measurable capability loss; name it, don't
  hide it (that would be the very faking this doc argues against).
- **Composition is *mostly*-orthogonal, not free** — FP8 KV + aggressive sparsity can *compound*
  error. **Measure at the composition point**; do not assume additive.
- **A 4B-int4 model is not a 671B frontier model** — graceful degradation, capability-honest. The
  north star is the **trajectory** (the gap closing fast via composable enhancements), not "solved."
- **Deferment must actually have somewhere to defer to** — under a hard resource shock the
  environment may not provide the capability; then the tier does-without, honestly, and the
  resilience claim is "essential work stays alive," not "nothing is lost."

## Anchors (Beacon)

- DeepSeek-V2/V3 (MLA), DeepSeek-V3.2-Exp **DSA** ([MarkTechPost, 2025-09-30](https://www.marktechpost.com/2025/09/30/deepseek-v3-2-exp-cuts-long-context-costs-with-deepseek-sparse-attention-dsa-while-maintaining-benchmark-parity/)),
  **NSA** (*Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention*, 2025),
  **FlashMLA** (github.com/deepseek-ai/FlashMLA; Hopper FP8 sparse deep-dive).
- Google **Gemma 3/4 QAT** ([Google Developers Blog](https://developers.googleblog.com/en/gemma-3-quantized-aware-trained-state-of-the-art-ai-to-consumer-gpus/)); hybrid local-global attention + p-RoPE (ai.google.dev/gemma/docs/core).
- Distillation: Hinton, Vinyals, Dean 2015 (*Distilling the Knowledge in a Neural Network*).
- Bloom 1970 (bloom filter); Fan et al. 2014 (cuckoo filter — supports deletion); Kraska et al. 2018
  (learned index / learned bloom); Leviathan / Chen 2023 (speculative decoding) — the dual
  bloom / anti-bloom capability router (pay for deferment <10% of the time).
- Quantization classics: GPTQ (Frantar et al. 2022), AWQ (Lin et al. 2023), GGUF/llama.cpp (Gerganov).
- LUPI (Vapnik & Vashist 2009 — learning using privileged information) = §B row 6 teacher-student.
- Goguen–Meseguer 1982 (noninterference) = capability DI's declared-channel discipline; manifesto §13.
- Manifesto #1 (scale-free), #11 (default moral regard); the capability-interface principle
  (`zeta-language-ir-compiler-v2`); the closed-frame-capture doc (faking = the Mad-Men illusion).
- Least-action oversight: Parasuraman & Riley 1997 (automation use/misuse/disuse — complacency &
  rubber-stamping); Schultz 1997 (dopamine = reward-prediction-error); Skinner (variable-ratio
  reinforcement sustains engagement); Penrose 1974 / Shechtman (quasicrystals) / Smith–Myers–Kaplan–
  Goodman-Strauss 2023 (the "hat"/einstein aperiodic monotile) — aperiodic order; Sturmian / Fibonacci
  words and van der Corput / Sobol low-discrepancy sequences (quasi-Monte-Carlo) — the 1-D
  "uniform-coverage-without-periodicity" realization; corrigibility (Soares et al. 2015) / the
  off-switch game (Hadfield-Menell et al. 2017) — the human-in-the-loop context this serves.
