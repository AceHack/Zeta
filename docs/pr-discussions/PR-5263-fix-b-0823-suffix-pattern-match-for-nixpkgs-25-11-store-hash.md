---
pr_number: 5263
title: "fix(081KSGS9H0008QG0R003SWZF9J): suffix-pattern match for nixpkgs 25.11 store-hashed kernel/initrd paths"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T17:54:20Z"
merged_at: "2026-05-26T18:03:19Z"
closed_at: "2026-05-26T18:03:19Z"
head_ref: "otto-cli/b0823-iso-suffix-match-25-11-store-hashed-paths-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:35:44Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5263: fix(081KSGS9H0008QG0R003SWZF9J): suffix-pattern match for nixpkgs 25.11 store-hashed kernel/initrd paths

## PR description

## Summary

Diagnostic dump from build run [26465084701](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/26465084701) confirmed nixpkgs 25.11 places kernel + initrd at **store-hashed paths**:

\`\`\`
kernel: boot/nix/store/<hash>-linux-<version>/bzImage
initrd: boot/nix/store/<hash>-initrd-linux-<version>/initrd
\`\`\`

The hash varies per build, so exact-path lookup IS impossible by construction.

## Fix

Converted \`REQUIRED_KERNEL_ANY\` + \`REQUIRED_INITRD_ANY\` from exact-path to **suffix-pattern matching**:

\`\`\`typescript
{prefix: \"boot/\", suffix: \"/bzImage\"}   // matches any boot/...path.../bzImage
{prefix: \"boot/\", suffix: \"/initrd\"}    // matches any boot/...path.../initrd
\`\`\`

Handles both legacy (24.11 \`boot/bzImage\` at top-level) AND new (25.11 store-hashed \`boot/nix/store/<hash>-linux-<ver>/bzImage\`) layouts uniformly.

Added \`matchesAny()\` helper — generic suffix-pattern matcher (\`entry.startsWith(prefix) AND entry.endsWith(suffix)\`).

## Composes with

- 081KSGS9H0008QG0R003SWZF9J (substrate-layer follow-up; now empirically confirmed via diagnostic dump)
- 081KSGS9H0008QG0R00033DT02 (sibling 25.11 isoName regression — same root cause class; same fix-pattern)
- 081KSGS9H0008QG0R001EKTS5A (nixpkgs 25.11 EOL recovery)

The diagnostic dump pattern (from #5251) worked as designed — revealed actual 25.11 paths on first failure, enabling targeted fix without log-archaeology.

## Test plan

- [ ] build-iso passes on this PR's commit (the actual test)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T17:56:29Z)

## Pull request overview

Updates the installer ISO content audit to tolerate nixpkgs 25.11’s store-hashed kernel/initrd paths by switching from exact-path checks to prefix+suffix pattern matching, so CI can still assert the ISO is bootable across channel bumps.

**Changes:**

- Converted kernel/initrd “any-of” checks from exact `path` matches to `{ prefix, suffix }` pattern candidates.
- Added a local `matchesAny()` helper to check ISO entries via `startsWith(prefix) && endsWith(suffix)`.
- Updated failure messages to report pattern candidates (e.g., `boot/*/bzImage`) instead of exact paths.

## Review threads

### Thread 1: tools/ci/audit-installer-iso-content.ts:122 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:56:28Z):

The "legacy exact-path" candidate uses {prefix: "", suffix: "boot/bzImage"}, but the matcher only checks startsWith/endsWith, so this is not actually an exact match (it would also match e.g. "some/dir/boot/bzImage"). If you need an exact legacy check, either constrain prefix to "boot/" (or remove this entry since the {prefix:"boot/", suffix:"/bzImage"} candidate already covers "boot/bzImage"), or special-case exact matching when prefix is empty.

### Thread 2: tools/ci/audit-installer-iso-content.ts:128 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:56:29Z):

Same issue as the kernel legacy entry: {prefix: "", suffix: "boot/initrd"} is described as an exact legacy check, but the matcher will accept any path that merely ends with "boot/initrd". Consider using prefix "boot/" (or relying on the existing {prefix:"boot/", suffix:"/initrd"} which already matches "boot/initrd") if you want to avoid false positives.

## General comments

### @chatgpt-codex-connector (2026-05-26T17:54:26Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
