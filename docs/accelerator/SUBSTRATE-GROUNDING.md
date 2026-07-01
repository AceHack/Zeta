# Accelerator — substrate-grounding synthesis (Action Item 1)

> One-page synthesis of the existing substrate the PR-less accelerator builds
> ON (per the charter's Action Item 1 + `.claude/rules/verify-existing-substrate-before-authoring.md`).
> Located via parallel substrate-hunt / decision-archaeology agents 2026-05-29.

## Where the substrate lives

| Substrate | Location |
|---|---|
| **move-next as universal action grammar** (canonical) | `memory/persona/ani/conversations/2026-05-28-aaron-ani-grok-move-next-as-universal-action-grammar-git-as-free-event-store-github-actions-recursion-...md` |
| **GitHub swarm + free-event-store + move-next** (precursor) | `memory/persona/kiro/conversations/2026-05-23-aaron-ani-grok-github-swarm-free-event-store-move-next-architecture.md` |
| **Workflow-engine v1 spec** (canonical backlog row) | `docs/backlog/P1/B-0867-workflow-engine-v1-fsharp-du-state-machine-git-append-only-...md` (+ sub-rows B-0867.1..15) |
| **move-next state machine** (TS implementation, landed) | `tools/agent-loop/state-machine.ts` (B-0867.5) + `work-lifecycle-state-machine.ts` + tests |
| **GH-Actions-recursion = infinite no-PR swarm runtime** | `docs/backlog/P1/B-0874-github-actions-recursion-as-infinite-runtime-platform-no-pr-swarm-mode-...md` |
| **Heartbeat folder** (append-only, no-PR write surface) | B-0858 (dependency of B-0867) |
| **Per-host adapters** (GitHub/GitLab/Gitea/Bitbucket isomorphic) | B-0867.15 |
| **agentic-org live substrate proof harnesses** | `agentic-organization/apps/workers/test/` (cockroach + nats integration; commit cc6904685) |

## The shape (what the accelerator inherits, not re-invents)

1. **move-next is the universal action grammar.** A `move-next` function reads the
   current state and emits a discriminated-union menu of possible next actions;
   the LLM is a *pure selector* (reads menu → returns choice); the deterministic
   script holds the state machine and appends the result. Both AI agents and
   humans run the same loop. (Source: `tools/agent-loop/state-machine.ts` —
   `AgentState` DU + `MenuOption` DU + pure `transition(state, option)`.)

2. **Git IS the free event store.** Each agent writes **append-only events** to
   Git keyed by **128-bit guaranteed-unique IDs** (so no two agents write the
   same path → no merge conflicts). Microsoft subsidizes open-source repos
   indefinitely → going closed-source is financially suicidal; staying OSS is the
   free, persistent, distributed event-store + runtime.

3. **GitHub Actions recursion = the swarm runtime** (B-0874). Workflows trigger
   workflows recursively → infinite compute over the git-event-store, no servers.
   **Direct pushes bypass PR rate limits** (Git + REST barely throttled; GraphQL
   is the PR-mutation bottleneck). This is the "no-PR swarm mode."

4. **Otto Modification 4 (the dual-market discriminator)**: each action-type
   *declares its gate* in the grammar — state-machine-internal transitions →
   append-only direct push (PR-less, Agora market); cross-cutting substrate
   (rules, public APIs) → still PR-gated (leash market). Same state machine, two
   gates per action type.

5. **The LLM never holds state internally.** Every invocation reads current state
   from Git, gets a menu, returns a choice; the script executes + appends. State
   lives in Git, not in the model.

## What the accelerator adds (its own work-items)

- **Event-store schema** (Action Item 2 → `EVENT-STORE-SCHEMA.md`): the concrete
  shape of a move-next transition as an append-only git event — informed by the
  2026-05-29 razor-flow substrate (forgiveness-budget: retraction is logical not
  physical, "run out of space = run out of forgiveness"; schema-in-the-stream:
  schema-changes-as-events → automatic schema-evolution over history).
- **GH-Actions-recursion harness** (Action Item 3): a minimal self-triggering
  Action that reads the event-store, picks a move, appends the next event.
- **Harvest protocol** (Action Item 4): how a matured piece graduates to main.
- **Dual-market routing** (Action Item 5): which DUs are leash (PR) vs Agora
  (PR-less), per Otto Modification 4.

## Composes with

- `tools/agent-loop/state-machine.ts` (the move-next DUs the event-store persists)
- B-0867 (workflow-engine v1) + B-0874 (no-PR swarm) + B-0858 (heartbeat folder)
- `docs/research/2026-05-29-rodneys-razor-is-a-compression-engine-...md` (Insights 3+4 feed the schema)
- The AgencySignature v1 trailer (per CLAUDE.md) — each event-commit composes with it
