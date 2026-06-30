---
id: B-0330
priority: P1
status: open
title: "Memory-format standardization"
created: 2026-05-28
last_updated: 2026-05-28
parent: B-0190
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [lior]
type: documentation
---

# B-0330 — Memory-format standardization

This task implements Step 2 of the Memory Substrate Engineering Trajectory (B-0190). It establishes a formal standard for the format of memory files.

## Scope

This task involves creating a new project-policy memory file that documents the standard for:
- Frontmatter shape (`name:`, `description:`, `type:`, etc.)
- Filename conventions (`feedback_*`, `project_*`, `user_*`, `reference_*`)
- Section headers (`## What this observes`, `## Composes with`, etc.)

## Acceptance Criteria

- A new memory file `memory/project_memory_format_standard.md` is created.
- The file documents the standard format for memory files.
- The file itself adheres to the standard it defines.
