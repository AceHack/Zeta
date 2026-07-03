---
pr_number: 4133
title: "docs(archive): Maji PR preservation for 4122"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T23:55:47Z"
merged_at: "2026-05-18T00:18:37Z"
closed_at: "2026-05-18T00:18:37Z"
head_ref: "maji/archive-4122-discipline"
base_ref: "main"
archived_at: "2026-05-18T08:23:52Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4133: docs(archive): Maji PR preservation for 4122

## PR description

Automated preservation of PR 4122 discussion.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T23:56:52Z)

## Pull request overview

Archives PR #4122 discussion into the `docs/pr-discussions/` history surface via the standard preservation tool.

**Changes:**

- Adds a new PR preservation file for PR #4122 containing frontmatter, description, reviews, and review threads.

### COMMENTED — @chatgpt-codex-connector (2026-05-17T23:57:07Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `173c571282`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-18T00:18:17Z)

_(no body)_

## Review threads

### Thread 1: docs/pr-discussions/PR-4122-backlog-b-0614-4-empirical-instances-candidate-rule-text-ref.md:19 (resolved)

**@chatgpt-codex-connector** (2026-05-17T23:57:07Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fix relative backlog link in archived PR body**

The archived PR description keeps the original `docs/backlog/...` relative link, but inside `docs/pr-discussions/` this resolves to `docs/pr-discussions/docs/backlog/...` and 404s in GitHub file rendering. This makes the key reference in the archive non-navigable for readers using the preserved discussion; converting it to a repo-root-relative path (for example `/docs/backlog/...`) would keep the archive self-contained and usable.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-18T00:18:17Z):

Verified via direct inspection (`grep "\](docs/backlog" docs/pr-discussions/PR-4122-*.md` returns no matches): the three `docs/backlog/...` references on lines 58, 70, 76 are plain-text citations (bold prose + H3 headings), NOT markdown links. GitHub does not auto-link plain-text paths in prose, so they render as text without 404 hazard. Resolving as false-positive per `.claude/rules/blocked-green-ci-investigate-threads.md` verify-before-fix discipline (thread also marked `isOutdated: true`).
