---
id: 081M05ZY301087G0R002F9QNP0
type: task
state: backlog
priority: P2
slug: supportsabsence-type-the-negative-claim-artifact-class-vs-in
title: "supportsAbsence — type the negative claim: artifact-class vs intrinsic-class via decorrelated probes"
created: 2026-08-16T19:14:19.265Z
depends_on: []
composes_with: []
---

# supportsAbsence — type the negative claim: artifact-class vs intrinsic-class via decorrelated probes

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05ZY301087G0R002F9QNP0-*.md` glob. -->

## What

`DerivationProtocol.fs` types what supports a **positive** claim (`Evidence`, `supportsClaim`,
which deliberately refuses `AssertedOnly` / `MutantSurvived` / `NotConfirmed`). There is **no
counterpart for the negative claim** — nothing stops "I did not find X" being reported as "X does
not exist."

Add `supportsAbsence`, failing closed the same way.

```
supportsAbsence : Closure option -> Probe list -> Absence

type Absence =
  | NotFound    of probes: Probe list
  | Established of locus: Locus * probes: Probe list
                 * basis: Graded of confidence | Exhaustive of Closure
```

## Why this shape

**The criterion is probe DIVERSITY, not probe count.** Borrowed from where the distinction is
sharp: a natural boundary is established by showing singularities are *dense* on the boundary
(Ostrowski–Hadamard), never by failing to continue; and in GR the Kretschmann scalar is finite at a
horizon (obstruction is your coordinates) and divergent at r=0 (obstruction is real). So record
**where** each probe failed — same locus across independent methods ⇒ intrinsic; scattered loci ⇒
artifact.

**Independence is measured, not assumed.** The costume experiment (2026-08-16) found
ρ̂ = **0.651** across personas on the same weights vs **0.096** across different weights. So five
persona-diverse probes are ≈ **one probe counted five times**. `Established` requires probes
decorrelated *by construction* — different weights or oracles, not different personas.

**Two tiers.** Over an open vocabulary a negative result is a posterior. Over a **declared
closure** — the linguistic seed plus provably-closed packs of `081KZR81XZ508QG0R000NZB8MQ` slice 5
— exhaustive cover is available and absence recovers the status of a theorem. `Exhaustive` is
reachable **only** with a declared `Closure`.

## Definition of done

Each of these must be demonstrated with a **mutant that goes red**; a guard that cannot fail is not
a guard:

1. A **persona-diverse** probe set reaching `Established` ⇒ **red**. (Load-bearing: it is the ρ̂
   measurement turned into a test.)
2. `Exhaustive` reached **without** a declared `Closure` ⇒ **red**.
3. `Established` reached from probes with **scattered** failure loci ⇒ **red**.
4. `supportsAbsence _ [] = NotFound` — zero probes never establish absence.

## Scope discipline

- **Do not** wire this into any gate or blocking check in this item. Add the type, the function,
  and the falsifiers. Adoption is a separate decision.
- `ReportTriage.fs` is the natural consumer (it already carries `TypedClaim` and a
  `SeverityAdjudication` typed hole that names its own blocker) — but consuming it is **out of
  scope here**.
- Honest limit to carry in the docstring: this would *plausibly* have caught the Condorcet error
  (searched under "individual/society/world", indexed under **Condorcet**), but that is **not
  proven** — the probes were not logged at the time.

## Pointers

- `docs/research/2026-08-16-supports-absence-typing-the-negative-claim-artifact-class-vs-intrinsic-class.md` — full derivation, register table
- `src/Core/DerivationProtocol.fs` — the positive twin
- `workitems/081KZR81XZ508QG0R000NZB8MQ-*` slice 5 — the seed/pack closure `Exhaustive` depends on
- `.claude/rules/numerology-vs-number-theory.md` — correlated agreement is not evidence; correlated failure is not absence
