---
id: 081KRYRGG0008QG0R002DGWP94
priority: P2
status: open
title: "081KRQ1AB0008QG0R002G93CM7 slice 5: Bare-metal install automation"
tier: factory-infrastructure
effort: M-L
created: 2026-05-19
last_updated: 2026-05-19
depends_on: [081KRQ1AB0008QG0R002G93CM7, 081KRYRGG0008QG0R003CF4DH5]
composes_with: [081KRQ1AB0008QG0R002G93CM7]
tags: [fleet, bare-metal, automation, os-install]
type: feature
---

# 081KRQ1AB0008QG0R002G93CM7 slice 5: Bare-metal install automation

## Origin

Peeled off from the 081KRQ1AB0008QG0R002G93CM7 blob by Maji/Lior decomposition process.

## Scope

Bare-metal install automation: cloud-init / preseed / nixos-anywhere config that installs OS + Otto in one pass.
This slice operationalizes the OS choice decision from 081KRYRGG0008QG0R003CF4DH5 (slice 4).

## Success criteria

- Bare-metal install pipeline working.
- Auto-installs OS + Otto onto a fresh machine.
- Zero manual touches after rack.

## Composes with

- 081KRQ1AB0008QG0R002G93CM7 (main fleet replication row)
- 081KRYRGG0008QG0R003CF4DH5 (OS choice decision)
