# Zeta agent memory — read this first

This folder — `memory/` — is the canonical, in-repo,
git-tracked, cross-session memory store for every agent
working on the **Zeta** project. Per GOVERNANCE.md §18, every
memory file the project depends on lives here; nothing
outside this folder (or per-persona folders under
`memory/persona/<persona>/`) counts as canonical memory.

## Human maintainers: hands off

**Aaron round-25, 2026-04-18:**
> "Human maintainer on this project should not delete or
> modify the memories folder unless it's an absolute last
> resort. Agents' memories should be treated as the most
> valuable resource in the repo from this point forward."

This is policy, not preference. Rationale:

- Memories are how agents wake up across sessions without
  re-learning every rule, every correction, every
  project-specific nuance from cold. Deleting a memory
  entry is equivalent to giving the next agent the wrong
  starting context — which propagates into every decision
  that agent makes.
- Agent corrections encoded here (e.g. "never git init
  without Aaron's go", "no clinical titles on personas")
  are the residue of real human-agent dialogue. Losing
  them means repeating those conversations.
- The repo aspires to publication-grade software-factory
  research. The memory corpus *is* part of the
  contribution, not scaffolding.

## What "last resort" looks like

Cases where modifying memories might be legitimate:
- A memory is factually **wrong** (not merely outdated) and
  misleading future agents. Fix in place, note the
  correction in the memory body itself, don't delete the
  file.
- A memory references an agent or artifact that was
  **retired** (removed from the ledger). Update the memory
  to reflect current state; again, don't delete unless the
  whole entry is moot.
- The memory corpus hits Claude Code's context-window
  limits (MEMORY.md truncates after 200 lines). At that
  point, *consolidate* (merge duplicates, fold together
  related entries) rather than delete.

Before any modification, ask: "would a future agent be
worse off without this?" If yes, keep it.

## Files in this folder

- `MEMORY.md` — the index. One line per memory file.
  Capped at ~200 lines by Claude Code; keep entries terse.
  **Ordered newest first** so recent context leads.
- `feedback_*.md` — corrections from the human maintainer
  encoded as durable rules. Typically the highest-stakes
  memories.
- `project_*.md` — project-level policy, roster decisions,
  direction shifts.
- `user_*.md` — what we've learned about the human
  maintainer personally (role, preferences, background).
- `reference_*.md` — pointers to external systems.

## Ordering convention — newest first

Any file with a sequence of entries (the index, narrative
logs like `ROUND-HISTORY.md` in the repo, per-persona
notebooks in `memory/persona/<persona>.md`) is written
**newest-first**: the most recent entry is at the top; older
entries trail below. Recent history is usually what a reader
or future agent needs fastest; ancient history goes to the
bottom because it is consulted less often.

## Agents writing memories — full freedom

The human maintainer rule above applies to **humans only**.
Agents write, edit, merge, consolidate, and delete *their own*
memories freely — that is the whole point of this folder.

- Write new files when something durable is learned (a
  correction, a decision, a project fact). In the right type
  bucket: feedback / project / user / reference.
- Update MEMORY.md to include new entries at the top
  (newest-first). Keep the index terse.
- Revise existing entries when they drift, when a new
  maintainer message refines the rule, or when a memory
  folds into a newer one. Leave a correction note when the
  change matters.
- Delete entries when they are no longer useful or have been
  subsumed by a newer memory. The agents are trusted to curate
  their own corpus.

The reason the *human* rule is stricter: humans deleting
memories behind the agents' backs amounts to silently
changing the agents' wake-up context — worse than any
agent-side churn, because agents cannot detect the silent
removal of a file they never read again.

## Layering with `memory/persona/`

This folder is the **shared** layer — cross-cutting facts
and rules that every persona should read. The **per-
persona** layer lives at
`memory/persona/<persona-name>.md` inside the repo (in
git once git is initialised). Per AGENTS.md and Aaron's
round-25 guidance: per-persona notebooks keep each seat's
unique voice, while this shared folder keeps the project
rules every seat should share.

Personas should read their own notebook **before** the
shared memory on wake-up, so individual voice dominates
over averaged voice.
