# Trajectory - TS Workflow Engine / DU State Machine

Status: active — substrate actively landing; most mature of the three cluster workstreams (skill on `origin/main`, TS behavior files exist, multiple B-0867.x sub-rows). First surfaced as a trajectory 2026-05-29 from substrate inventory.
Last refreshed: 2026-05-29
Type: workstream (current-focus) — a trajectory the operator is *actively powering*. Many trajectories can be tracked; only a few are workstreams at once (finite-focus / WIP-bounded — a workstream is a trajectory under sustained thrust, and thrust budget is finite, so most trajectories coast). (Genus = "trajectory"; "workstream" is the species: a trajectory under sustained thrust toward a deliverable, vs. emergent-posture trajectories like `anti-infection`. See [`factory-trajectory-surface`](../factory-trajectory-surface/RESUME.md) for the genus/species taxonomy.) One of the operator's three current cluster workstreams (encryption / usb-zflash / ts-workflow-engine).
Eventual encoding (design-stage — the human maintainer 2026-05-23 genetic-ID substrate + Clifford/HKT): this trajectory's state is trackable as a 128-bit genetic-ID seed (discrete, reversible via parser-combinator ↔ generator-function) → Clifford-space path (continuous, eventual). Mirrors the three-lane I8-lattice / I9-manifold split.
Current blocker: none operationally; the live arc is B-0867 v1-spec → implementation
Next concrete action: drive B-0867 workflow-engine-v1 (F# DU state-machine + Git append-only) impl; integrate B-0868 hats-become-workflow-definitions

## Why This Exists

The "TS workflow engine around DUs" workstream is the
workflow-engine-as-distributable-skill substrate: a TypeScript state-machine
built around a canonical F# **discriminated-union** contract, with Git
append-only commits as the event store, "move-next" as a universal action
grammar, an execute-menu-action loop, and the LLM as a pure selector. It
operationalizes the operator's behavior/data/docs separation (DV2.0 applied to
AI skills) and is positioned to replace Jira at the substrate level.

It is the software sibling of the two hardware-bringup workstreams
(`cluster-encryption-credential-substrate`, `usb-zflash-installer`): it is what
*runs the work* once the cluster exists.

## Grounding (on `origin/main`)

Shipped artifacts:

- [`.claude/skills/agent-loop/SKILL.md`](../../../.claude/skills/agent-loop/SKILL.md) — the distributable workflow-engine skill (active, ratified 2026-05-28)
- [`tools/agent-loop/`](../../../tools/agent-loop/) — TS behavior layer: `state-machine.ts` + `work-lifecycle-state-machine.ts` (+ test + README)

Grounding backlog:

- [`B-0867`](../../backlog/P1/B-0867-workflow-engine-v1-fsharp-du-state-machine-git-append-only-four-corner-monad-banned-if-universal-action-grammar-otto-five-modifications-multi-participant-non-cage-aaron-mika-kestrel-otto-2026-05-27.md) — workflow-engine-v1: F# DU state-machine + Git append-only + four-corner-monad + universal-action-grammar (the v1 spec)
- [`B-0867.15`](../../backlog/P1/B-0867.15-per-host-adapters-github-gitlab-gitea-bitbucket-isomorphic-cross-host-substrate-aaron-2026-05-28.md) — per-host adapters (github/gitlab/gitea/bitbucket isomorphic substrate)
- [`B-0867.20`](../../backlog/P1/B-0867.20-lifecycle-du-split-trajectory-push-vs-pr-review-determinereviewlevel-discriminator-kestrel-2026-05-28.md) — lifecycle-DU-split (push-vs-PR-review `determineReviewLevel` discriminator)
- [`B-0868`](../../backlog/P1/B-0868-hats-become-workflow-definitions-compression-unifies-hat-substrate-workflow-engine-heartbeat-folder-dashboard-aaron-2026-05-28.md) — hats *become* workflow definitions (unifies hat-substrate + workflow-engine + heartbeat-folder + dashboard)
- [`B-0862`](../../backlog/P1/B-0862-ople-primitives-implementation-extend-observe-persist-limit-emit-with-tfeedback-discriminated-unions-framework-primitive-substrate-engineering-aaron-2026-05-27.md) — OPLE primitives + TFeedback discriminated unions (framework-primitive substrate)

## Composes with

The DU / control-flow rule cluster auto-loaded in `.claude/rules/`:

- `monad-propagation-pattern-cross-language-substrate-shape.md`
- `asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` (the four-corner `Input<TInput,TInFeedback> -> Result<TResult,TOutFeedback>`)
- `ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md`
- `function-is-tiny-control-flow-generator-ocp-applied-to-control-flow.md`

## Current Rule

DUs carry the control flow; Git carries the state; the LLM only *selects* the
next move from a generated menu — it never invents transitions. Behavior (TS)
stays separate from data (Git commits) stays separate from docs (SKILL.md +
F# DU contract), so the engine ships as one auditable distributable skill.

## Current Next Action

Drive B-0867 v1 spec → implementation; fold in B-0868 (hats-as-workflow-defs).
Operator's call on priority vs the sibling workstreams.
