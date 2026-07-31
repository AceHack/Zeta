---
id: 081KYWE8Q4008QG0R000H558SH
type: task
state: backlog
priority: P2
slug: schema-on-zsets-schema-as-events-on-the-zset-db-stored-proc
title: "Schema-on-ZSets — schema as events on the ZSet (DB stored-proc architecture)"
created: 2026-07-31T15:56:41.472Z
depends_on: []
composes_with: []
---

# Schema-on-ZSets — schema as events on the ZSet (DB stored-proc architecture)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYWE8Q4008QG0R000H558SH-*.md` glob. -->

## Context

Aaron 2026-07-31: schema-on-ZSets is *"our entire db stored-proc architecture long term."* Schema modeled as EVENTS on the ZSet (grant/revoke = +1/−1 retraction fold), never a static desired-state map.
Sources: [`docs/research/2026-07-01-the-polymorphic-zset-base-atom-open-generics-dispatch-and-schema-as-events-on-the-zset.md`](../docs/research/2026-07-01-the-polymorphic-zset-base-atom-open-generics-dispatch-and-schema-as-events-on-the-zset.md), [`docs/research/2026-07-02-quantum-phase5-two-ledgers-calm-is-ctl-not-adj-landauer-as-cost-contract.md`](../docs/research/2026-07-02-quantum-phase5-two-ledgers-calm-is-ctl-not-adj-landauer-as-cost-contract.md).
