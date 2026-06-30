---
id: B-0620
status: open
priority: P2
created: 2026-05-16
type: feature
composes_with:
  - B-0610  # amazon-orders-extract v3 design pass (the substrate this generalizes from)
  - B-0590  # fleet replication + hardware inventory substrate (consumer)
  - B-0600  # family-distributed AI interface (different consumer of same inventory)
depends_on: []
---

# Multi-account + multi-vendor inventory consolidation — the "killer feature" framing

## Substrate-honest context

The maintainer 2026-05-16T~20:00Z, after the amazon-orders-extract.ts
landed:

> *"no rush on the reoccuring updates that's a future backlog but
> scrapping from differnt acounts to pull everyting into one place for
> accounts you are actually authorized too will be a killer feature"*

This row captures that follow-up substrate: extend the personal-account
inventory-extraction pattern (amazon-orders-extract.ts) to a generalized
multi-account + multi-vendor consolidator. The first instance is already
operational for Amazon (PR #3993 + B-0610 v3 refinement). Generalizing
creates a real product surface for the maintainer's own substrate AND
for other Zeta operators applying the framework.

## Scope

A consolidator that pulls hardware (and adjacent) purchase + inventory
data from N accounts across M vendors, into a single unified inventory
substrate the operator owns and controls.

| Vendor class | Examples | Why hardware-relevant |
|---|---|---|
| **General retail** | Amazon, Newegg, Best Buy, B&H | Mining hardware, mini PCs, NAS, peripherals |
| **Specialized cutting-edge** | Minisforum direct, Beelink direct, GMKtec direct, ServeTheHome marketplace | Cutting-edge mini PCs with OCuLink, ECC support, Ryzen AI |
| **Networking** | Ubiquiti, MikroTik, FS.com, Cisco refurb | Switches, routers, ethernet, optical |
| **Crypto-mining specialist** | Canaan (Avalon), Bitmain, Goldshell, Bitaxe shop | ASIC miners |
| **Component / parts** | Crucial direct, Samsung direct, AliExpress for boards | Memory, SSDs, SBCs, sensor modules |
| **Other authorized accounts** | Per operator's actual purchase history | Whatever the operator has account access to |

## Constraints (load-bearing)

1. **Each account/vendor is operator-authorized** — same safety-classifier
   discipline as amazon-orders-extract.ts; human-driven runs only;
   agent-driven scraping of authenticated accounts is refused at the
   classifier layer per B-0582 destructive-verb-refusal-gate. The script
   is what the operator runs in their own session.

2. **Per-vendor adapter pattern** — each vendor needs its own DOM/API
   adapter (Amazon DOM ≠ Newegg DOM ≠ Ubiquiti API). Adapters share a
   common interface (output a consistent normalized record).

3. **Unified normalized record schema** — all vendors emit records in
   the same shape:
   ```ts
   interface InventoryRecord {
     vendor: string;
     account_id_hash: string;   // hashed for privacy if cross-account
     order_id: string | null;
     date: string | null;
     title: string;
     url: string;
     price: string | null;
     qty: number;
     category: "revenue-generating" | "rnd" | "pending" | "other";
     // Category from AI-Team Financial Substrate doc's three-category structure
   }
   ```

4. **Privacy discipline** — full extracts contain personal financial data;
   only categorized + reviewed subsets may be committed. Same gitignore +
   chmod 0600 discipline as amazon-orders-extract.ts v2.5.

5. **Composition with the financial-substrate categorization** — output
   ties into the three-category structure (revenue-generating Otto-team
   capex / R&D maintainer-gift / pending categorization) from
   `docs/governance/AI-TEAM-FINANCIAL-SUBSTRATE.md`.

## Acceptance

- [ ] Vendor-adapter interface defined (per-vendor adapter implements
      common `extract(year): InventoryRecord[]` shape)
- [ ] At least 3 vendor adapters operational: Amazon (port from
      amazon-orders-extract.ts), one specialized hardware vendor (e.g.,
      Minisforum direct or Beelink direct), one networking vendor (e.g.,
      Ubiquiti)
- [ ] Consolidator script merges N-adapter outputs into single normalized
      inventory file
- [ ] Output committable hardware-filter substrate matches the three-category
      structure from AI-TEAM-FINANCIAL-SUBSTRATE.md
- [ ] Per-vendor adapter is shippable as standalone (other operators can
      use one without the others; modular)
- [ ] Documentation in `tools/inventory/README.md` covers per-vendor
      adapter setup + reusability for other operators

## Decomposition slices

- **B-0620.1** — [Extracted to B-0620-slice-1-vendor-adapter-interface.md](B-0620-slice-1-vendor-adapter-interface.md)
- **B-0620.2** — [Extracted to B-0620-slice-2-specialized-vendor-adapter.md](B-0620-slice-2-specialized-vendor-adapter.md)
- **B-0620.3** — [Extracted to B-0620-slice-3-networking-vendor-adapter.md](B-0620-slice-3-networking-vendor-adapter.md)
- **B-0620.4** — [Extracted to B-0620-slice-4-consolidator-script.md](B-0620-slice-4-consolidator-script.md)
- **B-0620.5** — [Extracted to B-0620-slice-5-category-classifier.md](B-0620-slice-5-category-classifier.md)
- **B-0620.6** — Cross-operator generalization — anonymize the
  Amazon-adapter's regex patterns so other operators can use it
  unchanged

## Composes with

- [B-0610](B-0610-amazon-orders-extract-v3-design-pass-2026-05-16.md)
  — the Amazon adapter's improvements feed back into the v3 design pass
  (and vice versa; both rows share the dedupe + filter substrate)
- [B-0590](B-0590-fleet-replication-20-machines-bare-metal-os-install-kvm-mini-pcs-2026-05-16.md)
  — consolidated inventory feeds the fleet's hardware substrate
- [B-0600](B-0600-family-distributed-ai-interface-miner-fleet-mom-dad-2026-05-16.md)
  — per-relative AI uses the consolidated inventory for fleet awareness
- `docs/governance/AI-TEAM-FINANCIAL-SUBSTRATE.md` — the three-category
  structure is what the classifier maps to; this row operationalizes
  the categorization workflow
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` —
  multi-account + multi-vendor IS the multi-oracle pattern applied at
  inventory-source scope
- B-0582 — destructive-verb-refusal-gate; safety discipline preserved
  per-vendor

## Substrate-honest framing

P2 because:

- The Amazon adapter (already operational) covers the bulk of immediate
  inventory needs
- Other vendors are additive; each one adds value but none is urgent
- The pattern + interface are the load-bearing design; specific adapters
  can land incrementally

The "killer feature" framing from the maintainer is the LONG-TERM value
proposition (other Zeta operators applying the framework get a working
multi-account inventory pattern out of the box), not an urgency claim
for THIS row to ship now.

## Out of scope

- Real-time inventory sync (the maintainer explicitly said "no rush on
  the reoccuring updates that's a future backlog") — separate concern
- API-key management for vendors that offer APIs — separate concern;
  this row focuses on the DOM-scraping + human-driven pattern same as
  amazon-orders-extract.ts
- Cross-operator inventory sharing — privacy-discipline requires
  per-operator-controlled substrate only; no shared inventory at
  framework-scope
- Accounting integration — out of scope; this row produces the inventory
  substrate, downstream consumers handle tax/accounting/depreciation
