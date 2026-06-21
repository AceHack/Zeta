---
pr_number: 3095
title: "docs(autonomous-loop): accurate count of bg-services launchd-wiring status"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T03:57:45Z"
merged_at: "2026-05-14T03:59:20Z"
closed_at: "2026-05-14T03:59:21Z"
head_ref: "docs/autonomous-loop-bg-services-wiring-status-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T06:42:35Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3095: docs(autonomous-loop): accurate count of bg-services launchd-wiring status

## PR description

## Summary

The "Background Services Architecture" bullet only mentioned `standing-by-detector.ts` as not-yet-wired. The repo actually has 4 services in `tools/bg/`:

- `missed-substrate-detector.ts` (launchd-registered ✓)
- `backlog-ready-notifier.ts` (NOT wired — 081KRFA460008QG0R00229616S #2 pending)
- `standing-by-detector.ts` (NOT wired — 081KRFA460008QG0R00061SXRW slice 5+ pending)
- `audit-duplicate-row-ids.ts` (NOT wired; invoked on-demand from the substrate-hygiene cascade this session)

Updated the bullet to list all 4 + clarify that 3 are invokable on demand via `bun tools/bg/<name>.ts --once` until launchd wiring completes.

## Helper false-positive note (for follow-up)

Running the just-merged `check-md032-blanks-around-lists.ts` helper against this file surfaced 1 finding on line 275 — but markdownlint on main doesn't flag this content (the line is `- bullet` at 3-space indent inside a parent numbered-list-item-body; markdownlint sees it as sub-list of the parent block). The helper doesn't track parent-list-item-body context. Captured as a future helper-refinement class — does NOT block this docs PR.

## Test plan

- [x] Single-line text change to existing bullet; no markdownlint-actually-violating content added or modified
- [x] Substrate-honest accurate count of `tools/bg/` services and their wiring status

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T03:59:45Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `41c69826a7`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T04:00:02Z)

## Pull request overview

Updates `docs/AUTONOMOUS-LOOP.md` to accurately describe the current set of background-service scripts under `tools/bg/` and their macOS `launchd` wiring status.

**Changes:**
- Expands the “Background Services Architecture” bullet to enumerate all 4 `tools/bg/*.ts` service entrypoints.
- Clarifies which service is `launchd`-registered vs. which are currently on-demand only.

## Review threads

### Thread 1: docs/AUTONOMOUS-LOOP.md:596 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T03:59:46Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep launchd-status note scoped to actual bg daemons**

This sentence now treats `audit-duplicate-row-ids.ts` as one of the launchd-pending background daemons, but that script is a one-shot backlog audit utility (tracked under 081KRFA460008QG0R00308W7FJ) rather than part of the 081KRFA460008QG0R001KC0VBH/081KRFA460008QG0R00229616S/081KRFA460008QG0R00061SXRW daemon set; `tools/bg/README.md` also defines the current background-service set as the three detector/notifier daemons only. Grouping the audit script under the same “not yet wired to launchd” status (and tying it to 081KRFA460008QG0R00229616S/081KRFA460008QG0R00061SXRW pending work) makes the operational status inaccurate for readers trying to understand what still needs launchd wiring.

Useful? React with 👍 / 👎.

### Thread 2: docs/AUTONOMOUS-LOOP.md:597 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T04:00:02Z):

`audit-duplicate-row-ids.ts` does not appear to support a `--once` flag (it runs once by default and exits). As written, `bun tools/bg/<name>.ts --once` would fail for that tool, so the invocation guidance should be adjusted (e.g., call it without `--once`, or qualify that only the notifier/detector tools accept `--once`).
