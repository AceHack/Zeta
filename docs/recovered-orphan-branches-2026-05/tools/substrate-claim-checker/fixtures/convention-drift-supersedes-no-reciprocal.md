<!--
Eval-set fixture for substrate-claim-checker (B-0170.4).

Reproduces the convention-drift sub-class — an ADR claims to supersede
an earlier ADR, but the earlier ADR lacks the reciprocal top-of-file
"Superseded by" marker. The check-convention.ts checker treats ADR
supersession as a *reciprocal* convention: a claim on one side without
the marker on the other is convention drift.

This is the fifth eval-set fixture (after count-drift, existence-drift,
path-form-drift, and cross-surface-drift), extending B-0170.4 regression
coverage to the convention sub-class of the 7-class verify-then-claim
taxonomy. Convention drift is the smallest v0.9 ADR sub-slice currently
implemented by the checker; later v1+ convention sub-slices (skill /
naming / branch-protection conventions) reuse the same fixture path.

The pair-mate `convention-drift-earlier-adr.md` plays the role of the
earlier ADR. It exists on disk (so the existence-drift path is NOT
exercised here — that drift belongs to check-existence.ts) but
intentionally lacks the reciprocal "Superseded by" marker, which is
exactly the failure mode this fixture pins.

NOTE: per PR #3611 review-thread discipline, this HTML comment
intentionally avoids restating the exact backtick-quoted target name
from the body so a regression in body-claim detection cannot be masked
by a comment-side match.
-->

# Current ADR (eval-set fixture)

Supersedes `convention-drift-earlier-adr.md` to land the convention-drift
sub-class coverage.
