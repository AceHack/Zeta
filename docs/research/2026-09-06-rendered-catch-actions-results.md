# Rendered catch: frozen chronological prediction improves keypad return

Date: 2026-09-06
Operational status: research-grade
Lifecycle: landed
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1W8T690087G0R002DJ91MJ
Evidence snapshot: `36fa2275e049017aefa6ebdfd77fdbd2dfbd5180`

The frozen order-two predictor satisfies every condition in the
[registered acting protocol](2026-09-06-rendered-catch-actions-protocol.md).
It catches 74.74% to 75.03% of targets on three structured rendered panels,
while the bigram, last-beacon and fair baselines catch approximately 50%.
The known-lag-two diagnostic matches order-two. The gain survives
the dot-to-bar geometry change and alternating palette inversion. On the
independent-symbol control, its largest absolute advantage is only 0.206
percentage points. Whole-episode wall and allocation ratios against bigram
are 0.987079 and 0.999461, below the registered cap of 2.

The independent Python interpreter exactly reproduces all 20,480 behavioral
episodes and all 200 warmup plus 1,600 timed cost episodes. The separate
verdict reader admits all inputs and reports `AllRegisteredConditionsMet=true`.
These are practical registered criteria, not p-values or a significance test.
This result promotes the frozen predictor as a verified policy arm for this
supplied-goal contextual-bandit carrier. The representation, goal and action
meanings are supplied; learned vision, goal acquisition, action-dependent
world modeling, multi-step planning and ARC competence remain untested.

## Preserved order and complete receipt chain

The registration was remotely preserved at
`8e08b5424feb2a80d80c1807e403c52ab34e79d1`, under immutable tag
`archive/experiments/081M1W8T690087G0R002DJ91MJ-registration`.
The pre-implementation clarification was preserved at
`1851a8bf5f5c3a7998cbe64506d9a88383930335`. The original registration tag
was unchanged. The final reviewed implementation, protocol bytes, source
admission and integrated validation were remotely preserved at
`36fa2275e049017aefa6ebdfd77fdbd2dfbd5180`, under immutable tag
`archive/experiments/081M1W8T690087G0R002DJ91MJ`, before any registered run.
The registration is an ancestor of that implementation snapshot.

The [remote archive proof](rendered-catch-validation/2026-09-06/implementation-archive-remote.txt),
[source push](rendered-catch-validation/2026-09-06/source-publication.log), and
[archive push](rendered-catch-validation/2026-09-06/archive-publication.log)
retain publication evidence. Both pushes passed all 16 required preflight checks.
No archive was moved, no output replaced, and no source, seed, threshold,
model or roster changed after results were observed.

The complete measured receipts and first result report are additionally
preserved at `8487974c6c64a9a73612ee4e5e8271d921b4cb89`, under immutable
tag `archive/experiments/081M1W8T690087G0R002DJ91MJ-results`.
The [results archive proof](rendered-catch-validation/2026-09-06/results-archive-remote.txt)
and [publication log](rendered-catch-validation/2026-09-06/results-publication.log)
retain that separate preservation step. The original implementation tag
remains the source-admission authority.

| Receipt | Exact-byte SHA256 |
| --- | --- |
| [Native behavior](rendered-catch-validation/2026-09-06/behavior.json) | `32D48E93BB5478286DA221A5982D99BD1D815CA43A304A5A54B8BBE2592109AC` |
| [Native costs](rendered-catch-validation/2026-09-06/cost.json) | `CCEF4861E45DD4300F7DA356A14AE6B62E7F72BA61DDD576B146177712B523C9` |
| [Full independent replay](rendered-catch-validation/2026-09-06/replay.json) | `6EBA064EC98F71B226FD549DD8FA32388A6D05D9D2ED2919214BEB12A05F2934` |
| [Independent verdict](rendered-catch-validation/2026-09-06/verdict.json) | `6C73550E826396C1D0CF49E68BADA1AE1F3288A4FCC97023160819582F23F533` |

Every receipt's source commit is the implementation snapshot above. Their
23-file manifests bind current, declared-commit and archive bytes, including
both implementations, all runners, the frozen model and the full protocol.
The protocol SHA256 is
`0EAF073F72339F0E48A48726E8D47A5568A0F213A93F5B565F920C2A8C6EC49F`.
Native behavior and cost retain matching Core/Core.Abstractions assembly
hashes and MVIDs on .NET 10.0.11/macOS 26.6.2. Python ran CPython 3.14.6.
Recorded binary/source identities support reproducibility and consistency;
they are not cryptographic execution attestation or a reproducible-build proof.

Behavior ran from 23:18:21.6361140 to 23:24:03.5486450 UTC. Cost ran from
23:25:44.5580620 to 23:26:13.2033900 UTC, after behavior completed.
The [quiet-window record](rendered-catch-validation/2026-09-06/quiet-window.txt)
preserves all three collaborators' explicit idle confirmations and the root
writer's idle state before timing. The team held builds, tests, lints,
training, experiments and push hooks through cost completion. Other agents
outside this team and ordinary host applications remained uncontrolled.
All 25 cost rows were collected before independent replay began.

## Actual acting boundary

Each episode uses one persistent `GameEnvironment.Chip8Adapter` with the
source-owned admitted classic CHIP-8 ROM. A bootstrap frame reveals the
first target. One fixed unscored key reveals the second. The policy then
chooses 64 real keypad actions before each next target is revealed. Actions
move the catcher and affect collision feedback, but do not change the target
generator. Reward is decoded from the rendered binary glyph.

All five policies receive the same top-band pixel projection. Catcher and
reward pixels are removed using background computed only from the retained
top 24 rows. Source symbols, ROMs, registers, instruction traces, rewards
and future frames remain private evaluator data; they cannot supply policy
observations or fallback actions. The simple component/lane decoder is a
designed representation, not a learned vision model.

One episode contains 66 environment calls, 65 keys, 64 scored decisions,
1,122 primary and 1,122 shadow instruction transitions, and 66 timer ticks
on each path. The complete behavioral roster therefore contains 1,351,680
primary rendered observations, 1,310,720 scored decisions and 45,957,120
actual primary-plus-shadow transitions. The separately executed native shadow
checks complete state equality at every group end, but shares `Chip8Cow`
with the primary adapter. It is not an independent emulator.

The independent reference executes its own byte-memory interpreter, ROM
compiler, font, frame projection, lane/reward decoding, policy and streams.
It checks every action, hit, observation, counter, raw-frame hash, projection
hash and observed PC/opcode-trace hash. It executes one Python path; its
primary/shadow counters describe the checked native schedule. Unused constant
native-only state is not independently reproduced, and Python does not
remeasure native timing or allocation.

## Return results

Every panel has 1,024 paired episodes and 65,536 scored choices per policy.
Entries are total hits and the corresponding percentage. Known-lag-two
matches order-two's complete action stream on all four panels.

| Panel | Order-two | Bigram | Last beacon | Independent fair | Known lag two |
| --- | --- | --- | --- | --- | --- |
| Dot, lag-two copy probability .75 | 49,169 / 75.0259% | 32,833 / 50.0992% | 32,833 / 50.0992% | 33,063 / 50.4501% | 49,169 / 75.0259% |
| Bar, lag-two copy probability .75 | 48,983 / 74.7421% | 32,954 / 50.2838% | 32,954 / 50.2838% | 32,825 / 50.0870% | 48,983 / 74.7421% |
| Alternating palette, copy probability .75 | 49,062 / 74.8627% | 32,565 / 49.6902% | 32,565 / 49.6902% | 32,767 / 49.9985% | 49,062 / 74.8627% |
| Dot, independent symbols | 32,914 / 50.2228% | 32,779 / 50.0168% | 32,779 / 50.0168% | 32,822 / 50.0824% | 32,914 / 50.2228% |

Bigram and last-beacon are behaviorally redundant for this frozen fitted
artifact: both choose the last observed lane. Their registered rows remain
in full, but agreement between them is not independent baseline evidence.
The fair policy has its own persistent per-panel action stream, with history
reset across episodes. No action draw is consumed by the bootstrap or fixed
warmup key.

Order-two's smallest structured-panel gain is 0.244583 hit fraction (bar
against bigram/last-beacon), above the required 0.15. The largest is
0.251724 (palette against bigram/last-beacon). On the independent-symbol
panel, the absolute differences are 0.002060 against bigram/last-beacon and
0.001404 against fair, below 0.03. The verdict compares integer totals:
`100 * gain >= 15 * 65536`, or on the null panel
`100 * abs(gain) <= 3 * 65536`. All twelve return conditions pass.

No refitting or online learning occurred. The exact passive input artifact
has SHA256 `C59468575B140DA146265182EE40B03D6F6B5103FAAC9A0137CE8A288DF357B3`;
the 14 float64 values have the unchanged little-endian fingerprint
`8BEFD54B878D600A31A75BB5FA159588D2FDA4A849CAFB1410F03D6BC9B5B2A5` before
and after both runs. The known-lag diagnostic confirms what policy was
executed; it does not turn a fitted finite-memory lookup into a learned
planning algorithm.

## Matched whole-episode costs

The separate source contains 72 episodes. Each of five repetitions warms
eight episodes per arm and times the next 64, rotating arm order by the
repetition index. All rows, including warmups and the first repetition, are
retained. The predeclared statistic is the median of five per-episode values.

| Policy | Wall ms/episode | Process CPU ms/episode | Current-thread allocated bytes/episode |
| --- | --- | --- | --- |
| Order-two | 14.134273 | 32.688422 | 38,245,433.250 |
| Bigram | 14.319288 | 32.677313 | 38,266,049.500 |
| Last beacon | 14.204559 | 32.309422 | 38,264,985.500 |
| Independent fair | 14.117742 | 30.675656 | 38,261,865.375 |
| Known lag two | 14.378531 | 31.700141 | 38,175,761.250 |

Order-two/bigram wall ratio is `0.9870793806954431`; allocation ratio is
`0.9994612391331381`. Both pass the cap of 2. The first order-two repetition
cost 35.574766 ms/episode versus roughly 14 ms in the remaining repetitions;
it remains in the record and median calculation. No warmup extension,
selective discard or rerun was used. The small median difference does not
establish a speed advantage. CPU is a descriptive process-wide measure and
can exceed elapsed wall time when work occurs on multiple threads.

Timing includes constructor ROM copying, reset/loading, policy initialization,
all primary and shadow execution, frames/projection/decoding, private
conformance checks, retained-model validation, reward and trace/hash
accumulation. Source generation, ROM compilation/admission, disk I/O and JSON
serialization are excluded as registered. These are instrumented research
episode costs, not a measurement of a minimal deployed controller.
The approximately 38 MB allocation figure is cumulative current-thread
allocation per episode, not retained memory or peak heap.

The partial logical payload is separately 112 parameter bytes for order-two
and 48 for bigram, plus 8 versus 4 history bytes and a 4-byte observation
counter. Fair additionally retains its stream state, initial seed and draw
counter (24 bytes). ROM and each frame buffer are separately reported.
This ledger is not total CLR object size, allocator overhead, peak memory,
energy or emulator cost.

## Validation, failures, and continuation

The [integrated validation record](rendered-catch-validation/2026-09-06/integration-review.md)
retains the zero-warning/error Release build, 7,523 passing solution tests
with six existing skips, 258 Python passes with one existing warning,
separate Python lint/format/types, and all 16 quick gates. The
[carrier/replay source review](2026-09-06-rendered-catch-carrier-replay-review.md)
preserves two corrected pre-freeze findings: failed replay lost attribution,
and full-envelope mutation coverage was missing. Strict admission, full
rosters, failure locations and exclusive receipt publication are tested.

After merging current main, the combined publication snapshot
`19aa9d7cbd3617ceae44445b18d786185020d63d` again passed all 7,523 solution
tests with six skips, a zero-warning/error Release build and all 16 quick
checks. Its 23 admitted scientific source files are byte-identical to the
measurement archive. The first publication build had an F# compiler exit
139; the unchanged affected project passed in isolation, then the full
build/test retry passed. The failure, isolated check and recovery logs are
indexed in the integrated validation record. No model, test expectation,
compiler setting, source-admission rule or scientific criterion was changed
to obtain that recovery.

The first published CI head subsequently exposed a separate test-harness
defect on all three platforms: compiler-mapped source paths made two tests
look for their frozen fixture under `/_/`. The
[fixture-path correction](rendered-catch-validation/2026-09-06/ci-fixture-path-correction.md)
retains the failures, review and validation using an explicit CI-mapped
build. Only runtime fixture discovery in the test file changed; all 23
scientific source fingerprints and all recorded result bytes remain intact.

One explicit pre-archive CLI negative control refused with zero panels and
retained its [failed receipt](rendered-catch-validation/2026-09-06/refused-before-archive.json).
The inherited NCI test gate failure and upstream static-roster repair are
also retained. These are distinct from scientific results: the first and
only registered behavior, cost, full replay and verdict runs all completed.
No failed registered attempt is omitted. The [behavior log](rendered-catch-validation/2026-09-06/behavior.log),
[cost log](rendered-catch-validation/2026-09-06/cost.log),
[full replay log](rendered-catch-validation/2026-09-06/replay.log) and
[verdict log](rendered-catch-validation/2026-09-06/verdict.log) are preserved.

The verdict contributor subsequently performed a separate recorded-evidence
audit: all four hashes, 23-file manifests, every recorded behavioral return,
paired differences, known-lag actions, all 1,800 cost episode totals, and
the 25-row medians agree. That contributor authored the verdict; the audit
does not represent a third interpreter or independent resource measurement.
Its exact scope is preserved in the integrated review above.

For direct replay of the retained receipts, use a writer-owned checkout with
the archived source bytes and its Python environment installed:

```bash
uv run --project src/Interp.Python python -m zeta_interp.rendered_catch_replay docs/research/rendered-catch-validation/2026-09-06/behavior.json docs/research/rendered-catch-validation/2026-09-06/cost.json new-replay.json
uv run --project src/Interp.Python python -m zeta_interp.rendered_catch_verdict docs/research/rendered-catch-validation/2026-09-06/behavior.json docs/research/rendered-catch-validation/2026-09-06/cost.json new-replay.json new-verdict.json
```

Both outputs must be fresh paths. Native reproduction uses the exact commands
and arguments in the behavior/cost receipts after a Release build of the
archived source. A new cost run requires an actual team quiet window and a
truthful declaration of its host conditions; a copied declaration is not
evidence that the new host was quiet.

The next empirical boundary is action-conditioned hidden dynamics with a
declared observation/goal interface and an explicit planning control. That
requires a new preregistration, new held-out streams, information-leakage
tests and independently replayed resource/return comparisons. This experiment
supplies no evidence for choosing an ARC policy, learning the representation
or goal, or generalizing to a different dynamics family. Keep those questions
separate from the demonstrated frozen predictor-to-key composition.
