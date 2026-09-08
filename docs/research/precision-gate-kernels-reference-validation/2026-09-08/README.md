# Independent precision-gate reference evidence

Operational status: research-grade
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X
Source commit: 9e6be94a0ec2b153ba63e100463f91418ceed4fe
Pre-generation plan: 3888d9a6b3e443f42320ff838f939ae483ecd2c8

The [report](../../2026-09-08-precision-gate-kernels-reference.md) fixes the
arithmetic and scope. The [manifest](manifest.json) binds every original raw
record and its lossless gzip bytes separately. Compressed source copies and
diagnostics preserve original bytes, including any formatting controls.
Nothing is stripped or normalized. This is reference validation, not native
conformance, runtime closure, a solver or training.

The manifest has 34 lossless original/stored pairs. The original executed
capture harness and its later two-line formatter diagnostic are preserved
separately. The readable harness has only those formatting changes; it was
not rerun and is not mislabeled as the original capture source.

The offline [audit script](audit_archive.py) and its actual
[result](audit-result.json) check all 34 pairs (187829 original bytes and
43193 stored bytes), both current/committed final source identities, the
pre-generation plan, the vector/stdout/complete-return associations and the
recorded command exits. This audit imports no project module and executes
no reference or native operation. Its result is an archive check, not a
second invocation of the vector generator.

| Stage | Actual observation | Retained records |
| --- | --- | --- |
| Attempt1 | 76 tests passed in 4.43s; one mypy result-union narrowing diagnostic; Ruff passed; two files required formatting. | attempt1 source copies, complete stdout/stderr for four commands, command exits/timestamps, formatter-application streams. |
| Attempt2 | 77 tests passed in 4.28s; strict typing on both files, Ruff and formatting passed. | attempt2 source copies, complete stdout/stderr for four commands, command exits/timestamps. |
| Final vectors | One invocation of the committed fixed generator returned Success; 24 rows, 17 successful values and seven expected typed refusals. | Exact stdout, empty stderr, actual complete Success return, source copy and source/interpreter observations. |

The first command recorder retained each child exit explicitly although its
own shell command exited0. The second uses check=True and aggregates retained
child exceptions into a nonzero final status on failure. No initial mypy or
format failure is treated as passing. The 77th test adds bounded encoder-cycle
refusal; no mathematical fixture was relaxed.

The readable [reference-vectors.json](reference-vectors.json) is byte-identical
to the final stdout, not a reconstructed table:

~~~text
Bytes: 21985
SHA256: ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489
~~~

The [capture harness](capture_vectors.py) binds the source against its Git
object, checks the actual imported file and observes source bytes again after
the call. Its complete returned value is retained separately from stdout.
The observed interpreter is Python3.14.6 on macOS26.6.2 ARM64. Current source
and interpreter-byte observations are not proof of executed bytecode or a
transitive module/runtime closure. FullRuntimeClosureAdmitted and
NativeComparisonPerformed remain false in the observation record.

No new F# process, policy, random input, optimizer, benchmark, Q8 experiment or
old registered-study stream was run. The exact mathematical reference admits
some values the conservative native binary64 boundary may refuse; it does
not emulate that range or operation order.

Signed: Vera, OpenAI Codex using GPT-6 Astra.
