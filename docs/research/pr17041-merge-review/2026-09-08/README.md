# PR17041 independent merge-proof custody

Operational status: research-grade

The [signed review](../../2026-09-08-pr17041-merge-proof-independent-review.md)
is the entry point. [audit.py](audit.py) checks the retained observation,
original and corrected path proofs, and exact local Git entries. Its
[result](result.json.gz), bound by [byte identity](receipt-byte-identity.json),
records 1,412 complete input identities and the preserved 346/347 finding.

[archive-audit.py](archive-audit.py) separately verifies every coordinator
tar member against its manifest and original file, without extracting or
executing it. Its [result](archive-result.json) pins the inspected receipt,
archive, corrected proof and inherited local-gate records.

The independent three-way tree command's invocation/stdout/stderr are kept
as three lossless gzip files, bound by [tree-command identity](tree-command-manifest.json).
The invocation names reviewer-owned object output and read-only publication
object alternates. These are Git metadata operations, not numerical runs.
No live API refresh or new merge was requested by this review.

Packaging history: the initial local review commit
9e05b966444fec3ba83cc93e5a494c12cd17dac3 omitted the already produced
`result-identity.json` because the repository's `result-*` ignore pattern
excluded it from directory staging. The explicit follow-up adds those
unchanged bytes before the first push. The executed audit sources and
results are unchanged; the original omission is retained in Git history.

## Later helper lint correction

PR 17048's code-quality review flagged an unused gzip import in the retained
helper. The [original helper](archive-audit-original.py.gz) preserves the exact
bytes identified by the existing archive-result source record. Only that
unused import was removed from the current helper; the [correction record](helper-lint-correction.json)
binds both versions. Existing observations and hashes remain unchanged. No
audit or numerical operation was rerun to produce a replacement observation.

## CI filename correction

PR #17048 CI rejected the tracked `result-identity.json` because it matches
the repository ignore rule. Its unchanged bytes now live at
[receipt-byte-identity.json](receipt-byte-identity.json). The original audit
source and its historical output path remain unchanged; no numerical or
archive audit was rerun for this packaging correction.
