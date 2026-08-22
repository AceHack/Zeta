---
id: 081M0DK2TW6087G0R001GHD9MJ
type: task
state: backlog
priority: P2
slug: alloy-no-mandatory-hub-every-hub-interaction-is-refusable-by
title: "Alloy: no-mandatory-hub -- every hub interaction is refusable by a node's local policy without loss of standing (exit made mechanical)"
created: 2026-08-19T18:03:38.758Z
depends_on: []
composes_with: []
---

# Alloy: no-mandatory-hub -- every hub interaction is refusable by a node's local policy without loss of standing (exit made mechanical)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DK2TW6087G0R001GHD9MJ-*.md` glob. -->

**Routed by Soraya, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §5 (C6).**

**C6 — hubs negotiate, never command.** Every hub-mediated interaction is refusable by a node's local policy **without loss of standing**.

**Primary: TLA+/TLC by GENERALISING `src/Core.TLA/specs/RefuseBinding.tla`, not by writing a new spec.** That spec already carries the exact shape — `Refuse` always enabled while a proposal is pending, refusing never costs standing, no non-consented binding executes — for bindings. C6 is the same property lifted from bindings to interactions.

**Cross-check: Alloy** for the static half — no principal that all paths route through (exit, per `itron-hub-patent-boundary-p2p-is-the-upgrade`: hubs are enforced, oracles are chosen, and the discriminator is exit).

**Wrong-tool cost, and it is the sharp one:** a fresh spec risks dropping the **non-penalty** clause, which is the clause distinguishing negotiation from coercion. A "you may refuse" model with no standing-cost variable is the vacuity class — **a refusal you cannot afford is not a refusal.**

**Why this matters beyond the invariant:** negotiation-against-local-policy is exit made mechanical, which is also how the design interfaces with hyperscalers (a cloud is a counterparty that must satisfy local policy, not a platform we sit on) and how it stays clear of the Itron hub-and-agent claims by construction.
