# 081KQZVQW0008QG0R001FG05RZ Compact Debug Surface Receipt - 2026-05-30

## Status

Landed in claim branch `claim/codex-b0250-debug-surface-20260530`.

## Change

The factory health monitor now emits a bounded `coincidence-debug` signal when
081KQZVQW0008QG0R001FG05RZ event-window coincidences are present. The debug signal keeps the
existing count signal intact and adds a compact list of the first few windows:
window range, capped trajectory set, and capped `trajectory:event-id` members.

## Why

The coincidence count alone shows that a shared-cause window exists, but it does
not show which source adapters contributed to the remaining noise. The compact
debug line lets the next loop inspect the top windows from ordinary
`factory-health-monitor.ts --json` output instead of manually reading raw event
JSON or reconstructing the join by hand.

## Limits

The debug output is deliberately capped by window count, trajectory count per
window, and event count per window. It is a triage surface, not a full audit
export. If the capped line points at a suspicious source mix, a later packet can
add a fuller source-specific report.

## Next Slice

Use the compact window lines to decide whether the next 081KQZVQW0008QG0R001FG05RZ step should tune
an existing source, add local dirty-worktree events, or split lifecycle events
into separate correlation classes.
