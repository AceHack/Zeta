---
id: 081KR7JY10008QG0R0020PM4AH
priority: P2
status: open
title: "081KR7JY10008QG0R0020PM4AH — Precision anchor translations: extend anchors-en.json to anchors-<lang>.json for first language"
created: 2026-05-10
last_updated: 2026-05-10
parent: 081KQ0YZ80008QG0R002HWBHKJ
depends_on: [081KR7JY10008QG0R0022YWDVZ]
classification: blocked
type: research
effort: S
decomposition: atomic
---

# 081KR7JY10008QG0R0020PM4AH — Precision anchor translations — first language

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)  
**Depends on:** 081KR7JY10008QG0R0022YWDVZ (pilot proves translation quality; anchor translations should be validated against real translated files)

*Note: An initial anchor pass is required as part of 081KR7JY10008QG0R0022YWDVZ to start the pilot. 081KR7JY10008QG0R0020PM4AH formalizes the full anchor set translation and documents its rationale.*

## What

Produce `docs/precision-dictionary/anchors-<lang-code>.json` extending the English anchor set from 081KR50HA0008QG0R002TN3JX2 with:

- Translated term (in target language script).
- Formal definition translation.
- Translation notes: where does the term translate imprecisely? Which concepts have no direct translation? Where should the English term be kept verbatim (e.g., "Z-set", "DBSP", "Otto" persona names)?
- "do-not-translate" flags: inherited from 081KR50HA0008QG0R002TN3JX2 English anchor, now confirmed/updated based on pilot experience.
- Cross-reference to usage in the five P0 translated files.

Validate consistency: every occurrence of each anchor term in the translated P0 files matches the `anchors-<lang>.json` translation exactly (automated check via `bun tools/i18n/anchor-check.ts`).

Also write `tools/i18n/anchor-check.ts` — scans translated files for anchor terms and flags inconsistent renderings.

## Why

Without a formalized per-language anchor translation, the pilot (081KR7JY10008QG0R0022YWDVZ) will have inconsistency in how core precision terms are rendered. 081KQ0YZ80008QG0R002HWBHKJ body: *"Glossary anchoring: precision-dictionary terms must translate consistently across all files in a language."* Otto-286 definitional precision transfers only when anchor terms are stable and documented across languages. The anchor file + consistency checker is the mechanism that makes this measurable.

## Acceptance criteria

1. `docs/precision-dictionary/anchors-<lang-code>.json` committed with ≥50 entries (matching 081KR50HA0008QG0R002TN3JX2 count).
2. `tools/i18n/anchor-check.ts` written and runs in <5s against the P0 translated files.
3. `bun tools/i18n/anchor-check.ts --lang <code>`: 0 inconsistency errors across all P0 translated files.
4. Translation notes document ≥5 terms where translation is imprecise or kept as English verbatim, with rationale.
5. `dotnet build -c Release`: 0 warnings, 0 errors.
6. No `.sh` files (Rule 0).

## Out of scope

- Anchor translations for additional languages (each language gets its own child after its pilot).
- Full precision-dictionary product (081KQ0YZ80008QG0R001QJJTVF adjacent).
- Memory and skill anchor consistency (included in 081KR7JY10008QG0R003YPVJB1 acceptance criteria).
