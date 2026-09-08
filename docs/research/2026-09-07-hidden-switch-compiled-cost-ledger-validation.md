# Guarded hidden-switch compilation: cost ledger admission

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: prearchive pure admission and synthetic ledger tests; no measurement

Source `faa670a4ee615f4d55e96832f4ce4d421b560211` adds the
[complete cost-ledger projection checker](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_cost_ledgers.py).
It revalidates the fifty exact schedule headers, then checks each ledger's
index, UTC interval and six-field resource record. Rows must follow the full
prelude and prior row and finish within the cost phase. Nanosecond UTC precision
is retained. Local GC differences must be exact and nonnegative; generation
counts may increase between rows but may not decrease. UTC elapsed time is not
equated with separately measured monotonic wall time.

Only after all fifty ledgers pass does the checker derive fifteen exact
compiled/native pairs: one for each mode, panel and wall/CPU/allocation metric.
Each median uses all five integer totals from its own strategy and panel.
The four required ordinary wall/allocation conditions use unbounded integer
`2*compiled<=native`. A zero required native allocation median refuses the
cost condition while preserving all valid ledgers and descriptive pairs;
it does not invalidate separately established action equivalence. Descriptive
zero denominators retain `null` and the registered CPU/allocation reason.
Zero numerators over positive denominators remain actual zero ratios.

The focused suite passed **73 cases in 3.84 seconds**, with strict mypy on both
source and tests plus Ruff and format checks. Its thirteen test functions and
parameterization include a refusal at every row position, a 100 ns overlap,
restamped ordering, valid local GC counts that decrease across rows, int64-limit
threshold arithmetic, an unpooled failing panel, and a case where the median
of paired ratios would pass while the required ratio of medians fails.
Independent read-only review accepted the exact source/test pin without
executing tests, imports, native targets or study streams.

The [lossless inventory](hidden-switch-compiled-validation/2026-09-07/cost-ledgers/manifest.json)
also retains the preceding integrated Python run at
`dfc7b7e9c05cc13bbce65f348876956a9cb8a043`: **583 tests passed in 67.65 seconds**
across thirteen compiled-study source/test pairs. Its ordinary publication
hook passed all sixteen quick checks and pushed the active implementation
claim ref. That 583-case run predates this new ledger module; the separate
73-case run is not represented as a combined run. The manifest binds all
26 earlier source/test files, both later ledger files, and five lossless logs
or emitter records against their separate source commits. This is a finite
file correspondence check, not loaded-module or runtime admission.

The checker admits only projected schedules, timestamps and resource numbers.
Actual warmups, measured outputs, invocation counts, allocation/timing boundaries,
full envelope bytes, closed-file chronology and executing source/runtime
identities remain separate obligations. No valid synthetic ledger earns a
native speed claim. The implementation archive and registered streams remain
unopened at this checkpoint.
