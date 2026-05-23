---
pr_number: 3990
title: "feat(B-0529): add-pipe-row-header.ts \u2014 backfill tool for shard schema"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T00:35:03Z"
merged_at: "2026-05-17T01:18:19Z"
closed_at: "2026-05-17T01:18:19Z"
head_ref: "otto/b0529-add-pipe-row-header-script"
base_ref: "main"
archived_at: "2026-05-17T02:12:17Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3990: feat(B-0529): add-pipe-row-header.ts — backfill tool for shard schema

## PR description

## Summary

Implements [B-0529](docs/backlog/P2/B-0529-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md) Option 3 ("hybrid") via a one-shot TS tool: `tools/hygiene/add-pipe-row-header.ts`.

The tick-shard validator at [`tools/hygiene/check-tick-history-shard-schema.ts`](tools/hygiene/check-tick-history-shard-schema.ts) requires a pipe-delimited first row matching the path/filename timestamp. Lived convention drifted to H1-first multi-section format. Full dry-run today: **946 shards scanned, 585 compliant, 359 would-prepend, 2 unparseable.**

This PR ships the **script only**. Bulk retrofit (359 file changes) is a separate slice per B-0529's scope discipline — the blast radius warrants its own review.

## Behavior

- Default: dry-run (lists `would-prepend` candidates + summary)
- `--write`: actually prepends pipe-row to non-compliant shards
- `--files <paths>`: restrict to specific files

Retrofit pipe-row uses honest placeholders for fields not reconstructable from path alone:

```text
| 2026-MM-DDTHH:MMZ | retrofit | unknown | retrofit (see body below) | none | none |
```

The H1-rich body below is preserved unchanged — that's where the substantive content lives.

## How it found the drift live

Surfaced this tick via Copilot review on the just-merged [PR #3983](https://github.com/Lucent-Financial-Group/Zeta/pull/3983) tick shard. Copilot flagged that the shard's H1 first line violates the validator. Investigation matched B-0529's existing analysis exactly. Per [`skill-router-as-substrate-inventory.md`](.claude/rules/skill-router-as-substrate-inventory.md): inventory-before-authoring discipline — B-0529 already exists, this PR fulfills its Recommendation rather than creating a duplicate row.

## Test plan

- [x] Dry-run on already-compliant shard (`2026/05/03/0039Z.md`) → skipped
- [x] Dry-run on non-compliant shard (`2026/05/16/2341Z.md`) → would-prepend
- [x] Full repo dry-run → 946 scanned, 585+359+2 = 946 categorized (no double-count)
- [ ] Unit tests for `parseShardPath` / `alreadyCompliant` / `buildHeader` — **deferred** (follow-up; the tool pattern in `tools/hygiene/` has many test files but not all hygiene scripts have one)
- [ ] CI lint / build passes (will surface on PR)
- [ ] **Bulk retrofit PR — separate slice** (not in this PR)

## Composes with

- [`docs/backlog/P2/B-0529-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md`](docs/backlog/P2/B-0529-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md)
- [`tools/hygiene/check-tick-history-shard-schema.ts`](tools/hygiene/check-tick-history-shard-schema.ts) (the validator)
- [`docs/hygiene-history/ticks/README.md`](docs/hygiene-history/ticks/README.md) (schema docs)
- [`.claude/rules/rule-0-no-sh-files.md`](.claude/rules/rule-0-no-sh-files.md) (TS not bash)
- [`.claude/rules/skill-router-as-substrate-inventory.md`](.claude/rules/skill-router-as-substrate-inventory.md) (inventory before authoring)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-17T00:36:51Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `9df78b28af`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T00:39:23Z)

## Pull request overview

Adds a one-shot Bun/TypeScript hygiene tool to backfill validator-compatible pipe-row headers onto tick-history shard files while keeping existing rich Markdown bodies intact.

**Changes:**
- Adds shard path parsing and timestamp-derived header construction.
- Supports dry-run by default, `--write` mutation mode, and optional `--files` restriction.
- Emits per-file actions plus aggregate scan/write counts.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**tools/hygiene/add-pipe-row-header.ts:246**
* P1: Filtering `--files` inputs here silently drops typos, missing files, and out-of-scope paths, then exits successfully with `scanned 0`. For a write-capable backfill tool, invalid operands should be reported as argument errors so a requested retrofit cannot appear to succeed while doing nothing.
```
    shards = files
      .map((p) => resolve(ROOT, p))
      .filter((p) => repoRelative(p).startsWith(SHARD_PREFIX))
      .filter((p) => repoRelative(p).endsWith(".md"))
      .filter((p) => basename(p) !== "README.md")
      .filter(isFile);
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-17T00:43:00Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `88666d8c45`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-17T01:07:22Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `882dc6228b`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T01:07:28Z)

## Pull request overview

Copilot reviewed 1 out of 1 changed files in this pull request and generated 3 comments.

### COMMENTED — @AceHack (2026-05-17T01:19:47Z)

Maji Antigravity Check: Pass. Atomic tool addition, no drift.

## Review threads

### Thread 1: tools/hygiene/add-pipe-row-header.ts:247 (resolved)

**@chatgpt-codex-connector** (2026-05-17T00:36:51Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Fail when --files is provided without any paths**

The `--files` mode is documented as a restriction, but when `--files` is present and no paths are parsed, this branch silently falls back to scanning the entire shard tree. In `--write` mode, a caller typo or an empty dynamically-generated file list will prepend headers across all shards instead of doing a no-op/error, which is a high-impact unintended bulk rewrite. Treating `--files` with zero paths as an explicit error (or zero-target run) would prevent this.

Useful? React with 👍 / 👎.

### Thread 2: tools/hygiene/add-pipe-row-header.ts:240 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T00:39:22Z):

P1: `--files` is keyed off `files.length`, so `bun ... --write --files` with no operands falls through to the full-shard scan and can rewrite every non-compliant shard. Please track whether the flag was present, validate that it has at least one path, and return a usage error instead of broadening the write scope.

This issue also appears on line 241 of the same file.

### Thread 3: tools/hygiene/add-pipe-row-header.ts:213 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T00:39:22Z):

P1: `writeFileSync` rewrites the shard in place, which truncates the original before the new bytes are fully durable. Since this tool is intended for a bulk historical backfill, write to a same-directory temp file and promote it with `renameSync` so an interruption or disk-full error does not corrupt the shard body it is trying to preserve.

### Thread 4: tools/hygiene/add-pipe-row-header.ts:115 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T00:39:22Z):

P1: `alreadyCompliant` only checks that the first non-empty line looks like a pipe row; it does not verify that column 1 matches the shard path/filename, which the validator also enforces. A shard with an existing pipe row for the wrong timestamp will be skipped as compliant here but still fail `check-tick-history-shard-schema.ts`; compare the parsed timestamp against `info.iso` (or the validator's date/hour/minute rules) before skipping.

### Thread 5: tools/hygiene/add-pipe-row-header.ts:116 (resolved)

**@chatgpt-codex-connector** (2026-05-17T00:43:00Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Validate path timestamp before marking shard compliant**

`alreadyCompliant` currently treats a shard as compliant when the first non-empty line only matches `COL1_RE` and has enough pipes, but it never checks that the timestamp matches the file path/filename. In `processOne`, that causes files with an existing but wrong `| YYYY-MM-DDTHH:MM(:SS)?Z | ...` header to be skipped, even though `check-tick-history-shard-schema.ts` will still fail them on date/time mismatch. This means a `--write` retrofit run can report success while leaving validator-breaking shards untouched.

Useful? React with 👍 / 👎.

### Thread 6: tools/hygiene/add-pipe-row-header.ts:335 (resolved)

**@chatgpt-codex-connector** (2026-05-17T01:07:23Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Return non-zero when shards are left unprocessed**

The exit code only reflects `error` entries, so runs with `skip-unparseable-name` still return success even though some shard files could not be retrofitted. In `--write` automation this can report a clean run while leaving validator-breaking files untouched, which is especially risky because this tool is meant to prepare shards for schema checks.

Useful? React with 👍 / 👎.

### Thread 7: tools/hygiene/add-pipe-row-header.ts:297 (resolved)

**@chatgpt-codex-connector** (2026-05-17T01:07:23Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fail when requested --files paths are filtered out**

In `--files` mode, requested paths are silently dropped if they are missing, outside the shard tree, or not markdown files, and no error is emitted for those dropped inputs. A typo or stale generated path list can therefore produce `scanned 0` with exit code 0, making the caller believe targeted files were processed when nothing was changed.

Useful? React with 👍 / 👎.

### Thread 8: tools/hygiene/add-pipe-row-header.ts:277 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:07:27Z):

This parser silently ignores unknown flags, so a typo such as `--write --file <path>` leaves `filesFlagSeen` false and falls through to a full-tree write. Since this tool mutates hundreds of shards by default, reject unrecognized `--...` options (and preferably unexpected positional args outside `--files`) instead of continuing.

### Thread 9: tools/hygiene/add-pipe-row-header.ts:125 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:07:27Z):

This is current-state code, but the comment records reviewer/product attribution in the source. The repo convention keeps names/provenance on history surfaces and uses role-neutral rationale elsewhere (see `.github/copilot-instructions.md` no-name-attribution rule); please drop the attribution and keep only the reason for the check.

### Thread 10: tools/hygiene/add-pipe-row-header.ts:198 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:07:27Z):

This new mutating hygiene tool has no accompanying Bun tests even though similar hygiene utilities in this directory have `.test.ts` coverage. Please add tests for the core cases before merge: compliant vs non-compliant shards, timestamp/path mismatch, `--files` fail-closed behavior, and write-mode temp/rename behavior.
