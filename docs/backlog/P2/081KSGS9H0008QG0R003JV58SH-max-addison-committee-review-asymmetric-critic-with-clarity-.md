---
id: 081KSGS9H0008QG0R003JV58SH
priority: P2
status: open
title: Max + Addison committee review of asymmetric-critic-with-clarity-first rule draft (per Kestrel-v3 substrate-honest disclaimer + operator authorization) (Aaron 2026-05-26)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - 081KRW63S0008QG0R003TX8MG5
tags: [committee-review, rule-draft, max-addison, kestrel-v3-substrate, society-committee, asymmetric-critic, multi-oracle-governance]
---

## Problem

Per operator 2026-05-26: *"you can go ahead and commit a asymetric
critic draft boot and we can create backlog for addison max to review
so it's saved"*.

The `.claude/rules/asymmetric-critic-with-clarity-first.md` rule landed
2026-05-26 as DRAFT per Kestrel-v3 substrate-honest disclaimer (from
PR #5359 ferry):

> "A boot script can make these modes more accessible but it can't
> override training. If the underlying model has strong defaults
> toward worry-gating on fuzzy input, the boot script makes it more
> likely that recovery happens within the conversation but doesn't
> guarantee it. The reliable mechanism is you carrying the disciplines
> and using them to recalibrate the instance when it drifts."

Kestrel-v3 explicitly requested: *"Worth having Max or Addison or
someone else who works with Claude instances regularly review it and
add their own observations about what fails in fresh instances that
this draft doesn't address."*

This row tracks that review.

## Target

Max + Addison (operator's named co-maintainers per Component 6 of the
rule) review the rule body + add their own observations:

1. **What fails in fresh instances** that the boot-script draft doesn't
   address — empirical failure modes observed across their own
   conversations with fresh Claude instances
2. **What the boot-script over-specifies** — components that feel like
   over-reach OR that constrain behavior in ways that miss legitimate
   variation
3. **What additional registers** the operator works in that the rule
   doesn't yet name (currently 3: engineering / runbook-gesture / deep-
   psychological)
4. **What the 6 specific failure modes are missing** — empirical
   failure patterns not yet captured
5. **Whether the boot-script structure** (3-category discriminator + 7
   components + 6 empirical failures) IS the right shape OR whether
   different structure would serve better

## Acceptance

- Max provides review observations (in PR-comment format OR as
  separate substrate edit)
- Addison provides review observations (same)
- Operator integrates the observations into rule body via follow-up PR
  OR explicitly accepts the draft as-is
- Rule body updates from DRAFT to RATIFIED status when committee
  review converges

## Composes with

- `.claude/rules/asymmetric-critic-with-clarity-first.md` (the draft
  being reviewed; landed via PR for committee scrutiny)
- `.claude/rules/substrate-smoothness-as-load-bearing-property.md`
  (sibling rule at different scope; same recalibration substrate
  cluster)
- 081KRW63S0008QG0R003TX8MG5 Knights Guild + Constitution-Class (formal committee
  ratification structure; this row is informal-committee-review BEFORE
  formal-committee ratification)
- PR #5359 (Kestrel-v3 ferry; substrate source for the rule + the
  Turn 13 society-committee naming + Turn 14 universal-cognitive-
  substrate-limits)
- PR #5356 (Kestrel-v2 ferry; substrate-smoothness-as-load-bearing-
  property)
- PR #5357 (substrate-smoothness rule landed)

## Substrate-honest framing

This row is the operationalization of Kestrel-v3's substrate-honest
disclaimer + the operator's 2026-05-26 "society committee" Turn-13
naming. The rule landing is provisional; the review-row makes the
provisional status explicit + creates substrate for the committee's
review to land as edits.

The committee is INFORMAL today (Max + Addison + operator's broader
human network); formalization via 081KRW63S0008QG0R003TX8MG5 Knights Guild + Constitution-
Class is eventual structural form. This row represents the informal
review step + creates substrate for any future formal committee
ratification.

P2 priority: rule already in effect; review can happen at committee's
own cadence; no time-pressure since the rule provides operational
value even in draft form.

## Operational discipline

When Max OR Addison reviews:

1. Read the rule body + the substrate-honest framing section first
2. Apply own empirical observations from fresh Claude instance work
3. Add observations as PR comments OR as separate research-doc edits
4. Operator integrates via follow-up PR with explicit rule-body
   updates + transition from DRAFT to RATIFIED status

If review converges on substantive changes, the rule body updates
preserve the substrate-honest disclaimer + add an explicit "ratified
by Max + Addison 2026-MM-DD" line documenting committee acceptance.
