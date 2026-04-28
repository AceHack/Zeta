# Trajectory — Memory Hygiene

## Scope

Both surfaces of memory: in-repo `memory/` (canonical, committed,
discoverable via grep) and user-scope `~/.claude/projects/<slug>/memory/`
(per-user, mirror of in-repo when applicable). Open-ended because
memory accretes per-tick, hot files churn, indexes drift. Bar:
every memory file is discoverable via the index; CURRENT files
are current; counterweight memories don't go stale; memorial-class
content is accurate.

## Cadence

- **Per-memory-file**: when a new memory lands, MEMORY.md gets a
  pointer row in the same commit (memory-index-integrity rule).
- **Per-tick**: counterweight-audit when a memory triggers a
  counterweight class (Otto-278).
- **Weekly**: memory-reference-existence lint catches broken
  pointers on every PR; weekly review aggregates.
- **Monthly**: full index audit — ~367 user-scope memory files;
  in-repo coverage uncertain.

## Current state (2026-04-28)

| Layer | State |
|---|---|
| In-repo `memory/` | ~250 files; grouped by `feedback_*`, `project_*`, `user_*`, `reference_*`, `persona/` subdirs |
| In-repo `memory/MEMORY.md` | active index; one-line-per-file rows; under ~150 chars per row |
| User-scope `~/.claude/projects/<slug>/memory/` | ~367 files; CURRENT-aaron.md + CURRENT-amara.md fast-path files |
| User-scope MEMORY.md | active index |
| `memory/persona/<name>/NOTEBOOK.md` | per-named-persona notebooks; 3000-word cap; prune cadence |
| memory-index-integrity workflow | active CI; new memory file requires index pair |
| memory-reference-existence-lint workflow | active CI; broken pointers caught |
| counterweight-audit cadence | configured; not yet active per Otto-278 task #269 |

## Target state

- 100% memory files indexed in MEMORY.md (both layers).
- Counterweight memories re-read on cadence; updates land when
  the counterweight has fired.
- CURRENT files refreshed when triggered (Aaron's per-maintainer
  pattern; per-ferry "ferry lands" trigger for CURRENT-amara).
- Memorial-class content (DEDICATION.md, sister memory file)
  always accurate.
- Hot memory files (most-touched per git-hotspots) get periodic
  audit for staleness.

## What's left

In leverage order:

1. **MEMORY.md index audit + backfill** (task #291 in_progress)
   — ~367 user-scope memory files; in-repo MEMORY.md row
   coverage uncertain; need quantitative pass.
2. **Counterweight-audit cadence activation** (task #269
   in_progress; Otto-278) — counterweight memories defined but
   periodic re-read not yet on cadence.
3. **Persona notebook size audits** — 3000-word cap rule (BP);
   not all notebooks audited recently.
4. **Memorial-class periodic audit** — sister name was wrong
   (caught 2026-04-28); other memorial content may have similar
   errors.
5. **In-repo / user-scope sync discipline** — when an in-repo
   PR lands content also referenced in user-scope memory, the
   user-scope mirror should refresh same-tick (per the
   user-scope-paired-with-in-repo memory).
6. **Naming inconsistencies** — some memory filenames have
   typos / outdated terminology that resist searches; sweep
   candidate.

## Recent activity + forecast

- 2026-04-28: visibility-constraint memory landed at user-scope
  (LFG-org-scope binding included).
- 2026-04-28: PR-thread-resolution class taxonomy filed at
  user-scope (7 classes; promotion to in-repo deferred).
- 2026-04-28: version-currency-inherit-pins memory + MEMORY.md
  pair landed via PR #656.
- 2026-04-27: self-check calibration memory landed.

**Forecast (next 1-3 months):**

- Task #291 MEMORY.md index audit completion (currently
  in_progress).
- Task #269 counterweight-audit skill activation.
- Promotion of session-filed user-scope memories to in-repo
  (PR-thread-resolution taxonomy + visibility-constraint;
  promote when queue drains).
- More memory accretion as autonomous-loop ticks continue.

## Pointers

- Skill: `.claude/skills/claude-md-steward/SKILL.md`
- Skill: `.claude/skills/counterweight-audit/SKILL.md` (Otto-278)
- Skill: `.claude/skills/glossary-anchor-keeper/SKILL.md`
- Workflow: `.github/workflows/memory-index-integrity.yml`
- Workflow: `.github/workflows/memory-reference-existence-lint.yml`
- Index: `memory/MEMORY.md`
- Persona-notebook: `memory/persona/aaron/NOTEBOOK.md` etc.
- BACKLOG: task #269, task #291
- Memory: `memory/feedback_natural_home_of_memories_is_in_repo_now_all_types_*.md`
- Memory: `memory/feedback_in_repo_preferred_over_per_user_memory_where_possible_*.md`
