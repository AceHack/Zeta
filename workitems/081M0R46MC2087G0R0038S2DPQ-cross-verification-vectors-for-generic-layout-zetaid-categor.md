---
id: 081M0R46MC2087G0R0038S2DPQ
type: task
state: backlog
priority: P2
slug: cross-verification-vectors-for-generic-layout-zetaid-categor
title: "Cross-verification vectors for Generic-layout ZetaId categories 9-12"
created: 2026-08-23T20:15:13.282Z
depends_on: []
composes_with: []
---

# Cross-verification vectors for Generic-layout ZetaId categories 9–12

## The gap

`tests/cross-verification/zeta-id/vectors.yaml` is **Observation-layout only**. Every
one of its vectors carries `authority_type` / `persona` / `momentum_type` / `location`
— fields that exist only in the observation packing — and `pack()` in
`src/Core.TypeScript/zeta-id/zeta-id.ts` **refuses `category >= 9`**:

```
if (obs.category >= 9) throw new Error("ZetaObservation.category must be < 9 (0..8) …")
```

Categories 9 and above use `packGeneric` / `unpackGeneric`, whose bit mapping is
genuinely different — payload low 65 bits at 0..64, upper 54 bits at 69..122, straddling
the category field. **That mapping has no golden vector in any oracle.** So
`ContentAddress = 9`, `InventoryAsset = 10`, `Channel = 11` and now `Agenda = 12` are
byte-locked on their **name and number** (enforced 2026-08-23 by
`src/Core.TypeScript/zeta-id/category-vocabulary-agreement.test.ts`) and **not on their
encoding**.

This predates the `Agenda` allocation and is not caused by it —
`inventory/items/0EFJ9RW179ZFT9WBMXZZNYM92A-*.md` has been minting unvectored
Generic-layout ids since 2026-07.

## Why it matters (the live lesson, same week)

PR #14296: `SoftValue.resolve` tie-breaking **diverged across all four oracles for an
unknown period, undetected, because the golden seed contained no tie**. A vector set
that never encodes the case proves nothing about the case. A straddling bitfield
mapping that no vector exercises is exactly that shape — and an off-by-one in the
`>> 65n` / `<< 69n` split would survive every test in the tree today.

## Shape of the fix

1. A **second vector kind** in `vectors.yaml` (`type: generic`) carrying
   `version` · `category` · `payload_dec` · `expected_hex` · `expected_crockford`,
   with the existing flat vectors untouched.
2. Readers in all four oracles: `src/Core.TypeScript/zeta-id/cross-verify.ts`,
   `tests/Tests.CSharp/ZetaId/CrossVerifyTests.cs` + `FlatVector.cs`, the F# equivalent,
   and the Rust oracle.
3. **Round-trip in both directions** — encode→decode and decode→encode. A category is a
   bitfield slice and a mask off-by-one is precisely the failure a one-direction test
   survives.
4. At least one vector per Generic category (9, 10, 11, 12) plus the boundary payloads
   `0`, `1`, `2^119 - 1` (`MAX_GENERIC_PAYLOAD`, already guarded by
   `PackGenericBoundTests`) and a payload whose bits straddle the 65/69 split.

## Falsifier for "done"

Break the `<< 69n` high-part shift in ONE oracle locally and confirm `cross-verify` goes
red; restore. If it stays green the vectors do not discriminate and the work is not done.

## Related

- 081M0R3WHTH087G0R0015CH5PV — the `Agenda = 12` allocation that surfaced this.
- 081M0QB3HP2087G0R0029W97ZZ — `ClusterNode`, which will land in the same Generic space.
- `docs/DECISIONS/2026-08-23-zetaid-keyed-agenda-declarations.md` §"What is and is not byte-locked".
