---
id: 081KRFA460008QG0R0006Q6BWP
priority: P1
class: substrate-architecture
status: closed
closed: 2026-05-13
closed_by: "implemented in PR #2991 (31243aaf)"
title: Extend reindex-memory-md.ts test coverage — collectEntries + renderIndex
created: 2026-05-13
last_updated: 2026-05-13
parent: 081KRCQQF0008QG0R0037YYP1A
depends_on: []
composes_with: [081KRCQQF0008QG0R0037YYP1A]
effort: XS
tier: factory-tooling
authors: [otto]
---

# 081KRFA460008QG0R0006Q6BWP — Extend reindex-memory-md.ts test coverage

## Carved sentence

> `tools/memory/reindex-memory-md.ts` exists and passes CI for
> `parseFrontmatter` only. Before the architecture relies on it as
> the authoritative heap→stack promotion mechanism, `collectEntries`
> and `renderIndex` need their own test coverage.

## Context

`tools/memory/reindex-memory-md.ts` was implemented as part of the
081KRCQQF0008QG0R0037YYP1A architectural fix. Its test file
(`tools/memory/reindex-memory-md.test.ts`) currently only covers
`parseFrontmatter`. The two functions that constitute the reindex
pipeline — `collectEntries` (scans memory/ directory and parses
frontmatter) and `renderIndex` (renders the MEMORY.md stack view from
entries) — have no tests.

081KRFA460008QG0R0034C2W0E (loop wiring) and 081KRFA460008QG0R0035NKRHG (CI relaxation) both depend on
the reindexer being trustworthy. This slice validates the tool before
those slices land.

## Acceptance criteria

- [ ] `collectEntries` is tested with a synthetic fixture directory
  - Entries with valid frontmatter are collected
  - Files without frontmatter (`README.md`, `MEMORY.md`, `CURRENT-*`)
    are excluded
  - Entries are sorted newest-first by `created:` date falling back
    to date extracted from filename
- [ ] `renderIndex` is tested
  - Renders expected PREAMBLE_MARKER / PREAMBLE_END delimiters
  - Truncates descriptions at 240 characters
  - Truncates stack at MAX_STACK_ENTRIES (100) and appends overflow note
  - `last reindex: YYYY-MM-DD` in preamble reflects current date
- [ ] All existing tests continue to pass
- [ ] `bun test tools/memory/reindex-memory-md.test.ts` exits 0
- [ ] `dotnet build -c Release` exits 0 warnings 0 errors (unchanged)

## Implementation notes

Use a temp directory via `Bun.env.TMPDIR` or a hardcoded fixture
path under `tools/memory/testdata/`. Prefer fixture files over
`tmp` so tests are deterministic (DST-compatible).

The `collectEntries` function reads from the `MEMORY_DIR = "memory"`
constant which is relative to CWD. The test must either:

1. Use `process.chdir()` within the test (not recommended — affects
   other tests), or
2. Expose a `collectEntriesFrom(dir: string)` variant that takes an
   explicit path — refactor the function to accept an optional dir
   parameter while keeping the default behaviour.

Option 2 is the clean DST approach: makes the function testable
without CWD manipulation.

## Why P1 (not P2)

This slice gates 081KRFA460008QG0R0034C2W0E (loop wiring) and 081KRFA460008QG0R0035NKRHG (CI relaxation).
Without adequate test coverage, rolling out the heap architecture
carries undefined risk for the reindexer's correctness. Completing
this first is cheap and removes that risk.

## Composes with

- 081KRCQQF0008QG0R0037YYP1A (parent; this is slice 1 of 5)
- 081KRFA460008QG0R0034C2W0E (loop wiring depends on this slice's confidence signal)
- 081KRFA460008QG0R0035NKRHG (CI relaxation depends on trustworthy reindexer)
