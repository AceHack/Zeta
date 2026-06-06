---
id: B-0004.7
zetaid: 081KR7JY10008QG0R0022YWDVZ
priority: P2
status: open
title: "B-0004.7 — P0 substrate translation pilot: translate CLAUDE/AGENTS/ALIGNMENT/GOVERNANCE/VISION into first chosen language"
created: 2026-05-10
last_updated: 2026-05-10
parent: B-0004
depends_on: [B-0004.5, B-0004.6]
classification: blocked
type: feature
effort: M
decomposition: atomic
---

# B-0004.7 — P0 substrate translation pilot — first language

**Slice of:** [B-0004](B-0004-translate-repo-to-other-human-languages.md)  
**Depends on:** B-0004.5 (pipeline ready), B-0004.6 (language chosen)  
**Blocked until:** B-0004.3 + B-0004.4 are also complete (drift lint + xref validator needed before any translation ships)

## What

Translate the five P0 substrate files using the approved pipeline from B-0004.5:

- `CLAUDE.md` → `docs/i18n/<lang-code>/CLAUDE.md`
- `AGENTS.md` → `docs/i18n/<lang-code>/AGENTS.md`
- `docs/ALIGNMENT.md` → `docs/i18n/<lang-code>/ALIGNMENT.md`
- `GOVERNANCE.md` → `docs/i18n/<lang-code>/GOVERNANCE.md`
- `docs/VISION.md` → `docs/i18n/<lang-code>/VISION.md`

Using the precision anchor translations from B-0004.8 (or an initial anchor pass if B-0004.8 is not yet complete).

Validate with:

- `bun tools/i18n/drift-check.ts` — must show all 5 files as fresh.
- `bun tools/i18n/xref-check.ts` — must show 0 broken links (cross-refs may fall back to English sources on first pass, flagged as warnings, not errors).
- Native-speaker spot-check (at least 20 random lines reviewed per file by a community volunteer per B-0004.6 outreach plan).

## Why

The first acceptance signal from B-0004 is: *"All P0 substrate files (CLAUDE / AGENTS / ALIGNMENT) are translated + cross-reference-stable."* This is the smallest end-to-end pilot that proves the full infrastructure (inventory → anchor → pipeline → drift lint → xref validator → native review) actually works as a system. Per Otto-291 deployment discipline, shipping one small payload before expanding to memory + skills is the correct pace.

## Acceptance criteria

1. Five translated files committed under `docs/i18n/<lang-code>/`.
2. `bun tools/i18n/drift-check.ts --lang <code>`: 0 stale entries.
3. `bun tools/i18n/xref-check.ts --lang <code>`: 0 broken links (warnings for English fallbacks acceptable).
4. Precision anchor terms from B-0004.2 are consistent across all 5 files (automated check or manual spot-check documented).
5. Native-speaker review documented in PR body (reviewer handle, lines reviewed, issues found and addressed).
6. `dotnet build -c Release`: 0 warnings, 0 errors.
7. A brief per-language README committed at `docs/i18n/<lang-code>/README.md` linking back to English sources and documenting the translation provenance (model used, review date, anchor version).

## Out of scope

- Memory, skills, backlog, code comment translation (B-0004.9).
- External-facing surfaces (NuGet, GitHub description) — B-0004.11.
- Precision anchor language file (B-0004.8 — can land in parallel or just before).
- Second language (B-0004.12).
