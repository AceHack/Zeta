---
pr_number: 5349
title: "docs(backlog) + fix(login-banner): 081KSGS9H0008QG0R00120EEHM \u2014 installer config-bugs cluster (CORE: post-boot fully-operational chain without operator login; 5 sub-failures; CRITICAL self-reg didn't happen)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:08:16Z"
merged_at: "2026-05-26T23:11:53Z"
closed_at: "2026-05-26T23:11:53Z"
head_ref: "otto/b-0835-installer-three-config-bugs-hostname-gh-auth-banner-password-empirical-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:30:31Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5349: docs(backlog) + fix(login-banner): 081KSGS9H0008QG0R00120EEHM — installer config-bugs cluster (CORE: post-boot fully-operational chain without operator login; 5 sub-failures; CRITICAL self-reg didn't happen)

## PR description

## Summary

Per operator 2026-05-26 across 5 messages from active physical hardware-support test:

**CORE REQUIREMENT**: \"i should not have to log in for any of this to start that defeats the purpose the machine should be fully operational after usb install and reboot no need for me to login it self registers and creates/joins cluster without intervention.\"

## 5 sub-failures empirically anchored

| Bug | Severity | Status |
|---|---|---|
| 1 — hostname is \`control-plane\` not unique \`node-<6hex>\` | P1 noise | Diagnosis required |
| 2 — gh login not respected | P1 cascade | Likely cascade with Bug 4 |
| 3a — login banner shows password text (display) | P1 fix-now | **Fixed in this PR** |
| 3b — custom password operationally ignored | **P0 root-caused** | Requires separate fix (timing/path-mismatch) |
| 4 — self-registration to maintainers/aaron/cluster-nodes/ did NOT happen | **CRITICAL** | Verified via gh api — dir doesn't exist on repo |

## Bug 3b root cause

Timing mismatch in `initial-password.nix`:

- `zeta-install.sh` writes hash to `/mnt/etc/zeta/initial-hashedpassword` ✓
- `initial-password.nix` reads `/etc/zeta/initial-hashedpassword` via `builtins.readFile` at flake EVAL TIME
- Flake pure-mode + path-mismatch: eval can't see `/mnt/etc/zeta/` as `/etc/zeta/`; falls back to default hash
- Installed system has the file at the right path BUT user config was built with `fallbackHash`

## What this PR lands

1. **081KSGS9H0008QG0R00120EEHM backlog row** capturing the full bug-cluster + root cause + diagnostic guidance + scoping
2. **Small fix to login-banner.nix** removing the hardcoded `password: zeta-change-me` line (Bug 3a; security/UX gain at every login)

What this PR does NOT land (needs follow-up):

- Bug 3b operational fix (move password apply to activation-time OR use --impure flag at install OR write hash to flake source tree)
- Bug 4 cluster-register-chain diagnosis + fix (composes with 081KSGS9H0008QG0R001RR3ZXQ install log preservation)

## 5 empirical anchors in 1 physical test session

081KSGS9H0008QG0R001Q2DH2H + 081KSGS9H0008QG0R003JNSVR5 + 081KSGS9H0008QG0R001RR3ZXQ + 081KSGS9H0008QG0R00120EEHM with 4 sub-bugs = 7 substrate-engineering targets surfaced from one physical hardware-support test — strong validation of 081KSGS9H0008QG0R0011BC7T2's reframing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T23:12:29Z)

## Pull request overview

This PR documents the 081KSGS9H0008QG0R00120EEHM installer configuration bug cluster from a physical hardware-support test and makes a small NixOS login-banner change to stop displaying a default password on running systems.

**Changes:**

- Adds a new P1 backlog row for installer hostname, gh-auth, password, and self-registration failures.
- Adds 081KSGS9H0008QG0R00120EEHM to the generated backlog index.
- Updates the NixOS getty login banner to avoid showing `zeta-change-me`.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 6 comments.

| File | Description |
| ---- | ----------- |
| `full-ai-cluster/nixos/modules/login-banner.nix` | Replaces the displayed default password with install-time-only guidance. |
| `docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md` | Adds the backlog row describing the installer bug cluster and diagnostics. |
| `docs/BACKLOG.md` | Adds the 081KSGS9H0008QG0R00120EEHM entry to the P1 backlog index. |

## Review threads

### Thread 1: docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md:24 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:12:27Z):

P1: These cross-references are currently dangling: no 081KSGS9H0008QG0R003JNSVR5 or 081KSGS9H0008QG0R001RR3ZXQ backlog row exists under docs/backlog/P0, P1, or P2 in this branch. Either add those rows in the same PR or remove/defer the references so the backlog graph does not point at missing work items.

### Thread 2: docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md:23 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:12:28Z):

P1: This opening still frames the row as three bugs and anchors 4th/5th/6th, but the same row later adds Bug 3b and Bug 4, and the PR description frames this as five sub-failures. Please reconcile the counts here and in the later summary sections so the backlog row matches the actual scope.

### Thread 3: docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md:55 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:12:28Z):

P1: This hypothesis is contradicted by the current module: full-ai-cluster/nixos/modules/injected-hostname.nix:50-57 uses `lib.mkOverride 50`, not `mkDefault`, and that priority should beat an unmodified `networking.hostName = "control-plane"` assignment. Keeping this as a likely failure mode will send diagnosis toward the wrong fix; update it to reflect the actual priority behavior or point to the real suspected cause.

### Thread 4: docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md:71 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:12:28Z):

P1: The gh-auth diagnostic points at `/etc/zeta/operator-ssh-keys.nix`, but the iter-5.4.0 gh-auth path writes `/mnt/etc/zeta/operator-authorized-keys` and common.nix imports `operator-authorized-keys.nix` to read `/etc/zeta/operator-authorized-keys`. As written, this command would miss the file that actually proves whether the gh-auth pubkey capture succeeded.

### Thread 5: docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md:202 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:12:29Z):

P1: This repeats the wrong file path for the gh-auth path. The installed-system evidence for Step 6.8 is `/etc/zeta/operator-authorized-keys`; `/etc/zeta/operator-ssh-keys.nix` is not the file written by `gh ssh-key list`, so this diagnostic will produce a false negative for Bug 2.

### Thread 6: docs/backlog/P1/081KSGS9H0008QG0R00120EEHM-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md:194 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:12:29Z):

P1: This diagnostic branch still assumes a flake-priority override, but `injected-hostname.nix` uses `mkOverride 50`, which should override the plain per-host `networking.hostName` assignments. If this state occurs, the row should direct investigation at module import/evaluation/path behavior (or another verified cause), not at changing a priority that is already stronger than the host assignment.

## General comments

### @chatgpt-codex-connector (2026-05-26T23:08:20Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
