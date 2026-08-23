---
id: 081M0R2876N087G0R001JZZ8VG
type: task
state: backlog
priority: P2
slug: code-search-index-same-cascade-sig-trigrams-over-raw-bytes-c
title: "Code search index — same cascade, sig = trigrams over raw bytes (Cox / zoekt)"
created: 2026-08-23T19:41:08.181Z
depends_on: []
composes_with: []
---

# Code search index — same cascade, sig = trigrams over raw bytes (Cox / zoekt)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R2876N087G0R001JZZ8VG-*.md` glob. -->

## Scope

Same cascade, same storage, `sig` = trigrams over raw bytes: order, case, punctuation and stop words all PRESERVED, because `->`, `if`, `Foo` vs `foo` and `--dry-run` all matter. Anchors: Russ Cox trigram index (2012), `zoekt`. Design §8.

**Do not build ahead of the design.** Filed deliberately rather than half-built.
