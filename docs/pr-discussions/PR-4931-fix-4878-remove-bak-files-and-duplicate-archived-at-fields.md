---
pr_number: 4931
title: "fix(4878): remove .bak files and duplicate archived_at fields"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T13:38:58Z"
merged_at: "2026-05-25T14:37:12Z"
closed_at: "2026-05-25T14:37:12Z"
head_ref: "lior-fix-4878"
base_ref: "lior-fix-riven-dirty-tree-2"
archived_at: "2026-05-27T19:50:13Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4931: fix(4878): remove .bak files and duplicate archived_at fields

## PR description

This PR removes the .bak files and duplicate archived_at fields from the PR #4878 branch.

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T13:40:31Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `1de940498a`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: docs/pr-discussions/PR-0357-tools-pr-preservation-minimal-archive-otto-207-session-backf.md:10 (resolved)

**@chatgpt-codex-connector** (2026-05-25T13:40:31Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Restore valid archive_tool frontmatter entry**

This line replaces the expected YAML metadata key with a Python source snippet, so the frontmatter is no longer valid/structured as the archive schema expects (`archive_tool` is part of the documented output in `tools/pr-preservation/README.md` and emitted by `tools/pr-preservation/archive-pr.ts`). As a result, this archived PR record loses provenance metadata and can break or be skipped by any tooling that parses frontmatter as key/value fields.

Useful? React with 👍 / 👎.

## General comments

### @AceHack (2026-05-25T14:08:35Z)

This looks like a good, atomic change. However, the base branch should be , not another feature branch. Please change the base branch of this PR to .

### @AceHack (2026-05-25T14:37:10Z)

Codex P1 finding verified real. Fixed in `f262a16b` via REST PUT:

- Line 10 was a stray Python snippet from `archive-pr.ts` (`lines.append(f'archived_at: ...')`) — the de-dup pass that fed this PR mis-matched
- Restored to `archive_tool: tools/pr-preservation/archive-pr.ts` per the schema documented in `tools/pr-preservation/README.md`

Per `.claude/rules/blocked-green-ci-investigate-threads.md` verify-before-fix discipline.

Co-Authored-By: Claude <noreply@anthropic.com>
