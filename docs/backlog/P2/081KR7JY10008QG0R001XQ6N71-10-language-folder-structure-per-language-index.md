---
id: 081KR7JY10008QG0R001XQ6N71
priority: P2
status: open
title: "081KR7JY10008QG0R001XQ6N71 — Language folder structure formalization + per-language contributor index"
created: 2026-05-10
last_updated: 2026-05-10
parent: 081KQ0YZ80008QG0R002HWBHKJ
depends_on: [081KR7JY10008QG0R0022YWDVZ]
classification: blocked
type: tooling
effort: XS
decomposition: atomic
---

# 081KR7JY10008QG0R001XQ6N71 — Language folder structure formalization + per-language index

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)  
**Depends on:** 081KR7JY10008QG0R0022YWDVZ (pilot shows what the structure actually looks like in practice before formalizing)

## What

After the first language pilot demonstrates the real directory layout, formalize it so adding subsequent languages is mechanical:

1. **Canonical folder spec** — write `docs/i18n/STRUCTURE.md`:
   - `docs/i18n/<BCP-47-lang-code>/` root per language.
   - Sub-directories mirror the English source tree: `docs/i18n/<code>/docs/`, `docs/i18n/<code>/memory/`, `docs/i18n/<code>/skills/`.
   - Per-language `README.md` template (language name, BCP-47 code, translation provenance, maintainer contact, anchor version used, last drift-check timestamp).
   - Invariants: English sources are canonical; translated files are derived artifacts; translations never modify English sources.

2. **Per-language index generator** — `tools/i18n/gen-index.ts` (Bun):
   - Reads inventory manifest + existing `docs/i18n/` language dirs.
   - Generates a `docs/i18n/INDEX.md` listing all present languages with translation coverage percentage (translated file count / total inventoried files) and last updated timestamp.

3. **CONTRIBUTING addition** — append a "Translation contributions" section to `CONTRIBUTING.md` pointing at `docs/i18n/STRUCTURE.md` and the 081KR7JY10008QG0R003SATDK8 community outreach channel.

## Why

Without a formalized structure, each subsequent language pilot would make ad-hoc directory choices that diverge. The index generator gives both maintainers and users a quick coverage view. The CONTRIBUTING addition ensures the structure is discoverable for volunteer translators who arrive via GitHub, not just via internal backlog tracking.

## Acceptance criteria

1. `docs/i18n/STRUCTURE.md` committed with canonical folder spec and per-language README template.
2. `tools/i18n/gen-index.ts` runs in <3s and produces a valid `docs/i18n/INDEX.md` listing the first-language pilot with correct coverage percentage.
3. `CONTRIBUTING.md` updated with "Translation contributions" section (≤10 lines).
4. `dotnet build -c Release`: 0 warnings, 0 errors.
5. No `.sh` files (Rule 0).
6. PR body: index output pasted, structure doc linked.

## Out of scope

- Memory/skills sub-directory formalization for languages beyond first pilot (081KR7JY10008QG0R003YPVJB1 already established the pattern).
- Any changes to how drift-check or xref-check work (they already use the i18n folder structure from the pilot).
