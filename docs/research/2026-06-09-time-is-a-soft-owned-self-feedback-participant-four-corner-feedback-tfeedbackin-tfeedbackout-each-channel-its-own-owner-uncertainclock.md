# Time is a soft, owned, self-feedback participant: the four-corner feedback (tFeedbackIn/tFeedbackOut) is coded; each channel has its own owner; time can recursively model feedback to itself in soft mode; time itself can be soft

**Register:** [grounded] refinement (Aaron), anchored to code + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Sharpens the clock-as-participant: it's soft, owned, and self-feeding.

## Aaron's words

> "that's our 4 corner feedback model — we already have time as a participant in code in our
> tFeedbackIn and tFeedbackOut and such." · "and each one has different ownership now." · "time can
> recursively model feedback to itself in soft mode." · "and time itself can be soft."

## 1. The four-corner feedback is already coded — time as a participant via tFeedbackIn/tFeedbackOut

The clock-as-participant + four-corner feedback isn't aspirational — it's in code:
`src/Core/FeedbackThrottle.fs` (the four-corner feedback model / S-regimes by feedback latency), and the
**typed feedback channels** (`tFeedbackIn` / `tFeedbackOut` — the time-feedback-in/out the room reads
and writes; the feedback is a **typed channel**, like `Codec.fs`'s `'Feedback` result channel). Time
participates by **receiving** the room's observed corners (`tFeedbackIn`) and **emitting** the next
phase/generator state (`tFeedbackOut`). So the clock's seat in the room is literally an in/out feedback
port — the four corners are its I/O.

## 2. Each one has different ownership

> "and each one has different ownership now."

Each room, each participant (incl. the clock-participant), and each feedback channel has its **own
ownership** — they are **owned-for-a-period** (the hat-system / Summonable contracts; each cell its own
host + owner). The clock-participant in room A is a different owned instance than in room B; the
`tFeedbackIn`/`tFeedbackOut` channels are owned per-room. (DI lifetime + hat-tenure: ownership is scoped

+ time-bound, not global.) So "time" is not one global owner — it's a **per-room owned participant**.

## 3. Time can recursively model feedback to itself — in soft mode

> "time can recursively model feedback to itself in soft mode."

The clock-participant can **feed its own `tFeedbackOut` back into its own `tFeedbackIn`** — **time models
feedback to itself, recursively** (a clock regulating a clock; **shape A self-reference `s = f(s)`**,
terminating fixed point). And this self-feedback runs **in soft mode** — **SoftValue / DynamicValue**:
the recursive self-model is *exploratory/uncertain* (held with confidence, not asserted sharp), so the
clock can *try* phase corrections softly before committing. (Bounded — shape-A convergence + the budget
— so the self-feedback terminates, doesn't free-fall.)

## 4. Time itself can be soft (already in code: UncertainClock.fs)

> "and time itself can be soft."

Time is **not necessarily a sharp logical value** — **time itself can be SOFT**: a SoftValue/
DynamicValue over ticks/phase (a distribution / held-with-confidence), not a single number. **Already in
code: `src/Core/UncertainClock.fs`** — the soft clock (a DB clock *type*, alongside `Clock.fs` Lamport
and `CoincidenceClock.fs` staging). So the room can run on **soft time**: the IScheduler emits a *soft*
tick (uncertain phase), the four-corner feedback reduces that uncertainty toward the target, and it
**snaps to a sharp tick at a confidence threshold** (SoftValue.resolve / the SolidGround move applied to
time). Soft time → measured/fed-back → ground time.

## 5. The IScheduler reuses the chip8 arrow + soft-interrupt-handler trick — in every room, time as a participant

> Aaron (2026-06-09): "our IScheduler can use the same category theory arrow and interrupt handler
> trick we did with chip8 and apply it to every DST room with common cause correlation via common seed
> cause." · "and time as a participant."

The **`IScheduler` reuses the chip8 trick** — the **category-theory arrow + soft-interrupt-handler**
("hook the arrow"; `2026-06-09-ray-trace-observer-integration-plan-hook-the-arrow-and-soft-interrupt-
handler-...`; `DynamicValueArrow.fs`; `Chip8Observer.fs`) — and **applies it to every DST room**:

- **the arrow** — the scheduler's tick is an **arrow** (Hughes arrow / profunctor; `DynamicValueArrow`):
  observe → transform → emit, composable; the IScheduler hooks the room's arrow to inject generated
  (soft) time at each step. Same arrow the chip8 observer hooks.
- **the soft-interrupt-handler** — the scheduler raises a **soft interrupt** to reflect/observe at a
  tick (the chip8 soft-interrupt that reflects downward into the controller); in a room this is the
  feedback point — `tFeedbackIn` fires the soft interrupt, the handler folds the corners, `tFeedbackOut`
  resumes. Soft (SoftValue) so it's exploratory + reducible.
- **common-cause correlation via the common seed** — applied across **every** room, the same seeded
  IScheduler drives all rooms, so their arrows are **correlated by the common cause** (the common seed)
  — that's what makes cross-room **S=4 staged-coincidence** legitimate (shared seed = common cause; not
  physical, per the peel). One scheduler, one seed, correlated rooms.
- **time as a participant** — the IScheduler-arrow isn't ambient: it's the **clock-participant's** move
  in the room (its `tFeedbackIn`/`tFeedbackOut` seat), per §1–§4 above. The arrow trick is *how* the
  time-participant acts.

So the chip8 "hook the arrow + soft interrupt" generalizes to the universal room scheduler: **every DST
room's time is the IScheduler hooking that room's arrow with a soft-interrupt feedback handler,
correlated across rooms by the common seed, with time itself a soft per-room-owned participant.**

## Synthesis

The clock-participant is **soft, owned, and self-feeding**:

- **soft** — time is a SoftValue (`UncertainClock.fs`); a soft tick reduced by feedback to a sharp one.
- **owned** — a per-room owned-for-a-period participant (hat/Summonable), not one global clock.
- **self-feeding** — `tFeedbackOut → tFeedbackIn` recursively (shape-A, soft, bounded): time models its
  own feedback.
- **a participant with I/O** — the four corners are the clock's `tFeedbackIn`/`tFeedbackOut`; time has a
  seat *and* a feedback port in every room.

This is the clock-participant + four-corner feedback realized: **soft self-regulating time, owned per
room, fed back to itself, settling (homeostat) to its phase set-point on the common seed.**

## Honest scope / handoff

Refinement anchored to code (`FeedbackThrottle.fs` four-corner; `UncertainClock.fs` soft time;
`Clock.fs` Lamport; `CoincidenceClock.fs` staging; `Codec.fs` typed `'Feedback` channel). To realize:
wire the clock-participant's `tFeedbackIn`/`tFeedbackOut` as a soft, per-room-owned, self-feedback loop
that resolves soft→sharp at a confidence threshold; bounded (shape-A + budget). Routes to Soraya/Sova
(the soft-self-feedback convergence proof), the F#/observe core, the time-as-generator treaty primitive.

## Anchors / ties

`FeedbackThrottle.fs` (four-corner feedback; tFeedbackIn/tFeedbackOut I/O); `UncertainClock.fs` (**soft
time**); `Clock.fs` (Lamport IScheduler); `CoincidenceClock.fs` (staging); `Codec.fs` typed `'Feedback`
channel; SoftValue/DynamicValue + SolidGround (soft→sharp at threshold); shape A (self-reference,
terminating) + bounded tests; hats / Summonable / DI-lifetime (per-room owned-for-a-period); the
clock-as-participant + S=4-on-common-seed + every-room-4×4×n + homeostat/Markov-chain docs.
