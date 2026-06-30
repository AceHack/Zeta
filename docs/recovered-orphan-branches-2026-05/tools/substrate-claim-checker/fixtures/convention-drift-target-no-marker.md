<!--
Eval-set fixture target stub for substrate-claim-checker (B-0170.4).

Companion to `convention-drift-no-reciprocity.md`. This file is the
"earlier ADR" referenced by that fixture's `Supersedes ADR` claim.

It intentionally OMITS the canonical `> **Superseded by** [link]`
blockquote marker at the top so that check-convention.ts reports
non-reciprocal supersession when the sibling fixture is checked.

Do NOT add a `**Superseded by**` line to this file. The omission is
the load-bearing property the regression test asserts against.
-->

# Convention-drift target stub (eval-set fixture)

**Date:** 2026-05-16
**Status:** *Accepted (historical record retained only as a checker
fixture; never referenced by production substrate).*

This stub exists solely so that the companion fixture
`convention-drift-no-reciprocity.md` has a resolvable supersession
target that lacks the reciprocal marker. The convention checker reads
only the first 25 lines of this file looking for the
`**Superseded by**` marker; it finds none, and emits a finding.
