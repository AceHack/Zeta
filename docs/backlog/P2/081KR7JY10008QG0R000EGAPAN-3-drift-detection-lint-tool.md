---
id: 081KR7JY10008QG0R000EGAPAN
priority: P2
status: open
title: "081KR7JY10008QG0R000EGAPAN — Drift-detection lint tool: flag stale translations when English source changes"
created: 2026-05-10
last_updated: 2026-05-10
parent: 081KQ0YZ80008QG0R002HWBHKJ
depends_on: [081KR50HA0008QG0R000YTJE8Q]
classification: buildable-now
type: tooling
effort: S
decomposition: atomic
---

# 081KR7JY10008QG0R000EGAPAN — Drift-detection lint tool

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)  
**Depends on:** 081KR50HA0008QG0R000YTJE8Q (inventory manifest provides the surface map and cross-ref graph)

## What

Write `tools/i18n/drift-check.ts` (Bun) that:

1. Reads the inventory manifest from 081KR50HA0008QG0R000YTJE8Q (`docs/hygiene-history/i18n-inventory-YYYYMMDD.json`).
2. For each English source file that has a translated counterpart under `docs/i18n/<lang-code>/`, compares content hashes or `git log --format=%H -1` modification epochs.
3. Emits a `docs/hygiene-history/i18n-drift-YYYYMMDD.json` report listing stale translations (English source changed after translated version was last updated).
4. Exits non-zero when any translation is stale (CI-wirable).

Support `--lang <code>` flag to check a single language; default checks all present language directories.

## Why

081KQ0YZ80008QG0R002HWBHKJ explicitly calls out drift detection as owed tooling: *"when English source changes, translations need updating; need a lint that flags stale translations."* Without it, translations silently diverge from the English source. Per the deployment discipline (Otto-291), retractability requires knowing *which* translations need refreshing.

## Acceptance criteria

1. `bun tools/i18n/drift-check.ts` runs in <3s on a repo with 0 translated files (no false positives on empty language dirs).
2. With a synthetic stale translation injected (test fixture), tool emits the stale entry in JSON and exits non-zero.
3. `dotnet build -c Release`: 0 warnings, 0 errors.
4. No `.sh` files created (Rule 0).
5. PR body includes focused check: tool executed against test fixture, drift report JSON pasted.

## Out of scope

- Triggering automatic re-translation (later pipeline child 081KR7JY10008QG0R002YZBE5A).
- GitHub Actions CI wiring (can be added when first pilot lands).
- Checking memory cross-reference consistency (081KR7JY10008QG0R000D7JTBB).
