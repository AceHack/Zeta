---
id: 081M05ZZG6A087G0R001PBBKDX
type: bug
state: backlog
priority: P2
slug: wset-ts-consolidatewset-does-not-sort-by-key-f-wset-consolid
title: "wset.ts consolidateWSet does not sort by key; F# WSet.consolidate ends with List.sortBy fst"
created: 2026-08-16T19:15:05.546Z
depends_on: []
composes_with: []
---

# wset.ts consolidateWSet does not sort by key; F# WSet.consolidate ends with List.sortBy fst

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05ZZG6A087G0R001PBBKDX-*.md` glob. -->

## Found while mirroring `FourCornerTrace` to TypeScript (shadow, 2026-08-16)

`src/Core/WSet.fs` `WSet.consolidate` ends with `List.sortBy fst`, so a consolidated F# WSet is
in **canonical key order**. The TS port `src/Core.TypeScript/algebra/wset.ts` `consolidateWSet`
groups through a `Map<string, …>` and returns **`Map` insertion order** — i.e. the order the keys
first appeared in the *input*, which is caller-dependent.

So `consolidate` is order-divergent between the two oracles today. It is not a *value* divergence
(the same key→weight multiset comes out either way), which is why it has gone unnoticed: nothing
currently byte-locks a consolidated WSet. It becomes a real divergence the moment anything
serializes, hashes, Merkle-roots, or diffs one — the class of defect
081KT07NV0008QG0R001YDB73K already cost us once.

Not patched here, deliberately: `consolidateWSet` has existing callers and belongs to the algebra
lane, not to a mirroring change. `wset-four-corner-trace.ts` sorts **on top of** `consolidateWSet`
(`consolidateOrdered`, with an injected ordinal `compareKeys`) so the trace's own byte-lock holds
without moving anyone else's ground.

### The fix, when someone takes it

Sort inside `consolidateWSet` with an **injected ordinal comparator** — it cannot sort by itself,
because `K` is generic and the only key handle it has is `keyToString`. Two options:

1. add a required `compareKeys: (a: K, b: K) => number` parameter (mirrors what the trace module
   already does, and forces every caller to state its collation); or
2. sort by the already-required `keyToString` under **ordinal** comparison — correct for `string`
   keys, and WRONG for numeric keys (`"10" < "9"` ordinally), so option 1 is the honest one.

Either way: ordinal / codepoint, never `localeCompare` or `Intl.Collator`
(`.claude/rules/culture-invariant-by-default.md`). F#'s structural `compare` on `string` is
`String.CompareOrdinal` — checked, not assumed, in
`tests/Tests.FSharp/WSetFourCornerTraceTreaty.Tests.fs`.

### Cross-refs

- `src/Core/WSet.fs:42` (`consolidate`, the `List.sortBy fst` tail) — canonical.
- `src/Core.TypeScript/algebra/wset.ts:81` (`consolidateWSet`) — the port.
- `src/Core.TypeScript/algebra/wset-four-corner-trace.ts` (`consolidateOrdered`) — the local
  work-around, and the comment that points here.
- Prior faithfulness finding on the same file: `081KZHEYCKH08QG0R001PYEMME` (`discardWSet`).
- 081KT07NV0008QG0R001YDB73K — the collation bug class this would eventually reproduce.
