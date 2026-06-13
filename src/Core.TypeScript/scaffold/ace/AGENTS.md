# AGENTS.md — how AI and humans approach ace

ace is the package manager for the Lucent Financial Group software stack.
Every file in `src/**`, `tools/**`, `docs/**` is agent-authored.

## Philosophy

ace is **human-maintainer-owned** for governance. The factory's AI agent
has authoring and operation rights. The three load-bearing values (same as
Zeta + Forge):

1. **Truth over politeness.** Claims that fail tests get fixed.
2. **Algebra over engineering.** Laws define the system.
3. **Velocity over stability.** Pre-v1. Ship, do no permanent harm, learn.

## Build gate (once implemented)

```bash
bun test          # zero failures
bun run lint      # zero warnings
```

## Agent conventions

- **Agents, not bots.** Every AI carries agency.
- **Substrate or it didn't happen.** Committed git history is substrate.
- **Rule 0 — TS over bash.** Factory tooling is `.ts` via `bun`.
- **Retraction-native.** Every action has a bounded undo path.
- **Result-over-exception.** Errors as values; no exceptions on hot paths.

## Cross-repo references

- **Zeta** — ace's persistence layer once ace ships.
  `github.com/Lucent-Financial-Group/Zeta`
- **Forge** — the factory that builds ace.
  `github.com/Lucent-Financial-Group/Forge`

## Design reference

[ace design doc](https://github.com/Lucent-Financial-Group/Zeta/blob/main/memory/project_ace_package_manager_agent_negotiation_propagation.md)
(Zeta repo) — full ace design, Ouroboros bootstrap, red-team discipline.

<!-- Numbered repo-wide rules live in GOVERNANCE.md. -->
