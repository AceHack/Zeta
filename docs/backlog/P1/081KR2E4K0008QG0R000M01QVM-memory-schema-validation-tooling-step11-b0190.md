---
id: 081KR2E4K0008QG0R000M01QVM
priority: P1
status: closed
title: Memory schema validation tooling — TS linter enforcing format standard mechanically
tier: foundation
effort: M
ask: 081KQR4HQ0008QG0R001909FPT Step 11 decomposition
created: 2026-05-08
last_updated: 2026-05-09
parent: 081KQR4HQ0008QG0R001909FPT
depends_on: [081KR2E4K0008QG0R002VM58S4]
composes_with: [081KQR4HQ0008QG0R001909FPT, 081KR2E4K0008QG0R002VM58S4, 081KR2E4K0008QG0R003MSVG42]
tags: [memory, validation, tooling, linter, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R000M01QVM — Memory schema validation tooling

## Parent

081KQR4HQ0008QG0R001909FPT Step 11 (memory schema validation tooling).

## What

Build a TS linter/validator (`tools/hygiene/validate-memory-schema.ts`)
that mechanically enforces the format standard defined by 081KR2E4K0008QG0R002VM58S4:

1. **Frontmatter validation** — required fields present, types
   correct, `type:` field matches filename prefix.
2. **Filename convention check** — prefix matches declared type,
   underscore separators, no spaces.
3. **Section header check** — required sections present per type
   (feedback files need `## Why` / `## How to apply`; all
   files need `description:` in frontmatter).
4. **Link integrity** — all `](*.md)` links in body resolve to
   existing files.
5. **MEMORY.md coverage** — every file under `memory/` that
   matches `*_*.md` has an entry in MEMORY.md (and vice versa).

## Why depends on 081KR2E4K0008QG0R002VM58S4

The validator enforces the standard. Without the standard, there
is nothing to validate against.

## Acceptance criteria

1. TS tool committed under `tools/hygiene/`.
2. Tool validates all 5 areas above.
3. `--enforce` flag exits non-zero on any violation.
4. `--fix` flag auto-fixes what it can (frontmatter field order,
   missing fields with defaults).
5. Run against current memory/ reports findings (not necessarily
   zero — the current corpus predates the standard).

## Why M effort

More complex than a single-purpose grep tool. Needs YAML
frontmatter parsing, multi-check pipeline, optional auto-fix.

## Prior art

- `tools/hygiene/audit-memory-references.ts` — link integrity
  pattern.
- `tools/hygiene/audit-memory-index-duplicates.ts` — index
  validation pattern.
- 081KR2E4K0008QG0R002VM58S4 output — the schema to enforce.
