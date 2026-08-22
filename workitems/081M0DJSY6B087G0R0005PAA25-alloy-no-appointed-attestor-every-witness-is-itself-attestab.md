---
id: 081M0DJSY6B087G0R0005PAA25
type: task
state: backlog
priority: P2
slug: alloy-no-appointed-attestor-every-witness-is-itself-attestab
title: "Alloy: no appointed attestor -- every witness is itself attestable (claim 2 structural check)"
created: 2026-08-19T17:58:47.243Z
depends_on: []
composes_with: []
---

# Alloy: no appointed attestor -- every witness is itself attestable (claim 2 structural check)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DJSY6B087G0R0005PAA25-*.md` glob. -->

**Routed by Soraya, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §5 (C2).**

**Property class:** structural shape. **Primary tool: Alloy**, bound 4-6 — a hub, if expressible, shows up small.

**Assert:** no configuration in which a principal attests without itself being attestable; and no principal that all paths route through (the exit property, `itron-hub-patent-boundary-p2p-is-the-upgrade` — the discriminator is exit, not degree).

**Do not re-model BFT.** `src/Core.TLA/specs/BftSybilConsensus.tla` already discharges *quorum-over-distinct-identities is Sybil-sound given a distinctness oracle*, with a non-vacuous witness (`NoSybilRawMajorityRefusal`), and `BftConsensus.tla` cost 4,665,495 states. Build on `src/Core.Alloy/specs/TrustGraph.als` (SDSI/SPKI self-root-for-identity) rather than starting a new model.

**Wrong-tool cost:** "no appointed attestor" is a graph shape, not a temporal property. TLC would enumerate time to check something that does not move.
