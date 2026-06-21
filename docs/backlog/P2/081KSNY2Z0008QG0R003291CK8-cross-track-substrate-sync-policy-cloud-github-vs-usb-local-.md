---
id: 081KSNY2Z0008QG0R003291CK8
priority: P2
status: open
title: Cross-track substrate-sync policy — cloud-GitHub vs USB-local-GitLab; intentional divergence vs auto-sync-via-push-to-both-remotes vs hybrid
effort: M
ask: otto pushback on parallel-tracks design 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R0034FR5FG
  - 081KSNY2Z0008QG0R002A785QR
composes_with:
  - 081KSNY2Z0008QG0R0034FR5FG
  - 081KSNY2Z0008QG0R002A785QR
  - 081KSNY2Z0008QG0R0011XCT94
  - 081KSNY2Z0008QG0R001DFZK4V
tags:
  - cross-track-substrate-sync-policy
  - cloud-github-vs-usb-local-gitlab-parallel-tracks
  - intentional-divergence-vs-auto-sync-decision
  - prevents-substrate-drift-over-time
  - composes-with-isomorphic-cross-host-property
  - composes-with-asap-cluster-umbrella
  - otto-pushback-from-evaluative-response
---

## What this row tracks

Name + resolve the cross-track substrate-sync question that 081KSNY2Z0008QG0R0034FR5FG ASAP cluster umbrella doesn't currently address: when work happens on cloud-GitHub track, when/how does it sync to USB-local-GitLab track (and vice versa)?

Without explicit policy, the parallel tracks risk substrate-drift over time even though the isomorphic-cross-host property (081KSNY2Z0008QG0R002A785QR) makes them codebase-identical at the substrate level. Drift could happen at:

- Event log (events on one track not on the other)
- Playbook documents (drift)
- Rule updates (one track ahead)
- Per-host adapter behavior diverging
- Operator's mental model of which track is canonical for which substrate class

## Otto pushback context (operator 2026-05-28)

> *"what do you think of that design we can run usb local gitlib and cloud github in parallel tracks"*

Otto evaluative response identified this as scoping gap:

> "Cross-track substrate-sync is unnamed. If Otto develops on cloud-GitHub, when/how does it sync to USB-local-GitLab? Could be 'intentional divergence' or 'auto-sync via push-to-both-remotes' — but it needs an answer or substrate drifts over time."

## Candidate policies (to evaluate in design memo)

| Policy | Mechanism | Trade-off |
|---|---|---|
| **Intentional divergence** | Tracks are independent; substrate accretes per-track; no auto-sync | Maximum vendor-independence; substrate drifts over time; manual reconciliation when needed |
| **Auto-sync via push-to-both-remotes** | Every push goes to both GitHub + GitLab; substrate stays unified | Minimum drift; but couples the tracks; loses some failure-isolation property |
| **Authoritative-canonical-track + replica** | One track designated canonical; other auto-syncs from canonical | Clear canonical state; but loses parallel-track-equality framing |
| **Per-substrate-class policy** | Different substrate classes have different sync policies (e.g., rules auto-sync; private state per-track-only; tick shards both-tracks) | Substrate-honest about which classes need unity vs divergence; more complex policy |
| **Operator-initiated sync** | Sync happens only when operator explicitly triggers; no automatic mechanism | Maximum operator-control; manual overhead; risk of forgetting |

## Acceptance criteria

- `docs/research/2026-XX-XX-cross-track-substrate-sync-policy.md` design memo that:
  - Evaluates the 5+ candidate policies above (plus any others surfaced)
  - Decides one (or hybrid)
  - Articulates the chosen policy's mechanism, failure modes, recovery procedures
  - Updates 081KSNY2Z0008QG0R0034FR5FG umbrella to reference the chosen sync policy
- If chosen policy is operational (vs purely documentary), files implementation sub-rows
- `.claude/rules/cross-track-substrate-sync.md` if discipline-grade

## Composition

- **081KSNY2Z0008QG0R0034FR5FG** (parent ASAP cluster umbrella that owns parallel-tracks framing)
- **081KSNY2Z0008QG0R002A785QR** (per-host adapters that make isomorphic property hold; sync policy operates ON the isomorphic substrate)
- **081KSNY2Z0008QG0R0011XCT94** (zflash credential substrate per-track; potentially affected by sync policy)
- **081KSNY2Z0008QG0R001DFZK4V** (Zeta-native review substrate that has trajectory event logs to sync OR not)

## Substrate-honest framing

POTENTIAL design row per operator standing direction. P2; M effort because the decision space is non-trivial + the operational implications are substantial.

The row's deliverable is the CHOICE of sync policy, not the implementation. Implementation rows file from the choice.

## Full reasoning

Otto evaluative response on operator's "what do you think of that design" 2026-05-28 — pushback item #4 of 4.
