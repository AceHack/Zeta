---
id: 081KV6BW42K08QG0R003GJM21N
type: task
state: completed
priority: P2
slug: adopt-cvc5-e-prover-as-decorrelated-atp-smt-cross-checks-in
title: "Adopt CVC5 + E prover as decorrelated ATP/SMT cross-checks in Soraya's portfolio (Z3 vs CVC5 agreement = BP-16 cross-check); Coq/Isabelle operator-available, NOT contributor-shared"
created: 2026-06-15T19:24:28.627Z
completed: 2026-06-21T06:18:00.000Z
depends_on: []
composes_with: []
---

# Adopt CVC5 + E prover as decorrelated ATP/SMT cross-checks in Soraya's portfolio (Z3 vs CVC5 agreement = BP-16 cross-check); Coq/Isabelle operator-available, NOT contributor-shared

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KV6BW42K08QG0R003GJM21N-*.md` glob. -->

**Routed by:** Otto (shadow\*) for Aaron 2026-06-15 ("pull in CVC5 AND E prover").
**Owner:** Soraya (formal-verification router — portfolio + routing) + Dejan
(devops — install script `tools/setup/` + CI integration, GOVERNANCE.md §24).
**Origin:** Robert George's "Theorem Provers" slide (YC talk) — the ATP column is
TLA+ / E / Z3 / CVC5; we already run TLA+ + Z3 + Lean. Transcript +
framework-mapping: `docs/research/ip-questionable/2026-06-15-robert-george-lean-for-science-verified-intelligence-yc-talk-verbatim-transcript-aaron-forwarded.md`.

## Why

The value is **decorrelation, not redundancy** (the decorrelated-selection thesis
applied to provers; BP-16 cross-check rule). Two *independent* solvers on the same
goal: **agreement ⇒ high confidence; disagreement ⇒ a real bug** (in our encoding
or in a solver). George's three columns (ATP / LLM / ITP) are themselves a
decorrelated ensemble of proof *methods*; cross-tool agreement is the strongest
signal we can buy cheaply.

## Scope

1. **CVC5** — SMT-LIB-2 compatible ⇒ near drop-in alongside Z3. Wire it as an
   *alternative SMT backend* behind the same SMT-LIB query surface; run Z3 **and**
   CVC5 on each SMT goal; assert agreement; surface disagreement as a finding.
2. **E prover** — first-order ATP (TPTP). Add as an FOL backend for goals that are
   first-order-shaped (where SMT theories don't fit). Lower-frequency than the
   SMT pair; route by property class (Soraya).
3. **Cross-check harness** — a thin runner that fans one goal to {Z3, CVC5, (E for
   FOL)} and records per-solver verdict + agreement, DST-replayable (record the
   solver outputs as metered crossings — noninterference §13; the solver is an
   external channel).

## Constraints (operator-stated, Aaron 2026-06-15)

- **Coq / Isabelle: operator-available but NOT contributor-shared.** Aaron has them
  if needed, but they must **not** become a required dependency for other
  contributors. So: do **not** add Coq/Isabelle to the shared install script or the
  build gate. If ITP *diversity* (cross-checking Lean) is ever wanted, gate it
  behind an **optional, operator-only** path — never the default contributor build.
- CVC5 + E **may** go in the shared install script (open-source, redistributable) —
  Dejan confirms licensing + pins versions (GOVERNANCE.md §24 one-install-script,
  three consumers: laptop / CI / devcontainer).

## Done / falsifier

- **Done:** an SMT goal in the repo is checked by *both* Z3 and CVC5 through one
  surface; CI runs both; a deliberate disagreement (planted bug) is caught; install
  script + CI pin both; Coq/Isabelle stay out of the shared path.
- **Falsifier / drop signal:** if CVC5 never disagrees with Z3 on our goals across a
  meaningful sample (ρ→1 — the solvers are *not* decorrelated on our problem class),
  the cross-check buys nothing here → keep CVC5 as a fallback only, and `log()` that
  the decorrelation was empirically absent (no silent cap).

## Anchors

CVC5 (Barbosa, Barrett, et al.) · E prover (Schulz) · Z3 (de Moura & Bjørner) ·
TLA+ (Lamport) · SMT-LIB / TPTP standards · BP-16 cross-check rule · the
decorrelated-selection §B row (Condorcet — agreement of independent checkers) ·
noninterference §13 (solver = metered external channel) · GOVERNANCE.md §24
(one install script) · Robert George's theorem-provers taxonomy (ip-questionable
transcript).
