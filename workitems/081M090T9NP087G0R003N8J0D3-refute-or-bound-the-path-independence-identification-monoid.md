---
id: 081M090T9NP087G0R003N8J0D3
type: task
state: backlog
priority: P2
slug: refute-or-bound-the-path-independence-identification-monoid
title: "Refute or bound the path-independence identification: monoid, Bell locality, holonomy, CALM"
created: 2026-08-17T23:27:26.902Z
depends_on: []
composes_with: []
---

# Refute or bound the path-independence identification: monoid, Bell locality, holonomy, CALM

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M090T9NP087G0R003N8J0D3-*.md` glob. -->

Adversarial (refuter) test of the claim that path-independence is one property with four faces —
commutative monoid / Bell locality / zero holonomy / CALM — and of its corollary that the four-corner
tick-boundary merge from #11692 is "flat by construction."

**Outcome: refuted.** The strong form (`coordination-free ⟺ inside the local polytope`) has one false
direction (2PC is inside it) and one vacuous direction (every classical correlation is inside it).
The corollary is false about the shipped code in three separate ways, all measured.

Findings and the surviving (much smaller) claim:
`docs/research/2026-08-17-path-independence-is-four-properties-refuting-the-monoid-bell-holonomy-calm-identification.md`

No code changed — this is a measurement of existing code, and it found no bug in it. What it found is
that the *summary* of `CoOwnedCorner` overreached; `SoftScheduler.fs` itself says "associative," lists
commutativity and idempotence as optional, and ships a non-commutative instance.
