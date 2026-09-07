# Guarded hidden-switch compilation: native semantic source review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Disposition: accepted for the bounded collection/DTO scope; actual replay pending

I read the native source at `7eaec2bf2312e04ff0fc936a4c28a09d1704b1f0`
against the [accepted falsifier design](2026-09-07-hidden-switch-compiled-falsifier-design.md)
and independently authored [six-member checker](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_falsifiers.py)
at `cdcf34d759a74201aa5599f4556e07af00f6dc4a`. The checked native working files
were byte-identical to that commit. This review found no material discrepancy
in the collection sites, ordered DTOs or counter semantics below.

## Matched boundaries

The ten intervention rows preserve the agreed kind/strategy order. Each
choice commits before the actual carrier transition; feedback state remains
receipt data. The future-suffix case copies the tape and flips drift index 8,
which can first change state/cue 9. The scorer intervention changes only recorded
rewards after the real transition. The separate band intervention replaces
exactly the lower 512 cells before projection. Caller isolation mutates the
supplied array after observe, then uses an independently created controller
for the changed-input control; its reset is visible in the event snapshots.

All 53 invalid operations have the agreed 15 groups and exact operation/input
rosters. The 38 invalid scalar calls decode fixture bits into the actual native
or compiled service, including null/depth-one branches. The two lowercase wire
cases remain parser refusals. The malformed-frame/order/prediction cases call
their relevant entries. Entry calls, service entries and actual evaluator-root
entries have distinct increment sites. Recursive Nodes are returned work, not
an alternative root-entry count. Terminal refusal setup reuses one actual
34-entry/49-event timeline and its actual terminal successor policy.

I also read the 9 new native tests, including active setup/copy/timeline
preservation when journal publication fails and actual accepted-result
retention at the refusal judgment seam. The latter uses a successful control
value and explicitly does not pretend its valid input is invalid. Completed
rows and available active diagnostics survive the tested publication failures;
these tests do not prove all possible I/O failures recover.

The standalone wrapper emits the exact six semantic members without a fake
outer descriptor. Its partial flags and missing categories retain full
source/archive, outer-negative and native runtime/body/closure admission as
pending. Its current placeholder bindings cannot establish those obligations.

## Exact inspected sources

All hashes below are uppercase SHA256 of the committed bytes.

| File under repository root | Bytes | SHA256 |
| --- | ---: | --- |
| src/Research.FSharp/HiddenSwitchCompiledConformance.fs | 10646 | 7E76EE09D652137529EBE9C99A15A52A84BA451CC71B993F76B65324DD0C4826 |
| src/Research.FSharp/HiddenSwitchCompiledInterventions.fs | 9260 | F36BF5DB4F636F835E7E4F6970B4095475DC702687781A3BC03B2773830167A0 |
| src/Research.FSharp/HiddenSwitchCompiledRefusals.fs | 14434 | 19EA35F51C364D00DBEAB6E74035C6761D63D85A7673B923C46819CDAC2ED4B6 |
| src/Research.FSharp/HiddenSwitchCompiledSemantic.fs | 8361 | 5F0CCE172E8DF731666EB626F22F43703BA51BD83D7D90B2781DC8FF6B57D1F2 |
| tests/Tests.FSharp/HiddenSwitchCompiledSemantic.Tests.fs | 13195 | 075D200F4F3923BE8F2E59C223D2BFBCE597BF7BB78FC58751A7EDB2FE5AE4D3 |

The native author reports 37 focused native tests passing, including these 9
new tests. I did not rerun them, build, import task modules, evaluate guards,
execute a policy/source tape or inspect actual semantic output in this review.
Acceptance is source-level agreement with a finite conformance contract;
actual native receipt replay and all final admission remain separate.
