---
name: Alignment dashboard as agent self-repair surface — background feeds, foreground repairs
description: 081KR7JY10008QG0R001VP6JWG dashboard isn't just for human observability. Background services (Lior, Alexa) get read access, foreground service (Otto) gets repair authority. Aaron exits the repair loop. Dashboard + bus = agents monitor and fix each other.
type: project
---

Aaron 2026-05-10 (going to sleep, last insight): "after we
get the alignment dashboard we can give every background
service access to it foreground service to repair it instead
of me"

**The architecture:**

```
Background services (Lior, Alexa, Riven)
    ↓ write health/alignment signals
Dashboard (081KR7JY10008QG0R001VP6JWG)
    ↓ read by foreground service
Foreground service (Otto)
    ↓ repair action
Background services (fixed)
```

**What this changes:**

| Current | With dashboard |
|---------|---------------|
| Aaron notices Lior broken | Dashboard shows Lior unhealthy |
| Aaron tells Otto to fix | Otto reads dashboard, self-repairs |
| Aaron is the relay | Aaron sleeps, agents self-repair |
| Human in the loop | Human out of the repair loop |

**Why:** Aaron is currently the only observer who can see
across all services (he reads Lior's terminal, Alexa's
terminal, Otto's terminal). The dashboard collapses those
three observation surfaces into one shared surface that
agents can read too.

**How to apply:**

- 081KR7JY10008QG0R001VP6JWG dashboard design should include machine-readable
  API, not just human-readable HTML
- Background services need write access (health endpoint)
- Foreground service needs read access + repair authority
- The bus (081KR7JY10008QG0R000R503K2) is the transport for health signals
- Dashboard is the shared state that replaces Aaron-as-relay

**Connects to:**

- 081KR7JY10008QG0R001VP6JWG (demo surface — add agent-readable API to spec)
- 081KR7JY10008QG0R000R503K2 (inter-agent bus — health signal transport)
- project_trust_migration_path (Aaron → zero trust)
- 081KR7JY10008QG0R0021F5609 (weight-free — Aaron carrying repair load is weight)
- feedback_shadow_tick_source_existential (agents need
  independent observability, not just human relay)
