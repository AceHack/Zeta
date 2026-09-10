# Rendered catch follow-up: source audit and design proposal

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Work item: 081M1W41PKD087G0R0024JFXHT
Author: Vera, OpenAI Codex using GPT-6 Astra
Source baseline: `928c0f5e1fa5cadd2b8bad0bc810796874c719bf`
Artifact status: design proposal; not a preregistration or measured result

Design correction, 2026-09-06: the
[acting preregistration](2026-09-06-rendered-catch-actions-protocol.md)
places the hit glyph at y=26 and preserves target rows 0..23. This supersedes
the initial audit's y=16 glyph and rows 0..11 projection, so a bar at y=20
remains visible while every catcher/feedback pixel stays outside policy input.
The palette panel keeps fixed dot geometry; it does not alternate shape/Y.
Coordinating review also clarified that the adapter hides its individual
steps. The acting protocol requires a separate 17-step shadow execution,
compares its complete final state with each primary adapter result, and
counts/times both paths. Primary instructions remain 1,122 per episode;
the private audit adds 1,122, for 2,244 actual transitions. The shadow trace
is not direct adapter instrumentation or an independent implementation.

## Question and evidence boundary

Can the frozen fitted order-two predictor improve a real key-input action's
return after receiving chronological rendered observations? This source audit
proposes a small follow-up to the
[passive rendered-signal protocol](2026-09-06-rendered-signal-predictor-protocol.md)
and the
[predictive-state handoff](../handoffs/2026-09-06-vera-to-vera-predictive-state-research-and-arc3-bridge.md).
It records inspected APIs, a proposed carrier, and falsifiers for a future
preregistration. No acting implementation, experiment, timing run, seed roster,
promotion threshold, or acting result is established here.

The proposed two-lane catch task is a history-dependent contextual bandit
rendered by a source-owned classic CHIP-8 ROM. The action changes catcher
placement and collision feedback; it does not change the target generator.
The goal, action meanings, and target-band projection are supplied explicitly.
A successful future result would support frozen predictor-to-action
composition on that carrier. It would not establish learned vision, goal
acquisition, action-dependent world-model learning, multi-step planning,
unseen-dynamics generalization, or ARC competence. No ARC data is needed.

## Inspected source and reusable boundaries

| Source | Relevant behavior and limit |
| --- | --- |
| [`GameEnvironment.fs`](../../src/Core/GameEnvironment.fs), `IEnvironment`, `Chip8Adapter` | Explicit `Reset`, `Step`, and `Frame` permit one persistent episode. `Pad 0` and `Pad 1` reach actual key states. Each step creates a fresh keypad array, then calls `Chip8Cow.frameStep`. `Info` is metadata and must not reach the policy. |
| [`GameEnvironment.fs`](../../src/Core/GameEnvironment.fs), `stepOnce` | Resets on every call; chooser receives `Scheme` and `Info`, not a rendered frame. It is unsuitable for the proposed chronological loop. A bounded research runner can use the existing port directly. |
| [`Chip8Cow.fs`](../../src/Core/Chip8Cow.fs), `step`, `frameStep` | Persistent emulator supports `FX0A`, shifts, register copying, XOR drawing with collision in `VF`, and font addressing. `frameStep n` performs `max 1 n` instructions and then one timer tick. |
| [`Chip8.fs`](../../src/Core/Chip8.fs), `ProgramStart`, `MemSize` | Classic program starts at `0x200` in 4,096-byte memory, leaving 3,584 bytes for program and data. This is the mutable emulator used by the passive carrier, whereas `Chip8Adapter` uses `Chip8Cow`. |
| [`CartFixtures.fs`](../../src/Core/CartFixtures.fs), `op`, `assemble`, `waitKey`, `inputForkRom`, `keyWaitRom` | Existing source-owned assembly and keypad fixtures; `motionDotRom` supplies motion but no acting catch task. |
| [`GameEnvironment.Tests.fs`](../../tests/Tests.FSharp/GameEnvironment.Tests.fs), `chip8Rom` | A real key-dependent ROM already demonstrates that pressing east can change rendered output through the adapter. It is a one-choice conformance witness, not a return benchmark. |
| [`RenderedSignalPrediction.fs`](../../src/Research.FSharp/RenderedSignalPrediction.fs), `Counts`, `fitCounts`, `predict` | Existing Laplace-one count models and order-two lookup can be reused with frozen parameters. Order-two indexes the last two decoded observations; short contexts back off. |
| [`RenderedSignalCarrier.fs`](../../src/Research.FSharp/RenderedSignalCarrier.fs), `sample`, `decode` | Supplies the known lag-two source law and a rendered decoder requiring one component entirely within one horizontal half. The full catcher/feedback frame violates that decoder's single-component contract. |

The adapter does not itself enforce the proposed ROM shape, legal two-key
subset, observation schedule, or final-round stop. A research runner must
validate these before loading and enforce them while stepping. Unknown
opcodes and several malformed-state cases are not universal typed failures
in the emulator, so admission must not rely only on `Fault` being empty.

## Proposed goal, source, and observation schedule

Supply the goal: "Choose the lane that catches the next target; maximize hits
over 64 scored choices." Supply `Pad 0` as left and `Pad 1` as right.
The source generates binary symbols with the previously declared lag-two law:
two initial fair symbols, then copy the symbol two positions back with
probability `.75`. Generate a complete source sequence before compiling its
ROM. The policy has no access to that sequence or its generating seed.

The smallest proposed schedule needs **66 source observations**, `S0..S65`:

| Phase | Environment call | Observation produced | Scoring |
| --- | --- | --- | --- |
| Bootstrap | One `Step(Go "stay")` runs a padded initialization block | `S0` | No key choice and no scored catch |
| Warmup | One fixed `Step(Pad 0)` | `S1` | Real key action and feedback, excluded from scored return |
| Scored rounds | 64 policy-selected `Step(Pad 0/1)` calls | `S2..S65` in order | One hit bit per call |

Reset exactly once. Feed `S0` and `S1` through the same rendered projection
and observation update used later, so the first scored choice has two past
observations. Before scored choice `t`, the policy has seen only `S0..S(t-1)`.
Record the selected action before stepping the emulator to reveal `St`.
The policy's returned key must be the key actually submitted to the adapter.

Count all work: 66 environment step calls, 65 key actions, 64 scored policy
choices, and one fixed warmup key action. Retain the warmup feedback even
though it does not contribute to scored return. Do not describe the run as
only 64 environment actions or silently omit initialization cost.

## Proposed 17-instruction round and ROM budget

Keep fixed registers `V1=24` for catcher height, `V3=8` for target-observation
height, `V4=4` and `V5=26` for the binary hit glyph. Append a one-row `80`
sprite. The following is a design calculation, not an assembled ROM or a
validated execution trace:

| Instruction positions | Proposed opcode | Effect |
| --- | --- | --- |
| 1 | `F00A` | Latch the currently held key into `V0`. |
| 2..6 | `800E` repeated five times | Multiply admitted key 0/1 by 32. |
| 7 | `7010` | Set catcher X to 16/48. |
| 8 | `00E0` | Clear the display. |
| 9 | `Annn` | Select the appended one-row sprite. |
| 10 | `D011` | Draw catcher at the selected X, y=24. |
| 11 | `62xx` | Load the next source target's X, 16/48, from this ROM group. |
| 12 | `D211` | Draw target at catcher height; `VF` becomes the collision hit bit. |
| 13 | `86F0` | Copy the hit bit to `V6` before another draw changes `VF`. |
| 14 | `D211` | XOR the transient target again, restoring the catcher image. |
| 15 | `D231` | Reveal the new target at y=8. |
| 16 | `F629` | Select built-in font glyph 0/1 using saved hit bit `V6`. |
| 17 | `D455` | Render binary hit feedback at x=4, y=26. |

All admitted rounds have the same instruction path. `Chip8Cow`'s `FX0A`
reads the lowest currently held key, including key zero. With no key held it
does not advance the PC. The adapter submits exactly one held key for either
admitted action. After bootstrap, reject no-key, other-key, and multi-key
inputs at the runner boundary rather than interpreting a stalled round as
an observation. Keep `cyclesPerAction=17`. Timers are not used by this ROM,
although the existing adapter still performs one timer tick after each call.

Use one unrolled 34-byte group per round. A 17-instruction padded bootstrap
renders `S0` and stops immediately before the first `F00A`; each complete
round stops at the next group's `F00A`. The final group stops at a self-jump
placed immediately before the sprite. The runner refuses further rounds.
No conditional branch padding, timer wait, `RND`, self-modification, or
host display replacement is needed.

With `N` rounds, the proposed ROM size is `34 + 34*N + 2 + 1` bytes:

| Round count | ROM bytes | Schedule |
| --- | --- | --- |
| 65 | 2,247 | One warmup plus 64 scored rounds; 66 source symbols |
| 96 | 3,301 | Still below the 3,584-byte classic program/data limit |

The 65-round schedule would execute `66*17 = 1,122` primary instructions
including bootstrap, plus 1,122 private shadow instructions under the
coordinating review correction. Validate every program address, opcode,
target operand, sprite address, and font access against the admitted layout.
Observe/check PCs around each shadow instruction, tick once, then compare
the complete shadow state with the real adapter result at every group end.
Those checks belong to the private environment/evaluator, not policy input.

## Projection and source-policy separation

The full frame contains the revealed target, catcher, and hit glyph. A visible
catcher or hit glyph can reveal the previous action. That action may encode
an earlier target, giving a supposedly current-observation policy external
memory. For example, a last-beacon policy's previous catcher can encode the
lag-two observation needed for its next decision. A comparison using the
full current frame cannot establish that internal history is necessary.

Give every policy the same declared target-band projection: copy the 64x32
palette-2 frame and replace cells outside rows 0..23 with the background
computed exclusively from those top 24 rows. The target is at y=8, or y=20
for the protocol's bar panel; catcher y=24 and glyph rows 26..30 are excluded.
Validate the full frame shape and palette before projection. Run the existing
single-component decoder on the copied projection. This is a supplied
representation boundary, not feature discovery. Never substitute source
tokens when projection or decoding fails.

The policy constructor receives only frozen parameters and declared action
semantics. Its observation method receives a projected `GameEnvironment.Frame`;
its state holds decoded observation history, or an independent RNG for the
fair arm. Source tokens, ROM, seed, PC, registers, emulator state, `Info`,
evaluator score, and future frame references stay outside that interface.
The source/evaluator may use truth solely to assert rendering conformance.
Retain full-frame and projected-frame hashes separately so the removed
information and the admitted policy input are both auditable.

Return is the sum of hit glyphs decoded from the actual full rendered frames.
The ROM produces each hit by collision; the evaluator sums those bits.
No cumulative score register is claimed by the 17-instruction design.
Record action identity, full-frame feedback, and private collision assertions
for replay, without supplying them to the frozen decision policy.

## Suggested comparisons and remaining preregistration choices

Reuse the exact fitted order-two parameters from the passive experiment's
decoded training corpus. Bind the input receipt and numeric parameter bytes
by hash; verify the parameter hash before and after acting evaluation.
Do not refit on acting episodes or select among test-performing variants.

Suggested arms are frozen fitted order-two, frozen fitted bigram,
last-beacon lane, and fair independent random lane. Use the same greedy
probability-to-key rule for fitted predictors, with an explicitly frozen tie
rule. A prefix-only known-law diagnostic is optional. RNNs are excluded from
this proposal unless a future protocol explicitly names them as controls.

Use unseen source seeds and paired source sequences across arms. Under the
declared stochastic law, a correctly estimated lag-two decision rule has
analytic expected hit fraction `.75`; fair and last-beacon rules have `.5`.
These are proposed expectations, not observations. An IID `.5` source panel
is a useful negative control. Neither expected values nor a finite paired
return gain alone justify a statistical-significance claim.

A future preregistration must freeze source and action-RNG seeds/domains,
episode counts, source panels, model receipt/hash, projection definition,
tie rule, replay schema, failure handling, resource accounting, and decision
thresholds before acting measurements. This design note freezes none of those
experimental choices and must not be retroactively described as doing so.

## Required falsifiers before measurement

1. **Key causality:** from an identical private machine prefix and fixed next
   target, opposite keys must change catcher placement and hit feedback.
   Exercise both next targets and both keys; the rendered hit must agree
   with the in-ROM collision and an independent reference.
2. **Chronology:** modifying an unrevealed ROM suffix must not alter an already
   committed policy action. No frame derived from the next target may reach
   the policy before its corresponding key is recorded and applied.
3. **PixelProjection leakage:** perturb arbitrary catcher/feedback pixels
   below row 24 while preserving the target band. The projected frame bytes
   and each policy's next decision must remain identical. Also perturb the
   target band to demonstrate that admissible observation changes do reach
   the decision path. A test that injects direct tokens bypasses this test.
4. **Independent 17-step reference:** independently compile and interpret the
   admitted opcode subset, key semantics, collision, and font rendering.
   Verify bootstrap, each 17-instruction round, PC boundaries, frame bytes,
   actions, and rendered rewards. The passive replay is insufficient:
   passive execution uses mutable `Chip8`, while this adapter uses `Chip8Cow`.
   Their distinct implementations and opcode edge semantics require actual
   conformance checks; a source comment claiming equivalence is not proof.
5. **Refusals:** reject malformed/over-budget ROMs, noncanonical target or
   sprite operands, illegal keys, unexpected PC/opcode, faulty or ambiguous
   projections, absent feedback glyphs, and excess rounds. Keep typed failure
   receipts; do not fall back to generator truth or silently skip episodes.
6. **Frozen model and return:** assert unchanged parameter hashes, replay
   the complete action/reward trace, and retain every arm, episode, failure,
   and paired return difference. Share no source RNG state with fair actions.

The independent reference and PixelProjection leakage falsifier must pass
before measurement, after implementation and protocol are remotely preserved.

The subsequent
[independent carrier/replay source review](2026-09-06-rendered-catch-carrier-replay-review.md)
retains the premeasurement envelope-coverage and failed-attempt provenance
findings, their corrections, and the native/reference execution boundary.

## Why the other inspected carriers are not the minimum follow-up

[`ContextualGridBenchmark.fs`](../../src/Core/ContextualGridBenchmark.fs),
`runForCarrier`, receives explicit positions and uses a tabular transition
with a supplied goal. Its carrier fingerprints, trace digests, and unchanged
Q-table check during held-out evaluation are useful patterns. Reusing that
coordinate channel would not test the proposed rendered/keypad boundary.

[`mutual-sim.ts`](../../src/Core.TypeScript/chip8/games/mutual-sim.ts) has real
key movement, role changes, collisions, and rendered scoring. It also adds
multiple planes, opponent movement, walls, respawns, and role-dependent
reward. Those make attribution harder for this first bounded composition.
The perception carts in
[`curriculum.ts`](../../src/Core.TypeScript/chip8/games/curriculum.ts) are
useful rendering examples, but their moving objects do not provide this
prediction-driven key-action task.

The existing
[`swarm CHIP-8 runner`](../../src/Core.TypeScript/swarm/chip8-environment-run.ts)
reads RAM and exposes cheat-engine channels to its world. It is not an
admissible policy surface for this proposal.
[`tas-controlled-pair.ts`](../../src/Core.TypeScript/chip8/tas-controlled-pair.ts)
offers separate action/environment budgets, but compares channel grants;
its clean/assisted distinction is not this fixed-observation policy ablation.

## Continuation and durability

The initial reviewed design was committed under the handoff work item. It is
now indexed by the
[acting preregistration](2026-09-06-rendered-catch-actions-protocol.md) and
[follow-up work item](../../workitems/081M1W8T690087G0R002DJ91MJ-preregister-rendered-catch-actions-from-a-frozen-chronologic.md).
The coordinating continuation owns remote publication and main indexing. This
note alone is not an indexed protocol, an implementation authorization
artifact, or evidence that a proposed falsifier has passed.
