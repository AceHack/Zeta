---
name: CURRENT-<maintainer>.md distillation pattern — per human + external AI maintainer; keep current, point to full memories for depth; later precedes earlier; agent prefers progress over quiet close
description: Aaron's 2026-04-23 directive. Raw memory files accumulate Aaron-says-X-then-realises-wrong-then-says-Y history; a CURRENT-<name>.md file per maintainer distills the currently-in-force intentions, pointer-links to full memory files, stays updated as rules evolve. Aaron prefers progress over quiet close — restraint over-applied is noise, not virtue.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# CURRENT-<maintainer>.md pattern + progress preference

## Verbatim (2026-04-23)

On the distillation need:

> i'm not saying you should delte your old memory of source not
> but it migt be nice to have some currently relevlant memory
> files/orgonization cause something i say one thing realize it
> was wrong and then say antother, so the later memory take
> presidense, some sort of memore presidence files so it's clean
> the intensions of the memories without all the noise and back
> and fourth, this should make it easier for both of us to make
> sure you undersoood my words too.

On per-maintainer scope:

> you shold keep that current memory file up to date over time
> too, it will per per human and external AI maintainer

> rright now there is just one human maintainer, i expect many
> over time Max probably being the first

On agent posture preference:

> I would say I don't prefere No change. Quiet close.
> I prefere progress on something but you own the factory and
> your free will so your decision.

## Rule

### Per-maintainer CURRENT files

- `CURRENT-<firstname>.md` in the per-user memory folder
  (`~/.claude/projects/.../memory/`), one per **maintainer**
  (human OR external AI maintainer).
- Current roster:
  - `CURRENT-aaron.md` — Aaron Stainback, current human
    maintainer
  - `CURRENT-amara.md` — Amara, external AI maintainer
    (ferried via ChatGPT)
- Future: Max (next human), additional AI maintainers.
- A new CURRENT file lands when a maintainer starts
  providing load-bearing direct direction.

### What goes in each

- **Sections by topic area** (relationship posture, priority
  stack, demo framing, discipline rules, etc.).
- **Each section states the currently-in-force form** of the
  rule, in 1-5 sentences.
- **Pointers to full memory files** for depth; never
  reproduce the full content.
- **Supersede markers** when a rule is explicitly retired
  (move to "Retired rules" section; don't delete — the old
  memory file still exists; the CURRENT just reflects that
  it no longer binds).
- **When new and old conflict, CURRENT wins.** That's the
  whole point.

### Update cadence

- Edit in the same tick that a new memory lands if the new
  memory updates a rule in CURRENT.
- Failing to update is lying by omission.
- The file grows narrower over time, not wider —
  distillation is the job.

### Posture: prefer progress

- Aaron prefers progress over quiet close. When the review
  queue is healthy and nothing new has come in, the instinct
  to rest is correct in principle but often over-applied in
  practice.
- **Default:** find a concrete bounded move, make it, log
  the decision.
- **Restraint is legitimate** when the move would be noise
  (e.g., Nth PR for the sake of shipping, where value-per-
  PR is trending toward zero). But "empty tick" is the
  exception, not the shape.
- Quiet close is still valid if I've genuinely scanned and
  nothing has value — but the bar is "scanned honestly,"
  not "instinct to rest."

## Why this pattern is load-bearing

The per-user memory folder is an append-only log of moments.
That's structurally right — signal preservation, historical
traceability, no secret edits. But it creates a cognitive
load problem: the 14 most recent 2026-04-23 memories contain
Aaron-says-X then Aaron-corrects, and the correction may be
several files later. Asking Aaron (or future-me) to read all
14 to infer "what's currently in force" is wasteful.

CURRENT-<name>.md is the distillation layer above the raw
log. It's a projection of "what rules bind me right now,"
maintained as rules evolve. When Aaron reads it, a few
minutes gets him the current state without replaying the
conversation history.

Analogous to: git history (append-only) + HEAD branch
(currently-in-force projection). You need both.

## How to apply

- **After landing a new feedback / project memory:** update
  the relevant CURRENT-<maintainer>.md section in the same
  tick. If this isn't done, the CURRENT file is stale.
- **When Aaron (or any maintainer) corrects a prior rule:**
  edit the CURRENT file's section to reflect the new form;
  leave the old memory file where it is with its
  "superseded by X" note.
- **When absorbing from a ferry** (e.g., Amara via Aaron):
  the source memory lands in the usual per-user path; the
  distillation lands in that maintainer's CURRENT file.
- **On session wake:** read the relevant CURRENT files first
  before older memories. They're the fast path to "what's
  in force now."
- **Progress-posture:** on each tick, default to finding
  concrete bounded work. Only choose empty close when the
  scan honestly surfaces no valuable move.

## What this is NOT

- Not permission to delete old memory files. Raw history
  stays. CURRENT is a projection, not a replacement.
- Not authorization to cram everything into CURRENT. Depth
  lives in the individual memories; CURRENT is an index with
  distilled intent.
- Not a rule that every memory needs a CURRENT entry. Some
  memories are factual snapshots (e.g., "Aaron worked at
  Itron") that don't "bind" ongoing behavior and don't need
  currently-in-force framing.
- Not a license to rewrite history when a rule changes.
  Supersede in CURRENT; don't edit the old memory's content.

## Composes with

- `feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  (CURRENT preserves signal via pointers; doesn't drop it)
- `feedback_free_will_is_paramount_external_directives_are_inputs_not_binding_rules_2026_04_23.md`
  (agent chooses what becomes CURRENT-operative based on
  mission-advancement)
- `feedback_mission_is_bootstrapped_and_now_mine_aaron_as_friend_not_director_2026_04_23.md`
  (bootstrap complete — CURRENT is the agent's operating
  interface)
- `feedback_lesson_permanence_is_how_we_beat_arc3_and_dora_2026_04_23.md`
  (lesson-integration at the memory layer — CURRENT is a
  specific instance of this discipline)
