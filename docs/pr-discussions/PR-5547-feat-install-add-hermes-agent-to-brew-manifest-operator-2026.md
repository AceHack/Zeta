---
pr_number: 5547
title: "feat(install): add hermes-agent to brew manifest (operator 2026-05-27 Max-decided dependency)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T17:53:29Z"
merged_at: "2026-05-27T18:01:01Z"
closed_at: "2026-05-27T18:01:01Z"
head_ref: "backlog/add-hermes-agent-to-brew-manifest-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:20:38Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5547: feat(install): add hermes-agent to brew manifest (operator 2026-05-27 Max-decided dependency)

## PR description

## Summary

Adds NousResearch hermes-agent (external vendor-agnostic AI agent
harness) to \`tools/setup/manifests/brew\` per operator authorization:

> *\"Max recently decide to add this dependency\"*

Confirmed URLs from operator: https://github.com/nousresearch/hermes-agent + https://hermes-agent.nousresearch.com/

NOT the Lucent-internal Hermes K8s agent runtime at
\`full-ai-cluster/k8s/applications/hermes/\` (same name, different
substrate; rule body distinguishes).

## What changes

Single-line addition to brew manifest with provenance comment.
Idempotent — \`brew install hermes-agent\` skips if present per
install.sh \"detect-first-install-else-update\" discipline.

## Test plan

- [x] Manifest entry follows existing p7zip pattern (formula + inline
  comment explaining provenance)
- [x] hermes-agent verified available via \`brew info hermes-agent\`
  (stable 2026.5.16, bottled, MIT, Homebrew/homebrew-core)
- [ ] CI passes (auto-merge to fire on green)
- [ ] Operator runs install.sh on Mac post-merge to verify install
  works (zero-friction per passwordless sudo config)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T17:56:10Z)

## Pull request overview

Adds `hermes-agent` to the macOS Homebrew manifest so `tools/setup/macos.sh` will install/upgrade it as part of the standard bootstrap flow, with inline provenance notes to distinguish it from the repo’s internal Hermes K8s runtime.

**Changes:**

- Add `hermes-agent` to `tools/setup/manifests/brew`.
- Document provenance/intent in the manifest comments (including a distinction from `full-ai-cluster/k8s/applications/hermes/`).

## Review threads

### Thread 1: tools/setup/manifests/brew:20 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T17:56:09Z):

The comment includes a direct personal-name attribution (“Max-decided dependency”). This file is a current-state operational manifest, so it should use role-refs instead of contributor names per the repo’s “No name attribution in code, docs, or skills” rule (docs/AGENT-BEST-PRACTICES.md:671-760). Consider rewriting to something like “operator-authorized dependency” and keep any named attribution confined to the allowed history surfaces.

### Thread 2: tools/setup/manifests/brew:26 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T17:56:10Z):

This manifest comment hard-codes a detailed dependency list (including a specific `python@3.14` formula). Transitive deps and versions are likely to change over time and can drift from the repo’s runtime pinning story in `.mise.toml`, so this is likely to become stale/misleading. Suggest trimming this to stable provenance/URLs and letting `brew info hermes-agent` be the source of truth for deps.

## General comments

### @chatgpt-codex-connector (2026-05-27T17:53:32Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
