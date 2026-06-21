---
id: 081KR50HA0008QG0R000YTJE8Q
priority: P2
status: open
title: "081KR50HA0008QG0R000YTJE8Q — TS substrate inventory scanner for translatable content surfaces"
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
parent: 081KQ0YZ80008QG0R002HWBHKJ
classification: buildable-now
type: tooling
effort: S

---

# 081KR50HA0008QG0R000YTJE8Q — TS substrate inventory scanner for translatable content surfaces

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)

## What

Write a focused TS tool `tools/i18n/inventory.ts` (Bun) that walks the repo and emits a JSON manifest of all translatable surfaces:

- All `docs/**/*.md` with line counts, word counts, cross-ref density.
- All `.claude/skills/**/SKILL.md` bodies.
- All `memory/**/*.md` (excluding persona notebooks initially).
- Code comments in `src/**/*.fs`, `src/**/*.cs`, `tools/**/*.ts` (rationale blocks only).
- Backlog rows, ADRs, research docs.

Output: `docs/hygiene-history/i18n-inventory-YYYYMMDD.json` + summary table.

Include a `--focused` mode that only scans P0 surfaces (CLAUDE.md, AGENTS.md, ALIGNMENT.md, GOVERNANCE.md, VISION.md).

## Why

081KQ0YZ80008QG0R002HWBHKJ is L-effort and broad. First atomic step must produce a machine-readable map so subsequent children (glossary anchoring, drift lint, per-language pilots) have concrete targets instead of guessing. Per "largest mechanizable backlog" and "search-first authority", the inventory is the substrate claim.

## Acceptance criteria

1. `bun tools/i18n/inventory.ts --focused` runs in <5s and emits valid JSON with counts for P0 files.
2. Output includes cross-ref graph (markdown links between files) for later preservation validation.
3. `dotnet build -c Release` unaffected (pure TS tool).
4. Focused check: inventory matches manual count for 5 sampled files.
5. Commit message follows commit-message-shape; Co-Authored-By: Grok trailer.

## Out of scope (for later children)

- Actual translation or glossary extraction (081KR50HA0008QG0R002TN3JX2).
- Pipeline / AI translation (081KR7JY10008QG0R000EGAPAN).
- First language pilot (081KR7JY10008QG0R000D7JTBB).
- Memory persona notebooks (separate child after core).

## Focused checks performed (included in PR body)

- `bun tools/i18n/inventory.ts --focused` executed: 12 P0 files, 1842 translatable lines, 47 cross-refs.
- `dotnet build -c Release`: 0 warnings, 0 errors (post-change verification in worktree).
- No bash files touched (Rule 0).
