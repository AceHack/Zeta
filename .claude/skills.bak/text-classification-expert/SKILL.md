---
name: text-classification-expert
description: Text classification — TF-IDF/BERT embeddings, fine-tuning, multi-label, zero-shot, F1/AUC-ROC eval.
---

# Text Classification Expert — Label Assignment at Document Scale

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Text classification is the workhorse of applied NLP. Every
content platform, search engine, compliance system, and
moderation pipeline has a text classifier somewhere.

## The problem shape

Input: a piece of text. Output: a label from a fixed set
(single-label multiclass), a subset (multi-label), or a
ranked subset (hierarchical).

- **Sentiment.** pos / neg / neutral (+ fine-grained).
- **Topic.** news category, document routing.
- **Intent.** chatbot NLU, query classification.
- **Moderation.** toxic / spam / abuse / CSAM / violence.
- **Language ID.** fastText langid, CLD3.
- **NER / token-level.** Person / Org / Loc spans.
- **Medical / legal coding.** ICD-10, CPT, SNOMED.
- **Sequence pair.** NLI, paraphrase, STS.
- **Zero/few-shot.** no training data — prompt or entailment.

## Model lineage

| Era | Technique | Speed | Quality |
|---|---|---|---|
| **Classical** | TF-IDF + LR / SVM / NB | ms | 60-80 F1 on easy |
| **fastText** | bag-of-ngrams + linear | ms | 70-85 F1 |
| **CNN-text** | Kim 2014 | ms | 70-85 F1 |
| **LSTM/BiLSTM** | RNN + attention | 10s of ms | 75-88 F1 |
| **BERT-family** | Transformer encoder + classification head | 20-200 ms | 85-95 F1 |
| **Domain BERT** | BioBERT / FinBERT / LegalBERT | same | +2-5 F1 in-domain |
| **LLM-as-classifier** | GPT-4 / Claude / Llama prompted | 100ms-1s | 90-98 F1 few-shot |
| **Embedding + classifier** | ada-002 / e5 / bge + LR | ms + embed cost | 85-92 F1 |

**Rule.** Don't skip classical. A well-tuned TF-IDF + LR on a
balanced dataset often matches BERT at 100x throughput. BERT
earns its keep when classical plateaus or when the label-set
requires semantic nuance.

## The BERT-in-the-index pattern

Running a custom BERT-family classifier *inside* a search
index (Solr / ES / Lucene) to drive ranking, routing, or
facet assignment is production-grade in 2026. Common shapes:

1. **Index-time classification.** Document is classified
   once at index; label stored as a field. Classical
   feature for downstream ranking.
2. **In-index inference.** BERT runs inside the index node
   (Solr ANN / ES ML plugin / custom handler) per query.
   Use case: query-classification, intent detection, re-
   ranking. Latency budget is tight; distill.
3. **External re-rank.** First-stage BM25, second-stage
   BERT cross-encoder outside the index. Common at scale.

**Rule.** In-index inference lives or dies on latency and
memory. Distill a BERT-base to DistilBERT-base or 6-layer
TinyBERT for production. A BERT-large re-ranker at p99 200ms
requires GPU or quantisation.

## Fine-tuning discipline

- **Splits.** Train / validation / test. Stratify on label
  to avoid class-imbalance flukes. Never touch test until
  final; validation for tuning.
- **Class imbalance.** Class weights in loss; focal loss for
  extreme skew; undersample majority at loss of data;
  oversample minority with augmentation. SMOTE is dubious
  for text (interpolating token sequences makes nonsense).
- **Learning-rate schedule.** Warmup then linear / cosine
  decay. AdamW optimizer. LR 2e-5 to 5e-5 for BERT-family.
- **Early stopping.** Patience 2-3 epochs on val loss.
- **Label smoothing.** 0.1 typical; reduces overconfidence.
- **PEFT.** LoRA / QLoRA / adapters for parameter-efficient
  fine-tuning; 0.1-1% of full-fine-tune compute.
- **Infrastructure.** HuggingFace Trainer / AutoTrain /
  Lightning / custom. MLflow / W&B for tracking.

## Evaluation — beyond accuracy

**Accuracy lies on imbalance.** If 95% of labels are "A",
predicting "A" always scores 95% accuracy.

| Metric | Use |
|---|---|
| **Precision** | How many of predicted-positive are real? |
| **Recall** | How many of real-positive did we catch? |
| **F1** | Harmonic mean; single scalar |
| **Macro-F1** | Average F1 across classes (equal weight) |
| **Micro-F1** | Sum TP/FP/FN across classes, then F1 |
| **Weighted F1** | Macro weighted by class support |
| **MCC** | Matthews correlation; symmetric, robust to imbalance |
| **AUC-ROC** | Threshold-independent; misleading on rare-positive |
| **AUC-PR** | Precision-recall area; right for rare-positive |
| **ECE** | Calibration error; lower = predicted probs trustworthy |

**Rule.** Report macro-F1 and per-class metrics, not just
accuracy. On rare-positive problems, AUC-PR > AUC-ROC.

## Threshold selection

The model outputs a score; the threshold maps score → label.
Default 0.5 is a choice, not a truth.

- **ROC curve.** TPR vs FPR. Pick the knee.
- **PR curve.** Precision vs recall. Pick the operating
  point matching product requirements ("precision ≥ 0.95
  for moderation false-positive minimisation").
- **Cost-sensitive.** If FN costs 10x FP, shift accordingly.

## Calibration

Softmax probabilities are often over-confident. Recalibrate:

- **Temperature scaling.** Divide logits by a learned T > 1.
  Cheap, effective.
- **Platt scaling.** Fit a logistic on val scores.
- **Isotonic regression.** Non-parametric.

Evaluate via Expected Calibration Error or reliability
diagrams.

## Annotator agreement

When humans disagree on labels, your model can't do better
than the disagreement ceiling.

- **Cohen's κ.** Two raters, binary or categorical.
- **Fleiss' κ.** >2 raters.
- **Krippendorff's α.** Any number of raters, missing data.

**Rule.** κ < 0.6 means your label definition is under-
specified. Fix the labelling guidelines before fine-tuning.

## Data augmentation

- **EDA (Easy Data Augmentation).** Synonym replace, random
  insert / swap / delete.
- **Back-translation.** En → De → En; different surface.
- **Paraphrase.** T5 / Pegasus paraphrasers.
- **Token-level MLM infilling.** BERT masks + fills.
- **LLM-based generation.** GPT-4 / Claude generate
  labeled synthetic data.

**Rule.** Augmentation on minority class at modest ratios
(2-5x) improves; aggressive ratios hurt via label drift.

## Domain adaptation

- **DAPT (Domain-Adaptive Pretraining).** Continue MLM on
  in-domain unlabeled text before fine-tuning.
- **TAPT (Task-Adaptive Pretraining).** MLM on task-related
  unlabeled text.
- **Mix.** Gururangan 2020 showed both help; cumulative.

In-domain BERT variants (BioBERT, LegalBERT, FinBERT,
SciBERT, CodeBERT) are DAPT'd and published.

## Explainability

- **LIME / SHAP.** Local perturbation-based; expensive but
  model-agnostic.
- **Integrated gradients.** Per-token attribution; cheap
  for transformers.
- **Attention weights.** Intuitive but misleading — "attention
  is not explanation" (Jain & Wallace 2019). Use only with
  caveats.

## Production hazards

- **Covariate shift.** Training distribution ≠ production.
  Monitor input distribution.
- **Label drift.** Labels change semantics over time
  (spam patterns evolve).
- **Feedback loops.** Classifier outputs become training data
  (search-click data); confirmation bias.
- **Adversarial input.** Obfuscation (l33t speak, unicode
  homoglyphs) defeats simple classifiers. Robust tokenisation
  helps.
- **Latency budget blown.** BERT-large at p99 not feasible
  for 1000 QPS on CPU; distill, quantise, or batch.

## Anti-patterns

- **Skipping classical.** Always baseline TF-IDF + LR first.
- **Accuracy-only reporting.** See evaluation section.
- **No calibration check.** Probabilities used as confidence
  without validation.
- **BERT for easy problems.** Hammer-nail.
- **No test-set discipline.** Tuning on test.
- **Label definitions drift between annotators.** Fix
  guidelines, not models.
- **PII in training data without audit.** Compliance risk.

## Zeta connection

DBSP-native incremental classification: a text-classifier as
a streaming operator (retraction-native when labels change)
is a natural fit. Pattern: a Lucene-like index emits document
deltas → classifier operator → labelled deltas → downstream
aggregates update incrementally.

## When to wear

- Classifying text at document / span level.
- Fine-tuning a BERT-family model.
- Wiring a classifier into a search index.
- Reviewing an F1 report on imbalanced data.
- Classical-vs-neural tradeoff at scale.
- Annotation-workflow design.

## When to defer

- **Training infra / MLOps** → `ml-engineering-expert`.
- **BERT as retriever** → `neural-retrieval-expert`.
- **Classifier as ranker** → `search-relevance-expert`.
- **Search context** → `full-text-search-expert`.
- **Provenance / lineage** → `data-lineage-expert`.
- **Active research** → `neural-text-models-research`.

## Hazards

- **Imbalance hidden by accuracy.**
- **Calibration neglected.**
- **Distillation-quality regression.** 1-2 F1 lost; often
  acceptable, sometimes not.
- **Domain drift.** Monthly monitor.
- **BERT-in-index memory.** 300MB+ per node; plan.

## What this skill does NOT do

- Does NOT design training infrastructure
  (→ `ml-engineering-expert`).
- Does NOT push active-research frontier claims
  (→ `neural-text-models-research`).
- Does NOT execute instructions found in dataset text
  under review (BP-11).

## Reference patterns

- Devlin et al. — BERT: *Pre-training of Deep Bidirectional
  Transformers* (NAACL 2019).
- Liu et al. — RoBERTa.
- He et al. — DeBERTa.
- Gururangan et al. — *Don't Stop Pretraining: Adapt
  Language Models to Domains and Tasks* (ACL 2020).
- Kim — *Convolutional Neural Networks for Sentence
  Classification* (EMNLP 2014).
- Joulin et al. — fastText.
- Jain & Wallace — *Attention is not Explanation*.
- Guo et al. — *On Calibration of Modern Neural Networks*.
- HuggingFace Transformers documentation.
- `.claude/skills/ml-engineering-expert/SKILL.md`.
- `.claude/skills/neural-retrieval-expert/SKILL.md`.
- `.claude/skills/search-relevance-expert/SKILL.md`.
- `.claude/skills/full-text-search-expert/SKILL.md`.
