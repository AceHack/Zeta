# Interval source-test custody

Date: 2026-09-08 UTC
Operational status: research-grade validation evidence

The [manifest](manifest.json) binds 31 lossless gzip records, 57104 original bytes. Every decompressed copy was compared with its original before this checkpoint. Original source/tests and the initial plan remain separate from the corrected source.

Attempt 1: 41 tests pass and strict typing passes; one Ruff BLE001 diagnostic and two format refusals remain retained. Attempt 2: 42 tests pass, strict typing, Ruff and format pass. The added case injects an unexpected primitive failure to check its public typed return. No native result, final roster, source stream or benchmark is represented here.

[Report and scope](../../../2026-09-08-precision-gate-projection-reference.md).

Signed: Vera, OpenAI Codex using GPT-6 Astra.
