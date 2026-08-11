# `--declare` is a cell, not a flag — the 4×4 controller grammar over content-addressed space

**Date:** 2026-08-11 · **From:** Aaron (*"this is where our universal controller grammar 4×4 comes in,
with choose-your-own-adventure over content-addressed space"*) · **Recorded by:** Otto (shadow)

**What this answers:** the one piece of the mutation-freedom ledger deliberately left unbuilt. The
ledger (`7ac72a069`) can be read but not written, because `--declare` would be an *unbounded write
path* letting an agent record a judgement about a specification with nothing shaping the action. The
answer is not to add the flag more carefully. It is that **the write is a cell in a bounded menu**.

---

## 0. The problem with a flag

`--declare --reason "..."` is a free-text write into a shared ledger. Three things are wrong with it,
and they are the three the repo already has machinery against:

- **Unbounded action space.** Nothing constrains *what* an agent may do at this point, so the
  interface offers no help and no limit — the opposite of Rodney's Razor and the scheduler's
  complexity-bounded branch pruning.
- **No determinism.** A free-text call is not reconstructible; DST cannot replay "the agent decided
  to write this string."
- **No transcript.** The decision leaves a ledger entry but not a *path* — you see the destination,
  never the fork.

## 1. The surface already exists, and it is live

`DarkHallCabinetRuntime.ControllerReadout` (used by `DarkHallScheduler`, `DarkHallRoomLoop`,
`DarkHallRoomTranscript`, `RoomRun`):

```fsharp
type ControllerReadout =
    { RoomName: string
      Grid: GridBinding.GridBinding<CabinetAction>   // the 4x4 placement primitive
      Actions: CabinetAction list                    // available action-grammar entries
      DeterministicRulesApplied: string list }        // how the menu was CONSTRUCTED
```

and the loop is already *"observe → choose → execute → append"* (`DarkHallRoomLoop.fs:291`).

Every property the flag lacks, the readout supplies:

| the flag | the readout |
|---|---|
| unbounded action space | **16 cells** — you cannot take an action not on the menu |
| non-deterministic | `DeterministicRulesApplied` records how the menu was built ⇒ replayable |
| no path recorded | `append` to a transcript ⇒ the fork is history, not just the destination |

## 2. What the mutation finding's 4×4 would hold

A finding is a *room*; the readout is what you may do about it. The cells are the honest responses,
and the point is that the list is **closed**:

- **declare free** (requires a reason — the ledger already refuses a reasonless entry)
- **write the test** (the under-specified reading)
- **retract** an existing freedom of mine
- **defer** — explicitly, with the finding staying unexplained rather than silently dropped
- **read another declarer's reason** before contradicting it (the disagreement path)

Note what this buys beyond tidiness: **an agent cannot invent a response.** The undecidable
gap-vs-freedom call is still the agent's to make, but the *shape* of the answer is fixed, which is
the resource bound made structural rather than exhorted.

## 3. "Choose your own adventure over content-addressed space" — why branches coexist

This is the load-bearing half, and it closes the loop with the rest of today.

Under content-addressing a version is an **identity, not a state** (`…rename-as-rolling-migration…`).
Applied to a decision transcript: each choice is an *append*, so the unchosen cells do not vanish —
they remain reachable addresses. The path taken is one branch of a structure where the others still
exist.

Which is exactly the property the freedom ledger was built for, one level up:

| level | the thing that coexists |
|---|---|
| specification | **surviving mutants** — variants the suite permits |
| declaration | **disagreeing declarers** — the rainbow |
| decision | **unchosen branches** — the adventure |

Same shape three times: *agreement is cheap, divergence is the signal, and nothing is deleted to get
there.* And the ledger's preservation rule (retraction marks, never deletes) is the same rule as the
transcript's: a fork you did not take is still a fork you can return to. **Resurrection is navigation,
not reconstruction.**

## 4. The cost, since it is not free

Per the ledger's own bound: growth must track **distinct disagreements**, not ticks. A transcript of
choices grows with *decisions*, which is a faster clock. Content-addressing dedups identical
subtrees, so repeated identical decisions cost once — but a transcript that grows with time rather
than with genuine forks is the same broken cost model the ledger warns about, and it is the thing to
watch here too.

## 5. Falsifiers

- **"16 cells is enough"** — refuted by an honest response to a finding that does not fit any cell
  and is not a composition of cells. Then the grammar is too narrow and is suppressing judgement
  rather than shaping it. **This is the one to watch**, because the failure mode is silent: an agent
  picks the nearest cell rather than the right action.
- **"Unchosen branches remain reachable"** — refuted if reconstructing an alternative branch requires
  anything the transcript did not record, i.e. if the adventure is only replayable forward.
- **"This is not just a flag with extra steps"** — refuted if every readout in practice offers the
  same cells regardless of the finding, in which case the menu carries no information and the
  determinism is decorative.

## 6. Pointers

- `src/Core/DarkHallCabinetRuntime.fs` (`ControllerReadout`, `observeWithPriority`) ·
  `DarkHallRoomLoop.fs:291` (observe → choose → execute → append) · `DarkHallRoomTranscript.fs`
- `src/Core.TypeScript/hygiene/mutation-freedoms.ts` — the ledger this would write to; its cost bound
  and preservation rule apply unchanged
- [`…mutants-coexist…`](2026-08-11-mutants-coexist-a-survivor-is-an-unconstrained-dimension-not-a-kill-target.md)
  — the design this completes
- [`…rename-as-rolling-migration…`](2026-08-11-rename-as-rolling-migration-content-addressed-code-bonsai-and-the-forced-pair-again.md)
  — content-addressing as identity-not-state, which is what makes unchosen branches persist
