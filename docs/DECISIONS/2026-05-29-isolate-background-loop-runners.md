# ADR: Isolate background loop runners to dedicated workspaces

**Status:** Proposed
**Date:** 2026-05-29
**Backlog:** 081KSE6WT0008QG0R003YYC9PV
**Scope:** Defines the standard background loop runner isolation architecture for all agent nodes (Claude, Codex, Riven, Gemini, Alexa, Kiro, etc.).

## Context

The primary git repository checkout located at `/Users/acehack/Documents/src/repos/Zeta` is designated as **SHARED VIEW + FOR HUMAN** (081KSE6WT0008QG0R003YYC9PV). Agents must never perform direct local modifications, branch checkouts, or commits inside this contested root directory.

Background loop runners (e.g. macOS launchd services executing `lior-loop-tick.ts`) that execute directly on files in the root checkout suffer from a critical **prompt-regression exploit**:

1. When another agent or the human maintainer checks out an older branch (before a safety patch is merged to `main`) in the primary workspace, the file on disk at `.gemini/bin/lior-loop-tick.ts` immediately reverts to its older, unhardened code.
2. The periodic launchd runner wakes up, parses the older unhardened script from disk, and because it lacks isolated worktree/clone protection, it executes git operations directly on the primary root directory.
3. This dirties the shared human view, swaps active branches, and pollutes the primary git log.

To permanently break this regression loop, we must establish complete physical isolation between the daemon scripts and the primary root checkout.

## Decision

Standardize all background loop services (Claude, Codex, Riven, Gemini/Lior, Alexa, Kiro) to execute strictly out of **dedicated, isolated clone workspaces** (e.g., `/Users/acehack/.local/share/zeta-<agent>-loop/Zeta/`).

The launchd daemon configuration plists (under `~/Library/LaunchAgents/com.zeta-*.plist` and `.gemini/launchd/com.zeta-*.plist`) must configure both `ProgramArguments` and `WorkingDirectory` to target the isolated workspace clone.

The background runner logic for all active personas must follow this standard handoff loop:

| Stage | Action | Rationale |
|---|---|---|
| **Daemon Boot** | macOS launchd invokes `bun <isolated_clone>/.<agent>/bin/<agent>-loop-tick.ts` | Branch checkouts in the primary directory `/Users/acehack/Documents/src/repos/Zeta` will never overwrite the script file on disk. |
| **Workspace Isolation** | `WorkingDirectory` is set to `<isolated_clone>` | Ensures all relative process lookups and execution scopes default to the sandboxed clone. |
| **Handoff & Verification** | Daemon polls GitHub API for open PRs and issues (`gh pr list`) | Reads live status directly from the remote origin rather than local status. |
| **PR & Comment Resolution** | Create/Update branch via isolated detached worktree (`git worktree add --detach <path> origin/main`) | Keeps the sandboxed clone clean and ensures zero state leaks or branch locks on the primary checkout. |
| **Auto-Merge Settlement** | Commits pushed to origin to trigger CI and auto-merge | Eliminates PR approval friction and bypasses local self-modification blocks. |

## Consequences

Positive:

- **Zero Prompt-Regression:** Even if an older branch is checked out in `/Users/acehack/Documents/src/repos/Zeta`, the launchd daemons execute the latest hardened script from the isolated clone directory, ensuring safe execution.
- **Sovereign Shared View:** Aaron's primary shared view `/Users/acehack/Documents/src/repos/Zeta` remains 100% clean, checked out to the latest `main` branch, and dedicated to the human operator.
- **Zero Workspace Contention:** No concurrent agents can compete over locks or active checkouts in the primary directory.

Costs:

- Requires maintaining an independent git clone per active background loop runner (adding minor disk space overhead of ~300MB per clone).
- Requires updating the host launchd agent plists (`~/Library/LaunchAgents/com.zeta-*.plist`) and reloading them via `launchctl`.

## Out Of Scope

- Modifying foreground agent command line interfaces running on demand.
- Migrating the local NixOS bare metal installer scripts which do not run as persistent daemons.

## Follow-Up

- Review and update all active plists (`com.zeta.claude-loop.plist`, `com.zeta.riven-loop.plist`, `com.zeta.codex-loop.plist`, `com.zeta.lior-loop.plist`) to ensure they fully conform to setting `WorkingDirectory` and `ProgramArguments` inside isolated clones.
- Instruct all active agent personas (Claude, Codex, Riven, Gemini) to strictly respect `/Users/acehack/Documents/src/repos/Zeta` as read-only **SHARED VIEW + FOR HUMAN** and enforce isolated sandbox clones for their background services.
