---
id: 081M0WTVZNA087G0R0024Z5QZR
type: bug
state: backlog
priority: P2
slug: agentic-organization-npm-run-typecheck-fails-6-ts2532-errors
title: "agentic-organization npm run typecheck fails: 6 TS2532 errors in the env-gated integration tests"
created: 2026-08-25T16:08:19.370Z
depends_on: []
composes_with: []
---

# agentic-organization npm run typecheck fails: 6 TS2532 errors in the env-gated integration tests

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WTVZNA087G0R0024Z5QZR-*.md` glob. -->

## The failure, verbatim

Measured 2026-08-25 on node v24.16.0, `npm run typecheck` in `agentic-organization/`
(which runs `npx --yes -p typescript@6.0.3 tsc -p tsconfig.json`), exit code **2**:

```
apps/workers/test/cockroach-integration.test.ts(134,9): error TS2532: Object is possibly 'undefined'.
apps/workers/test/cockroach-integration.test.ts(248,9): error TS2532: Object is possibly 'undefined'.
apps/workers/test/hermes-memory-live-integration.test.ts(31,53): error TS2532: Object is possibly 'undefined'.
apps/workers/test/keep-alive-live-integration.test.ts(43,9): error TS2532: Object is possibly 'undefined'.
apps/workers/test/keep-alive-live-integration.test.ts(123,9): error TS2532: Object is possibly 'undefined'.
apps/workers/test/nats-integration.test.ts(95,9): error TS2532: Object is possibly 'undefined'.
```

All six are in the five env-gated integration test files. `npm test` is unaffected:
1595 tests / 93 suites / 1588 pass / **0 fail** / 0 cancelled / 7 skipped / 0 todo, exit 0.

## Why this is filed rather than absorbed

`.github/workflows/agentic-organization-tests.yml` wires `npm test` and deliberately does
NOT wire `npm run typecheck`. The two dishonest ways to have shipped it green were both
available and both refused:

- `continue-on-error: true` on the step -- the exact class `drift-loud.ts` exists to
  detect, and it produces a green job with a red step that the REST jobs API reports as
  `success`.
- silencing the six errors (`!`, `as`, a `skipLibCheck`-shaped tsconfig loosening) --
  which converts a real finding into a passing check.

So the step is absent and this row is the record. Closing it means the six are fixed and
the typecheck step is added to that workflow in the same change.

## Fix shape (not yet done, not yet reviewed)

Each site indexes something the compiler cannot prove is populated. The honest fix is a
narrowing at the site, not a repo-wide strictness change: `tsconfig.json` here is doing
its job and the tests are what is loose.
