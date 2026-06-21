---
id: 081KSGS9H0008QG0R000EDNTY5
priority: P1
status: open
title: Role-as-capability-composition (NOT baked host) — a single node can be control-plane AND gpu-worker AND storage simultaneously; refactor nixos/hosts/{role}/configuration.nix → composable nixos/modules/role-*.nix capability modules; iter-5.2 hostname injection (081KSGS9H0008QG0R003V23XNZ) is partial fix at hostname scope but role-stack-as-baked-host-config remains the architectural blocker
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R003V23XNZ
composes_with:
  - 081KSE6WT0008QG0R002275NDE
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSGS9H0008QG0R00153CQ8B
tags: [architecture, role-as-capability, multi-role-node, refactor, nixos-modules, flake-config, composition, homelab, cluster-bringup]
---

## Problem

The maintainer 2026-05-26 surfaced the architectural concern during iter-5 substrate-engineering for multi-node cluster bring-up:

> *"since our different roles are multi install you can be control plane AND gpu node AND cpu node these distinctions are not very eleglant [sic] and host names tied to them are not great either."*

iter-5.2 (081KSGS9H0008QG0R003V23XNZ, PR #5103) partially addressed this by decoupling **hostname** from role-stack — operator can pass `--host pikachu` and get hostname `pikachu` regardless of which flake config the node was installed from. But the deeper architectural issue remains: **role-stack itself is baked into per-host flake configs**, making multi-role composition (one node = control-plane AND gpu-worker AND storage simultaneously) require an explosion of pre-baked configs.

Today's flake.nix structure:

```nix
nixosConfigurations = {
  installer = ...;
  control-plane = mkSystem { modules = [./nixos/hosts/control-plane/configuration.nix]; };
  worker-gpu = mkSystem { modules = [./nixos/hosts/worker-gpu/configuration.nix]; };
  worker-template = mkSystem { modules = [./nixos/hosts/worker-template/default.nix]; };
};
```

Each `hosts/{role}/configuration.nix` is a UNIT bundling:

- K3S role config (server vs agent vs both)
- Hardware capability config (GPU presence, NVME count, etc.)
- Workload affinity (control-plane services, GPU device-plugin, longhorn-disks)
- **And historically: hostname** (now fixed by iter-5.2 injection)

Result: you can't EASILY have a node that's BOTH control-plane AND gpu-worker AND storage. You'd need a combined config like `control-plane-with-gpu-and-storage` (config explosion as composition cardinality grows: 2^N).

## Target

Refactor toward **role-as-capability composition**:

| Today | Target |
|---|---|
| `nixos/hosts/control-plane/configuration.nix` | `nixos/modules/role-control-plane.nix` (just K3S server + Cilium + ArgoCD; NO hostname; NO hardware assumptions) |
| `nixos/hosts/worker-gpu/configuration.nix` | `nixos/modules/role-worker-gpu.nix` (just GPU stack + K3S agent; NO hostname) |
| `nixos/hosts/worker-template/default.nix` | `nixos/modules/role-worker-cpu.nix` (just K3S agent; NO hostname) |
| `flake.nix` named per-host configs | `flake.nix` `node = mkSystem { modules = [common + role-* selected at install time] };` |

The flake exposes ONE base `node` config; install-time `--role` flag(s) compose which `role-*.nix` modules apply. Examples:

```bash
zflash --host pikachu --role control-plane
# → Single role: control-plane only

zflash --host charizard --role worker-gpu,control-plane,storage
# → Triple role: control-plane + GPU worker + storage on same node
#   (CSV or repeated --role acceptable; arch decision)

zflash --host bulbasaur --role worker-cpu
# → Single role: CPU-only worker
```

zeta-install.sh reads role(s) from `zeta-roles.txt` on ESP (parallel pattern to `zeta-hostname.txt` from iter-5.2) → generates a tiny `node-roles.nix` module that imports the selected `role-*.nix` modules → `nixos-install --flake .#node`.

## Sub-targets

### Sub-target 1 — refactor existing per-host configs into per-role modules

- Extract hostname-free, hardware-free K3S-server bits from `nixos/hosts/control-plane/configuration.nix` → `nixos/modules/role-control-plane.nix`
- Extract GPU-worker bits from `nixos/hosts/worker-gpu/configuration.nix` → `nixos/modules/role-worker-gpu.nix`
- Extract CPU-worker bits from `nixos/hosts/worker-template/default.nix` → `nixos/modules/role-worker-cpu.nix`
- Audit for conflicting `lib.mkForce` / `services.foo.enable = true` declarations between roles; ensure they COMPOSE (e.g., a node with both control-plane + worker-gpu modules ends up with both K3S server AND GPU device plugin enabled)

### Sub-target 2 — single `node` flake config with module-set selection

- `flake.nix`: `node = mkSystem { modules = [./nixos/modules/common.nix ./nixos/modules/injected-hostname.nix ./nixos/modules/injected-roles.nix]; }`
- `nixos/modules/injected-roles.nix`: reads `/etc/zeta/cluster-node-roles` at NixOS eval time → imports matching `role-*.nix` modules
- Deprecate `nixosConfigurations.control-plane` / `worker-gpu` / `worker-template` (or keep as backward-compat aliases pointing to `node` with default role-set)

### Sub-target 3 — zflash `--role` flag(s) + zeta-install.sh reader

- `tools/zflash.ts`: add `--role <name>[,<name>...]` flag (or `--role` repeatable); validate against allowed-role list; write CSV to `zeta-roles.txt` on ESP
- `usb-nixos-installer/zeta-install.sh`: probe ESP for `zeta-roles.txt`; write to `/mnt/etc/zeta/cluster-node-roles` (similar to iter-5.2 hostname pattern)
- Default role: `control-plane` (preserves zero-typing single-node UX)

### Sub-target 4 — capability auto-detection (optional; iter-5.4+)

For homelab persona who doesn't want to think about roles:

- Detect GPU presence via `lspci | grep -i nvidia` → auto-add `worker-gpu` role
- Detect NVME count → auto-add `storage` role if >1 disks
- First-node default → auto-add `control-plane` role (else `worker-cpu`)
- Operator overrides via explicit `--role` always wins

### Sub-target 5 — Kubernetes node-labels mirror

Once a node has role-capability composition, mirror that into K8s node labels at K3S-agent-startup:

```yaml
node-labels:
  zeta.lucent-financial-group.com/role-control-plane: "true"
  zeta.lucent-financial-group.com/role-worker-gpu: "true"
  zeta.lucent-financial-group.com/role-storage: "true"
```

So K8s workload scheduling can use the same role taxonomy as the install-time composition.

## Acceptance

- [ ] **Sub-target 1**: existing `nixos/hosts/{role}/configuration.nix` decomposed into `nixos/modules/role-*.nix` capability modules with no hostname/hardware assumptions
- [ ] **Sub-target 2**: single `node` flake config composes role-modules at install time via injected file
- [ ] **Sub-target 3**: `zflash --role <name>[,<name>...]` flag works; `zeta-install.sh` reads + writes
- [ ] **Empirical multi-role**: install one node with `--role control-plane,worker-gpu,storage` → kubectl shows node with all three role-labels; node serves as control-plane AND runs GPU workloads AND participates in Longhorn storage
- [ ] **Sub-target 4** (deferred to iter-5.4+): capability auto-detection
- [ ] **Sub-target 5** (deferred): K8s node-labels mirror
- [ ] **Backward compat**: zero-typing `zflash` (no flags) still installs as control-plane with hostname `control-plane`

## Composes with substrate

- **081KSGS9H0008QG0R003V23XNZ** (iter-5 wifi + hostname injection; depends_on; this row picks up where 081KSGS9H0008QG0R003V23XNZ sub-target 4 deferred the role-stack decomposition)
- **081KSE6WT0008QG0R002275NDE** (simplest-first plugin sequence; composes; each plugin's "which roles need it" question becomes cleaner with role-as-capability)
- **081KSGS9H0008QG0R002T3BJ2R** (iter-4 SSH+password substrate; composes; same ESP-injection pattern)
- **081KSGS9H0008QG0R00153CQ8B** (zero-dev-machines cluster-native end-state; this row is load-bearing for multi-role nodes in the homelab persona's typical sub-3-node cluster)
- **081KSE6WT0008QG0R003G0Y62D** (first-time-CLI-user broadened to homelab persona; capability auto-detection in sub-target 4 is load-bearing for the no-CLI-typing experience)
- **081KSE6WT0008QG0R0004AP0ZA** (commodity hardware reference; this row composes with the curated hardware list — each hardware shape maps to a default role-set)

## Out of scope (for this row; tracked elsewhere)

- Cluster orchestration substrate selection (K3S vs Talos vs etc.) — tracked under 081KSE6WT0008QG0R002275NDE
- Worker join token / control-plane discovery — 081KSGS9H0008QG0R003V23XNZ sub-target 5; deferred
- Capability auto-detection implementation details — sub-target 4; deferred
- K8s node-label taxonomy schema — sub-target 5; deferred (depends on 081KSE6WT0008QG0R002275NDE cluster substrate selection)
- Resource isolation between co-located roles (cgroups; namespaces; QoS) — separate concern; track when needed

## Origin

The maintainer 2026-05-26 during iter-5.2 substrate-engineering response:

> *"also since our different roles are multi install you can be control plane AND gpu node AND cpu node these distinctions are not very eleglant and host names tied to them are not great either."*

iter-5.2 (081KSGS9H0008QG0R003V23XNZ, PR #5103) addressed the hostname-side concern (decoupled hostname from role-stack via injected-hostname.nix module + zflash --host flag). This row captures the deeper role-side concern: role-stack-as-baked-host-config is the remaining architectural blocker for true multi-role nodes.

Filing as P1 because:

1. **Load-bearing for homelab persona**: typical homelab cluster is 1-3 nodes; running multiple roles per node is standard practice (no dedicated control-plane in 3-node clusters; HA requires control-plane to also do worker duty)
2. **Composes with iter-5.2 cleanly**: same ESP-injection pattern as hostname; same NixOS-module-reads-injected-file pattern as injected-hostname.nix
3. **Substrate Aaron explicitly named**: not speculative; named architectural correction during active substrate-engineering session
4. **Blocks proper multi-node empirical test**: until this lands, second + third nodes have to be artificially pure-role (worker-only, no control-plane) to avoid the explosion-of-baked-configs problem

Per maintainer's broader 2026-05-26 *"going for right not fast"* discipline — this isn't optional; the role-as-capability architecture is the substrate-honest target.
