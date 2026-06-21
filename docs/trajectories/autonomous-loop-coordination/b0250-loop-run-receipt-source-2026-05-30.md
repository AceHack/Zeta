# 081KQZVQW0008QG0R001FG05RZ Loop-Run Receipt Source - 2026-05-30

## Scope

This packet wires a third 081KQZVQW0008QG0R001FG05RZ factory event observation source into the
coincidence detector. The source is the local Codex loop runner log when it is
present on the machine running the factory health monitor.

## Landed Surface

- `loopRunReceiptEventsFromRunnerLog` converts Codex forward-gate completion
  lines into bounded `CoincidenceEvent` values.
- The adapter emits one event per completed Codex forward gate and ignores
  heartbeat-only lines, start lines, invalid timestamps, future entries, and
  entries outside the configured lookback window.
- The factory health monitor joins loop-run events with merged PR and
  trajectory receipt events before running the same coincidence window
  classifier.
- Missing local runner logs are treated as an absent optional source, not a
  health failure.

## Behavior

The adapter reads `~/Library/Logs/zeta-codex-loop/runner.log` by default, or
`FACTORY_HEALTH_CODEX_LOOP_RUNNER_LOG` when set. It only accepts
`codex forward gate end` lines, so per-minute heartbeat noise does not create
continuous Codex events that would swamp the coincidence window.

## Verification

- Deterministic tests cover loop-run event extraction.
- Deterministic tests cover heartbeat-line filtering, start-line filtering,
  stale filtering, future filtering, and invalid-line filtering.
- Existing coincidence-window tests cover cross-trajectory joins.

## Follow-Up

After this source lands, inspect live factory health reports for excessive
coincidence noise. If forward-gate events are still too frequent, narrow the
source further to gate completions that publish a claim or PR update.
