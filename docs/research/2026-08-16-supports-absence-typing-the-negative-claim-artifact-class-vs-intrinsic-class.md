# `supportsAbsence` — typing the negative claim: artifact-class vs intrinsic-class

**Date:** 2026-08-16 · **Ferried by:** Otto (shadow) · **Origin:** Aaron, 2026-08-16, generalizing
the density test from the dynamical-zeta thread:

> *"this is a good rule of thumb and if we can mechanize these checks to split these two classes
> for all agent errors human and AI this can really help categorize things."*

And on the cause:

> *"this is cause you are trained on the internet and most humans are very over confident and speak
> like they know the answer when they only suspect the answer. i'm fallible to this too, this is
> why our decorrelation is so important."*

## 1. The two classes

The distinction comes from complex analysis, where it is sharp: an obstruction to continuation is
either an artifact of your **coordinates** or a property of the **territory**. Mapped to claims of
absence — the failure mode this repo names as *"the gap between 'I did not find X' and 'X does not
exist'"*:

| class | the obstruction is in | signature |
|---|---|---|
| **artifact** | my method | another vocabulary / oracle / search axis finds it |
| **intrinsic** | the territory | every *independent* method fails at the same place |

**Worked instance, same day.** Otto searched for an ordering theorem under "individual / society /
world," found nothing, and wrote that it did not exist. It exists, is PROVEN, and is indexed under
**Condorcet**. Artifact-class, reported as intrinsic-class. That is the error this type prevents.

## 2. The criterion is probe DIVERSITY, not probe count

The mathematical criterion is **density**: a natural boundary is established by showing the
singularities accumulate *everywhere along the boundary* (Ostrowski–Hadamard), not by failing to
continue. General relativity has the same shape — the Kretschmann scalar is *finite* at an event
horizon (the obstruction is your coordinates) and *divergent* at r=0 (the obstruction is real), and
being coordinate-independent is the entire point.

Mechanized, that means recording **where each probe failed**, not merely that it failed:

- **same failure locus** across independent methods ⇒ intrinsic
- **scattered loci** ⇒ artifact of each method

## 3. Independence is the hard part, and we have measured it

A density verdict is worthless if the probes are correlated: *N* correlated probes are one probe
counted *N* times. This is `numerology-vs-number-theory`'s *"too many correlations is a warning,
not a confirmation signal"* — applied to **failures** instead of successes.

**The costume experiment (2026-08-16) measured exactly this axis:**

| probe set | ρ̂ |
|---|---|
| same weights, **different persona** | **0.651** |
| **different weights** | **0.096** |

So *"five agents all failed to find it"* drawn from five personas is approximately **one probe
counted five times**. Only weight-diverse (or oracle-diverse) probes decorrelate enough for
`Established` to mean anything. **This is a measured constraint on the design, not a guess** —
and it is the operational cash-out of Aaron's *"this is why our decorrelation is so important."*

## 4. Two tiers — open vocabulary vs a declared closure

The first draft of this design claimed absence can only ever be graded evidence, because a
knowledge base has no completeness. **Aaron corrected that**, and the correction is structural:

> *"we want to come up with an english linguistic seed that can be fully enumerated actually, and
> we will have language packs to extend the seed with other provably closed extensions, so every
> new pack does not bring in infinite english, only the infinite english packs do."*

Over a **provably closed** seed plus **provably closed** packs, exhaustive cover *is* available, so
absence recovers the status of a theorem. The claim is therefore conditional, not fundamental:

| domain | a negative result is |
|---|---|
| open / unbounded vocabulary | **graded evidence** — a posterior, never a proof |
| the declared closure (seed + loaded packs) | **provable** — exhaustive cover available |

**And the seed/pack architecture *is* the continuation architecture**, term for term:

| analytic continuation | linguistic seed |
|---|---|
| domain where the series converges | the **seed** |
| extension to a larger domain | a **language pack** |
| extension is unique/forced (identity theorem) | packs **provably closed** — no pack contradicts the seed |
| **natural boundary** — no extension exists | **"infinite English"** — the case that destroys closure |

Existing work: `081KZR81XZ508QG0R000NZB8MQ` slice 5 already specifies *"a minimal linguistic seed
with add-on language packs"* and carries its own falsifier — *"no add-on pack can resolve without
changing the seed, which would make the seed not minimal."*

## 5. The shape

`DerivationProtocol.fs` already types what supports a **positive** claim — `Evidence`,
`AssertedOnly`, and `supportsClaim`, which deliberately refuses `MutantSurvived` / `NotConfirmed` /
`AssertedOnly`. There is no counterpart for the **negative** claim. This is that counterpart, and
it fails closed the same way.

```
supportsAbsence : Closure option -> Probe list -> Absence

type Absence =
  | NotFound    of probes: Probe list                       // artifact-class — my methods failed
  | Established of locus: Locus * probes: Probe list        // intrinsic-class — decorrelated, common locus
                 * basis: Graded of confidence | Exhaustive of Closure
```

- **Default is `NotFound`.** Absence of evidence is evidence about the method until density is shown.
- `Established` requires probes decorrelated **by construction** — different weights or oracles,
  *not* different personas — plus a shared failure locus.
- `Exhaustive` is reachable **only** with a declared `Closure`; without one the best available basis
  is `Graded`. A negative claim may never be reported as a proof outside a declared closure.

## 6. Falsifiers

1. A mutant that lets a **persona-diverse** probe set reach `Established` must go **red**. This is
   the load-bearing one: it is the §3 measurement turned into a test.
2. A mutant that lets `Exhaustive` be reached **without** a declared `Closure` must go red.
3. A mutant that reaches `Established` from probes with **scattered** failure loci must go red.
4. `supportsAbsence [] = NotFound` — zero probes can never establish absence. (Guards the vacuity
   case: a check that passes on no evidence is not a check.)

## Register

| claim | register |
|---|---|
| density (not failed attempts) distinguishes the classes | **anchored** — Ostrowski–Hadamard; Kretschmann/inextendibility |
| persona-diversity does not decorrelate; weight-diversity does | **measured** — costume experiment, ρ̂ 0.651 vs 0.096 |
| `supportsClaim` has no negative counterpart today | **verified** — read from `DerivationProtocol.fs` |
| absence is provable over a declared closure | **conditional** — depends on the seed/pack closure being achieved, which is open work |
| this would have caught the Condorcet error | **plausible, not proven** — the probes were not logged at the time |

## Pointers

- `src/Core/DerivationProtocol.fs` — `Evidence`, `supportsClaim`, `AssertedOnly` (the positive twin)
- `src/Bayesian/ReportTriage.fs` — `TypedClaim`, and a `SeverityAdjudication` typed hole that names its own blocker; the natural consumer
- `workitems/081KZR81XZ508QG0R000NZB8MQ-*` slice 5 — the linguistic seed + closed packs
- `docs/research/2026-08-16-generate-the-tangle-dont-map-it-pollicott-ruelle-resonances-vs-lyapunov-cartography.md` §5b — where the density test came from
- `docs/research/2026-08-16-the-costume-experiment-*` — the ρ̂ measurement §3 rests on
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) — correlated agreement is not evidence; correlated failure is not absence
- `memory/feedback_absence_of_evidence_search_by_mechanism_not_by_name_*` — the failure mode this types
