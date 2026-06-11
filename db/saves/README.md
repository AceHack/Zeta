# saves/ — named, resumable save states (the FF7 save slots)

`saves/` is where **named save states** live — *"save and resume multiple save states"* (Aaron
2026-06-11). A save state is a point you can return to and replay forward from, deterministically. Like
an emulator's save slots: many of them, each named, each resumable.

## The mechanism already exists — this is its home

A save state IS a **recorded membrane log** (`src/Core/RecordedSource.fs`): the crossings that entered a
room up to a moment. Resume = `RecordedSource.replay` from that recording (DST: the room replays
byte-identically — proven). So a save slot is a **text recording** here (no binary in the proof lineage;
the membrane-log treaty already ratifies the format four-oracle).

```
saves/<name>.lines      one membrane-log recording (a save slot) — diffable, mergeable, replayable
```

- **Save** = write the room's `RecordedSource.toLines` to `saves/<name>.lines`.
- **Resume** = `RecordedSource.ofLines` → `replay` → drive the room from that recording.
- **Multiple** = many named slots; pick any to resume (or fork — see [`../futures`](../futures/README.md)).

Why text + recording (not a binary heap dump): a save state must be *replayable, mergeable, and
auditable* — the same channel-reliability discipline as everything else. A save you can't diff is a save
you can't trust.

## Pointers

- `src/Core/RecordedSource.fs` — record/replay (the save/resume mechanism); the membrane-log treaty
  (`src/Core.TypeScript/recorded-source/golden-vectors.lines`) ratifies the line format four-oracle.
- `src/Core/Checkpoint.fs` / `src/Core/SagaSnapshot.fs` — snapshot lineage (state-at-a-cadence).
- `src/Core/SimFramework.fs` — `withSource` swaps a room's membrane to a saved recording's replay.
- [`../futures`](../futures/README.md) — a save you resume *and fork* projects futures.
