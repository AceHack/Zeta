# 081KQZVQW0008QG0R001FG05RZ Stronger-Source Escalation Gate - 2026-05-30

## Status

This packet adds the first incident-grade gate on top of the 081KQZVQW0008QG0R001FG05RZ
coincidence-window classifier.

## Context

The previous queue-drain calibration showed that the remaining top live windows
were prior-day Codex/Otto merged-PR adjacency. That is useful runway-pressure
evidence, but it is not enough by itself to call a current shared-upstream
incident.

## Change

- Pure merged-PR adjacency remains a `coincidence` warning plus compact
  `coincidence-debug` detail.
- A coincidence window now emits a `coincidence-incident` critical signal only
  when a stronger source is present.
- Incident-grade windows also emit `coincidence-incident-debug`, so the stronger
  source event ids are visible even when the top overall windows are still pure
  merged-PR adjacency.
- The current stronger-source set is explicit and bounded:
  `loop-run`, `claim-mutation`, `pr-review-blocker`, `failed-gate`, and
  `broadcast-blocker`.
- Existing event ids still infer source class, so the current loop-run claim
  increase source can escalate without changing its event payload shape.

## Verification

Focused checks:

```bash
bun test tools/health/factory-health-monitor.test.ts
bun tools/health/factory-health-monitor.ts --json
bun run typecheck
bun run lint:markdown docs/trajectories/autonomous-loop-coordination/b0250-stronger-source-escalation-gate-2026-05-30.md docs/trajectories/autonomous-loop-coordination/RESUME.md
git diff --check
```

The live monitor now reports both the overall coincidence debug line and a
separate `coincidence-incident-debug` line for the stronger-source windows.

## Next Slice

Add a bounded claim/PR blocker source join so review blockers and failed gates
can participate in the same escalation gate without relying on the local
broadcast bus.
