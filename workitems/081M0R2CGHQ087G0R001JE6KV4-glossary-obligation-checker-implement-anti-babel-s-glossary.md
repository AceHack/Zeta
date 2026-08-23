---
id: 081M0R2CGHQ087G0R001JE6KV4
type: task
state: backlog
priority: P2
slug: glossary-obligation-checker-implement-anti-babel-s-glossary
title: "Glossary obligation checker — implement anti-babel's glossary-churn watching on the unigram index"
created: 2026-08-23T19:43:28.823Z
depends_on: []
composes_with: []
---

# Glossary obligation checker — implement anti-babel's glossary-churn watching on the unigram index

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R2CGHQ087G0R001JE6KV4-*.md` glob. -->

## Scope

Implements `.claude/rules/anti-babel-preserve-reconcilability.md`'s unimplemented glossary-churn watching. Start with the REVERSE direction (glossary entry with zero postings): it needs no predicate and currently measures 0 findings, so it starts green. Design §9a.

**Do not build ahead of the design.** Filed deliberately rather than half-built.
