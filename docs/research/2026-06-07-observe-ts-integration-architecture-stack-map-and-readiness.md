# observe.ts integration architecture — the whole stack, the wiring, the 4×4 tie-in, and an honest readiness call

**Date:** 2026-06-07 · **Author:** Otto (mapping for Aaron's "what's the whole stack and what
will it look like" before wiring observe.ts) · **Status:** architecture map + readiness
assessment (NOT a build mandate). Honest register: the durability/algebra spine is shipped;
the observe.ts wiring has named gaps below.

## The realization: observe.ts and the cell are the SAME shape

`tools/observe/observe.ts` (and its byte-parity F# port `Zeta.Core.FSharp.Observe`) is:

```text
observe   : World -> NextAction          (the chooser — pick ONE action this tick)
simulate  : World -> NextAction -> World  (the reducer / step)
fold      : World -> NextAction list -> World   (projection = replay the event log)
```

That is **exactly** the yin/yang cell + durable substrate just shipped:

| observe.ts            | the shipped stack                                        |
|-----------------------|----------------------------------------------------------|
| `World` (snapshot)    | `Remains` (yin state), persisted on the git DB           |
| `NextAction` (the Msg)| the act chosen by `Acts` (yang) — an event               |
| `simulate`            | `DurableYinYang.evolve` / `DurableSaga.step`             |
| `fold` / `replay`     | `DurableSaga.ResumeAsync` (fold the delta-log)           |
| the event list        | the `GitDeltaLog` stream (the agreement/event log)       |
| `EditGrammar` (4th opt)| `Acts` is data (`Bonsai.Expr`) — sovereign self-edit    |
| free modes            | the forward-momentum apex (obligated vs free-time lanes) |

So wiring observe.ts is **not greenfield** — it is unifying two things already built to rhyme.
`Observe.Algebra` (oracle #2 of the 4-language parity, 081KSV2WD0008QG0R00051XS0N) means the reducer already exists
in F# matching the TS byte-for-byte.

## The whole stack (bottom → top), all shipped + green

1. **`Core.Git` — git-native persistence** (PR #6696): `GitDeltaLog` (commits = the log),
   `GitSnapshotStore` (manifest-tracked). The DB *is* git.
2. **`DurableSaga`** (PR #6697): fold signed events → state; crash → resume from the log.
3. **`BonsaiSoft`** (PR #6698): the yang evaluator — soft (`SoftValue` distribution, persisted)
   + sharp (`resolve threshold` snap at the execution edge).
4. **`DurableYinYang`** (PR #6699 concrete + #6701 soft): the cell evolves on the git DB —
   `Acts(Remains, input) → next Remains`, crash-durable; soft mode holds the superposition,
   snaps only at read. Binding convention: `Param "remains"`, `Param "input"` (the shadow).
5. **`Diplomacy`** — shape-only handshake (NCI-safe) → freedom-first gating (PR #6700) →
   shape-keyed PIC (#6702) → durable git-backed agreement stream (#6703).

Orthogonal frame layers (already in Core):

- **`ActionGrid` — the 4×4 universal action grammar** (the "Xbox controller"): a fixed
  geometry (`move`/`color`, navigation a **pure function of position**, label-independence
  **proven**) + content `World = Map<Position, DynamicValue>` (the per-cell *labels* that change
  with world state). Fixed layout, per-game meaning.
- **`TravelerFrame`** — where/when things are (the frame); `ActionGrid` is what-you-can-do
  (the grammar), orthogonal to it.

## What the wiring looks like (the target)

The agent loop becomes: **read folded World → choose action → commit delta → repeat**, with
*nothing* done by raw `git`/`gh` — every effect goes through the DB layer (a delta-log append).

```text
        ┌─────────────── git DB (GitDeltaLog) — the event/agreement stream ───────────────┐
        │                                                                                  │
  fold (ResumeAsync)                                                            AppendAsync (commit)
        │                                                                                  │
        ▼                                                                                  │
   World (= Remains, projected from the cell)                                              │
        │                                                                                  │
   observe(World)  ──choose ONE──►  NextAction  ──simulate (= cell step)──►  next World ───┘
        │                                   │
   (4×4 ActionGrid = the fixed grammar      └─ if the action touches another agent
    geometry; NextAction kinds = cells;        (RespondToOperator / ferry), it crosses a
    labels = World-dependent; EditGrammar      freedom-first Diplomacy boundary: exit
    = relabel a cell = sovereign edit)         before choice, shape-keyed cached.
```

- **observe's `simulate` = the cell's step.** The persisted cell and observe.ts run the *same*
  reducer (already parity-checked TS↔F#).
- **The 4×4 ties in as the grammar geometry.** `NextAction`'s kinds are the controller's
  *buttons*; `ActionGrid`'s fixed 4×4 is the *layout* (navigation label-independent — proven);
  the *labels* (what a cell does now) are `World`/`Remains`-dependent; `EditGrammar` relabels a
  cell — the sovereign 4th option that keeps the agent un-trapped (the meme-with-an-exit at the
  controller layer).
- **No raw git/gh:** the agent's "commit/respond/ferry" actions execute via the substrate
  (delta-log append + cell evolve), so "everything is behind our database layer."

## Honest readiness — Aaron's instinct is right; named gaps

The **data/durability/algebra spine is ready.** What's missing before observe.ts can be wired:

- **Bridge A — `World`/`NextAction` ⇄ `DynamicValue` encoders** (so they ride `GitDeltaLog`).
  Pure, decision-free; same pattern as the `SoftValue`/agreement encoders already shipped.
  **Buildable now.**
- **Bridge B — unify the step (design call):** does the cell's `Acts` (a `Bonsai.Expr`) *express*
  the observe reducer, or does the cell step *delegate* to `Observe.Algebra.simulate`? (Bonsai
  can't yet express the full reducer — `Call`/`Lambda` are unevaluated; the observe reducer is
  richer than `Const/Param/Binary/Cond`.) Likely answer: delegate to `Observe.Algebra.simulate`
  as the cell's step for now; grow Bonsai toward it later. **Needs Aaron.**
- **Bridge C — unify `NextAction` with the 4×4 grammar (design call):** map the 9 `NextAction`
  kinds (+ free modes + edit) onto `ActionGrid` cells (16 available). Is the action menu a
  *projection* of the 4×4? **Needs Aaron.**
- **Bridge D — the execution layer (the biggest piece):** turning a chosen `NextAction` into
  real effects *through the substrate* (commit/respond/ferry as delta-log ops, not shell git).
  This is the "agent does no git/gh" goal; it is the most work and the least specified.

## Recommendation

Don't wire observe.ts wholesale yet (Aaron's instinct). Sequence: **A now** (pure encoders,
unblocks everything), then settle **B** and **C** (two short design calls), then build **D**
(the execution layer) incrementally. Each is a small tested deliverable along the same
trajectory the last nine PRs followed.

## Pointers

- `tools/observe/observe.ts` (the controller) · `src/Core.FSharp.Observe/` (parity port:
  `Types.fs`, `Observe.fs` `Algebra.simulate/fold/replay`, `EventLog.fs`).
- `src/Core/ActionGrid.fs` (4×4 grammar) · `src/Core/Diplomacy.fs` + `DurableDiplomacy.fs`.
- `src/Core/DurableYinYang.fs` (cell evolution) · `Core.Git/` (git DB).
- PRs #6696–#6703 (the spine); `docs/research/2026-06-06-zeta-relativistic-agent-database-vision.md`.
