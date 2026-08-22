# `docs/inventory/` — operator-owned hardware + asset inventory substrate

In-repo inventory data backing 081KSGS9H0008QG0R001VVEZQ9 (hardware-inventory-vs-cluster reconciliation).

## What lives here

| File | Origin | Cadence |
|---|---|---|
| `hardware-2026-05-27-addison-draft.md` | Addison's draft hardware audit | One-off; replaced on next audit |
| `hardware-to-buy.md` | Procurement shortlist (FPGA open-bitstream + agent key-storage HSM/TPM) | Living; updated as buying decisions are made (081KSGS9H0008QG0R001VVEZQ9 "no more buying willy nilly") |

Composes with:

- `tools/inventory/amazon-orders-extract.ts` — Amazon order-history extractor (operator-driven; outputs to `~/.local/share/zeta-inventory/amazon/<year>/`; NOT in repo per personal-account scope)
- 081KSGS9H0008QG0R001VVEZQ9 — hardware-inventory-vs-cluster reconciliation gap-analysis substrate
- 081KSGS9H0008QG0R0037H3W4T — iter-5.4.1 self-registration (the cluster side of the diff)

## Drafts vs canonical

Files suffixed `-draft.md` are work-in-progress snapshots from a contributor. Operator + Addison reconcile + promote to canonical (`hardware.md` / `gpus.md` / etc.) when complete.

## Not-in-this-folder

- Amazon order history → `~/.local/share/zeta-inventory/amazon/<year>/` (operator local; personal account data; never committed)
- Cluster-side node registrations → `maintainers/<op>/cluster-nodes/<host>/node.yaml` per 081KSGS9H0008QG0R0037H3W4T substrate
- Financial assets / hardware-wallet contents → out of scope; not for this directory
