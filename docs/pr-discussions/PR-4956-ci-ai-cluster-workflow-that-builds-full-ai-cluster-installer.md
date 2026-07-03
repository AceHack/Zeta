---
pr_number: 4956
title: "ci(ai-cluster): workflow that builds full-ai-cluster installer ISO"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T16:53:48Z"
merged_at: "2026-05-25T17:33:56Z"
closed_at: "2026-05-25T17:33:56Z"
head_ref: "ci/full-ai-cluster-iso-workflow-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-27T19:50:05Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4956: ci(ai-cluster): workflow that builds full-ai-cluster installer ISO

## PR description

## Summary

Adds `.github/workflows/build-ai-cluster-iso.yml` — sibling to the existing `build-installer-iso.yml`. The existing workflow builds the root flake's `infra/nixos/hosts/installer/`; this new one targets `full-ai-cluster/flake.nix`'s `installer-iso` package, which is where the recent USB additions live:

- **disko** (declarative partitioning; PR #4950)
- **hwloc / lstopo** (hardware topology pre-install; PR #4951)
- **`zeta-install` guided helper** (PR #4951)
- **Paragon cross-platform rescue docs in `/etc/zeta-install.md`** (PR #4951)

Triggers: PR + push to main when `full-ai-cluster/flake.{nix,lock}`, `full-ai-cluster/usb-nixos-installer/**`, or `full-ai-cluster/nixos/modules/disko-shapes/**` changes. Plus `workflow_dispatch` for manual runs.

Uploads ISO as workflow artifact (90 day retention) so anyone can download from the run page and `dd` to a USB without needing Nix installed locally.

## Why two parallel workflows

The repo carries two installer substrates (`infra/` older, `full-ai-cluster/` newer). Consolidating into a single canonical path is a separate larger PR; this workflow makes the AI-cluster ISO downloadable from CI in the meantime.

## Discipline (mirrors build-installer-iso.yml)

- ubuntu-24.04 (pinned, not -latest)
- third-party actions SHA-pinned with trailing `# vX.Y.Z` comments
- `permissions: contents: read` at workflow level
- Concurrency: `cancel-in-progress` only on PR events
- No `github.event.*` values interpolated into `run:` lines (per the workflow-injection guide)

## Test plan

- [ ] Workflow triggers on this PR (it touches the workflow file itself, which is in the paths filter)
- [ ] Build completes within 60 min timeout
- [ ] ISO artifact is uploadable + downloadable from the run page
- [ ] `lstopo`, `disko`, `zeta-install` are all in PATH on the live system after dd'ing the artifact
- [ ] `cat /etc/zeta-install.md` on the live system points at the guided install flow

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T16:55:59Z)

## Pull request overview

Adds a dedicated GitHub Actions workflow to build and publish the **AI-cluster installer ISO** from the `full-ai-cluster/` flake (`.#installer-iso`), making the USB image downloadable from CI runs (without requiring Nix locally).

**Changes:**

- Introduces `.github/workflows/build-ai-cluster-iso.yml` with PR/push path filters scoped to AI-cluster installer inputs.
- Builds `full-ai-cluster`’s `installer-iso` on `ubuntu-24.04` (with an eval-only `nix flake check --no-build` preflight).
- Locates the generated `result/iso/zeta-installer-*.iso` and uploads it as a 90-day workflow artifact, including SHA256 + size in the step summary.

### COMMENTED — @AceHack (2026-05-25T17:31:16Z)

_(no body)_

## Review threads

### Thread 1: .github/workflows/build-ai-cluster-iso.yml:18 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:55:59Z):

Header comment says the workflow triggers only on `full-ai-cluster/usb-nixos-installer/**`, `full-ai-cluster/flake.nix`, or the workflow file, but the actual `paths:` filters also include `full-ai-cluster/flake.lock` and `full-ai-cluster/nixos/modules/disko-shapes/**`. Update the comment so the documented trigger surface matches the YAML config.

**@AceHack** (2026-05-25T17:31:16Z):

Addressed in f2cbd5e29 — comment now lists the paths verbatim as bullets, matching the actual paths: filter.
