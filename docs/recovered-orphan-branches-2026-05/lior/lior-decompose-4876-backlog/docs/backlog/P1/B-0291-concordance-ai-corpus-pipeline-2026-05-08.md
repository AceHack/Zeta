---
id: B-0291
priority: P1
status: open
title: "Concordance AI — corpus ingestion + tokenization pipeline"
created: 2026-05-08
parent: B-0244
depends_on: []
classification: buildable-now
decomposition: atomic
type: feature
---

# B-0291 — Corpus pipeline

Ingest English text corpus, tokenize, build concordance
index. Structure recognizer applied to language.

## Acceptance criteria

- TS or F# pipeline: text → tokens → concordance index
- At least one test with real text input
