---
id: 081KZYYKHX1087G0R0036E9RH9
type: bug
state: done
priority: P2
slug: every-smt-runner-asserts-all-unsat-which-a-tautology-satisfi
title: "every SMT runner asserts all-unsat, which a tautology satisfies, so no runner can catch a vacuous lemma"
created: 2026-08-14T01:36:24.481Z
completed: 2026-08-14T02:08:17.010Z
depends_on: []
composes_with: []
---

# every SMT runner asserts all-unsat, which a tautology satisfies, so no runner can catch a vacuous lemma

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYYKHX1087G0R0036E9RH9-*.md` glob. -->

## The defect

**Every pre-existing `.smt2` runner in this repository asserts that all queries return `unsat`.**

An `unsat` expectation is satisfied by a **tautology**. If a lemma's premises secretly contain its own
conclusion, negating the conclusion is trivially unsatisfiable and the runner goes green — reporting a
proof where there is only a restatement. **So no existing runner could have caught a vacuous lemma**,
which is the one failure mode this lane exists to prevent.

## How it was found (CHECKED, not inferred)

`tools/Z3Verify/landauer-floor-lemma.smt2` was vacuous. Its second-law premise
`(>= (+ (- k) heat) 0.0)` **is** the conclusion `heat >= k` that it then negates. Deleting *only* that
premise flips the file from `unsat` to **`sat`, with model `k = 1.0, heat = 0.0`** — an erasure paying
no heat, which nothing else in the file excluded.

Two aggravating facts found alongside it:

- The file's header advertised **four** lemmas (F1–F4); the file contained **one**.
- **No workflow executed it**, which is why it rotted undetected. (Fixed for this file in #10494.)

## The fix pattern, already demonstrated

#10494's runner asserts the **verdict sequence**, including a deliberate **`sat`** from a
**non-vacuity probe** — a query constructed to be satisfiable if and only if the lemma is not a
tautology. Verified independently by **z3 and cvc5** returning the same sequence (BP-16 cross-check).

This is the same discipline as a mutation test: *a check that cannot fail is not a check*, and the way
to prove it can fail is to make it fail on purpose. It is also the sibling of the TLC finding earlier
today — `QuorumCollateral` and `WagerSolvency` stutter, so their deadlock checks are vacuous — which
suggests the vacuity class spans **every** formal lane here, not just SMT.

## Inventory (CHECKED as of 2026-08-13)

**9 lemma files. 4 with an executing runner after #10494; 5 with none.**

| runner exists | file |
|---|---|
| ✅ | `chsh-band-gate-agreement` |
| ✅ | `consolidate-quadratic-envelope` |
| ✅ | `gen-denotation-splitmix64` |
| ✅ | `landauer-floor-lemma` (added #10494, has the probe) |
| ❌ | `externality-bound` |
| ❌ | `light-time-endpoint-speed-envelope` |
| ❌ | `predictive-advantage` |
| ❌ | `privacy-budget-net-positive-regime` |
| ❌ | `whitewash-economics` |

Note `light-time-endpoint-speed-envelope` in the un-run column: it is the z3 certificate for the
**PROVED** orbital envelope theorem (#10418). The theorem itself is independently checked in Lean
(`src/Core.Lean4/Lean4/LightTimeAsymmetry.lean`, which **is** gated), so the property is not unverified — but the SMT
half of that cross-check has never executed.

## Two jobs, in order

1. **Retrofit the non-vacuity probe to the 4 runners that exist.** This is a retrofit, not a rewrite —
   add a probe query and assert the verdict *sequence* rather than all-unsat.
2. **File runners for the 5 with none.** Until then those lemmas are text; `lean-orphan-modules.ts`
   exists for exactly this shape on the Lean side and is the model.

## Acceptance

- No runner asserts "all unsat"; every runner asserts a verdict sequence containing at least one
  deliberate `sat`.
- Every `.smt2` file is either executed by a runner or listed with a **non-empty reason** — the
  `ORPHANS.json` / `unexecuted-test-files.json` shape.
- Mutating a lemma into a tautology turns its runner **red**.
