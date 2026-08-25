---
id: 081M0WPD312087G0R0006DXEJG
type: bug
state: done
priority: P1
slug: clifford-cross-verify-fails-on-cold-go-compilation
title: "Clifford cross-verify fails on cold Go compilation"
created: 2026-08-25T14:50:16.994Z
depends_on: []
composes_with: [081M0SKWS1B087G0R0016VSQM2]
---

# Clifford cross-verify fails on cold Go compilation

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WPD312087G0R0006DXEJG-*.md` glob. -->

This measured repair closes the earlier report
`081M0SKWS1B087G0R0016VSQM2`; both identities are retained so references to
either work item resolve to the same incident.

## Finding

The hermetic TypeScript gate gave every generated language process 15 seconds.
A cold `go run` of the generated Clifford program took 22.2 seconds on macOS,
causing the helper to return `null` and hiding the subprocess failure behind an
output mismatch.

## Resolution

- Invoke compilers without a shell and preserve subprocess failures as causes.
- Give Go 60 seconds for cold compilation while retaining 15 seconds for the
  interpreted TypeScript and Python lanes.
- Give the containing test 90 seconds and isolate each case in a temporary
  directory that is always removed.
- Validate generated JSON before comparing cross-language rows.

## Verification

- `bun test tests/cross-verification/_harness/codegen-clifford-cross-verify.test.ts`
  passes all three cases, including a cold run.
- `mise exec -- bun src/Core.TypeScript/ci/cross-verify-all.ts` passes all 33
  registered primitive treaties.
- `bun run preflight:quick` passes all 13 checks.
