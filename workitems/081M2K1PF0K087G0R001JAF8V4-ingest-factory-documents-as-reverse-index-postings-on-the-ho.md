---
id: 081M2K1PF0K087G0R001JAF8V4
type: task
state: backlog
priority: P1
slug: ingest-factory-documents-as-reverse-index-postings-on-the-ho
title: "Ingest factory documents as reverse-index postings on the host WAL"
created: 2026-09-15T17:26:37.843Z
depends_on: ["081M29ESZCQ087G0R001SM29DQ"]
composes_with: []
---

# Ingest factory documents as reverse-index postings on the host WAL

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2K1PF0K087G0R001JAF8V4-*.md` glob. -->

## Purpose

Turn factory documents into `IndexFact.Posting` events on a host
`GroupCommitDiskDeltaLog`, then replay them into `SearchIndex`. The standing
query is `landauer`. Storage is the host WAL, not git jsonl on `main`.

Depends on `081M29ESZCQ087G0R001SM29DQ` (the join + log). This peel is ingest,
not cited-by edges, not schema/key windows, not FUSE, not Apple.

## Build

- Port the TS corpus policy (`src/Core.TypeScript/search/inverted/format.ts`):
  extension allowlist, basename allowlist, excluded trees with measurements,
  512 KiB blob cap.
- `ReverseIndexIngest.ingestPaths` reads through `IFileSystem`.
- `ingestHostDirectory` walks a host tree (not `git ls-files`); skips excluded
  prefixes instead of descending into them.
- Tokenize with the existing ASCII fold; append `IndexFact.Posting`; replay.

## Acceptance

- A fixture tree with Landauer in an `.md` hits on query `landauer` after
  replay. Excluded, oversized, and NUL-binary files do not.
- An explicit file list does not walk siblings.
- CI does not walk the whole Zeta tree. No shards committed to `main`.

## Limits (named)

- No CJK segmenter, no positions/phrases, no AND-of-terms, no df cap (query
  peel). Host walk is not git-tracked-only — untracked files under the root
  are eligible. Crash recovery of the WAL stays `toy`.
