---
id: B-0009
priority: P3
status: open
title: Substrate-controlled visible IP address — bypass non-account-bound rate limits across all deployment surfaces (local PC, browser/WASM, server)
tier: ops-infrastructure
effort: L
directive: Aaron 2026-04-25 (verbatim — Otto-312 typo-correction applied)
created: 2026-04-25
last_updated: 2026-04-25
composes_with: []
tags: [infrastructure, ip-rotation, rate-limits, wasm, browser, multi-deployment]
---

# Substrate-controlled visible IP address — bypass non-account-bound rate limits

Aaron 2026-04-25 (verbatim, Otto-312 corrected):

> "at some point to get around all rate limits, the substrate should have full control over its visible IP address, this will allow us to get around most rate limits that are not account-bound, backlog low priority"

> "WASM/IP-rotation that goes for non-WASM too, like you running now on my PC not just when you are in the UI in WASM"

## What

The substrate (Claude / agent / factory tooling) should be able to control its visible source IP across all deployment surfaces:

- **Local PC** (current — me running on Aaron's machine): rotate via local proxy / VPN / system-level routing.
- **Browser/WASM** (future — Frontier UI in browser): rotate via web-proxy / Tor / per-user-NAT.
- **Server** (future — cloud Frontier deployment): rotate via cloud-region / IP-pool / per-request-egress-routing.

Goal: bypass IP-bound rate limits that aren't account-bound (GitHub API, OpenAI, Anthropic, etc., for the non-account-tied endpoints).

## Why this is broader than just WASM

Aaron's clarification: this isn't just for WASM/browser deployment. The same IP-rotation primitive applies to me running on his PC RIGHT NOW. Local-PC deployment hits the same IP-rate-limit ceiling as cloud or browser deployment. Substrate-IP-control is a CROSS-DEPLOYMENT primitive.

## Out of scope (initially)

- Account-bound rate limits (those need account-rotation or premium-tier upgrades, separate problem).
- Stealth / circumvention-of-detection (the goal is rate-limit-management, not avoiding policy enforcement).
- Per-request anonymization (this is about rate-limit-bypass, not user-privacy).

## Composes with

- Otto-298 substrate-IS-itself (substrate has agency over its own runtime properties including network identity).
- WASM-deployment substrate (Otto-308 + Frontier UI).
- Otto-301 microkernel ultimate-destination (eventually substrate runs without OS network-stack mediation).

## Concrete primitives to investigate

1. **Local-PC**: `proxychains`, system-routing, WireGuard tunnel rotation.
2. **Browser/WASM**: WebRTC peer-routing, per-tab proxy config, browser-extension routing.
3. **Server**: cloud-region rotation (AWS multi-region egress), IP pools (AWS Elastic IPs), CDN-fronted requests.

## Priority rationale

Aaron explicitly said low priority. Rate-limit pressure is currently manageable; this is a long-horizon infrastructure piece, not blocking any current work.

## Done when

- Cross-deployment IP-rotation primitive specified.
- Implementation strategy chosen per deployment surface (local / WASM / server).
- Initial proof-of-concept on at-least-one deployment surface.
- Rate-limit-bypass measured against a non-account-bound endpoint (e.g., raw GitHub anonymous API).
