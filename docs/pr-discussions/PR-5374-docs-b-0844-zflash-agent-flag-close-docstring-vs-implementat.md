---
pr_number: 5374
title: "docs(081KSGS9H0008QG0R001EZKNCB): zflash --agent flag \u2014 close docstring-vs-implementation gap on agent-driven mode"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T01:53:46Z"
merged_at: "2026-05-27T01:55:08Z"
closed_at: "2026-05-27T01:55:08Z"
head_ref: "feat-b0844-zflash-agent-mode-pty-auto-type-challenge-otto-cli-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:28:52Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5374: docs(081KSGS9H0008QG0R001EZKNCB): zflash --agent flag — close docstring-vs-implementation gap on agent-driven mode

## PR description

## What

Empirical anchor 2026-05-26: 3rd USB re-flash session surfaced a docstring-vs-implementation gap in zflash.ts.

Operator authorized agent-driven zflash with Touch ID. Agent ran \`bun zflash.ts | tail -50\` which:

1. Generated nonce + printed challenge
2. Touch ID PAM gate fired (operator approved)
3. \`readline.question("> ")\` returned empty string (stdin closed by \`| tail\`)
4. flash-usb.ts bail'd silently (error swallowed by tail filter)
5. zflash caught non-zero exit BUT iter-4.2 inject still ran on PRE-EXISTING USB ESP
6. Operator saw "safe to remove USB" — believed flash succeeded
7. Boot attempt failed: *"i got the fingerprint but it didn't format"*

## Root cause

zflash.ts docstring (lines 56-63) promises:

> "Agent-driven mode: When the runner is an authorized agent acting on the operator's behalf per the flash-usb.ts authorship contract, the agent auto-types the \`yes <nonce>\` challenge."

But the IMPLEMENTATION uses \`execFileSync({stdio: "inherit"})\` with NO actual auto-type mechanism. Per \`substrate-or-it-didnt-happen.md\`: the docstring promise was WEATHER not SUBSTRATE.

## Target

Add \`--agent\` flag to zflash.ts that uses \`spawn\` with piped stdin/stdout — reads stdout for "yes <nonce>" line, auto-types response back to stdin, passes everything through.

~30-line change. No new deps. Backward-compatible (default behavior unchanged).

## Preserves all safety rails

- **Touch ID PAM gate** — fires on operator's Mac for \`sudo dd\`; cannot be agent-bypassed
- **Nonce randomness** — random per-run; agent reads from stdout, can't pre-bake
- **Runtime acceptance** — agent typing the EXACT challenge IS the acceptance signal
- **Glass-halo transparency** — operator sees \`[agent-mode: auto-typing 'yes XXXX']\` line so the auto-type action is visible

## Workaround (used in session)

External \`expect\` wrapper worked end-to-end (Flash complete; 1.51 GiB in 80s; iter-4.2 inject clean). But external dep is fragile + agent-driven mode IS PROMISED in docstring — should be native.

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R (iter-4.2 ssh-pubkey-injection substrate — same zflash codebase)
- \`.claude/rules/substrate-or-it-didnt-happen.md\` (docstring promises must have backing implementation)
- \`.claude/rules/glass-halo-bidirectional.md\` (operator-visibility of auto-type action)
- \`.claude/rules/non-coercion-invariant.md\` HC-8 (operator agency preserved via Touch ID)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T01:55:47Z)

## Pull request overview

Adds a new P1 backlog row (081KSGS9H0008QG0R001EZKNCB) documenting a docstring-vs-implementation gap in `zflash.ts` around “agent-driven mode” and outlining an implementation plan for a native `--agent` flag, plus updates the generated backlog index to reference the new row.

**Changes:**

- Added `docs/backlog/P1/081KSGS9H0008QG0R001EZKNCB-...md` with problem statement, root cause, acceptance criteria, and an implementation sketch for `zflash --agent`.
- Updated `docs/BACKLOG.md` to include the new 081KSGS9H0008QG0R001EZKNCB entry under P1.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KSGS9H0008QG0R001EZKNCB-zflash-agent-mode-native-implementation-close-doc-vs-implementation-gap-aaron-2026-05-26.md | New backlog row capturing the zflash agent-mode issue, workaround, and target implementation/acceptance criteria. |
| docs/BACKLOG.md | Adds the 081KSGS9H0008QG0R001EZKNCB link into the P1 index list. |

## Review threads

### Thread 1: docs/BACKLOG.md:401 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T01:55:46Z):

`docs/BACKLOG.md` is documented as a generated file (“DO NOT EDIT”). To avoid index drift, update it by running `tools/backlog/generate-index.sh` (and committing the regenerated output) rather than making manual edits, even for a one-line addition.

### Thread 2: docs/backlog/P1/081KSGS9H0008QG0R001EZKNCB-zflash-agent-mode-native-implementation-close-doc-vs-implementation-gap-aaron-2026-05-26.md:23 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T01:55:47Z):

Spelling/grammar: “bail'd” reads like a typo and is a bit unclear in this context. Consider changing to “bailed” (or a clearer verb like “exited early”) so the failure mode description is unambiguous.

## General comments

### @chatgpt-codex-connector (2026-05-27T01:53:50Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
