---
id: B-0670
priority: P2
status: open
title: "B-0590 Slice 3: Control box setup — PXE + DHCP + HTTP for bare-metal installer serving"
tier: factory-infrastructure
effort: M
created: 2026-05-19
last_updated: 2026-05-19
depends_on: []
composes_with: [B-0590]
tags: [fleet, replication, bare-metal, pxe, dhcp, control-box]
type: feature
---

# B-0590 Slice 3: Control box setup

Decomposed from B-0590.

## Objective

Set up a dedicated control box (e.g., a small Beelink mini-PC) to serve as the PXE boot infrastructure for the 20-machine Otto fleet.

## Scope
- Install and configure a DHCP server (`isc-dhcp-server` or `dnsmasq`).
- Install and configure a TFTP server for initial boot images.
- Set up an HTTP server for installer + cloud-init configs.
- Provide a simple "fleet manager" script to hold per-machine cloud-init configs.

## Substrate Validation
This creates the necessary infrastructure for unattended bare-metal OS installation across the 20-machine fleet, avoiding the tedious virtual-media approach.
