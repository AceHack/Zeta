---
pr_number: 4907
title: "fix(infra): pin nix-darwin to nix-darwin-24.11 release branch"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T03:51:09Z"
merged_at: "2026-05-25T03:58:16Z"
closed_at: "2026-05-25T03:58:16Z"
head_ref: "fix/nix-darwin-pin-to-2411-release-branch"
base_ref: "main"
archived_at: "2026-05-27T19:51:45Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4907: fix(infra): pin nix-darwin to nix-darwin-24.11 release branch

## PR description

## Summary

Hot-fix: pin \`nix-darwin\` input to the release branch matching our nixpkgs pin (\`nix-darwin-24.11\` ↔ \`nixos-24.11\`).

## Why now

CI (\`build-installer-iso\` workflow from PR #4905) caught this on \`nix flake check\`:

\`\`\`
error:
  nix-darwin and Nixpkgs branches in use must match, but you are
  currently using nix-darwin master with Nixpkgs nixos-24.11
\`\`\`

PR #4906 (which added the nix-darwin input) pinned it to \`master\` based on stale guidance. nix-darwin > 25.x added a hard assertion enforcing branch-match.

## Composes with

- #4906 (added the nix-darwin input — this fix corrects the pin)
- #4905 (the CI workflow that surfaced the bug — should pass on next re-trigger after this lands)

## Test plan

- [ ] \`nix flake check\` evaluates cleanly on \`origin/main\` after merge
- [ ] PR #4905's \`build-iso\` job passes on next CI run

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T03:53:09Z)

## Pull request overview

Pins the `nix-darwin` flake input to the `nix-darwin-24.11` release branch so it matches the repo’s `nixpkgs` pin (`nixos-24.11`) and avoids nix-darwin’s branch-mismatch assertion during evaluation.

**Changes:**

- Switch `inputs.nix-darwin.url` from `.../master` to `.../nix-darwin-24.11`.
- Update inline documentation in `flake.nix` to explain/justify the required branch match and the “bump in lockstep” rule.

## Review threads

### Thread 1: flake.nix:43 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T03:53:09Z):

P1 (docs drift): This update pins the flake input to `nix-darwin-24.11`, but the usage examples elsewhere still reference `nix-darwin/master` (e.g. the "Apply with" command later in this file, plus infra/nix-darwin/{README.md,configuration.nix}). That inconsistency is likely to confuse maintainers and undermines the new “lockstep” guidance. Please update those commands/text to reference the same release branch (or explicitly explain why the tool is still run from `master`).
