<!--
Eval-set fixture support file for substrate-claim-checker (B-0170.4).

This is the "predecessor ADR" half of the convention-drift fixture pair.
It is intentionally missing the top-of-file "**Superseded by**" marker
that `check-convention.ts` looks for when validating reciprocal ADR
supersession claims. The companion fixture
`convention-drift-no-reciprocal-marker.md` claims to supersede this
file; the absence of the reciprocal marker here is the convention
drift the checker is expected to surface.

The filename leads with `_` to signal "fixture support file, not a
top-level fixture itself" — same shape convention as a leading-dot
file but visible in `ls` output for review-thread legibility.
-->

# Predecessor ADR (fixture support file)

**Status:** Accepted.

## Decision

Synthetic ADR body — content is not meaningful; only the absence of a
"Superseded by" marker matters for the convention-drift fixture pair.
