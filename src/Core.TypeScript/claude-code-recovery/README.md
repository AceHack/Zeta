# Claude Code session recovery tools

Recover Claude Code sessions corrupted by oversize attachments
(commonly: a pasted image whose base64 encoding pushed a single JSONL
line past the harness session-load limit).

## When you need this

Symptoms reported by the operator:

- A previously-working Claude Code session won't reopen.
- An error message names a "size limit" / "too large" / "exceeds
  N bytes" on a specific session file.
- The session picker shows the session but clicking it does nothing
  or crashes the harness.
- The operator just pasted an image larger than ~5–10 MB into a
  conversation and the next reload failed.

If the operator says any of "session won't open" / "got corrupted
with an image too large" / "edit out the image" / "claude code crashed
loading", this tool applies.

## The tool

`repair-jsonl-strip-images.ts` — Bun-hosted TypeScript, dry-run by
default, refuses to write if any post-edit line fails to parse.

```bash
# Scan all sessions in the current project dir for oversize lines
bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts --scan

# Dry-run on one session (reports what would be stripped, no writes)
bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts --session <uuid>

# Commit the strip (auto-creates timestamped backup alongside the file)
bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts --session <uuid> --apply
```

Useful flags:

| Flag | Default | Purpose |
|---|---|---|
| `--scan` | — | Mutex with `--session`; reports all flagged sessions |
| `--session <uuid>` | — | Target one session JSONL |
| `--slug <slug>` | derived from `process.cwd()` (absolute path with `/` → `-`) | Override project dir slug |
| `--projects-dir <path>` | `~/.claude/projects` | Override projects dir |
| `--max-line-bytes <N>` | `10000000` (10 MB) | Inspect-line threshold |
| `--max-image-bytes <N>` | same as `--max-line-bytes` | Strip-image threshold (per individual image) |
| `--apply` | (off) | Without it, dry-run only |

**The two thresholds are intentionally separated.** `--max-line-bytes`
picks which JSONL lines to inspect at all (lines under this size are
skipped — they're not corrupted). `--max-image-bytes` picks which
images on the inspected lines get stripped. **Small images on an
oversize line are PRESERVED**; only images whose base64 length
individually exceeds `--max-image-bytes` are removed. This keeps the
strip surgical: if a corrupted turn contained a few small thumbnails
plus one 13 MB screenshot, only the screenshot is removed.

## How the strip preserves conversation integrity

The script removes only oversize `{"type": "image", ...}` blocks
from three known content arrays:

1. `attachment.prompt[]` (queued-command shape)
2. `message.content[]` (Anthropic user-turn shape)
3. top-level `content[]` (tool-result shape)

The line's `uuid` and `parentUuid` are preserved, so downstream
messages that reference the stripped line still have a valid parent
in the conversation graph. The first text block in the affected
container is annotated with `[N image(s) stripped YYYY-MM-DD: ~K KB
base64 removed to recover session]` so the operation is traceable.

## Operator-runs discipline

Editing `~/.claude/projects/*.jsonl` is harness-state modification.
The Claude Code auto-mode classifier blocks the agent from running
`--apply` directly (correctly — `.jsonl` edits are self-modification
territory).

The right shape is:

- **Agent (Claude)** composes / invokes the script in `--scan` and
  dry-run modes, identifies the corruption, recommends the fix.
- **Operator** runs the `--apply` invocation (the script's
  built-in backup makes this safe; the `--apply` is also visible
  in shell history for audit).

This split keeps `.jsonl` editing authority anchored to the operator
per the project's classifier-bypass + human-audit-attribution rules,
without requiring a settings.json `_*_acceptance` block for each
one-off recovery.

## Skill invocation

There is a `claude-session-recovery` skill at
[`.claude/skills/agent-runtime-and-persistence/blueprints/claude-session-recovery.md`](../../.claude/skills/agent-runtime-and-persistence/blueprints/claude-session-recovery.md)
that triggers on the symptoms above and walks through this tool.

## Empirical anchor

2026-05-25 — session `c2b77530-8ef0-405c-a0bd-04cf8d511cb6.jsonl`
("Assemble declarative infrastructure files for Zeta") had a 13.4 MB
line at 15230 from a 9.8 MB PNG attachment. Session would not reopen.
This tool was written in response and validated against that session.

## Composes with

- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`
  — the standing operator-self-constraint that bounds direct
  classifier-bypass; the operator-runs discipline above honors it
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`
  — the four-field attribution pattern that would scaffold a
  standing `_session_recovery_acceptance` block if this becomes
  recurring enough to want automation past the operator-runs gate
- User-scope memory `feedback_claude_code_session_jsonl_oversize_image_self_heal_recovery_pattern_classifier_blocks_claude_operator_runs_2026_05_25.md`
  — first authoring of the self-heal pattern + the c2b77530 anchor
