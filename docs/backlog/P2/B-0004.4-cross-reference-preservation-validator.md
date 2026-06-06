---
id: B-0004.4
zetaid: 081KR7JY10008QG0R000D7JTBB
priority: P2
status: open
title: "B-0004.4 — Cross-reference preservation validator: ensure translated file trees have self-consistent internal links"
created: 2026-05-10
last_updated: 2026-05-10
parent: B-0004
depends_on: [B-0004.1]
classification: buildable-now
type: tooling
effort: S
decomposition: atomic
---

# B-0004.4 — Cross-reference preservation validator

**Slice of:** [B-0004](B-0004-translate-repo-to-other-human-languages.md)  
**Depends on:** B-0004.1 (inventory manifest includes the cross-ref graph for English sources)

## What

Write `tools/i18n/xref-check.ts` (Bun) that:

1. Reads the cross-ref graph from the B-0004.1 inventory manifest.
2. For each translated file tree (`docs/i18n/<lang-code>/`), walks all markdown links.
3. For every internal link in a translated file, checks that the link target resolves either:
   - to the corresponding translated counterpart (preferred), or
   - to the English source file (acceptable fallback, flagged as warning not error).
4. Emits `docs/hygiene-history/i18n-xref-YYYYMMDD.json` with broken/fallback links.
5. Exits non-zero on broken links (links pointing to non-existent paths).

Also validates that memory cross-references within the translated memory tree resolve internally.

## Why

B-0004 body calls this out explicitly: *"when memory file references another memory file, the translated version must reference the translated version (not break cross-refs)."* A translated file that links to untranslated targets is worse than no translation for a monolingual reader: they follow a link and hit English content without warning. The validator makes this a measurable gate.

## Acceptance criteria

1. `bun tools/i18n/xref-check.ts` runs in <3s against an empty `docs/i18n/` directory (no false positives).
2. With a test fixture containing a translated file with a broken internal link, tool flags it and exits non-zero.
3. With a translated file linking to its English counterpart as fallback, tool emits a warning (non-zero exit controlled by `--strict` flag only).
4. `dotnet build -c Release`: 0 warnings, 0 errors.
5. No `.sh` files created (Rule 0).
6. PR body includes: focused check output on test fixtures.

## Out of scope

- Fixing broken cross-references (manual translation task per language pilot).
- Validating external links (out-of-repo URLs).
- GitHub Actions CI wiring (B-0004.5 pipeline ADR decides CI integration).
