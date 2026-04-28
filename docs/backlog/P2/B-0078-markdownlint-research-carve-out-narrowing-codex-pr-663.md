---
id: B-0078
priority: P2
status: open
title: Narrow markdownlint carve-out from `docs/research/2026-*-*.md` to verbatim-only pattern — Codex P1 on PR #663
effort: S
ask: narrow .markdownlint-cli2.jsonc ignore pattern to exclude only verbatim ferry absorbs, not all date-prefixed research docs
created: 2026-04-28
last_updated: 2026-04-28
tags: [pr-663, codex, deferred, acehack-canonical, markdownlint]
---

# B-0078 — Narrow markdownlint research-doc carve-out

## Source

Codex P1 on PR #663 (.markdownlint-cli2.jsonc:108):

> Adding `docs/research/2026-*-*.md` to markdownlint ignores disables linting for *all* date-prefixed research docs, not just verbatim ferry absorbs. If the date-prefix convention is ever used for author-edited research notes, they'll silently lose lint coverage.

Codex's suggested narrowing: `docs/research/2026-*-verbatim-*.md`.

## Why deferred (not fixed in PR #663)

PR #663 forwards AceHack's broader pattern as-is (preserve source-of-truth direction). Narrowing on the LFG side would invert direction; the next forward-sync would re-introduce the broader pattern.

## Acceptance

- [ ] Narrow the pattern on AceHack to a verbatim-only convention (`docs/research/2026-*-verbatim-*.md` or similar)
- [ ] Audit existing `docs/research/2026-*-*.md` files: rename verbatim absorbs to match the new pattern; leave author-controlled docs un-renamed so they regain lint coverage
- [ ] Forward-sync to LFG

## Composes with

- PR #663
- Otto-227 signal-in-signal-out discipline (the rationale the carve-out exists in the first place)
