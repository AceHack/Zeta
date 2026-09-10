# Projection runner draft fixture validation

Date: 2026-09-08
Operational status: research-grade
Status: draft source; not final-experiment admission

The [manifest](manifest.json) retains all four actual source/command/output
snapshots. The successive dedicated suites passed 9, 11, 12 and 13 tests;
Ruff passed each recorded attempt. The first pytest bootstrap emitted three
plugin assertion-rewrite warnings, retained unchanged. Later attempts use the
plugin configuration hook and are warning-free. Before the first recorded
attempt, a tool-observed Ruff unused `typing.Any` diagnostic was corrected;
no separate raw stderr or full pre-correction source capture was made for that
initial edit check.

The dependency in these runs is a single immutable copy of the native owner's
then-unpinned process module. The bootstrap extends the package search path to
that exact captured module solely to construct disposable NativeObservation
fixtures. No process launcher, native numerical service, reference root,
certificate solver, or final case was invoked. The fake service callbacks and
manually built receipts are prominently labeled in the tests. They establish
recording behavior only. They cannot unlock the real certificate controls.

The fourth source fixes double reservation: record-store snapshots already
include the final journal reservation, so the runner only adds its separate
bounded terminal-envelope reserve. A near-capacity fixture discriminates this
case. Source-map/module integration and focused strict typing are still pending
the complete process module pin. Full runner source review is also pending.
