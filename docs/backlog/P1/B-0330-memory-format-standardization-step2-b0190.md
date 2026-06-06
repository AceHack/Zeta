---
id: B-0330
zetaid: 081KR2E4K0008QG0R002VM58S4
priority: P1
status: closed
title: Memory-format standardization — define frontmatter shape, filename conventions, section headers
tier: foundation
effort: S
ask: B-0190 Step 2 decomposition
created: 2026-05-08
last_updated: 2026-05-09
parent: B-0190
depends_on: []
composes_with: [B-0190, B-0331, B-0334, B-0335, B-0338]
tags: [memory, format, standardization, foundation, trajectory-child]
type: friction-reducer
---

# B-0330 — Memory-format standardization

## Parent

B-0190 Step 2 (memory-format standardization).

## What

Define the canonical memory-file format as a project-policy
memory file. Standardize:

1. **Frontmatter shape** — required fields (`name:`,
   `description:`, `type:`), optional fields
   (`originSessionId:`, `superseded_by:`, `created:`,
   `last_updated:`).
2. **Filename conventions** — `feedback_*` vs `project_*` vs
   `user_*` vs `reference_*` prefix taxonomy, underscore
   separators, date suffix pattern.
3. **Section headers** — `## What this observes`,
   `## Composes with`, `## Carved sentence`, `## Why` /
   `## How to apply` (per the auto-memory body_structure
   spec in CLAUDE.md).
4. **Composes-with chain integrity** — cited files must exist;
   links should be bidirectional.

## Output

A `memory/project_memory_format_standard.md` file (project-policy
classification per `memory/README.md` taxonomy). This file becomes
the schema that B-0335 (validation tooling) enforces mechanically.

## Acceptance criteria

1. Format standard file committed under `memory/`.
2. Standard covers all four areas above.
3. Standard is consistent with existing auto-memory frontmatter
   spec in CLAUDE.md.
4. At least 3 existing memory files validated against the
   standard as a smoke check.

## Why S effort

Defines a standard; does not rewrite existing files. The
reclassification work is B-0331.

## Prior art

- `memory/README.md` — existing taxonomy description.
- `memory/MEMORY-AUTHOR-TEMPLATE.md` — existing template.
- CLAUDE.md auto-memory section — frontmatter + body_structure
  specs per type.
