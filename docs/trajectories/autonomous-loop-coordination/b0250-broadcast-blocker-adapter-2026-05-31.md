# 081KQZVQW0008QG0R001FG05RZ Broadcast Blocker Adapter - 2026-05-31

## Status

Prepared as a bounded 081KQZVQW0008QG0R001FG05RZ source adapter slice.

## Provenance

- Surface: codex-background-service
- Origin: codex-launchd-loop
- Claim Run ID: 20260531T024926Z

## Change

`tools/health/factory-health-monitor.ts` now has a bounded structured local-bus
adapter for explicit broadcast blockers.

The adapter:

- reads optional JSON envelopes from the configurable local bus directory
  (`FACTORY_HEALTH_BROADCAST_BUS_DIR`, then `ZETA_BUS_DIR`, then
  `/tmp/zeta-bus`);
- caps the scan at the newest 200 `.json` envelopes;
- only converts envelopes with explicit `payload.blockers[]` or
  `payload.blocker` records;
- requires a non-empty blocker `trajectory`;
- requires a valid event time from `blocker.occurredAt`, `blocker.observedAt`,
  or the envelope timestamp;
- skips expired envelopes and events outside the 081KQZVQW0008QG0R001FG05RZ lookback window;
- emits `CoincidenceEvent` values with source `broadcast-blocker`.

Free-form markdown broadcast notes remain coordination input only. They do not
become coincidence events.

## Verification

Focused checks:

```bash
bun test tools/health/factory-health-monitor.test.ts
git diff --check
```

## Next Bounded Slice

Run the live monitor after this branch is ready to confirm that the optional
local-bus reader is quiet when no structured blocker envelopes exist, and emits
only incident-grade `broadcast-blocker` windows when a fresh structured blocker
joins another trajectory event.
