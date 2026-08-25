---
id: 081M0TJXY32087G0R003TBTR7V
type: task
state: in-progress
priority: P2
slug: child-floor-policy-jurisdiction-indexed-age-threshold-plugge
title: "Child-floor policy: jurisdiction-indexed age threshold plugged into the proven ChildFloor gate (invariant predicate, jurisdictional parameter, fail-closed on unknown)"
created: 2026-08-24T19:11:05.826Z
depends_on: []
composes_with: []
---

# Child-floor policy: jurisdiction-indexed age threshold plugged into the proven ChildFloor gate (invariant predicate, jurisdictional parameter, fail-closed on unknown)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0TJXY32087G0R003TBTR7V-*.md` glob. -->

## The gap this closes

`src/Core.Lean4/Safety/ChildFloor.lean` proves `denied_never_executed`: an effect the policy
denies is never executed, at ANY depth. That is the gate. It quantifies over
`policy : Nat → Verdict` and says nothing about what the policy denies — it is satisfied by
`fun _ => .admit`. The gate was proven; the policy it enforces was never declared.

`lucent-ksk`'s [architecture declaration](https://github.com/Lucent-Financial-Group/lucent-ksk/blob/main/docs/ksk_architecture.yaml) names `red_lines: [no_minors, …]`. Nothing connected
a jurisdiction's age parameter to the proven gate. Identified as the one piece of new work in
`docs/research/2026-08-24-ksk-is-the-kinetic-rung-and-zeta-already-built-four-of-its-parts.md` §6.

## The design (Aaron 2026-08-24)

> *"the fixed moral floor is always protect children and disagree on their age around 16-21."*

- **Predicate — protect children — INVARIANT.** Not a competing morality under §11; the default
  oracle §11 itself carves out for morally-relevant entities.
- **Threshold — ~16 to 21 — JURISDICTIONAL.** A parameter; disagreement is legitimate.
- **Unknown resolves protectively**, not permissively: *"unknown include is better than unknown
  exclude"* — an unknown that halts is recoverable, one that ships is not.

## What landed

| surface | register |
|---|---|
| `src/Core.Lean4/Safety/ChildFloorPolicy.lean` | **proven**, `sorry`-free, universally quantified over the registry |
| `src/Core.TypeScript/child-floor/jurisdiction-threshold.ts` (+ tests) | **tested** — 31 falsifiers, 10 mutations killed |
| `db/child-floor/jurisdiction-readings.json` (+ README) | **declared** — legal readings, attributed and dated, revisable; NOT verified law, NOT legal advice |
| `src/Core.TypeScript/hygiene/lint-child-floor-registry.ts` (+ tests) | **tested**, runs in CI; byte-locks the band across the three oracles |

`ChildFloor.lean` is UNCHANGED. Every theorem instantiates the existing `denied_never_executed`.

## Deliberately not done

- **The classifier is not proven.** `classOf` (is this effect child-gated?) and `subjectOf`
  (whose age?) are the deployment's decoders. The proofs are conditional on a classification and
  say nothing about whether one is correct. That is the next, larger piece of work.
- **No deployed gate consumes the policy.** `src/Core.FSharp.ObserveBridge/Effects.fs`'s `Effect`
  taxonomy has no subject and no age, so wiring this in means extending that taxonomy — a design
  change, not a plug-in. The policy is **declared and proven**, not **deployed**.
- **`readings` ships EMPTY.** No attributed legal review exists, so every jurisdiction resolves to
  21 — the protective bound. That is the correct fail-closed state for an unreviewed registry, and
  inventing readings would have been the register violation this work exists to avoid.
