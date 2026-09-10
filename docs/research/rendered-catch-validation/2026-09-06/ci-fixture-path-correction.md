# Rendered-catch CI fixture path correction

Date: 2026-09-07 UTC
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1W8T690087G0R002DJ91MJ

## Failure and repair

The first published acting head,
`30dc175d239ba7ec685f25f4b6c6efed9e830bb3`, failed two compiled tests on
all three native CI platforms. The builds succeeded. Both failing tests
called `counts()` in `RenderedCatch.Tests.fs`, which resolved the frozen
model relative to `__SOURCE_DIRECTORY__`. The CI build maps source paths
to `/_/`, yielding the nonexistent runtime path
`/_/src/Research.FSharp/rendered-signal-results.json`.

The [retained failure extracts](ci-mapped-path-failure.log) preserve job
links, timestamps and hashes of all three downloaded logs from
[gate run 34068080589](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/34068080589).
This was a deterministic test-harness defect, not the earlier compiler
exit-139 recovery. Ordinary local builds did not exercise CI path mapping.

Only the test fixture lookup changes: walk from `AppContext.BaseDirectory`
to the ancestor containing `Zeta.sln`, fail explicitly if none exists, and
read the same model through the existing registered hash/count admission.
The pattern follows `Formal/Tlc.Runner.Tests.fs` and avoids mutable process
working directories while other tests run concurrently. No test assertion
or model admission is relaxed.

The separately delegated source review accepted this repair with no material
finding. That reviewer also rehashed every one of the 23 scientific source
files against the behavioral receipt: all match. The changed test file is
outside that manifest. This review covers the test harness and source-byte
comparison; it is not another emulator, resource measurement or experiment.

The implementation and result archives remain unchanged. All original
behavior, cost, replay and verdict receipts retain their exact bytes. No
registered experiment was rerun for this repair.

## Validation

The full Release build was repeated with
`-p:ContinuousIntegrationBuild=true`, so the compiled tests exercise the
mapped-source configuration which exposed the defect. It completed with
zero warnings and zero errors. The focused run of all ten `RenderedCatch`
cases passed against those binaries. The full solution run then passed
7,523 tests with six existing skips and no failures. All 16 quick checks
passed. Retained logs:

- [CI-mapped build](ci-mapped-build.log).
- [Focused ten-case test run](ci-mapped-focused.log).
- [Full solution test run](ci-mapped-tests.log).
- [All 16 quick checks](ci-path-preflight.log).

## Combined research-lane integration

After the finite stochastic bridge and NCI capability correction landed,
the root writer integrated `origin/main` at
`fa6918b9e9204183628594a4811346ec128c624c`. The resulting merge is
`9ee2d0ce6a7add1a5d3920e1ab7d44623d5b6418`. All 23 acting and eight bridge
scientific source hashes still match their first receipts. The Python
workflow's minimum collected-test count increases from 258 to 299 because
the merged suite includes both research lanes.

The delegated integration check independently assembled earlier acting
head `30dc175d2` and bridge head `378406111` over main `cb6ab68e0`.
Its [original manifest](acting-bridge-combined-validation.json) records a
local-only merge, reused Release Core and no manual scientific edits.
All 299 cases passed, with one existing activation-access deprecation
warning and no failures, errors or skips. Live FSI also passed. The manifest's
absolute paths describe that check's original host locations; retained copies
are indexed here:

- [Pytest output](acting-bridge-initial-pytest.log) and [JUnit cases](acting-bridge-initial.xml).
- [Ruff](acting-bridge-ruff.log), [format check](acting-bridge-format.log), and [mypy](acting-bridge-mypy.log).

The root writer separately rebuilt the merged snapshot with CI path
mapping: zero warnings and zero errors. Its Python suite also passed all
299 cases, with one existing warning and no failures, errors or skips.
Ruff, the 34-file format check and 33-file mypy check passed. All 16 quick
checks passed. The combined solution gate passed 7,527 tests with six
existing skips and no failures.
These checks validate integration and test collection; they do not repeat
the registered scientific measurements.

- [Combined CI-mapped build](combined-build.log) and [full solution tests](combined-tests.log).
- [Combined Python output](combined-python.log) and [JUnit cases](combined-python.xml).
- [Combined Ruff](combined-ruff.log), [format check](combined-format.log), and [mypy](combined-mypy.log).
- [Combined quick preflight](combined-quick.log).
