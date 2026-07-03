---
pr_number: 5394
title: "refactor(081KSKBP80008QG0R003Z4C0D0 Phase 3): parameterized zeta-ai-agent.nix replaces zeta-otto.nix \u2014 multi-vendor scaffold for \u22653-systemd-agents-on-bootup (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T03:18:35Z"
merged_at: "2026-05-27T03:21:02Z"
closed_at: "2026-05-27T03:21:02Z"
head_ref: "feat-b0850-3-zeta-ai-agent-parameterized-module-refactor-multi-vendor-scaffold-2026-05-27-0149z"
base_ref: "main"
archived_at: "2026-05-27T19:27:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5394: refactor(081KSKBP80008QG0R003Z4C0D0 Phase 3): parameterized zeta-ai-agent.nix replaces zeta-otto.nix — multi-vendor scaffold for ≥3-systemd-agents-on-bootup (Aaron 2026-05-27)

## PR description

## Summary

Aaron 2026-05-27 (verbatim):

> *\"we should end up shipping with one service per surface i think outside k8s and have at least 3 different vendors\"*

> *\"so they can fix each other and the k8s cluster even when it's down.\"*

> *\"the mutual repair is critical too becasue of you can see your own future self boot script failures\"*

> *\"yeah lets move all forward however and i can do as many iterations testing as possible before we move to pc two we should have three systemd agents and the cluster running on bootup\"*

Parameterizes the Phase 1 zeta-otto.nix shape (PR #5392) into a multi-vendor multi-persona substrate. Each persona = separate systemd unit; per-persona opt-in via NixOS module option.

## Refactor

| File | Change |
|---|---|
| zeta-otto.nix | DELETED (superseded) |
| zeta-ai-agent.nix | NEW — parameterized over persona |
| common.nix | imports zeta-ai-agent.nix |
| control-plane/configuration.nix | `zeta.aiAgents.personas.otto.enable = true` |

## Default personas (per agent-roster-reference-card)

| Persona | Vendor | Binary | Sub-row |
|---|---|---|---|
| otto | anthropic | claude | shipped this PR |
| alexa | alibaba-qwen | kiro | 081KSKBP80008QG0R003Z4C0D0.3a (pending) |
| riven | xai-grok | grok | 081KSKBP80008QG0R003Z4C0D0.3b (pending) |
| vera | openai | codex | 081KSKBP80008QG0R003Z4C0D0.3c (pending) |
| lior | google-gemini | gemini | 081KSKBP80008QG0R003Z4C0D0.3d (pending) |

Each persona enable lines pre-staged + commented in control-plane/configuration.nix with sub-row IDs.

## Why ≥3 vendors (load-bearing)

1. **Vendor-outage resilience** — Anthropic API down doesn't kill all cluster-AI substrate
2. **Self-modification safety** — when one AI's self-update breaks its boot script, OTHER AIs (different vendors) detect + repair
3. **BFT margin** — f=1 fault tolerance requires 3 nodes (or 2f+1 generally)

Both Spec 2 + Spec 4 from the 081KSKBP80008QG0R003Z4C0D0 Phase 3 memory independently justify the ≥3 floor.

## Test plan

- [ ] CI passes
- [ ] flake.nix evaluation succeeds with the new module
- [ ] On next install: Otto-as-systemd starts on first boot (same Phase 1 behavior, just via parameterized module)

## Composes with

iter-5.5.0 substrate (PRs #5388 + #5389) · [081KSGS9H0008QG0R001JNKBFD](docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-...) · [081KSGS9H0008QG0R002T0XQ50](docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-...) · [081KSGS9H0008QG0R002F04ECB](docs/backlog/P2/081KSGS9H0008QG0R002F04ECB-...) · [081KS3X9Y0008QG0R00218150M](docs/backlog/P*/081KS3X9Y0008QG0R00218150M-...) · [081KSKBP80008QG0R000E3RKPK](docs/backlog/P2/081KSKBP80008QG0R000E3RKPK-...) · [081KSGS9H0008QG0R0031PBNGA](docs/backlog/P1/081KSGS9H0008QG0R0031PBNGA-...) · [081KSKBP80008QG0R003Z4C0D0 row](docs/backlog/P2/081KSKBP80008QG0R003Z4C0D0-...)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T03:21:35Z)

## Pull request overview

Refactors the NixOS “Otto as systemd service” module into a parameterized, multi-persona scaffold so multiple AI agents (potentially from different vendors) can be enabled as independent systemd units outside k8s.

**Changes:**

- Deleted the Phase 1 single-persona module (`zeta-otto.nix`) and introduced a generalized module (`zeta-ai-agent.nix`) that generates one systemd unit per enabled persona.
- Updated the shared NixOS module import list to pull in the new generalized module.
- Updated the control-plane host config to enable `otto` via the new option path.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/nixos/modules/zeta-otto.nix | Removed the Phase 1 single-agent NixOS module (superseded by generalized module). |
| full-ai-cluster/nixos/modules/zeta-ai-agent.nix | Added generalized NixOS module to generate per-persona AI agent systemd services. |
| full-ai-cluster/nixos/modules/common.nix | Switched imports from the deleted module to the new generalized module. |
| full-ai-cluster/nixos/hosts/control-plane/configuration.nix | Updated host config to enable the `otto` persona via `zeta.aiAgents.personas.otto.enable`. |

## Review threads

### Thread 1: full-ai-cluster/nixos/modules/zeta-ai-agent.nix:7 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:34Z):

The header comment says personas are enabled via `zeta.aiAgents.<persona>.enable = true;`, but the module option path is `zeta.aiAgents.personas.<persona>.enable`. Please update the comment to match the actual configuration path so operators don’t copy an incorrect setting.

### Thread 2: full-ai-cluster/nixos/modules/zeta-ai-agent.nix:220 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:34Z):

`configDir` is defined for each persona and exposed as an option, but it’s not used anywhere in the module (e.g., for validation, environment, or the status file). Either remove it to avoid dead configuration, or use it (for example, to render accurate operator hints / checks).

### Thread 3: full-ai-cluster/nixos/modules/zeta-ai-agent.nix:142 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:34Z):

The loop hard-codes the executable path to `${cfg.home}/.bun/bin/${persona.binary}` even though the service `PATH` includes mise shims. This prevents running personas whose CLI is provided via mise shims (or any non-bun install location) without rewriting the module. Consider executing by binary name (rely on PATH) or making the per-persona executable path configurable.

### Thread 4: full-ai-cluster/nixos/modules/zeta-ai-agent.nix:142 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:34Z):

The agent command is suffixed with `|| true`, which causes the service to stay “active” even if the CLI is missing or failing on every tick; systemd won’t surface the failure state or apply restart/backoff semantics meaningfully. Prefer letting the tick failure propagate (or at least detect “command not found” and exit) so misconfiguration is visible via `systemctl status`.

### Thread 5: full-ai-cluster/nixos/modules/zeta-ai-agent.nix:282 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T03:21:35Z):

The status hint claims creds live under `~/.config/<vendor>/`, but for the default personas the credential directory is not the vendor string (e.g., Claude Code uses `~/.config/claude`). Use each persona’s `configDir` (or remove this line) so the hint doesn’t point operators to the wrong location.

## General comments

### @chatgpt-codex-connector (2026-05-27T03:18:40Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
