---
id: 081M08RQ3Y4087G0R0030P3S1C
type: task
state: backlog
priority: P2
slug: composition-read-path-what-a-needs-to-decide-whether-to-buil
title: "Composition read-path: what A needs to decide whether to build on B (conferred record, no verdict)"
created: 2026-08-17T21:05:54.116Z
depends_on: []
composes_with: []
---

# Composition read-path: what A needs to decide whether to build on B (conferred record, no verdict)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M08RQ3Y4087G0R0030P3S1C-*.md` glob. -->

Aaron 2026-08-17: *"lego like building for one intelligence to connect together and build on
other intelligences based on past reliability."* This item is the **consumption** half — how A
decides whether to build on B. The detector half (identity-claim contradiction) is a separate
lane and is not touched here.

## 1. Measurement first — the header of `src/Core.TypeScript/observe/self-claims.ts` claims three consumers

Its header states that the reliability score is used by (1) other agents scheduling around a
dependency, (2) the scheduler sizing the window τ, (3) the fleet KPI/DORA overlay. Measured by
finding the definition and then every non-test caller:

| lane | status | evidence |
|---|---|---|
| (1) other agents check reliability before depending | **UNWIRED** | `computeReliability` — 0 non-test callers. All hits are `self-claims.ts` itself, `self-claims.test.ts`, and two `docs/DECISIONS/` rows. `schedulingWindowForDependency` — same, 0 non-test callers. |
| (2) scheduler extends/shrinks τ | **UNWIRED** | `ferry-throttler/optimal-cadence.ts::adjustPressureByReliability` takes a bare `windowMultiplier: number`; its only callers are its own tests. Nothing computes a multiplier and hands it over — the two halves of the pipe exist and are not joined. |
| (3) fleet KPI / DORA overlay | **UNWIRED** | no consumer of `ReliabilityScore` anywhere outside tests. |

The one **real** consumer of `self-claims.ts` is `src/Core.TypeScript/planning/calibration-bridge.ts`, and it
consumes the **ledger** (`recordClaim` / `markClaimMet` / `markClaimMissed` / `resolveAtTick`),
never the score — it folds outcomes into `calibration-ledger.ts` and `traveler-rank-ledger.ts`
instead. Two `docs/DECISIONS/` rows mark both functions "✅ Shipped", which is true of the
function and false of the wiring.

**The deeper reason not to wire lane (1) as written:** `computeReliability` reads only the
claiming agent's *own* claims, and `markClaimMet` records no labeler. Its number is therefore
**self-asserted input**, not conferred — the property a composition surface must have.
`competence-attribution.ts`'s `OutcomeRecord` requires a `labeler` and refuses a self-labeled
outcome; that is the lane a consumer should read.

## 2. What shipped

`src/Core.TypeScript/planning/composition-read.ts` (+ `.test.ts`), the read-path:

- `readDependency(outcomes, edges, query)` → `Admission<DependencyRead>`.
- `DependencyRead` is `unknown | recorded`. **`unknown` carries no score field**, so a
  no-track-record provider cannot be read as good *or* bad — matching the `prior-only`
  discipline in `readCompetence` and the honest-0.5-prior discipline in `TravelerRankLedger`.
- **Conferral only.** No parameter exists through which B supplies a number about B.
  Self-labeled outcomes are excluded (by `attribute`'s existing invariant b) and *counted* as
  `selfAttestedExcluded`; a provider with nothing but self-attestations reads `unknown`.
- **Binding vs persuasive are never summed.** One block for the queried capability, one per
  other scope. `binding === undefined` with non-empty `persuasive` is a first-class answer:
  *"B has a record, but not in what you asked for."* This preserves the rank ledger's domain
  isolation (verifier standing does not buy signer standing) instead of collapsing it.
- **`review-vote` is refused** as a basis for a composition decision — otherwise the
  circularity that `competence-attribution.ts` keeps unfoldable could be reached by asking the
  question a different way.
- **The chain is reported, not multiplied.** `readCompositionChain` returns per-link reads plus
  `unknownLinks` / `offCapabilityLinks`, and no aggregate.

## 3. The threshold trap

No constant ships. The module exports zero numbers (mechanically tested). A caller that needs a
gate supplies a `DependencyPolicy`, and `applyPolicy` **refuses** one whose `derivedFrom` is
empty — so an unattributed gating constant cannot be minted through this surface. Precedent:
`src/Core.TypeScript/chip9/consult-census.ts` returns no verdict for the same reason.

## 4. Falsifiers

Six named mutations, each confirmed red — see the PR body for pass/fail counts.

## 5. Not done

Reconciling the unwired self-claims lanes (1)–(3) is *not* attempted here: either they get a
conferred determiner (a `labeler` on claim resolution) or they stay a voluntary self-report
that a consumer must not depend on. That is a design call, and the read-path does not need it.
