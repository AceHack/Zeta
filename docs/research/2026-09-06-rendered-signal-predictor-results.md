# Chronological rendered-signal prediction: measured results

Date: 2026-09-06
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1W41PKD087G0R0024JFXHT
Measured source: `468772e59b6a587469fd7fd576d0bd141d421af0`

## Verdict

The [registered experiment](2026-09-06-rendered-signal-predictor-protocol.md)
crosses a real rendered-frame boundary and reproduces independently.
All three small recurrent networks learn useful chronological prediction:
each beats fitted bigram by more than .17 bits on both held-out bar panels.
None earns promotion over the stronger fitted order-two control. Retain
**order-two counts** as the next acting-carrier candidate.

All seeds, all six prediction panels, all five detector panels, all 120 cost
measurements, and the failed promotion criteria remain in the receipts.
This is passive prediction on a source-owned CHIP-8 beacon animation, with
an explicitly designed left/right decoder. The shape/palette controls do not
establish learned vision, cross-domain transfer, action return, goal acquisition,
or ARC performance. No hosted policy changes.

## Preservation and execution

The protocol was pushed at `be73d72a5bb6753f985ae87f3110fc47d98c6947`
before implementation or registered measurement. The complete carrier,
native experiment and independent replay were pushed at the measured source
commit above before the run started at **20:27:37 UTC**. That run completed
in 104.63 seconds without a failed seed or incomplete panel. The separate
cost run took 36.79 seconds; all team build, test, lint and training processes
were explicitly idle during it. Ordinary host applications were uncontrolled.

The permanent archive `archive/experiments/081M1W41PKD087G0R0024JFXHT`
retains the protocol and measured source ancestry across squash merging.
The receipts record sixteen source-file SHA-256 values, the exact source
commit, and the SHA-256 and MVID of the Core and Core.Abstractions binaries
actually used by FSI. The cost run requires those same binaries and source
fingerprints. Binary identity is not a proof of a source-to-binary build;
the build logs and independent execution check provide separate evidence.

## Rendered observations and learning

Each source symbol is rendered by executing a generated ROM in Zeta's actual
CHIP-8 emulator. `FrameSignals` and `FrameMotion` identify a single connected
beacon wholly within one horizontal half. Extracted tokens are compared with
source truth only for conformance; the learner receives decoded tokens.
There is no truth-token fallback. Frame hashes cover the emitted display cells.

The training corpus contains 4,096 sequences of 33 frames: 135,168 frames,
with 131,072 successive-frame comparisons. All have unchanged shape and palette;
64,992 comparisons change beacon placement. The underlying process copies the
symbol two positions earlier with probability .75. Its one-symbol marginals
are fair, so chronological information matters even when a symbol bag does not.

The width-8, 106-parameter RNNs each train for four fixed passes, 1,024 Adam
updates and 524,288 target visits. Fitted counts use one Laplace-smoothed corpus
pass; optimizer compute is not matched. Held-out bars change shape, location
and vertical position. Nuisance panels alternate dot/bar and palette while
preserving the declared symbolic law. These renderers share an explicitly
chosen semantic decoder, so this is representation conformance rather than
discovered visual semantics.

## Prediction and calibration

Each entry is mean next-symbol log loss in bits on 2,048 frozen contexts.
Lower is better; no seed is selected. The receipt also includes every row's
prediction, paired loss difference against order-two, Brier score, accuracy,
ten calibration bins, expected cross-entropy and true-law excess KL.

| Arm | Held-out L16 | Held-out L64 |
| --- | ---: | ---: |
| Fitted bigram | 1.000024 | 1.000524 |
| Fitted order-two | 0.813649 | 0.829202 |
| Known lag-two law | 0.813600 | 0.829078 |
| RNN seed 41 | 0.814477 | 0.828819 |
| RNN seed 53 | 0.814789 | 0.829172 |
| RNN seed 67 | 0.813559 | 0.828377 |

The neural memory sanity condition passes for every seed on both panels.
The strongest observed RNN improvement over order-two is only .000825 bits,
below the required .01, and some comparisons worsen. A slightly smaller
sampled loss does not establish a better conditional distribution: true-law
excess KL is about .000026 bits for order-two and .000235--.000897 for the
trained RNNs across these panels. The known law has zero excess KL.

The [machine-readable verdict](../../src/Research.FSharp/rendered-signal-verdict.json)
evaluates inclusive thresholds on unrounded values:

| Requirement, every seed | Result |
| --- | --- |
| At least .05 bits better than bigram, both held-out lengths | Pass, 6/6 comparisons |
| At least .01 bits better than order-two, both held-out lengths | Fail, 0/6 comparisons |
| Brier increase no more than .005 against order-two | Pass, 6/6 comparisons |
| Nuisance alarm fraction increase no more than .02 | Pass, 3/3 seeds |
| End-to-end median time no more than twice order-two | Pass, 3/3 seeds |
| End-to-end median allocation no more than twice order-two | Pass, 3/3 seeds |

These are frozen engineering criteria, not statistical significance tests.
The failed prediction criterion is sufficient to refuse neural promotion.

## Change detection

All denominators receive the complete chronological prefix. The numerator is
the fixed mixture of eight complete alternative sequence laws. No likelihood
factor, prefix penalty, early alarm, missed change or late transient alarm is
discarded. The threshold is 20 with no restart. Only the known true null has
the time-uniform .05 crossing guarantee; learned denominators have empirical
receipts only.

| Known-null panel | Pre-128 alarms | Later alarms | Never alarmed | Median delay after change |
| --- | ---: | ---: | ---: | ---: |
| Unchanged | 44 | 25 | 1,979 | Not a change |
| Rendering nuisance, unchanged law | 42 | 18 | 1,988 | Not a change |
| Permanent copy probability .5 | 47 | 1,987 | 14 | 27 tokens |
| Permanent copy probability .25 | 49 | 1,999 | 0 | 8 tokens |
| Transient .5 for 16 tokens | 52 | 657 | 1,339 | 12 tokens |

Known-null unchanged alarms are 69/2,048 = **3.37%**, Wilson 95% interval
**[2.67%, 4.24%]**. The nuisance-null result is 60/2,048 = **2.93%**,
interval **[2.28%, 3.75%]**. The two panels use different frozen streams;
their difference is not a paired causal rendering-effect estimate.

Under permanent .5 change, 1,987 of 2,001 eligible streams detect by the end
of the 256-symbol horizon; fourteen do not. Under the stronger .25 change,
all 1,999 eligible streams detect. Transient detection is 657/1,996 eligible
streams; delay includes alarms after the sixteen-token departure ends.
Pre-change alarms are excluded from the eligible denominator and reported
separately.

On nuisance-null, fitted order-two alarms 58 times, versus 52/61/58 for
RNN seeds 41/53/67. Their alarm-fraction differences against order-two are
-.002930, +.001465 and zero. The deliberately wrong fair-IID denominator
alarms on 2,037/2,048 unchanged streams, all before index 128. Its valid
alternative laws do not repair its wrong null or grant a .05 guarantee.

## Cost and retained numeric payload

These are medians of five repetitions per arm on the same 256 length-64
contexts, with frozen warmups and rotating candidate order. All times are
per call. End-to-end calls generate and execute the ROM, decode all frames,
check conformance and predict. Token-only calls begin at the decoded prefix.

| Arm | Token-only microseconds | Token-only allocated bytes | End-to-end microseconds | End-to-end allocated bytes |
| --- | ---: | ---: | ---: | ---: |
| Order-two | 0.556 | 544.02 | 1,780.92 | 864,280.16 |
| RNN 41 | 8.035 | 312.02 | 1,768.86 | 864,048.16 |
| RNN 53 | 7.883 | 312.02 | 1,777.59 | 864,048.16 |
| RNN 67 | 7.949 | 312.02 | 1,792.35 | 864,048.16 |

The RNN is roughly fourteen times slower at token-only inference, while
allocating less in this implementation; order-two validates its stored
distributions on each call. Rendering and extraction dominate end-to-end
cost and largely hide that difference. End-to-end time ratios are
.9932/.9981/1.0064 and allocation ratios are .9997 for all three RNNs.
Small time differences on an ordinary host do not establish a speed ranking.

Stored parameter numeric payload is 112 bytes for order-two and 848 for an
RNN; the declared predictor-state/output payload is 24 versus 80 bytes.
The separate partial pipeline ledger records 4,096 current/previous-frame
cell bytes, 4,096 emulator-memory bytes, 2,048 logical display Booleans and
a 517-byte ROM. It excludes registers, stack, keys, metadata and object
headers. These ledgers are not managed-heap size or peak RSS. No peak-memory,
energy or throughput-SLA claim is made.

## Independent checks and review findings

The Python reference independently interprets the declared ROM subset,
regenerates all frame/token/ROM fingerprints, fits counts and recomputes all
72 prediction-arm panels and 30 detector-arm panels. Every discrete decision
and fingerprint agrees; maximum numeric discrepancy is **3.638e-11**, below
the registered 1e-10 tolerance. All 120 cost workload/checksum/payload rows
agree, maximum checksum discrepancy **2.274e-13**. Wall-clock times are
measurement metadata, not quantities independently reproduced by the replay.

PyTorch binary64 independently retrains seed 41 through all 1,024 updates.
The maximum final-parameter difference is **3.886e-16**, trace difference
**1.110e-16**, and initialization difference zero. No tolerance was changed.
The replay retains its complete final parameter vector, optimizer budget,
trace and source fingerprints.

Independent review corrected the jump-prefix bit bug before protocol
publication. Before registered measurement it also caught missing cost
validation, incomplete source manifests, missing loaded-binary provenance,
Python's compensated-sum difference from the declared consuming reduction,
and a provenance check that ran too late. Tests now cover refusal before
replay when its code is unpreserved. Input hashes bind the same bytes that
were parsed, avoiding a late reread race. The reviewer of the integrated
replay did not independently review its own contributed training module;
that module has gradient/optimizer hand fixtures and the native comparison.

Final review found that the verdict reader trusted `Passed=true` even if a
replay receipt also reported out-of-tolerance errors. A
[synthetic contradiction witness](../../src/Research.FSharp/rendered-signal-verdict-admission-witness.json)
preserves that pre-repair acceptance; the reader now checks both reported
errors against 1e-10 and refuses nonfinite/Boolean values. The
[original verdict](../../src/Research.FSharp/rendered-signal-verdict-v1.json)
is retained. Reapplying the repaired reader to the same measured inputs
changes only its source hash; every number and decision is identical.

The native implementation passed a full Release build and 7,470 solution
tests with six existing skips. An initial compiler exit 139 in unchanged
SubstrateDiscovery disappeared after isolated and full rebuilds, without
source changes; both the failure and retries are preserved in the
[validation archive](rendered-signal-validation/2026-09-06/README.md).
After integrating current main at `31e24d599`, the final full Release build
passed with zero warnings/errors, and all **7,472** solution tests passed
with six existing skips. The two additional tests came from intervening main.
The integrated Python suite passed 112 tests; the separately integrated
verdict module passed twenty-eight additional focused tests. The Python suite
reported one existing `HookedTransformer` deprecation warning. FSI runners
and their provenance helper compile with warnings as errors. `dotnet format`
supports C#/VB and explicitly skips F#; its success is stated at that scope.

The [first interp CI run](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/34059437248)
passed 139 cases but failed the live FSI hand fixture:
the fresh workflow had no Core-build step before Python tests. The workflow
now builds the required native assembly explicitly and raises its test-count
floor to 140. Lane-local Ruff also required separating first-party imports
in three test files; run its checks from `src/Interp.Python`, including mypy
over both `zeta_interp/` and `tests/`. General quick preflight lints the Core
and ARC Python projects; it does not cover this opt-in interp lane. These
execution fixes change no measured source, threshold or completed receipt.
The final local lane command passes all **140 tests**, with the same existing
deprecation warning; lane-local Ruff, formatting and mypy over source/tests pass.

A later Linux ARM matrix job exposed a pre-existing single-interval allocation
assertion: 39,936 expected bytes versus 39,952 observed bytes across 128 calls.
The [allocation-test review](rendered-signal-validation/2026-09-06/allocation-test-review.md)
retains that failure and the failed first repair. The final sampler uses a
fixed warmup and five alternating batches, exact minimum equality, and a
retained-context-copy negative control. Its focused suite and eight fresh
processes pass; runtime-phase variation is observed, but the cause of the
original 16-byte event is not identified. `SmallRnn`, registered criteria and
scientific receipts remain unchanged. This is a sampled steady-state check,
not a guarantee that every cold runtime interval allocates identical bytes.

Final integration source `cc5744478` passes a zero-warning/error Release build
and **7,492 solution tests** with six existing skips. The
[validation archive](rendered-signal-validation/2026-09-06/README.md) retains
the final logs and original ARM failure excerpt.
After integrating the relational-identity landing, all **157 Python tests**
pass with the same existing warning; the workflow's minimum count is 157.
The handoff links both results and retains their separate proof boundaries.

The experiment itself landed through [PR #16858](https://github.com/Lucent-Financial-Group/Zeta/pull/16858)
at source `69ba5db2f`, merge `d9787b016bc2ccc9a1d86bf3ab67a6df1f8df5e0`.
Its final hosted matrix recovered from the earlier ARM failure: 93 successful
checks and three skips. The successful replacement ARM job is
[101563778563](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/34060359580/job/101563778563).
The allocation-test improvement and final integration records were prepared
locally while repository automation merged that earlier head; they land as a
separate validation follow-up. A successful retry does not establish the
cause of the original event or remove the value of its preserved witness.

## Receipts and reproduction

- [Native corpus, models, predictions and detection](../../src/Research.FSharp/rendered-signal-results.json)
- [Native inference costs](../../src/Research.FSharp/rendered-signal-inference-results.json)
- [Independent full replay and retraining](../../src/Research.FSharp/rendered-signal-replay-results.json)
- [All-seed threshold verdict](../../src/Research.FSharp/rendered-signal-verdict.json)
- [Validation and execution logs](rendered-signal-validation/2026-09-06/README.md)

Use a writer-owned clone at the experiment archive tag to keep source hashes
available even after future `main` changes. Build Core, install the pinned
Python project dependencies, and write reproductions to fresh paths:

```sh
dotnet build src/Core/Core.fsproj -c Release
uv sync --project src/Interp.Python
mkdir -p .git/rendered-reproduction
dotnet fsi --warnaserror --optimize+ src/Research.FSharp/run-rendered-signal-experiment.fsx .git/rendered-reproduction/native.json
dotnet fsi --warnaserror --optimize+ src/Research.FSharp/measure-rendered-signal-inference.fsx .git/rendered-reproduction/native.json .git/rendered-reproduction/cost.json
uv run --project src/Interp.Python python -m zeta_interp.rendered_signal_replay .git/rendered-reproduction/native.json .git/rendered-reproduction/replay.json --training --cost .git/rendered-reproduction/cost.json
uv run --project src/Interp.Python python -m zeta_interp.rendered_signal_verdict .git/rendered-reproduction/native.json .git/rendered-reproduction/cost.json .git/rendered-reproduction/replay.json .git/rendered-reproduction/verdict.json
```

Quiesce own builds/tests/training before the cost command. Scratch outputs
are for comparison; do not replace committed receipts. A subsequent action
experiment must first define an actual action-before-feedback boundary,
supplied goal, held-out streams and return/resource criteria. This result
selects its simpler candidate; it does not measure that future action loop.
