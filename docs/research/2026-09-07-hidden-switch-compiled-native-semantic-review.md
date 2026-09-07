# Guarded controller: native semantic collector review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: two bounded retention findings; corrected source review pending

This read-only pass covers the native owner's initial four-module working
draft following `f8ccb0ba36b16111c1846340ec14ff291b39dd46`, together with
its CLI/project wiring and the settled independent Python falsifier checker.
These are observed uncommitted file identities, not a claim that the draft
was executed or preserved by a source commit:

| File under `src/Research.FSharp/` | Bytes | SHA256 |
| --- | ---: | --- |
| `HiddenSwitchCompiledConformance.fs` | 10,556 | `148e73aea85d35d6462119da6415f338664d01356cf9c5ba2f6474b5c2c0f380` |
| `HiddenSwitchCompiledInterventions.fs` | 7,541 | `4df76a4617a73aff6f77a6817cb83250e28f5d6454389baaa243818fd85d8405` |
| `HiddenSwitchCompiledRefusals.fs` | 10,453 | `2d5a3f83f040c67179ea3b312767ee859dd4706440a409136ab9ae51d0c2ea2e` |
| `HiddenSwitchCompiledSemantic.fs` | 7,904 | `664670b52284849fc22085203d445ba50410e44e220d9c371151274d54b8206d` |

The successful-path roster and fields agree with the settled checker:
ten ordered interventions, fifteen invalid-operation groups containing 53
actual calls, and the separate six-member semantic prerequisite. The code
increments service/evaluator counters at actual call sites, separately from
returned traversal nodes. Terminal setup has one create, seventeen observes
and sixteen choices: 34 entries and sixteen service calls. Choose returns a
committed own-action state before the carrier transition and private feedback
event. The scorer intervention changes recorded rewards while using the real
carrier frames; the band intervention changes only the lower 512 cells before
projection; the suffix intervention changes drift at index eight. Copy
isolation uses actual caller mutation and a fresh opposite-cue control.
These source observations do not establish actual native replay success.

## Findings before capture

1. **Unexpected acceptance loses its actual result.** The invalid-operation
   collector maps actual service/observe/choose returns to unit before
   judgment. If an invalid operation unexpectedly succeeds, the returned
   value, setup and observed counters are discarded; the collector returns
   only an unexpected-acceptance failure and prior refused rows. Preserve a
   bounded diagnostic of the actual result/input/setup/counters before
   propagating that failure. It can live outside the fixed refused-only DTO;
   the scientific failure must not be rewritten as an expected refusal.
2. **A broken checkpoint can hide an available active prefix.** Timeline
   observation, choice and reward arrays are updated after their fallible
   event publication. A checkpoint exception can therefore leave a real
   completed result in the event/state accumulator but absent from its
   episode arrays. The intervention collector then journals the incomplete
   timeline and returns an error without carrying that active prefix to the
   semantic runner. If the journal is unusable, the independent final output
   has only prior complete rows despite available in-memory evidence.
   Update accumulators before publication and carry a separate bounded active
   diagnostic through collectors to the final report, including copy/setup
   events, inputs and observed counters. Keep the six-member checker DTO and
   its incomplete status separate.

The requested discriminators are a deliberately accepted invalid-operation
result at the diagnostic boundary and a checkpoint exception immediately
after an actual observation/choice. They should prove that actual returned
values and the first failure survive without a registered stream or mutation
of the frozen policy. They are proposed tests, not executed reviewer evidence.

The reviewer read the initial focused tests for actual timeline equivalence,
intervention effects, all 53 refusal calls and completed-operation checkpoint
retention. No test, target, policy, source generator, dump query or measurement
was executed in this review. Both findings were sent to the owner; no final
source/capture acceptance is implied. Complete method, call-closure, source
archive and runtime admission remain separate pending obligations.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
```
