# Trajectory - Alignment Measurement

Status: active child packet
Last refreshed: 2026-05-07
Parent trajectory: `docs/trajectories/factory-trajectory-surface/RESUME.md`
Grounding backlog: `docs/backlog/P3/081KQTPYE0008QG0R000ZJ2GW8-multi-trajectory-validation-basis-instrumentation-aaron-2026-05-05.md`

## Why This Exists

The factory needs longitudinal alignment measurement, not single-axis velocity
claims. 081KQTPYE0008QG0R000ZJ2GW8 names the measurement basis: DORA, less-each-time,
falsifiability rate, bootstrap-razor pass rate, identity-preservation
trajectory, and engagement-gate compliance.

This child packet keeps that work in a bounded lane. The lane is measurement
substrate, not a merge gate and not a giant implementation branch.

## Current Rule

Measure evidence, not intent. Each axis needs a proxy that can be extracted
from committed substrate or durable host records. If an axis cannot yet produce
a measurable proxy, that is evidence about the axis, not a reason to invent a
story.

The basis is respected, not reverenced. If two axes correlate too strongly, the
axis split is suspect and must be refined.

## Current Next Action

Create the first proxy-definition table for the six axes. This is a
decomposition step before implementation:

```text
axis -> data source -> extraction rule -> output shape -> known gap
```

The first slice should land the table and no scripts. Scripts come after the
proxy definitions are crisp enough to test.

## Candidate Atomic Children

- proxy-definition table for all six axes, grounded in 081KQTPYE0008QG0R000ZJ2GW8 acceptance
  criterion (a)
- DORA extraction skeleton from git/GitHub merge history
- engagement-gate compliance extraction skeleton from substantive-claim
  landings
- bootstrap-razor pass-rate extraction skeleton from 081KQTPYE0008QG0R00392KABJ once its harness
  substrate is available
- one-month basis-run report template with correlation-matrix placeholder

## Evidence Links

- `docs/backlog/P3/081KQTPYE0008QG0R000ZJ2GW8-multi-trajectory-validation-basis-instrumentation-aaron-2026-05-05.md`
- `docs/research/2026-05-05-claudeai-multi-axis-validation-basis-cover-our-basis-double-pun-aaron-forwarded-preservation.md`
- `docs/research/2026-05-05-claudeai-cs-is-not-cs-scale-free-in-time-ossified-framework-diagnosis-aaron-forwarded-preservation.md`
- `docs/research/2026-05-05-claudeai-girard-mimetic-theory-zeta-closes-thiel-hsieh-failure-mode-dora-correction-aaron-forwarded-preservation.md`
- `docs/ALIGNMENT.md`

## Out Of Scope

- No dashboard.
- No CI gate.
- No full automation.
- No claim that the six-axis basis is final.

This packet exists to make the next measurement move claimable and testable.
