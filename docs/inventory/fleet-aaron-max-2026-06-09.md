<!-- hardware-surface: class=declaration; probe-nodes=4; register=inventory/items/ -->

# Fleet inventory — Aaron + Max (declared, 2026-06-09)

> **Provenance class: DECLARATION** — what the operator *says* is deployed, consent-only, never
> scanned. It is not the probe surface and it is not the register. `probe-nodes` in the header above
> is the number of self-registrations this doc accounts for;
> `bun src/Core.TypeScript/inventory/reconcile-surfaces.ts` fails when a node registers and this doc
> has not been updated — which is exactly how the "Max — not yet self-registered" line below went
> stale for two months.

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
- **Self-registered 2026-06-14** (this line said "not yet self-registered" until 2026-08-16; the
  subtree had existed for two months — corrected under 081M00R59KS087G0R001W3837V). The
  `maintainers/maximdolphin/cluster-nodes/` subtree carries **two** registrations,
  `node-5b2dfa` (22:20:16Z) and `node-f82aa6` (17:10:55Z), both `Intel Core Ultra 9 185H`,
  both `registered-via: 081KSKBP80008QG0R000GPC0TB.2-postboot`.
  **Both report the same MAC `b0:41:6f:17:87:cc`**, so the two registrations are not two machines.
  Which of the two readings holds is Max's to say and is not inferred here: either one machine
  re-registered under a fresh node id after a rebuild (the declared fleet is right at 1× mini-PC and
  the probe surface over-counts), or a second machine's manifest was copied and its hardware block
  is wrong. Held open as `HWR-2` in `inventory/reconciliation-open.json`.

## Shared shape

Both operators run the **same hardware family** (mini-PC 15 (Aaron) / 14 (Max) + NVIDIA eGPU + remote-power +
Comet) — a clean, near-symmetric two-site fleet, which is exactly what makes the **Aaron ⊗ Max federation** (#7245)
and the **hardware-onboard blueprint** (#7269) easy to validate: nearly-identical hardware, two operators, two sites.

## Maintenance

Edit via the **`hardware-onboard` blueprint** (add/edit/remove/update, #7269). Node specifics auto-update from
self-registration; declared gear (eGPU models, Comet IPs, "extra stuff") is updated here by the operator. Day
0/1/2/100 lifecycle per the network-map doc.
