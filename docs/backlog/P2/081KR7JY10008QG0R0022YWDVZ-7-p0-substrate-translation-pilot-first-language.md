---
id: 081KR7JY10008QG0R0022YWDVZ
priority: P2
status: open
title: "081KR7JY10008QG0R0022YWDVZ — P0 substrate translation pilot: translate CLAUDE/AGENTS/ALIGNMENT/GOVERNANCE/VISION into first chosen language"
created: 2026-05-10
last_updated: 2026-05-10
parent: 081KQ0YZ80008QG0R002HWBHKJ
depends_on: [081KR7JY10008QG0R002YZBE5A, 081KR7JY10008QG0R003SATDK8]
classification: blocked
type: feature
effort: M
decomposition: atomic
---

# 081KR7JY10008QG0R0022YWDVZ — P0 substrate translation pilot — first language

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)  
**Depends on:** 081KR7JY10008QG0R002YZBE5A (pipeline ready), 081KR7JY10008QG0R003SATDK8 (language chosen)  
**Blocked until:** 081KR7JY10008QG0R000EGAPAN + 081KR7JY10008QG0R000D7JTBB are also complete (drift lint + xref validator needed before any translation ships)

## What

Translate the five P0 substrate files using the approved pipeline from 081KR7JY10008QG0R002YZBE5A:

- `CLAUDE.md` → `docs/i18n/<lang-code>/CLAUDE.md`
- `AGENTS.md` → `docs/i18n/<lang-code>/AGENTS.md`
- `docs/ALIGNMENT.md` → `docs/i18n/<lang-code>/ALIGNMENT.md`
- `GOVERNANCE.md` → `docs/i18n/<lang-code>/GOVERNANCE.md`
- `docs/VISION.md` → `docs/i18n/<lang-code>/VISION.md`

Using the precision anchor translations from 081KR7JY10008QG0R0020PM4AH (or an initial anchor pass if 081KR7JY10008QG0R0020PM4AH is not yet complete).

Validate with:

- `bun tools/i18n/drift-check.ts` — must show all 5 files as fresh.
- `bun tools/i18n/xref-check.ts` — must show 0 broken links (cross-refs may fall back to English sources on first pass, flagged as warnings, not errors).
- Native-speaker spot-check (at least 20 random lines reviewed per file by a community volunteer per 081KR7JY10008QG0R003SATDK8 outreach plan).

## Why

The first acceptance signal from 081KQ0YZ80008QG0R002HWBHKJ is: *"All P0 substrate files (CLAUDE / AGENTS / ALIGNMENT) are translated + cross-reference-stable."* This is the smallest end-to-end pilot that proves the full infrastructure (inventory → anchor → pipeline → drift lint → xref validator → native review) actually works as a system. Per Otto-291 deployment discipline, shipping one small payload before expanding to memory + skills is the correct pace.

## Acceptance criteria

1. Five translated files committed under `docs/i18n/<lang-code>/`.
2. `bun tools/i18n/drift-check.ts --lang <code>`: 0 stale entries.
3. `bun tools/i18n/xref-check.ts --lang <code>`: 0 broken links (warnings for English fallbacks acceptable).
4. Precision anchor terms from 081KR50HA0008QG0R002TN3JX2 are consistent across all 5 files (automated check or manual spot-check documented).
5. Native-speaker review documented in PR body (reviewer handle, lines reviewed, issues found and addressed).
6. `dotnet build -c Release`: 0 warnings, 0 errors.
7. A brief per-language README committed at `docs/i18n/<lang-code>/README.md` linking back to English sources and documenting the translation provenance (model used, review date, anchor version).

## Out of scope

- Memory, skills, backlog, code comment translation (081KR7JY10008QG0R003YPVJB1).
- External-facing surfaces (NuGet, GitHub description) — 081KR7JY10008QG0R002VN6707.
- Precision anchor language file (081KR7JY10008QG0R0020PM4AH — can land in parallel or just before).
- Second language (081KR7JY10008QG0R00016GT9R).
