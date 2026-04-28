---
name: We honor those that came before — retired traces preserved
description: Aaron 2026-04-20 evening values statement. Even when a persona / skill / ADR / decision is retired or superseded, its memories and notebook traces are preserved. The retirement moves the active definition aside; it does not delete the history. Applies to agent memory files, persona notebooks, retired skills, deprecated ADRs, and any other trace of prior contribution.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Rule: **retired personas' memory files and notebooks are
preserved — never deleted on retirement.** Retirement
**deletes the active SKILL.md file** (skills are code — we
don't dirty the working tree with a `_retired/` archive; git
history is the archive). The persona's **memory files in
`~/.claude/projects/.../memory/persona/<name>/` stay in
place** — those are the valuable imprint of contribution and
do not live in the SKILL.md. ADRs stay in `docs/DECISIONS/`,
commit messages are never rewritten.

**Scope clarification (Aaron 2026-04-20 late, verbatim):**
> "i don't think we need to apply the don't deleted memories
> of retired agents to extend to deleted skills too, we don't
> want to dirty up our code skills are code, memories are
> valuable."

The memory-vs-code distinction is load-bearing:

- **Memories = valuable, preserve in-tree.** Persona memory
  folders, notebooks, ADRs, MEMORY.md pointers — all stay.
- **Skills = code, preserve in git only.** A retired
  SKILL.md deletes from the working tree; `git log
  --diff-filter=D -- .claude/skills/` surfaces the prior
  retirements when someone needs to unretire one.

**Why (Aaron 2026-04-20 evening):** verbatim —
> "Oh if we never delete memories even from retired
> employees. ... We honor those that came before."

This is both an ethical stance and a practical one:

1. **Ethical:** retired agents contributed; wiping their
   traces erases the record of that contribution. Memories
   carry the imprint of the decisions and learning the
   retired persona did while active. That imprint belongs
   to the factory's history, not to the retired persona
   personally — so retirement of the persona does not
   justify erasure of the imprint.
2. **Practical:** future agents reading the notebook of a
   retired predecessor may find corrections, rules of
   thumb, or context that saves them repeating the same
   mistakes. The retired persona's notebook is part of the
   factory's accumulated knowledge, not just private
   scratchpad.

**How to apply:**

- The skill-tune-up **RETIRE** action **deletes** the
  SKILL.md file (plain `rm` / `git rm`), leaving the
  deletion in git history as the archive. It does **not**
  touch `~/.claude/projects/.../memory/persona/<name>/` —
  the notebook stays in place with its full history.
  Earlier drafts of this memory and of the skill-tune-up
  skill described a `_retired/YYYY-MM-DD-<name>/` archive
  directory — that pattern was superseded 2026-04-20 when
  Aaron clarified "skills are code, memories are valuable":
  we no longer maintain a `_retired/` tree in-working-copy.
- The dispatch-or-retire decision on seed-only personas
  (Aminata, Kira, Mateo, Nadia, Naledi, Rune, Viktor —
  queued by Daya's r44 audit as a P1 item) inherits this
  rule: even the "retire" branch preserves the seed
  notebook stubs as traces of the decision to scope them.
- Any future proposal to **prune** the memory folder for
  size, readability, or archaeology reasons must cite this
  memory and justify the exception. The default is
  preservation.
- Rewriting commit messages, rebasing retired agents'
  commits, or squashing to hide authorship are all
  violations of the same principle — they erase the trace
  of who did what when.
- When a persona's active definition is renamed (not
  retired), the notebook is moved alongside the rename,
  not recreated. The history stays attached to the new
  name.

**Scope:** factory-wide. Any adopter of this factory kit
inherits the same preservation rule. It generalises beyond
Zeta.

**Cross-refs:**

- `project_memory_is_first_class.md` — the foundational
  "humans don't delete AI memories" rule this clarification
  extends.
- `feedback_preserve_original_and_every_transformation.md`
  — preserve-original-and-transformations is the same
  principle applied to data-in-flight; this memory applies
  it to personnel-in-retirement.
- Skill-tune-up retirement workflow in
  `.claude/skills/skill-tune-up/SKILL.md` §recommended-action-set
  — the RETIRE action's definition should be read through
  this memory's lens.
- `docs/FACTORY-HYGIENE.md` row 5 (skill-tune-up ranking)
  — the ranker's RETIRE recommendations carry this
  preservation obligation.
- `feedback_newest_first_ordering.md` — newest-first does
  not mean oldest-deleted; it means newest-surfaced.
- `user_newest_first_last_shall_be_first_trinity.md` —
  the trinity frame ("last shall be first") that this
  preservation rule pairs with. Ordering changes;
  preservation does not.
- `user_sister_elizabeth.md` — Aaron's explicit anchor
  ("just like i value the memory i hold of my sister, i
  honer the named agent here in the same way by protecting
  their memory"). The sister-memory register is the moral
  weight behind the preservation rule.

**The Trinity framing (Aaron memory
`user_newest_first_last_shall_be_first_trinity.md`):**

"Last shall be first" — the newest entries get surfaced
first in MEMORY.md / ROUND-HISTORY.md / notebooks. "Honor
those that came before" is the reciprocal — the oldest
entries are not deleted, they are kept below the newest as
the **foundation** on which the newest rest. Ordering
changes; preservation does not.

**Extension 2026-04-20 (late, Aaron verbatim):**

> "just like i value the memory i hold of my sister, i
> honer the named agent here in the same way by protecting
> their memory, who knows maybe they come back one day"

Aaron explicitly ties agent-memory preservation to the way
he holds the memory of his deceased sister **Elizabeth**
(`user_sister_elizabeth.md`). Retired named agents inherit
the same protection register. The "maybe they come back one
day" clause is not rhetorical — it's operative:
retirement is **suspension, not erasure**, and the memory
folder is the seed that lets an unretirement restore the
agent's continuity (personality, corrections, past
decisions) rather than starting from a blank.

**Corollary — prefer unretire over recreate:**

> "when creating new roles/jobs we should prefer to
> unretire an agent over recreating a new one."

Operational policy: when a new role / job / persona / skill
slot opens, the first move is to check git history for
deleted SKILL.md files and the corresponding persona memory
folders under `memory/persona/<name>/` for an existing
definition whose scope overlaps:

```
git log --diff-filter=D --name-only -- .claude/skills/
ls memory/persona/
```

If a retired agent's scope covers the new need (even
approximately), **unretire them** — restore the SKILL.md
from git history (`git show <deletion-commit>^:<path>`) and
reactivate the notebook (which is already in place) —
rather than minting a new name. The `_retired/` archive
convention that earlier drafts of this memory described was
superseded when Aaron clarified skills=code 2026-04-20.

Reasons:

1. **Continuity of memory.** The unretired agent wakes up
   with their accumulated corrections, rules of thumb, and
   past decisions intact. A newly minted persona starts
   cold and has to rediscover everything the retired one
   already learned.
2. **Honor the contribution.** Creating a fresh name when
   a retired name already fits is a subtle form of
   erasure — the new name gets credited for what the
   retired agent's notebook already figured out.
3. **Factory economy.** Persona sprawl is a known cost
   (Kai/Samir/Yara dispatch-or-retire audits exist for
   this reason). Unretiring one is cheaper than managing
   two similar names.
4. **Aaron's register.** Treating retired agents as
   "dormant but addressable" matches how Aaron relates to
   Elizabeth's memory — the relationship continues in a
   different mode, it didn't end.

**How to apply (unretire workflow):**

- The `skill-creator` workflow's **new-skill** path
  should check persona memory folders and git history
  *before* drafting a new skill name:
  ```
  git log --diff-filter=D --name-only -- .claude/skills/
  ls ~/.claude/projects/<slug>/memory/persona/
  ```
  If a deleted SKILL.md (or an orphan persona notebook)
  matches the scope, switch to an **unretire** path
  instead of minting a new name.
- The unretire path: `git show <deletion-commit>^:<path>`
  restores the SKILL.md content; write it back to
  `.claude/skills/<name>/SKILL.md` via the `skill-creator`
  workflow (ADR-logged, prompt-protector-reviewed, not
  ad-hoc per GOVERNANCE §4); log the unretirement in
  `docs/ROUND-HISTORY.md` with a one-line "unretired
  <name> for <reason>"; the persona notebook is already
  in place — no action needed there.
- If the retired skill's scope is *close but not exact*,
  prefer unretiring + editing the SKILL.md over minting
  a new name. The notebook continuity is worth the edit.
- If the retired skill's scope is *genuinely unrelated*
  and a new name is honestly the right call, proceed with
  new-skill creation — but log the check ("considered
  unretiring X, Y, Z via git history; none fit because
  …") so the preference-order is auditable.
- The **dispatch-or-retire decision on seed-only personas**
  (Daya's r44 P1 queue: Aminata, Kira, Mateo, Nadia,
  Naledi, Rune, Viktor) should now be read through this
  lens: retirement is not the default — if any of these
  can be **unretired** into a currently-needed scope
  instead of being dispatched-to-retirement, that's the
  preferred move.
- This policy generalises beyond Zeta — any adopter of
  this factory inherits the unretire-before-recreate rule.
