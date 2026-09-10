# Rendered catch integration before source archival

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1W8T690087G0R002DJ91MJ

This record preserves validation before the registered acting experiment.
It is indexed by the [native implementation record](README.md) and supports
the [independent carrier/replay review](../../2026-09-06-rendered-catch-carrier-replay-review.md).
No registered behavioral or cost result existed when these checks ran.

## Integrated gates and exact scope

The final native build/test snapshot was
`24d88c7fa5ecb57214365de28e5a6949802fa6dd`. The Release build finished with
zero warnings and zero errors. The solution test run passed 7,523 tests with
six existing skips. The earlier integrated formatter invocation at
`814236852f14f6be261a64c7b3bc804855ed0143` exited zero for its supported
C#/VB scope; its F# project warnings are retained and are not represented as
F# formatting coverage. The final quick gate supplies the separate F# lint.
No Core or Core.Abstractions source changed between those native snapshots.

Commands and retained output:

| Command | Evidence |
| --- | --- |
| `dotnet build -c Release` | [Build output](integration-build.log) |
| `dotnet test Zeta.sln -c Release --no-build` | [Solution tests](integration-tests.log) |
| `dotnet format --verify-no-changes` | [Formatter output and scope warnings](integration-format.log) |
| `uv run pytest tests -q` in `src/Interp.Python` | [258 passing Python tests](python-full-tests.log) |
| `bun run preflight:quick` before upstream repair | [15 passes and the existing R5 failure](preflight-before-upstream-repair.log) |
| `bun run preflight:quick` after upstream repair | [All 16 checks pass](preflight-final-source.log) |

The full Python run contains 157 predecessor tests plus 101 acting tests,
including the live 15-case native/Python hand-fixture comparison, 18 full-shaped
envelope cases, and 43 independent-verdict cases. One existing activation
deprecation warning remains. It ran after the final semantic repair in
`3094377a3e86efb89b291d1dd286f4ba9f008be3`; subsequent Python changes only
adjusted import spacing. Lane-specific Ruff lint, Ruff format, and mypy
checks passed. The generic repository quick gate alone does not cover this
Python lane. The workflow floor is raised to 258 for this integrated suite.

## Independent verdict review

The verdict implementation was written separately from the native experiment
and Python emulator/replay, and integrated from
`3a07f39d02e1ea2ab64829d91237b9496a751e48`. The coordinating writer reviewed
its fixed source/panel/arm/episode rosters, exact-byte model and receipt
binding, strict JSON/type checks, paired return arithmetic, known-lag action
comparison, and five-row resource medians. Integer comparisons implement
the registered 0.15 positive and 0.03 null thresholds without rounded
display values. Cost admission requires positive finite denominators and
the full 25-row rotated roster. Failed readers preserve each available input
hash, source provenance, and failure stage without replacing prior receipts.

Review removed an overly strict requirement that the implementation archive
commit be an ancestor of a later source commit: a squash merge can preserve
all admitted bytes without that ancestry. Registration must still precede
the immutable implementation archive; current, declared-commit, and archive
bytes must match for every admitted source. A temporary-git regression
checks this distinction. Source hashes and recorded assembly identifiers are
consistency evidence, not cryptographic execution attestation.

The verdict checks receipt arithmetic and consistency. It requires a complete
independent replay receipt and never substitutes source-symbol agreement
for execution of the rendered reference. A supplied replay receipt is not
authenticated merely by its own `Passed` field; untrusted reports require
rerunning the archived full replay. Synthetic verdict fixtures deliberately
substitute provenance/model admission and are labeled accordingly.

## Retained refusal before the archive existed

At source `a02251aa0`, the public measurement CLI was invoked with the frozen
passive model while the implementation archive tag was absent:

```bash
dotnet fsi --warnaserror --optimize+ src/Research.FSharp/run-rendered-catch-experiment.fsx src/Research.FSharp/rendered-signal-results.json docs/research/rendered-catch-validation/2026-09-06/refused-before-archive.json
```

The command exited 1 and retained
[`refused-before-archive.json`](refused-before-archive.json), SHA256
`B93018BCB58C0A8DA8F0FC10C36C3C7307C8400A8A07CCA54B742C79AF45208D`.
The failure is `admission/archive-git`, `Complete` is false, and `Panels`
is empty. Input/model hashes and provenance are unavailable because admission
refused before input reading and source generation. The
[actual CLI output](refused-before-archive.log) is retained. This is an
admission negative control, not a registered behavioral attempt or estimate.

## Existing gate failure and upstream repair

The integrated quick gate detected the same existing NCI test defect recorded
by the independent reviewer: a filename-absence assertion did not support its
emitter-independence claim. Upstream PR #16881, commit
`76a80b74d5e25c2bd6681d648ed46d195397d73f`, replaced it with exact static
import and literal dynamic-import/require rosters. That upstream change was
integrated unchanged as `13aa93fb4`; its nine focused tests pass. This is a
stronger static dependency check, not proof against computed access or
arbitrary process capabilities. A separate contributor is examining that
broader boundary. No census allowance or gate bypass was used here.

The final integrated quick gate passes all 16 checks. The source archive is
published after that check. Publication output and later empirical receipts extend this record;
they do not overwrite the retained failure or any immutable archive.

## Subsequent recorded-evidence audit

After all four registered receipts completed, the delegated protocol reviewer
independently hashed each receipt and checked all 23 current, archived and
declared-commit fingerprints across all four manifests, registration ancestry,
protocol/model bindings and the native/cost assembly identities. Using separate
standard-library calculations, the reviewer recomputed every one of the
20,480 recorded behavioral returns and hit-bit/key/target relationships,
all paired-return vectors, known-lag key equality, shared projection digests,
and the 1,800 cost episode sums and counters. All twelve return operands and
all 25 rotated cost rows agree with the verdict. Wall and allocation ratios
are 0.9870793806954431 and 0.9994612391331381; descriptive CPU ratio is
1.0003399721136799. No admission or arithmetic finding remained.

This reviewer authored the verdict implementation. The subsequent audit is
an additional recorded-evidence/source-binding check, not a third interpreter,
new replay algorithm or independent remeasurement. Full rendered execution
belongs to the separately written Python replay retained with the
[registered result](../../2026-09-06-rendered-catch-actions-results.md).

## Publication integration gate

The complete measured data/report snapshot is archived separately at
`8487974c6c64a9a73612ee4e5e8271d921b4cb89`. Integrating current main yielded
`19aa9d7cbd3617ceae44445b18d786185020d63d`. All 23 admitted scientific
files still match their measurement hashes and their committed bytes.
The original native/cost binary receipts remain untouched; publication
validation is a separate check of the combined repository tree.

The first full publication build failed with `MSB6006: dotnet exited with
code 139` in `Tests.FSharp.fsproj`. The affected project passed unchanged
with `-m:1`, followed by a successful ordinary full Release build and all
7,523 solution tests with six existing skips. No source or build-setting
repair was needed; the crash mechanism is not established by that recovery.
The final quick gate passes all 16 checks. Evidence:

- [Original compiler failure](publication-compiler-failure.log).
- [Unchanged isolated project build](publication-isolated-build.log).
- [Full recovery build](publication-recovery-build.log).
- [Full recovery test output](publication-recovery-tests.log).
- [All 16 publication preflight checks](publication-preflight.log).

The delegated verdict/evidence reviewer also accepted the final result
wording after inspecting its counts, gain bounds, retained first cost
repetition, allocation/payload distinction, native-shadow/Python boundary,
and supplied-goal claim limit. That acceptance is an evidence and report
review; it does not create another independently authored interpreter.

## Subsequent CI and combined-lane publication

The [CI fixture-path correction](ci-fixture-path-correction.md) continues
this record with the compiled test path failure, explicit CI-mapped build,
test-only repair and later integration of the landed categorical bridge.
It also preserves the independently counted 299-case Python suite and the
corresponding CI collection-floor correction. The original scientific
sources, archives and measurement receipts remain unchanged.
