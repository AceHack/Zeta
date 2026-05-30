# B-0250 Event-Window Source Receipt - 2026-05-30

## Scope

This packet adds the first bounded event-window source for B-0250 coincidence
detection. It is intentionally pure: callers pass observed trajectory events
in, and the monitor classifies whether two or more trajectories emitted inside
the configured window.

## Landed Surface

- `CoincidenceEvent` records event id, trajectory, and event time.
- `findCoincidenceWindows` sorts valid events, applies the bounded time
  window, requires at least two distinct trajectories, and returns deterministic
  coincidence windows.
- `classifyCoincidenceWindows` converts windows into `coincidence` health
  signals.
- `buildCoincidenceWindowTriggerSource` exposes that classifier as a reusable
  standing-query source without adding a new live event reader yet.

## Verification

- Deterministic tests cover cross-trajectory coincidence detection.
- Same-trajectory clusters do not count as coincidences.
- Invalid timestamps are ignored rather than breaking the source.
- The standing-query source wrapper returns bounded warnings through the
  existing source interface.

## Follow-Up

The next B-0250 packet should attach a real factory event observation source,
then feed those observations through this classifier. Candidate sources are
loop-run receipts, PR merge timestamps, or trajectory receipt creation times.
