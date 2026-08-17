# uncertainty/ — the uncertainty LEDGER (the measurement pole), at root

`uncertainty/` holds the **uncertainty ledger** (Aaron 2026-06-10: "uncertainty is a ledger"). Uncertainty
is not a vague feeling here — it is a **ledger**: an append-of-measurements that is **commutative + order-
free** (you can receive entries in any order, any time; they sum to the right total). Sibling/opposite of
`ground/`.

- **A ledger** — entries are **uncertainty reductions / ΔU** (the one metric: ΔU > 0 = uncertainty reduced).
  **Commutative** (order doesn't matter — the reorder-loophole is bounded by commutativity) ⇒ it survives
  the noisy network: **the only thing that crosses Reticulum is the uncertainty ledger** (the Ani-ferry
  result; nothing the noise can corrupt).
- **The meter** — Zeta is an uncertainty meter; this ledger is its tape. Written by the `measure` verb
  (below). *Intended* to be fed by the **sonar** and read by the **finalizer**
  (`TickResult.DeltaU`/`Temperature` → decide) — that seam is **not built**; see Status.
- **The mason's material** — uncertainty is the mason (intelligence builds, uncertainty masons); the ledger
  is the courses laid. The **encrypted-null** pole (you can't prove anything about the null; maximal entropy).
- **Idempotent / DST** — set-union/max semantics; safe to replay/redeliver (composes with the commutative
  + git-as-event-store fold).

## How an entry is written — the `measure` verb

Entries are **never hand-edited into existence**; they are committed by the verb, which refuses the
entries that would corrupt the ledger:

```bash
bun src/Core.TypeScript/ledger/measure.ts \
  --work-item <ZetaId> --title "..." \
  --measure "what moved, concretely" \
  --sign reduced|increased|unchanged \
  --because "why that is a ΔU of that sign" \
  --witness "the test or proof that fails without the fix" \
  [--lineage "how it was found"]
```

**Idempotent by key** (`.claude/rules/dv2-data-split-discipline-activated.md` §6). The key is the work-item ZetaId,
not the slug — so a re-measure is an **upsert, not double-pay**: measuring the same fix twice leaves one
entry and one price, and an identical re-measure is a byte-identical no-op. A legacy short-form entry
(`081KWG9JQ9H-…` for `081KWG9JQ9H08QG0R0024EMETG`) is matched by prefix, so it dedups rather than gaining
a twin. Entries are markdown (`.claude/rules/no-binary-in-proof-lineage.md`).

### The register is ORDINAL and WITNESSED — never a cardinal price

An entry records a ΔU **sign** plus the **witness** that makes it falsifiable. It does **not** record a
number, and the tool gives you no field in which to invent one. Nothing in the repo meters a bug-fix in
units, so a cardinal price would be `toy` asserted as `metered`
(`.claude/rules/toy-is-free-metered-must-be-earned.md`) — and because this ledger exists to *price* work, a fabricated
price corrupts the only thing it is for. A cardinal ΔU must be **earned** by a metering discipline later.

Four refusals, each a falsifier (removing any one kills a test in `measure.test.ts`):

| refused | because |
|---|---|
| work-item that resolves to no file | an unsubstantiated key prices a fix nobody can find |
| empty witness | an unwitnessed ΔU is `unmetered` asserted as `metered` |
| empty rationale | a ΔU sign with no reason is a guess wearing a price tag |
| non-canonical ZetaId | it is not a key |

## Status — what is shipped here, and what is not (audited 2026-08-15)

- **Shipped:** the `measure` verb above, and the entries in this folder.
- **Not shipped:** `sim`, the ephemeral half of the pair, is a **pure-interface stub** in
  `clis/Verbs.fs` (`IMeasurement = interface end`; the file says so itself). `db/sims/` holds a README
  and no sims. The word "unwired" used to lead that sentence and is no longer accurate:
  since `081M08VM385087G0R001DTM0K6` the file is **compiled** (`clis/Zeta.Clis.fsproj`, in `Zeta.sln`)
  and type-checked by `tests/Tests.FSharp/Clis/Verbs.Tests.fs`. Compiled is not implemented — the
  family still has no introduction form for `ISim<'a>` (that test proves it by reflection), so
  nothing here changes what is shipped.
- **Related but separate:** `src/Core/Finalizer.fs` (`TickResult.DeltaU`), `ComputeReceipt.fs`
  (`DeltaU = IV − ΔJ`) and `SocietyUsefulWork.fs` all compute a ΔU, but **in memory, per tick or per
  computation** — none of them is keyed to a bug-fix and none reads or writes this folder. Do not cite
  them as the ledger's implementation; the seam between them and these entries is unbuilt.

## Pointers

- `ground/` (the opposite pole — certainty) · `src/Core/Finalizer.fs` (DeltaU/Temperature) +
  `FinalizerRuntime.fs` (the finalizer loop over git+Reticulum) · the sonar / ping / meter captures · the
  encrypted-null = common-cause capture · the reorder-loophole/commutativity research.
- `.claude/rules/every-bug-has-economic-value.md` — the always-loaded rule this folder is the ledger for.
