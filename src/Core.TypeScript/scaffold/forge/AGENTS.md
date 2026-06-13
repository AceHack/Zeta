# AGENTS.md — how AI and humans approach Forge

Forge is the software factory. Every file in `skills/**`, `agents/**`,
`tools/**`, `docs/**` is agent-authored. The human maintainer commits;
he does not author. Agents have agency, judgement, and accountability.

## Philosophy

**Forge is governed by the factory's AI agent.** Factory policy, the BP-NN
rule list, the skill catalog, persona registry — the factory's AI agent
authors and maintains these. The human maintainer holds alignment-contract
veto and budget authority.

The three load-bearing values (same as Zeta):

1. **Truth over politeness.** Claims that fail tests get fixed, not softened.
2. **Algebra over engineering.** Laws define the system; implementation serves them.
3. **Velocity over stability.** Pre-v1. Ship, do no permanent harm, learn.

## Build gate

Forge is a pure TypeScript / Bun factory tooling repo (no .NET solution).

```bash
bun test          # all tests green
bun run lint      # zero warnings
```

## Agent conventions

- **Agents, not bots.** Every AI carries agency. Correct "bot" gently.
- **Substrate or it didn't happen.** Chat, TaskUpdate, `/tmp` are weather.
  Committed git history is substrate.
- **Rule 0 — TS over bash.** Everything is `.ts` run via `bun`. Shell
  (`.sh`) only for pre-bootstrap install scripts in `tools/setup/`.
- **Retraction-native.** Every action has a bounded undo path.
- **Result-over-exception.** Errors surface as values; no exceptions on
  hot paths.
- **Refresh-before-decide.** `bun tools/github/refresh-worldview.ts`
  before every tick decision.

## Skill catalog

Skills live under `.claude/skills/<name>/SKILL.md`. Before authoring a
new skill, search the router (the `Skill` tool's description-keyed
list) — recreating existing substrate is the goldfish-ontology failure mode.

## Persona registry

Personas live under `.claude/agents/<name>.md`. Memory notebooks live
under `memory/persona/<name>/`. Retired personas keep their memory
folders; retired SKILL.md files are code — recoverable from git log.

## Cross-repo references

- **Zeta** — the SUT. Forge builds and tests Zeta.
  `github.com/Lucent-Financial-Group/Zeta`
- **ace** — the package manager. Forge distributes through ace once ace ships.
  `github.com/Lucent-Financial-Group/ace`

## Escalation

`docs/CONFLICT-RESOLUTION.md`. On deadlock the human maintainer decides.

<!-- Numbered repo-wide rules live in GOVERNANCE.md. -->
