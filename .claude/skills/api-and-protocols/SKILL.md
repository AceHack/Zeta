---
name: api-and-protocols
description: API and protocol surfaces — GraphQL and federation, public-API contract design, wire formats and interfaces.
---

# api and protocols

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`graphql-expert`](blueprints/graphql-expert.md) — "GraphQL — type system, resolvers, N+1/DataLoader, Apollo/Relay/URQL, persisted queries, subscriptions, pagination."
- [`graphql-federation-expert`](blueprints/graphql-federation-expert.md) — "GraphQL federation — Apollo v2 subgraphs, router composition, entity resolution, schema stitching alternatives."
- [`public-api-designer`](blueprints/public-api-designer.md) — Public API design gatekeeper — public type/member/signature changes, internal→public flips, contract review.
