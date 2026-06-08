# DST timeline operations — design note (fork · zip · join · converge · rewind · fast-forward)

**Aaron, 2026-06-08.** The design for the not-yet-built **DST timeline-ops** module — time-travel /
emulator operations over the one zset event stream — with the operator vocabulary pinned *before* the build,
including the sharpened **zip ≠ join** distinction and where staged coincidence lives.

## Why

The "interrupt-as-DST-time-emulator" vision (inject DST time, play emulators with `fast-forward / rewind /
fork / join` over the zset timeline) needs a precise operator set. The names matter because they are
different operations with different concurrency profiles and different relationships to staged coincidence.

## The operator taxonomy (pinned)

| op | meaning | wait-free? | staged-coincidence locus | anchor |
|---|---|---|---|---|
| **fork** | **banana split** — one timeline → many parallel folds (diverge) | yes | — | Fokkinga 1990 (Banana Split Law); `⟨f,g⟩` cata |
| **zip** | element-pair two streams, **no condition** | **wait-free** (§2) | none — nothing to gate | Rx `zip`; manifesto §2 lock/wait-free |
| **join** | **wait for a coincidence condition** on both streams before emitting | **waits / gated** | **HERE** — `CoincidenceClock` controls when the join fires | Rx `join`/`groupJoin`; relational join |
| **converge** | consensus reconcile to one frame (CRDT, idempotent, order-independent) | result commutative | — | `Reconcile.fs`; CALM; CRDT |
| **rewind** | replay the event log to tick `N` (fold-to-N) | deterministic (DST) | — | event sourcing; `rr`; save-states |
| **fast-forward** | fold forward from the current cursor | deterministic (DST) | — | event sourcing |

### The load-bearing distinction (Aaron 2026-06-08): zip ≠ join

- **zip = wait-free.** After a `fork` (banana split), `zip` re-pairs streams element-by-element with **no
  condition and no waiting** — lockstep/index-aligned. The manifesto §2 wait-free path: no coordination, no
  blocking on the other stream's state. **Cannot be staged** (nothing to gate).
- **join = coincidence-gated.** A `join` **waits for a condition to coincide** on both streams (a
  predicate/key match within a window) before emitting. It blocks on the coincidence — **not** wait-free.
- **Coincidence is the join's firing condition** ⇒ **staged coincidence operates at the *join*, not the zip.**
  `CoincidenceClock` controls *when the join fires*; the staged Bell/CHSH correlations (`BellTest`) live at
  the join. This is the precise locus where DST seed-control meets the timeline algebra.

## The substrate it rides

- **The zset event stream is the timeline.** `rewind`/`fast-forward` are fold-to-tick over it (deterministic,
  DST §7). `fork` is a banana split of the fold; `zip`/`join` re-combine; `converge` reconciles to one frame
  when agreement is required (the consensus/NCI case — `Reconcile.fs`).
- **The interrupt is the tick/clock** (emulator interrupt = DST time source). Injecting DST time = controlling
  the interrupt schedule; the timeline ops then ff/rewind/fork/join over the resulting event stream.
- **Meta-homoiconic:** the tick/interrupt is itself an event on the same stream, so timelines are first-class
  data that fork and join.

## Build sketch (F#, when greenlit)

- `rewind (events) (n)` = `events |> List.take n |> fold` (replay to tick N).
- `fastForward (state) (events)` = `events |> List.fold apply state`.
- `fork (events) (folds)` = banana split — run each fold over the same event prefix (one pass).
- `zip a b` = wait-free element pairing (`List.zip`-shaped, lockstep), no condition.
- `join pred windowA windowB` = emit pairs whose `pred` coincides within the windows (gated). `CoincidenceClock`
  supplies the staging (when the coincidence is allowed to fire).
- `converge` = the existing `Reconcile.fs` / CRDT order-independent settle.

## Honest scope (peel)

A **design note**, not code — pins the vocabulary so the eventual module is built with the right names and the
right concurrency profile (zip wait-free, join gated). The transport/networked side stays gated (B-1002); this
is the *local timeline algebra* over the zset event stream. The "play emulators with DST time" framing is real
and buildable (it's event-sourcing + save-states + deterministic replay), not exotic — `rr` and every
save-state emulator already do rewind/fast-forward; the novelty here is only the *unified* fork/zip/join/
converge algebra over the one stream with the interrupt as the DST time source.

## Anchors (Beacon)

Fokkinga 1990 (Banana Split Law); Rx `zip`/`join`/`groupJoin`; CALM / `Reconcile.fs` (converge); event
sourcing + `rr` + save-states (rewind/ff); manifesto §2 (wait-free), §7 (DST). Internal: `CoincidenceClock`,
`BellTest`, `SymmetricEndurance`; B-1002 (gated transport). Aaron's settled distinction 2026-06-08.
