# B-0590 Slice 5: OS Choice Options

## Objective
Evaluate and select the optimal OS choice for the 20-machine Otto fleet.

## Options

### 1. NixOS (Declarative-fleet)
- **Pros:** Completely declarative configuration. Excellent for maintaining identical state across 20 machines.
- **Cons:** Steeper learning curve, potentially harder for the swarm to auto-repair if derivation fails.

### 2. Debian/Ubuntu (Pragmatic)
- **Pros:** Standard, predictable. Easy to script via `bash` or `ansible`. Huge community support and agent familiarity.
- **Cons:** Imperative configuration can lead to configuration drift across the 20 nodes over time.

### 3. Talos (k8s-only)
- **Pros:** Minimal OS, API-driven, designed specifically for Kubernetes. Perfect if we are moving towards a K8s swarm architecture.
- **Cons:** Locks us entirely into the Kubernetes ecosystem, which may overcomplicate pure Otto KVM tasks.

### 4. Proxmox (VM-per-Otto)
- **Pros:** Excellent for virtualization. Allows segmenting Otto into discrete VMs and snapshotting perfectly.
- **Cons:** Heavier overhead, adds a hypervisor layer which may complicate pure bare-metal tasks and GPU passthrough (though OCuLink support exists).

## Recommendation Draft
Pending multi-agent review, **Debian/Ubuntu** offers the highest pragmatic velocity for immediate deployment, paired with rigorous state scripts to prevent drift. However, **Proxmox** remains a strong contender if we require rapid rollback via snapshots.
