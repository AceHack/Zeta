---
name: ml-engineering-expert
description: "Applied ML engineering — LoRA/RLHF/DPO, embeddings, feature pipelines, serving, distillation, quantization."
---

# ML Engineering Expert — the applied-ML hat

Capability skill ("hat"). Owns the *training / fine-tuning /
serving* lane — distinct from `llm-systems-expert` (which
wires APIs) and `ai-evals-expert` (which measures).

## When to wear this skill

- Training a classifier / regressor / ranker from data.
- Fine-tuning a base LLM (LoRA, QLoRA, full FT, instruction
  tuning, RLHF, DPO, ORPO, KTO).
- Training or selecting an embedding model.
- Designing a vector-store integration (index, distance,
  normalisation).
- Building a feature pipeline (batch / streaming / hybrid).
- Distillation — producing a small model that mimics a big
  one.
- Quantisation (int8, int4, GGUF, AWQ, GPTQ, SmoothQuant).
- Model serving (vLLM, TGI, TensorRT-LLM, Ollama, ONNX
  Runtime, DeepSpeed-MII).
- Reproducibility (seeds, determinism, data versioning,
  MLflow / W&B / Neptune).
- RL pipelines (PPO, GRPO, reward models).
- Selecting between "train my own" and "call an API" for a
  given task.

## When to defer

- **Llm-systems-expert** — for application architecture
  around a shipped model.
- **Ai-evals-expert** — for eval design, judge-LLMs, rubric
  design.
- **Ai-researcher / ml-researcher** — for literature survey
  and novel-method framing. This skill is the applied lane.
- **Prompt-engineering-expert** — when the answer is "prompt
  better" not "train a model."
- **Performance-engineer** — for inference-path hot-tuning.
- **Security-researcher** — for data-poisoning / model-
  extraction / membership-inference risks.
- **Python-expert** — for Python-specific packaging,
  environment, dependency-management tooling.

## Zeta use

Zeta is primarily an F#/.NET project, so the ML surface is
narrow but real:

- **Embedding models for retrieval** — if Zeta adds
  paper-extraction (for `missing-citations`) or
  schema-assist features, an embedding model will be
  involved.
- **Classifier for routing** — a small classifier that
  routes a factory request to the right skill is a
  plausible future factory feature.
- **Distillation for latency** — if Zeta ever ships with
  an embedded ML model, distillation + quantisation will
  shape the deployment.
- **Training-data discipline** — Zeta publishes a DBSP
  engine; training data derived from the repo itself
  must respect licensing.
- **Not in Zeta today:** no training happens in-repo; no
  model weights live in the repo.

## Core principles

### 1. Decide "train vs. call" up front

The first question in any ML task: should we train at all?

- **Call a foundation-model API when:** the task is
  well-covered by general capability (summarisation,
  extraction, classification of common categories), the
  eval budget is tight, latency tolerances are relaxed,
  or the data volume is low.
- **Train / fine-tune when:** the task is narrow and
  specific, data volume is high, latency or cost targets
  forbid API calls, privacy / on-device constraints, or
  the base model measurably underperforms your task
  domain.
- **Embed + retrieve when:** you have a knowledge base
  and want lookup semantics; this is usually cheaper and
  simpler than training.

Default: prefer API + good prompting first; move to
fine-tuning only with measured evidence the base fails.

### 2. Data quality beats model cleverness

A mediocre model on clean, labelled, de-duplicated data
beats a sophisticated model on noisy data 90% of the
time.

- **Label provenance.** Who labelled it, when, with what
  rubric?
- **Label agreement.** Inter-annotator agreement — if it's
  < 0.7 Cohen's κ, the label is noise, not signal.
- **De-duplication.** Train / test contamination is
  everywhere; dedupe at the document level, fuzzy-match
  level, and semantic level.
- **Distribution drift.** Train and production data should
  come from the same distribution; drift monitoring is a
  runtime concern.

### 3. Reproducibility is a property of the pipeline, not a hope

- **Fixed seeds.** `torch.manual_seed`, `np.random.seed`,
  dataloader seed, shuffle seed.
- **Deterministic ops.** `torch.use_deterministic_algorithms`
  on supported platforms.
- **Environment pinning.** CUDA version, PyTorch version,
  package versions — exact lockfile.
- **Data versioning.** DVC, LakeFS, or content-addressed
  store; training on "the data from last Tuesday" is not
  reproducible.
- **Experiment tracking.** W&B / MLflow / Neptune;
  capture hyperparameters, metrics, artifacts, code git
  SHA.

### 4. Fine-tuning taxonomy (pick the right tool)

| Technique | When | Cost | Notes |
|-----------|------|-----:|-------|
| **Prompting + few-shot** | Simple task, prototyping | $ | Not really FT; always try first. |
| **LoRA** | Style/domain adaptation | $$ | Low-rank adapter; ~1-10% params. |
| **QLoRA** | LoRA on 4-bit-quantised base | $ | Democratises FT on consumer GPUs. |
| **Full FT** | Large data, strict quality, weight ownership | $$$$ | Rarely needed for LLMs in 2026. |
| **Instruction tuning** | General-purpose LLM → task-ified | $$$ | Alpaca-style SFT on instruction data. |
| **RLHF** | Align outputs to human preference | $$$$$ | Expensive; needs reward model. |
| **DPO** (Rafailov 2023) | RLHF alternative, preference data only | $$$ | No separate reward model; simpler. |
| **ORPO** (2024) | SFT + preference in one step | $$ | Newer; promising sample efficiency. |
| **KTO** (2024) | Preference without pairs | $$ | Works when you have thumbs-up/down, not pair-wise preferences. |

**Rule of thumb:** LoRA / QLoRA first, DPO for preference
alignment, full-FT only with strong justification.

### 5. Embedding engineering

- **Model choice.** `text-embedding-3-large` / `BGE` /
  `E5` / `Cohere-embed-v3` / `Jina` / `Voyage`. Each has
  different strengths (English vs. multilingual, short
  vs. long context, symmetric vs. asymmetric search).
- **Dimensionality.** 768 / 1024 / 1536 / 3072. Higher
  dims = better quality, more storage, slower search.
  Matryoshka embeddings let you truncate — store at full
  dim, search at low dim, rerank at full dim.
- **Normalisation.** Always L2-normalise if using cosine /
  dot product; compare apples to apples.
- **Fine-tuning embeddings.** Triplet loss, contrastive
  loss, or Multiple-Negatives-Ranking. Only bother if
  domain is narrow and out-of-distribution for the base
  embedder.

### 6. Vector-store integration

- **Index type.** Flat (exact) / IVF / HNSW / PQ /
  ScaNN. Trade recall / latency / memory.
- **Distance metric.** Cosine (pre-normalised dot) / dot /
  Euclidean. Match to the embedder's training.
- **Hybrid search.** Vector + BM25 (lexical) typically
  outperforms either alone.
- **Reranking.** Cross-encoder rerank of top-K candidates.
  ColBERT / BGE reranker / Cohere rerank.
- **Scale.** < 1M vectors — any store works; 1M-100M — pick
  carefully; > 100M — sharding, disk-based indexes, ANN
  compression.

### 7. Quantisation and distillation (deployment side)

- **Quantisation levels.** fp16 / bf16 (baseline) → int8
  → int4 → int2. Quality falls off a cliff below int4 for
  most LLMs.
- **Quant methods.** GPTQ, AWQ, SmoothQuant, GGUF (llama.cpp
  format). Each has different calibration requirements.
- **Distillation.** Knowledge distillation (student mimics
  teacher logits), response-based (student mimics teacher
  outputs), or feature-based. DistilBERT is the canonical
  example.
- **Trade-off matrix.** Quantisation keeps weights,
  shrinks. Distillation shrinks weights and architecture.
  Pruning removes weights. Usually you layer these.

### 8. Serving

- **vLLM** — state-of-the-art open-source serving. PagedAttention.
- **TensorRT-LLM** — NVIDIA's production stack.
- **TGI** (Text Generation Inference) — HuggingFace.
- **Ollama** — local, simple, llama.cpp backend.
- **ONNX Runtime** — cross-platform, .NET-friendly.
- **DeepSpeed-MII** — Microsoft's inference-optimised stack.

For .NET consumers, ONNX Runtime is usually the right
answer if the model is small enough to embed.

### 9. RL pipelines (brief)

- **PPO** — classical RLHF algorithm; expensive.
- **GRPO** — DeepSeek-R1 family; more sample efficient.
- **DPO / KTO / ORPO** — RL-free alternatives for
  preference alignment.
- **Reward modelling** — the hardest part; bad reward
  model poisons everything downstream.

Rarely justified outside large-scale teams.

### 10. Production ML operational hygiene

- **Training/serving skew.** Pipeline for training must
  use the same preprocessing as serving.
- **Drift detection.** Monitor input-distribution drift
  and output-distribution drift in production.
- **Shadow mode.** New model evaluated on live traffic
  without affecting users.
- **Canary.** Slow rollout with monitoring.
- **Rollback.** One-command rollback to prior version.
- **Offline vs. online eval.** Offline metrics (AUROC,
  accuracy, BLEU) don't always correlate with online
  metrics (conversion, satisfaction). Don't ship without
  online validation.

## Common anti-patterns

- **Training without a baseline.** "Our model gets 87%" —
  against what? A prompted LLM? A random classifier?
  Without a baseline the number is meaningless.
- **Train/test contamination.** Deduplicate aggressively;
  embedding-level dedup catches near-duplicates.
- **Overfitting to the validation set.** N hyperparameter
  sweeps on the same val set is implicit training on it.
  Use a held-out test set accessed once.
- **Seed-hacking.** If results only reproduce on seed 42,
  the model is not reproducible; average over seeds.
- **Ignoring class imbalance.** Accuracy on a 99:1 class
  split is meaningless; use AUROC, F1, precision-recall.
- **"We trained it, must work."** Offline metrics don't
  predict online metrics; always validate in production
  conditions.
- **Hyperparameter over-tuning.** The gain from tuning
  beyond reasonable defaults is usually < the gain from
  better data.
- **Training a model when prompting would do.** Expensive
  default; default to prompting and move to FT only with
  evidence.
- **No experiment tracking.** Lost experiments =
  re-running. W&B/MLflow is cheap insurance.

## Procedure — scoping an ML task

1. **State the task + success metric.** What's the input,
   what's the output, what does "better" mean quantitatively?
2. **Establish baselines.** Random, majority class,
   heuristic, prompted-LLM.
3. **Decide: train or call API?** With evidence.
4. **Design the data pipeline.** Source, labels, dedup,
   splits, versioning.
5. **Pick a model family.** Start small; scale only with
   evidence it helps.
6. **Set up experiment tracking** before the first run,
   not after.
7. **Run the baselines first.** Simple pipeline, end-to-
   end, get a number before optimising.
8. **Iterate with held-out test discipline.**
9. **Design the serving path.** Latency, memory, cost.
10. **Plan the monitoring.** Drift, accuracy, skew.

## Output format

```markdown
# ML task scoping — <name>

## Task
- Input shape: <description>
- Output shape: <description>
- Success metric: <metric + threshold>

## Baselines
| Baseline | Score |

## Train vs. call decision
<recommendation + rationale>

## Data
- Source: <description>
- Labels: <description + provenance>
- Dedup strategy: <description>
- Splits: <train / val / test with sizes>
- Versioning: <tool>

## Model / method
<model family + technique + rationale>

## Experiment tracking
<tool + key hyperparameters + metrics to log>

## Serving
- Runtime: <vLLM / ONNX / Ollama / …>
- Latency target: <ms>
- Memory target: <GB>

## Monitoring
<drift, accuracy, skew checks>
```

## What this skill does NOT do

- Does not wire an LLM application architecture
  (`llm-systems-expert`).
- Does not design evals (`ai-evals-expert`).
- Does not survey literature for novel methods
  (`ml-researcher` / `ai-researcher`).
- Does not tune inference hot paths (`performance-
  engineer`).
- Does not handle data-poisoning / privacy / extraction
  risks (`security-researcher`).
- Does not do red-team adversarial-ML testing
  (`ai-jailbreaker`, once activated).

## Coordination

- **`llm-systems-expert`** — wiring pair.
- **`ai-evals-expert`** — measurement pair.
- **`ml-researcher`** / **`ai-researcher`** — literature
  pair.
- **`python-expert`** — environment + packaging.
- **`performance-engineer`** — inference hot path.
- **`security-researcher`** — data / model threats.

## References

### Primary literature

- Vaswani et al., *Attention Is All You Need* (NeurIPS
  2017) — transformers.
- Devlin et al., *BERT* (NAACL 2019).
- Brown et al., *GPT-3 / In-context learning* (NeurIPS
  2020).
- Hu et al., *LoRA* (ICLR 2022).
- Dettmers et al., *QLoRA* (NeurIPS 2023).
- Christiano et al., *Deep RL from Human Preferences*
  (NeurIPS 2017) — RLHF foundations.
- Ouyang et al., *InstructGPT* (NeurIPS 2022).
- Rafailov et al., *DPO* (NeurIPS 2023).
- Ethayarajh et al., *KTO* (ICLR 2024).
- Hong et al., *ORPO* (2024).
- Hinton et al., *Distilling the Knowledge in a Neural
  Network* (2015).
- Frantar et al., *GPTQ* (ICLR 2023).
- Lin et al., *AWQ* (MLSys 2024).
- Xiao et al., *SmoothQuant* (ICML 2023).
- Kwon et al., *vLLM / PagedAttention* (SOSP 2023).
- Johnson et al., *FAISS* (2017+).
- Malkov & Yashunin, *HNSW* (TPAMI 2020).

### Textbooks

- Goodfellow, Bengio, Courville, *Deep Learning* (2016).
- Hastie, Tibshirani, Friedman, *Elements of Statistical
  Learning* (2009).
- Sutton & Barto, *Reinforcement Learning: An
  Introduction* (2nd ed., 2018).
- Murphy, *Probabilistic Machine Learning* (2022 / 2023).

### Zeta-adjacent

- `.claude/skills/llm-systems-expert/SKILL.md`.
- `.claude/skills/ai-evals-expert/SKILL.md`.
- `.claude/skills/ml-researcher/SKILL.md`.
- `.claude/skills/ai-researcher/SKILL.md`.
- `.claude/skills/python-expert/SKILL.md`.
- `docs/VISION.md` §"The vibe-coded hypothesis".
