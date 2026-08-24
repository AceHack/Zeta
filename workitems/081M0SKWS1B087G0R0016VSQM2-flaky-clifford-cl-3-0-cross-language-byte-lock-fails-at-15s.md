---
id: 081M0SKWS1B087G0R0016VSQM2
type: bug
state: backlog
priority: P2
slug: flaky-clifford-cl-3-0-cross-language-byte-lock-fails-at-15s
title: "Flaky: Clifford Cl(3,0) cross-language byte-lock fails at ~15s on busy runners (TS/Python/Go subprocess spawn)"
created: 2026-08-24T10:08:42.027Z
depends_on: []
composes_with: []
---

# Flaky: Clifford Cl(3,0) cross-language byte-lock fails at ~15s on busy runners (TS/Python/Go subprocess spawn)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0SKWS1B087G0R0016VSQM2-*.md` glob. -->

## What happened

`test (TS hermetic)` on PR #14686 (run 32714246385, job 97392016072):
16444/16453 passed, ONE failed —

> (fail) Clifford cross-language verification (Cl(3,0) byte-lock) >
> geo_product produces identical results across TS, Python, Go
> [15063.16ms]

The PR's diff is app-side only (player layout + CSS) and cannot touch a
Clifford byte-lock. The test spawns Python and Go subprocesses and its
elapsed time sits exactly at ~15 s — the shape of a per-test timeout
being crossed on a loaded runner rather than a value divergence. PRs
auto-merged through this leg all night, so the test passes routinely.

## What this asks for

Same class as 081M0QDJGFJ (a CLI test flaking past its 5 s timeout):

- Confirm the failure mode from the full log (timeout vs actual byte
  mismatch — a mismatch would be a REAL cross-language divergence and a
  much bigger deal; the elapsed-at-timeout shape says timeout).
- If timeout: raise the per-test timeout for the subprocess-spawning
  byte-lock tests, or pre-warm/serialize the Python+Go spawns so the
  cold-start cost is not paid inside one test's budget.
- If mismatch: escalate immediately — that is the byte-lock doing its
  job, not a flake.

## Pointers

- PR #14686 — the unrelated PR it failed on (re-kicked).
- `tests/cross-verification/` — the byte-lock suites.
- workitems/081M0QDJGFJ* — the sibling timeout-flake class.
