---
id: 081M0N9SSJ1087G0R001WVSN9V
type: task
state: done
priority: P2
slug: port-zeta23-linalg-von-neumann-trace-inequality-3-engine-to
title: "Port Zeta23/LinAlg (von Neumann trace inequality + §3 engine) to our Mathlib v4.30.0-rc1 pin"
created: 2026-08-22T17:55:20.769Z
completed: 2026-08-22T20:34:37.117Z
depends_on: []
composes_with: []
---

# Port Zeta23/LinAlg (von Neumann trace inequality + §3 engine) to our Mathlib v4.30.0-rc1 pin

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0N9SSJ1087G0R001WVSN9V-*.md` glob. -->

## Scope

Milestone 1 of Soraya's scoped plan: acquire the §3 linear-algebra engine of the Anthropic
zeta paper (`anthropic.com/research/riemann-zeta`) as Lean we can scrutinise and enhance.

**Register: `port`.** Adapted port of `Zeta23/LinAlg/` from `anthropics/zeta-23-lean` @ v1.0
(Apache-2.0, Copyright 2026 Anthropic, PBC), retargeted from Mathlib rev `51e6992efd06126df61a496bebf8f49482a4e129`
(Lean `v4.33.0-rc2`) to our pin (Lean/Mathlib `v4.30.0-rc1`). **Not an independent replication:
the upstream Lean source was read.** The bare phrase "we replicated it" is refused.

## What landed

- `src/Core.Lean4/Zeta23/` — the 8 ported files, a new `lean_lib` in `defaultTargets`,
  plus `LICENSE`, `NOTICE`, `NOTICE.upstream`, `README.md` (Apache-2.0 §4(a)–(d)).
- `src/Core.Lean4/Lean4/VonNeumannTraceWitness.lean` — **ours**, the anti-vacuity witness.
- Two axiom-audit steps in `.github/workflows/lean-proof.yml`, each with `--deny sorryAx`
  AND `--deny 'Unknown constant'`, run through `run-checked.ts` (never a pipeline).
- A registry row in `docs/research/verification-registry.md` carrying the `NOT claimed` field.

## Retarget cost

Zero proof edits. Measured by the spike before anything was written: the 8 files in a scratch
`lean_lib` at our pin, `lake build` once — 2690 jobs, completed successfully, no errors, no
`sorry`. Only `linter.style.longLine` warnings, on upstream's own provenance comment.

## NOT in scope

Theorems A and B; §§4–5; anything from `Zeta23/FromPNTPlus/`. This is the engine, not the
result. Downstream note found in passing: Mathlib has Sylvester's law of inertia only for
**real** quadratic forms; the Hermitian version is the paper's contribution and now sits in
`src/Core.Lean4/Zeta23/LinAlg/Sylvester.lean`. The paper's Prop. 4.1 shows the matrices in play are real
symmetric, so the real version may suffice downstream — unverified, flagged not resolved.
