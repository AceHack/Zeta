# Projection runner review repairs

Date: 2026-09-08
Operational status: research-grade

The [manifest](manifest.json) preserves the four actual failing reviewer
controls at attempt 5: an escaping comparison OSError and invalid complete
receipt counts for Success(None), Success(42) and native JSON null. Attempt 6
passed 18 tests but had three Ruff late-binding diagnostics in the new observed
slot closure. An explicit functools.partial captures each slot. Attempts 7/8
pass 20/22 tests with Ruff clean. Final-envelope and malformed-comparator
controls preserve the accessible actual prefix and once-only finalization.
The source snapshots and exact command/stdout/stderr records are lossless.

These use the same immutable captured draft NativeObservation dependency as
the initial runner tests. They execute synthetic service callbacks only, with
no native launcher, reference mathematics, or final evaluation. Strict typing
and default module integration still await the process owner's final source.

The initial normal push of 2e051 passed its 16 checks and reached the remote,
but the coordinator edited the two runner files for Services caller admission
while that hook was still active. The pushed commit itself remained 2e051.
The raw hook/ref records are preserved; that mixed-workspace hook is not used
as exact-head source validation. The corrected source has its own frozen
fixture snapshots and must receive a new clean-workspace normal push.
