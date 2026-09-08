# Privacy grants: cap and integer-boundary repair

Date: 2026-09-08 UTC
Operational status: research-grade
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X
Repair source: `e2a8f7fb23b57aba614da2499273f679bf0935ad`

The existing reward function could reduce an earned entitlement when a cap
fell, and could overflow an Int32 sum into a negative balance. The repair
normalizes only an invalid negative target balance upward to zero, takes the
existing holding as the minimum ceiling, and clamps an Int64 sum before
conversion. It evaluates the supplied gain function once and leaves unrelated
entries unchanged. No distributed merge, transfer or physical-money conversion
is added. The documented object is a local grant ledger.

The [manifest](manifest.json) preserves every targeted attempt and the first
full gate with separate raw/stored byte hashes. The initial targeted attempt
lost its compiler with exit 139 and ran no tests. The unchanged retry ran all
16 tests: seven failed and nine passed. After the source repair, all 16 passed,
including the 512-combination boundary grid. These tests distinguish actual
lower-cap revocation and integer overflow from the documented contract.

The initial full gate passed 16 checks but failed both release build and full
tests after compiler/test-process exit 139. This is not a passing full gate.
Two timestamped OS reports show SIGSEGV in server-GC background frames; only
selected structural diagnostics are published, with hashes identifying the
complete reports retained locally. Their collection does not prove a cause or
identify every failing process. The separate publication writer's successful
full gate is a different source cut and is not substituted for this result.

The source and tests, original probes and all command logs are retained
losslessly. Further validation is appended separately so the failed attempts
remain visible. This repair is a prerequisite for trustworthy resource tests,
not evidence that a combined learning system outperforms a baseline.

## Unchanged full-gate retry

The [second validation record](validation-2.json) retains the unchanged-source
retry at documentation commit `bde72e83c58f8c6317c25cd603881a125ef39c91`.
All 18 full preflight checks passed, including release build and complete tests.
No cause for the earlier process crashes is inferred from this recovery.

The separate requested `dotnet format --verify-no-changes` invocation exited
zero but explicitly reports that F# projects are unsupported. Its complete
output is retained; it is not represented as an F# formatting pass. The F#
lint within the full gate did pass.
