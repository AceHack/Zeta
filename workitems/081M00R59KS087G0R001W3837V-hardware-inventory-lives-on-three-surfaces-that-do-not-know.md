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

## The three surfaces

Hardware inventory exists in three places, none of which references the others:

| surface | contents | state |
|---|---|---|
| `docs/inventory/hardware-2026-05-27-addison-draft.md` | Addison's audit — **15 mini-PC/workstation line items, 24 GPUs**, Echo devices, iPhones, miners | draft, self-flagged uncertain |
| `inventory/items/` | the ZetaId-keyed register, git-as-database, with `new-item.ts`, `generate-items-json.ts`, a live Pages site and an independent Phase-7 security audit | **2 items** — Mac Studio M2 Ultra, one RTX 4090 |
| `docs/HARDWARE-CAPABILITY-MATRIX.md` | capability matrix | separate again |

So the audited *register* holds 2 of ~40 assets, while the *data* sits in a draft that
the register does not know about. The draft's own header says it "promotes to canonical
(`hardware.md`) after Addison + operator reconcile miner counts" — that reconciliation
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

- `inventory/README.md` · `inventory/AUDIT-PHASE7.md` · `inventory/items/README.md`
- `src/Core.TypeScript/inventory/{new-item,generate-items-json,amazon-orders-extract}.ts`
- `081KSGS9H0008QG0R001VVEZQ9` — the earlier hardware-inventory-vs-cluster reconciliation item this composes with
- `docs/backlog/P2/081KSE6WT0008QG0R0004AP0ZA-…` — the curated commodity-hardware reference (mini PCs + OCuLink eGPU + IP-KVM + remote finger)
