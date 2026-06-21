---
id: 081KRW63S0008QG0R000488SY1
priority: P3
status: closed
title: "tools/backlog/lint-frontmatter.ts — pre-push frontmatter discipline lint that mechanizes batch-7 recurring reviewer findings (Otto-CLI 2026-05-18)"
tier: tooling
effort: S
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [081KRW63S0008QG0R003377JG9]
tags: [tooling, otto-cli, backlog-frontmatter-lint, mechanizes-reviewer-findings, pre-push-discipline, closed]
type: tooling
---

# tools/backlog/lint-frontmatter.ts — pre-push frontmatter discipline lint

## Why

Across the 2026-05-18 Mika+Ani+Riven cascade (8 substrate PRs), reviewer-tools (Copilot, Codex) repeatedly caught the same 4 classes of frontmatter-discipline issues PR-by-PR:

1. **Wrong relative-path prefix** — same-dir link using `../P{X}/` when should be bare; cross-dir link missing prefix
2. **composes_with completeness** — body cites `B-NNNN` via markdown link but frontmatter `composes_with` omits it
3. **Non-schema frontmatter keys** — typo'd keys like `last_invariant` instead of `last_updated`
4. **Redundant edges** — `B-NNNN` in both `depends_on` AND `composes_with` (redundant; `depends_on` is stronger)

Each finding was small individually but the AGGREGATE was: every PR triggered the same reviewer cycle → fix → push → resolve. This row CLOSES that cycle by **catching the discipline issues mechanically before PR opens**.

## What landed (closed this PR)

`tools/backlog/lint-frontmatter.ts` — TS script implementing all 4 checks:

```bash
# Lint all backlog rows
bun tools/backlog/lint-frontmatter.ts

# Lint specific file (repeatable)
bun tools/backlog/lint-frontmatter.ts --file docs/backlog/P2/B-XXXX-foo.md

# Strict mode: exit 1 on any finding (for CI integration)
bun tools/backlog/lint-frontmatter.ts --strict

# Subset of checks
bun tools/backlog/lint-frontmatter.ts --check 1,3
```

Output format: `<file>:<line>:<col> [<priority>] check <N>: <message>`.

## Implementation notes

- Pure stdlib (`node:fs` + `node:path`); no external deps
- Inline YAML parsing for frontmatter (sufficient for the flat schema)
- Schema keys whitelisted per `tools/backlog/README.md` per-row file schema
- Composes_with check excludes `depends_on` IDs (already stronger relationship) + self-references
- Path-prefix check handles `../P{X}/` cross-dir + bare same-dir patterns; out-of-scope hrefs (research docs, absolute paths) are skipped
- Compiles cleanly via `bun build` (~6 KB output)

## Validation

Tested against batch-7 rows shipped this session:

- 081KRW63S0008QG0R002MK93T8 (P1): caught 2 findings (composes_with omits 081KRW63S0008QG0R000ZQ9WDH + 081KRW63S0008QG0R0004P69JA cross-dir prefix wrong)
- 081KRW63S0008QG0R0009MCJ4T (P2): caught 1 finding (composes_with omits 081KRW63S0008QG0R002ZRNDJ8)

These are EXACTLY the class of findings Copilot/Codex caught manually on the prior PRs. The tool detects them mechanically without round-trip to reviewer-tools.

## Composes with

- [081KRW63S0008QG0R003377JG9](081KRW63S0008QG0R003377JG9-rest-push-delete-rename-extension-mechanizes-id-renumber-pattern-otto-cli-2026-05-18.md) — sibling tooling extension (rest-push.ts --delete/--rename); both mechanize patterns that previously required manual + inline workarounds
- `tools/backlog/README.md` — schema source-of-truth
- `tools/backlog/generate-index.ts` — read-only counterpart for index regen
- `tools/hygiene/audit-backlog-items.ts` — factory-wide invariants (this row scoped to per-row frontmatter discipline)
- `.claude/rules/blocked-green-ci-investigate-threads.md` — the discipline this tool front-loads

## Future extensions

- CI integration: invoke `--strict` mode in PR-validation CI
- Pre-push git hook (per `.claude/rules/dst-justifies-ts-quality-over-bash-and-harness-hooks-suffice-no-git-hooks` — actually NO, that rule rejects git hooks; harness hooks suffice; would invoke via TS-script-in-CI instead)
- Auto-fix mode: optionally rewrite frontmatter to match body composes_with (Phase 2)
- Cross-row consistency: validate that every `depends_on: [B-NNNN]` reference actually resolves to an existing row file (Phase 2)
- Status drift: check that closed-status rows match the index marking (handled separately by `audit-backlog-status-drift.ts`)

## Closed-row resolution

Code landed in this PR. Future authoring of backlog rows can run `bun tools/backlog/lint-frontmatter.ts --file <new-row.md>` before push to catch the 4 classes of discipline issues mechanically. Closes the cycle observed in batch-7.
