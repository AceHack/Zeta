---
name: search-ir-and-ml
description: Search, IR, and ML — engines, ranking, neural retrieval, text analysis/classification, ML/LLM systems, evals.
---

# search ir and ml

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`elasticsearch-expert`](blueprints/elasticsearch-expert.md) — Elasticsearch / OpenSearch — cluster topology, Query DSL, ILM, mappings, aggregations, kNN, CCR, ES|QL, OpenSearch fork.
- [`solr-expert`](blueprints/solr-expert.md) — Apache Solr — SolrCloud topology, edismax, streaming expressions, schema management, faceting, migration to/from ES.
- [`lucene-expert`](blueprints/lucene-expert.md) — "Lucene / Lucene.NET — IndexWriter, Analyzer, BM25, HNSW vectors, Codec pluggability, merge policy, explain-plan."
- [`full-text-search-expert`](blueprints/full-text-search-expert.md) — Full-text search IR foundations — inverted index, BM25, precision/recall, hybrid BM25+dense, facets, evaluation metrics.
- [`search-engine-library-expert`](blueprints/search-engine-library-expert.md) — "Embeddable search libraries — Lucene, Tantivy, Xapian, Bleve, Quickwit; segments, NRT, codecs, FSTs."
- [`search-relevance-expert`](blueprints/search-relevance-expert.md) — Search relevance — BM25 tuning, LTR pipelines, cross-encoder re-ranking, RRF, offline eval, explain-plan diagnosis.
- [`search-query-language-expert`](blueprints/search-query-language-expert.md) — Search query languages — Lucene, ES DSL, KQL, ES|QL, Solr edismax, Vespa YQL, tsquery; injection safety.
- [`information-retrieval-research`](blueprints/information-retrieval-research.md) — "IR research frontier — HyDE, generative retrieval, RAG critique, hybrid search, SIGIR/CIKM/BEIR/MIRACL tracking."
- [`neural-retrieval-expert`](blueprints/neural-retrieval-expert.md) — "Applied neural retrieval — bi-encoders, SPLADE, ColBERT, cross-encoder rerank, hybrid BM25+dense, BEIR eval."
- [`text-analysis-expert`](blueprints/text-analysis-expert.md) — Text analysis — tokenisation, stemming/lemmatisation, NER, POS tagging, dependency parse, language detection.
- [`text-classification-expert`](blueprints/text-classification-expert.md) — Text classification — TF-IDF/BERT embeddings, fine-tuning, multi-label, zero-shot, F1/AUC-ROC eval.
- [`ml-engineering-expert`](blueprints/ml-engineering-expert.md) — "Applied ML engineering — LoRA/RLHF/DPO, embeddings, feature pipelines, serving, distillation, quantization."
- [`ml-researcher`](blueprints/ml-researcher.md) — "ML theory research — PAC bounds, SGD, Bayesian nonparametrics, causal inference, kernels, convergence proofs."
- [`ai-researcher`](blueprints/ai-researcher.md) — AI research — paper review, experiment design, LLMs, alignment, interpretability, generative models, architecture eval.
- [`ai-evals-expert`](blueprints/ai-evals-expert.md) — LLM / ML evaluation — eval-suite design, LM-as-judge, BLEU/ROUGE, calibration, benchmark drift, measurement.
- [`llm-systems-expert`](blueprints/llm-systems-expert.md) — LLM systems — RAG, agent loops, tool orchestration, context budgets, multi-model routing, cost/latency, evals.
- [`prompt-engineering-expert`](blueprints/prompt-engineering-expert.md) — Prompt engineering — system prompts, few-shot design, tool descriptions, reasoning scaffolds, schemas, context budgets.
