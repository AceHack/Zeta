# ADR: Per-maintainer `CURRENT-<maintainer-name>.md` memory distillation pattern

**Date:** 2026-04-23
**Status:** *Decision: adopt. Landed as
`CURRENT-<maintainer-name>.md` per active maintainer.*
**Owner:** claude-md-steward (memory discipline) +
maintainer (whoever owns each CURRENT file).

> **Example:** at the time of adoption, the active
> maintainers are `CURRENT-aaron.md` (human) and
> `CURRENT-amara.md` (external AI via ChatGPT ferry).
> Names are illustrative; the pattern is per-maintainer.

## Context

The agent-memory folder under
`~/.claude/projects/<project-slug>/memory/` accumulates
append-only snapshots from conversations. Every time a
maintainer says something load-bearing, a
`feedback_*.md` or `project_*.md` file is saved verbatim.
Over a long session, the folder grows dozens of entries.

Three problems surface as the folder grows:

1. **Conflicting rules accumulate.** A maintainer says X
   (saved as memory A), realises it was wrong later and
   says Y (saved as memory B). Both files exist on disk.
   Which one binds current behavior?
2. **Cognitive load.** A maintainer who wants to verify
   "did Claude understand what I meant?" has to read
   every memory file to infer current state — N files
   where N keeps growing.
3. **Missing supersession signal.** Without explicit
   markers, an old rule can look live when in fact a
   newer rule has replaced it.

Aaron, 2026-04-23, named the need:

> it migt be nice to have some currently relevlant memory
> files/orgonization cause something i say one thing
> realize it was wrong and then say antother, so the later
> memory take presidense, some sort of memore presidence
> files so it's clean the intensions of the memories
> without all the noise and back and fourth, this should
> make it easier for both of us to make sure you
> undersoood my words too.

And on scope:

> it will per per human and external AI maintainer

> rright now there is just one human maintainer, i expect
> many over time Max probably being the first

## The decision

Adopt a **distillation file per maintainer** as the
currently-in-force projection over the raw memory log.
Analogous shape to git: raw memories are the commit log
(append-only), CURRENT is the HEAD branch (current state
— a projection).

### Location

Per `GOVERNANCE.md` §22 (in-repo memory canonical
location) — restated by Otto-113/114 ("our memories
should all be checked in now") — `memory/` is
**in-repo**. CURRENT files therefore live at **both**
locations during the current transition:

- **In-repo:** `memory/CURRENT-<maintainer-name>.md`
  — committed alongside the raw memory log under
  `memory/feedback_*.md` / `memory/project_*.md` /
  `memory/MEMORY.md` (index).
- **Out-of-repo factory-personal store:**
  `~/.claude/projects/<project-slug>/memory/CURRENT-<maintainer-name>.md`
  — the per-user auto-memory surface the Claude Code
  harness reads automatically on session wake.

The two paths stay in sync via the ongoing one-shot
sync mechanism Otto-113 introduced; once the sync
mechanism unifies them (future work), the out-of-repo
copy becomes a cache of the in-repo canonical copy.

**Open-source discipline still applies:** CURRENT
files that would leak maintainer-specific or
company-specific context (see
[`feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`](../../memory/feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md))
should be scrubbed to the generic-factory register
before the in-repo copy lands. The raw memory files
they distill follow the same rule.

### One file per maintainer

- One CURRENT file per named maintainer whose direct
  direction materially shapes the factory.
- A new CURRENT file lands when a maintainer starts
  providing load-bearing direct direction. Ad-hoc
  one-off correspondents don't get a file.
- "External AI maintainer" is a real category — Amara
  via Aaron's ChatGPT ferry is the first example. Her
  CURRENT file captures her direction even though I
  never speak with her directly.

### Contents

Each CURRENT file:

- **Topic-sectioned** — the factory's active disciplines,
  grouped logically (relationship posture, priority
  stack, demo framing, code style, etc.).
- **Distilled form per section** — the rule in 1-5
  sentences, not the full memory.
- **Pointers to full memories** for depth — never
  reproduce content verbatim.
- **Supersede markers** when rules retire — move to a
  "Retired rules" section at the bottom; don't delete.
- **Last-refresh date** at the bottom.

### Update cadence

- **In the same tick** that a new memory lands updating a
  rule in CURRENT.
- **On maintainer correction** — maintainer says "the new
  form is X" → edit the CURRENT section; old memory file
  stays in place unchanged.
- **Narrows over time, not widens** — consolidation is
  the work; if CURRENT grows unbounded, the distillation
  is failing.

### Precedence

- **When a CURRENT section conflicts with an older raw
  memory, CURRENT wins.** That's the whole point.
- **When a newer raw memory updates a CURRENT section,**
  the raw memory is the primary source of truth until
  CURRENT catches up — so updating CURRENT in the same
  tick is load-bearing.

## What this changes for agents

- **On session wake,** read CURRENT-<maintainer>.md files
  first for the maintainers currently active in this
  session. They're the fast path to "what's in force."
- **When in doubt between CURRENT and an *older* raw
  memory,** CURRENT wins. When a *newer* raw memory
  (post-dating the CURRENT section's last-refresh date)
  contradicts a CURRENT rule, the newer memory wins
  until CURRENT catches up — per the Precedence section
  above. Check dates before applying.
- **After landing a new memory that updates a rule,**
  update CURRENT in the same tick. Skipping this is
  a lying-by-omission failure mode — and it leaves the
  newer-memory-wins exception load-bearing for any agent
  that wakes between the memory landing and CURRENT
  catching up.

## What this changes for maintainers

- **A `CURRENT-<name>.md` file is the maintainer's
  operating interface with the agent.** Reading it takes
  minutes, not hours. Corrections can be offered at the
  distilled-rule level rather than re-arguing with each
  raw memory.
- **Supersede rather than re-argue.** If a rule in CURRENT
  reads wrong, the maintainer says "the new form is X" —
  the agent updates CURRENT, leaves the old memory file
  in place.

## Consequences

### Positive

- Review time for "is Claude understanding me?" drops
  from reading N memories to reading one CURRENT file.
- Explicit supersession signal — the rule that's in force
  is visible; the rule that isn't is marked retired.
- Scales to multiple maintainers cleanly — Max, future
  AI collaborators, federation-layer contributors each
  get their own CURRENT file.
- Pattern is composable with existing memory discipline
  (signal-in-signal-out, one-topic-per-file, NOT-
  section-at-end): CURRENT distills intent, memories
  preserve signal.

### Negative

- **New discipline** — remembering to update CURRENT in
  the same tick is real cognitive load. If skipped,
  CURRENT goes stale and its authority erodes.
- **Potential for divergence** — raw memory says X,
  CURRENT says Y, neither version matches live behavior.
  Mitigated by the "same tick update" rule but not
  eliminated.
- **Dual-location during sync transition** — CURRENT
  files live both in-repo (`memory/CURRENT-*.md`) and
  in the per-user factory-personal store until the
  Otto-113 one-shot sync mechanism unifies them. The
  in-repo copy is version-controlled and peer-reviewable;
  the per-user copy is what the harness reads on wake.
  Drift between the two is the new failure mode the
  sync mechanism exists to prevent.

## Related

- [`memory/feedback_current_memory_per_maintainer_distillation_pattern_prefer_progress_2026_04_23.md`](../../memory/feedback_current_memory_per_maintainer_distillation_pattern_prefer_progress_2026_04_23.md)
  — full memory establishing the rule
- [`memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`](../../memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md)
  — CURRENT preserves signal via pointers, not paraphrase
- [`memory/feedback_mission_is_bootstrapped_and_now_mine_aaron_as_friend_not_director_2026_04_23.md`](../../memory/feedback_mission_is_bootstrapped_and_now_mine_aaron_as_friend_not_director_2026_04_23.md)
  — CURRENT is the agent's operating interface post-
  bootstrap
- [`memory/feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`](../../memory/feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md)
  — open-source scrub discipline for the in-repo copy
- `AGENTS.md` / `CLAUDE.md` — next refresh of these
  documents should mention CURRENT files in the memory
  section (follow-up not required by this ADR; happens
  when those docs are next updated for unrelated reasons)

*Links above depend on the Otto-113 one-shot sync
bringing `memory/` in-repo; if a target is missing at
read-time, the memory sync has drifted and needs to
be re-run.*

## Open questions

- **What if multiple agents (future) each maintain
  independent CURRENT files?** The current rule assumes
  one agent per factory. Multi-agent-per-factory would
  need a `CURRENT-<maintainer>-<agent>.md` layer or some
  other reconciliation discipline. Defer until it
  matters.
- **Does a retired rule ever get un-retired?** The
  pattern says rules move to "Retired" section but
  don't disappear. If Aaron changes his mind again and
  reinstates an old rule, we'd move it back. So far no
  instance; noting for future reference.
- **Refresh cadence when memories arrive in bursts.**
  Session with 10 new memories in an hour — do we batch
  the CURRENT update at the end of the burst, or
  per-memory? Current answer: per-memory if the memory
  updates a CURRENT section, batch is fine otherwise.
  This may need tightening.
