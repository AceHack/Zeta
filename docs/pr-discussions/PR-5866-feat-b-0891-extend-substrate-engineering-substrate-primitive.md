---
pr_number: 5866
title: "feat(081KSNY2Z0008QG0R0008PN7RQ extend): substrate-engineering substrate primitives for scenarios 3/4/5 \u2014 design-spec-complete; PersistedKV + PathFork + MultiVMOrchestration DUs; 21 new tests pass (operator 2026-05-28)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T16:19:02Z"
merged_at: "2026-05-28T16:24:09Z"
closed_at: "2026-05-28T16:24:09Z"
head_ref: "otto-cli/b-0891-extend-zflash-5-scenarios-2026-05-28"
base_ref: "main"
archived_at: "2026-05-28T17:32:10Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5866: feat(081KSNY2Z0008QG0R0008PN7RQ extend): substrate-engineering substrate primitives for scenarios 3/4/5 — design-spec-complete; PersistedKV + PathFork + MultiVMOrchestration DUs; 21 new tests pass (operator 2026-05-28)

## PR description

operator 2026-05-28 (shadow*) authorization to pick lane 1 (081KSNY2Z0008QG0R0008PN7RQ) and extend the 5 scenarios.

## What this PR does

EXTENDS 081KSNY2Z0008QG0R0008PN7RQ PoC scaffold (PR #5724) by adding **tools/zflash/test-harness/extensions.ts** + tests, moving scenarios 3/4/5 from 'scaffolded + blocked-on-X' to 'scaffolded + **design-spec-complete**' status with concrete typed primitives per the typestate-DU substrate cluster shipped today.

## Substrate-engineering substrate primitives

| Scenario | Primitive | Variants |
|---|---|---|
| **3 reformat-with-retention** | PersistedKVSubstrate | qemu-virtual-disk-overlay / qemu-tpm-emulator / file-system-bind-mount / qcow2-snapshot-restore (DEFAULT) |
| **4 reformat-from-scratch** | PathForkSubstrate | both-must-pass / exactly-one-passes / outcomes-equivalent comparison strategies; migrate-existing-creds + fresh-cluster default forks |
| **5 cluster-joining** | MultiVMOrchestrationSubstrate | NetworkTopology DU + JoinProtocol DU + OrchestratorKind DU + VMSpec |

Plus ImplDesignStatus DU + SCENARIO_IMPL_DESIGN mapping + computeImplDesignProgress aggregator (0/3 → 3/3).

run.ts --list updated to surface implDesign per scenario in JSON output.

## Tests

21 new tests (extensions.test.ts) + 20 existing (scenarios.test.ts) = **41 pass**.

## Composes with today's substrate cluster

asymmetric-authorship + monad-propagation + IMPLICIT-NOT-EXPLICIT + particle-as-locus + parallelizability-test + visual-geometric-shape-recognition (all auto-loaded rules from today).

## Scope

SPECS the impl-design primitives. Runtime QEMU integration (actually persisting state across boots; forking test paths; orchestrating multi-VM) remains PENDING — substrate-engineering substrate-shape now substantively-defined + composable + testable at type-level.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T16:22:42Z)

## Pull request overview

This PR extends the 081KSNY2Z0008QG0R0008PN7RQ zflash QEMU test-harness PoC (PR #5724) with a separate design-spec status layer for the three scaffolded scenarios (3/4/5). It adds typed discriminated-union primitives describing the substrate shape each scenario will need (state preservation, path fork, multi-VM orchestration), wired into `run.ts --list` JSON output. The runtime scenario status remains `scaffolded` in `scenarios.ts`; no QEMU runtime behavior changes.

**Changes:**

- Add `extensions.ts` defining `PersistedKVSubstrate`, `PathForkSubstrate`, `MultiVMOrchestrationSubstrate`, `ImplDesignStatus`, `SCENARIO_IMPL_DESIGN`, and `computeImplDesignProgress`.
- Surface `implDesignProgress` and per-scenario `implDesign` in `run.ts --list` JSON.
- Add `extensions.test.ts` with 21 type/value-level tests for the new primitives.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| tools/zflash/test-harness/extensions.ts | New typed primitives + per-scenario design-spec status mapping + progress aggregator. |
| tools/zflash/test-harness/run.ts | `--list` JSON augmented with `implDesignProgress` and per-scenario `implDesign`. |
| tools/zflash/test-harness/extensions.test.ts | Bun tests asserting variants, defaults, and aggregator counts. |

## General comments

### @chatgpt-codex-connector (2026-05-28T16:19:07Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
