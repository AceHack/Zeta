# Independent registered-1 audit records

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade review custody

The [signed review](../../../2026-09-08-projection-registered-independent-review.md)
indexes this bounded read-only audit. `audit.py` checks the complete actual
archive, local originals, source/Git identities, fixed roster, process receipts,
exact recorded comparisons, mutation ancestry and recorder accounting.
`supplemental-audit.py` checks preparation, relative paths, coordinator/summary
associations and seven exact stationary-pair containments. `pr17050-audit.py`
checks the separately requested prior publication receipt. These scripts use
standard-library code and read-only Git commands; they do not import or execute
the implementation or rerun any numerical service.

The [identity manifest](audit-identities.json) binds each retained script,
command completion and output. Raw stdout/stderr bytes are also retained in
lossless gzip form. `audit-1` and `pr17050-1` succeeded on their first invocation.
`supplemental-2` succeeded after the single reviewer correction below.

## Reviewer assumption correction

The first supplemental script incorrectly expected `NativeCallPaths` to be
absolute. Actual driver source constructs those paths relative to the explicit
`AttemptRoot`, and all 81 paths resolve correctly against that base. The
original supplemental script, empty stdout and exact assertion traceback are
preserved as `*.original.gz`, with its exit-one completion. The corrected script
uses the source-defined relative paths; its second invocation passed. No driver
or experimental artifact was changed, and no production defect was established.

The complete audit output contains 88 actual outcome rows, 27 process summaries,
110 exact retained leaf comparisons, 47 root occurrences and twelve mutation
dispositions. It is a reviewer-derived receipt. The original native, reference,
certificate and process records remain in the separately pinned producer archive.
