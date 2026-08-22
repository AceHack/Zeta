---
id: 081M0DJSY5C087G0R00094DD3Z
type: task
state: backlog
priority: P2
slug: fscheck-the-marginal-equivalent-pair-falsifier-for-claim-str
title: "FsCheck: the marginal-equivalent pair falsifier for claim-strength non-decomposability"
created: 2026-08-19T17:58:47.212Z
depends_on: []
composes_with: []
---

# FsCheck: the marginal-equivalent pair falsifier for claim-strength non-decomposability

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DJSY5C087G0R00094DD3Z-*.md` glob. -->

**Routed by Soraya, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §4d.**

**F3, the marginal-equivalent pair.** Construct two witness configurations `A` and `B` over the same claim set such that (i) every claim's per-claim verification outcome is identical in `A` and `B`, and (ii) `A` has N independent witness sources while `B` has k < N distinct sources with replicated observations. Require `strength(A) > strength(B)` **strictly**.

Any implementation returning `strength(A) = strength(B)` is embarrassingly parallel and C3 is refuted for it.

**This falsifier has already fired once, in production.** `src/Core/QuorumAlgebra.fs` records bug B3: six agents on one data stream folding to six times the confidence, `precision = 66.0` on a mean wrong by 5.66. That is configuration `B` scored as configuration `A`. `join`-before-`interfere` is the k=1 corner of the repair; **partial** correlation is unhandled.

**Blocked on** `081M0DJSY9F087G0R002HV7KA7` — there is no `ClaimStrength` surface to test.
