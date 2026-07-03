---
pr_number: 4851
title: "docs(archive): preserve recently merged PRs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T18:40:30Z"
merged_at: "2026-05-24T20:10:43Z"
closed_at: "2026-05-24T20:10:43Z"
head_ref: "lior-decompose-4828-preservation"
base_ref: "main"
archived_at: "2026-05-24T21:25:31Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4851: docs(archive): preserve recently merged PRs

## PR description

Decomposed from blob PR #4828.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T18:44:28Z)

## Pull request overview

Archives a batch of recently merged pull requests into `docs/pr-discussions/` (for durable PR-history preservation) and updates Riven’s Cursor launchd loop to use the newer agent-gate invocation path.

**Changes:**

- Add multiple PR discussion archive markdown files under `docs/pr-discussions/` (YAML frontmatter + PR body/reviews/threads/comments).
- Update `.cursor/bin/riven-loop-tick.ts` to run the Riven gate via `agent chat --mode ask --model grok-4.3` instead of the prior `cursor-agent`/pickup-drain flow.

### Reviewed changes

Copilot reviewed 23 out of 24 changed files in this pull request and generated 1 comment.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/pr-discussions/PR-4820-shard-2026-05-24-1407z-dotgit-14th-observation-0-procs-first.md | New PR archive for #4820. |
| docs/pr-discussions/PR-4818-tick-2026-05-24-1333z-pr-4816-tier-5-deferral-hard-limits-fl.md | New PR archive for #4818. |
| docs/pr-discussions/PR-4816-research-physics-bridge-3-video-youtube-algo-surfaced-substr.md | New PR archive for #4816 (long-form). |
| docs/pr-discussions/PR-4814-shard-2026-05-24-0441z-25-pr-audit-8-blocked-prs-classified.md | New PR archive for #4814. |
| docs/pr-discussions/PR-4813-shard-2026-05-24-0416z-rename-0240z-0416z-substrate-honest-t.md | New PR archive for #4813. |
| docs/pr-discussions/PR-4812-shard-2026-05-24-0240z-9th-dotgit-saturation-anchor-33-stuck.md | New PR archive for #4812. |
| docs/pr-discussions/PR-4811-soraya-round-69-execute-b-0719-pick-add-trigger-recognition.md | New PR archive for #4811. |
| docs/pr-discussions/PR-4810-backlog-b-0719-file-soraya-round-67-forced-decomposition-aud.md | New PR archive for #4810. |
| docs/pr-discussions/PR-4809-docs-research-bundle-file-dev-pc-substrate-architecture-nix.md | New PR archive for #4809. |
| docs/pr-discussions/PR-4808-docs-research-cluster-bare-metal-substrate-architecture-deci.md | New PR archive for #4808. |
| docs/pr-discussions/PR-4806-docs-research-add-pattern-r-vendor-neutral-accounting-achiev.md | New PR archive for #4806. |
| docs/pr-discussions/PR-4798-docs-shadow-add-shadow-lesson-log-for-metadata-churn-paralys.md | New PR archive for #4798. |
| docs/pr-discussions/PR-4797-backlog-b-0718-file-soraya-round-61-forced-decomposition-aud.md | New PR archive for #4797. |
| docs/pr-discussions/PR-4796-docs-research-restore-patterns-h-o-lost-in-pr-4784-merge-rac.md | New PR archive for #4796. |
| docs/pr-discussions/PR-4795-backlog-b-0717-file-soraya-round-57-hand-off-lsm-spine-regis.md | New PR archive for #4795. |
| docs/pr-discussions/PR-4794-docs-research-preserve-addison-consent-pattern-observation-n.md | New PR archive for #4794. |
| docs/pr-discussions/PR-4793-docs-research-add-pattern-p-wear-down-design-produces-unboun.md | New PR archive for #4793. |
| docs/pr-discussions/PR-4792-docs-research-preserve-ai-context-failures-vs-vendor-managem.md | New PR archive for #4792. |
| .cursor/bin/riven-loop-tick.ts | Switches Riven’s periodic gate to invoke the `agent` CLI and simplifies the gate prompt wiring. |
</details>

### COMMENTED — @AceHack (2026-05-24T20:06:36Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T20:11:20Z)

## Pull request overview

Copilot reviewed 23 out of 24 changed files in this pull request and generated 4 comments.

## Review threads

### Thread 1: .cursor/bin/riven-loop-tick.ts:221 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T18:44:27Z):

P1: This loop switched from invoking `cursor-agent` to the `agent` binary. Elsewhere in the repo (e.g., tools/peer-call/* and tools/riven/riven-cursor-terminal-loop.ts) the Cursor/Grok integration still invokes `cursor-agent`, so setups that only have `cursor-agent` on PATH will silently fail every gate run here (non-zero exit + no work). Consider probing for `agent` availability (or supporting a fallback to `cursor-agent`, or making the binary name configurable via env var) and log a clear one-line diagnostic when neither is available.

**@AceHack** (2026-05-24T20:06:36Z):

Fixed in commit d30479223. Made the binary configurable via `ZETA_RIVEN_LOOP_AGENT_BIN` env var (default `"agent,cursor-agent"`) with `resolveAgentBin()` probing each candidate via `which` and returning the first available. When neither is found, logs a clear one-line diagnostic with run_id + candidate list and writes skipped state to `last-agent-run.json`; heartbeat write continues normally so forward-tick is unaffected.

### Thread 2: docs/pr-discussions/PR-4820-shard-2026-05-24-1407z-dotgit-14th-observation-0-procs-first.md:22 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-24T20:11:19Z):

P1/xref: This link target is written as if rendered in a PR/issue (repo-root-relative), but in an on-disk archive under `docs/pr-discussions/` it resolves to `docs/pr-discussions/.claude/...` (nonexistent). Use a repo-root absolute link (e.g., starting with `/.claude/...`) so the citation remains navigable in the preserved archive.

### Thread 3: docs/pr-discussions/PR-4814-shard-2026-05-24-0441z-25-pr-audit-8-blocked-prs-classified.md:21 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-24T20:11:19Z):

P1/xref: `../blob/main/.claude/...` is a GitHub URL-path fragment, but inside a repo file it resolves as a relative filesystem path (`docs/blob/main/...`) and is broken. Use a repo-root absolute link (e.g., `/.claude/rules/claim-acquire-before-worktree-work.md`) or a full `https://github.com/.../blob/main/...` URL so the archive citation works.

### Thread 4: docs/pr-discussions/PR-4814-shard-2026-05-24-0441z-25-pr-audit-8-blocked-prs-classified.md:36 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-24T20:11:20Z):

P1/xref: Same issue as above: `../blob/main/.claude/...` is not a valid relative path inside this archived markdown file, so the rule reference is broken. Switch to a repo-root absolute link (starting with `/.claude/...`) or a full GitHub `blob` URL.

### Thread 5: docs/pr-discussions/PR-4814-shard-2026-05-24-0441z-25-pr-audit-8-blocked-prs-classified.md:27 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-24T20:11:20Z):

P1: The narrative says "5 failure classes", but the classification table includes Classes A–F (6 classes). This makes the archive internally inconsistent (and the frontmatter/title also says 5). Update the count/text to match the table (or remove/merge Class F if it’s not meant to be a separate class).

## General comments

### @chatgpt-codex-connector (2026-05-24T18:40:34Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
