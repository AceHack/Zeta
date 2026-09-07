# Guarded controller: truncated gzip must reach decompression

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: reviewed fixture correction; complete outer replay pending

The new file replay exposed a falsifier-quality gap in the previously accepted
owned-file fixture. The artifact/truncated-gzip case stored its intentionally
truncated gzip under file.bin. The shared descriptor checker requires a gzip
path to end in .gz, so the actual reader returned artifact-encoding at Artifact
before reaching decompression. Earlier tests required a typed refusal but did
not require the intended failure boundary. Those passes remain historical test
results; they do not establish successful truncated-gzip conformance.

The initial new replay run had 32 passing cases and one failure because it
required artifact-gzip. A focused regression independently preserved the actual
original complete FileCallObservation, then failed with artifact-encoding.
Repair `b62655e019914094dc443a6fc5a11d77d63197c3` changes only that fixture's
leaf to file.gz. The descriptor, write and real read use that same target; the
original compressed bytes and truncation remain unchanged. The regression now
requires one completed operation, no harness failure, actual artifact-gzip and
path file.gz. All 34 owned-file tests pass in 4.79 seconds; strict checks pass.

The [independent review](2026-09-07-hidden-switch-compiled-gzip-fixture-review.md)
accepts this narrow correction. The [lossless inventory](hidden-switch-compiled-validation/2026-09-07/file-gzip-boundary/manifest.json)
retains 16 records: the original actual failure inside its owned tree, regression
logs, both complete before/after trees, initial replay-source observations,
strict checks and exact corrected source pins. The before tree has five entries
and 1,415 regular bytes; the full corrected suite has 103 entries and 1,824
regular bytes. No failed output was rewritten or removed.

This correction implements the already fixed decompression-negative case. It
changes no protocol threshold, strategy, source domain, registered stream or
scientific row. The new file-replay module has its own separate review scope.
The 1,164-test historical integration predates this discriminating regression;
it is not presented as validation of this repaired fixture.
