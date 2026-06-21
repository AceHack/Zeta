---
id: 081KR7JY10008QG0R003YPVJB1
priority: P2
status: open
title: "081KR7JY10008QG0R003YPVJB1 — Memory + skills translation — first language (second deployment tier)"
created: 2026-05-10
last_updated: 2026-05-10
parent: 081KQ0YZ80008QG0R002HWBHKJ
depends_on: [081KR7JY10008QG0R0022YWDVZ, 081KR7JY10008QG0R0020PM4AH]
classification: blocked
type: feature
effort: M
decomposition: atomic
---

# 081KR7JY10008QG0R003YPVJB1 — Memory + skills translation — first language

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)  
**Depends on:** 081KR7JY10008QG0R0022YWDVZ (P0 substrate pilot validates the full infrastructure), 081KR7JY10008QG0R0020PM4AH (anchor translations consistent)

## What

Translate the second deployment tier per Otto-291 ordering (substrate root → memory canonical → skill bodies):

**Memory files** (`memory/*.md`) — canonical entries (non-persona-specific):

- `MEMORY.md` index → `docs/i18n/<lang-code>/memory/MEMORY.md`
- All `memory/feedback_*.md`, `memory/user_*.md`, `memory/project_*.md`, `memory/reference_*.md`

**Skill bodies** (`.claude/skills/**/SKILL.md` procedure sections):

- Translate each skill's body content; preserve frontmatter keys in English (they are machine-read).
- Translated skills land under `docs/i18n/<lang-code>/skills/<skill-name>/SKILL.md`.

Use `bun tools/i18n/translate.ts` from 081KR7JY10008QG0R002YZBE5A, with the anchor consistency checker from 081KR7JY10008QG0R0020PM4AH running as a gate.

Validate:

- `bun tools/i18n/xref-check.ts --lang <code>` — memory cross-references resolve within the translated tree.
- `bun tools/i18n/drift-check.ts --lang <code>` — all translated files fresh.
- `bun tools/i18n/anchor-check.ts --lang <code>` — anchor terms consistent.

## Why

Per Otto-291 and 081KQ0YZ80008QG0R002HWBHKJ body: *"substrate root first → memory canonical entries → skill bodies."* Memory files are the factory's earned knowledge substrate; skills encode the factory's procedures. Together with the P0 files, these are the resources a new non-English contributor would need to onboard without English fallback — the 081KQ0YZ80008QG0R002HWBHKJ acceptance signal for "a native speaker can absorb the substrate without English fallback."

## Acceptance criteria

1. All `memory/*.md` files translated and committed under `docs/i18n/<lang-code>/memory/`.
2. All `.claude/skills/**/SKILL.md` body sections translated and committed under `docs/i18n/<lang-code>/skills/`.
3. `bun tools/i18n/xref-check.ts --lang <code>`: 0 broken links in memory translated tree.
4. `bun tools/i18n/drift-check.ts --lang <code>`: 0 stale translated files.
5. `bun tools/i18n/anchor-check.ts --lang <code>`: 0 anchor inconsistencies across memory + skills files.
6. Persona-specific memory notebooks (if any exist): translate headers and section titles; flag body content as requiring persona-aware review.
7. `dotnet build -c Release`: 0 warnings, 0 errors.

## Out of scope

- Code comment translation (081KR7JY10008QG0R001XQ6N71).
- External-facing surfaces (NuGet, GitHub description) — 081KR7JY10008QG0R002VN6707.
- Backlog rows translation (very large surface; separate future child after process is stable).
- Second language (081KR7JY10008QG0R00016GT9R).
