# Guarded controller: native semantic collector review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: corrected source accepted for the bounded semantic hand collector

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

## Corrected source disposition

Final reviewed source is
`7eaec2bf2312e04ff0fc936a4c28a09d1704b1f0`. Its committed files match
the inspected working source:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Research.FSharp/HiddenSwitchCompiledConformance.fs` | 10,646 | `7e76ee09d652137529ebe9c99a15a52a84ba451cc71b993f76b65324dd0c4826` |
| `src/Research.FSharp/HiddenSwitchCompiledInterventions.fs` | 9,260 | `f36bf5db4f636f835e7e4f6970b4095475dc702687781a3bc03b2773830167a0` |
| `src/Research.FSharp/HiddenSwitchCompiledRefusals.fs` | 14,434 | `19ea35f51c364d00dbeab6e74035c6761d63d85a7673b923c46819cdac2ed4b6` |
| `src/Research.FSharp/HiddenSwitchCompiledSemantic.fs` | 8,361 | `5f0cce172e8df731666eb626f22f43703ba51bd83d7d90b2781dc8ff6b57d1f2` |
| `tests/Tests.FSharp/HiddenSwitchCompiledSemantic.Tests.fs` | 13,195 | `075d200f4f3923be8f2e59c223d2bfbce597bf7bb78fc58751a7edb2fe5ae4d3` |

The first finding is resolved by retaining the actual accepted result, input,
setup and call deltas before returning typed `unexpected-acceptance`. A real
successful service result exercises the shared judgment seam in a synthetic
test; the test does not claim its deliberately valid input was invalid.
The second finding is resolved by updating observation/choice/reward arrays
before checkpoint publication and returning active diagnostics separately
from the fixed six-member semantic DTO. The final report independently writes
that available prefix even when every later journal callback fails. Primary
computation failure survives subsequent checkpoint, output and disposal errors;
a publication-only failure cannot produce successful completion.

The final reread identified one additional instance of the same retention
boundary: the suffix tape had been changed before a fallible mutation
checkpoint, while active diagnostics still described only its baseline.
The correction retains the baseline, changed tape and actual mutation event
before that checkpoint and carries this context into an altered timeline's
failure. Its ninth focused fixture fails exactly at mutation publication and
checks the preserved flipped bit. Exact timeline tape/flags and planned
refusal operation/input are also recorded before their relevant fallible
publication. Copy/setup/terminal prefixes retain actual events and counters.

No remaining material source finding was identified. The other four files in
the nine-file commit provide CLI/test-project wiring and change only the hand
collector's accessibility from private to internal. The reviewer inspected
the final nine semantic tests and the existing regression coverage without
running them. The retained regression-2 TRX contains 37 individual Passed
outcomes, including all nine semantic cases, and zero skipped/failed outcomes;
its 57,221 bytes hash to
`d72db46d3f643afbc348d5cab9441015170d693108bc0a14b61253f9b91b59b6`.
The retained final focused build and standalone CLI build report 28.40 and
4.32 seconds respectively, each with zero warnings and errors. Earlier failed
build attempts remain the owner's diagnostic history and are not overwritten
by this acceptance. No actual semantic capture had occurred when this source
review closed. Successful future six-member replay, full envelope/source
archive, executing graph and runtime admission remain separate obligations.

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
