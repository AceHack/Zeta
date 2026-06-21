---
pr_number: 5226
title: "fix(081KSGS9H0008QG0R00033DT02): ISO build audit-glob accepts nixpkgs-25.11 default name + file 081KSGS9H0008QG0R00033DT02 substrate fix"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T17:04:15Z"
merged_at: "2026-05-26T17:17:01Z"
closed_at: "2026-05-26T17:17:01Z"
head_ref: "otto-cli/fixfwd-iso-name-25-11-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5226: fix(081KSGS9H0008QG0R00033DT02): ISO build audit-glob accepts nixpkgs-25.11 default name + file 081KSGS9H0008QG0R00033DT02 substrate fix

## PR description

## Summary

PR #5222 (glxinfo P0 fix-fwd) merged successfully, but the post-merge build-iso job failed because nixpkgs 25.11 produces the ISO as \`nixos-minimal-25.11.20260522.b77b3de-x86_64-linux.iso\` (nixpkgs default name) instead of \`zeta-installer-25.11.iso\` (our \`lib.mkForce\`'d name).

**Probable root cause**: nixpkgs 25.11's image/images refactor (PRs [#359345](https://github.com/NixOS/nixpkgs/pull/359345) + [#372127](https://github.com/NixOS/nixpkgs/pull/372127)) unified ISO naming through \`image.baseName\`; our \`isoImage.isoName\` mkForce override may no longer flow through correctly.

## Two-layer fix

**This PR (fix-fwd, immediate unblock)**:
- \`.github/workflows/build-ai-cluster-iso.yml\` audit glob accepts EITHER \`zeta-installer-*.iso\` OR \`nixos-minimal-*.iso\`
- \`.github/workflows/build-installer-iso.yml\` same fix
- Updated error messages cite 081KSGS9H0008QG0R00033DT02 for the substrate-layer fix
- ISO content is correct; only filename pattern changed

**081KSGS9H0008QG0R00033DT02 (substrate-layer follow-up)**:
- Investigate which 25.11 option actually drives the ISO filename (\`image.baseName\` / \`system.nixosLabel\` / both)
- Update \`configuration.nix\` with correct override
- Optionally tighten the workflow glob back once landed

## Composes with

- 081KSGS9H0008QG0R001EKTS5A (nixpkgs 25.11 EOL recovery — #5218 + #5222)
- 081KSGS9H0008QG0R003A37Z65 (cross-distro portability — Zeta-branded ISO is substrate-honest detail)

## Test plan

- [ ] build-ai-cluster-iso passes on this PR's commit
- [ ] build-installer-iso passes on this PR's commit
- [ ] Produced ISO content unchanged (only audit glob loosened)
- [ ] 081KSGS9H0008QG0R00033DT02 row indexes correctly in BACKLOG.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T17:07:14Z)

## Pull request overview

This PR unblocks post-merge ISO build workflows after the nixpkgs 25.11 bump changed the default ISO filename (from the Zeta-branded `zeta-installer-*.iso` to nixpkgs’ `nixos-minimal-*.iso`), while tracking the substrate-layer root-cause investigation via a new backlog row.

**Changes:**
- Loosened the ISO “audit/locate” glob in the installer ISO workflows to accept either `zeta-installer-*.iso` or `nixos-minimal-*.iso`.
- Updated workflow error messages to reference 081KSGS9H0008QG0R00033DT02 for the follow-up substrate fix.
- Added backlog row 081KSGS9H0008QG0R00033DT02 documenting the investigation target and candidate fixes for restoring the intended ISO name override.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| `docs/backlog/P2/081KSGS9H0008QG0R00033DT02-investigate-isoname-mkforce-not-sticking-on-nixpkgs-25-11-aaron-2026-05-26.md` | New backlog row capturing the 25.11 ISO naming regression and follow-up substrate work. |
| `.github/workflows/build-installer-iso.yml` | Update ISO discovery/audit glob (build + release-attach paths) to accept nixpkgs 25.11 default ISO name. |
| `.github/workflows/build-ai-cluster-iso.yml` | Update ISO discovery/audit glob to accept nixpkgs 25.11 default ISO name and keep audit steps unblocked. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T17:11:13Z)

## Pull request overview

Copilot reviewed 4 out of 4 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: docs/backlog/P2/081KSGS9H0008QG0R00033DT02-investigate-isoname-mkforce-not-sticking-on-nixpkgs-25-11-aaron-2026-05-26.md:23 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:07:14Z):

The row cites `configuration.nix` “line 284” as the `isoImage.isoName` override, but in the referenced file line ~284 is `unitConfig` and the `isoImage` block is currently around lines 289–294. Please update the line-number reference so future readers can jump to the right location.

### Thread 2: docs/backlog/P2/081KSGS9H0008QG0R00033DT02-investigate-isoname-mkforce-not-sticking-on-nixpkgs-25-11-aaron-2026-05-26.md:89 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T17:07:14Z):

The documented command `grep -rn "isoName\|image.baseName" ...` is not portable on BSD/macOS `grep` (the `\|` alternation won’t work without `-E`), which can lead to a false “no matches” conclusion in the substrate-inventory pass. Consider switching to `grep -rnE 'isoName|image\.baseName' ...` or using `rg` with a proper alternation regex.

## General comments

### @chatgpt-codex-connector (2026-05-26T17:04:20Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-26T17:08:35Z)

This PR appears to be a reasonable and well-documented fix for the ISO build failure. The changes are consistent with the description. The only drift detected is that Otto is not broadcasting its status, but the work itself seems correct.
