---
id: 081M0R2875T087G0R0009CBM5C
type: task
state: backlog
priority: P2
slug: corpus-derived-unigram-spell-check-pre-filter-add-candidates
title: "Corpus-derived unigram spell-check pre-filter — add candidates, never replace the query term"
created: 2026-08-23T19:41:08.154Z
depends_on: []
composes_with: []
---

# Corpus-derived unigram spell-check pre-filter — add candidates, never replace the query term

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R2875T087G0R0009CBM5C-*.md` glob. -->

## Scope

Corpus-derived, never a general dictionary. Correction must ADD candidates, never REPLACE the query term, or it is a false negative wearing a helpful face. Only correct terms with ZERO postings — 62.2% of the vocabulary is df==1, so a looser guard fires on two-thirds of it. Design §6.

**Do not build ahead of the design.** Filed deliberately rather than half-built.
