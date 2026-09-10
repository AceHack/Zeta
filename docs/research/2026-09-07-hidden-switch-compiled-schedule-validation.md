# Guarded hidden-switch compilation: exact cost schedule

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: prearchive pure header validation; no measurement execution

Source `33f66f382767f36dfde9933b87f76aa1144cbdaa` adds the
[schedule constructor and checker](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_schedule.py)
for all fifty registered cost rows. It preserves mode, replicate and panel
order, rotating only the two strategies within each replicate. Each row has
exactly nine fields, including separate warmup/measured action-call and episode
counts. The checker rejects missing, duplicated, extra, reordered or restamped
rows and retains the number of complete rows checked before a value failure.

The [retained fixture](hidden-switch-compiled-validation/2026-09-07/cost-schedule/schedule.json)
contains all fifty headers. Their totals are 6,720 warmup and 1,740,800 measured
action-service calls, including 160 warmup and 1,280 measured whole episodes.
The 17 observations per episode are a separate trace obligation; neither
observation counts nor the old-runner prelude may replace the 16 action calls
per episode. Header sums are declarations checked against the protocol, not
evidence that a service executed them.

The focused suite passed **80 tests in 4.05 seconds**, plus strict mypy and
Ruff checks on source and tests. It mutates every header position, checks eleven
independent order anchors, rejects Boolean integer impostors, and distinguishes
row reordering from merely incorrect indices. An initial mypy check required an
explicit local `list[CostRow]` annotation; that was corrected before tests ran.
The [three-artifact inventory](hidden-switch-compiled-validation/2026-09-07/cost-schedule/manifest.json)
binds the complete fixture, exact emitter and lossless successful test log.
Original and stored byte counts, hashes and gzip relations were verified.

Independent [read-only review](2026-09-07-hidden-switch-compiled-falsifier-source-review.md)
accepted the exact source pin without rerunning tests or generating native
outputs. Actual timing/resources, warmup and measured payloads, tuple rosters,
executing source/runtime identities, cross-phase chronology and complete
envelope admission remain separate requirements. This fixture supplies none
of the registered `9307` or `9409` streams and makes no cost claim.
