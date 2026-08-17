---
id: 081M00R59KS087G0R001W3837V
type: task
state: backlog
priority: P2
slug: hardware-inventory-lives-on-three-surfaces-that-do-not-know
title: "hardware inventory lives on three surfaces that do not know about each other — reconcile into the ZetaId register"
created: 2026-08-14T18:22:14.649Z
depends_on: []
composes_with: []
---

# hardware inventory lives on three surfaces that do not know about each other — reconcile into the ZetaId register

## MEASURED 2026-08-16 — it is six surfaces, not three

Before building anything, the surfaces were enumerated and counted. The framing above was wrong in
two ways that change the answer, so it is corrected here rather than edited away:

| surface | provenance class | measured |
|---|---|---|
| `inventory/items/` | **register** (identity of record) | 2 rows, **both `sample: true`** → **0 real assets** |
| `docs/inventory/hardware-2026-05-27-addison-draft.md` | **snapshot** (human audit, point-in-time) | **188 line items / 206 physical units** across 14 sections |
| `docs/inventory/fleet-aaron-max-2026-06-09.md` | **declaration** (operator says) | 2 fleets |
| `docs/inventory/hardware-to-buy.md` | **wishlist** (not owned) | n/a |
| `maintainers/*/cluster-nodes/*/node.yaml` | **probe** (machine self-report) | **4 registrations, 3 distinct MACs** |
| `machines/*.pub` | **hostkey** (SSH host-cert identity) | **1** |

**Correction 1 — the count.** This item said "~40 assets" (15 mini-PCs + 24 GPUs). The snapshot
actually carries **206 units**; the GPU and mini-PC sections are 41 of them. A bulk import would
have been 5× the expected size.

**Correction 2 — the third surface is not an inventory.** `docs/HARDWARE-CAPABILITY-MATRIX.md` is
keyed by **target class** (`linux-x64`, `qemu-aarch64`, `nvidia-gpu`), never by asset. There is no
common key on which to reconcile it against an asset register, so it is deliberately **not**
reconciled. Its only asset content is prose asides ("hardware IN HAND … RTX 4090 + RTX 3090"), and
those are the drift risk, not the table.

Two surfaces the item did not name at all — the **probe** and **hostkey** surfaces — are where the
live divergences actually are.

## MEASURED 2026-08-17 — the surface enumeration above missed the one that is READ

The 2026-08-16 pass counted six surfaces and reconciled them. It missed a seventh, and it is the
only one an outside reader ever sees.

`inventory/items.json` is a **committed projection** of `inventory/items/*.md`, emitted by
`generate-items-json.ts`. The Pages viewer (`inventory/lib/inventory-viewer.js:57`) does
`fetch("items.json")` and never opens an item file. The reconciler counted the register from the
`.md` files and never looked at the published copy, so the two could disagree freely.

**Reproduced on `main` before the fix.** Set `value_usd: 999999` on the RTX 4090 row:

| check | result |
|---|---|
| `bun run inventory:reconcile` | **exit 0** — "✓ no unaccounted divergence" |
| `bun test src/Core.TypeScript/inventory/` | **23 pass / 0 fail** |
| `inventory/items.json` | unchanged: `"value_usd": 1599`, `"total_value_usd": 8198` |
| `generate-items-json.ts --check` | exit 1 — the one check that catches it |

The `--check` mode had existed since the file was written and **no workflow ran it** — the same
class as the two gaps this job already documents (the #8216 hygiene suite, and the inventory unit
tests found unwired on 2026-08-16). A check that exists, can fail, and is wired to nothing reads
exactly like a check that passed.

**Fixed as class (b) — generator emits, drift caught at build.** Class (a) is not reachable here:
`items.json` cannot be eliminated, because a browser fetching a static site cannot list
`inventory/items/`. So the committed projection is necessary, and the honest move is to make the
derivation the only definition of it:

- `generate-items-json.ts` now exports `renderItemsJson(root)` — **one** definition of the derived
  bytes, called by write, by `--check`, and by the reconciler. Re-deriving the payload in the
  checker would have rebuilt this exact bug one level up: two copies, agreeing today.
- `reconcile-surfaces.ts` gains **HWR-7** (read-model == what the register derives), so the surface
  map stops under-reporting and the projection is visible in the printed report either way.
- `gate.yml` runs `bun run inventory:items-check` in `lint-bash-retirement-inventory` — the same
  non-blocking job the other inventory steps live in. **Not** added to the `gate-required` floor:
  that is a treaty-amendment consent path, and this change did not take it.

Mutation evidence: with HWR-7 replaced by an always-false comparison, **24 pass / 3 fail**;
restored, **27 pass / 0 fail**. Four HWR-7 mutants are pinned — register edited, read-model
hand-edited, read-model absent (missing must not read as agreement), and a register row the
generator rejects.

### The divergences found

1. **`node-5b2dfa` and `node-f82aa6` report the same MAC `b0:41:6f:17:87:cc`.** Two self-registrations
   on 2026-06-14, 5h apart, identical hardware blocks. Either one machine re-registered under a fresh
   node id (the probe surface over-counts the fleet by 25%) or a manifest was copied. Max owns the
   answer; not inferred here. Ledgered as `HWR-2`.
2. **The fleet declaration said "Max — not yet self-registered"** while his subtree had carried two
   registrations for two months. Corrected in the doc, and `HWR-6` now fails when a node registers and
   the declaration is not updated.
3. **The two machine-identity surfaces are disjoint.** 4 self-registered cluster nodes have **zero**
   host keys in `machines/`; the one machine with a host key is not a cluster node. Overlap = 0.
4. **The register covers 0 of 206 audited units.** Held open on purpose (see below), printed on every
   run so it cannot quietly stop being reported.
5. **`src/Core.TypeScript/inventory/*.test.ts` was never run by any workflow** — found while wiring CI.
   Now wired.

### What was built

`src/Core.TypeScript/inventory/reconcile-surfaces.ts` + `reconcile-surfaces.test.ts`, wired as
**drift, not a gate** (it is not in the `gate-required` roll-up). It reconciles; it does **not**
merge. Known-open divergences are ledgered in `inventory/reconciliation-open.json`, and a ledger
entry whose finding **no longer reproduces** fails too — a suppression cannot outlive its cause.

Original framing, kept verbatim below.

---

## The three surfaces

Hardware inventory exists in three places, none of which references the others:

| surface | contents | state |
|---|---|---|
| `docs/inventory/hardware-2026-05-27-addison-draft.md` | Addison's audit — **15 mini-PC/workstation line items, 24 GPUs**, Echo devices, iPhones, miners | draft, self-flagged uncertain |
| `inventory/items/` | the ZetaId-keyed register, git-as-database, with `new-item.ts`, `generate-items-json.ts`, a live Pages site and an independent Phase-7 security audit | **2 items** — Mac Studio M2 Ultra, one RTX 4090 |
| `docs/HARDWARE-CAPABILITY-MATRIX.md` | capability matrix | separate again |

So the audited *register* holds 2 of ~40 assets, while the *data* sits in a draft that
the register does not know about. The draft's own header says it promotes to a canonical
**hardware.md** after Addison + operator reconcile miner counts — that reconciliation
never happened, and the audited data never reached the audited register.

## Do NOT bulk-import the May draft

Aaron 2026-08-14: **Addison is redoing the inventory to make it more accurate.**

Importing ~40 ZetaId-keyed files from a document she is superseding would hand her 40 rows
to re-verify against her own fresh audit, and every correction becomes a diff against data
that was never right. The draft already flags its own unreliability — *"the counts on the
bitcoin miners are messed up there are more but it's close"*, and one RTX 3090 marked
"uncertain provenance."

**Her new audit is the source of truth. The register is the target.** This item is about
making that path work, not about moving stale rows.

## What this item should actually do

1. **Prove the import path end-to-end** with a small number of items, so a bulk import is a
   known-good operation rather than a first attempt at scale. `new-item.ts` mints the ZetaId
   and scaffolds the file; `generate-items-json.ts` derives `items.json`; there is a
   `[0-9A-HJKMNP-TV-Z]{26}` id check already in the generator.
2. **Decide what a "unit" is before rows exist.** `GMKtec NucBox K11 × 2` is two assets or
   one row with a quantity — the register is one-file-per-physical-asset, which argues for
   two, but that decision should be made once rather than per import.
3. **Retire or cross-link the other two surfaces** so this cannot re-fork. A capability
   matrix that derives from the register is fine; a second hand-maintained list is how this
   happened.
4. **Check `amazon-orders-extract.ts`** — Aaron: *"we had started this with our amazon
   history in git."* If order history can seed provenance (purchase date, price, model), that
   is better data than a hand-typed list and it may be what Addison's redo wants to use.

## Why it matters beyond tidiness

Two consumers, both live:

- **The investor PoC.** "We have an audited asset register" is a claim with 2 rows behind it.
  Populating it is cheap; being asked about it and finding out live is not.
- **The confidential-computing tier split**
  (`docs/research/2026-08-14-confidential-computing-on-consumer-hardware-…`). Which nodes can
  ever offer hardware-enforced isolation is a **per-CPU** fact — TDX is Xeon, SEV-SNP is EPYC,
  and Addison's list shows the fleet is Ryzen 9 7940HS / 9955HX / N100 / N150 / J4125, i.e.
  all consumer. That conclusion currently rests on a draft rather than on the register, and
  the register is where a claim like that should be checkable.
  **Record the attestation root per CPU while you are at it** (`081M00QP7FB087G0R00031BQ93`): the
  register should carry not just *can this node attest* but *to whose root* — TDX chains to the
  **Intel SGX Root CA**, SEV-SNP to **AMD's ARK**, a TPM to its **manufacturer's EK root**. That
  makes the vendor-diversity question answerable from the register rather than by inspection, which
  matters because two SEV-SNP nodes are one root wearing two boxes, and a fleet spanning AMD and
  Intel roots degrades gracefully where a monoculture does not.

## Pointers

- `docs/inventory/README.md` · `inventory/AUDIT-PHASE7.md` · `inventory/items/README.md`
- `src/Core.TypeScript/inventory/{new-item,generate-items-json,amazon-orders-extract}.ts`
- `081KSGS9H0008QG0R001VVEZQ9` — the earlier hardware-inventory-vs-cluster reconciliation item this composes with
- `docs/backlog/P2/081KSE6WT0008QG0R0004AP0ZA-…` — the curated commodity-hardware reference (mini PCs + OCuLink eGPU + IP-KVM + remote finger)
