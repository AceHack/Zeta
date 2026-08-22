---
id: 081M05X878G087G0R002FHTYNJ
type: bug
state: backlog
priority: P2
slug: pairkey-orders-by-utf-16-code-unit-in-both-oracles-disagreei
title: "pairKey orders by UTF-16 code unit in both oracles, disagreeing with the code-point collation treaty"
created: 2026-08-16T18:27:25.584Z
depends_on: []
composes_with: []
---

# pairKey orders by UTF-16 code unit in both oracles, disagreeing with the code-point collation treaty

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05X878G087G0R002FHTYNJ-*.md` glob. -->

## The finding

`pairKey` builds an unordered pair key by ordering the two ids, and it does so by
**UTF-16 code unit** in both oracles:

- `src/Core.TypeScript/discovery/gossip-salon.ts:47-49` — `a <= b` (JS string
  relational comparison is code-unit order)
- `src/Bayesian/GossipTelemetry.fs:35-36` — `System.String.CompareOrdinal(a, b) <= 0`
  (.NET ordinal is also code-unit order)

The two oracles therefore **agree with each other** — and **both disagree with the
repo's own collation treaty**, which is code POINT ≡ UTF-8 byte order
(`src/Core/Collation.fs` `binary` = `UnicodeCodePointComparer`;
`src/Core.TypeScript/collation/collation.ts` `stringCompare`). They diverge on
non-BMP (astral) ids: U+FF3A vs U+10000 orders one way by code unit and the other
by code point. A Rust oracle comparing UTF-8 bytes would side with the treaty
against both of these.

## Why it was NOT fixed in the sweep PR

`pairKey` is a **key constructor**. Changing the comparison changes which of
`(a,b)` / `(b,a)` is canonical for any astral pair, which changes the emitted key,
which changes:

- the `crossings` map keys in the folded salon state
- any persisted or gossiped telemetry already keyed by those strings

That is a **migration with a cost to establish**, not a cleanup line, and it must
not be folded into a sweep. This item is that migration.

## What has to be decided first

1. Does any **persisted or in-flight** artifact carry a `pairKey` today? If yes,
   the change needs a rekey/backfill and the byte-locks that pin those keys must
   be regenerated deliberately.
2. Are node ids **constrained to BMP** by schema? If they are, the divergence is
   unreachable and the correct fix is to *say so in a test* rather than change the
   comparison — cheaper, and it stops the next reader re-litigating this.
3. If ids are unconstrained, both sites move to the treaty comparator and a
   differential test pins TS ≡ F# ≡ treaty on an astral probe set.

## Honest scope note

This is a **latent** defect on today's data, not a live one: node ids observed so
far are ASCII. It is filed because the direction of travel (a society admitting
arbitrary addresses) is exactly what activates it.
