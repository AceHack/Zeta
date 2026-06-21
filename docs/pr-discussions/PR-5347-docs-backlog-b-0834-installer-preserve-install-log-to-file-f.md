---
pr_number: 5347
title: "docs(backlog): 081KSGS9H0008QG0R001RR3ZXQ \u2014 installer preserve install log to file (failures + warnings scroll past too fast; 3rd empirical anchor in same physical test session)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:04:48Z"
merged_at: "2026-05-26T23:06:48Z"
closed_at: "2026-05-26T23:06:48Z"
head_ref: "otto/b-0834-installer-preserve-failures-warnings-log-scrollback-empirical-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:30:32Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5347: docs(backlog): 081KSGS9H0008QG0R001RR3ZXQ — installer preserve install log to file (failures + warnings scroll past too fast; 3rd empirical anchor in same physical test session)

## PR description

## Summary

Per operator 2026-05-26: \"i got some failures and warings on install of nixos not sure if it matters it scrolled by to faster have gh login this is exactly what i'm hoping you can log and test in ci\"

## Two observations packed into one report

1. Install failures + warnings scrolled past faster than human read speed
2. gh login not reached; the scroll-past blocks diagnosis

## 2-approach scoping

| Approach | Scope | Code change |
|---|---|---|
| A (preferred) | tee install output to /tmp/zeta-install-*.log + copy to /mnt/var/log/zeta-install.log on completion | Small exec redirect at top of zeta-install.sh |
| B (upgrade) | script(1) wrapper records full session (ANSI + timing; replayable) | Wrapper script |

P2 priority — diagnostic enabler, not hard install blocker.

## The operator-side analog to 081KSGS9H0008QG0R0011BC7T2

081KSGS9H0008QG0R0011BC7T2 cascade #6 captures full serial console as workflow-artifact in CI. This row is the OPERATOR-SIDE analog: preserve the log on the install target so operator can review post-failure on real hardware, BEFORE 081KSGS9H0008QG0R0011BC7T2 lands.

## 3 empirical anchors in 1 test session

| Row | Anchor |
|---|---|
| 081KSGS9H0008QG0R001Q2DH2H | nmtui WiFi rescan needed (dense-WiFi 20+ networks) |
| 081KSGS9H0008QG0R003JNSVR5 | interactive-login vs baked-in-keys CI-test tension |
| 081KSGS9H0008QG0R001RR3ZXQ (this PR) | install log scroll-past-too-fast |

Strong validation of 081KSGS9H0008QG0R0011BC7T2's reframing within minutes of its own landing: physical-test-as-first-class-hardware-compatibility-matrix-substrate produces real-world substrate-engineering targets that CI emulation cannot reproduce.

## Test plan

- [x] markdownlint clean
- [x] BACKLOG.md regenerated
- [x] Composes_with 081KSGS9H0008QG0R002T3BJ2R + 081KSGS9H0008QG0R0011BC7T2 + 081KSGS9H0008QG0R001Q2DH2H + 081KSGS9H0008QG0R003JNSVR5 + zeta-install.sh + zeta-first-boot.sh

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T23:04:54Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
