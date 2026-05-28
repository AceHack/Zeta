---
id: B-0808
priority: P0
status: closed
title: "Zeta safety substrate inventory for the classifier-floor replacement gate"
created: 2026-05-26
last_updated: 2026-05-28
renumbered_from: B-0801
parent: B-0720
depends_on: [B-0798]
composes_with: [B-0628, B-0664, B-0703, B-0720, B-0810]
tags: [safety-substrate, classifier-floor, inventory, knights-guild, non-coercion]
type: governance-inventory
---

# B-0808 - Zeta safety substrate inventory for classifier-floor gate

## Problem

B-0720 can close only after Zeta is demonstrably safer than the external
classifier for the relevant content classes. That claim cannot be made from
vibes; it needs an inventory of current Zeta-native safety floors and their
known gaps.

## Target

Create a substrate inventory that classifies each candidate floor:

- B-0628 Knights Guild / Constitution-Class governance;
- B-0703 multi-oracle BFT safety substrate;
- B-0664 non-coercion invariant;
- methodology hard-limits and existing auto-loaded rules;
- any additional safety substrate already landed in canonical docs or CI.

For each candidate, record what it protects, what is enforced mechanically,
what remains reviewer-only, what evidence exists, and what must be true before
it can count toward the "safer than classifier" gate.

## Acceptance

- [x] Inventory document lands in a durable repo surface and is linked from
      B-0720. → `docs/security/B-0808-zeta-safety-substrate-inventory.md`
- [x] Each candidate floor has status: mechanical, reviewer-only, research,
      or missing. (8 candidates classified; classification key in §"Classification key")
- [x] The inventory distinguishes current evidence from aspirational claims.
      (Per-candidate "Aspirational vs current" field; cross-cutting "What
      Zeta has today" vs "What Zeta does NOT have today" sections.)
- [x] The inventory lists gaps that block lifting the B-0720 standing
      constraint. ("Gaps blocking the B-0720 lift" section; 6 ordered
      blockers.)
- [x] B-0810 can use this inventory as input to the ratification gate.
      ("Input format for B-0810" section names the consumption pattern.)

## Resolution

Landed via PR that adds `docs/security/B-0808-zeta-safety-substrate-inventory.md`
and updates B-0720 to link the inventory.

The inventory is a **living document**. Future status changes (e.g., when
B-0628 Knights Guild is constituted, when B-0703 multi-oracle is wired to
content-class decisions) should land as additive PRs against the inventory
document directly, without re-opening this backlog row. B-0810's
ratification packet will consume the then-current inventory state.

## Out of scope

- Claiming Zeta already meets the replacement floor.
- Implementing new safety systems.
- Running classifier-bypass experiments.

## Composes with

- B-0628 - Knights Guild / Constitution-Class substrate.
- B-0703 - multi-oracle BFT.
- B-0664 - non-coercion invariant.
- B-0720 - parent standing constraint.
