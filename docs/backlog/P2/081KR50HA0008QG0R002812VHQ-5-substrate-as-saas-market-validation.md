---
id: B-0029.5
zetaid: 081KR50HA0008QG0R002812VHQ
priority: P2
status: open
title: "B-0029.5 — Survey: substrate-as-SaaS market validation (hosted factory-discipline tooling opportunity)"
created: 2026-05-09
last_updated: 2026-05-09
parent: B-0029
depends_on: []
classification: research-now
type: research
effort: S
decomposition: atomic
---

# B-0029.5 — Substrate-as-SaaS market validation

**Slice of:** [B-0029](B-0029-superfluid-ai-substrate-enabled-autonomous-self-sustaining-funding-sources.md)

## What

Produce a research doc at `docs/research/B-0029.5-substrate-saas-market-validation.md` that answers:

1. Is there a paying market for hosted versions of Zeta's factory-discipline tooling?
2. What comparable hosted AI-factory / agent-loop / formal-verification services exist and at what price points?
3. Which specific Zeta tools have the most external-value potential (ranked):
   - Substrate-graph visualization service (per Otto-244/Otto-345 research)
   - Per-writer heartbeat infrastructure (Otto-240 pattern)
   - AI-factory-discipline-as-a-service for other AI-agent factory operators
   - Formal-verification-as-a-service (Lean/TLA+ harness)
4. What distribution channels exist (ProductHunt, Hacker News, dev-tooling ecosystems)?

The goal is a "viable vs not viable vs too early" verdict with supporting evidence, not a business plan.

## Acceptance criteria

- [ ] `docs/research/B-0029.5-substrate-saas-market-validation.md` committed
- [ ] At least 3 comparable hosted services analyzed (pricing + target market + differentiation)
- [ ] Zeta-specific tools ranked by external-value potential with brief reasoning
- [ ] "Viable / Not viable / Too early" verdict for each candidate tool surface
- [ ] Identifying what Zeta would need to ship before a hosted offering is defensible (the readiness bar)

## Out of scope

- Does NOT build any SaaS infrastructure
- Does NOT evaluate open-source funding (B-0029.1/B-0029.2)
- Does NOT evaluate grants (B-0029.3) or trading (B-0029.4)

## Research surfaces

- Comparable: Linear (project mgmt), Liveblocks (real-time collab), Graphite (stacked diffs), Trunk.io (merge queue)
- AI-agent factory comparables: Modal, Railway, Replicate (infra layer), not direct comparables but pricing signal
- Formal-verification services: any hosted TLA+/Lean service?

## Effort sizing

S — targeted web research; one research doc; no code changes.
