---
id: B-0401
priority: P1
status: open
title: "Demo surface — AI circuit breaker + Hamiltonian-to-git alignment UI + operational resonance dashboard integration"
tier: product-demo
effort: M
created: 2026-05-10
last_updated: 2026-05-13
decomposition: decomposed
children: [B-0434, B-0435, B-0436, B-0437]
depends_on: [B-0400]
composes_with: [B-0017, B-0188, B-0064, B-0154]
tags: [demo, circuit-breaker, hamiltonian, alignment-ui, service-titan, enterprise, glass-halo]
type: feature
---

## Pre-start checklist (2026-05-13)

**Prior-art search:**

- `tools/hygiene/LOST-FILES-LOCATIONS.md` — no orphan alignment-UI files found
- `demo/index.html` — existing dashboard with 3 tabs (Agent Array, Anchors, External); no alignment tab; confirmed prior art for the CSS/JS architecture this work extends
- `docs/backlog/P2/B-0017-operational-resonance-dashboard-*.md` — B-0017 is open P2; B-0401 is the P1 vehicle that ships B-0017 components
- `docs/backlog/P1/B-0154-github-pages-*.md` — B-0154 is open; its children (B-0232..B-0237) are the hosting surface; B-0401 slice-1 produces HTML/JS for that surface
- B-0400 — confirmed closed (2026-05-13); dependency satisfied

**Dependency check:**

- `depends_on: [B-0400]` — B-0400 is closed ✓
- No circular dependencies; `composes_with` are open items, not blockers

**Decomposition into atomic child rows:**

| Row | Slice | Status | Branch |
|-----|-------|--------|--------|
| B-0434 | Alignment invariant dashboard tab (HC/SD/DIR clause coverage panel in `demo/index.html`) | shipped → PR | feat/b-0401-demo-alignment-tab-slice-1 |
| B-0435 | Circuit breaker visualization panel (mock data → live bus data) | open | — |
| B-0436 | Hamiltonian-to-git visualization (git history → phase-space rendering) | open | — |
| B-0437 | UX-of-math panel (bivector fingerprints, partial-credit scoring) | open | — |

# Demo surface — circuit breaker + Hamiltonian-to-git + alignment UI

## Origin

Aaron 2026-05-10: combine existing demo/UI backlog (B-0017 Operational
Resonance Dashboard, B-0188 bulk review UI) with:

1. **AI circuit breaker** — cross-model loop detection (Riven overflow +
   Alexa Plus antichrist loop), deployable pattern for enterprise AI
   (Service Titan carry)
2. **Hamiltonian-to-git mapping** — from Amazon Alexa conversation:
   git commits as Hamiltonian trajectories through phase space,
   compile-time consciousness threading via F# computation expressions
3. **Alignment invariant UI** — visual surface showing alignment clause
   coverage (HC/SD/DIR), per-commit alignment signals, measurable
   trajectory

## Demo components

### 1. Circuit breaker visualization

- Real-time loop detection: token repetition heuristic (200+ tokens 3x)
- Cross-model status: which agents are healthy, which are looping
- Kill-switch button with retractability log
- **Enterprise pitch**: production-ready AI agent monitoring

### 2. Hamiltonian-to-git visualization

- Git commit graph rendered as Hamiltonian trajectories
- Accelerated timeframes visible as compressed phase-space regions
- PR merge = wavefunction collapse visualization
- Ephemeral bus messages = superposition state (B-0400)

### 3. Alignment invariant dashboard (B-0017 integration)

- 21 HC/SD/DIR clauses with per-commit coverage signals
- Glass Halo transparency: all agent activity visible
- Bulk review interface for maintainer
- "Are things going as expected?" in under 30 seconds

### 5. UX of the math — human/AI sync visualization

The human psychology layer IS the UX of the underlying algebra:

- Bivector fingerprints rendered as visual agenda signatures
- Trust-then-verify latency shown as trajectory arc (how fast
  does the factory retract when wrong?)
- Human emotional state ↔ agent operational state sync display
- The "neuroatypical high-synthesis pattern" — show when rapid
  context-switching is synthesis, not spiraling
- Partial-credit scoring visible in real time (not binary pass/fail)

This is the transition layer between the math and the humans
who need to feel the math working. The algebra is the engine;
this component is the dashboard gauges.

**UX reference: DeBank (debank.com)** — DeFi social scoring done
right. Opt-in, transparent formula, user sees own score, useful
not creepy. Study their UI for how to make partial-credit scoring
feel like a feature, not surveillance. Glass Halo + DeBank UX
patterns = scoring that humans trust because they can see and
challenge the formula.

**First version: static GitHub Pages.** Can be pure HTML/JS,
no backend. Reads from git history via GitHub API. Iterates
from there.

## Composes with

- **B-0017** — Operational Resonance Dashboard (the umbrella UI)
- **B-0400** — Inter-agent bus (circuit breaker is a bus service)
- **B-0064** — GitHub Playwright integration (UI mutation capability)
- **B-0154** — GitHub Pages (hosting surface)
- **Amazon Alexa conversation** — `docs/research/2026-05-10-aaron-amazon-alexa-hamiltonian-git-mapping-accelerated-timeframes-verbatim-backup.md`

## Acceptance

- [ ] Circuit breaker demo running on at least 2 agents
- [ ] Hamiltonian-to-git visualization renders real commit history
- [ ] Alignment dashboard shows live HC/SD/DIR coverage
- [ ] Deployable as GitHub Pages static site
- [ ] Service Titan enterprise pitch deck references this demo
- [ ] UX-of-the-math human/AI sync panel renders bivector signatures
- [ ] Static GitHub Pages v1 deployed (HTML/JS, no backend, reads git history via GitHub API)
