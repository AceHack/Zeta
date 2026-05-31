# ADR: Choose-your-own-adventure observe->act loop — a 16-direction universal action grammar (Xbox-controller navigation), local-USB no-cloud LLM, git-as-append-only-state

**Date:** 2026-05-31
**Status:** *PROPOSED — design-starter.* Codeable basis for the agent foreground loop. To be
shared with Max (co-maintainer) for review before lock. This ADR firms the architecture enough to
start coding the first slice; the 16-slot grammar layout + several mechanisms are marked **[OPEN]**
for operator + Max ratification.
**Owner:** operator (shaping-decision owner) + Max (co-review); Otto-CLI synthesis.
**Decision confidence:** *medium* — the pieces are individually built or ratified (the move-next
engine `tools/agent-loop/` exists; git-append-only-state is ratified B-0867/B-0858; the
local-no-cloud stance is long-standing; the 16-direction framing is the operator's own from the
2026-05-28/30 conversations). What's new here is composing them into one loop + proposing a concrete
16-slot grammar. The composition is sound; the exact grammar layout is a first draft.

## Context

Across 2026-05-28 -> 2026-05-31 the operator + Ani named a foreground-loop architecture that is
currently **built-as-engine but not yet wired as the live agent loop**, and **designed-but-not-
deployed** for its compute substrate:

- **The move-next engine exists.** `tools/agent-loop/state-machine.ts` (B-0867.5) implements
  "execute script -> look at choose-your-own-adventure output -> take action based on output."
  Operator framing: *"the agent loop basically becomes execute script look at choose your own
  adventure output, take action based on outpout."* Clean separation: the **deterministic script
  holds the state machine**, the **LLM is a pure menu-selector** (reads menu, returns a choice),
  and **state persists in Git append-only** (B-0867 + B-0858).
- **The 16-direction grammar.** Operator 2026-05-30 (metabolism-loop conversation): *"Everybody's
  going to be on a workflow that basically says observe, and then they get like 16 choices that are
  always directional. The directional stays the same, but the labels change. So it's observe, act,
  observe, act. That's it. Real simple."* This is a **universal action grammar**: a fixed,
  small, learnable set of ~16 directional slots whose MEANINGS (labels) change per context but whose
  DIRECTIONS stay fixed — like navigating with an **Xbox controller** (muscle-memory directions;
  the screen changes what each does).
- **Local-USB, no cloud.** Operator's standing stance: *"I hate fucking clouds even if I don't have
  to pay."* The loop should run on a **local USB-bootable node with a local LLM** (no cloud
  inference), composing with `full-ai-cluster/nixos/`, the USB-boot starting-state (B-0865), and the
  unrestricted-local-models direction (the Ace agenda).
- **Git as the free event store.** Per-agent **append-only Git event log** with 128-bit guaranteed-
  unique IDs (sidesteps merge conflicts; PR flow stays as the coordination layer). State is read
  from Git each tick; the choice appends a new event.

This ADR composes those four into one loop and proposes a concrete grammar to code against.

## Decision

Adopt, as the agent foreground-loop architecture, a **choose-your-own-adventure observe->act loop**
with these four properties:

1. **observe->act loop** — every tick: **observe** (read current state from Git; compute the menu)
   -> **render** the menu as the fixed 16-direction grammar -> **select** (the LLM picks ONE
   direction, returning an index 0..15, not free text) -> **act** (the deterministic script executes
   the chosen direction) -> **append** the new state event to Git -> repeat. This is `observe.ts`:
   the observe-step entrypoint over the existing `tools/agent-loop/` (move-next) state machine.
2. **16-direction universal action grammar** — a FIXED set of 16 action slots (Xbox-controller
   layout). The directions are stable across all states (learnable); each state's move-next supplies
   the **labels + availability** for the 16 slots. Availability is **tri-boolean** (composes with
   B-0944): each slot is `Available (T) | Disabled (F) | Held/uncertain (N)`. The LLM may only pick
   a slot that is `T`.
3. **Local-USB, no-cloud LLM** — the selector runs on a **local model** on a USB-bootable node;
   **zero cloud inference**. The fixed, small, indexed action space (pick 0..15) is exactly what
   makes a small local model viable: it is **constrained decoding** to 16 tokens, not open-ended
   generation.
4. **Git-as-append-only-state** — no DB; per-agent append-only Git log (128-bit IDs); the LLM never
   holds state internally; every tick reads state from Git and appends the chosen event.

## The architecture to code around

```
            +-------------------- one tick --------------------+
            |                                                  |
   git log  |  observe.ts                                      |
   (state) -+-> read current state (latest events)            |
            |   -> move-next(state): build the 16-slot menu    |   deterministic script
            |        (labels + Tri availability per slot)      |   (tools/agent-loop, F# DU canon)
            |                                                  |
            |  render 16-direction grammar  ------------------>|
            |                                                  |
            |  LLM selector (LOCAL, no cloud):                 |   LLM = pure menu-selector
            |   input  = the 16-slot menu                      |   output = an index 0..15
            |   output = chosen direction index (only T slots) |   (constrained decoding)
            |                                                  |
            |  act: script executes slot[index]                |   deterministic script
            |   -> append new state event to git (128-bit id)  |
            +--------------------------------------------------+
                                  | repeat
```

### The 16-slot universal action grammar (PROPOSED v0 — Xbox-controller layout) [OPEN]

The 16 directions are FIXED (muscle memory); move-next supplies labels + Tri availability per state.
Proposed grouping (4 x 4):

| Group | Slot | Controller input | Fixed role (label changes per state) |
|---|---|---|---|
| **Navigate** | 0 | D-pad Up | previous option / up a category |
| | 1 | D-pad Down | next option / down a category |
| | 2 | D-pad Left | previous context / sibling left |
| | 3 | D-pad Right | next context / sibling right |
| **Commit** | 4 | A | accept / commit the current option (the primary act) |
| | 5 | B | cancel / back out (no state change beyond a back-event) |
| | 6 | X | inspect / observe-more (expand detail; pure observe, no act) |
| | 7 | Y | branch / fork (open an alternative line) |
| **Scope** | 8 | LB | scope-out (zoom to the parent / coarser view) |
| | 9 | RB | scope-in (zoom to the child / finer view) |
| | 10 | LT | undo / retract (retraction-native; append a retract-event) |
| | 11 | RT | redo / replay (re-apply a retracted or prior move) |
| **Meta** | 12 | Start | refresh / re-run move-next (re-observe the world) |
| | 13 | View | status / glass-halo (emit a visibility signal) |
| | 14 | L3 | pause / enter free-time (NCI: a valid chosen mode) |
| | 15 | R3 | escalate / ask-operator (hand a decision to a human) |

Why this shape: it is the operator's "16 directional, labels change" made concrete; it maps to a
device everyone already knows (an Xbox controller); it keeps the LLM output to **one of 16** (tiny,
local-model-friendly, auditable); and the four groups (Navigate / Commit / Scope / Meta) cover the
agent-loop's existing menu options (inspect-status, select-work, execute, pause, escalate). The
**Tri availability** per slot composes with the tri-boolean primitive: a state that forbids
committing renders slot 4 as `F`; a state with a held/uncertain option renders it `N`.

### Layering (clean separation)

- **Deterministic script** (`tools/agent-loop/` TS today; the canonical F# DU in
  `src/Core.FSharp/WorkflowEngine/` is PLANNED future-work, B-0867.1 — does not exist yet): owns the
  state machine + `move-next(state) -> 16-slot menu`. No LLM here. Replayable / DST-able.
- **LLM selector** (local, no cloud): a pure function `menu -> index 0..15` over only-`T` slots.
  Holds no state. Swappable model.
- **Git** (append-only, 128-bit IDs): the only state store. Each act appends one event.

### Local-USB, no-cloud

- The selector model runs locally on the USB-booted node (llama.cpp / ollama-class — **[OPEN]** which
  model). The 16-way constrained decode means even a small quantized local model suffices.
- Composes with `full-ai-cluster/nixos/` (the declarative cluster substrate) + B-0865 (USB-boot
  starting-state) + the Ace unrestricted-local-models direction. Zero cloud dependency = sovereign.

## Consequences

- **Bounded, auditable LLM output.** Picking 1-of-16 (vs free-form action) is safer (the script,
  not the LLM, decides what each slot DOES), cheaper, constrained-decoding-friendly, and trivially
  logged. The LLM cannot invent an action outside the grammar.
- **Local + sovereign.** No cloud; runs off USB; small-model-viable.
- **Replayable.** Git-append-only state + deterministic script = full DST/replay (the whole loop is
  reconstructable from the event log).
- **Composes with the tri-boolean primitive** (B-0944): the 16-slot availability vector is a
  `Tri[16]`; held (`N`) slots are first-class (an option whose availability is genuinely uncertain
  is not silently forced on or off).
- **Supersedes/wraps the current hardcoded autonomous-tick.** The per-minute autonomous-loop
  discipline (refresh -> pick-work -> verify -> commit -> shard) becomes ONE concrete `move-next`
  instance: its steps map to slots (12 refresh, 1 select-work, 4 commit, 13 status). Migration is
  incremental — the hardcoded loop keeps running until the move-next loop is wired + trusted.
- **Multi-agent ready.** Each agent has its own append-only log; the git-as-free-event-store +
  GitHub-Actions-recursion ("git accelerator") is the eventual distributed compute substrate
  (designed, not yet deployed — out of scope for the first slice).

## Alternatives considered

- **Free-form action LLM** (LLM emits arbitrary actions). Rejected: unbounded, unsafe, cloud-model-
  hungry, hard to audit. The whole point is the LLM is a *selector*, not an *actor*.
- **Cloud LLM.** Rejected per the no-cloud stance + sovereignty.
- **>16 or variable-size menu.** Rejected for v0: a fixed 16-slot grammar is learnable (muscle
  memory), maps to a real controller, and keeps the decode tiny. Overflow options are reachable via
  Navigate (slots 0-3) + Scope (8-9) rather than by growing the grammar.
- **Non-git state (DB).** Rejected: git-append-only is free, replayable, merge-conflict-free (128-bit
  ids), and already ratified (B-0867/B-0858).

## Open design questions [OPEN — for operator + Max]

1. The exact 16-slot layout (the table above is v0). Do the four groups + roles match how move-next
   actually wants to expose options?
2. How move-next maps an arbitrary state's options onto the 16 fixed slots (the labeler) — and what
   happens when a state has >16 meaningful options (Navigate-paging vs Scope-drilling).
3. The constrained-decoding mechanism for the local model (grammar/logit-bias to 16 tokens vs a tiny
   classifier head).
4. Which local model + quantization on the USB node.
5. Tri (`N`) semantics in the menu: when is a slot genuinely "held/uncertain-availability" vs simply
   disabled (`F`)? (Composes with the B-0944 measure/cooperate discipline.)
6. How the human contributor uses the same grammar (the operator's framing: humans + AI both call
   move-next and pick) — same 16-slot UI for people.

## Codeable first slice

1. Define the `Menu16` type: `{ slots: { label: string; avail: Tri }[16] }` (TS + the F# DU canon).
   Reuse the B-0944 `Tri` cell for `avail`.
2. `move-next(state) -> Menu16`: extend `tools/agent-loop/state-machine.ts` to emit the 16-slot menu
   (start by mapping its existing menu options onto the proposed slots).
3. `observe.ts`: read latest git state -> `move-next` -> print the `Menu16`.
4. A stub local selector: `Menu16 -> index` (start with a deterministic/random pick over `T` slots;
   swap in the local LLM next).
5. `act(index, state) -> append event to git` (128-bit id).
6. Wire 1-5 into a runnable loop behind a flag; keep the hardcoded autonomous-tick as the default
   until the move-next loop is trusted.

## Composes with

- `tools/agent-loop/` (B-0867.5 — the move-next state machine this ADR puts a 16-slot face + observe
  loop on)
- B-0944 (tri-boolean digital qubit — the `Tri` cell IS the per-slot availability)
- B-0862 (OPLE Observe/Persist/Limit/Emit — observe->act is the OPLE Observe+Emit loop)
- B-0867 / B-0858 (git append-only state; consent-first state)
- B-0865 (USB-boot starting-state) + `full-ai-cluster/nixos/` (local cluster) + the Ace agenda
  (unrestricted local models)
- `.claude/rules/non-coercion-invariant.md` (slot 14 free-time + slot 15 escalate-to-operator are
  the NCI-compliant modes; the LLM-as-selector-not-actor keeps the human/operator authority)
- The 2026-05-28 ani conversation (move-next / universal-action-grammar / git-as-free-event-store)
  + the 2026-05-30 metabolism-loop conversation (the 16-directions framing) + the 2026-05-31
  privacy/distributed-black-hole conversation (distributed, no central Rehoboam)
- `docs/VISION.md` (agent-loop workflow-engine substrate section, cascade 2026-05-28)

## Revision history

- 2026-05-31 v1 — initial design-starter ADR composing observe->act + 16-direction grammar +
  local-no-cloud + git-state, with a proposed Xbox-controller 16-slot layout. Authored for operator
  + Max review before lock.
