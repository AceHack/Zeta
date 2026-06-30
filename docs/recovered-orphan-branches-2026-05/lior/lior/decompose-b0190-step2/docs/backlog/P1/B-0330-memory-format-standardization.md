---
id: B-0330
priority: P1
status: open
title: Memory-format standardization — sister of B-0156 (TS standardization) for memory files
tier: foundation
effort: S
created: 2026-05-14
last_updated: 2026-05-14
depends_on: [B-0190]
tags: [memory, substrate-engineering, formatting, foundation]
type: friction-reducer
---

# B-0330 — Memory-format standardization

## What
Step 2 of the B-0190 Memory substrate-engineering trajectory. Standardize the formatting and structure of memory files across the repository. 

## Requirements
Standardize:
- Frontmatter shape (`name:`, `description:`, `type:`, `originSessionId:` if applicable)
- Filename conventions (`feedback_*` vs `project_*` vs `user_*` vs `reference_*`)
- Section headers (## What this observes, ## Composes with, ## Carved sentence, etc.)
- Composes-with chain integrity (cited files exist; bidirectional)

## Output
Create a `project_memory_format_standard_*.md` memory file (project-policy classification per `memory/README.md` taxonomy).
