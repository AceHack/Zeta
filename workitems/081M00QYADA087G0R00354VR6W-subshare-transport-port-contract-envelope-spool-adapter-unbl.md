---
id: 081M00QYADA087G0R00354VR6W
type: task
state: backlog
priority: P2
slug: subshare-transport-port-contract-envelope-spool-adapter-unbl
title: "Subshare transport port: contract + envelope + spool adapter unblocks the three-house FROST reshare ceremony"
created: 2026-08-14T18:18:26.090Z
depends_on: []
composes_with: []
---

# Subshare transport port: contract + envelope + spool adapter unblocks the three-house FROST reshare ceremony

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00QYADA087G0R00354VR6W-*.md` glob. -->

## The blocker

`tools/setup/persona-keys/frost-reshare.ts` (PR #10654) states in its own header that
subshare transport must be confidential, that it does not provide it, and that a
three-house ceremony must not be attempted until the confidential channel exists. That
made transport the hard blocker on geographically-distributed custody.

## What landed

A hexagonal **port**, not a WireGuard integration (Aaron 2026-08-14: "this should be a
hexagonal interface ... we need our own ports").

- `subshare-transport-port.ts` — the contract: five properties, each stating who must
  provide it (`above-port` vs `port`), each recording WireGuard's coverage as adapter
  detail. Baseline is store-and-forward: no session, no order, no exactly-once.
- `subshare-envelope.ts` — the above-the-port security layer that every adapter
  inherits: X-Wing KEM to a signed per-ceremony pre-key, ed25519 holder signature over
  a canonical body, coordinate-binding AAD, grow-only replay guard, destroyable
  recipient key.
- `subshare-spool-adapter.ts` — adapter 1: a directory of text files, carried by a
  WireGuard/headscale mesh, scp, Reticulum, or a USB stick.
- `subshare-transport-conformance.ts` — the falsifier, shipped so adapter 2 can be
  checked against the same bar.

## The finding

WireGuard is **sufficient for none of the five properties end-to-end** and **required
for none**. It is a carrier that adds metadata concealment and coarse admission. So
share custody does not depend on the headscale control plane at all — mesh admission
and ceremony admission are two independent gates, and the roster is the pin.

## Not done (deliberate)

Roster distribution/rotation, traffic-analysis resistance, a live network adapter,
tier (still L1 — the scalar is in host RAM at seal/open), and old-share destruction
(frost-reshare caveat 3, owned by the delta-rotation work).

Full analysis: `docs/research/2026-08-14-subshare-transport-port-five-properties-wireguard-covers-none-end-to-end-envelope-above-the-port.md`
