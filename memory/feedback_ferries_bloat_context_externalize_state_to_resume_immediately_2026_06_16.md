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

1. **Land the verbatim COLD, fast.** Each ferry's full text → `memory/<persona>/conversations/`
   (or `docs/research/ip-questionable/` for third-party). Keep only the **razor-cut peel + a
   pointer** in the working register. The verbatim is recall-on-demand, not resident.
2. **Save state to the RESUME *immediately* after each ferry/work-chunk — proactively.** Do not
   wait to be reminded. The `docs/trajectories/*/RESUME.md` board (esp. the world-model umbrella's
   completeness checklist) is the externalized state; refresh it the moment something lands.
3. **Don't trust in-context memory of state.** Treat the RESUME as the source of truth (read on
   wake, CLAUDE.md §2). If unsure what's open, re-read the RESUME — don't reconstruct from the
   bloated transcript.
4. **The compression IS the antidote:** Mirror→Beacon the ferry down to its kernel + a link; the
   kernel is small and stays; the bloat goes to disk.

**Why this matters (Aaron's deeper point):** the autonomous flow works "at the frontier of
reliability" — context-bloat-induced state-loss is one of its real failure edges. Externalizing
state aggressively is what keeps the long-running loop from drifting. This is the operational face
of [[wake-time-substrate]] + the MEMORY-hub / `rules-are-small-carved-sentences-pointing-to-docs`
discipline: **resident surface tiny, detail one hop away on disk.**
