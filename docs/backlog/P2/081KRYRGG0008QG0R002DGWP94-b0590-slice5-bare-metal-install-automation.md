---
id: B-0672
zetaid: 081KRYRGG0008QG0R002DGWP94
priority: P2
status: open
title: "B-0590 slice 5: Bare-metal install automation"
tier: factory-infrastructure
effort: M-L
created: 2026-05-19
last_updated: 2026-05-19
depends_on: [B-0590, B-0671]
composes_with: [B-0590]
tags: [fleet, bare-metal, automation, os-install]
type: feature
---

# B-0590 slice 5: Bare-metal install automation

## Origin

Peeled off from the B-0590 blob by Maji/Lior decomposition process.

## Scope

Bare-metal install automation: cloud-init / preseed / nixos-anywhere config that installs OS + Otto in one pass.
This slice operationalizes the OS choice decision from B-0671 (slice 4).

## Success criteria

- Bare-metal install pipeline working.
- Auto-installs OS + Otto onto a fresh machine.
- Zero manual touches after rack.

## Composes with

- B-0590 (main fleet replication row)
- B-0671 (OS choice decision)
