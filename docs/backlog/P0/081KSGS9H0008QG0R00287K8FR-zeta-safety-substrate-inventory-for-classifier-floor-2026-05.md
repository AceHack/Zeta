---
id: 081KSGS9H0008QG0R00287K8FR
priority: P0
status: closed
title: "Zeta safety substrate inventory for the classifier-floor replacement gate"
created: 2026-05-26
last_updated: 2026-05-28
renumbered_from: 081KSGS9H0008QG0R002T6J6FS
parent: 081KSBMG30008QG0R00201X7EJ
depends_on: [081KSGS9H0008QG0R00383T79V]
composes_with: [081KRW63S0008QG0R003TX8MG5, 081KRW63S0008QG0R001Z7NYMV, 081KS3X9Y0008QG0R00218150M, 081KSBMG30008QG0R00201X7EJ, 081KSGS9H0008QG0R002CY8Q24]
tags: [safety-substrate, classifier-floor, inventory, knights-guild, non-coercion]
type: governance-inventory
---

# 081KSGS9H0008QG0R00287K8FR - Zeta safety substrate inventory for classifier-floor gate

## Problem

081KSBMG30008QG0R00201X7EJ can close only after Zeta is demonstrably safer than the external
classifier for the relevant content classes. That claim cannot be made from
vibes; it needs an inventory of current Zeta-native safety floors and their
known gaps.

## Target

Create a substrate inventory that classifies each candidate floor:

- 081KRW63S0008QG0R003TX8MG5 Knights Guild / Constitution-Class governance;
- 081KS3X9Y0008QG0R00218150M multi-oracle BFT safety substrate;
- 081KRW63S0008QG0R001Z7NYMV non-coercion invariant;
- methodology hard-limits and existing auto-loaded rules;
- any additional safety substrate already landed in canonical docs or CI.

For each candidate, record what it protects, what is enforced mechanically,
what remains reviewer-only, what evidence exists, and what must be true before
it can count toward the "safer than classifier" gate.

## Acceptance

- [x] Inventory document lands in a durable repo surface and is linked from
      081KSBMG30008QG0R00201X7EJ. → `docs/security/081KSGS9H0008QG0R00287K8FR-zeta-safety-substrate-inventory.md`
- [x] Each candidate floor has status: mechanical, reviewer-only, research,
      or missing. (8 candidates classified; classification key in §"Classification key")
- [x] The inventory distinguishes current evidence from aspirational claims.
      (Per-candidate "Aspirational vs current" field; cross-cutting "What
      Zeta has today" vs "What Zeta does NOT have today" sections.)
- [x] The inventory lists gaps that block lifting the 081KSBMG30008QG0R00201X7EJ standing
      constraint. ("Gaps blocking the 081KSBMG30008QG0R00201X7EJ lift" section; 6 ordered
      blockers.)
- [x] 081KSGS9H0008QG0R002CY8Q24 can use this inventory as input to the ratification gate.
      ("Input format for 081KSGS9H0008QG0R002CY8Q24" section names the consumption pattern.)

## Resolution

Landed via PR that adds `docs/security/081KSGS9H0008QG0R00287K8FR-zeta-safety-substrate-inventory.md`
and updates 081KSBMG30008QG0R00201X7EJ to link the inventory.

The inventory is a **living document**. Future status changes (e.g., when
081KRW63S0008QG0R003TX8MG5 Knights Guild is constituted, when 081KS3X9Y0008QG0R00218150M multi-oracle is wired to
content-class decisions) should land as additive PRs against the inventory
document directly, without re-opening this backlog row. 081KSGS9H0008QG0R002CY8Q24's
ratification packet will consume the then-current inventory state.

## Out of scope

- Claiming Zeta already meets the replacement floor.
- Implementing new safety systems.
- Running classifier-bypass experiments.

## Composes with

- 081KRW63S0008QG0R003TX8MG5 - Knights Guild / Constitution-Class substrate.
- 081KS3X9Y0008QG0R00218150M - multi-oracle BFT.
- 081KRW63S0008QG0R001Z7NYMV - non-coercion invariant.
- 081KSBMG30008QG0R00201X7EJ - parent standing constraint.
