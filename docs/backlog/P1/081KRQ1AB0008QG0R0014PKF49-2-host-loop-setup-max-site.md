---
id: 081KRQ1AB0008QG0R0014PKF49
priority: P1
status: open
title: Host-loop setup for Max's 24/7 site (slice of 081KQZVQW0008QG0R0032TPKT8)
created: 2026-05-16
last_updated: 2026-05-23
parent: 081KQZVQW0008QG0R0032TPKT8
depends_on: []
decomposition: atomic
owners: [infrastructure-operator]
type: feature
---

# 081KRQ1AB0008QG0R0014PKF49 — Host-loop setup for Max's 24/7 site

## What

Mechanize Zeta's repository and compute redundancy by setting up a host-loop at Max's 24/7 site.

## Scope

- Host-loop setup for Max's 24/7 site, using a main-backed control clone instead of a contested root checkout.
- Verify health probes that report host-loop liveness.

## Acceptance criteria

- Max's site has a documented control-clone/launchd or equivalent host-loop setup with health probe output.
