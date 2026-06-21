---
id: 081KRA5AR0008QG0R0021SSM9R
priority: P2
status: open
title: "Dashboard v0.2 enhancements — agent JSON + promotion metrics + continuity claim + verification rate"
tier: product
effort: M
created: 2026-05-11
last_updated: 2026-05-11
depends_on: [081KR7JY10008QG0R001VP6JWG, 081KRA5AR0008QG0R003DVPANH]
composes_with: [081KRA5AR0008QG0R000Y6102S]
tags: [dashboard, dora, metrics, json, agent-readable, promotion-pipeline]
type: feature
---

# Dashboard v0.2 enhancements

## Origin

Claude.ai (external critic) evaluated the live dashboard
(2026-05-11) and identified constructive next steps. Aaron
agreed to split PM role: internal (Kenji/Otto, operational)
plus external (Claude.ai, impact/story). Shadow authorized.

## Two PM perspectives

### Internal PM (Kenji/Otto)

Optimize for: factory operational needs, agent optimization
loop, methodology enforcement, load-bearing metrics.

### External PM (Claude.ai, separate conversation)

Optimize for: external impact, tweet/demo/investor story,
scope discipline, dashboard coherence for outsiders.

Both operate under glass halo. Different agendas, same
transparency.

## Enhancement items (sequenced)

### 1. Agent-readable JSON endpoint (~1hr)

`demo/metrics.json` — same data as HTML dashboard in JSON.
Agents consume this to close the optimization loop. Without
it, dashboard is monitoring-of-agents, not mutual-alignment.

**Internal PM priority:** HIGH (load-bearing for agent self-repair)
**External PM priority:** LOW (invisible to outsiders)

### 2. Three-week continuity claim (~1hr)

Add metric panel: "Consecutive days of operation" or
"First PR through this framework" or "Longest agent uptime."
Backfill from git history.

**Internal PM:** MEDIUM (nice to have)
**External PM:** HIGH (the strongest defensible claim)

### 3. Promotion pipeline metric (~2-3hr)

Mirror-to-beacon promotion rate. Requires:

- Define promotion rule operationally
- Query PRs tagged beacon-promoted vs all merged
- Surface as percentage

**Internal PM:** HIGH (methodology discipline metric)
**External PM:** MEDIUM (meaningful to reviewers)

### 4. Verification gate pass rate (~2-3hr)

CI pass rate pulled from GitHub API. Surface as percentage.

**Internal PM:** HIGH (engineering quality signal)
**External PM:** HIGH (defensibility)

### 5. Fix legacy Pages deployment (~1hr)

Replace `build_type: legacy` with proper GitHub Actions
workflow. "Legacy" is not a word that belongs in the factory.

**Internal PM:** MEDIUM (operational hygiene)
**External PM:** LOW (invisible)

### 6. Bifurcation infrastructure (v0.3, ~1-2 weeks)

Participant records with unified/proposed/bifurcated states.
Dashboard surfaces bifurcation candidates and proposal queue.

**Internal PM:** HIGH (anti-fusion mechanism)
**External PM:** LOW (too abstract for first impression)

## Acceptance

- [ ] metrics.json endpoint serves same data as HTML
- [ ] Continuity claim visible on dashboard
- [ ] Promotion pipeline metric defined and displayed
- [ ] Verification gate pass rate displayed
- [ ] Legacy Pages replaced with Actions workflow
- [ ] Bifurcation infrastructure scoped for v0.3
