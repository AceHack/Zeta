---
name: Keep maintainer's name out of non-memory files
description: In VISION.md, AGENTS.md, CLAUDE.md, skill files, ADRs, docs/, code comments — say "the human maintainer" not "Aaron". Memory folder + BACKLOG + per-persona notebooks + HUMAN-BACKLOG row schema are exempt.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Keep the maintainer's personal name (Aaron) out of most files
in the repo. Use "the human maintainer" or "the maintainer"
instead. Exempt surfaces:

- the auto-memory folder at `/Users/acehack/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`
- `docs/BACKLOG.md`
- per-persona notebooks under `memory/persona/`
- (added 2026-04-21) the `For:` column and per-addressee sub-table
  headers (`### For: Aaron`, etc.) in `docs/HUMAN-BACKLOG.md`,
  plus direct quotations in the `Source` / `Ask` fields where
  redaction would lose evidential value. Prose *outside* the
  row schema in that file still uses role-refs. Carve-out is
  documented in-file under "Name attribution — explicit
  carve-out" and is driven by Aaron's 2026-04-20 directive
  *"can you put my tasks at the top of the human backlog i
  don't want to have to go digging through it to find my tasks"*,
  which intrinsically needs name-based sub-tables to work.

**Why:** the repo is a public-facing research artifact —
personal names shouldn't tile the codebase. The memory folder
is the agent's private notebook, so names are fine there; the
backlog and persona notebooks are scratch/working surfaces
where names already appear and aren't worth aggressively
redacting.

**How to apply:** when writing new content in VISION.md,
AGENTS.md, CLAUDE.md, any `.claude/skills/**/SKILL.md`, any
file under `docs/`, or code-level comments, default to "the
human maintainer" or "the maintainer". If quoting the
maintainer directly, attribute as "the human maintainer,
round N: ...". Pre-existing references in the file (the
VISION.md header "Aaron is the source of truth" lore line,
for instance) are not my scope to rewrite unless the
maintainer explicitly asks — just don't add new ones.
