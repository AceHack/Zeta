---
id: 081M0QB3HP2087G0R0029W97ZZ
type: task
state: backlog
priority: P2
slug: dedicated-clusternode-zetaid-category-slot-across-the-four-o
title: "Dedicated ClusterNode ZetaId category slot across the four oracles"
created: 2026-08-23T12:56:37.826Z
depends_on: []
composes_with: []
---

# Dedicated ClusterNode ZetaId category slot across the four oracles

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QB3HP2087G0R0029W97ZZ-*.md` glob. -->

## Why this is filed rather than done

The USB installer now mints a node identity key at install time
(`/etc/zeta/node-zetaid`, PR "installer: ZetaId + force-reformat override").
It uses `Category.InventoryAsset` (10) — the category
`src/Core.TypeScript/inventory/new-item.ts`
already mints for the register `reconcile-surfaces.ts` calls "identity of
record". A cluster node IS a physical asset, so that reuse is correct today
and is deliberately not a parallel id scheme.

What it does not give: a node is not distinguishable from a GPU, a switch or a
cable **by its key alone** — only by which file it lives in. Every other
category in `src/Core.TypeScript/zeta-id/types.ts` earns its slot by exactly that
property.

## Size

A new slot is a **four-oracle byte-lock change**, which is the entire cost:

- `src/Core.TypeScript/zeta-id/types.ts` — the slot (**correction 2026-08-23: 12 is
  no longer free** — `Agenda` took it under 081M0R3WHTH087G0R0015CH5PV; **13 and 14**
  are, and 15 is the reserved `Extended` escape).
- `src/Core.CSharp.ZetaId/` and `src/Core.FSharp.ZetaId/` — both already **lag**
  `InventoryAsset = 10` (noted in
  `src/Core.TypeScript/model-backend/multiplexed-duplex-transport.ts`),
  so this backfills two oracles before it adds one value.
- `src/Core.Rust.ZetaId/` — same.
- `src/Core.TypeScript/zeta-id/cross-verify.ts` + the golden vectors — a new category is a new
  vector in every oracle, or the byte-lock does not cover it.

## Falsifier for "done"

`cross-verify` passes with a `ClusterNode` vector in all four oracles, and
`zeta-install.sh`'s `ZETA-NODE-ZETAID` block emits the new category with
`node-zetaid.test.ts` still byte-locking shell against TypeScript.

## Also open, smaller

Nothing reads `/etc/zeta/node-zetaid` yet. `cluster-node-id` gets a
`maybe_symlink` into the installer environment because
`injected-hostname.nix` `readFile`s it at flake-**evaluation** time; no NixOS
module evaluates the ZetaId, so no symlink was added. Adding one before a
reader exists would be cargo-cult. When the roster or a module starts keying on
it, that symlink is the next line.
