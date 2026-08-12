---
id: 081KZT1X8G2087G0R000FYEWSE
type: task
state: backlog
priority: P2
slug: promote-the-observe-time-travel-ledger-world-history-into-th
title: "Promote the observe time-travel ledger (World.history) into the four-oracle treaty"
created: 2026-08-12T03:57:56.098Z
depends_on: []
composes_with: []
---

# Promote the observe time-travel ledger (World.history) into the four-oracle treaty

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZT1X8G2087G0R000FYEWSE-*.md` glob. -->

## Context

The Z-Set Time-Travel commit (`fe38a2a8e`) added `World.history` — an append-only
ledger written by `do_item` and read by `retract_time` — and it landed **inside the
conformance-folded state**, which broke the three golden-vector tests in
`src/Core.TypeScript/observe/golden-vectors.test.ts`.

That was resolved by declaring the **treaty surface** explicitly
(`TreatyWorld` / `TREATY_WORLD_FIELDS` / `toTreatyWorld` in
`src/Core.TypeScript/observe/golden-vectors.ts`) and projecting the runtime `World`
onto it before emitting the fixture. `history` is **out** of the treaty; the emitted
`golden-vectors.json` is byte-identical to what it was before the time-travel
commit, so no oracle changed. `history` itself was typed (`HistoryEvent` DU,
replacing `any[]`).

This item is the deliberate, versioned path to putting it **in** — deferred, not
declined.

## Why it was deferred (the evidence, so a future reader can re-check it)

1. **The ledger has no reader outside TS.** `retract_time` / `replay_time` /
   `self_claim` / `navigate_cartography` / `scope_cartography` exist only in the TS
   `NextAction`. F# (`src/Core.FSharp.Observe/Observe.fs`), C#
   (`src/Core.CSharp.Observe/NextAction.cs`) and Rust
   (`src/Core.Rust.Observe/src/types.rs`) each implement exactly the **nine** core
   kinds. Locking a field no other oracle can exercise is cargo-cult conformance.
2. **It adds no discriminating power today.** `history` is a strictly lossy copy
   (2 of 14 action kinds) of the `events` array already present in the fixture as
   the fold's *input*. Locking a lossy duplicate of the input as expected output
   cannot fail in any way `events` does not already fail.

## What promoting it actually requires (do ALL of these, in order)

1. **Land the ledger's readers in every oracle first.** `retract_time` (and its
   thrash guard + the backward Z-set balance scan) in F#, C#, Rust. Without this,
   step 2 locks a write-only field.
2. **Type the ledger in each oracle** as the same closed union the TS
   `HistoryEvent` is — F# DU, C# abstract+sealed record (mirroring `NextAction.cs`),
   Rust enum. `retract_time`'s entry carries `item: BacklogItem | null`; the
   `do_item` entry carries an optional `evaluation` (`accuracy`, `diffPixels`,
   `totalPixels`).
3. **Agree the serialization of the optional/absent cases** before regenerating:
   absent `evaluation` must be an ABSENT key, not `null`, and `item: null` on a
   retract entry must round-trip as null in all four. This is the same
   absent-vs-present-undefined trap `needsNewAction` already documents in
   `tests/Tests.FSharp/Observe/GoldenVectors.Tests.fs`.
4. **Extend the scenario** in `golden-vectors.ts` to exercise `retract_time`
   (the current `GOLDEN_EVENTS` is nine-kind only, and the "all nine kinds"
   assertions in all four oracles' tests hard-code 9 — they must move together).
5. **Add `history` to `TREATY_WORLD_FIELDS` + `toTreatyWorld`**, regenerate, and
   update the boundary guards in `golden-vectors.test.ts` (they assert the field
   list as data, so they will go red until updated — that is the intended alarm).
6. **Extend each oracle's `parseWorld`/`parse_world` to READ `history`** and
   compare it. Until this is done the three of them ignore the new key and stay
   green while out of conformance — the exact silent failure this whole exercise
   was about.
7. Treat the regenerated fixture as a **versioned treaty change**: the diff should
   be reviewed as a contract amendment, not as test churn.

## Also worth doing while in here (not blocking)

- `simulate`'s `retract_time` branch is the only reducer that reads prior state
  from the ledger. Consider whether the undo stack belongs on `World` at all, or
  whether `fold` should hand the reducer the log it already has — the current shape
  stores a lossy copy of the fold's input inside the fold's output.
- Pre-existing, unrelated, from the same commit: `observe.ts` decompose builds
  children with `gridData: undefined` under `exactOptionalPropertyTypes`
  (3 × TS2322/TS2375 at `observe.ts:620/623/624`). Left untouched deliberately.
