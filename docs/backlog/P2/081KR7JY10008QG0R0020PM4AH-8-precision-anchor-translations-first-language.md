---
id: B-0004.8
zetaid: 081KR7JY10008QG0R0020PM4AH
priority: P2
status: open
title: "B-0004.8 — Precision anchor translations: extend anchors-en.json to anchors-<lang>.json for first language"
created: 2026-05-10
last_updated: 2026-05-10
parent: B-0004
depends_on: [B-0004.7]
classification: blocked
type: research
effort: S
decomposition: atomic
---

# B-0004.8 — Precision anchor translations — first language

**Slice of:** [B-0004](B-0004-translate-repo-to-other-human-languages.md)  
**Depends on:** B-0004.7 (pilot proves translation quality; anchor translations should be validated against real translated files)

*Note: An initial anchor pass is required as part of B-0004.7 to start the pilot. B-0004.8 formalizes the full anchor set translation and documents its rationale.*

## What

Produce `docs/precision-dictionary/anchors-<lang-code>.json` extending the English anchor set from B-0004.2 with:

- Translated term (in target language script).
- Formal definition translation.
- Translation notes: where does the term translate imprecisely? Which concepts have no direct translation? Where should the English term be kept verbatim (e.g., "Z-set", "DBSP", "Otto" persona names)?
- "do-not-translate" flags: inherited from B-0004.2 English anchor, now confirmed/updated based on pilot experience.
- Cross-reference to usage in the five P0 translated files.

Validate consistency: every occurrence of each anchor term in the translated P0 files matches the `anchors-<lang>.json` translation exactly (automated check via `bun tools/i18n/anchor-check.ts`).

Also write `tools/i18n/anchor-check.ts` — scans translated files for anchor terms and flags inconsistent renderings.

## Why

Without a formalized per-language anchor translation, the pilot (B-0004.7) will have inconsistency in how core precision terms are rendered. B-0004 body: *"Glossary anchoring: precision-dictionary terms must translate consistently across all files in a language."* Otto-286 definitional precision transfers only when anchor terms are stable and documented across languages. The anchor file + consistency checker is the mechanism that makes this measurable.

## Acceptance criteria

1. `docs/precision-dictionary/anchors-<lang-code>.json` committed with ≥50 entries (matching B-0004.2 count).
2. `tools/i18n/anchor-check.ts` written and runs in <5s against the P0 translated files.
3. `bun tools/i18n/anchor-check.ts --lang <code>`: 0 inconsistency errors across all P0 translated files.
4. Translation notes document ≥5 terms where translation is imprecise or kept as English verbatim, with rationale.
5. `dotnet build -c Release`: 0 warnings, 0 errors.
6. No `.sh` files (Rule 0).

## Out of scope

- Anchor translations for additional languages (each language gets its own child after its pilot).
- Full precision-dictionary product (B-0003 adjacent).
- Memory and skill anchor consistency (included in B-0004.9 acceptance criteria).
