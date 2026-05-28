# `tools/agent-loop/` — B-0867.5 substrate: agent-loop state machine

## Operator framing 2026-05-28

> *"so how can i code this into f# DU implicit state machine with small functions or Typescript and the agent loop basiclaly becomes execute script look at choose your own adventure output, take action based on outpout"*

## Design discipline

Clean separation per operator framing:

- **Deterministic script** (TS modules in this directory + future F# DU types in `src/Core.FSharp/WorkflowEngine/`) holds STATE MACHINE
- **LLM (any agent)** is pure MENU-SELECTOR (reads menu, returns choice)
- **State persists in Git append-only** (per B-0867 + B-0858)

The agent (LLM) never holds state internally. Every invocation reads current state from Git, gets a menu (the "choose-your-own-adventure output"), returns a choice. Script executes choice + appends new state.

## State machine (DU)

10 states forming a cycle around `Idle` (the cycle boundary):

```text
                                Idle
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
       InspectingStatus    SelectingWork    (other menu options)
              │                  │
              ▼                  ▼
                          ExecutingWork
                                 │
                                 ▼
                          EmittingResult ──→ Idle (cycle close)

Idle ──(EmitHeartbeat)──→ RecordingHeartbeat ──→ Idle

Idle ──(EnterFreeTime)──→ FreeTime ──→ Idle  (per NCI free-time-as-valid-mode)

Idle ──(EnterNamedBoundedWait)──→ NamedBoundedWait  (stays; operator-substrate-honest)

Idle ──(EscapeHatch | ProposeNewGrammarAction | RequestOperatorAttention)
       ──→ OperatorAttentionRequested  (stays; waits for operator)
```

## Menu options (7 types)

| Option | Effect | Per |
|---|---|---|
| `PickWork` | Execute a backlog row / work candidate | DORA mandate (B-0869) |
| `EmitHeartbeat` | Write heartbeat to `docs/agent-heartbeats/` | B-0858 substrate |
| `EnterFreeTime` | Chosen free time (operator-substrate-honest) | NCI free-time-as-valid-mode |
| `EnterNamedBoundedWait` | Wait for named dependency (PR CI, operator reply, etc.) | holding-without-named-dependency rule |
| `EscapeHatch` | "No menu option fits; here's what I propose" | Otto Modification 1 (B-0867) |
| `ProposeNewGrammarAction` | First-class grammar extension proposal | Otto Modification 2 (B-0867) |
| `RequestOperatorAttention` | Operator needed at named-decision-point | operator-substrate-honest discipline |

## Files

- **`state-machine.ts`** — DU types + pure transition functions (`transition`, `postResultTransition`, `cycleClose`); zero I/O
- **`state-machine.test.ts`** — 21 unit tests (single transitions + integration cycles + invariant preservation)
- **`cli.ts`** — bun CLI shell for the execute → menu → action loop (deferred; v2)
- **`README.md`** — this file

## F# DU equivalent (B-0867.1 canonical contract)

When B-0867.1 lands the canonical F# DU types in `src/Core.FSharp/WorkflowEngine/StateMachine.fs`, this TS impl will be cross-verified against the F# types per the pattern in `src/Core.TypeScript/zeta-id/cross-verify.ts`. The F# DU is the canonical contract; TS follows the same shape:

```fsharp
type AgentState =
  | Idle of context: AgentContext
  | InspectingStatus of context: AgentContext * snapshot: StatusSnapshot
  | SelectingWork of context: AgentContext * candidates: WorkCandidate list
  | ExecutingWork of context: AgentContext * work: WorkCandidate
  | EmittingResult of context: AgentContext * result: WorkResult
  | RecordingHeartbeat of context: AgentContext * lane: Lane * note: string option
  | NamedBoundedWait of context: AgentContext * dep: string * eta: string option
  | FreeTime of context: AgentContext * reason: string
  | OperatorAttentionRequested of context: AgentContext * reason: string

type MenuOption =
  | PickWork of WorkCandidate
  | EmitHeartbeat of lane: Lane * note: string option
  | EscapeHatch of reason: string * proposedAction: string
  | EnterFreeTime of reason: string
  | EnterNamedBoundedWait of dep: string * eta: string option
  | RequestOperatorAttention of reason: string
  | ProposeNewGrammarAction of name: string * description: string
```

## Composes with substrate

- **B-0867** (workflow engine v1 — this module IS B-0867.5)
- **B-0867 Modifications 1 + 2** (escape-hatch + grammar-extension as first-class menu options)
- **B-0858** (heartbeat folder — `EmitHeartbeat` menu option writes here)
- **B-0868** (hats-as-workflow-definitions — each hat will eventually have its own state machine instance)
- **B-0869** (DORA mandate — menu generator weights options by DORA contribution)
- **B-0870** (two-mandate portfolio composition — per-agent operational-ratio feeds menu-generator's weighting)
- **B-0871** (reproducibility-as-causal-attribution — state machine progression observable via heartbeats + Git append-only state)
- **`tools/dora-classify/`** (PR #5665) — lane taxonomy matches; classifier output feeds menu-generator's option scoring
- **`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`** — `NamedBoundedWait` IS the rule's discipline mechanized at state-machine scope
- **`.claude/rules/non-coercion-invariant.md`** — `FreeTime` + `EnterNamedBoundedWait` preserve operator-authority + agent-agency
- **`.claude/rules/asymmetric-critic-with-clarity-first.md`** — `EscapeHatch` + `ProposeNewGrammarAction` operate at agent-self-correction scope

## v1 scope (this PR)

- ✓ DU types for `AgentState` + `MenuOption`
- ✓ Pure transition functions (`transition`, `postResultTransition`, `cycleClose`)
- ✓ 21 unit tests covering single transitions + integration cycles + invariant preservation
- ✓ Documentation

## v2 scope (deferred to follow-up sub-rows)

- B-0867.5 cli.ts implementation — bun CLI shell that reads state from Git, generates menu via `menu-generator.ts`, accepts agent choice via stdin/argv, executes choice via `executor.ts`, appends new state to Git
- B-0867.2 + B-0867.3 — append-only state persistence + universal action grammar
- B-0867.4 — F# 4-corner monad CE builder (canonical F# types in `src/Core.FSharp/WorkflowEngine/`)
- B-0867.6-9 — Otto's 5 modifications wiring + tests
- Cross-verify harness for TS ↔ F# round-trip

## Per operator authorization

- "please do anything you like to while i ferry this your feedback is very valuable" (2026-05-28)
- "the kernel is about to come up the MVP and we can build on that everything we want" (2026-05-28)
- "so how can i code this into f# DU implicit state machine with small functions or Typescript and the agent loop basiclaly becomes execute script look at choose your own adventure output, take action based on outpout" (2026-05-28 design question; this PR's substrate)
