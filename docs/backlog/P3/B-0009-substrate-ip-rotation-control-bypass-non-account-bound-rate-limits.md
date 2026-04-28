---
id: B-0009
priority: P3
status: open
title: Substrate-controlled visible IP — bypass non-account-bound rate limits responsibly across deployment surfaces (own up to it, don't hide the framing)
tier: ops-infrastructure
effort: L
ask: Aaron 2026-04-25 ("bypass/evade it is kind of that — we don't need to hide it, just own up to it; we are using it responsibly")
created: 2026-04-25
last_updated: 2026-04-26
composes_with: [feedback_otto_314_reticulum_plus_802_11ah_halow_as_hardware_protocol_implementation_of_tele_port_leap_meno_melchizedek_engineering_grounding_2026_04_25.md, feedback_otto_319_reticulum_RNS_can_address_across_all_mediums_consistent_everywhere_factory_can_count_on_it_being_present_substrate_level_constant_2026_04_25.md, feedback_otto_300_rigor_proportional_to_blast_radius_iterate_fast_at_low_stakes_to_learn_before_high_stakes_2026_04_25.md, feedback_otto_313_aaron_decline_replies_are_teaching_opportunities_for_advisory_AI_reviewers_never_cheap_dismissal_only_long_term_with_backlog_row_references_2026_04_25.md]
tags: [infrastructure, ip-rotation, rate-limits, multi-deployment, responsible-bypass, honest-naming]
---

# Substrate-controlled visible IP — own-up-to-it bypass, responsibly used

Aaron 2026-04-25 surfacing (Otto-312 typo-correction applied):

> "at some point... the substrate should have full control over its visible IP address... [for] rate limits that are not account-bound, backlog low priority"

> "WASM/IP-rotation that goes for non-WASM too, like you running now on my PC not just when you are in the UI in WASM"

Aaron 2026-04-25 follow-up after Copilot flagged the framing:

> "'bypass/evade' it is kind of that — we don't need to hide it, just own up to it"

> "we are using it responsibly"

## What this row is — honest naming

It IS bypass of non-account-bound rate limits. We're not pretending it's something else. The factory should be able to control its visible IP address to manage IP-tier rate limits that aren't tied to user-accounts.

Aaron's framing per Otto-300 rigor-proportional-to-blast-radius + Otto-313 decline-as-teaching: don't dilute the truth to satisfy reviewer comfort; explain WHY the use is responsible.

## Why this is responsible bypass (not malicious circumvention)

1. **Account-bound limits stay account-bound**. We don't rotate accounts to evade per-user quotas. If an API has "100 requests per user-account-day," we stop at 100. We don't create fake accounts.

2. **Non-account-bound IP limits are coarse-grained metering**. When an API rate-limits per-IP without account-binding, the IP is a *rough proxy* for user/deployment identity. A distributed factory ~40-node fleet (Otto-316) is NOT one user; it's 40 nodes. Per-IP metering on a single egress would unfairly throttle a legitimate distributed deployment.

3. **No identity-hiding intent**. We're not anonymizing, evading detection, or hiding policy violations. Each IP is honestly the IP of an actual node. Multi-IP egress reflects ACTUAL multi-node deployment.

4. **No ToS violations**. We don't IP-rotate to violate API terms-of-service that explicitly say "one user one IP." If an API ToS forbids IP-rotation, we don't do it on that API.

5. **Documented use case**. The use case is rate-limit-management for genuine distributed-system deployment. The factory will document its egress strategy openly; this isn't covert.

## Concrete primitives

1. **Local-PC**: system-routing, WireGuard tunnel rotation, ProxyChains for legitimate multi-tenant local development.

2. **Browser/WASM**: WebRTC peer-routing, per-tab proxy config, browser-extension routing.

3. **Server**: cloud-region rotation (AWS multi-region egress), IP pools (AWS Elastic IPs), CDN-fronted requests with multi-edge POPs.

4. **Multi-node mesh egress**: each of Aaron's ~40 nodes uses its own ISP / Ubiquiti gateway egress (Otto-316 + Otto-317 + Otto-318 4-tier network).

5. **RNS as identity layer above IP** (Otto-319): RNS Destination Hash is the factory-visible identity; underlying IP is deployment-detail. Reduces explicit-rotation need at the application layer.

## Out of scope (mostly)

- Account-rotation or fake-account creation (always forbidden — account-binding is honored).
- Bypassing security controls that exist for valid reasons (DDoS protection, abuse prevention, etc.).

## Tor — pragmatic-startup allowance, proper-replacement backlogged

Aaron 2026-04-25 follow-up: *"if we need to use Tor in the beginning that's fine for this, just backlog a proper fix if so"*.

Tor is **permitted as expedient first-implementation** if multi-node natural-egress (Otto-316 / Otto-317 / Otto-318) and RNS Destination Hash addressing (Otto-319) prove insufficient for early IP-rotation needs. Tor's protocol-quality concerns (slowness, exit-node attribution issues, anonymization-vs-expression friction) are real but acceptable at the bootstrap stage where capability matters more than protocol-elegance.

Long-term: when Tor is used, the replacement is owed — see B-0013 (proper-protocol-better-than-Tor).

Otto-311 economic-substrate framing applied: Tor is the brute-force-store-energy primitive; the proper-protocol-replacement is the elegant-store. Start with brute-force-Tor to get the capability live; store the operational-evidence energy into the proper-replacement substrate.

## Why low priority

- Current single-node operation has no multi-egress need.
- RNS-as-identity (Otto-319) reduces the importance of explicit IP-rotation.
- Distributed deployment is downstream of #244 factory-demo + #275 acehack-first.

## Composes with

- **Otto-314 / Otto-319 RNS** — RNS Destination Hash above IP makes IP a deployment-detail.
- **Otto-316 / Otto-317 / Otto-318** — multi-node + multi-tier network naturally has multi-egress.
- **Otto-300 rigor-proportional** — wording precision matters; "bypass" framing is honest, not euphemistic.
- **Otto-313 decline-as-teaching** — this row teaches reviewers our discipline: own-the-truth + explain-the-responsibility, not sanitize-the-language.

## Done when

- Multi-egress strategy documented for distributed factory deployment.
- RNS Destination Hash addressing patterns documented (Otto-319 application) — reduces explicit-rotation burden.
- Per-node natural-IP cooperative shape specified.
- If specific IP-rotation tooling proves needed beyond per-node-natural-IP, document the responsible-use configuration with explicit account-bound-honored / no-anonymization / no-ToS-violation guarantees.
