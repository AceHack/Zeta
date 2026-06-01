# `docs/inventory/` — operator-owned hardware + asset inventory substrate

In-repo inventory data backing B-0836 (hardware-inventory-vs-cluster reconciliation).

## What lives here

| File | Origin | Cadence |
|---|---|---|
| `hardware-2026-05-27-addison-draft.md` | Addison's draft hardware audit | One-off; replaced on next audit |
| `hardware-to-buy.md` | Procurement shortlist (FPGA open-bitstream + agent key-storage HSM/TPM) | Living; updated as buying decisions are made (B-0836 "no more buying willy nilly") |

Composes with:

- `tools/inventory/amazon-orders-extract.ts` — Amazon order-history extractor (operator-driven; outputs to `~/.local/share/zeta-inventory/amazon/<year>/`; NOT in repo per personal-account scope)
- B-0836 — hardware-inventory-vs-cluster reconciliation gap-analysis substrate
- B-0812 — iter-5.4.1 self-registration (the cluster side of the diff)

## Drafts vs canonical

Files suffixed `-draft.md` are work-in-progress snapshots from a contributor. Operator + Addison reconcile + promote to canonical (`hardware.md` / `gpus.md` / etc.) when complete.

## Not-in-this-folder

- Amazon order history → `~/.local/share/zeta-inventory/amazon/<year>/` (operator local; personal account data; never committed)
- Cluster-side node registrations → `maintainers/<op>/cluster-nodes/<host>/node.yaml` per B-0812 substrate
- Financial assets / hardware-wallet contents → out of scope; not for this directory
