---
id: 081M0QZQVTQ087G0R000XSV974
type: bug
state: done
priority: P2
slug: register-search-index-cadence-in-the-apt-timing-audit
title: "Register search-index cadence in the apt timing audit"
created: 2026-08-23T18:57:15.095Z
completed: 2026-08-23T19:01:58.000Z
depends_on: []
composes_with: []
---

# Register search-index cadence in the apt timing audit

## Context

The git-native search index cadence landed with a governed `install.sh` step,
but without a row in `apt-job-timings.measured.json`. The live-repository audit
therefore failed closed with `search-index-cadence.yml:rebuild` unaccounted.

## Evidence

The first three workflow runs all completed successfully. Their job wall times
were 255s, 206s, and 221s. The audit markers measured apt phases of 95.515s,
48.268s, and 52.333s. Applying the generator's formula gives non-apt samples of
159.485s, 157.732s, and 168.667s: rounded p90/max 169s and apt p90 96s.

Run provenance: `32658297083`, `32658048219`, and `32657365004`.

## Acceptance

- The measured registry carries the new governed job with all three run IDs.
- The live repository has no unaccounted apt-governed jobs.
- The shipped timeout still fits the measured apt and non-apt budget.
- The focused audit suite and its CLI exit code pass.

## Resolution

The timing registry now carries a measured row for
`search-index-cadence.yml:rebuild` with all three successful run IDs. The audit
computes a 601-second margin inside the 1,200-second job timeout.

## Verification

- `bun test src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.test.ts` — 41 passed.
- `bun src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.ts --human` — 45 governed jobs accounted for; the new job fits with 601 seconds of margin.
- `bun test src/Core.TypeScript/hygiene/` — 2,291 passed across 114 files.
- `bun run preflight:quick` — all 13 checks passed.
