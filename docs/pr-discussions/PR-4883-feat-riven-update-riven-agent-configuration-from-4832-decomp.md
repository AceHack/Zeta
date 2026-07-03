---
pr_number: 4883
title: "feat(riven): Update Riven agent configuration from #4832 (decomposed)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T22:29:40Z"
merged_at: "2026-05-25T04:15:57Z"
closed_at: "2026-05-25T04:15:57Z"
head_ref: "riven-config-update-4832-5"
base_ref: "main"
archived_at: "2026-05-27T19:53:57Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4883: feat(riven): Update Riven agent configuration from #4832 (decomposed)

## PR description

This PR extracts the Riven agent configuration changes from PR #4832. This is a decomposition of the blob PR #4832.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T22:29:49Z)

Copilot wasn't able to review any files in this pull request.

### COMMENTED — @chatgpt-codex-connector (2026-05-24T22:31:11Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `b3b45a1281`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-25T04:13:36Z)

_(no body)_

## Review threads

### Thread 1: .cursor/bin/riven-loop-tick.ts:75 (resolved)

**@chatgpt-codex-connector** (2026-05-24T22:31:11Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Keep regex token on one line to avoid parse failure**

This change turns `text.split(/\r?\n/)` into a regex literal that spans two source lines (`text.split(/...` then `.../)`), which is invalid JavaScript/TypeScript syntax because regular-expression literals cannot contain a line terminator token boundary. In environments that execute this script via Bun/Node-compatible parsing, the file fails to load, so the heartbeat/forward tick loop never runs.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T04:13:36Z):

Confirmed P1 — verified directly: the file at the prior PR head contained literal CR + LF bytes (0x0D 0x0A) inside the regex literal between `/` and `/`, not the `\r\n` escape sequences that origin/main has. JS/TS grammar rejects `LineTerminator` in `RegularExpressionBody`, so Bun would fail to load the file and the riven-loop-tick heartbeat would never run.

Pushed `fb5e3df3` via REST git-data API restoring `/\r?\n/` (escape sequences), byte-equivalent to origin/main at that line. `gh api .../contents/...?ref=fb5e3df3` confirms the fix landed. Resolving this thread.
