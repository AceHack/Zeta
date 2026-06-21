---
name: Memory-file format standard — frontmatter, filenames, section headers, composes-with integrity
description: Canonical format standard for all memory files under memory/. Defines the required and optional frontmatter fields, the filename convention (type-prefix + topic + optional-attribution + optional-date), the recommended section headers per memory type, and the composes-with chain integrity rule. This file is the schema that 081KR2E4K0008QG0R000M01QVM validation tooling enforces mechanically. Consistent with the auto-memory spec in CLAUDE.md. 081KR2E4K0008QG0R002VM58S4 deliverable.
type: project
created: 2026-05-09
---

# Memory-file format standard

This document defines the canonical format for all memory
files under `memory/`. It codifies the conventions that
evolved organically across ~930 files and aligns them with
the auto-memory spec in CLAUDE.md. 081KR2E4K0008QG0R000M01QVM (validation
tooling) enforces this standard mechanically.

## 1 Frontmatter shape

Every memory file MUST begin with a YAML frontmatter block
delimited by `---` lines.

### Required fields

| Field         | Type   | Description |
|---------------|--------|-------------|
| `name:`       | string | Human-readable title. Used for MEMORY.md index entries and agent retrieval. Keep under 200 characters when possible; longer is tolerated for high-context entries. |
| `description:`| string | One-line description used to decide relevance in future conversations. Be specific — this is the retrieval key. |
| `type:`       | enum   | One of: `user`, `feedback`, `project`, `reference`. Must match the filename prefix. |

### Optional fields

| Field             | Type   | Description |
|-------------------|--------|-------------|
| `originSessionId:`| string | UUID of the Claude Code session that created the file. Present in most files created by the auto-memory system. |
| `created:`        | date   | ISO date (`YYYY-MM-DD`) when the file was first committed. Recommended for new files. |
| `last_updated:`   | date   | ISO date (`YYYY-MM-DD`) of the most recent substantive edit. Omit if never updated since creation. |
| `superseded_by:`  | string | Filename (without path) of the memory file that replaces this one. When set, the superseded file is kept for history but agents should prefer the successor. |

### Frontmatter rules

- **No extra fields** beyond the above without a
  governance discussion. The schema is intentionally
  narrow so validation tooling stays simple.
- **`type:` must match filename prefix.** A file named
  `feedback_*.md` must have `type: feedback`.
- **`description:` is the retrieval key.** Write it as if
  a future agent will grep descriptions to decide which
  files to read. Vague descriptions like "project update"
  are a retrieval failure.

## 2 Filename conventions

### Pattern

```
<type-prefix>_<topic>[_<attribution>][_<date>].md
```

### Type prefixes (closed enumeration)

| Prefix       | Maps to `type:` | Description |
|--------------|-----------------|-------------|
| `feedback_`  | `feedback`      | Corrections, confirmations, behavioral guidance from the human maintainer. |
| `project_`   | `project`       | Project-level facts, decisions, initiatives, policy. |
| `user_`      | `user`          | Information about the human maintainer (role, preferences, background). |
| `reference_` | `reference`     | Pointers to external systems and resources. |

### Special files (not type-prefixed)

| Pattern               | Purpose |
|-----------------------|---------|
| `MEMORY.md`           | The always-loaded index. One line per entry, under 150 chars. Capped at ~200 lines. |
| `README.md`           | Memory folder documentation. |
| `MEMORY-AUTHOR-TEMPLATE.md` | Lint-hygiene template for authors. |
| `CURRENT-<name>.md`   | Distilled currently-in-force projection per maintainer or named-agent persona. |
| `INDEX-*.md`          | Overflow indexes when MEMORY.md exceeds 200 lines. |

### Topic segment

- Use `snake_case` (underscores, lowercase).
- Be descriptive enough to identify the content without
  opening the file. Aim for 3-8 words.
- Avoid generic topics like `update` or `note`. The topic
  should distinguish this file from every other file of
  the same type.

### Attribution segment (optional)

- Name of the person or agent whose input is captured:
  `_aaron_`, `_otto_`, `_amara_`, `_claudeai_`.
- Use when the memory captures a specific person's input
  or correction. Omit for project-wide policy that has no
  single author.

### Date segment (optional but recommended)

- Format: `_YYYY_MM_DD` (underscores, not hyphens, to
  match the snake_case filename convention).
- Placed at the end of the filename, before `.md`.
- Recommended for all new files. Existing files without
  dates are not required to be renamed (that is 081KR2E4K0008QG0R003RZFR9F
  scope).

### Filename rules

- Maximum practical length: ~200 characters. Longer
  filenames work on most filesystems but degrade
  readability in `ls` and `git status` output.
- No spaces, no hyphens (use underscores throughout).
- No uppercase in topic/attribution segments
  (special files like `MEMORY.md` and `CURRENT-*.md` are
  exceptions).

## 3 Section headers

### All types — shared structure

Every memory file body (after frontmatter) SHOULD include:

1. **Lead sentence or paragraph** — the rule, fact, or
   observation in plain language. This is what a scanning
   agent reads first.

### Per-type recommended headers

#### `feedback` type

Per the auto-memory `body_structure` spec in CLAUDE.md:
lead with the rule itself, then:

- `**Why:**` — the reason the user gave (often a past
  incident or strong preference).
- `**How to apply:**` — when/where this guidance kicks in.

Optional additional headers:

- `## Composes with` — pointers to related memory files.
- `## Carved sentence` — a single-sentence distillation
  when the rule is important enough to carve.
- `## Full reasoning` — pointer to the memory file or
  docs/research/ file with the complete reasoning chain.

#### `project` type

Per the auto-memory `body_structure` spec in CLAUDE.md:
lead with the fact or decision, then:

- `**Why:**` — the motivation (constraint, deadline,
  stakeholder ask).
- `**How to apply:**` — how this should shape suggestions.

Optional additional headers:

- `## Composes with` — pointers to related memory files.
- `## Full reasoning` — pointer to extended reasoning.

#### `user` type

No prescribed header structure. Lead with the observation
about the user. Include verbatim quotes when available
(signal-in-signal-out discipline per
`feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`).

#### `reference` type

- Lead with what the resource is and where to find it.
- `## When to use` — conditions under which an agent
  should consult this reference.

### Header formatting rules

- Use ATX-style headers (`##`, not setext underlines) per
  MD003.
- No trailing punctuation in headers per MD026.
- Blank lines above and below headers per MD022.
- Bold-text pseudo-headers (`**Why:**`) are acceptable
  inline as the auto-memory spec uses them. They are NOT
  markdown headers and do not need blank-line padding, but
  a blank line before them improves readability.
- See `MEMORY-AUTHOR-TEMPLATE.md` for the five
  absorb-time lint classes.

## 4 Composes-with chain integrity

When a memory file references other memory files (via
`## Composes with`, inline mentions, or `## Full reasoning`
pointers):

- **Cited files must exist.** A pointer to a deleted or
  renamed file is a broken link. Check before committing.
- **Prefer bidirectional links.** If file A says "composes
  with file B," file B should mention file A in its own
  composes-with or body text when the relationship is
  substantive.
- **Use filenames, not paths.** Memory files all live under
  `memory/`; use `feedback_example.md` not
  `memory/feedback_example.md` in cross-references within
  the memory folder.
- **Supersession chains.** When `superseded_by:` is set,
  the successor file should mention the predecessor in its
  body. Supersession is not deletion — the old file stays
  for history.

## 5 MEMORY.md index entries

Each entry in `MEMORY.md` follows the pattern:

```markdown
- [Title](filename.md) — one-line hook
```

- Under 150 characters per line.
- Newest entries at the top (newest-first ordering per
  `README.md`).
- The title should match or abbreviate the `name:` field.
- The hook should be distinct enough to decide relevance
  without reading the file.

**Heap-state-acceptable (081KRCQQF0008QG0R0037YYP1A):** a new memory file does **not**
require a same-PR MEMORY.md paired-edit. Files without an index
entry are in **heap** state — valid and accessible by direct path.
`tools/memory/reindex-memory-md.ts` promotes heap files to the
stack view on cadence (called from the autonomous-loop tick).
Agents may run it manually:
`bun src/Core.TypeScript/memory/reindex-memory-md.ts`

## 6 Validation smoke check

Three existing files validated against this standard:

### 6.1 `feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`

- Frontmatter: `name` present, `description` present,
  `type: feedback` present, `originSessionId` present.
  **PASS.**
- Filename: `feedback_` prefix matches `type: feedback`.
  No date suffix (pre-standard; acceptable). **PASS.**
- Section headers: Leads with bold-text migrated note,
  then body text. No explicit `**Why:**` / `**How to
  apply:**` structure. **ADVISORY** — predates the
  body_structure spec.
- Composes-with: References other files inline. Files
  exist. **PASS.**

### 6.2 `project_aaron_drop_zone_protocol_2026_04_22.md`

- Frontmatter: `name` present, `description` present,
  `type: project` present. No `originSessionId`.
  **PASS** (optional field).
- Filename: `project_` prefix matches `type: project`.
  Date suffix `_2026_04_22` present. Attribution `_aaron_`
  present. **PASS.**
- Section headers: Uses `## The grant`, custom headers.
  No explicit `**Why:**` / `**How to apply:**`. **ADVISORY.**
- Composes-with: No explicit composes-with section.
  **PASS** (not required).

### 6.3 `reference_automemory_anthropic_feature.md`

- Frontmatter: `name` present, `description` present,
  `type: reference` present, `originSessionId` present.
  **PASS.**
- Filename: `reference_` prefix matches `type: reference`.
  No date suffix. **PASS.**
- Section headers: Uses `## What AutoMemory is` — clear
  and descriptive. **PASS.**
- Composes-with: References `reference_autodream_feature.md`
  in description. File exists. **PASS.**

### 6.4 Heap-state validation (081KRCQQF0008QG0R0037YYP1A)

Under the heap-state-acceptable model, a memory file does not
require a MEMORY.md paired-edit. The reindexer
(`tools/memory/reindex-memory-md.ts`) only skips files with **no
frontmatter block at all**. Files with frontmatter but missing
individual fields fall back to safe defaults rather than being
skipped:

| Field | Behavior when missing | 081KR2E4K0008QG0R000M01QVM enforcement |
|---|---|---|
| `name:` | Falls back to filename (without `.md`) | Error — enforced |
| `description:` | Falls back to `"(no description)"` | Error — enforced |
| `type:` | Not used by reindexer; 081KR2E4K0008QG0R000M01QVM `--fix` auto-infers from filename prefix | Error — enforced |
| `created:` | Falls back to date extracted from filename, or `"0000-00-00"` | Not enforced by 081KR2E4K0008QG0R000M01QVM |

Best practice: include all four fields so the index entry is
useful. Files with missing `name`, `description`, or `type`
will be flagged as errors by 081KR2E4K0008QG0R000M01QVM validation
(`tools/hygiene/validate-memory-schema.ts --enforce`). The
`created` field is not yet mechanically enforced but strongly
recommended for correct newest-first sort order.

## 7 Scope and boundaries

- This standard defines the FORMAT. It does not require
  rewriting existing files (that is 081KR2E4K0008QG0R003RZFR9F scope).
- New memory files SHOULD conform. Existing files are
  conformant if they meet the required-fields check; the
  recommended headers are advisory for existing files.
- 081KR2E4K0008QG0R000M01QVM validation tooling enforces the required fields
  and filename-prefix-matches-type rule mechanically.
