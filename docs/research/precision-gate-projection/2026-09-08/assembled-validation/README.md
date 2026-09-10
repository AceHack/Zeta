# Assembled source validation

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade

The [manifest](manifest.json) identifies every member in the lossless
[custody archive](custody.tar.gz). It retains the actual full-preflight and
formatter arguments, outputs, exits and elapsed time at
096b09126b1f489fc7720b69780263ef01485445. All 18 preflight checks passed;
formatter exit zero has explicit workspace warnings and unsupported F# projects.
The head, clean status and all 47 source identities remained unchanged during
that gate. This does not claim that dotnet format verified F# formatting.

Two separate ordinary-package Python checks preserve all 14 source/test files,
actual commands and outputs. The first passed 340 tests in 7.53 seconds, mypy
and formatter checks; root-cwd Ruff found one blank import separator in the
driver test. The corrected snapshot removes that line only. All four commands
then pass, with 340 tests in 7.07 seconds. The full preflight is assigned only
to its original source cut. Both test snapshots are explicit; none of these
fixtures is the registered final numerical comparison.

Transfer records bind 863 new coordinator files, 58 initial driver files and
the current-main 47-path comparison. Initially 45 paths matched the coordinator;
main's derived graph and accepted kernel ADR were intentionally retained.
The later one-line test-format correction has its own before/after identity.
The sole missing link reported by the lightweight transfer census was inline
code Success[T](Value), not a Markdown link.

The first dependency install failed with a shell command-not-found after mise
trust changed configuration in that shell. Its actual redirected diagnostic is
retained; exit 127 and the two trust messages were tool-observed, without a
separately captured first invocation/completion JSON. The later explicit already
installed Bun invocation has complete command/output/exit records and succeeds.
No missing first-process record is reconstructed. Build-graph derivation found
no drift. These environment and archival observations do not supply scientific
performance or transitive runtime/source-to-machine attestation.
