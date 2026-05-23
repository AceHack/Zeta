---
pr_number: 4004
title: "docs(hygiene): endorse hybrid shard format (pipe-row + H1 body) per B-0529 Option 3"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T01:24:56Z"
merged_at: "2026-05-17T01:49:48Z"
closed_at: "2026-05-17T01:49:48Z"
head_ref: "otto/shard-schema-hybrid-readme-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T02:12:15Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4004: docs(hygiene): endorse hybrid shard format (pipe-row + H1 body) per B-0529 Option 3

## PR description

## Summary

Per [B-0529](docs/backlog/P2/B-0529-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md) Recommendation (Option 3 "hybrid") — the "Soon (separate row)" follow-up — this PR updates the shard-file-schema documentation in [`docs/hygiene-history/ticks/README.md`](docs/hygiene-history/ticks/README.md) to explicitly describe the canonical shape: pipe-row first line for validator + machine-parseability, H1-rich body below for substantive content.

Aligns documentation with the substrate landed in [PR #3990](https://github.com/Lucent-Financial-Group/Zeta/pull/3990) (`tools/hygiene/add-pipe-row-header.ts`) and reflects the lived convention that recent shards (~585 of 944) already follow.

## Changes

- Cross-link to the validator (`check-tick-history-shard-schema.ts`)
- Explicit statement of date+hour+min matching contract
- Worked example showing pipe-row first then H1 body
- Reference to `add-pipe-row-header.ts` for retrofit of older shards
- Note that validator inspects only first non-empty line

## Composes with

- [`docs/backlog/P2/B-0529-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md`](docs/backlog/P2/B-0529-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md)
- [`tools/hygiene/check-tick-history-shard-schema.ts`](tools/hygiene/check-tick-history-shard-schema.ts) (validator)
- [`tools/hygiene/add-pipe-row-header.ts`](tools/hygiene/add-pipe-row-header.ts) (retrofit tool, [PR #3990](https://github.com/Lucent-Financial-Group/Zeta/pull/3990))

## Test plan

- [x] No code change — pure docs update
- [ ] CI passes (markdownlint, etc.)
- [ ] **B-0529 Recommendation "Later" item — wire validator into gate.yml as non-required check** — separate row, not in this PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T01:27:48Z)

## Pull request overview

This PR updates tick-history shard schema documentation to endorse the hybrid shard format: validator-friendly pipe-row metadata first, followed by rich Markdown content.

**Changes:**
- Documents the validator-aligned first-line pipe-row contract.
- Adds a worked hybrid-format example.
- References the retrofit tool for older H1-first shards.

### COMMENTED — @AceHack (2026-05-17T01:44:31Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-17T01:44:34Z)

_(no body)_

## Review threads

### Thread 1: docs/hygiene-history/ticks/README.md:55 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:27:48Z):

P1: This requirement conflicts with the YAML-frontmatter guidance later in this README. If a shard starts with frontmatter, the validator's first non-empty line is `---`, so it fails the pipe-row check; the updated schema should explicitly reconcile or remove the frontmatter recommendation rather than leaving two incompatible canonical shapes.

**@AceHack** (2026-05-17T01:44:31Z):

Fixed in eeac8c9 — renamed the section to "Optional body metadata", explicitly stating the pipe-row MUST be the first non-empty line and that file-head YAML frontmatter would conflict with the validator. The metadata block now lives below the pipe-row + H1 inside the body (outer fence widened to 4 backticks so the inner ```yaml renders).

### Thread 2: docs/hygiene-history/ticks/README.md:65 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:27:48Z):

P1: This filename list omits the validator-supported same-minute disambiguation form (`HHMMZ-<hex>`, including the README's `HHMMZ-01` examples). Since this paragraph says it is describing the validator contract, the documentation should include all accepted forms or authors may incorrectly avoid valid shard names.

**@AceHack** (2026-05-17T01:44:34Z):

Fixed in eeac8c9 — schema paragraph now lists all three validator-accepted filename forms: `HHMMZ`, `HHMMZ-<hex>` (same-minute disambiguation), and `HHMMSSZ-<hex>` (content-hash form). The `HHMMZ-<hex>` form matches `BARE_RE = /^(\d{4})Z(-[0-9a-f]+)?$/` in `check-tick-history-shard-schema.ts` and the `0215Z-01.md` examples already in the README's "Naming" section.
