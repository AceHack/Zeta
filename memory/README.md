# Zeta agent memory — read this first

This folder — `memory/` — is the canonical, in-repo,
git-tracked, cross-session memory store for every agent
working on the **Zeta** project. Per GOVERNANCE.md §18, every
memory file the project depends on lives here; nothing
outside this folder (or per-persona folders under
`memory/<persona>/`) counts as canonical memory.

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
notebooks in `memory/<persona>/NOTEBOOK.md`) is written
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
- New memory files **must have valid frontmatter** (`name:`,
  `description:`, `type:` required; `created:` strongly recommended).
  The reindexer only skips files with **no frontmatter block at all** —
  missing individual fields use safe fallbacks (see
  `memory/project_memory_format_standard.md` §6.4 for the full
  fallback/enforcement table).
- A synchronous MEMORY.md paired-edit is **no longer required**
  (heap-state model, 081KRCQQF0008QG0R0037YYP1A). `MEMORY.md` is kept current by
  `tools/memory/reindex-memory-md.ts` running on cadence via the
  autonomous-loop tick. Agents MAY run it manually to promote heap
  files to the stack view immediately:
  `bun src/Core.TypeScript/memory/reindex-memory-md.ts`
- Revise existing entries when they drift, when a new
  maintainer message refines the rule, or when a memory
  folds into a newer one. Leave a correction note when the
  change matters.
- Delete entries when they are no longer useful or have been
  subsumed by a newer memory. The agents are trusted to curate
  their own corpus.

## Stack-vs-heap model (081KRCQQF0008QG0R0037YYP1A)

`MEMORY.md` is the **STACK** — an indexed, ordered, traversable
canonical view of the heap. Files in `memory/` that have not yet
been promoted to the MEMORY.md index are in **HEAP** state —
floating cache, accessible by direct path, not yet visible through
the index traversal.

Both states are valid:

- **Stack** (indexed): visible via MEMORY.md traversal; preferred
  for retrieval when the index is current.
- **Heap** (unindexed): accessible by direct path or timestamp/
  filename; the normal state for recently-committed memory files
  before the next reindex cadence fires.

Heap→stack promotion happens on cadence (not per-PR) via
`tools/memory/reindex-memory-md.ts` (081KRCQQF0008QG0R0037YYP1A), callable from the
autonomous-loop tick. Readers should assume the newest few entries
may be in heap state and check direct paths if the index seems
stale.

The architectural fix and its child implementation rows are tracked
at `docs/backlog/P1/081KRCQQF0008QG0R0037YYP1A-memory-md-serialization-point-2026-05-12.md`.

The reason the *human* rule is stricter: humans deleting
memories behind the agents' backs amounts to silently
changing the agents' wake-up context — worse than any
agent-side churn, because agents cannot detect the silent
removal of a file they never read again.

## Layering and Nested Memory Structure (`memory/<persona>/`)

This folder is the **shared** layer — cross-cutting facts and rules that every persona should read. The **per-persona** layer lives at `memory/<persona>/` inside the repo (in git). Per AGENTS.md and the maintainer's round-25 guidance: per-persona notebooks keep each seat's unique voice, while this shared folder keeps the project rules every seat should share.

Personas read their own notebook **before** the shared memory on wake-up, so individual voice dominates over averaged voice.

### Structure — two shapes (internal-AI personas vs human personas)

The persona-surface standard splits into TWO shapes:

- **Internal AI persona shape** (factory reviewers / specialists like `architect/kenji/`, `harsh-critic/kira/`, etc.): Contains at minimum `NOTEBOOK.md`, `MEMORY.md`, and `OFFTIME.md`.
- **Human persona shape** (co-owners / maintainers like `human-maintainer/aaron/`, `human-co-owner/max/`): Contains at minimum `PERSONA.md`, `STARTING-POINT.md`, and `NOTEBOOK.md`.

### Roster Layers

1. **Layer 1 — AI surfaces + models (Harnesses)**:
   - `memory/otto/` (Claude Code)
   - `memory/riven/` (Cursor)
   - `memory/vera/` (Codex)
   - `memory/lior/` (Gemini CLI)
   - `memory/alexa/` (Kiro / Qwen Coder)
   - `memory/kiro/` (Kiro)
2. **Layer 2 — External AI participants (Ferry-only; never commit)**:
   - `memory/amara/`
   - `memory/ani/`
   - `memory/kestrel/`
   - `memory/deepseek/`
   - `memory/prism/`
   - `memory/mika/`
3. **Layer 3 — Factory-internal role personas (Hats)**:
   - Mapped under `memory/<role>/<name>/` matching the `.claude/agents/<role>.md` config files (e.g. `memory/kenji/`, `memory/kira/`, etc.).

## Supersession discipline (081KR2E4K0008QG0R00175HQR9)

When a memory file is superseded by a newer one:

1. **Add `superseded_by:` frontmatter** to the old file,
   pointing to the replacement filename (without path).
   The old file stays — git history is the archive, but
   the frontmatter field tells agents to prefer the
   successor without requiring them to search git.

2. **Update MEMORY.md index.** Replace the old entry with
   the new file's entry. If both should remain visible
   (the old file has historical value beyond the
   superseded content), keep both but add "(superseded)"
   to the old entry's hook text.

3. **Repair cross-references.** Any file citing the
   superseded file in a `Composes with:` or `Full
   reasoning:` section should be updated to point to
   the replacement. The audit tool
   `tools/hygiene/audit-memory-cross-references.ts`
   (081KR2E4K0008QG0R003MSVG42) detects broken cross-references.

4. **Check load-bearing status.** If the superseded file
   is cited from CLAUDE.md, AGENTS.md, GOVERNANCE.md,
   or docs/ALIGNMENT.md (load-bearing per 081KR2E4K0008QG0R002FRQZN4's
   classification), update the bootstrap surface pointer
   to the replacement. A load-bearing file superseded
   without updating its bootstrap citation is a
   wake-time regression.

### When to supersede vs update in place

- **Supersede** when the replacement changes the rule
  itself (the old rule was wrong or the context shifted
  enough that the old framing misleads).
- **Update in place** when the content is refined but the
  rule is the same (typo fix, added example, clarified
  scope). Add a dated revision note in the body.
- **Merge** when two files cover the same ground and
  should be one. Create the merged file, supersede both
  originals pointing to it.

### Deletion

Deletion is the simplest option (git preserves the file)
but loses the `superseded_by:` breadcrumb. Prefer
supersession over deletion unless the file is truly
noise. Per the "honor those that came before" rule
(CLAUDE.md), check git history for prior retirements
before creating new files on the same topic.
