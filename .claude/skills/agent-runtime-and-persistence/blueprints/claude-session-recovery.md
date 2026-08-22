---
name: claude-session-recovery
description: Recover a Claude Code session that won't reopen because a pasted image overflowed the JSONL line-load limit.
---

# Claude session recovery — repair JSONL corrupted by oversize image attachments

## When to invoke this skill

The operator describes a Claude Code session that won't reopen, mentions
an image that was "too large" or a specific size (e.g. "12.8 MB"), reports
a session crash on load, asks to "edit out the image", or asks for help
recovering a session that just burned.

Specific trigger phrases:

- "session won't open" / "won't load" / "won't reopen"
- "claude code crashed loading <session>"
- "session corrupted" / "session is corrupted"
- "image too large" / "image too big" / "<N>MB image broke it"
- "edit out the image" / "strip the image" / "remove the image"
- "recover claude session" / "repair claude session" / "fix the session"
- "we'd lose hours of work" / "this conversation is important" in the
  context of an unopenable session

## The procedure

### Step 1 — Find which session is corrupted

If the operator named the session by title, find it via the title text.
Claude Code projects live at `~/.claude/projects/<slug>/` where `<slug>`
is the project's absolute path with `/` replaced by `-` (e.g.
`/Users/alice/code/foo` → `-Users-alice-code-foo`):

```bash
SLUG=$(pwd | tr '/' '-')   # derive from current project root
grep -l -i "<phrase the operator remembers>" \
  ~/.claude/projects/"$SLUG"/*.jsonl 2>/dev/null
```

If the operator did not name a phrase, scan the whole project dir:

```bash
bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts --scan
```

The `--scan` output lists every session with at least one JSONL line
above the 10 MB default threshold, with the line number(s) flagged
and the suggested repair command. Pick the session that matches the
operator's description (typically the most recently active or the one
whose title matches their work).

### Step 2 — Dry-run on the target session

```bash
bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts \
  --session <uuid>
```

This reports what would be stripped without writing anything. Confirm:

- The line number(s) reported match what the operator described
- The per-image sizes reported (e.g. `[13MB]`) match what the
  operator described as too large
- The "preserved N smaller image(s)" note is non-zero if the line had
  a mix of large + small images (confirms small images stay intact)
- The post-edit JSON validation passes ("refusing to apply" message
  does NOT fire)
- The size delta looks substantial (recovered sessions typically drop
  10+ MB)

**Per-image vs per-line threshold**: `--max-line-bytes` (default 10MB)
picks which lines to inspect; `--max-image-bytes` (default = same)
picks which images on those lines actually get stripped. To preserve
the 13MB image but still find the line, run with
`--max-image-bytes 20000000` — the line will be inspected but no
image will be stripped (useful for confirming the script's detection
without committing to a strip).

If the dry-run reports `no oversize images found`, the corruption is
something other than an oversize image — investigate
further before recommending a fix.

### Step 3 — Operator runs --apply

The Claude Code auto-mode classifier blocks the agent from running
the `--apply` invocation directly. This is correct per
`.claude/rules.bak/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`
— editing `.jsonl` files in `~/.claude/projects/` is harness-state
modification + needs operator-level authorization beyond chat agreement.

Hand the exact command to the operator:

```bash
bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts \
  --session <uuid> \
  --apply
```

The script's built-in backup (`<file>.bak-YYYY-MM-DD-<epoch>`) makes
the operation reversible. After the operator confirms it ran, suggest
they reload the session in Claude Code (close + reopen, or click in
the session picker).

### Step 4 — Verify recovery

If the operator reports the session reopens after the strip, the
recovery succeeded. The affected turn will now show a text-only
version with an annotation like `[N image(s) stripped YYYY-MM-DD:
~K KB base64 removed to recover session]` where the image used to be.

If the session still won't open, run `--scan` again — the corruption
may be on another line, or may be something other than an oversize
image. Investigate the unparseable / oversize lines manually.

## What this skill does NOT do

- It does NOT recover other corruption classes (malformed JSON,
  truncated files, missing required fields). The script handles
  oversize-image-attachment corruption specifically.
- It does NOT undo a successful recovery — if the operator wants
  the image back, restore from the `.bak` file the script created.
- It does NOT run `--apply` autonomously even when the operator says
  "fix it." The classifier block is part of the safety substrate; the
  operator-runs split keeps `.jsonl` editing authority with the
  operator. The skill ALWAYS hands the `--apply` command to the
  operator to run.

## Operator-runs discipline (why the split exists)

The Claude Code auto-mode classifier treats edits to
`~/.claude/projects/*.jsonl` as self-modification / memory-tampering
territory. This is correct: the agent's session transcript is the
substrate the agent reasons from; the agent rewriting its own
substrate is exactly the failure mode the classifier exists to
prevent.

The split is:

- **Agent**: investigation (scan, dry-run, inspect line structure,
  verify UUID references, recommend strip-or-delete decision)
- **Operator**: execution (the `--apply` run, with backup + audit
  trail in shell history)

This split keeps the substrate-honest accountability anchored to the
operator without requiring a full
`_session_recovery_acceptance` block in `.claude/settings.json` per
the human-audit-attribution rule.

## Composes with

- `src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts` — the
  script this skill drives
- `src/Core.TypeScript/claude-code-recovery/README.md` — full tool documentation
- `.claude/rules.bak/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`
  — the standing operator-self-constraint that mandates the
  operator-runs split for `--apply`
- `.claude/rules.bak/human-audit-and-legal-risk-acceptance-pattern-in-settings.md`
  — the four-field attribution scaffold (would apply if this becomes
  recurring enough to want automation past operator-runs)
- `.claude/rules.bak/verify-before-deferring.md` — verify the target
  exists + is in the state you expect before recommending any action

## Empirical anchor

2026-05-25 — session `c2b77530-8ef0-405c-a0bd-04cf8d511cb6.jsonl`
("Assemble declarative infrastructure files for Zeta") had a 13.4 MB
line at 15230 from a 9.8 MB PNG attachment. The session would not
reopen in Claude Code. This skill + the underlying script were
authored in response and dry-run-validated against that session
before the operator ran `--apply`.
