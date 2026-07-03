---
pr_number: 5122
title: "fix(postmerge-5121): 2 Copilot findings \u2014 OS-scope shellHook + \u00a724 reframe"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T07:33:25Z"
merged_at: "2026-05-26T07:41:26Z"
closed_at: "2026-05-26T07:41:26Z"
head_ref: "otto-cli/postmerge-5121-fixfwd-2-copilot-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:41:15Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5122: fix(postmerge-5121): 2 Copilot findings — OS-scope shellHook + §24 reframe

## PR description

## Summary

Addresses 2 Copilot post-merge findings on #5121.

- **flake.nix shellHook** — install.sh hint was unconditional; conflicted with the preceding "fails on NixOS" comment. Scoped the hint to macOS + Debian/Ubuntu (where install.sh actually works); NixOS gets no hint (tooling comes via devShell nix-managed packages).
- **workflow comment** — "local-dev parity only" understated the manifests' role per §24. Reframed: manifests ARE the canonical declaration for ALL install.sh consumers; THIS workflow doesn't invoke install.sh as a per-run-cost shortcut.

### Behavioral change (substrate-honest update — earlier claim of "no behavior change" was incomplete)

The shellHook IS now conditional on host OS, so user-facing output of `nix develop` changes:

- macOS hosts: print the `Host setup (rare): bash tools/setup/install.sh` hint (unchanged behavior)
- Debian/Ubuntu Linux hosts: same hint (unchanged behavior)
- NixOS hosts: hint suppressed (new behavior — was previously a footgun pointing operators at a path that errors on `apt-get`)

No code-execution change; only a one-line output difference per OS.

### Follow-on fix (commit `3562f925e` on this branch)

Per Copilot finding on this PR: the workflow comment's documented future-proof fallback "if we drop the ubuntu-24.04 pre-install, add `apt-get install p7zip-full`" would hang interactively in CI without `-y`. Reworded to `sudo apt-get update && sudo apt-get install -y p7zip-full` with an inline note explaining why `-y` matters.

## Test plan

- [x] flake.nix shellHook conditional reads cleanly (uname -s + /etc/os-release ID check)
- [x] No syntax break in YAML or Nix
- [x] All 3 OS branches verified mentally: macOS prints hint, Debian/Ubuntu prints hint, NixOS prints nothing
- [x] apt-get fallback documented with `-y` to avoid CI hang

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T07:36:34Z)

## Pull request overview

This PR addresses two post-merge Copilot findings by (1) scoping the `full-ai-cluster` devShell’s host-setup hint to OSes where `tools/setup/install.sh` is expected to work, and (2) reframing a workflow comment to accurately reflect GOVERNANCE.md §24’s “one script, three consumers” rule while noting this workflow intentionally skips running `install.sh`.

**Changes:**

- Update `full-ai-cluster/flake.nix` `shellHook` to show the `install.sh` hint only on macOS and Debian/Ubuntu-family Linux (and show nothing on NixOS).
- Reword the `build-ai-cluster-iso` workflow comment to treat manifests as canonical dependencies for all `install.sh` consumers, and to clarify this workflow relies on runner preinstalls as a cost shortcut.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| `full-ai-cluster/flake.nix` | Makes the devShell host-setup hint conditional by OS (avoids pointing NixOS users at an unsupported path). |
| `.github/workflows/build-ai-cluster-iso.yml` | Reframes the 7z dependency comment to align with §24 while documenting why this workflow doesn’t run `install.sh`. |

## Review threads

### Thread 1: full-ai-cluster/flake.nix:203 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:36:33Z):

The PR description says this is “comment-only / no behavior change”, but this shellHook change does alter behavior (the hint is now conditional and will no longer print on NixOS or non-Debian/Ubuntu Linux). Consider updating the PR description to reflect the behavioral change (even if it’s only user-facing output).

### Thread 2: .github/workflows/build-ai-cluster-iso.yml:151 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:36:33Z):

The comment suggests adding `apt-get install p7zip-full` if the runner preinstall goes away. In CI this typically needs `-y` (and often an `apt-get update`) to avoid an interactive prompt/hang; consider adjusting the suggested command so a future copy/paste doesn’t introduce a stuck workflow run.

## General comments

### @chatgpt-codex-connector (2026-05-26T07:33:30Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
