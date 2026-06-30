---
id: B-0332
priority: P1
status: open
title: "Load-bearing-vs-decorative memory classifier"
created: 2026-05-28
last_updated: 2026-05-28
parent: B-0190
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [lior]
type: tooling
---

# B-0332 — Load-bearing-vs-decorative classifier

This task implements Step 7 of the Memory Substrate Engineering Trajectory (B-0190). It involves creating a tool to classify memory files as either "load-bearing" or "decorative".

## Scope

This task involves creating a new script that classifies memory files based on whether they are referenced by core governance documents.

A memory is considered **load-bearing** if it is:
- Directly referenced in `CLAUDE.md`, `GEMINI.md`, `GOVERNANCE.md`, or `ALIGNMENT.md`.
- Reachable from a load-bearing memory via a `composes_with` link.

All other memories are considered **decorative**.

## Acceptance Criteria

- A new script `tools/memory/classify-load-bearing.ts` is created.
- The script scans the core governance documents and `memory/` directory.
- The script outputs a list of all memory files, classified as either `load-bearing` or `decorative`.
