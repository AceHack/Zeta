<!--
Eval-set fixture supporting file for substrate-claim-checker (B-0170.4).

Pair-mate of `convention-drift-supersedes-no-reciprocal.md`. This file
plays the role of the *earlier* ADR — the one a later ADR claims to
supersede. Per the convention-drift sub-class, the earlier ADR must
carry a top-of-file "Superseded by" marker naming the superseding
ADR. This fixture intentionally OMITS that marker so the checker's
"not reciprocated" finding-path is exercised.

Keep this file short and stable; future edits MUST NOT introduce a
"**Superseded by**" line within the first 25 physical lines or the
regression coverage will silently weaken.

NOTE: per PR #3611 review-thread discipline, this comment avoids
restating the exact body wording of the pair-mate's supersession
claim so a regression in body-claim detection cannot be masked by
a comment-side match.
-->

# Earlier ADR (eval-set fixture)

Decision body — intentionally omits any reciprocal supersession
marker so the convention-drift checker fires against the pair-mate.
