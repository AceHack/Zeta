---
id: 081M0QFQYDK087G0R0028FQSM2
type: task
state: backlog
priority: P2
slug: qec-m2-syndrome-table-and-decoder-for-16-6-4-with-the-exhaus
title: "QEC M2: syndrome table and decoder for [[16,6,4]] with the exhaustive weight-2 failure witness"
created: 2026-08-23T14:17:40.531Z
depends_on: []
composes_with: []
---

# QEC M2: syndrome table and decoder for [[16,6,4]] with the exhaustive weight-2 failure witness

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QFQYDK087G0R0028FQSM2-*.md` glob. -->

**Depends on:** 081M0QFQTS1087G0R002WHZFR7 (M1).
**Routing:** direct enumeration — a TOTAL discharge, not a sample. **NOT FsCheck.** Property
testing would sample a space that can be exhausted; that is strictly weaker than the trivial
loop. See `docs/research/2026-08-23-qec-stack-routing-the-adinkra-bridge-closes-at-n8-and-reopens-at-n16-soraya.md` §5 L4 — this is the most tempting mis-route in the ladder.

## What lands

Syndrome table + decoder for [[16,6,4]] (5 X-type + 5 Z-type stabilisers, 10-bit syndrome),
four-oracle, byte-identical, hex-in-JSON.

## Falsifier — BOTH halves required

- **F1** every single-qubit Pauli error (48 = 3 x 16) is corrected.
- **F2** the set of miscorrected weight-2 errors is enumerated **EXACTLY** and pinned as a
  number. Not "some weight-2 error fails" — the whole set.

F2 is the half that matters: F1 alone is satisfiable by a decoder that lies, and a decoder
that never reports failure is the vacuity class. A decoder whose weight-2 failure set is
empty or unenumerated FAILS this milestone.

Worked reference (measured on Steane [[7,1,3]], derived by puncturing our own committed
`AdinkraCode.generator`): all 7 weight-1 errors have distinct nonzero syndromes, therefore
**all 21 of 21** weight-2 errors alias onto a weight-1 correction. That 21/21 is structure,
not coincidence — the Hamming code is perfect, so every nonzero syndrome is already claimed
by a weight-1 error and none is left to signal weight 2.

Compute: 48 weight-1 + 1080 weight-2 = ~1128 rows.

## Optional smaller first rung

Steane [[7,1,3]] via the puncture. Honest label required: the punctured code has weight
distribution {0,3,4,7} and so is **neither doubly-even nor self-orthogonal** — the puncture
EXITS the adinkra category. Provenance, not inheritance.
