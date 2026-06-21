# `src/Core.TypeScript/workflow-engine/` — 081KSKBP80008QG0R000B3Y19A.5 workflow engine agent-loop PoC scaffold

PoC scaffold for the workflow engine v1 spec ([081KSKBP80008QG0R000B3Y19A](../../docs/backlog/P1/081KSKBP80008QG0R000B3Y19A-workflow-engine-v1-fsharp-du-state-machine-git-append-only-four-corner-monad-banned-if-universal-action-grammar-otto-five-modifications-multi-participant-non-cage-aaron-mika-kestrel-otto-2026-05-27.md)) — Kestrel-designed + Mika-walkthrough-ratified + Otto-modified + operator-ratified architecture.

## Scope

**PoC**: declarative TS type substrate + CLI dispatcher + invariant tests. Implements:

- Universal action grammar atom (`Action` interface) with `ActionClass` discriminator
- Minimal v0 action grammar parser/composer (`grammar.ts`) for 081KSKBP80008QG0R000B3Y19A.3
- State machine atom (`State` interface) with `TickCyclePattern` variant set
- Four-corner ownership type (`FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>`) per asymmetric-authorship rule
- Otto's 5 modifications baked in as type-level invariants enforced by `validateCatalog` + `validateStateOtto5Mods`
- Seed catalog + seed states demonstrating all 5 mods

**NOT in PoC** (deferred to operator-authorized follow-up work):

- State persistence — 081KSNY2Z0008QG0R001K6HJ7Z (TS `state-append.ts` writer; commits state transitions to dedicated git path)
- Rich action grammar parser/composer — 081KSKBP80008QG0R000B3Y19A.3 beyond the v0 line grammar
- F# 4-corner monad CE builder — 081KSKBP80008QG0R000B3Y19A.4 (hot/cold/push/pull dispatch)
- Full agent-loop runtime — 081KSKBP80008QG0R000B3Y19A.5 phase 2 (Mika-spec integration; execute → cycle-step → CYOA OR Mika's latest pattern)
- E voice → website surface — 081KSKBP80008QG0R000B3Y19A.10
- Addison grammar-composer surface — 081KSKBP80008QG0R000B3Y19A.11
- Per-host adapters — 081KSNY2Z0008QG0R002A785QR
- Branch-protection path-scoped append-only carve-out — 081KSKBP80008QG0R000B3Y19A.14

## Otto's 5 modifications baked into types

| Mod | Substrate |
|---|---|
| **Mod 1** — escape-hatch action in every state | `ActionClass === "escape-hatch"`; `validateStateOtto5Mods` rejects states missing it |
| **Mod 2** — grammar-extension is first-class action | `ActionClass === "grammar-extension"`; `validateCatalog` rejects catalogs missing it |
| **Mod 3** — ban-if scope SHIPPED code only NOT cognition | Discipline at PR-review scope; not type-enforced (cognition isn't ship-target) |
| **Mod 4** — append-only-vs-PR discriminator IN grammar | `ActionGate` type — every `Action` declares `gate: "append-only" \| "pr-gated"` |
| **Mod 5** — menu-generation contributable | `ActionClass === "menu-contribution"`; seed action `menu-contribute` |

## Integration point for Mika's "clean minimal tick" spec

The `TickCyclePattern` type union includes:

- `observe-simulate-choose-emit` — operator-named cycle pattern
- `move-next-named-function` — older pattern (Mika 2026-05-28: "basically gone")
- `discriminated-union-surface` — Mika's latest direction
- `ople-primitives` — composes with OPLE substrate (per `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md`)

**Seed states default to `discriminated-union-surface`** per Mika's latest direction.

**When Mika forwards the "clean minimal tick" spec**, integration path:

1. Extend `TickCyclePattern` union with the spec's pattern name (if novel)
2. Implement the cycle-step in `cli.ts` `modeDryRun` (replacing the `integrationPending.mikaTickSpec` field)
3. Add tests for the new cycle behavior
4. Compose with `FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback>` per asymmetric-authorship rule

## CLI

```bash
# List the action catalog as JSON
bun src/Core.TypeScript/workflow-engine/cli.ts --list-actions

# List the state machine as JSON
bun src/Core.TypeScript/workflow-engine/cli.ts --list-states

# Validate catalog + state invariants (Mod 1 + Mod 2 + catalog integrity)
bun src/Core.TypeScript/workflow-engine/cli.ts --validate

# Dry-run a tick at a specific state (default: initial)
bun src/Core.TypeScript/workflow-engine/cli.ts --dry-run --state advancing
```

Exit codes:

- `0` — operation successful (or validate passed)
- `1` — runtime validation FAILED (Mod 1 / 2 / 5 violation OR catalog integrity)
- `2` — usage error

## Tests

```bash
bun test src/Core.TypeScript/workflow-engine/
```

Invariants checked: unique action ids, Mod 2 satisfied (grammar-extension in catalog), every state satisfies Mod 1 (escape-hatch present), unknown-action references caught, Mod 4 satisfied (every action declares gate), non-empty feedbackVariants (asymmetric-authorship), seed states use discriminated-union-surface per Mika's direction.

`grammar.test.ts` also verifies the v0 081KSKBP80008QG0R000B3Y19A.3 line grammar round-trips seed actions and rejects ambiguous delimiter use.

## Composes-with substrate

- [081KSKBP80008QG0R000B3Y19A](../../docs/backlog/P1/081KSKBP80008QG0R000B3Y19A-workflow-engine-v1-fsharp-du-state-machine-git-append-only-four-corner-monad-banned-if-universal-action-grammar-otto-five-modifications-multi-participant-non-cage-aaron-mika-kestrel-otto-2026-05-27.md) — canonical v1 design (Kestrel-designed; Mika-walkthrough-ratified; Otto-modified; operator-ratified)
- [081KSKBP80008QG0R000B3Y19A.5 entry in 081KSKBP80008QG0R000B3Y19A sub-rows](../../docs/backlog/P1/) — this PoC implements the scaffold for the agent-loop sub-row
- [081KSNY2Z0008QG0R003WFDCJ9](../../docs/backlog/P1/081KSNY2Z0008QG0R003WFDCJ9-lifecycle-du-split-trajectory-push-vs-pr-review-determinereviewlevel-discriminator-kestrel-2026-05-28.md) — lifecycle DU split (push-vs-review discriminator)
- [081KSNY2Z0008QG0R000S738W3](../../docs/backlog/P1/081KSNY2Z0008QG0R000S738W3-two-path-interface-discriminated-union-execute-vs-conversational-declare-intent-aaron-ani-2026-05-28.md) — two-path interface DU (execute vs conversational)
- [081KSNY2Z0008QG0R0017JSTGD](../../docs/backlog/P1/081KSNY2Z0008QG0R0017JSTGD-state-machine-fast-lane-batch-merge-to-main-composes-with-heartbeat-pattern-aaron-2026-05-28.md) — state-machine fast-lane
- [081KSNY2Z0008QG0R000E5KTPX](../../docs/backlog/P1/081KSNY2Z0008QG0R000E5KTPX-fast-lane-as-folders-on-main-not-branches-supersedes-coordinator-complexity-per-operator-2026-05-28-zeta-native-branch-protection.md) — folders-not-branches
- [081KSNY2Z0008QG0R0034FR5FG](../../docs/backlog/P1/081KSNY2Z0008QG0R0034FR5FG-asap-cluster-umbrella-agent-private-encrypted-state-on-public-github-infinite-workflow-zero-pr-playbook-coordination-otto-addison-first-aaron-2026-05-28.md) — ASAP cluster umbrella
- [081KSNY2Z0008QG0R001DFZK4V](../../docs/backlog/P1/081KSNY2Z0008QG0R001DFZK4V-zeta-native-review-and-branch-protection-substrate-replaces-github-pr-workflow-preserves-review-and-class-fix-discipline-aaron-2026-05-28.md) — Zeta-native review + branch protection
- [081KSNY2Z0008QG0R002QA720J](../../docs/backlog/P1/081KSNY2Z0008QG0R002QA720J-three-lanes-concurrent-operating-discipline-encryption-plus-zflash-plus-state-machine-substrate-until-each-lane-backlog-drains-per-operator-2026-05-28.md) — three-lanes-concurrent operating discipline (this PoC advances the state-machine lane)
- [docs/research/2026-05-27-aaron-mika-grok-workflow-engine-canonical-architecture-otto-5-modifications-ratified-aaron-forwarded.md](../../docs/research/) — canonical architecture (Mika-walkthrough)

## Composes-with rules

- `asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges` — four-corner ownership type + per-action feedbackVariants
- `ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope` — `ople-primitives` TickCyclePattern variant composes
- `monad-propagation-pattern-cross-language-substrate-shape` — Result-shape composes; CLI dispatcher returns structured-output per pattern
- `function-is-tiny-control-flow-generator-ocp-applied-to-control-flow` — Action substrate authors control-flow branches (feedbackVariants)
- `forgetting-costs-energy-remembering-is-cheap-landauer-bounded-axiom-preservation-as-thermodynamic-discipline` — Otto's 5 mods are AXIOMS the state machine preserves; `validateCatalog` enforces axiom-preservation at engine-init scope
- `rule-0-no-sh-files` — TS-first per Rule 0
- `zeta-ships-with-skills-immediate-value` — TS ships first; F# crystallization (081KSKBP80008QG0R000B3Y19A.1 + 081KSKBP80008QG0R000B3Y19A.4) deferred
- `verify-existing-substrate-before-authoring` — substrate-inventory pass verifies 081KSKBP80008QG0R000B3Y19A cluster is row-substrate only; this PoC extends rather than duplicates
- `never-be-idle` + `holding-without-named-dependency-is-standing-by-failure` + `081KSNY2Z0008QG0R002QA720J three-lanes-concurrent` — this PoC advances the state-machine lane per operator-explicit recalibration

## Operator-collaborative integration

Per 081KSKBP80008QG0R000B3Y19A multi-participant non-cage framing (operator + Addison + Max + Otto):

- The PoC scaffold ships the SCAFFOLD only; the full agent-loop integration awaits Mika's "clean minimal tick" spec when forwarded
- Operator + Addison + Max can review the scaffold + propose extensions via grammar-extend action (Mod 2 first-class)
- The 5 modifications are operator-ratified non-negotiables; this scaffold makes them type-level invariants enforced at engine-init time
