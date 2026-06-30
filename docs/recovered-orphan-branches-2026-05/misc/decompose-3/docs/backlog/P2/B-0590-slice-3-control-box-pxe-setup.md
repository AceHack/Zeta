---
id: B-0590-slice-3
priority: P2
status: open
title: "B-0590 Slice 3 — Control box setup: PXE + DHCP + HTTP for installer serving"
tier: factory-infrastructure
effort: M
created: 2026-05-17
last_updated: 2026-05-17
depends_on: [B-0590-slice-2]
tags: [fleet, replication, bare-metal, pxe, control-box]
type: feature
---

# B-0590 Slice 3 — Control box setup (PXE + DHCP + HTTP)

## Origin
Peeled from the B-0590 blob (20-machine Otto fleet replication).
Slice 3 focuses specifically on setting up the control box that will drive the bare-metal installations for the fleet.

## Scope
1. Provision a small control box (e.g., one of the Beelink mini-PCs).
2. Configure a DHCP server (`isc-dhcp-server` or `dnsmasq`).
3. Set up a TFTP server for initial boot images.
4. Set up an HTTP server to serve the OS installer and cloud-init configurations.

## Acceptance Criteria
- [ ] Control box is provisioned and reachable.
- [ ] DHCP server hands out IPs and points PXE clients to TFTP.
- [ ] TFTP server successfully serves bootloader (e.g., iPXE or GRUB).
- [ ] HTTP server successfully serves OS images and preseed/cloud-init files.

## Next Steps
Once this slice is complete, we move to Slice 4 (OS choice decision) and Slice 5 (Bare-metal install automation script).