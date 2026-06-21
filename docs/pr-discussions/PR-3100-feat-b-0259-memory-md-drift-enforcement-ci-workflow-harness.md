---
pr_number: 3100
title: "feat(b-0259): MEMORY.md drift enforcement \u2014 CI workflow + harness hook"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T06:05:05Z"
merged_at: "2026-05-14T06:07:30Z"
closed_at: "2026-05-14T06:07:30Z"
head_ref: "feat/b0259-memory-index-drift-ci-hook-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T06:34:45Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3100: feat(b-0259): MEMORY.md drift enforcement — CI workflow + harness hook

## PR description

## Summary

081KR2E4K0008QG0R000XCS9FT: wire the 081KR2E4K0008QG0R001E27DDV reindexer into developer flow and CI so MEMORY.md drift is caught mechanically.

- **CI workflow** (`.github/workflows/memory-index-drift.yml`) — triggers on `memory/**` changes, runs `bun tools/memory/reindex-memory-md.ts --check`, fails with remediation instructions when stale. Safe-pattern compliant: SHA-pinned checkout, `permissions: contents: read`, no user-authored text in `run:` steps.
- **Harness hook** (`.claude/hooks/post-write-memory-reindex.ts`) — PostToolUse hook for `Write` + `Edit` matchers; auto-regenerates MEMORY.md after agent writes to any heap file. Excludes MEMORY.md, CURRENT-*.md, README.md, persona/**. Non-blocking on failure (CI is the hard gate).
- **MEMORY.md regenerated** — first full regeneration via the 081KR2E4K0008QG0R001E27DDV generator (triggered by the hook smoke-test). Previously manually curated; generator output is now canonical.

## Post-merge manual step required

`.claude/settings.json` cannot be modified by an agent (self-modification surface). After this PR merges, wire the hook by adding to the `PostToolUse` array:

```json
{
  "matcher": "Write",
  "hooks": [
    {
      "type": "command",
      "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-write-memory-reindex.ts"
    }
  ]
},
{
  "matcher": "Edit",
  "hooks": [
    {
      "type": "command",
      "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-write-memory-reindex.ts"
    }
  ]
}
```

## Acceptance criteria

- [x] CI fails when generated output is stale (`memory-index-drift.yml`, exit 2 → 1)
- [x] Developer instructions explain how to fix drift (workflow remediation block + 081KR2E4K0008QG0R000XCS9FT row)
- [x] Memory-file edits trigger deterministic index regeneration (hook script committed + wiring instructions provided)
- [x] No cutover behavior changes

## Test plan

- [x] `bun --check .claude/hooks/post-write-memory-reindex.ts` → exit 0
- [x] Hook smoke-tested with non-memory path → no-op
- [x] Hook smoke-tested with `memory/MEMORY.md` → excluded (no-op)
- [x] Hook smoke-tested with `memory/CURRENT-otto.md` → excluded (no-op)
- [x] Hook fires on `memory/feedback_*.md` path → reindexes
- [x] `bun tools/memory/reindex-memory-md.ts --check` → "Entries: 1202. Index current." (exit 0)
- [x] `dotnet build -c Release` → 0 warnings, 0 errors

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T06:08:03Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `4e8eedc556`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T06:09:06Z)

## Pull request overview

This PR adds mechanical enforcement for `memory/MEMORY.md` drift by combining a CI gate with a Claude Code harness hook, then regenerates the memory index using the existing reindexer.

**Changes:**
- Adds a GitHub Actions workflow to run `bun tools/memory/reindex-memory-md.ts --check` on `memory/**` changes.
- Adds a PostToolUse hook that reindexes `MEMORY.md` after qualifying memory heap file writes.
- Closes 081KR2E4K0008QG0R000XCS9FT and updates `memory/MEMORY.md` to generated output.

### Reviewed changes

Copilot reviewed 3 out of 4 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| `.github/workflows/memory-index-drift.yml` | Adds CI drift enforcement for generated memory index parity. |
| `.claude/hooks/post-write-memory-reindex.ts` | Adds hook-side automatic reindexing after memory heap file writes/edits. |
| `docs/backlog/P1/081KR2E4K0008QG0R000XCS9FT-memory-md-hook-and-ci-drift-enforcement-2026-05-08.md` | Marks the backlog row closed and documents implementation/wiring. |
| `memory/MEMORY.md` | Regenerates the memory index from heap files. |

## Review threads

### Thread 1: .claude/hooks/post-write-memory-reindex.ts:40 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T06:08:03Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Match memory paths against project root**

The hook derives `rel` from `relative(process.cwd(), abs)` and then requires exactly `memory/<file>`; this fails whenever Claude is started from a subdirectory (for example `cwd=/workspace/Zeta/docs`), because an absolute `file_path` like `/workspace/Zeta/memory/x.md` becomes `../memory/x.md` and is rejected. In that common context the hook silently skips reindexing, so `MEMORY.md` drifts until CI catches it, which defeats the intended real-time regeneration behavior.

Useful? React with 👍 / 👎.

### Thread 2: .github/workflows/memory-index-drift.yml:44 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T06:08:03Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Run drift check when reindexer logic changes**

This workflow only triggers on `memory/**`, so a PR that changes `tools/memory/reindex-memory-md.ts` (or related generation logic) but forgets to regenerate `memory/MEMORY.md` will not run this gate and can merge stale generated output. Because the workflow is intended to enforce index freshness, it should also trigger on generator/hook changes that can invalidate `MEMORY.md` even without direct edits under `memory/`.

Useful? React with 👍 / 👎.

### Thread 3: .claude/hooks/post-write-memory-reindex.ts:50 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T06:09:05Z):

This new `spawnSync("bun", ...)` call lacks the repository's required `sonarjs/no-os-command-from-path` suppression/rationale for intentional PATH-resolved tool invocations. Other Bun hook wrappers suppress this exact rule (for example `.claude/hooks/check-md032-pretooluse.ts:73-77`), and the TypeScript lint config includes `.claude/hooks/**/*.ts`, so this will surface as an eslint/Sonar finding unless the documented suppression is added here.

### Thread 4: .claude/hooks/post-write-memory-reindex.ts:35 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T06:09:06Z):

The trigger test is anchored to `process.cwd()`, but the documented hook wiring runs the script via `$CLAUDE_PROJECT_DIR` and does not guarantee the process CWD is the repository root. If Claude Code is launched from a subdirectory, a write to `memory/foo.md` will resolve relative to that subdirectory and the hook will skip the reindex. Anchor both the path match and the reindex child process to `process.env.CLAUDE_PROJECT_DIR ?? process.cwd()` as the other hook wrappers do.

### Thread 5: .github/workflows/memory-index-drift.yml:71 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T06:09:06Z):

Using the current `--check` output as a merge gate makes this workflow date-flaky: `reindex-memory-md.ts` renders `Last reindex: ${new Date().toISOString().slice(0, 10)}` and compares it byte-for-byte, so a PR that regenerated MEMORY.md yesterday will start failing today even when no heap content drift exists. Make the check ignore or preserve the existing `Last reindex` line, or switch that field to a source-derived value before enforcing it in CI.
