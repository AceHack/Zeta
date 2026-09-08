# Ordinary-import integration and shared retention budget

Date: 2026-09-08
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade

The [manifest](manifest.json) binds the lossless [custody archive](custody.tar.gz)
of source snapshots, actual command arguments, exit status, stdout and stderr.
Attempt 1 at integration head 8100544b68573e00fa3e99aa51e94673ebbc25de
passed 272 Python tests through ordinary package imports. Ruff found two import
separations; mypy found eight optional-narrowing and test-wrapper annotations.
Attempt 2 removes only those import separations, captures the admitted baseline
before closure use, makes admitted receipt bytes explicit and types the storage
fault fixtures. Ruff and mypy pass for all twelve projection source/test modules.
The focused runner suite passes 28 tests, including six reduced-budget controls.
No final numerical roster was executed. These are component fixtures, not
physical invocation or scientific comparison results.

The recorder now admits a caller-derived smaller budget under the unchanged
256 MiB combined raw-plus-stored and 512-artifact ceilings. Its journal remains
8 MiB; setup requires more than 2 MiB additional combined space and at least
three slots for journal, terminal and one ordinary artifact. Existing per-write
reservation checks remain in force. Reduced allowance does not guarantee that
all planned records will fit. Controls reject excessive slots, a changed journal,
exhausted terminal allowance and insufficient ordinary slots without mutating
or finalizing the caller's store. Two reduced valid budgets exercise an actual
synthetic launch failure and retain its primary cause through finalization.

The driver claim's initial normal push failed markdownlint MD012. Its raw hook
log is preserved. The extra claim-document blank line was removed; no hook was
bypassed. Successful retry and independent review are separate evidence.
