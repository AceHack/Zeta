---
id: 081M2FC9TFX087G0R0003FK5J0
type: bug
state: backlog
priority: P2
slug: k3s-join-intent-preflight-test-loses-its-stdout-tail-intermi
title: "k3s join-intent preflight test loses its stdout tail intermittently in CI third occurrence"
created: 2026-09-14T07:15:00.221Z
depends_on: []
composes_with: []
---

# k3s join-intent preflight test loses its stdout tail intermittently in CI third occurrence

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2FC9TFX087G0R0003FK5J0-*.md` glob. -->

## Third occurrence, and the two prior explanations are both refuted

`lint-k3s-join-intent-preflight.test.ts:170` — `expect(r.out).toMatch(/nixos-rebuild switch --impure/)`.
Failed 2026-09-08 on `main` (PR-17008 record), 2026-09-10 in CI, and 2026-09-14 on PR #17406.
Always the same assertion.

## New evidence from the 2026-09-14 run

The received output is **~450 bytes** and stops mid-transcript on a bare prefix line:

```
[zeta-k3s-join-intent]   build says FOUND: services.k3s.serverAddr resolved EMPTY
[zeta-k3s-join-intent]
```

The script continues well past that point — the remediation block naming
`nixos-rebuild switch --impure` is at line 152 of
`full-ai-cluster/nixos/modules/k3s-join-intent-preflight.sh`.

| hypothesis | status |
|---|---|
| `maxBuffer` truncation | **refuted.** The file's own comment measures the refusal path at 1,999 bytes against a 65,536 buffer; this run received ~450, so the cap was never approached |
| spawn failure (ENOBUFS/ENOENT/signal) | **refuted.** The harness throws a named error when `r.error` is set; it did not fire |
| the `ZETA_SERIAL_DEVICE` second sink in `say()` blocking or failing | **refuted.** The test sets it to `<tmp>/no-such-serial`, so `[ -w ... ]` is false and that branch never executes |
| PR #17008's fix (closing the spawn env) | **refuted by recurrence** — already on record in the test file |

## What is odd and not yet explained

The test **immediately above** it calls the same `run()` with identical arguments and asserts
`/--impure/`, which appears at line 147 — *after* the point where this run's transcript stops. It
**passed** in the same suite execution. So two spawns of the same script, seconds apart, produced
transcripts of different lengths, and only the longer one satisfied its assertion.

That points at the harness or the runner rather than at the script's logic, and it is the first
time the two adjacent spawns have been compared. Duration was 7.60ms, so nothing hung.

## Do not

Do not raise `maxBuffer` (measured irrelevant), and do not retry or relax the assertion — the
remediation line is the thing the refusal exists to print, and a test that tolerates its absence
stops guarding the property. The next step is to capture `r.status` and the exact byte count on
every run and fail with those in the message, so the fourth occurrence arrives with the numbers
already attached instead of needing this reconstruction again.
