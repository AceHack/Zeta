---
id: 081M0DJSY48087G0R001GVG3AT
type: task
state: backlog
priority: P2
slug: z3-ufnra-witness-quorum-effective-independence-bound-n-eff-n
title: "Z3 UFNRA: witness-quorum effective-independence bound N_eff = N/(1+(N-1)rho) applied to witness observations"
created: 2026-08-19T17:58:47.176Z
depends_on: []
composes_with: []
---

# Z3 UFNRA: witness-quorum effective-independence bound N_eff = N/(1+(N-1)rho) applied to witness observations

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DJSY48087G0R001GVG3AT-*.md` glob. -->

**Routed by Soraya, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §5 (C3b).**

**Property class:** algebraic-law identity over reals. **Primary tool: Z3 (UFNRA).**

**Obligation.** `N_eff = N/(1+(N-1)*rho)` is monotone decreasing in rho and saturates at `1/rho`; and under the F3 hypotheses (§4d) `strength(B) < strength(A)` strictly.

**Encoding discipline — copy `tools/Z3Verify/whitewash-economics-lemma.smt2` exactly.** Leave the transcendental **uninterpreted**, constrained only by monotonicity and its fixed point, so the result holds for the exact function and for every monotone approximation. Encoding the shipped polynomial in QF_NRA grinds or returns `unknown`, and proves something about the approximation rather than about the quantity.

**Anti-vacuity:** the runner must produce a `sat` as well as `unsat` goals (the 2026-08-13 all-unsat retrofit, work-item 081KZYYKHX1087G0R0036E9RH9 — a tautology satisfies an all-unsat suite).

**Cross-check (BP-16):** the FsCheck leg (`081M0DJSY5C087G0R00094DD3Z`) closes the numerics blind spot this abstraction opens.

**Existing, do not re-derive:** `src/Bayesian/CondorcetBoundary.fs:79-86` (`effectiveN`) and `RHO-STAR-1`.
