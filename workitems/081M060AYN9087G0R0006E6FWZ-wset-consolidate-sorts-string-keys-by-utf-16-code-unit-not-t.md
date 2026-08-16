---
id: 081M060AYN9087G0R0006E6FWZ
type: bug
state: backlog
priority: P2
slug: wset-consolidate-sorts-string-keys-by-utf-16-code-unit-not-t
title: "WSet.consolidate sorts string keys by UTF-16 code UNIT, not the repo's canonical code POINT collation"
created: 2026-08-16T19:21:20.809Z
depends_on: []
composes_with: []
---

# WSet.consolidate sorts string keys by UTF-16 code UNIT, not the repo's canonical code POINT collation

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M060AYN9087G0R0006E6FWZ-*.md` glob. -->

## Found while mirroring `FourCornerTrace` to TypeScript (shadow, 2026-08-16)

`WSet.consolidate` ends with `List.sortBy fst`. F#'s structural comparison on `string` is
`String.CompareOrdinal`, which orders by **UTF-16 code UNIT**. The repo's *canonical* collation is
`src/Core.TypeScript/collation/collation.ts` `stringCompare`, which is **code POINT** order
(surrogate-aware; `docs/research/2026-08-15-canonical-collation-is-utf8-byte-order-*` and the
SQL Server note in `collation.ts` make the same distinction: `_BIN2_UTF8` is true code-point order,
`BIN2` over `nvarchar` is code-unit and "agrees on the BMP, DIVERGES above it").

So a consolidated `WSet` with an **astral** string key is ordered off-treaty.

### Measured, not asserted

```
U+1F600 (😀, lead surrogate D83D)  vs  U+FFFD
  F# List.sort / String.CompareOrdinal :  😀  before  U+FFFD    (code UNIT: D83D < FFFD)
  collation.ts stringCompare           :  U+FFFD  before  😀    (code POINT: FFFD < 1F600)
```

Reproduced on both sides while writing the `FourCornerTrace` treaty vectors. Pinned by:

- `tests/Tests.FSharp/WSetFourCornerTraceTreaty.Tests.fs`
  — `KNOWN GAP: F# ordinal is UTF-16 code UNIT, not the canonical code POINT collation`
- `src/Core.TypeScript/algebra/wset-four-corner-trace.test.ts`
  — `KNOWN GAP: ordinal here is code-UNIT (matching F#), not the canonical code-POINT collation`

Both tests also assert the two collations agree on every key in the golden vectors (all BMP), so
the byte-lock is exact today and this is latent, not live.

### Why the mirror matched F# instead of matching the treaty

Deliberate. `wset-four-corner-trace.ts` uses code-UNIT `ordinalCompareKeys` so the F#↔TS byte-lock
is **true**. Using canonical `stringCompare` on the TS side would have made the two oracles
silently disagree on astral keys while the file still claimed parity — a false parity claim, which
is worse than a named gap. When `consolidate` moves, the mirror moves with it and the golden
vectors get an astral key.

### Scope note

`WSet.consolidate` is generic over `'K: comparison`; the gap is specific to `string` keys (and to
any key type whose structural comparison bottoms out in one). Non-string keys are unaffected.

### Cross-refs

- `src/Core/WSet.fs:42` (`consolidate`) — where the sort lives. Not patched here: it is Vera's file
  and landed hours before this mirror.
- `src/Core.TypeScript/collation/collation.ts` (`stringCompare`) — the canonical collation.
- `.claude/rules/culture-invariant-by-default.md` §"Bit-perfect caveat: 'ordinal' still diverges
  across languages" — this rule already predicted exactly this; here is a live instance.
- 081KT07NV0008QG0R001YDB73K — the collation bug class.
- 081M05ZZG6A087G0R001PBBKDX — the sibling finding (TS `consolidateWSet` does not sort at all).
