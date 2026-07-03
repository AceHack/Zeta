---
pr_number: 5121
title: "fix(postmerge-5120): 4 Copilot findings \u2014 drop devShell install.sh auto-run + \u00a724 reframe + workflow comment"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T07:28:56Z"
merged_at: "2026-05-26T07:31:38Z"
closed_at: "2026-05-26T07:31:38Z"
head_ref: "otto-cli/postmerge-5120-fixfwd-4-copilot-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:41:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5121: fix(postmerge-5120): 4 Copilot findings — drop devShell install.sh auto-run + §24 reframe + workflow comment

## PR description

## Summary

Addresses 4 Copilot post-merge findings on #5120 (cascade #4 fix-fwd).

- **P0** — `full-ai-cluster/flake.nix` shellHook was auto-running `tools/setup/install.sh` on every \`nix develop\` entry. Reliably fails on NixOS (no apt; in supportedSystems) and has large side effects (apt/brew installs, sudo prompts, network fetches, profile edits). Replaced with a one-line hint. The maintainer 2026-05-26 question about NixOS-vs-debian lands on the same root cause.
- **P1 (§24/mkpasswd)** — dropped inaccurate "4th consumer per GOVERNANCE.md §24" claim (§24 specifies three) and the mkpasswd-from-install.sh claim (mkpasswd is in the NixOS installer ISO substrate, not the manifests).
- **Nit (workflow)** — reworded audit-step comment to honestly describe the 7z source split: CI uses ubuntu-24.04 runner-default, manifests cover local-dev parity only.

The 4th post-merge thread (exit-3 doc) is stale — already widened on main by 585f9d2cf; will resolve no-op alongside this merge.

## Test plan

- [x] No code changes; comment + shellHook edits only
- [x] flake.nix syntax-clean (no eval — Nix not invoked in CI for non-build paths)
- [x] Workflow comment-only change; no behavior change

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T07:32:01Z)

## Pull request overview

This PR removes automatic execution of `tools/setup/install.sh` from the `full-ai-cluster` Nix devShell (avoiding side effects and NixOS breakage) and tightens accompanying commentary about the install-script contract and 7z provenance in CI vs local setup.

**Changes:**

- Stop auto-running `tools/setup/install.sh` on `nix develop` entry; replace with a manual hint in the devShell `shellHook`.
- Reframe devShell comments to align with `GOVERNANCE.md §24` (three install.sh consumers) and remove the prior “4th consumer” framing.
- Update the workflow audit-step comment to describe where 7z comes from in CI vs local environments.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| `full-ai-cluster/flake.nix` | Removes install.sh auto-run from devShell hook; updates explanatory comments and prints a manual host-setup hint. |
| `.github/workflows/build-ai-cluster-iso.yml` | Comment-only clarification about 7z dependency provenance for the ISO audit step. |

## Review threads

### Thread 1: full-ai-cluster/flake.nix:195 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:32:00Z):

The shellHook hint suggests running `bash tools/setup/install.sh` unconditionally, but the preceding comment says auto-running install.sh fails on NixOS because linux.sh requires apt-get. Consider scoping the hint to supported install.sh hosts (macOS + Debian/Ubuntu) or explicitly noting that NixOS users should rely on Nix instead of install.sh to avoid a confusing footgun.

### Thread 2: .github/workflows/build-ai-cluster-iso.yml:149 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:32:01Z):

This comment says the tools/setup/manifests cover “local-dev parity only”, but GOVERNANCE.md §24 and the manifests themselves describe them as the canonical dep declaration for dev laptops, CI runners, and devcontainer images. Suggest rewording to: (a) manifests declare the dependency for all install.sh consumers, and (b) this specific workflow currently relies on the ubuntu runner image preinstall (or installs explicitly) rather than invoking install.sh.

## General comments

### @chatgpt-codex-connector (2026-05-26T07:29:03Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
