---
id: B-0671
priority: P2
status: open
title: "OS choice decision: NixOS vs Debian/Ubuntu vs Talos; rationale documented"
tier: factory-infrastructure
effort: S
created: 2026-05-19
last_updated: 2026-05-19
depends_on: [B-0590]
tags: [fleet, os-choice, bare-metal, nixos, debian, talos]
type: chore
---

# OS choice decision: NixOS vs Debian/Ubuntu vs Talos

## Summary
Decomposed from B-0590 (20-machine Otto fleet replication). This slice isolates the OS selection decision required for the 20-machine fleet.

## Scope
Evaluate and document the rationale for choosing between:
- **NixOS**: Declarative, reproducible fleet config ("substrate is the spec")
- **Debian / Ubuntu Server**: Pragmatic, well-documented, standard tooling
- **Talos Linux**: Minimal Kubernetes-only OS
- **Proxmox**: VM-per-Otto at the host level

## Acceptance Criteria
- [ ] OS choice for the 20-machine fleet is made and explicitly documented.
- [ ] Rationale for the chosen path is recorded (referencing Zeta's operational parameters).
