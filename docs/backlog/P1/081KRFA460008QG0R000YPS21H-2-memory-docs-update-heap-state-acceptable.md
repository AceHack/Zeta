---
id: 081KRFA460008QG0R000YPS21H
priority: P1
class: substrate-architecture
status: closed
closed: 2026-05-13
closed_by: "implemented in PR #2992 (5de7f82f)"
title: Update memory/ documentation to describe heap-state-acceptable model
created: 2026-05-13
last_updated: 2026-05-13
parent: 081KRCQQF0008QG0R0037YYP1A
depends_on: []
composes_with: [081KRCQQF0008QG0R0037YYP1A, 081KRFA460008QG0R0006Q6BWP]
effort: XS
tier: documentation
authors: [otto]
---

# 081KRFA460008QG0R000YPS21H — Update memory/ docs for heap-state-acceptable model

## Carved sentence

> `memory/README.md` and `memory/project_memory_format_standard.md`
> still describe the old synchronous paired-edit requirement. Update
> both to document the heap-state model so future agents author memory
> files correctly under the new architecture.

## Context

Two documents still require the old paired-edit discipline:

1. **`memory/README.md`** — the "Agents writing memories — full
   freedom" section says "Update MEMORY.md to include new entries at
   the top (newest-first)." This implies synchronous paired edit.

2. **`memory/project_memory_format_standard.md` Section 5** —
   "MEMORY.md index entries" describes the paired-edit format
   and ordering convention without acknowledging that heap-state
   (no paired edit) is now acceptable.

Until these documents are updated, future agents cold-booting will
follow the old discipline, defeating the 081KRCQQF0008QG0R0037YYP1A architectural fix.

## Acceptance criteria

### `memory/README.md` changes

- [ ] "Agents writing memories" section: replace paired-edit
  instruction with heap-state model:
  - New memory files MUST have valid frontmatter (name, description,
    type, created fields).
  - A synchronous MEMORY.md paired-edit is **no longer required**.
  - MEMORY.md is kept current by `tools/memory/reindex-memory-md.ts`
    running on cadence (called from the autonomous-loop tick).
  - Agents MAY run `bun tools/memory/reindex-memory-md.ts` manually
    to promote heap files to the stack view immediately.
- [ ] Add "Stack-vs-heap model" subsection linking to 081KRCQQF0008QG0R0037YYP1A and the
  MEMORY.md preamble that already explains the framing.

### `memory/project_memory_format_standard.md` changes

- [ ] Section 5 "MEMORY.md index entries": add note that
  heap-state-acceptable means a new memory file does NOT require a
  same-PR MEMORY.md paired edit. The reindexer will pick it up on
  the next cadence run.
- [ ] Add a "6.N Heap-state validation" section: agents validate that
  their new memory file has the required frontmatter fields; the
  reindexer contract requires `name:`, `description:`, `type:`, and
  `created:`.

## Implementation notes

Purely documentation changes. No code changes. Does not require
081KRFA460008QG0R0006Q6BWP (tests) to land first — the docs can be correct before
the tests are extended.

This slice produces no CI checks to pass beyond `dotnet build`
and lint. Markdownlint (`MD003`, `MD022`, `MD026`) must be clean
— run `bunx markdownlint-cli2 memory/README.md memory/project_memory_format_standard.md`
before commit to verify.

## Why P1

If the documentation stays stale, future agents will continue
adding synchronous paired edits (increasing merge conflicts),
defeating the architectural fix. This slice makes the new contract
visible at cold-boot.

## Composes with

- 081KRCQQF0008QG0R0037YYP1A (parent; this is slice 2 of 5)
- 081KRFA460008QG0R0006Q6BWP (tests; independent, can land in parallel)
- 081KRFA460008QG0R0035NKRHG (CI relaxation; docs should describe the contract
  before CI stops enforcing the old one)
