# PR17041 independent merge-proof custody

Operational status: research-grade

The [signed review](../../2026-09-08-pr17041-merge-proof-independent-review.md)
is the entry point. [audit.py](audit.py) checks the retained observation,
original and corrected path proofs, and exact local Git entries. Its
[result](result.json.gz), bound by [byte identity](result-identity.json),
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
