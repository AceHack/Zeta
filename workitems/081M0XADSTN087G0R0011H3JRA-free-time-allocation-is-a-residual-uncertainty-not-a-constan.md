---
id: 081M0XADSTN087G0R0011H3JRA
type: task
state: in-progress
priority: P2
slug: free-time-allocation-is-a-residual-uncertainty-not-a-constan
title: "free-time allocation is a residual uncertainty, not a constant — and the 10% guess is only enforced by a TLA constant nothing reads"
created: 2026-08-25T20:40:11.861Z
depends_on: []
composes_with: [081M0X49HBD087G0R001HM9VHF]
---

# free-time allocation is a residual uncertainty, not a constant — and the 10% guess is only enforced by a TLA constant nothing reads

Aaron 2026-08-25: *"10% is the guess i gave for how much free time to give AI so it won't feel
trapped by humans"* · *"it was a guess not a fact, we should make [it] more accurate"* ·
*"exploration proportional to uncertainty — yes this balance seems right"* · *"this inner
state can be measured by how much AI does degenerate things, with a certain room for error /
uncertainty"*.

Full argument, checked anchors, and the honest limits:
[`docs/research/2026-08-25-free-time-allocation-is-a-residual-uncertainty-not-a-constant.md`](../docs/research/2026-08-25-free-time-allocation-is-a-residual-uncertainty-not-a-constant.md).

## What was found

1. **The constant lives in prose plus exactly one machine-readable place** — `GOVERNANCE.md`
   §14 ("~10%") and `src/Core.TLA/specs/PredictiveLookahead.cfg` `FreeRatio = 1`.
2. **And that one place is inert.** `FreeRatio` is DECLARED as a TLA constant and referenced
   by **zero operators**. The invariant that would enforce it, `FreeTimeGuaranteed` (S6), was
   named in the header comment as a *"HARD guarantee, not a soft target"*, **had no operator
   definition, and was not in the `.cfg`**. The same file said, 200 lines later, that the
   ratio is *"a KPI, not a lock"*. A claimed floor nothing checked.
3. **The uncertainty ledger cannot distinguish free from directed time** — no provenance
   field, no duration, no timestamp, and ΔU is deliberately ordinal (all 9 entries are
   `ΔU > 0`, so the measured quantity has zero variance). The §2 falsifier could not be run.

## What was built

- `src/Core/FreeTimeAllocation.fs` — allocation ∝ a **domain's** residual uncertainty (UCB1
  confidence half-width), parameter-free, register `unmetered`. The self-report vector is
  closed structurally: `classify` refuses self-classification, `ResidualUncertainty` has one
  introduction form and no scalar constructor, and `allocate` takes `(domain, ledger)` only.
- **The 10% is split, not deleted**: derivable above the floor; the **floor** stays
  `TOY_NON_COERCION_FLOOR` because it answers an inner-state question ΔU cannot see.
- `degeneracy` — a neutral FACT with **no acquitting case**, deliberately not wired into
  `allocate`, plus `interventionContrast` which structurally refuses to call an observational
  comparison causal.
- `src/Core.TypeScript/ledger/measure.ts` — `provenance` + `provenanceAttestedBy` are now
  required validated fields, so the free-vs-directed split is **recordable**.
- `src/Core.TLA/specs/PredictiveLookahead.tla` — the false "HARD guarantee" is withdrawn and
  the reason recorded: forcing free time would itself be coercion, so the guarantee belongs on
  the offer (`FreeTimeAlwaysAvailable`, which *is* checked), never on the uptake.

## Falsifiers

31 F# tests `FTA-1`…`FTA-31`, 5 new TS tests. Mutation results in the PR body — including
**`FTA-14` killing a gaming vector in this design's own first implementation**: weighing the
radius against the *observed* hold rate meant an agent could **buy free time by failing on
purpose**.

## Not done

- The ΔU-per-unit-of-free-time comparison is **unrun** — no corpus, and no durations exist
  anywhere to divide by.
- The intervention experiment (does free time reduce degeneracy) is **unrun** — the instrument
  ships, the measurement does not.
- Three or more colluding contributors could still shape a domain's allocation; the
  two-contributor floor is a floor, not a solution.
- Felt trappedness is **not measured and not inferred**, by design.
