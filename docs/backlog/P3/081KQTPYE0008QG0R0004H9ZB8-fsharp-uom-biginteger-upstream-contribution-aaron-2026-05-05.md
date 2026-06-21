---
id: 081KQTPYE0008QG0R0004H9ZB8
priority: P3
status: open
title: F# UoM-on-BigInteger upstream contribution -- comment on fslang-suggestions/831 + optional RFC pre-draft (Aaron 2026-05-05 absorb-and-contribute)
tier: research+upstream-contribution
effort: S
ask: Aaron 2026-05-05 verbatim "but no implementation. do they need help we are good neighbors and citizens of github and our dependencies"
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [081KQTPYE0008QG0R001W237MZ, 081KQTPYE0008QG0R0028GRW88]
tags: [fsharp, units-of-measure, biginteger, upstream-contribution, absorb-and-contribute, rfc, fslang-suggestions, citizenship]
type: feature
---

# 081KQTPYE0008QG0R0004H9ZB8 -- F# UoM-on-BigInteger upstream contribution

## Source

Aaron 2026-05-05 verbatim, after PR #1596 verified F# UoM does NOT
natively extend to `System.Numerics.BigInteger`:

> *"but no implementation. do they need help we are good neighbors
> and citizens of github and our dependencies"*

The verification is documented in 081KQTPYE0008QG0R001W237MZ acceptance criterion (d)
landing 2026-05-05. The relevant upstream surfaces:

- [Microsoft Learn: Units of Measure](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/units-of-measure) -- canonical doc
- [fslang-suggestions/831 (Generic Arithmetic)](https://github.com/fsharp/fslang-suggestions/issues/831) -- open-discussion thread, no implementation, adjacent (BigInteger as int64 escalation type)
- [`fsprojects/FSharp.UMX`](https://github.com/fsprojects/FSharp.UMX) -- community workaround for non-numeric primitives; demonstrates phantom-type pattern that would generalize

## Why P3 not P2

- **Not blocking Zeta**: per 081KQTPYE0008QG0R001W237MZ verification, the in-language workarounds (custom phantom-type wrapper struct, or paired `<weight>`-tagged unit-1 value) are sufficient for 081KQTPYE0008QG0R001W237MZ's per-class adoption decision. Native UoM-on-BigInteger is nice-to-have, not load-bearing.
- **Citizenship work, not survival work**: per `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md` -- when we depend on community work AND identify a gap that affects us, contributing back is the discipline. Doesn't accelerate Zeta's shipping; advances the ecosystem.
- **Bounded scope per option**: the lightweight option is a single comment on an existing thread; the heavier option is a single RFC pre-draft.

## Two contribution shapes

### Option 1 -- Lightweight: comment on fslang-suggestions/831

A single comment thread-reply that surfaces Zeta's use case as evidence-of-demand:

- **Use case**: `BigInteger<weight>` for incremental-view-maintenance (DBSP) Z-set algebra where signed weight aggregation can exceed int64 in long-running heavy-multiplicity streams
- **Specific shape needed**: arithmetic operators (`+`, `-`, `*`, `Checked.*`) and comparisons preserving the `<measure>` tag through BigInteger arithmetic
- **Why it matters**: the four-property hodl invariant (DST-safe + lock-free + scale-free + DBSP-native) requires scale-free arithmetic; without `BigInteger<weight>`, downstream consumers must either give up UoM safety (option 2 in 081KQTPYE0008QG0R001W237MZ) or write custom wrapper structs (option 1 in 081KQTPYE0008QG0R001W237MZ). Both are friction; native support resolves it.
- **What we are NOT asking for**: implementation timing, prioritization, or any specific shape -- just signaling that the gap is felt downstream.

Costs nothing. Signals upstream that the discussion has at least one production-shaped use case behind it.

### Option 2 -- Heavier: RFC pre-draft for UoM-extension-to-BigInteger

Specifically targeted RFC (separate from generic-arithmetic in fslang-suggestions/831) extending the F# Units-of-Measure feature to `System.Numerics.BigInteger`. Pattern follows PR #1591 (existential-quantification-in-type-tests pre-draft) -- mirror-not-beacon discipline; verification preconditions documented; not submitted upstream until preconditions clear.

Verification preconditions (same shape as #1591):

1. Search `fsharp/fslang-suggestions` for prior threads specifically on UoM-on-BigInteger (separate from generic-arithmetic/831 which is broader).
2. Search `fsharp/fslang-design` for in-flight RFCs touching UoM scope.
3. Search Don Syme's published work + GitHub commentary for prior treatment of the primitive-numeric-types constraint on UoM (was it deliberate? What were the considered alternatives at the time?).
4. Cross-check with `dotnet/csharplang` -- C# doesn't have UoM, but generic-arithmetic interfaces (`INumber<T>` etc.) are the C# analog; coordinated or independent treatment may matter.
5. Confirm Zeta's plugin adapter substrate is publicly visible / linkable from the RFC's worked-example section.

## Acceptance criteria

1. **Option 1 lightweight comment** posted on fslang-suggestions/831 (or a new specifically-UoM-on-BigInteger thread if /831 owners prefer split scope), citing Zeta's use case + four-property hodl context. Comment is a one-shot signal; no commitment to implementation.
2. **Option 2 RFC pre-draft** (optional, escalation): if Aaron decides to escalate, draft RFC pre-draft following PR #1591's pattern. Verification preconditions above must clear before any upstream submission.
3. **Engagement gate**: per the established discipline, only engage upstream IF the contribution has substance (a real use case OR a concrete proposal). Do NOT engage with speculative or under-scoped contributions -- per the Prop 3.5 misattribution worked example, premature upstream engagement on under-verified findings is itself the failure mode this row guards against.

## Out of scope

- **Implementation**: this row is contribution-discussion, not implementation. Native F# language changes go through the F# language-design process (Don Syme + F# language committee + Microsoft); Zeta's role is provide evidence-of-demand and a worked-example RFC if escalated, NOT implement the language feature itself.
- **Engagement on Zeta's broader scope**: the comment / RFC should be narrow (UoM-on-BigInteger). Linking out to "we have this whole DBSP framework with four-property hodl" is mirror-not-beacon-violating in upstream context; keep the contribution focused on the specific gap.

## The carved sentence

**"Zeta's verification of F# UoM not extending to BigInteger is a gap-found-by-dependent. Absorb-and-contribute discipline says contribute back. Two shapes: lightweight comment surfacing use case (cost-free, citizen-move), or heavier RFC pre-draft (effortful, requires verification preconditions per PR #1591). Engagement gate: only escalate IF contribution has substance. The premature-engagement failure mode (Prop 3.5 misattribution) is the worked example of why."**

## Composes with

- **081KQTPYE0008QG0R001W237MZ** (BigInt + bignumber integration) -- the parent row this contribution is downstream of
- **PR #1591** (F# RFC pre-draft for existential-quantification-in-type-tests) -- pattern to follow for Option 2
- `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md` -- the discipline this row instantiates
- `docs/research/2026-05-05-claudeai-falsifiability-catch-bp-ep-kernel-mdl-two-part-code-aaron-forwarded-preservation.md` -- the dialectical-unfalsifiability discipline that gates engagement
- [fslang-suggestions/831](https://github.com/fsharp/fslang-suggestions/issues/831) -- the upstream thread to comment on or branch from
- [Microsoft Learn: Units of Measure](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/units-of-measure) -- the canonical doc the contribution would extend
