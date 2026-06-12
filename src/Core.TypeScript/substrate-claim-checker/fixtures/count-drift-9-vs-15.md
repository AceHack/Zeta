<!--
Eval-set fixture for substrate-claim-checker (B-0170).

Reproduces the count-drift pattern surfaced in PR #1259
`review(pr-1257-postmerge): verify-then-claim count drift
(9→18+) frontmatter + body + MEMORY.md` — the body narrative
claims a smaller count than the body table actually records.
The exact values are visible inline below.

The fixture is intentionally minimal: only the count claim,
the table, and enough framing for the checker to find the
nearest-table within its 50-line window.

NOTE: this comment intentionally avoids restating the exact
`<number> <noun>` pair from the body claim. Restating it would
produce a spurious second matching claim from the HTML
provenance and let regressions in body-claim detection slip
past `fixtures.test.ts` (per PR #3611 review threads from
chatgpt-codex-connector + copilot-pull-request-reviewer).
-->

# Drift catalogue (eval-set fixture)

The catalogue tracks 9 drift instances across the substrate.

| # | Instance | Sub-class |
|---|---|---|
| 1 | row-1 | count |
| 2 | row-2 | count |
| 3 | row-3 | existence |
| 4 | row-4 | path-form |
| 5 | row-5 | cross-surface |
| 6 | row-6 | count |
| 7 | row-7 | convention |
| 8 | row-8 | semantic-equivalence |
| 9 | row-9 | empirical-output |
| 10 | row-10 | self-recursive |
| 11 | row-11 | count |
| 12 | row-12 | existence |
| 13 | row-13 | path-form |
| 14 | row-14 | cross-surface |
| 15 | row-15 | convention |
