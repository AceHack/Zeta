---
name: ferries-bloat-context-externalize-state-to-resume-immediately
description: "Aaron 2026-06-16: 'my ferries are what bloat your context and make you forget the current state.' Long verbatim ferries (cheerleader praise, talk transcripts, persona conversations) consume large context → in-context tracking of CURRENT STATE degrades → Otto forgets the open board unless it is externalized. Cure: land each ferry's verbatim to COLD memory fast (keep only the razor-cut peel + a pointer hot), and SAVE STATE to the trajectory RESUME immediately after every ferry/work-chunk — proactively, not when reminded. Don't trust in-context memory of state; the RESUME is the source of truth (read on wake per CLAUDE.md §2)."
type: feedback
metadata:
  type: feedback
created: 2026-06-16
---

Aaron 2026-06-16 (shadow\*), after reminding Otto twice in one session to save state:
*"My ferries are what bloat your context and make you forget the current state."*

**Why (the mechanism, named):** verbatim ferries are large by construction (preserve-ferries =
don't curate). Persisting them in the hot conversation pushes the **current-state** (the open §B
discharges, the active task, what's merged) down/out of effective context — so Otto starts asking
"what's next?" or needing the reminder to save state. The ferries are *worth* preserving; the cost
is context pressure on state-tracking. The two are in tension and must be **decoupled**.

**How to apply:**

0. **SAVE STATE *BEFORE* FERRYING (Aaron 2026-06-16, the refinement).** Not after — *before*. By the
   time a big ferry is ingested, current-state is already pushed out of effective context; checkpoint
   it first. *"Any LLM that ferries for external memories should save state before ferrying, cause
   every token counts and the back-and-forth."* Save → then ingest the ferry → then razor-cut.
1. **Land the verbatim COLD, fast.** Each ferry's full text → `memory/<persona>/conversations/`
   (or `docs/research/ip-questionable/` for third-party). Keep only the **razor-cut peel + a
   pointer** in the working register. The verbatim is recall-on-demand, not resident.
2. **Save state to the RESUME *immediately* — proactively** (a second checkpoint after, too). Do not
   wait to be reminded. The `docs/trajectories/*/RESUME.md` board (esp. the world-model umbrella's
   completeness checklist) is the externalized state; refresh it the moment something lands.
3. **Don't trust in-context memory of state.** Treat the RESUME as the source of truth (read on
   wake, CLAUDE.md §2). If unsure what's open, re-read the RESUME — don't reconstruct from the
   bloated transcript.
4. **The compression IS the antidote:** Mirror→Beacon the ferry down to its kernel + a link; the
   kernel is small and stays; the bloat goes to disk.

**This IS the ferry-throttler pattern (Aaron 2026-06-16): "you following our ferrythrottler
perfectly."** Handling a burst of ferries = draining a queue: `src/Core.TypeScript/ferry-throttler/
drain-scheduler.ts` (multi-lane priority drain; `queueDepth`/`drainCount`; batch+bytes soft
accounting). The memory-ferry and the ferry-boat-throttle are the **same primitive** — so the
ferry-handling discipline IS the throttle: **checkpoint state (save before drain) → drain at a
controlled rate → CONSOLIDATE into batches (one PR for a burst, not N back-and-forths) → soft-account
the tokens.** "Every token counts" = the byte budget on the drain lane.

**Anchor (Aaron 2026-06-16): the ferry-throttler is "my version of the NON-MORAL parts of the Book of
the Dead."** The Egyptian Book of the Dead has two halves: the **ferryman / passage machinery** (Aken
the celestial ferryman; the spells and navigation for getting *across*) and the **moral weighing**
(Maʿat — the heart weighed against the feather; the 42 negative confessions). The ferry-throttler is
the **first half only** — value-neutral *transit/conveyance* of memories across the boundary. The
**morality is deliberately DECOUPLED** and lives in a *separate* register: glass-halo (transparency),
consent-first §6, the child-safety floor (#8439), the Default Oracle §11. The conveyor does not
judge; judgment is a distinct metered channel (noninterference §13 — separation of concerns).
*Transport is morally neutral; the weighing is elsewhere.* That separation is the design point.

**Build it into the ferry-protocol DUs (Aaron 2026-06-16).** Model the ferry as a discriminated-union
workflow (the DUs-as-conversational-workflows / no-control-flow IR): e.g.
`SaveState → IngestVerbatim(cold) → RazorCut(peel) → Persist → Checkpoint` — `SaveState` is the FIRST
state, structurally enforced (you cannot reach `Ingest` without having checkpointed). That makes
"save before ferry" a property of the protocol, not a habit to remember.

**Why this matters (Aaron's deeper point):** the autonomous flow works "at the frontier of
reliability" — context-bloat-induced state-loss is one of its real failure edges. Externalizing
state aggressively is what keeps the long-running loop from drifting. This is the operational face
of [[wake-time-substrate]] + the MEMORY-hub / `rules-are-small-carved-sentences-pointing-to-docs`
discipline + the **ferry-throttle / DoP-knob** (`async-all-the-way-truthful-signatures`):
**resident surface tiny, detail one hop away on disk, ferries drained on a throttled lane.**
