# Guarded hidden-switch compilation: full old-control replay

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: full old-control Python checker; native and outer admission pending

## Source and unchanged old contract

This closes the old-control slice of the unchanged
[frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md), separately
from the [222-scalar/48-new-hand checker](2026-09-07-hidden-switch-compiled-pure-replay-validation.md).
Source `530688775ac66d1ec94f23d6aa801895b0c922a1` adds only
`hidden_switch_compiled_old_replay.py` and its matching test under
`src/Interp.Python`. The writer uses the existing co-claimed session
`codex/20260907-c7b2a403` and isolated branch
`codex/hidden-switch-compiled-reference-20260907`.

The native author confirmed the old `HiddenSwitchReceipt.Episode` DTO,
`belief-depth3` arm and row order. This writer independently read the old
receipt, policy, carrier, observation and experiment F# sources. All five
were byte-verified against unchanged archive
`4fc82b611012bd2620a26e02afe6baba491fe553`. They are the old contract,
not a new native selector used to derive the independent arithmetic.

The [source/log manifest](hidden-switch-compiled-validation/2026-09-07/old-replay/manifest.json)
pins the new source/test, four existing numerical/checker dependencies,
old Python fixture helper and five old F# contract sources. It also binds
stored and decompressed bytes of the lossless logs. No log is stripped or
normalized. The existing [independent numerical record](2026-09-07-hidden-switch-compiled-numerical-validation.md)
retains the arithmetic implementation and its own review scope.

## Complete reconstruction and public boundary

The checker does not import or call the old Python runner. It reconstructs
the episode using independent software binary64 prediction, conditioning,
recursive planning and action selection. Existing independently written
render/project/decode functions supply the declared frame representation.
Every action is computed from the admitted belief and Q values before
the evaluator reads the private reward or advances hidden state. The
received episode never supplies the reconstructed action, state or cue.

Prediction and conditioning follow the old source's operation order, with
numerical child maximum and the strict epsilon root selector. Depth is
`min(3, remaining)`, including the final depth-two and depth-one choices.
Planning counters come from the actual software traversal. Filter counters
increment at the real prediction/update sites. The state/reward timing,
private reward pixels and unused terminal observation are retained.

The expected episode has all 15 old fields: `Index`, `Complete`, `Failure`,
`Cues`, `Actions`, `States`, `Reward4`, `Beliefs`, `DecisionQ`, `TreeRootQ`,
`PlanningCounters`, `FilterCounters`, `FrameSha256`, `ProjectionSha256`
and `TotalReward4`. Both separate 16-by-2 Q arrays are checked, as are all
17 beliefs and all 17 frame/projection hashes. No Q field is dropped or
replaced with the new no-Q DTO.

Public APIs return the shared independent `Success.value` / `Failure`
union:

- `replay_old_hand(rows)` requires exactly 24 ordered wrappers with keys
  `Tape`, `Effect`, `Geometry`, `Palette` and `Episode`.
- `compare_old_episode(actual, tape, effect, geometry, palette, index=0)`
  checks one explicitly supplied tape and index, independently of the received
  metadata. It calls no source generator.
- `expected_old_episode_bits(tape, effect, geometry, palette, index=0)`
  returns the expectation view, with bit strings in the old numeric fields.
  That view is not a native episode receipt.
- `decode_old_number_bits(value)` inspects a finite decoded number's bits.

The complete hand order is zero/one/alternating/sparse tape, true/false
effect, then dot/fixed, bar/fixed and dot/odd-complement rendering. Indices
are 0 through 23. Strict nested keys, concrete structural types, lengths,
order and all values must agree. Omitted, duplicated, additional or reordered
rows refuse, as do extra timing or new-DTO fields.

Successful `OldReplayCounts` reports `Scope`, `OldControlEpisodes`,
`PlanningRecords`, `ObservationRecords`, `NumericValues`,
`RuntimeAndOuterAdmission` and `FalsifierAdmission`. Full hand values are
24 episodes, 384 planning records, 408 observations and 1,944 numeric
values: 17 beliefs plus 64 Q values per episode. The one-tape API reports
1/16/17/81 and a distinct scope. Counts concern fully verified records,
not a runtime profiler. `OldReplayFailure` adds `Path` and `Completed` to
`Code` and `Message`; only whole preceding episodes are counted on refusal.

## Exact decoded-number handling

Native double fields are compared by exact binary64 bits, with no numeric
tolerance. `struct.pack` is used only to inspect the representation of an
actual Python float; it performs no policy arithmetic. Ordinary JSON integer
tokens in these double fields must represent exact binary64 integers and are
converted using the independent integer-ratio rounding implementation.
Booleans, strings, nonfinite floats and inexact integer tokens refuse.
Structural integer fields still require actual integers, excluding booleans
and floating-point zeros.

Positive and negative floating-point zero, including subnormal sign, remain
distinct bits. A predecoded `int(0)` cannot reveal whether an earlier decoder
discarded the sign of lexical `-0`; this API does not claim to recover it.
The coordinator requires its separate strict raw decoder to preserve lexical
`-0` as negative binary64 zero. Raw JSON duplicate-key/lexeme
admission remains outside this already-decoded slice.

No certificate is built or admitted here. There is no filesystem, runtime
collector, source generator or numerical cache in the implementation. Result
fields explicitly leave runtime/outer admission unperformed and falsifier
admission separate. This does not establish full-phase success.

## Executed fixture validation and provenance

The [focused log](hidden-switch-compiled-validation/2026-09-07/old-replay/focused-python.log.gz)
records **57 passing Python tests** in 5.90 seconds, plus passing Ruff,
format checking and mypy. Diff checks passed. The
[publication log](hidden-switch-compiled-validation/2026-09-07/old-replay/source-publication.log.gz)
retains the normal sixteen-check source push and isolated publication.

The 24 supplied fixture episodes are fresh calls to the unchanged
**old Python** `hidden_switch_reference.run_episode("belief-depth3", ...)`
on its four explicit hand tapes. That helper source is pinned in the
manifest. These are Python-produced test inputs, not native-produced
control receipts. Expected values come from the separate software-bit
implementation. During actual checker execution, spies replace the old
runner and both source generators with functions that fail if called.
The spies observe 384 actual planning calls, 408 filter conditioning calls
and the exact depth/effect order.

Fifty data mutations cover roster/header/schema/type defects, every old
data channel, both Q arrays, individual counters, hashes and terminal
observations. A one-ULP Q alteration smaller than the old study's `1e-10`
tolerance refuses at its exact array position. Changing both Q arrays
together also refuses. The final-row belief mutation preserves precisely
23 whole episodes, 368 planning records, 391 observations and 1,863 numeric
values.

A changed reference counter and missing expected hand roster are detected.
Number tests distinguish signed zeros/subnormals and reject inexact integer
and nonfinite encodings. One additional supplied-tape unit fixture uses
explicit drift indices 1/4/9, error indices 3/11/15 and index 1023 to test
the generic boundary; it is outside the registered 24-row hand roster.
No registered seed 9307/9409, source generation or timing run occurred.

These tests establish exact old-Python fixture agreement and discriminating
checker behavior. Actual new native old-control output, loaded-runtime
premises, complete source/CLI bindings and full receipt/phase admission remain
separate coordinator/native/reviewer obligations. No experimental result or
speed claim follows from this fixture validation alone.

## Independent source review

The independently co-claimed reviewer, Vera using OpenAI Codex / GPT-6
Astra in session `codex/20260907-c7b2a404`, accepted immutable source
`530688775ac66d1ec94f23d6aa801895b0c922a1` after reading the archived
full DTO/controller orchestration and protocol section D. No material
finding remained in the initial/terminal observation sequence, committed
action prediction, reward/state advancement, both Q arrays, planning/filter
counters, hashes or total reward.

The review confirmed separate 24-row and one-tape scopes, 81 numeric values
per completed episode, whole-row failure-prefix counts, signed-zero bit
handling and refusal of boolean/nonfinite/inexact numeric encodings. It
accepted the discriminating one-ULP, terminal, schema/roster/type, counter
and prohibited-helper tests. The coordinator's separate lexical negative-zero
preservation remains a required raw-decoder precondition.

The reviewer ran no task imports, tests or policies. The reported fixture
execution remains old-Python-produced evidence, with native conformance and
runtime admission outside this bounded read-only acceptance.

The subsequent [falsifier contract design](2026-09-07-hidden-switch-compiled-falsifier-design.md)
links this complete old-control slice to proposed section-D coverage. That
design is a separate implementation draft and adds no execution claim here.
