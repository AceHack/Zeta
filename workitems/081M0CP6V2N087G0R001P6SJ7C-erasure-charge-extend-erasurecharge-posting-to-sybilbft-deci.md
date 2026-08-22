---
id: 081M0CP6V2N087G0R001P6SJ7C
type: task
state: backlog
priority: P2
slug: erasure-charge-extend-erasurecharge-posting-to-sybilbft-deci
title: "Erasure charge: extend ErasureCharge posting to SybilBft.decide, Consensus, TravelerRankLedger and GiftOfErasure.mix"
created: 2026-08-19T09:39:01.333Z
depends_on: []
composes_with: []
---

# Erasure charge: extend ErasureCharge posting to SybilBft.decide, Consensus, TravelerRankLedger and GiftOfErasure.mix

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0CP6V2N087G0R001P6SJ7C-*.md` glob. -->


## Why this exists

`src/Core/ErasureCharge.fs` landed the charge fold: a declared `ErasureClass.Profile` becomes
`Free` / `Charged` / `Unmeasured` / `Malformed`, and an unmeasured operation turns the total into a
`LowerBound` naming the hole rather than a zero. `RecoverableSpine` posts on a shipped path.
`QuorumAlgebra.join` declares (marginal measured, conditional `H(A|B)` declared as a hole).

These four sites still charge nothing, and each is a **different kind** of remaining work:

| site | status | what it needs |
|---|---|---|
| `SybilBft.decide` | undeclared | a marginal sweep — a tally folded to one verdict is non-injective and finite, so this is measurable today |
| `Consensus` | undeclared | the same, plus a decision about which of its folds are distinct operations |
| `TravelerRankLedger` | undeclared | float EP updates; the observation needs stating before a sweep means anything |
| `GiftOfErasure.mix` | **declared, not posted** | a runtime posting path. `AnonymitySet` is an immutable value and threading a ledger through it changes a heavily-tested shape, so this is a design question, not a sweep |

## The trap to avoid

Do **not** declare any of these `Unmeasured` to close the gap. Their marginals are sweepable, and
`Unmeasured` is reserved for observations with no admissible measurement — the conditional `H(A|B)`
being the worked example. Declaring a measurable thing unmeasured is the vacuity class wearing the
honest register's clothes.

Do **not** invent a coefficient for the conditional cost either. That stays a hole until this
substrate carries caller-retained side information (`algebra/erasure-derivation.ts:49`).

## Pointers

- `src/Core/ErasureCharge.fs` · `src/Core.TypeScript/algebra/erasure-charge.ts` (the two oracles)
- `src/Core/WitnessCorrelationErasure.fs` (the pattern to follow: measured marginal + declared hole)
- `tests/Tests.FSharp/Formal/Erasure.Charge.Laws.Tests.fs`
- `docs/research/2026-08-18-an-unmetered-channel-is-a-maxwells-demon-retraction-is-free-compaction-is-where-we-pay-landauer.md` §13g
