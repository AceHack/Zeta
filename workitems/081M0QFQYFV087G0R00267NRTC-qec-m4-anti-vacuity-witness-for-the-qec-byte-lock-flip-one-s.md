---
id: 081M0QFQYFV087G0R00267NRTC
type: task
state: backlog
priority: P2
slug: qec-m4-anti-vacuity-witness-for-the-qec-byte-lock-flip-one-s
title: "QEC M4: anti-vacuity witness for the QEC byte-lock -- flip one syndrome bit in one oracle, the lock must go red"
created: 2026-08-23T14:17:40.603Z
depends_on: []
composes_with: []
---

# QEC M4: anti-vacuity witness for the QEC byte-lock -- flip one syndrome bit in one oracle, the lock must go red

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QFQYFV087G0R00267NRTC-*.md` glob. -->

**Depends on:** 081M0QFQTS1087G0R002WHZFR7 (M1), 081M0QFQYDK087G0R0028FQSM2 (M2).
**Routing:** byte-lock discipline. See `docs/research/2026-08-23-qec-stack-routing-the-adinkra-bridge-closes-at-n8-and-reopens-at-n16-soraya.md` §8.

## The witness

Flip **one bit** of **one** syndrome in **one** oracle. The lock MUST go red.

Without this the four-oracle claim is unfalsified — four oracles that agree because nothing
could make them disagree is agreement that carries no information.

## Anchor

`.claude/rules/no-binary-in-proof-lineage.md` condition 2: a golden vector nothing reads is
"the vacuity class in its purest form." A golden vector nothing can DISAGREE with is the same
failure one level up. This milestone is the falsifier for the layer that is distinctively ours.
