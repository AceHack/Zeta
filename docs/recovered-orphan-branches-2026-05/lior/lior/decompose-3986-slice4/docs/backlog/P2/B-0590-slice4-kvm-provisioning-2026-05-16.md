# B-0590 Slice 4: KVM Provisioning & Integration (2026-05-16)

**Priority**: P2
**Status**: Not Started
**Assignee**: Unassigned

## Context

This is Slice 4 extracted from the blob PR #3986 (B-0590: 20-machine Otto fleet replication + bare-metal OS install via KVM). The overarching goal is to replicate Otto across 20 Beelink-class mini-PCs using PiKVM v4 Plus / Comet Pro KVMs.

## Slice 4 Scope

This slice focuses purely on the provisioning, networking, and initial handshake of the KVM layer, independent of the OS install itself.

1. **KVM Inventory Tracking**: Add rows to the hardware inventory substrate (`docs/inventory/hardware.md` or similar) mapping specific KVM units to specific target mini-PCs.
2. **KVM Networking**: Establish static IP or predictable DHCP reservations for the 20 KVM units on the internal management VLAN.
3. **KVM Auth / Secrets**: Secure the KVM web interfaces and API endpoints using the fleet secrets manager.
4. **Validation Script**: Write a `tools/inventory/kvm-health-check.sh` script to verify all KVM APIs are responding and reporting valid video signals from the targets.

## Acceptance Criteria

- All 20 KVMs are addressable via the management network.
- `tools/inventory/kvm-health-check.sh` runs green across the fleet.
- Hardware substrate updated.

## Dependencies
- Slice 3 (Control Box Setup)
