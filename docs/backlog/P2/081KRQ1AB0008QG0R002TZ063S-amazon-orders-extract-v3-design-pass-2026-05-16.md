---
id: 081KRQ1AB0008QG0R002TZ063S
title: Amazon orders extract — v3 design pass (8 deferred reviewer-thread findings)
status: open
priority: P2
created: 2026-05-16
last_updated: 2026-05-16
type: feature
composes_with:
  - 081KRQ1AB0008QG0R003HCZ5YM  # family-distributed AI interface (per-relative AI on miner fleet — different consumer of the same inventory substrate)
  - 081KRQ1AB0008QG0R002G93CM7  # fleet replication + hardware inventory substrate (consumer of this script's output)
depends_on: []
---

# Amazon orders extract — v3 design pass (8 deferred reviewer-thread findings)

## Substrate-honest context

The personal Amazon order-history extractor (`tools/inventory/amazon-orders-extract.ts`)
landed via [PR #3993](https://github.com/Lucent-Financial-Group/Zeta/pull/3993)
in five iterative batches (v1 → v2 → v2.3 → v2.4 → v2.4.1 → v2.5) addressing
19 of 27 reviewer-thread findings. This row captures the **8 remaining
findings** that require substantive design work — they are legitimate but
do not fit a 1-line patch.

This is NOT scope-creep on the original PR. The v1-v2.5 script is
functional for the immediate use case (hardware-inventory audit + accountant
data preservation per the maintainer's operational need). The v3 design
pass refines it into a more robust general-purpose extractor.

## 8 deferred findings

### 1. Dedupe drops duplicate purchases (P0/P1)

**Threads**: chatgpt-codex-connector (line 207) + copilot-pull-request-reviewer (P0 dedupe key)

The current per-page dedupe key is `href.split("?")[0]` (URL only). When
the same product is purchased multiple times on the same orders page,
later occurrences are dropped — undercounting actual purchase volume.

**Design**: track items by `(url, occurrenceIndex)` or by combining
url + nearby date + nearby price as the dedupe key. Need to distinguish
"same product link rendered twice on the page" (a true duplicate to
dedupe) from "same product purchased twice on different orders shown
on the page" (a real duplicate to preserve).

### 2. Filter links without order-context metadata (P1)

**Thread**: chatgpt-codex-connector (line 216)

The extractor pushes every qualifying `/dp/` or `/gp/product/` link to
the items array even when no nearby date + nearby price is found. Some
of these are "Buy it again" widgets, recommendations, or sidebar
suggestions — not actual orders.

**Design**: require at least one of {date, price} to be present before
classifying a link as an order item. OR walk the DOM more precisely to
find the "Order #" container and only extract links within it.

### 3. Auto-install mutates tracked repo state (P1)

**Thread**: copilot-pull-request-reviewer

`bun install playwright` (in `installIfMissing`) writes to the caller's
`package.json` + `bun.lock`. For a one-off personal extractor this is a
surprising side effect; for users who copy the script to their own repos
it pollutes their dependency manifest.

**Design**: use `bun install --no-save playwright` or detect-then-install
in a script-local node_modules-equivalent. OR remove auto-install and
document the one-time setup explicitly.

### 4. Empty-order-year timeout handling (P1)

**Thread**: chatgpt-codex-connector

For years with zero orders, the original v1 script could wait the full
5-minute selector timeout. v2's press-Enter pattern mitigates this
partially (the human-in-the-loop confirms the page loaded), but a fully
empty year still produces 0 detected pages and 0 items, which may not
be the substrate-honest outcome the user expected.

**Design**: explicit "no orders found for year X" path with early-exit
and a clear message instead of silent zero-results.

### 5. Parse order total explicitly (P2)

**Thread**: chatgpt-codex-connector

Currently `text.match(/\$[\d,]+\.\d{2}/)` matches the FIRST currency
token in the container — could be a subtotal, savings amount, or
shipping cost rather than the order total.

**Design**: walk to a specific "Order total" / "Grand total" element
or use Amazon's `[data-test-id="orderTotalAmount"]` or equivalent
attribute.

### 6. `main(argv)` export pattern (P1)

**Thread**: copilot-pull-request-reviewer

Most `tools/**.ts` scripts in the repo expose `export function main(argv)`
and only execute on `import.meta.main`. The current extractor calls
`main()` unconditionally at module load, blocking any future test or
import.

**Design**: refactor to:
```ts
export async function main(argv: string[]): Promise<void> { ... }
if (import.meta.main) main(process.argv.slice(2));
```

### 7. Fail-run-when-page-fails (deliberate design choice)

**Thread**: chatgpt-codex-connector

The current v2.3 design is "continue-on-skip" — a page navigation
timeout logs a warning and continues. The reviewer suggested failing
the run instead.

**Design**: this is a substrate-honest design choice (v2.3 chose
continue-on-skip explicitly so partial extraction is preserved when
one page fails). The v3 pass should make this CONFIGURABLE — flag
`--fail-on-page-error` for users who want fail-fast behavior, default
to continue-on-skip for the audit use case.

### 8. Hardware-filter regex too narrow (operator finding, not in reviewer threads)

The current `HARDWARE_KEYWORDS` regex matched 1 of 90 items in the
maintainer's 2026 partial extract and surfaced fewer-than-expected
items in the 2025 audit. Brands missing from the regex but present in
the actual orders include: FLUMINER, Goldshell, Bitaxe, NerdMiner,
Canaan, Avalon, Ledger, Trezor, Blockstream, Raspberry Pi, ESP32,
LILYGO, Heltec, Meshtastic, LoRa, MSI, Razer, Seagate, Crucial.

**Design**: widen the regex based on the actual hardware-inventory
substrate (see Otto-Desktop's audit at user-scope memory
`aaron_amazon_2025_hardware_audit_for_zeta_215_orders_107_hardware_77k_spend_2026_05_17.md`).
Risk: too-wide regex catches false positives (e.g., "fan" matching
kitchen fans). Mitigation: narrower brand-anchored patterns rather
than generic terms.

## Acceptance

- [ ] Dedupe preserves duplicate purchases via composite key
- [ ] Order-context filter excludes Buy-it-again / recommendations
- [ ] Auto-install no longer mutates tracked package.json
- [ ] Empty-year case has explicit early-exit message
- [ ] Order total parsed from specific Amazon element, not first $-match
- [ ] `main(argv)` export pattern with `import.meta.main` guard
- [ ] `--fail-on-page-error` flag (default off, preserves continue-on-skip)
- [ ] Hardware-filter regex widened with brand-anchored patterns from
      actual 2025 audit substrate
- [ ] Each change verified locally + tsc clean

## Composes with

- [PR #3993](https://github.com/Lucent-Financial-Group/Zeta/pull/3993) — v1-v2.5 substrate this row refines
- [081KRQ1AB0008QG0R002G93CM7](081KRQ1AB0008QG0R002G93CM7-fleet-replication-20-machines-bare-metal-os-install-kvm-mini-pcs-2026-05-16.md)
  — consumer of the hardware-filtered output
- [081KRQ1AB0008QG0R003HCZ5YM](081KRQ1AB0008QG0R003HCZ5YM-family-distributed-ai-interface-miner-fleet-mom-dad-2026-05-16.md)
  — different consumer (mom/dad AI uses the inventory substrate)
- User-scope: `aaron_amazon_2025_hardware_audit_for_zeta_215_orders_107_hardware_77k_spend_2026_05_17.md`
  (the 2025 audit; reference data for the hardware-regex widening)
- Future B-NNNN — multi-account/multi-vendor consolidation
  (the maintainer's "killer feature" framing 2026-05-16; v3 extractor
  is the natural substrate to build that on)

## Substrate-honest framing

This row exists because reviewer-thread triage on the parent PR
distinguished "addressable in 1-3 lines" (the 19 resolved) from "needs
design work" (these 8). Filing as P2 — v1-v2.5 works for the immediate
use case; v3 is the refinement.

Per `.claude/rules/no-directives.md`: this is not committed work; it's
captured intent. Implementation timing is at the maintainer's + AI-team's
discretion. The row exists so the thread substrate doesn't decay into
weather per `substrate-or-it-didn't-happen`.

## Out of scope

- Per-item price detail (Amazon's order-summary page; ~107 × 4s = 7 min
  per Otto-Desktop's audit note) — separate decomposition slice if needed
- Multi-vendor / multi-account consolidation — separate backlog row
- Tax-prep integration — separate concern; this script's output may
  feed into it
