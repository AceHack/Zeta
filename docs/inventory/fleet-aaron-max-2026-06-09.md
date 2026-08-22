# Fleet inventory — Aaron + Max (declared, 2026-06-09)

The first **declared-hardware** entry for the Zeta hardware network map
([`../research/2026-06-09-zeta-hardware-network-map-...`](../research/2026-06-09-zeta-hardware-network-map-consent-only-self-registration-plus-declared-never-scan-comet-kvm-plus-nodes-hardware-onboard-blueprint-day-0-1-2-100.md)).
**Consent-only / declared** — node specifics come from self-registration (`node.yaml`); the fleet view + the
non-self-registering gear (eGPUs, Comets, remote-power) are **declared here by the operator**, never scanned. IPs/
secrets are NOT in this doc (secure-with-internals-known applies, but the live IPs live in the self-registration
manifests, not a flat file).

## Aaron's fleet

- **2× mini-PC, 15-series** (per the self-registered node: Intel Core Ultra 9 285H, 66G, Arc Pro 140T iGPU,
  `/dev/nvme0n1 931.5G`) — the two self-registered nodes:
  - **node-ad1efd** (`maintainers/Addisons820/cluster-nodes/node-ad1efd`) — control-plane (registered #7237)
  - **node-b1e1b5** (`maintainers/Addisons820/cluster-nodes/node-b1e1b5`) — registered #7240
  - *(both registered under Addison's account; Addison set the cluster up — see ACHIEVEMENTS)*
- **NVIDIA eGPUs** — hooked to the mini-PCs (model differs from Max's).
- **Remote-power ("remote fingers")** on each.
- **GL.iNet Comet KVM(s)** (`cosmos pro` / GL-RM1) — declared; IPs added via the hardware-onboard blueprint.
- **Some extra stuff** (Aaron — to be enumerated when declared).

## Max's fleet

- **1× mini-PC, 14-series** (same hardware family as Aaron's, one generation back).
- **NVIDIA eGPU** — different model from Aaron's.
- **Remote-power ("remote fingers")** + **GL.iNet Comet KVM**.
- **Not yet self-registered** — when Max boots his house cluster on his `maximdolphin` creds, a
  `maintainers/maximdolphin/cluster-nodes/` subtree appears (the federation goes live, #7245/#7260).

## Shared shape

Both operators run the **same hardware family** (mini-PC 15 (Aaron) / 14 (Max) + NVIDIA eGPU + remote-power +
Comet) — a clean, near-symmetric two-site fleet, which is exactly what makes the **Aaron ⊗ Max federation** (#7245)
and the **hardware-onboard blueprint** (#7269) easy to validate: nearly-identical hardware, two operators, two sites.

## Maintenance

Edit via the **`hardware-onboard` blueprint** (add/edit/remove/update, #7269). Node specifics auto-update from
self-registration; declared gear (eGPU models, Comet IPs, "extra stuff") is updated here by the operator. Day
0/1/2/100 lifecycle per the network-map doc.
