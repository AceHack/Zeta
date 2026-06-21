---
pr_number: 3110
title: "feat(b-0261): AutoDream/AutoMemory compat validation \u2014 PASS; 081KQ8P5D0008QG0R003KFRGJ0 close-recommended"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T07:33:57Z"
merged_at: "2026-05-14T07:42:48Z"
closed_at: "2026-05-14T07:42:49Z"
head_ref: "feat/b-0261-autodream-compat-validation-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T08:01:22Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3110: feat(b-0261): AutoDream/AutoMemory compat validation — PASS; 081KQ8P5D0008QG0R003KFRGJ0 close-recommended

## PR description

## Summary

- Runs the five-step harness contract verification procedure (from 081KR2E4K0008QG0R001J0536V's research note) against the post-081KR2E4K0008QG0R001M8NJ56 cutover state of `memory/MEMORY.md`.
- All AutoDream/AutoMemory compatibility claims **PASS**.
- 081KR2E4K0008QG0R0004B55ND closed; 081KQ8P5D0008QG0R003KFRGJ0 marked `close-recommended`.

## Verification checks (run 2026-05-14)

| Check | Result |
|-------|--------|
| Line cap post-cutover (limit ~200) | ✅ PASS — **110 lines** (was 370 pre-cutover) |
| Byte cap post-cutover (limit ~25 KB) | ❌ PARTIAL — 62 KB (pre-existing gap, not a regression) |
| One-line-per-file pointer format | ✅ PASS — 100/100 entry lines correct |
| Reindexer `--check` | ✅ PASS — exit 0, "Entries: 1230. Index current." |
| AutoDream marker preserved at line 1 | ✅ PASS — `[AutoDream last run: 2026-04-23]` |
| AutoDream write-back compat | ✅ PASS — reindexer reads+preserves marker via regex |
| AutoMemory write-back scope | ✅ PASS — AutoMemory targets user-scope path, not repo-scope |

## Key architectural finding

**Two independent MEMORY.md surfaces exist:**

| Surface | Path | Writer |
|---------|------|--------|
| Repo-scope | `memory/MEMORY.md` (this repo) | `reindex-memory-md.ts` + AutoDream (flag-gated) |
| User-scope | `~/.claude/projects/<slug>/memory/MEMORY.md` | Anthropic's AutoMemory harness |

AutoMemory writes to the user-scope path. It does **not** interact with the repo-scope `memory/MEMORY.md`. No write-back conflict is possible.

## Known gap — byte-cap overage (pre-existing)

The repo-scope MEMORY.md is 62 KB vs the ~25 KB harness byte cap. This predates 081KR2E4K0008QG0R001M8NJ56 (was 108 KB before cutover). Mitigation: the reindexer's 100-entry stack cap. Three rollback options documented in the research note (trim descriptions / reduce stack cap / wait for feature-flag graduation).

## Files changed

- `docs/research/b-0261-autodream-automemory-compatibility-validation-2026-05-14.md` ← new; full pass/fail evidence
- `docs/backlog/P1/081KR2E4K0008QG0R0004B55ND-…md` ← status: open → closed; closure notes added
- `docs/backlog/P1/081KQ8P5D0008QG0R003KFRGJ0-…md` ← status: open → close-recommended; done-criteria ticked
- `docs/hygiene-history/ticks/2026/05/14/0730Z.md` ← tick shard

## Build gate

```
dotnet build -c Release → 0 warnings, 0 errors
```

## Test plan

- [x] `bun tools/memory/reindex-memory-md.ts --check` exits 0 post-cutover
- [x] `wc -l < memory/MEMORY.md` = 110 (under 200-line cap)
- [x] `head -1 memory/MEMORY.md` shows AutoDream marker intact
- [x] All 100 entry lines follow `- [Title](file.md) — hook` format (grep check passes)
- [x] `dotnet build -c Release` = 0 warnings, 0 errors

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T07:36:01Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `91db7aa8d0`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T07:36:02Z)

## Pull request overview

Documentation-only PR validating that the post-081KR2E4K0008QG0R001M8NJ56 auto-generated `memory/MEMORY.md` is compatible with AutoDream and AutoMemory write-backs, closing 081KR2E4K0008QG0R0004B55ND and recommending 081KQ8P5D0008QG0R003KFRGJ0 for closure. Adds a research report with five-step evidence, updates two backlog rows, and lands the corresponding tick shard.

**Changes:**
- New research note documenting line-cap / byte-cap / format / reindexer / AutoDream-marker / AutoMemory-scope evidence, plus a known pre-existing 62 KB byte-cap gap and rollback options.
- 081KR2E4K0008QG0R0004B55ND transitioned `open → closed` with closure notes; 081KQ8P5D0008QG0R003KFRGJ0 transitioned `open → close-recommended` with done-criteria checkboxes ticked.
- New hygiene tick shard at `0730Z.md` summarising the verify trace.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/research/b-0261-autodream-automemory-compatibility-validation-2026-05-14.md | New 214-line research report with five-step verification evidence and rollback options. |
| docs/hygiene-history/ticks/2026/05/14/0730Z.md | Tick shard recording the verify trace and key finding. |
| docs/backlog/P1/081KR2E4K0008QG0R0004B55ND-…2026-05-08.md | Status flip to `closed` with closure notes summarising PASS/PARTIAL results. |
| docs/backlog/P1/081KQ8P5D0008QG0R003KFRGJ0-…2026-04-28.md | Status flip to `close-recommended`, done-criteria checkboxes ticked, close-recommendation block appended. |

### COMMENTED — @AceHack (2026-05-14T07:41:27Z)

**Thread responses:**

**Codex P2 (done-criteria inconsistency):** Fixed in fb81aba4. Changed "All done-criteria from 081KQ8P5D0008QG0R003KFRGJ0 are satisfied" to "All blocking done-criteria from 081KQ8P5D0008QG0R003KFRGJ0 are satisfied; the remaining criterion (hotspot monitoring) is explicitly non-blocking per the 081KQ8P5D0008QG0R003KFRGJ0 row." This correctly conveys that the open item is ongoing monitoring, not a blocking condition.

**Copilot (invalid status enum / generate-index drift):** Fixed in fb81aba4.
- `status: close-recommended` → `status: closed` in 081KQ8P5D0008QG0R003KFRGJ0 frontmatter (valid enum per tools/backlog/README.md)
- Added `closed: 2026-05-14` frontmatter field
- Regenerated `docs/BACKLOG.md` — both 081KQ8P5D0008QG0R003KFRGJ0 and 081KR2E4K0008QG0R0004B55ND now render as `[x]` (closed)
- Also updated 081KR2E4K0008QG0R0004B55ND to fill PR #NNNN placeholder with #3110 and fix MD032 blank-line spacing

Both markdownlint and generate-index --check pass locally.

## Review threads

### Thread 1: docs/research/b-0261-autodream-automemory-compatibility-validation-2026-05-14.md:201 (resolved)

**@chatgpt-codex-connector** (2026-05-14T07:36:02Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Avoid declaring all done-criteria satisfied**

This section says "All done-criteria from 081KQ8P5D0008QG0R003KFRGJ0 are satisfied" even though the very next table marks the hotspot-threshold criterion as "To be verified by 081KQ8P5D0008QG0R001D8RCZ9 detector." That inconsistency can lead to premature backlog closure decisions or incorrect status rollups when reviewers rely on this document as evidence. Please qualify the claim (for example, "all blocking criteria") or mark the remaining criterion explicitly out-of-scope for closure.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P1/081KQ8P5D0008QG0R003KFRGJ0-memory-md-marker-vs-index-harness-verify-q1-automemory-aaron-2026-04-28.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T07:36:02Z):

The `status: close-recommended` value is not part of the allowed enum for backlog row frontmatter. Per `tools/backlog/README.md` lines 59-70, the only valid `status` values are `open`, `closed`, `superseded-by-B-NNNN`, and `deferred`. Additionally, `tools/backlog/generate-index.ts::checkboxFor` (lines 129-133) only recognises `closed` and `superseded-by-*` as ticked — any other value (including `close-recommended`) silently renders as an open `[ ]` row in `docs/BACKLOG.md`, which contradicts the "close recommendation produced" intent. Either keep 081KQ8P5D0008QG0R003KFRGJ0 as `open` and rely on the in-body "Close recommendation" section to signal readiness, or close it outright. If a new status is genuinely needed, update the schema in `tools/backlog/README.md` and the enum logic in `tools/backlog/generate-index.ts` in the same PR.
