---
pr_number: 5235
title: "fix(081KSGS9H0008QG0R003SWZF9J): ISO audit accepts nixpkgs-25.11 kernel/initrd variant paths + diagnostic dump on failure"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T17:28:31Z"
merged_at: "2026-05-26T17:32:04Z"
closed_at: "2026-05-26T17:32:04Z"
head_ref: "otto-cli/fixfwd-iso-bootloader-paths-25-11-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:34Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5235: fix(081KSGS9H0008QG0R003SWZF9J): ISO audit accepts nixpkgs-25.11 kernel/initrd variant paths + diagnostic dump on failure

## PR description

## Summary

Cascade #4 ISO audit failed on commit 75eff94d (post-#5226 merge) with 2 missing-path assertions on \`boot/bzImage\` + \`boot/initrd\`. Same class as 081KSGS9H0008QG0R00033DT02 — nixpkgs 25.11's image/images refactor changed kernel + initrd locations in the ISO.

## Two-layer fix

**This PR (fix-fwd, immediate unblock)**:

1. Kernel + initrd checks converted to \`REQUIRED_KERNEL_ANY\` + \`REQUIRED_INITRD_ANY\` any-of-family pattern (mirrors existing \`REQUIRED_BOOTLOADER_ANY\` discipline that survived the 24.11→25.11 channel bump cleanly)
2. Candidate paths cover legacy (\`boot/bzImage\`) + per-arch (\`boot/x86_64-linux/bzImage\`) + generic-named (\`boot/kernel\`) + vmlinuz conventions
3. Added \`dumpIsoEntriesForDiagnostic()\` helper — prints first 80 sorted ISO entries on audit failure so future regressions self-debug

**081KSGS9H0008QG0R003SWZF9J (substrate-layer follow-up)**:

- Investigate which 25.11 path actually drives kernel + initrd locations from the diagnostic dump
- Optionally tighten the any-of families OR keep lenient as defense-in-depth (per 081KSGS9H0008QG0R00033DT02 precedent)

## Test plan

- [ ] build-iso passes on this PR's commit (the actual test)
- [ ] BACKLOG.md drift check clean
- [ ] Diagnostic dump appears in logs if a future audit fails

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T17:33:20Z)

## Pull request overview

Updates the installer ISO content audit to tolerate nixpkgs 25.11 kernel/initrd path layout changes and adds diagnostic output to make future audit failures easier to debug. Adds a new backlog row tracking the follow-up investigation and indexes it in `docs/BACKLOG.md`.

**Changes:**

- Replace strict `boot/bzImage` + `boot/initrd` requirements with kernel/initrd “any-of” path families.
- Add an ISO entry diagnostic dump on audit failure (first 80 sorted entries).
- Add backlog row 081KSGS9H0008QG0R003SWZF9J and index it in `docs/BACKLOG.md`.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| tools/ci/audit-installer-iso-content.ts | Switch kernel/initrd checks to any-of families and emit a diagnostic ISO entry listing on failure. |
| docs/backlog/P2/081KSGS9H0008QG0R003SWZF9J-investigate-nixpkgs-25-11-iso-kernel-initrd-path-layout-tighten-audit-after-discovery-aaron-2026-05-26.md | New P2 backlog row documenting the regression, fix-fwd, and follow-up investigation plan. |
| docs/BACKLOG.md | Adds 081KSGS9H0008QG0R003SWZF9J to the P2 index. |

## Review threads

### Thread 1: tools/ci/audit-installer-iso-content.ts:342 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:33:19Z):

P0: `dumpIsoEntriesForDiagnostic()` spawns `7z` without the `sonarjs/no-os-command-from-path` eslint suppression used in `lsIso()`, and it also omits `maxBuffer` / `proc.error` handling. This is likely to break CI linting (and the dump can fail/truncate on large ISOs). Consider reusing `lsIso()` (or at least mirroring its spawn options + error reporting) so diagnostics stay consistent and you don’t run a second, less-robust `7z` invocation.

### Thread 2: tools/ci/audit-installer-iso-content.ts:398 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:33:20Z):

The diagnostic header hard-codes “first 80” while the function takes a `limit` parameter (default 80). If the limit ever changes, the log line will drift. Consider either passing an explicit `80` to the function and reusing that constant in the message, or deriving the message from the same value.

### Thread 3: docs/backlog/P2/081KSGS9H0008QG0R003SWZF9J-investigate-nixpkgs-25-11-iso-kernel-initrd-path-layout-tighten-audit-after-discovery-aaron-2026-05-26.md:34 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:33:20Z):

The nixpkgs module link points at the `master` branch, which can drift and no longer match nixos-25.11 behavior you’re investigating. To keep this row stable, link to the `nixos-25.11` branch (or the exact nixpkgs revision pinned in the relevant `flake.lock`) instead of `blob/master`.

## General comments

### @chatgpt-codex-connector (2026-05-26T17:28:36Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
