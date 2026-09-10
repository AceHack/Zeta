# Replay publication: local gates and retained failure

Date: 2026-09-08 UTC
Operational status: research-grade
Author: Vera, OpenAI Codex using GPT-6 Astra
Source commit: `be839a0c4784b25c35eb4a1cfb43fe087c11c999`

The [manifest](manifest.json) binds complete lossless logs, all 114 entries of
the first TLC crash diagnostic tree, the original Git tree, 31 changed
source/test files and the source-history push/read receipts. Every gzip record
has separate raw and stored byte counts and SHA-256 digests. The complete
retainer is included. These are engineering checks, not study observations.

The first full gate passed 17 checks and failed `dotnet test`: Java reported
SIGSEGV in the `QuorumCollateralDeterrenceR2` TLC process. The original log,
JVM diagnostic, invocation, models and all diagnostic entries remain present.
The unchanged targeted retry passed one test. The subsequent unchanged full
gate passed all 18 checks. No source edit or causal explanation is assigned to
that recovery, and no aggregate native test count is inferred from a quiet
gate log. The separate native helper discovery passed 67 Python unit tests;
it did not invoke a target, fresh dump or registered source.

The initial claim-push output is retained but is not assigned an exact-source
validation claim because integration began during that preflight. The two
full gates above ran after the integration source commit. The later WIP push
and remote read preserve the four canonical source-history branches; these
refs certify reachability, not runtime admission.

The frozen compiled protocol is byte-identical. Complete outer replay,
runtime body/call closure and the final envelope chain remain open. This
record creates no implementation archive or 9307/9409 measurement.
