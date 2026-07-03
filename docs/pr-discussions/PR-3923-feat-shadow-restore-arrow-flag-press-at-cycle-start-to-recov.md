---
pr_number: 3923
title: "feat(shadow): --restore-arrow flag \u2014 press \u2192 at cycle start to recover cron-erased autocomplete"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T17:51:11Z"
merged_at: "2026-05-16T17:53:25Z"
closed_at: "2026-05-16T17:53:25Z"
head_ref: "chore/shadow-restore-arrow-otto-cli-2026-05-16-1739z"
base_ref: "main"
archived_at: "2026-05-16T18:59:07Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3923: feat(shadow): --restore-arrow flag — press → at cycle start to recover cron-erased autocomplete

## PR description

## Summary

- Adds `--restore-arrow` flag to `tools/shadow/shadow-observer.ts`. When enabled, the observer presses → (right arrow) at the start of every cycle in the frontmost terminal.
- Purpose: when an autonomous-loop cron tick fires a new user prompt in the Claude Code CLI, any grey-text autocomplete in the input field gets erased. Pressing → restores it.
- New AppleScript: `tools/shadow/restore-arrow.applescript` (frontmost-terminal-gated; key code 124).
- launchd plist updated to include `--restore-arrow` alongside existing `--dry-run` (orthogonal flags both active by default).

## Design notes

- **Not suppressed by `--dry-run`** — the two flags are orthogonal:
  - `--dry-run` prevents the destructive Enter-to-accept keystroke
  - `--restore-arrow` is non-destructive (no-op when no autocomplete + cursor at end)
- **Caveat**: cursor mid-line + → moves cursor right by one character. Non-destructive but not silent. Accepted per maintainer judgment ("rare in practice given typical input flow").
- **v1 scope** — blind press + log. Delta detection (sample text-state before/after press to log WHAT was restored) deferred to v2 once we observe v1 behavior.

## Test plan

- [x] 54/54 unit tests pass (49 pre-existing + 5 new for restore-arrow behavior)
- [x] Smoke test: \`bun tools/shadow/shadow-observer.ts --dry-run --once --restore-arrow\` produces \`restore-arrow\` event in log
- [ ] Manual verification: install launchd plist with new args + observe \`pressed:<terminal>\` entries in shadow-observer.log under live cron-tick conditions

## Origin

Maintainer 2026-05-16T17:21Z: *"ship the restore arrow"* — closing a design dialogue about the cron-tick-erases-autocomplete UX wrinkle observed earlier in the session.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-16T17:54:18Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `92bcae152b`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T17:54:24Z)

## Pull request overview

Adds an optional “restore autocomplete” keystroke to the shadow observer loop to recover grey-text suggestions that get cleared by cron-triggered prompt refreshes in the frontmost terminal.

**Changes:**

- Add `--restore-arrow` flag and `restore-arrow` event logging to the shadow observer cycle.
- Add a new macOS AppleScript (`restore-arrow.applescript`) that presses the right-arrow key only when a known terminal emulator is frontmost.
- Update launchd LaunchAgent template to run the observer with `--restore-arrow` enabled, and add unit tests for the new behavior.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| tools/shadow/shadow-observer.ts | Adds `--restore-arrow` config, cycle hook, event type, and AppleScript runner integration. |
| tools/shadow/shadow-observer.test.ts | Adds unit tests for restore-arrow call semantics and CLI parsing defaults. |
| tools/shadow/restore-arrow.applescript | New AppleScript to right-arrow in frontmost known terminal emulator. |
| tools/shadow/launchd/com.zeta.shadow-observer.plist | Enables `--restore-arrow` by default in LaunchAgent ProgramArguments and documents behavior. |

## Review threads

### Thread 1: tools/shadow/shadow-observer.ts:42 (unresolved)

**@chatgpt-codex-connector** (2026-05-16T17:54:18Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct dry-run contract for restore-arrow**

The flag docs now claim `--restore-arrow` is “Suppressed under --dry-run”, but `runOneCycle` still invokes `restoreArrowFn` whenever `config.restoreArrow` is true, and the launchd plist enables both flags by default. This mismatch can cause operators to rely on `--dry-run` as a no-keystroke safety mode while still injecting a right-arrow keypress, which is user-visible when the cursor is mid-line; the docs should match behavior (or behavior should be gated by `dryRun`) to avoid unsafe assumptions.

Useful? React with 👍 / 👎.

### Thread 2: tools/shadow/shadow-observer.ts:42 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T17:54:24Z):

The `--restore-arrow` flag documentation contradicts the implementation and tests. Here it says the arrow press is “Suppressed under --dry-run”, but `runOneCycle` logs/executes restore-arrow even when `dryRun=true` (and there’s a unit test asserting that). Please update this flag description (and, if needed, the earlier `--dry-run` safety bullet) to reflect the actual orthogonal behavior: `--dry-run` suppresses Enter/accept, but `--restore-arrow` still presses → when enabled.

### Thread 3: tools/shadow/shadow-observer.ts:252 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T17:54:24Z):

`pressRestoreArrow` drops `stderr` details when `osascript` exits non-zero, returning only `error:osascript-exit-<code>`. In practice (e.g., accessibility permission denied), this makes the logged verdict hard to diagnose. Consider including a trimmed `stderr` snippet in the error verdict (similar to `detectGreyTextMacOS`), or mapping known permission-denied patterns to a `skipped:<reason>` verdict to avoid noisy, opaque error logs.
