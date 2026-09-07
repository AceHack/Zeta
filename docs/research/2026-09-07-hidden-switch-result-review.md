# Hidden-switch result: independent provenance and arithmetic review

Date: 2026-09-07
Reviewer: Vera (protocol_review), OpenAI Codex using GPT-6 Astra
Recorded by: Vera (root), OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Disposition: evidence and scalar audit accepted; reporting caveats retained

The reviewer independently read the original
[registered records](hidden-switch-results/2026-09-07/README.md) after their
once-only native execution and completed Python replay/verdict. It checked
source/hash/roster correspondence and recomputed scalar arithmetic using
inline standard-library Python. No standalone execution script or log was
retained for this reviewer pass; this attributed record preserves the
reported findings, not a fabricated retrospective execution trace. The raw
receipts, native/reference invocations and their outputs are preserved
separately.

## Findings and accepted boundary

No material provenance, roster or arithmetic finding remained. The reviewer
verified every measurement-manifest file hash and byte length, the raw
behavior-to-cost-to-replay-to-verdict bindings, nineteen scientific source
hashes against the archive/current files, annotated archive types and
registration ancestry. The source was the same
`4fc82b611012bd2620a26e02afe6baba491fe553` throughout native execution and
both reference invocations. The recorded Core/Core.Abstractions hashes and
MVIDs matched, and archive verification preceded behavior, which preceded
costs. These records identify artifacts and chronology; they do not prove
source-to-binary derivation or process isolation.

The independently counted roster is 16,384 behavioral episodes, 262,144
actions and 278,528 observations. The reviewer recomputed every panel return
and gain, verified natural/padded action, reward and belief equality, and
checked null all-harvest/equal-reward behavior. All twenty cost rows follow
the frozen cyclic order, with exact warmup indices 0..7 and timed indices
8..71: 160 warmup and 1,280 timed executions. The same-arm traces repeat
identically across its five rows. All per-arm medians and ratio-of-medians
values exactly match the computed verdict.

The three independently recomputed gains are `0.1248321533203125`,
`0.1067657470703125` and `0.1173095703125`. The planner/padded wall and
allocation ratios are `1.005628842594892` and `1.0`. The original raw verdict
SHA256 is
`D0FBFFE371155002A204BAE3959B788A4E1B54D1AD83761D0E5933CB9CB67222`.
This review is not another full independent reference reconstruction and
collected no new registered source stream, behavior or timing.

## Resource and reporting caveats

The first planner row's full 61.477042 ms remains retained. The registered
median condition can pass with this row included; its absence from the
median value does not establish steady timing or explain its cause. All
twenty rows repeat the same 72-tape corpus, rather than representing twenty
independent task samples. Earlier rows also differ in allocation.

Process snapshots show active user, agent and system applications, including
a sampled Python process before costs. The Python orchestration process was
itself part of the measurement invocation. Sampled CPU values cannot prove
interval-wide isolation or attribute timing variation. The existing native
HostActivity and quiet-window declarations correctly limit coordination to
this team's heavy work.

The logical payload ledger remains explicitly partial, excluding code
constant storage, headers, Q/trace/digest arrays and other named allocations;
it is not resident memory. The planner/natural-myopic wall ratio
`1.2803677024210003` and allocation ratio `1.7165831934000146` remain visible
alongside the padded comparison. No speed advantage, CPU gate, energy or
peak-heap result is supported. The report must retain supplied-model,
compiled-controller and full-horizon optimality limits.

## Final report reread

The final report's scalar tables, early slow rows, supplied-model and
compiled-controller limits, and source-versus-binary caveats matched the
evidence. The reviewer found one inaccurate attribution: the raw-record
index initially called its compact-output size bound preregistered, although
no numeric bound appears in the frozen protocol. The index now states only
the observed 78,026,027-byte size and compact serialization. The correction
changes reporting, not protocol, implementation or any raw receipt. The
report also explicitly states that all twenty rows repeat one 72-tape corpus.

## Publication review: public panel roster

At publication head `f52b00065eb8055a32aea4bd93628df7537f4949`,
[CodeQL](https://github.com/Lucent-Financial-Group/Zeta/pull/16928#discussion_r3949842024)
reported `hidden_switch_reference.py:37`'s global `PANELS` unused.
Root and the independent `protocol_review` reviewer inspected the exact
source and found its direct public consumer at
`tests/test_hidden_switch_reference.py:65`: the existing registered-constant
test reads `ref.PANELS` and checks the four ordered panel names. The reviewer
accepted this as a false positive for the unused-global claim. Replay has
its own independently authored roster; this disposition does not claim
that production replay consumes the reference module's definition.

Root ran that one existing test on the unchanged publication head. It
passed in 4.74 seconds; the [original log](hidden-switch-validation/2026-09-07/root-codeql-panel-roster-test.log)
and [source/command record](hidden-switch-validation/2026-09-07/root-codeql-panel-roster-test.json)
are retained. The reviewer performed source inspection and did not execute
another test or scientific run. The frozen scientific module, nineteen-file
manifest, native/reference receipts and immutable tags remain unchanged.

The [recorded reply](https://github.com/Lucent-Financial-Group/Zeta/pull/16928#discussion_r3950047125)
explains this consumer; the review thread was then resolved.
