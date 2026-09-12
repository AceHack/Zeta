# `db/refutations/` — the refutation ledger

**Carved sentence:** what was **tried and disproven**, recorded so a fresh context is told what
**not** to propose — one append-only file per row, never a single file.

## Shape

```text
db/refutations/<YYYY>/<MM>/<DD>/<32-hex ZetaId>.json
```

Date-partitioned, one row per file, nothing ever rewritten — the same shape as
`workitems/events/`. Aaron 2026-09-11: _"any ledger that's stored in git should not be a single
file, it should use partitioning and date based folders like we already described and can also
take advantage of our zetaid if needed."_ Registered in
[`registry/unbounded-growth-register.json`](../../registry/unbounded-growth-register.json) with a
measured rate and cost per row.

Two ids per row, both content addresses (Category-9 ZetaId, BLAKE3 over the canonical body):

- `claim` — over `surface` + `hypothesis`. The DV2.0 **hub** key: every witness of the same
  hypothesis shares it, so two rows can disagree without anyone picking a winner.
- `id` — over the whole body. The **satellite** key, and the source of idempotency: re-recording
  an identical row is a byte-identical no-op rather than a second entry.

## The score is two numbers, not a boolean

Every row carries a `DualScore` from
[`src/Core.TypeScript/belief/dual-score.ts`](../../src/Core.TypeScript/belief/dual-score.ts):
`trueChance` and `falseChance`, each in `[0,1]`, **independent** — `falseChance` is never
`1 - trueChance`. When they sum below 1 the gap is **ignorance**; above 1 it is
**contradiction**. Both are the signal, and neither survives a single probability.

**There is no combination rule.** The algebra is under review by the math team (Dempster–Shafer,
Jøsang, Belnap's FOUR, Walley, quasi-probability), and Dempster's rule is known-pathological
under exactly the high-conflict case this ledger cares about (Zadeh's counterexample). The one
joining operation is named `toyJoin` and is a display aid.

## Writing a row

Never by hand — `buildRow` validates and mints both ids, `writeRow` appends:

```ts
import { buildRow, writeRow } from "../../src/Core.TypeScript/belief/refutation-ledger";
```

`renderBriefing(byClaim(loadLedger(root).rows))` is the read side: what not to propose, with
both legs printed separately and no threshold applied on the reader's behalf.
