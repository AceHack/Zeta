---
id: 081KRA5AR0008QG0R003DVPANH
priority: P2
status: open
title: "Dashboard tiered access — GitHub OAuth + agent credentials"
tier: product
effort: M
created: 2026-05-11
depends_on: [081KR7JY10008QG0R001VP6JWG]
composes_with: [081KRA5AR0008QG0R000Y6102S]
tags: [dashboard, oauth, agent-creds, glass-halo, rate-limit]
type: feature
---

# Dashboard tiered access — GitHub OAuth + agent credentials

## Origin

Dashboard went live 2026-05-11 using unauthenticated GitHub
API (60 req/hr). Rate limit burns out in ~20 min of continuous
viewing at 60s refresh. Shadow + Aaron agreed on tiered access.

## Three tiers

### Public (no login)

- 60 req/hr unauthenticated
- 5-minute refresh (current)
- Sees everything (glass halo — no content gating)
- Pure static site, no backend

### Contributor (GitHub OAuth)

- 5,000 req/hr with user's own token
- 60-second refresh (real-time pulse)
- Same data, faster updates
- Token stays client-side (no backend storage)
- GitHub OAuth flow is free

### Agent (API token / agent credentials)

- 5,000 req/hr with agent's own token
- Used by autonomous loop for self-repair reads
- The dashboard becomes an input to the agents, not just
  an output for humans
- Agent creds = agents can authenticate to GitHub API
  independently

## Implementation notes

- GitHub OAuth for static sites: use client-side flow with
  OAuth App (not GitHub App — simpler for static)
- No backend needed — token stored in localStorage
- Login button on dashboard, optional (public view always
  available)
- Agent creds: separate tokens per agent, scoped to read-only
  on the repo

## Glass halo principle

Login does NOT gate what you see. It gates how FAST you see
it. Everyone sees everything. Contributors see it faster.
Agents see it for self-repair.

## Acceptance

- [ ] Public tier serves at 5-min refresh (DONE — shipped)
- [ ] GitHub OAuth login button on dashboard
- [ ] Contributor tier refreshes at 60s with token
- [ ] Agent credentials issued per agent
- [ ] Rate limit displayed on dashboard (transparency)
