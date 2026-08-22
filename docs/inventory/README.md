# `docs/inventory/` — operator-owned hardware + asset inventory substrate

In-repo inventory data backing 081KSGS9H0008QG0R001VVEZQ9 (hardware-inventory-vs-cluster reconciliation).

## The surface map — six provenance classes and one projection, NOT copies of one list

Hardware inventory is spread across several places. The reason to keep them apart is that they are
different **provenance classes** with different change rates (DV2.0 #5): a probe result is what a
machine said about *itself*, a declaration is what the operator *says*, a snapshot is what someone
*counted on a day*, and the register is *identity*. Merging them would destroy the one property that
makes each worth reading. What was missing was not a merge — it was a **reconciliation**.

| surface | class | where | change rate | what it is |
|---|---|---|---|---|
| ZetaId register | `register` | `inventory/items/*.md` | slow (hub) | identity of record, one file per physical asset, git-as-database |
| published read-model | *derived* | `inventory/items.json` | follows the register | a **projection** of the register (`generate-items-json.ts`). Holds no fact of its own — but it is the only surface a reader actually sees |
| audit snapshot | `snapshot` | `hardware-2026-05-27-addison-draft.md` | one-off, immutable | what a human counted on a day; superseded wholesale, never edited |
| fleet declaration | `declaration` | `fleet-aaron-max-2026-06-09.md` | slow, hand-edited | what the operator *says* is deployed; consent-only, never scanned |
| procurement list | `wishlist` | `hardware-to-buy.md` | living | hardware we do **not** own — never an asset |
| self-registration | `probe` | `maintainers/*/cluster-nodes/*/node.yaml` | fast (per boot) | what a machine reported about itself |
| host key | `hostkey` | `machines/*.pub` | slow | SSH host-cert machine identity |

Adjacent but **not** an inventory surface: `docs/HARDWARE-CAPABILITY-MATRIX.md` is keyed by *target
class* (`linux-x64`, `qemu-aarch64`), not by asset. It is deliberately not reconciled here — a
class-keyed evidence table and an asset-keyed register share no key.

Also **not** in the map, on purpose: `~/.local/share/zeta-inventory/amazon/<year>/` (order history).
Better provenance data than a hand-typed list, and it stays off-repo — it is personal-account data
and the extractor is human-driven only.

## The reconciliation check

```bash
bun run inventory:reconcile      # report + fail on unaccounted divergence
bun run inventory:repin          # re-pin a snapshot header after an EDITORIAL edit
bun run inventory:items          # re-derive inventory/items.json from the register
bun run inventory:items-check    # fail if the published read-model is stale
```

`src/Core.TypeScript/inventory/reconcile-surfaces.ts` (081M00R59KS087G0R001W3837V). Every doc above
carries a one-line `<!-- hardware-surface: class=... -->` header declaring what it is; a hardware doc
in these paths without one fails, which is the guard against a *seventh* hand-maintained list
appearing the way the first six did. It runs as **drift, not a gate** — red is signal, not a block.

Divergences we deliberately hold open are ledgered in `inventory/reconciliation-open.json` with the
work-item that owns each. That ledger cannot rot: an entry whose finding **no longer reproduces**
fails the check, so a suppression cannot outlive its cause.

### HWR-7 — the projection is the one divergence that is never a difference of opinion

Every other invariant compares two surfaces that may legitimately disagree (the May audit predates
the June reboot). `inventory/items.json` is different in kind: it is *derived*, so any difference is
pure staleness and the repair is mechanical. It is also the surface that is actually **read** — the
Pages viewer fetches `items.json` and never opens an item file — which makes a stale projection the
one drift a human is guaranteed to see and guaranteed not to notice.

Measured 2026-08-17: editing an item's `value_usd` in the register left `inventory:reconcile` green
and all 23 inventory unit tests passing, while the published price stayed wrong. `--check` existed
the whole time and no workflow ran it. Both halves are closed now — the check is wired into
`gate.yml`, and `reconcile-surfaces.ts` imports the generator's own `renderItemsJson` rather than
re-deriving the payload, so there is exactly **one** definition of what `items.json` should contain.
A second implementation of the expectation would have rebuilt the same bug one level up.

## Drafts vs canonical

Files suffixed `-draft.md` are point-in-time snapshots from a contributor. A snapshot is **immutable**
— the way to change it is a new snapshot, not an edit — and its body is byte-pinned in its header.
Promotion to canonical happens when the operator + the contributor reconcile.

## Composes with

- `src/Core.TypeScript/inventory/amazon-orders-extract.ts` — Amazon order-history extractor
  (operator-driven; outputs to `~/.local/share/zeta-inventory/amazon/<year>/`; NOT in repo per
  personal-account scope). *(Path corrected 2026-08-16: this README said `tools/inventory/`, which
  has never existed.)*
- 081KSGS9H0008QG0R001VVEZQ9 — hardware-inventory-vs-cluster reconciliation gap-analysis substrate
- 081KSGS9H0008QG0R0037H3W4T — iter-5.4.1 self-registration (the cluster side of the diff)

## Not-in-this-folder

- Amazon order history → `~/.local/share/zeta-inventory/amazon/<year>/` (operator local; personal account data; never committed)
- Cluster-side node registrations → `maintainers/<op>/cluster-nodes/<host>/node.yaml` per 081KSGS9H0008QG0R0037H3W4T substrate
- Financial assets / hardware-wallet contents → out of scope; not for this directory
