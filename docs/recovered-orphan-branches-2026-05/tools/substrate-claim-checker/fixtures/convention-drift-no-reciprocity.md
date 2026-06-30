<!--
Eval-set fixture for substrate-claim-checker (B-0170.4).

Reproduces the convention-drift pattern as the check-convention.ts
checker shipped at v0.9 detects it — a current ADR claims to
supersede an earlier ADR, but the earlier ADR carries no
top-of-file `> **Superseded by** [link]` blockquote marker
naming the superseding ADR.

Historical anchor: verify-then-claim memo instance #16 / PR #1256
(`claim that BOTH router-coherence v1 AND v2 ADRs contain the
**Superseded by** blockquote pattern` — only v1 had it; the
reverse-pointing reciprocity from v2 → v1 was the missing surface).
The real router-coherence ADRs have since been brought into
compliance, so this fixture uses a synthetic exemplar
(`convention-drift-target-no-marker.md`) co-located in this
directory to keep the regression test stable across substrate
evolution.

NOTE: per PR #3611 review-thread discipline, this HTML comment
intentionally avoids restating the exact backtick-quoted target
path from the body claim, so a regression in body-claim detection
cannot be masked by a comment-side match.
-->

# Convention-drift ADR (eval-set fixture)

**Date:** 2026-05-16 (synthetic exemplar)
**Status:** *Accepted.* Supersedes ADR `convention-drift-target-no-marker.md` as a synthetic exemplar of the verify-then-claim memo instance #16 convention-drift sub-class.

The check-convention.ts checker should emit one non-reciprocal
finding when run against this file because the target stub
lacks the canonical `> **Superseded by** [link]` blockquote at
its top.
