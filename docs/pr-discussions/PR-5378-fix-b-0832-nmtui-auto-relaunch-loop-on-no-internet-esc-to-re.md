---
pr_number: 5378
title: "fix(081KSGS9H0008QG0R001Q2DH2H): nmtui auto-relaunch loop on no-internet \u2014 Esc to refresh without breaking install (operator 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:01:46Z"
merged_at: "2026-05-27T02:16:37Z"
closed_at: "2026-05-27T02:16:37Z"
head_ref: "fix-b0832-nmtui-auto-relaunch-on-no-internet-aaron-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:28:49Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5378: fix(081KSGS9H0008QG0R001Q2DH2H): nmtui auto-relaunch loop on no-internet — Esc to refresh without breaking install (operator 2026-05-26)

## PR description

## What

Operator 2026-05-26 during 3rd USB physical test: *"i want to be able to refresh the network withing breaking the script"*.

Old behavior: nmtui launched ONCE; if no internet on exit → drop_to_shell (broke install flow). Esc was destructive.

New behavior: loop nmtui until \`has_internet\` OR operator explicit 's' for shell. Esc out refreshes; 's' escape-hatch preserved.

## Operator flow

- **Esc out of nmtui without connecting** → nmtui re-launches with fresh wifi scan (operator can refresh as needed)
- **Connect successfully** → script continues to zeta-install
- **Need shell access** → press 's' at the post-attempt prompt within 10s

\`NMTUI_ATTEMPTS\` counter tracks session count + logs in success message ("wifi ok (after N nmtui session(s))").

## Composes with

- 081KSGS9H0008QG0R001Q2DH2H (nmtui WiFi rescan empirical anchor row)
- \`.claude/rules/non-coercion-invariant.md\` HC-8 (operator agency preserved via 's' escape-hatch)
- \`.claude/rules/substrate-or-it-didnt-happen.md\` (substrate-honest UX matches operator's Esc-to-refresh expectation)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T02:03:25Z)

## Pull request overview

This PR updates the first-boot USB NixOS installer flow to prevent an accidental “Esc out of nmtui → drop to shell” path when Wi‑Fi isn’t connected yet, by auto-relaunching `nmtui` until internet is detected (or the operator explicitly requests a shell).

**Changes:**
- Loop `nmtui` sessions until `has_internet` succeeds, tracking attempts via `NMTUI_ATTEMPTS`.
- Add an explicit post-attempt prompt allowing operator-controlled escape to shell via `s` (otherwise relaunch `nmtui` to refresh scans).
- Improve on-screen guidance explaining the Esc-to-refresh behavior.

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh:165 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T02:03:25Z):

The retry prompt hard-codes the timeout value ("within 10s" in the message and `read ... -t 10` in code). This can drift if the timeout is adjusted later. Consider introducing a single `NMTUI_RETRY_PROMPT_SECS` (similar to `ROLE_PROMPT_SECS`) and use it in both the echo text and the `read -t` value.

## General comments

### @chatgpt-codex-connector (2026-05-27T02:01:51Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
