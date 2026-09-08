# First native precision-gate validation

Date: 2026-09-08 UTC
Operational status: research-grade
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

The [ADR](../../../../DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md)
defines the bounded local rules. The first release compilation built the new
Bayesian library but refused the test module opening a RequireQualifiedAccess
module (FS0892). Tests now use qualified type and case names. The second focused
release run passed all 22 tests. No arithmetic source changed for this repair.
Build-graph derivation and formatting completed without changing the derived graph.

The [manifest](manifest.json) retains original stdout, stderr, process metadata
and first source hashes as lossless gzip with both original and stored hashes.
This is focused validation, not the full gate, independent cross-language replay,
a trained learner, or a benchmark result. Those remain separate steps.
