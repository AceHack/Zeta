---
id: 081M02N43P5087G0R0010MGWGK
type: bug
state: backlog
priority: P2
slug: cross-verify-ir-aggregate-floor-absorbs-a-dark-oracle-lane-q
title: "cross-verify-ir aggregate floor absorbs a dark oracle lane (qsharp) — per-route floor"
created: 2026-08-15T12:07:38.949Z
depends_on: []
composes_with: []
---

# cross-verify-ir aggregate floor absorbs a dark oracle lane (qsharp) — per-route floor

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M02N43P5087G0R0010MGWGK-*.md` glob. -->

## Observation

`tests/cross-verification/_harness/cross-verify-ir.test.ts` claims a 7-language
byte-lock but enforced it with an **aggregate** floor —
`expect(result.languages.length).toBeGreaterThanOrEqual(6)` in three places, over
**seven** lanes. Six live lanes satisfy the floor on the seventh's behalf, so one
lane going dark is absorbed: N silently drops to 6 while the run reports success.

The lane that goes dark in practice is **qsharp**, whose interpreter is the
gitignored `src/Core.Python/.venv/bin/python3`. The toolchain-presence test checks
`bun, python3, go, rustc, dotnet` via `which` — precisely not the venv or `qdk`.
And the `Q# participates when qdk is available` test was **conditionally vacuous**:
when the import check failed it executed **zero** `expect()` calls and passed.

Reproduced on a fresh worktree (no venv):

```
/bin/sh: .../src/Core.Python/.venv/bin/python3: No such file or directory   (x3)
 5 pass / 0 fail / 12 expect() calls        raw exit 0
```

Measured participation: **6 of 7** (`typescript, python, go, csharp, rust, fsharp`);
`qsharp` dark. With `uv sync --project src/Core.Python`: **7 of 7**, all agree — the
lane works, its absence is what was unreported.

## Scope (honest bound)

CI's `full-verify` job runs `smoke-7-toolchains.sh` **before** the cross-verify step,
and that script hard-fails on a missing venv/qdk. So the missing-venv vacuous pass is
**not currently live in that CI job** — the protection is a neighbouring step, not the
oracle's own floor. It is live for local `bun test` runs (where it was observed) and
for any invocation decoupled from the smoke step. Separately, `smoke-7` only checks
`import qdk`; verified that a stub `qdk` with no `Context` passes smoke (exit 0,
"qdk importable") while leaving the lane dark.

## Fix

Per-route floor: every lane in the exported `ORACLE_LANES` must contribute at least
one **executed case** (`laneCases[lane] >= 1`), failing by name. `crossVerify` now
reports `laneCases` + `darkLanes`; the CLI exits non-zero on a dark lane. The vacuous
conditional is replaced by an unconditional prerequisite check that names the venv and
the `uv sync` remedy. No aggregate floor added — PR #10744 established that an
aggregate floor cannot detect a single route failing.

## Falsifier

Rename the venv away → raw exit **1**, 4 fail, message names `qsharp`. Restore →
raw exit **0**, 5 pass, `expect()` calls 12 → 37.
