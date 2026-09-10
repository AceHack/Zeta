# Rendered catch actions: preregistration

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Work item: 081M1W8T690087G0R002DJ91MJ
Author: Vera, OpenAI Codex using GPT-6 Astra
Registration basis: `b5ef469d805aecbc1af8ba58af5bc52d0b7cfbe1`
Review freeze: 2026-09-06T21:43:14Z
Registration status: reviewed and frozen before acting implementation/measurement
Prerequisite PR #16858: pending main landing at registration

## Question and claim boundary

Does the passive experiment's frozen fitted order-two predictor improve real
keypad-action return over fitted bigram, last-beacon, and fair controls when
all decisions receive the same chronological rendered observation channel?
This protocol indexes the
[source/design audit](2026-09-06-rendered-catch-followup-design-audit.md) and
[new work item](../../workitems/081M1W8T690087G0R002DJ91MJ-preregister-rendered-catch-actions-from-a-frozen-chronologic.md).
Its predecessor is the
[passive experiment](2026-09-06-rendered-signal-predictor-protocol.md), whose
[results](2026-09-06-rendered-signal-predictor-results.md) retain order-two
counts as the next acting-carrier candidate.

This is a source-owned classic CHIP-8, history-dependent contextual bandit.
Keys change catcher position and collision feedback; they do not change the
target generator. Supply the goal, "Choose the lane that catches the next
target; maximize hits over 64 scored choices," plus `Pad 0` = left and
`Pad 1` = right. The target-band projection is supplied representation.
No learned vision, goal acquisition, multi-step planning, action-dependent
world-model learning, unseen-dynamics generalization, or ARC claim follows.
Use no ARC data and make no hosted-policy change.

The choices below are frozen after coordinating review. The registration
basis merges current main `0e3456d604096b0b8d51b6be91704650d7d3d323` and
the remotely preserved predecessor branch at
`69ba5db2f663a44e81d85e1c70bfb02c660fb7e5`. Thus the exact input receipt and
source links resolve through real ancestry while PR #16858 remains pending;
the prerequisite is not represented as already merged to main. Preserve this
protocol remotely before acting implementation, and preserve the implementation
remotely before any evaluation or timing. No acting implementation or
measurement exists at registration.

## A. Exact input artifact and frozen policies

Read the raw bytes of
[`rendered-signal-results.json`](../../src/Research.FSharp/rendered-signal-results.json).
Require `Complete=true` and exact SHA-256:

```text
C59468575B140DA146265182EE40B03D6F6B5103FAAC9A0137CE8A288DF357B3
```

Use only its `Counts` field for fitted policies. Validate shape, finite strict
interior probabilities, and every binary row's sum within `1e-12` of one.
Do not refit, recalibrate, select a seed, tune a threshold, or learn during
acting episodes. Hash all 14 float64 values, each IEEE-754 little-endian:
`Unigram` first, then row-major `Bigram`, then row-major `OrderTwo`. Require:

```text
8BEFD54B878D600A31A75BB5FA159588D2FDA4A849CAFB1410F03D6BC9B5B2A5
```

Assert this hash before and after the complete experiment and cost run.
The frozen five-arm order is:

| Arm | Decision from decoded observations preceding the next target |
| --- | --- |
| `order-two` | Use frozen `Counts.OrderTwo[previousPrevious][previous][1]`. |
| `bigram` | Use frozen `Counts.Bigram[previous][1]`. |
| `last-beacon` | Choose the most recently observed target's lane. |
| `fair-independent` | One independent draw `u`; choose `floor(2*u)`. |
| `known-lag-two` | Prefix-only diagnostic: choose the observation two positions back. |

Fitted arms choose key 1 only when `p1 > .5`; ties choose key 0. Scored
choices always have at least two preceding observations. The known-law arm
receives only that prefix, never the next target or generator state. The
supplied count artifact makes bigram's greedy actions equal last-beacon's;
retain both arms but do not count them as independent evidence. No RNN arm.

## B. Source panels and action streams

Use `ResearchRandom.Stream(ResearchRandom.domain(seed, domain))` with the
existing SplitMix64 rule. Each panel has one persistent source stream across
all rows in declared order. Every row contains exactly 66 symbols `S0..S65`.
Consume exactly one draw per position: for positions 0/1 use `floor(2*u)`;
for each later position copy the symbol two places earlier iff `u < p`.
Reset source history between rows, never the panel stream.

| Panel, in order | Episodes | Source seed/domain | Copy probability | Geometry | Emitted palette |
| --- | --- | --- | --- | --- | --- |
| `dot-three-quarter` | 1,024 | 4001 / 401 | .75 | dot `80`, x=16/48, y=8 | fixed |
| `bar-three-quarter` | 1,024 | 4001 / 402 | .75 | bar `E0`, x=16/48, y=20 | fixed |
| `palette-three-quarter` | 1,024 | 4001 / 403 | .75 | fixed dot `80`, x=16/48, y=8 | complement all emitted cells at odd observation indices |
| `dot-iid-half` | 1,024 | 4001 / 404 | .5 | dot `80`, x=16/48, y=8 | fixed |

The IID panel uses `.5` from position 2 through 65, all 64 scored targets.
Each panel consumes 67,584 source draws. Generate one corpus per panel and
use the same ROM bytes, in the same order, for all five arms. Palette parity
is the within-episode observation index, including bootstrap 0 and warmup 1.
Complementation is an explicit copied-frame adapter operation; never mutate
the emulator display. The palette panel does not alternate shape or Y.

Fair action streams use seed 5003 and respective domains 501..504. Keep one
persistent fair stream per panel across all episodes. Consume exactly one
draw per scored choice: 65,536 draws per panel. Bootstrap and fixed warmup
consume no fair draw. The other four arms consume no action-random draws.
Source and action streams share no mutable state. Model/history state resets
per episode; fair stream state persists across episodes within its panel.

## C. Persistent environment and chronological schedule

Use `GameEnvironment.Chip8Adapter(rom, 1UL, 17)` through
`IEnvironment<Chip8Cow.Frame>`. Reset once per episode; do not use `stepOnce`,
which resets on every call and gives its chooser environment metadata.
The emulator seed is fixed and unused by this admitted ROM, which has no
`RND` opcode. Call `Frame` after each complete `Step` and pass only a copied
target-band projection to the policy's observation method.

| Phase | Submitted action | Newly observed symbol | Accounting |
| --- | --- | --- | --- |
| Bootstrap | `Go "stay"` | `S0` | One initialization step; no key and no reward glyph |
| Warmup | Fixed `Pad 0` for every arm | `S1` | One real unscored key action; retain its hit feedback |
| Scored choices 0..63 | Policy-selected `Pad 0/1` | `S2..S65` | 64 key actions and 64 scored hits |

Feed both initial observations through the normal projection and observation
update. Before choosing for `St`, the policy has received only `S0..S(t-1)`.
Commit the chosen key to the trace before calling `Step`; submit that exact
key. The ROM latches it before loading or drawing the next target. Observation
and choice are distinct policy operations, so warmup adds history without
requesting a scored decision or consuming a fair draw.

Each episode has 66 primary environment calls, 65 key actions, 64 scored
choices, and one fixed warmup key action. Primary execution performs 1,122
instructions. The private shadow audit in section D performs another 1,122:
**2,244 actual emulator transitions per episode**, plus 66 primary and 66
shadow timer ticks. Read and retain warmup feedback but exclude it from
return. Refuse every call after `S65`.

## D. Admitted classic ROM and exact instruction budget

Each ROM has 17 bootstrap instructions, 65 unrolled groups of 17 instructions,
one final self-jump, and one sprite byte: 2,247 bytes total. Loaded at `0x200`,
bootstrap ends at `0x222`; group 64 starts at `0xAA2`; its end/self-jump is
`0xAC4`; sprite is at `0xAC6`. All program/data fit below `0x1000`.

Bootstrap opcodes in exact order are `00E0`, `6118`, `63yy`, `6404`, `651A`,
`62xx`, `AAC6`, `D231`, then nine `6E00` padding instructions. Here `yy` is
8 for dot/palette/IID or 20 for bar; `xx` is the X for `S0`. The final sprite
byte is `80` for dot/palette/IID or `E0` for bar. The register defaults and
font set come from `Chip8Cow.create`.

Every action group, in exact order:

| Position | Opcode | Effect |
| --- | --- | --- |
| 1 | `F00A` | Consume admitted key 0/1 into V0. |
| 2..6 | `800E` five times | Multiply V0 by 32. |
| 7 | `7010` | Set catcher X to 16/48. |
| 8 | `00E0` | Clear the display. |
| 9 | `AAC6` | Select the episode's one-row sprite. |
| 10 | `D011` | Draw catcher at y=24. |
| 11 | `62xx` | Load the next target X, 16/48. |
| 12 | `D211` | Draw target at y=24; collision sets VF. |
| 13 | `86F0` | Save the hit bit in V6. |
| 14 | `D211` | XOR the transient target again, restoring catcher. |
| 15 | `D231` | Reveal target in the upper band, y=8/20. |
| 16 | `F629` | Select built-in font glyph 0/1 from saved hit bit. |
| 17 | `D455` | Draw hit glyph at x=4, y=26. |

The final self-jump is `1AC4`. Validate the complete byte array, permitted
operands, length, sprite location, and font bounds before loading.
Every admitted action group has 17 advancing instructions. `FX0A` consumes
the lowest held key, including zero; with no key held it repeats. The
adapter sets a fresh single-key array per action. After bootstrap, reject
no-key or any action outside `Pad 0/1` at the runner boundary. Never permit
extra keys, self-modification, unknown opcodes, or host pixel replacement.

`Chip8Adapter.Step` encapsulates its individual instructions, so the runner
cannot directly observe their intermediate PCs. Keep the actual adapter as
the primary path and use a separately executed private shadow audit. Retain
the private pre-call state; record the selected key; perform the real adapter
call. Starting from that same pre-state, set a fresh identical key array and
execute 17 actual `Chip8Cow.step` calls, observing/checking each PC and opcode
before it and PC after it. Tick the shadow state once, then require complete
value equality with the adapter's result: memory, registers, keys, PC, I,
stack, timers, RNG, selected plane, both display maps, and fault state.
Do this for bootstrap and every action group. Only the primary adapter frame
can supply the next policy observation.

Label the instruction trace **shadow-observed, with adapter group-end state
equality**. Do not call it direct adapter instruction instrumentation, and do
not synthesize an allegedly observed trace from admitted ROM bytes. The
shadow shares the native transition implementation, so it is an observation
and path-conformance audit, not the independent reference. Section H still
requires independently implemented opcode execution. Count and time both
primary and shadow execution, including both timer ticks and state comparison.

`Chip8Cow.frameStep` executes 17 instructions and then ticks timers once.
Timers remain zero and no opcode reads them. Emulator `Fault` must remain
empty, but this is additional to complete opcode/PC admission, not its
replacement. The passive carrier uses mutable `Chip8`; this acting adapter
uses `Chip8Cow`. Independent execution conformance is required for the
actual acting path and must not be inferred from the passive replay.

## E. PixelProjection and reward separation

This reviewed layout supersedes the initial audit's y=16 hit glyph and
rows 0..11 projection: **hit glyph y=26; retain target rows 0..23**. Catcher
y=24 and glyph rows 26..30 are entirely excluded. Dot and bar remain visible.

Validate full-frame W=64, H=32, palette=2, 2,048 cells, and all cells in 0/1.
Compute background using only the first `64*24` cells: count zeros and ones,
reject a tie, and choose the more frequent value. Copy rows 0..23 unchanged;
fill all cells in rows 24..31 with that top-band background. Keep dimensions
and palette unchanged. No lower-band pixel participates in the background
calculation, projection, centroid, or decoded policy observation.

For any two valid binary frames agreeing in rows 0..23, this definition gives
byte-identical projections regardless of the remaining 512 cells. This is
the explicit noninterference property to test. Supplying a full-frame
background estimator and masking afterward would violate the contract.

Use `FrameSignals`/`FrameMotion` on the projection to require exactly one
foreground component wholly within one horizontal half, then decode that
half. Never use source tokens as fallback. All five arms use this same
projection and decoder. Visible catcher or hit pixels can encode prior
actions, so letting them reach a current-observation control would allow
external memory and invalidate the intended comparison.

The policy port receives projected frames, frozen parameters where relevant,
declared key meanings, and its own bounded state. It receives no ROM, source
symbols, source seed/domain, PC, register state, `Info`, evaluator score,
reward, private frame, or future-frame reference. The fair arm's independent
RNG is a policy configuration, never the environment stream.

The evaluator decodes the 0/1 glyph from the actual full rendered frame at
x=4..7/y=26..30, using the top-band background to undo palette complement.
Require an exact match to one of the two font glyphs. Private collision and
source truth may assert conformance only. Per-episode return is the sum of
the 64 rendered scored hit bits; no cumulative score register is claimed.

## F. Registered return decision

For each arm and panel retain all 1,024 episode returns and the mean hit
fraction `totalHits/65536`. Pair episodes by their common source row. Require
all of the following; no seed/panel/arm may be selected after seeing results:

1. On each of the three `.75` panels, order-two's mean hit fraction exceeds
   each of bigram, last-beacon, and fair by at least `.15`.
2. On the IID panel, the absolute paired mean difference between order-two
   and each of those three controls is at most `.03`.
3. Every scored order-two key equals the corresponding known-lag-two key,
   including on IID. This is a prefix-policy conformance diagnostic.
4. All projection, frame, key, reward, opcode/PC, instruction-count, model
   fingerprint, stream-count, and independent replay checks pass exactly.
5. Both registered whole-episode cost ratios in section G are at most 2.

Use integer total-hit comparisons for return thresholds: positive
`100*(orderHits-controlHits) >= 15*65536`; null
`100*abs(orderHits-controlHits) <= 3*65536`. Retain each condition and its
operands in the verdict. These are fixed practical thresholds, not a
statistical-significance test. A failed condition blocks the bounded acting
promotion and remains an informative result. No ARC promotion follows.

## G. Separate matched cost run

Run cost measurement only after the complete behavioral run passes admission
and completes, with unchanged source, binaries, protocol, model input, and
parameter hash. Preserve a failure receipt if behavior is incomplete; do not
quietly benchmark a selected subset. A behavioral threshold failure does not
cancel costs: retain the full cost comparison for a complete run.

Generate one separate dot/.75 corpus with seed 7001/domain 701: 72 rows of 66
symbols, one persistent stream, 4,752 draws. Precompile and admit its ROMs
outside timing. Reuse the identical corpus for every arm and repetition:
first eight episodes are warmups; the remaining 64 are timed. No source
generation, JSON parsing, compilation, or disk I/O enters timing.

Use five repetitions numbered 0..4. For repetition r, rotate the five-arm
order in section A left by r. Immediately before timing each arm, execute
its eight warmup episodes through the complete path. For fair costs, reset
a separate seed 8003/domain 801 stream before each arm repetition; consume
512 warmup plus 4,096 timed draws, never draws for fixed episode warmups.
All other policy state resets per episode. Reuse no emulator episode state.

Time the complete 64-episode path: environment reset/ROM loading, policy
initialization, bootstrap, warmup key, frame extraction/palette mapping,
PixelProjection, decoding, policy choices, primary and shadow emulator steps,
shadow PC checks, whole-state equality, private source/collision assertions,
reward extraction, in-memory trace/digest accumulation, and model-state
validation. All private conformance costs are included uniformly.
Disk serialization and receipt writing occur after timing.
The boundary is identical for all arms. Record elapsed milliseconds,
process CPU milliseconds, and current-thread allocated bytes. Also record
all episode/call/key/instruction counters. Each timed row has 64 episodes,
4,224 environment calls, 4,160 key actions, 4,096 scored choices, and
71,808 primary plus 71,808 shadow instructions: 143,616 actual transitions,
with 4,224 primary and 4,224 shadow timer ticks. There are exactly 25 cost rows.

For each arm take the median of its five elapsed-per-episode values and the
median of its five allocated-bytes-per-episode values. Require order-two /
bigram <= 2 for both medians. Denominators must be finite and positive.
Report CPU and other arm ratios descriptively; they are not added decision
gates. Retain each repetition rather than measuring until a favorable ratio.

Report a defined partial numeric payload ledger: owned float64 parameter
arrays (14 values/112 bytes for order-two, six/48 for bigram, zero otherwise),
retained history slots and counts, and fair RNG state, with element widths.
Report the ROM byte count and full/projected frame cell-array sizes separately.
Count actual retained arrays; if an arm retains extra backing arrays they
must be included and explained. These are logical payload counts, not CLR
object sizes, full emulator/pipeline retained heap, peak heap, or energy.

Coordinate an explicit quiet window: no team builds, tests, lints, training,
or other experiments during costs. Record OS/runtime, source hashes, loaded
assembly hashes/MVIDs, start/end time, and the coordinated idle declaration.
Ordinary host applications remain uncontrolled and must be disclosed.

## H. Receipts, independent replay, and falsifiers

Write new immutable attempt receipts and hash their exact bytes. Refuse to
overwrite an existing artifact. Record complete/incomplete status and typed
failure details; preserve every failed seed, panel, episode, or attempt.
Do not replace bad inputs, silently skip episodes, or tune after inspecting
results. A scientific change after registration needs a new named protocol.

Native receipts bind the exact protocol, input JSON, count hash, source
commit, per-file source hashes, and loaded runtime/assemblies. Include all
four panel definitions, five ordered arms, input stream counts, and each
episode's 64 submitted key bits, 64 rendered hit bits, 66 decoded observation
symbols, warmup hit, integer return, and conformance status. Keep source
truth separately from decoded observations. Report paired episode returns.

The full behavioral roster has 1,351,680 primary rendered observations.
Stream hashes cover ROM bytes in source-row order, full emitted frame cells,
projected frame cells, and shadow-observed opcode/PC traces in execution order.
Frames are
always 2,048 row-major bytes. For an instruction trace hash, append each
`(PC-before, opcode, PC-after)` as three unsigned 16-bit little-endian values.
Retain per-episode hashes and aggregate panel/arm hashes with explicit counts;
retain no full pixel-stream or per-instruction arrays. Equal source rows imply equal
projected-frame streams across arms; full-frame streams can differ by action.

An independent Python reference must generate its own source/action streams,
compile ROMs, interpret the actual admitted opcodes including `FX0A`, shifts,
XOR collision, and font selection, render pixels with its own font data,
project/decode observations, and maintain its own policy states. Import no
native token trace as policy input and do not translate source truth directly
to rewards. Replay every behavioral row, action, hit, observation, boundary,
stream count, and digest. Reproduce the cost corpus/counters and return
traces; measured elapsed/CPU/allocation values are metadata to validate, not
quantities Python can independently reproduce.

Before measurement require retained conformance witnesses for:

- Both keys against both possible next targets from the same machine prefix:
  the catcher changes and rendered collision reward follows the actual key.
- Unrevealed suffix substitutions: an action already committed from the same
  rendered prefix stays unchanged.
- Arbitrary valid binary lower-band changes: identical top band gives identical
  projection bytes and next actions for all five arms. Include all-zero,
  all-one, alternating, and deterministic mixed lower bands, plus a direct
  structural assertion that background reads are confined to the top band.
- Admitted upper-band target changes: the projection and decoder must reflect
  changed observations, so a constant-output projection cannot pass.
- Bootstrap, first/final groups, every key, dot/bar geometry, palette inversion,
  and malformed/opcode/PC/key/frame/feedback refusals against the independent
  17-step interpreter. Direct-token fixtures alone are insufficient.
- Receipt mutation refusal for missing/duplicate arms or episodes, altered key,
  reward, frame/trace hash, model hash, source input, or cost repetition.

The full replay receipt must hash and identify the exact native and cost
bytes it checked. The threshold verdict consumes only complete, mutually
bound receipts with passed full replay, recomputes every condition, and hashes
all its inputs. An apparently favorable numeric summary cannot override a
missing row or failed replay.

## I. Coordinating review record

Review date: 2026-09-06. This record describes pre-publication design review,
not executed tests or independent empirical validation.

- The initial y=16 glyph and rows 0..11 projection excluded the future bar
  panel. Revised y=26 glyph and top-only rows 0..23 projection retain both
  geometries while excluding every catcher/feedback pixel.
- Alternating geometry would require a Y update outside the fixed 17-op
  group. The palette panel therefore keeps dot geometry and complements
  emitted cells by within-episode observation index only.
- The actual adapter encapsulates its steps. The required observed instruction
  trace now comes from explicit shadow execution and whole-state equality
  at every adapter group boundary. Accounting includes both 1,122-step paths;
  the entire private audit is included in costs. No direct adapter trace is
  claimed, and an independent Python interpreter remains mandatory.
- The exact input/count hashes, ROM addresses/opcodes, glyph bounds,
  source/action streams, integer return thresholds, and redundant bigram/
  last-beacon action maps were checked for consistency with inspected source.
- Full frames and instruction traces are streamed into digests; compact
  complete action/hit traces and per-episode hashes are retained.

Coordinating review approved the amended shadow-audit resolution before any
acting implementation or measurements. It also approved merging the remotely
preserved predecessor branch and current main before registration while the
predecessor PR remains pending. That dependency ancestry is retained in the
registration basis above; no source/input link depends on a future file.

## J. Publication and continuation

Publish this reviewed protocol under the co-claimed remote branch and immutable
`archive/experiments/081M1W8T690087G0R002DJ91MJ-registration` tag before acting
implementation. Keep the design audit indexed by this file and the work item;
leave existing main handoff/README integration to the coordinating continuation
after the predecessor PR lands. Preserve the integrated implementation under
the long-lived ref and immutable
`archive/experiments/081M1W8T690087G0R002DJ91MJ` tag before measurement. Record
the exact preservation commits in the eventual results document.

Expected implementation surfaces are separately named rendered-catch research
modules/runners and an independent Python replay/verdict, with focused
cross-checks. This protocol creates none of them. The implementation must expose
explicit native, cost, replay, and verdict commands before measurement; their
source bytes and invocation arguments belong in the eventual receipts.

## K. Post-registration, pre-implementation review clarification

The immutable registration commit is
`8e08b5424feb2a80d80c1807e403c52ab34e79d1`. The following independent
source-review findings arrived while that registration push was running.
They are preserved before acting implementation or measurement; the original
registration tag is unchanged. The scientific roster, thresholds, streams,
opcode schedule, and comparison remain unchanged.

Independent reviewer: Vera, OpenAI Codex using GPT-6 Astra, delegated
`protocol_review` source audit. The audit found no material issue in chronology,
lower-band noninterference, the opcode/layout budget, or the bounded contextual
bandit claim. The coordinating contributor accepted these clarifications:

- Prefix/suffix and lower-band noninterference witnesses fork identical bounded
  policy state, including the fair arm's RNG state and draw index. Comparing
  successive random choices from one evolving stream is not such a witness.
- The complete timed episode includes construction of `Chip8Adapter` and its
  constructor ROM copy, as well as `Reset` and loading. Only source generation,
  ROM compilation/admission, and the other explicit section G exclusions remain
  outside timing.
- Native, cost, replay, and verdict CLIs bind their own source/runtime manifests
  and verify admitted source-file bytes against the resolved immutable
  implementation archive commit. An arbitrary commit label or unverified hash
  list is insufficient. Replay and verdict additionally hash exactly the input
  bytes checked. Unit/conformance fixtures may compile before implementation
  archival; measurement and public verdict paths must enforce source admission.
  Use the separate immutable registration and implementation tags in section J;
  never move either tag.

This is a source-review record and implementation-contract clarification, not
an executed conformance test or measured result. The final receipts bind this
protocol's full bytes, including this addendum, with `ProtocolSha256`.

A subsequent wording clarification, before measurement, interprets section E's
universal statement as including matching refusal for a tied top-band majority.
Successful byte equality applies to admitted projections; every registered
dot/bar frame has a unique majority. The native implementation tests both
cases. This preserves the original projection rule and scientific comparison.
