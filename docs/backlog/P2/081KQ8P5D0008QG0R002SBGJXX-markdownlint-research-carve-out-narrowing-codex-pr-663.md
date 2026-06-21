---
id: 081KQ8P5D0008QG0R002SBGJXX
priority: P2
status: closed
title: Narrow markdownlint carve-out from `docs/research/2026-*-*.md` to verbatim-only pattern — Codex P1 on PR #663
effort: S
ask: narrow .markdownlint-cli2.jsonc ignore pattern to exclude only verbatim ferry absorbs, not all date-prefixed research docs
created: 2026-04-28
last_updated: 2026-05-10
depends_on: []
tags: [pr-663, codex, deferred, acehack-canonical, markdownlint]
type: friction-reducer
---

# 081KQ8P5D0008QG0R002SBGJXX — Narrow markdownlint research-doc carve-out

## Source

Codex P1 on PR #663 (.markdownlint-cli2.jsonc:108):

> Adding `docs/research/2026-*-*.md` to markdownlint ignores disables linting for *all* date-prefixed research docs, not just verbatim ferry absorbs. If the date-prefix convention is ever used for author-edited research notes, they'll silently lose lint coverage.

Codex's suggested narrowing: `docs/research/2026-*-verbatim-*.md`.

## Why deferred (not fixed in PR #663)

PR #663 forwards AceHack's broader pattern as-is (preserve source-of-truth direction). Narrowing on the LFG side would invert direction; the next forward-sync would re-introduce the broader pattern.

## Resolution (2026-05-10) — closed as won't-fix

The attempted narrowing to `docs/research/2026-*verbatim*.md` failed CI: 82+ existing
date-prefixed research files have lint violations (MD027/MD032/MD052/MD037) that exist
*because* they are verbatim courier-protocol absorbs (Amara ferries, Grok session logs,
conversation extracts, peer-review packets). These files cannot be reformatted without
violating GOVERNANCE §33 verbatim-preservation.

Empirical result: the date-prefix IS the naming convention for verbatim content in this
repo. The Codex concern (a non-ferry author-controlled doc might accidentally land with
date-prefix shape and silently lose lint coverage) is a theoretical risk outweighed by:

1. The practical cost of bulk-reformatting or bulk-renaming 82+ verbatim files.
2. The convention being stable: author-controlled research uses non-date-prefixed or
   date-suffixed filenames; date-prefixed filenames are verbatim absorbs.

The broad `docs/research/2026-*-*.md` pattern is retained as correct. The comment in
`.markdownlint-cli2.jsonc` is updated to explain this resolution.

## Composes with

- PR #663
- Otto-227 signal-in-signal-out discipline (the rationale the carve-out exists)
