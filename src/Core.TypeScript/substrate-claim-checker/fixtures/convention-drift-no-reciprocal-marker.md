<!--
Eval-set fixture for substrate-claim-checker (B-0170.4).

Reproduces the convention-drift pattern check-convention.ts surfaces —
a current ADR carries a "Supersedes ADR ..." claim but the predecessor
ADR file lacks the reciprocal top-of-file "Superseded by" marker. The
pair makes the broken half of the bidirectional ADR convention
empirically reproducible without depending on any real ADR pair in
the repo.

This is the fifth eval-set fixture (after count-drift-9-vs-15.md,
existence-drift-missing-doc.md, path-form-drift-bare-vs-qualified.md,
and cross-surface-drift-9-vs-15.md), extending B-0170.4 regression
coverage to the convention sub-class of the 7-class verify-then-claim
taxonomy.

Anchor PR: #2512 (`feat(B-0170): add ADR supersession convention
checker`) — the PR that shipped the check-convention.ts checker.
This fixture is a synthetic exemplar (no single historical drift
instance anchors the sub-class), same shape as path-form-drift's
synthetic exemplar.

The predecessor ADR lives as a sibling support file
`_convention-drift-target-adr.md` so check-convention.ts's 3-root
resolution (fileDir / parentDir / repoRoot) finds it via the
fileDir candidate without dragging in any real repo ADR.

NOTE: per PR #3611 review-thread discipline, this HTML comment
intentionally avoids restating the literal "Supersedes ADR ..."
claim from the body so a regression in body-claim detection
cannot be masked by a comment-side match.
-->

# Current ADR (eval-set fixture)

**Status:** Accepted. Supersedes ADR `_convention-drift-target-adr.md`.

## Decision

Synthetic ADR body — the body's substance is not material to the
fixture; only the supersession claim above matters. The predecessor
ADR pointed at by that claim is intentionally missing the reciprocal
"Superseded by" marker, which is the convention drift the checker
must surface.
