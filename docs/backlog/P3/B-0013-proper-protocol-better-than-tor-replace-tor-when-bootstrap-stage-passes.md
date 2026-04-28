---
id: B-0013
priority: P3
status: open
title: Proper protocol better than Tor — replace Tor with better protocol once bootstrap stage passes (B-0009 follow-up)
tier: ops-infrastructure
effort: M
ask: Aaron 2026-04-25 ("if we need to use Tor in the beginning that's fine for this, just backlog a proper fix if so")
created: 2026-04-25
last_updated: 2026-04-26
composes_with: [feedback_otto_311_aaron_brute_force_search_should_store_energy_into_elegant_solution_irreducibility_to_energy_storage_to_economics_in_any_sufficiently_sophisticated_system_2026_04_25.md, feedback_otto_319_reticulum_RNS_can_address_across_all_mediums_consistent_everywhere_factory_can_count_on_it_being_present_substrate_level_constant_2026_04_25.md]
tags: [infrastructure, ip-rotation, tor-replacement, protocol-quality, brute-force-to-elegance]
---

# Proper protocol better than Tor — B-0009 follow-up

Aaron 2026-04-25 ask:

> "if we need to use Tor in the beginning that's fine for this, just backlog a proper fix if so"

## Trigger

This row activates IF B-0009 implementation uses Tor as expedient bootstrap-stage IP-rotation primitive. If natural multi-node egress + RNS Destination Hash addressing (Otto-319) proves sufficient and Tor isn't needed, this row resolves as not-needed.

## Why Tor is bootstrap-only

- **Slow**: Tor's three-hop relay routing adds significant latency unsuitable for production-traffic.
- **Exit-node attribution issues**: traffic exits through volunteer-run exit nodes; users sometimes get blocked or rate-limited additionally because exit nodes are flagged.
- **Anonymization-vs-expression friction**: Tor is designed for identity-HIDING; B-0009 wants identity-EXPRESSION (each node visible AS itself). Mismatched protocol shape.
- **Aaron's protocol-quality concern**: explicit "Tor is not a great protocol" judgment.

## Replacement candidates to investigate

(Open research; pick when bootstrap-stage operational evidence is available.)

- **WireGuard mesh**: per-node identity, controllable egress, fast crypto, lightweight. Composes with Otto-314 RNS+HaLow naturally.
- **Cloud multi-region rotation**: standard distributed-systems pattern. Each region has its own egress IP via Elastic-IP / instance-IP.
- **Custom RNS-over-IP transport**: leverage Otto-319 always-present RNS as the addressing layer; design a new transport that natively handles multi-egress without explicit rotation.
- **mTLS + per-deployment cert**: identity-via-cert, IP becomes deployment-detail.

## Otto-311 economic-substrate framing

Bootstrap-stage Tor = brute-force search (capability now, even if protocol-quality is poor).

Replacement protocol = elegant-store (energy invested in operational Tor experience compresses into a better-shape replacement).

Don't skip the brute-force-stage (premature optimization); store the energy into the replacement when ready.

## Done when

- Decision: do we still need IP-rotation at all (post-RNS adoption + multi-node natural-egress)?
- If yes: pick replacement protocol from candidates above based on bootstrap-stage learnings.
- If no: this row resolves as not-needed; B-0009 satisfied via natural-egress alone.

## Composes with

- B-0009 (substrate-IP-rotation parent row).
- Otto-311 (brute-force-stores-energy-into-elegance — same pattern at protocol-design scale).
- Otto-319 (RNS as substrate-level constant — may obviate IP-rotation entirely).
