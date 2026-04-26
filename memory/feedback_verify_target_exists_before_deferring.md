---
name: Verify-before-deferring — whenever the agent says "next tick / next round I'll pick up X", verify X actually exists and is findable *before* deferring; no phantom-target handoffs
description: 2026-04-20 — Aaron: "also make sure whever you decide to wait for next time, ever single time you do that you check to make sure it's there first" + "next tick" + "*". Every time the agent defers work to a future tick/round/session, the deferred target (file, task, backlog entry, skill, persona notebook, memory) must be verified to exist and be findable *before* the deferral ships. Phantom deferrals — references to "I'll continue the X audit next tick" when X isn't actually on the BACKLOG, or "I'll finish the Y migration" when Y doesn't exist as a named artefact — are the anti-pattern this rule retires.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

Every time the agent writes a sentence of the form:

- *"Next tick I'll …"*
- *"I'll pick this up next round …"*
- *"Deferred to a future session …"*
- *"Continues in round N+1 …"*
- *"Will resume the X audit later …"*
- *"On the next autonomous tick …"*

— verify **before** the deferral ships that the deferred
target exists and is findable. Specifically:

1. **File / artefact reference**: run `ls` / `Read` / `Glob`
   to confirm the file or directory is actually there.
2. **Backlog item reference**: grep `docs/BACKLOG.md` (or
   `docs/HUMAN-BACKLOG.md`) to confirm the row exists; if
   not, land the row *in this turn* so the deferral has a
   real target on the next turn.
3. **Named task reference**: if the deferral is of the form
   "the X audit" or "the Y sweep", the string "X audit" or
   "Y sweep" must resolve to a real skill, cadence row, or
   backlog item. Grep for it. If it doesn't exist, either
   name the real referent or land the row now.
4. **Persona notebook reference**: if deferring to a
   persona-notebook continuation, confirm the notebook
   exists at `memory/persona/<name>/NOTEBOOK.md`; if the
   persona doesn't exist yet, don't defer to it —
   either pick a real persona or commit the creation this
   turn.
5. **Skill / BP-NN reference**: skills under
   `.claude/skills/` and BP-NN rules in
   `docs/AGENT-BEST-PRACTICES.md` are the canonical name
   sources. A deferral like "via the Aarav tune-up" is
   fine because `.claude/skills/skill-tune-up/SKILL.md`
   and `memory/persona/aarav/NOTEBOOK.md` both exist; a
   deferral like "via the Ruthless-Reviewer sweep" is
   phantom unless that skill is actually on disk.

If verification fails, the agent has three options —
pick one, don't ship the deferral as-is:

- **Replace** with a real, verified target.
- **Create** the target *this turn* (land the BACKLOG row /
  memory / skill / ADR) so the deferral is honest.
- **Drop** the deferral. "I don't actually have a next-tick
  target for this, so I'm stopping here" is more honest
  than a phantom handoff.

# Why:

Verbatim (2026-04-20):

> *"also make sure whever you decide to wait for next time,
> ever single time you do that you check to make sure it's
> there first"*

Followed by: *"next tick"* and *"*"* as scope wildcards —
this rule applies to every form of deferral, not just the
phrase "next tick."

Two concrete failure modes this rule removes:

**Failure mode 1: phantom BACKLOG rows.** The agent finishes
a round summary with "the X audit continues next round"
without verifying that "X audit" is a row on BACKLOG.md.
Next round's agent sees the summary, looks for "X audit"
on the backlog, finds nothing, and either reinvents the
scope from scratch (wasting time) or drops it entirely
(losing the deferred work). The handoff breaks at the
boundary and nobody notices because the round transcript
looks coherent.

**Failure mode 2: hallucinated tooling.** The agent writes
"I'll run the symmetry-audit skill next tick" when the
symmetry-audit skill hasn't actually been created yet —
it was only *proposed* in a memory. Next round's agent
searches `.claude/skills/` and finds nothing; the deferral
is unsupported and the work is either stalled or
reinvented. This is a specific case of the more general
confabulation-across-rounds problem.

**Why this matters for the factory specifically.** The
factory's long-horizon value depends on round-to-round
continuity being trustworthy. Memory and ROUND-HISTORY
both assume a deferral is a real pointer. Phantom
deferrals pollute both: MEMORY.md ends up citing
non-existent work, ROUND-HISTORY ends up recording plans
that never had a landing site. This is the same class of
failure as writing "see file X" when X doesn't exist —
citation discipline, applied to future-tense statements.

Related prior art:

- `feedback_dont_stop_and_wait_for_cron_tick.md` — don't
  stop and wait; keep working. This rule complements it:
  when you *do* defer (because you genuinely can't
  continue without input / external state / human
  decision), make sure the deferral target is real.
- `feedback_meta_wins_tracked_separately.md` — meta-wins
  include "false wins"; phantom deferrals are false
  handoffs, same class of anti-pattern.
- `feedback_preserve_original_and_every_transformation.md`
  — preserve history; phantom references break history.

# How to apply:

- **Quick audit at round-close.** Before writing a
  round-close message that includes a "next tick" /
  "next round" / "continues" clause, run at least one
  verification step from the list above for each
  deferred target. Typically that's one `Grep` +
  one `ls` / `Glob`.
- **Named-target citation.** Every deferred target
  gets cited with a path or an identifier. "I'll pick
  up the next hygiene pass" is weak; "I'll pick up
  `docs/FACTORY-HYGIENE.md` row #23 (missing-hygiene-
  class gap-finder) next round" is the target form.
  The citation itself is the verification anchor.
- **Defer-to-BACKLOG pattern.** If there's nothing
  cheap to land this turn but the work needs a next-
  round home, add a row to `docs/BACKLOG.md` this turn
  and reference the row in the deferral. The row
  creation is the verification: the row now exists,
  so the deferral is real.
- **ScheduleWakeup prompts.** When invoking
  `ScheduleWakeup`, the `prompt` field is literally a
  deferred target. Every `ScheduleWakeup` call must
  reference a real artefact (BACKLOG row, skill, memory,
  persona notebook) — the prompt's specificity is the
  verification.
- **Round-summary discipline.** The round-close summary
  section that reads "Open threads for next round"
  must only contain threads that resolve to named,
  findable artefacts. If a thread doesn't resolve,
  land the artefact this turn or drop the thread.

# What this rule does NOT do

- It does NOT forbid deferrals. Deferring to the next
  round is fine and often correct — what's forbidden is
  deferring to a *phantom*.
- It does NOT require massive audit overhead.
  Verification is usually one grep + one file-existence
  check. The rule adds small constant cost per
  deferral.
- It does NOT apply to genuinely speculative future
  work. "Eventually we might build X" is not a
  deferral — it's a hypothetical, and those are
  handled by `docs/VISION.md` / `docs/ROADMAP.md` /
  future-direction memories. Those don't need file-
  existence verification because they aren't claiming
  the file already exists.
- It does NOT override the anti-idle rule. If the
  agent can verify a deferral target OR find other
  factory-improvement work that doesn't require a
  deferral, picking the non-deferral work is still
  preferred per
  `feedback_never_idle_speculative_work_over_waiting.md`.

# Connection to existing artefacts

- `feedback_dont_stop_and_wait_for_cron_tick.md` — its
  complement; this rule is the quality-gate on
  *whatever* deferral you emit, including tick-aligned
  ones.
- `feedback_never_idle_speculative_work_over_waiting.md`
  — never-idle still holds; this rule just ensures
  deferrals (when they happen) are honest.
- `docs/BACKLOG.md` — the canonical landing site for
  deferred work; row citations are the strongest
  verification form.
- `docs/ROUND-HISTORY.md` — the append-only history
  this rule protects from phantom-reference
  pollution.
- `feedback_citation_integrity.md` (if it exists;
  otherwise this is a candidate to land eventually) —
  same discipline, applied to future-tense
  statements.
