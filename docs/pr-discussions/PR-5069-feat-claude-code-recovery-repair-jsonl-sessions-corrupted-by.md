---
pr_number: 5069
title: "feat(claude-code-recovery): repair JSONL sessions corrupted by oversize images"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T02:21:27Z"
merged_at: "2026-05-26T02:36:35Z"
closed_at: "2026-05-26T02:36:35Z"
head_ref: "otto-cli/claude-code-jsonl-recovery-script-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:33Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5069: feat(claude-code-recovery): repair JSONL sessions corrupted by oversize images

## PR description

## Summary

Repair Claude Code sessions that won't reopen because a pasted image
ballooned a single JSONL line past the harness session-load limit.

Born from a live incident: session `c2b77530` ("Assemble declarative
infrastructure files for Zeta") had a 13.4 MB line at 15230 from a
9.8 MB PNG attachment — wouldn't reopen, hours of work at risk. The
recovery procedure is mechanical but easy to get wrong; this lands
it as a reusable tool + skill so the next operator hit doesn't lose
substrate.

## What lands

- `tools/claude-code-recovery/repair-jsonl-strip-images.ts` — Bun-hosted
  TypeScript, dry-run by default, refuses to write if any post-edit
  line fails to parse
- `tools/claude-code-recovery/README.md` — usage + the why
- `.claude/skills/claude-session-recovery/SKILL.md` — triggers on
  "session won't open", "image too large", "edit out the image", etc.

## Per-image vs per-line threshold

The script splits two thresholds intentionally:

- `--max-line-bytes` (default 10 MB) — which JSONL lines to inspect
- `--max-image-bytes` (default = `--max-line-bytes`) — which individual
  images on those lines to strip

**Small images on an oversize line are preserved.** Only images whose
base64 length individually exceeds `--max-image-bytes` are removed.
This keeps the strip surgical: if a corrupted turn contained a few
small thumbnails plus one 13 MB screenshot, only the screenshot is
removed.

## Operator-runs discipline

The Claude Code auto-mode classifier blocks the agent from running
`--apply` directly. This is correct per
`.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`
— `.jsonl` edits are self-modification territory.

The skill walks the agent through scan + dry-run + handing `--apply`
to the operator. The script's built-in backup
(`<file>.bak-YYYY-MM-DD-<epoch>`) makes the operation reversible.
No `.claude/settings.json` `_*_acceptance` block is needed for
one-off recoveries — the operator-runs split keeps authority anchored
to the operator without ceremonial scaffolding.

## Test plan

- [x] `--scan` correctly finds c2b77530, only flags lines above the threshold
- [x] Dry-run on c2b77530 with default thresholds: identifies the 13 MB image, would free 13.1 MB (53 MB → 40 MB)
- [x] Per-image threshold discriminator: raising `--max-image-bytes 20000000` correctly preserves the 13 MB image (proves small images would survive)
- [x] `--help` output shows the new flag
- [ ] (operator) Run `--apply` against c2b77530 to actually recover the session
- [ ] (operator) Confirm session reopens in Claude Code after the strip
- [ ] Skill activates correctly on future trigger phrases ("session won't open" / "image too large" / etc.)

## Composes with

- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` — the operator-runs gate that mandates the agent/operator split
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` — the four-field attribution scaffold (would apply if this becomes recurring enough to want automation past operator-runs)
- User-scope memory file `feedback_claude_code_session_jsonl_oversize_image_self_heal_recovery_pattern_classifier_blocks_claude_operator_runs_2026_05_25.md` (the self-heal pattern + the c2b77530 anchor)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @github-advanced-security (2026-05-26T02:23:42Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T02:24:49Z)

## Pull request overview

Adds a Bun/TypeScript recovery utility and companion documentation/skill to repair Claude Code session JSONL files that can’t be reopened due to oversize pasted image attachments (base64 ballooning a single JSONL line past the harness load limit).

**Changes:**

- Introduces `repair-jsonl-strip-images.ts` to scan session JSONL files for oversize lines and strip only oversize image blocks (dry-run by default, backup + validation on apply).
- Documents usage, thresholds, and the agent/operator split for safe `--apply` execution.
- Adds a `claude-session-recovery` skill to guide operators through scan → dry-run → operator-run apply.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 7 comments.

| File | Description |
| ---- | ----------- |
| tools/claude-code-recovery/repair-jsonl-strip-images.ts | New CLI tool to scan/repair Claude Code session JSONL lines corrupted by oversize image blocks. |
| tools/claude-code-recovery/README.md | Usage and operational guidance for applying the recovery tool safely. |
| .claude/skills/claude-session-recovery/SKILL.md | New skill to route “session won’t open due to image” incidents into the scripted recovery procedure. |

### COMMENTED — @github-advanced-security (2026-05-26T02:29:59Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T02:31:08Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 6 comments.

## Review threads

### Thread 1: tools/claude-code-recovery/repair-jsonl-strip-images.ts:298 (resolved)

**@github-advanced-security** (2026-05-26T02:23:41Z):

## CodeQL / Potential file system race condition

The file may have changed since it [was checked](1).

[Show more details](https://github.com/Lucent-Financial-Group/Zeta/security/code-scanning/93)

### Thread 2: tools/claude-code-recovery/repair-jsonl-strip-images.ts:373 (resolved)

**@github-advanced-security** (2026-05-26T02:23:42Z):

## CodeQL / Potential file system race condition

The file may have changed since it [was checked](1).
The file may have changed since it [was checked](2).

[Show more details](https://github.com/Lucent-Financial-Group/Zeta/security/code-scanning/94)

### Thread 3: tools/claude-code-recovery/repair-jsonl-strip-images.ts:50 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:24:47Z):

This tool hard-codes a maintainer-specific Claude project slug (and embeds a user handle) as DEFAULT_SLUG. That makes the default behavior fail for any operator whose repo path differs, and it leaks machine-specific identity into a reusable tool. Prefer deriving the slug from the current repo absolute path (Claude’s slugging rule) or require --slug explicitly and print a clear error showing how to find the correct slug.

### Thread 4: tools/claude-code-recovery/repair-jsonl-strip-images.ts:90 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:24:47Z):

Argument parsing accepts flags without values (e.g., "--slug" at end) and then proceeds with undefined/NaN values (Number(undefined) => NaN), which will cause confusing behavior later. Add validation that every value-taking flag has a following non-flag token, and reject invalid numbers; also consider allowing numeric underscores by normalizing (remove '_' / ',' before Number) since the help/comments show underscore-separated literals.

### Thread 5: tools/claude-code-recovery/repair-jsonl-strip-images.ts:312 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:24:48Z):

Repair mode inspects lines with length >= --max-line-bytes, but scan mode flags only lines with length > --max-line-bytes. This threshold mismatch means a line exactly at the limit will be processed in repair but never appear in scan output. Make the comparison consistent (either both '>' or both '>=' / '<=').

### Thread 6: tools/claude-code-recovery/repair-jsonl-strip-images.ts:385 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:24:48Z):

Most tools/ scripts in this repo export a main(argv) and only call process.exit when run as the entrypoint (if (import.meta.main)). This file unconditionally calls main() and exits from inside helpers, which makes it harder to import/reuse/test and diverges from established tooling structure. Refactor to export main(argv) -> exit code, and guard the process.exit call behind import.meta.main.

### Thread 7: .claude/skills/claude-session-recovery/SKILL.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:24:48Z):

Skill frontmatter description is far above the repo’s carved-sentence guidance (one sentence, <120 chars preferred, <150 target) and risks being truncated/dropped by the skill router budget. Carve description down to a single routing-quality sentence and move procedural detail into the skill body.

### Thread 8: .claude/skills/claude-session-recovery/SKILL.md:34 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:24:48Z):

This grep example hard-codes a maintainer-specific project slug; on any other machine the slug will differ and the command will miss sessions. Use a <slug> placeholder (or instruct deriving the slug from the repo path) so the skill remains usable for other operators.

### Thread 9: tools/claude-code-recovery/README.md:50 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:24:48Z):

The README documents a specific operator’s slug as the default. Since Claude’s project slug depends on the operator’s absolute repo path, this default will be wrong for most users. Prefer documenting the slug as "<slug derived from your repo path>" (or explain how to compute/find it), and consider removing the hard-coded default from the tool so docs and behavior stay consistent.

### Thread 10: tools/claude-code-recovery/repair-jsonl-strip-images.ts:327 (resolved)

**@github-advanced-security** (2026-05-26T02:29:59Z):

## CodeQL / Potential file system race condition

The file may have changed since it [was checked](1).

[Show more details](https://github.com/Lucent-Financial-Group/Zeta/security/code-scanning/95)

### Thread 11: tools/claude-code-recovery/repair-jsonl-strip-images.ts:352 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:31:06Z):

The `--max-line-bytes` / `--max-image-bytes` flags are documented as byte thresholds, but this code compares against `ln.length` (UTF-16 code units) rather than the UTF-8 byte length. For non-ASCII content, this will misclassify lines near the threshold and make `--scan` / `--session` inconsistent with the stated units. Use `Buffer.byteLength(ln, "utf8")` (and similarly when computing line lengths in `scanFile`).

### Thread 12: tools/claude-code-recovery/repair-jsonl-strip-images.ts:272 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:31:07Z):

`scanFile` computes per-line “bytes” using string indices from `readFileSync(path, "utf8")`, which are not byte counts for UTF-8. Since the tool is explicitly thresholding in bytes, read the file as a `Buffer` (no encoding) and count bytes by scanning for `0x0A`, or compute each line’s size via `Buffer.byteLength` on slices.

### Thread 13: tools/claude-code-recovery/repair-jsonl-strip-images.ts:405 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:31:07Z):

`newContent.length` is used as “bytes” in the size delta log, but `.length` is characters (UTF-16 code units), while `sizeBefore` is bytes from `statSync`. Use `Buffer.byteLength(newContent, "utf8")` for accurate byte reporting (and to avoid negative/incorrect “saves …” output when non-ASCII appears).

### Thread 14: tools/claude-code-recovery/repair-jsonl-strip-images.ts:429 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:31:07Z):

`--apply` writes in-place via `writeFileSync(path, newContent)`. If the process is interrupted mid-write (crash / out-of-disk), this can leave the session file truncated/corrupted (even though a backup exists). Prefer writing to a temp file in the same directory and `renameSync` to replace atomically (and preserve original file mode/ownership as needed).

### Thread 15: tools/claude-code-recovery/repair-jsonl-strip-images.ts:256 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:31:08Z):

`processLine` says it annotates “the first container that lost images”, but the current logic annotates `attachment.prompt` whenever it exists, even if the actual drops happened in `message.content` or top-level `content`. This can add a synthetic text block to an unrelated container and fail to annotate the container that was actually modified. Track which container(s) had drops (e.g., have `apply(...)` return a boolean / record the first modified container reference) and call `annotate` on that specific container.

### Thread 16: .claude/skills/claude-session-recovery/SKILL.md:3 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:31:08Z):

Skill frontmatter `description` is significantly longer than the repo guidance to carve skill descriptions to <120 chars (see docs/ops/COST-REDUCTION-LESSONS.md:53-55 / 081KR50HA0008QG0R002ZNFQBZ). Consider shrinking this to a single carved sentence and move the trigger-phrase list into the body (it’s already present under “Specific trigger phrases”).

## General comments

### @chatgpt-codex-connector (2026-05-26T02:21:32Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
