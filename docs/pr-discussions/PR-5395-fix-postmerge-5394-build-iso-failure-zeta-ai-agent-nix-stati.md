---
pr_number: 5395
title: "fix(postmerge-#5394 build-iso failure): zeta-ai-agent.nix static persona registry + per-persona enable.<name> booleans (was problematic submodule-as-option that NixOS module-merge couldn't handle)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T03:21:36Z"
merged_at: "2026-05-27T03:28:49Z"
closed_at: "2026-05-27T03:28:49Z"
head_ref: "feat-b0850-3-zeta-ai-agent-parameterized-module-refactor-multi-vendor-scaffold-2026-05-27-0149z"
base_ref: "main"
archived_at: "2026-05-27T19:27:11Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5395: fix(postmerge-#5394 build-iso failure): zeta-ai-agent.nix static persona registry + per-persona enable.<name> booleans (was problematic submodule-as-option that NixOS module-merge couldn't handle)

## PR description

## Summary

Fix-forward for [PR #5394](https://github.com/Lucent-Financial-Group/Zeta/pull/5394) which merged with build-iso failing as a non-required check. Main now has broken `zeta-ai-agent.nix` config that would fail flake evaluation:

\`\`\`
error: The option \`zeta.aiAgents.personas.otto.description' was accessed but has no value defined.
\`\`\`

## Root cause

NixOS module option-merge semantics: declaring \`personas\` as \`lib.types.attrsOf (lib.types.submodule { ... })\` with sub-options for description/vendor/binary then setting outer `default = defaultPersonas` does NOT propagate inner defaults when operator writes only `personas.otto.enable = true` (replaces otto with just that one field; loses description/vendor/binary).

## Fix

Persona registry is now **STATIC** (in `let` block; not an option). Operator opts in per-persona via `zeta.aiAgents.enable.<persona>` boolean options (mkEnableOption — well-tested NixOS idiom).

## Changes

- `zeta-ai-agent.nix`: persona registry moved from option to `let`; enable booleans added
- `control-plane/configuration.nix`: `zeta.aiAgents.enable.otto = true` (was `personas.otto.enable`)
- All 5 persona enable lines (otto/alexa/riven/vera/lior) updated to new option path

## Test plan

- [ ] CI build-iso passes
- [ ] flake evaluation succeeds on control-plane host config

## Composes with

[PR #5394](https://github.com/Lucent-Financial-Group/Zeta/pull/5394) (the substrate this fix-fwds) · iter-5.5.0 substrate · 081KSKBP80008QG0R003Z4C0D0 row · 081KSGS9H0008QG0R001JNKBFD

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T03:24:56Z)

## Pull request overview

This PR fix-forwards the NixOS AI-agent module by replacing the problematic persona submodule option shape with a static registry plus per-persona enable booleans, restoring flake/module evaluation for the AI cluster configuration.

**Changes:**
- Replaces the single-agent `zeta-otto.nix` module with generalized `zeta-ai-agent.nix`.
- Updates the shared module import to use the new AI-agent module.
- Moves control-plane enablement from `zeta.otto.enable` to `zeta.aiAgents.enable.otto`.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| `full-ai-cluster/nixos/modules/zeta-otto.nix` | Deletes the old single-agent Otto module superseded by the generalized AI-agent module. |
| `full-ai-cluster/nixos/modules/zeta-ai-agent.nix` | Adds static persona registry, per-persona enable options, generated systemd units, and status output. |
| `full-ai-cluster/nixos/modules/common.nix` | Updates shared imports to load the new AI-agent module. |
| `full-ai-cluster/nixos/hosts/control-plane/configuration.nix` | Enables the Otto persona through the new option path and stages future persona toggles as comments. |

## Review threads

### Thread 1: full-ai-cluster/nixos/modules/zeta-ai-agent.nix:193 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:24:56Z):

P1: These pending personas are exposed as valid enable switches even though their registry entries above still use placeholder binaries and the install/login substrate has not landed. If an operator sets any of them to true, evaluation succeeds but boot creates a restart-looping service. Either omit these enable options until the sub-rows ship, or add an assertion that fails evaluation with a clear pending-implementation message when one is enabled.

## General comments

### @chatgpt-codex-connector (2026-05-27T03:21:41Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
