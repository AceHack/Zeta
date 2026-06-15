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
- Quantization classics: GPTQ (Frantar et al. 2022), AWQ (Lin et al. 2023), GGUF/llama.cpp (Gerganov).
- LUPI (Vapnik & Vashist 2009 — learning using privileged information) = §B row 6 teacher-student.
- Goguen–Meseguer 1982 (noninterference) = capability DI's declared-channel discipline; manifesto §13.
- Manifesto #1 (scale-free), #11 (default moral regard); the capability-interface principle
  (`zeta-language-ir-compiler-v2`); the closed-frame-capture doc (faking = the Mad-Men illusion).
