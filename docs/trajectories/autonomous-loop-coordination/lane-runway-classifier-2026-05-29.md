# Lane-Runway Classifier Receipt - 2026-05-29

Status: pure classifier source slice landed
Surface: codex-background-service
Origin: codex-launchd-loop
Session: codex/launchd-loop
Run ID: 20260529T211141Z
Claim: `claim/codex-loop-lane-runway-classifier-20260529`
(claim file released in this PR)
Grounding backlog:
`docs/backlog/P0/081KQZVQW0008QG0R000C35RNY-autonomous-backlog-pickup-self-sustaining-new-work-2026-05-07.md`
and
`docs/backlog/P1/081KQZVQW0008QG0R001FG05RZ-coincidence-detection-rx-join-dora-mechanism-2026-05-07.md`
Parent receipt:
`docs/trajectories/autonomous-loop-coordination/standing-query-trigger-inventory-2026-05-29.md`

## Scope

This packet wires the first reusable lane-runway signal as TypeScript. The
classifier itself is pure; the health monitor adapter feeds it from the
existing open-PR queue observation plus the remote claim-branch observation. It
does not mutate loop state or treat local broadcast files as authority.

The classifier is intentionally small: it maps branch and claim names onto the
named factory lanes, then emits deterministic health signals for active,
quiet, and unhealthy lanes. Runtime adapters can feed it open PR branch names,
remote claim branch names, and service health booleans without changing the
classification rule.

## Rule

`tools/health/factory-health-monitor.ts` now exports:

| Export | Purpose |
|---|---|
| `classifyBranchLane` | Maps branch prefixes to `codex`, `otto`, `lior`, `alexa`, `riven`, or `other`. |
| `classifyLaneRunway` | Counts open PRs and active claims by lane, then emits `lane-runway` health signals. |
| `LaneRunwaySnapshot` | Input shape for future monitor adapters: open PR branches, active claim branches, and optional service health. |

Known branch families covered in this slice:

- Codex: `codex/*`, `claim/codex-*`
- Otto: `otto/*`, `otto-cli/*`, `otto-bg-worker/*`, `otto-desktop/*`,
  `otto-vscode/*`, `claim/otto-*`
- Lior: `lior/*`, `lior-*`, `claim/lior-*`
- Alexa/Kiro: `alexa/*`, `kiro/*`, `claim/alexa-*`, `claim/kiro-*`
- Riven: `riven/*`, `riven-*`, `claim/riven-*`

Branches outside those families stay in `other` and produce a warning when
they have open PR or active claim runway.

## Verification

Focused tests in `tools/health/factory-health-monitor.test.ts` cover:

- known branch-prefix lane mapping
- active vs quiet named lanes
- unhealthy quiet lanes
- unclassified `other` branch and claim warnings

The verification surface is pure and deterministic, so it can be extended
before the monitor grows new side-effecting adapters.

## Next Step

Feed the classifier service-health booleans from the host-loop health probes.
Keep that adapter as a separate bounded slice so this receipt remains the
branch/claim runway baseline.
