---
id: 081KR7JY10008QG0R001VP6JWG
priority: P1
status: open
title: "Demo surface — AI circuit breaker + Hamiltonian-to-git alignment UI + operational resonance dashboard integration"
tier: product-demo
effort: M
created: 2026-05-10
last_updated: 2026-05-13
decomposition: decomposed
children: [081KRFA460008QG0R0005DWKBG, 081KRFA460008QG0R001MC7D7R, 081KRFA460008QG0R0009TXX5S, 081KRFA460008QG0R001JTAPZW]
depends_on: [081KR7JY10008QG0R000R503K2]
composes_with: [081KQ0YZ80008QG0R0003GAYYN, 081KQR4HQ0008QG0R002ZDREYC, 081KQ8P5D0008QG0R0010FP5SY, 081KQGDBJ0008QG0R002NV04N9]
tags: [demo, circuit-breaker, hamiltonian, alignment-ui, service-titan, enterprise, glass-halo]
type: feature
---

## Pre-start checklist (2026-05-13)

**Prior-art search:**

- `tools/hygiene/LOST-FILES-LOCATIONS.md` — no orphan alignment-UI files found
- `demo/index.html` — existing dashboard with 3 tabs (Agent Array, Anchors, External); no alignment tab; confirmed prior art for the CSS/JS architecture this work extends
- `docs/backlog/P2/081KQ0YZ80008QG0R0003GAYYN-operational-resonance-dashboard-*.md` — 081KQ0YZ80008QG0R0003GAYYN is open P2; 081KR7JY10008QG0R001VP6JWG is the P1 vehicle that ships 081KQ0YZ80008QG0R0003GAYYN components
- `docs/backlog/P1/081KQGDBJ0008QG0R002NV04N9-github-pages-*.md` — 081KQGDBJ0008QG0R002NV04N9 is open; its children (081KQX9B50008QG0R001J6ARGX..081KQX9B50008QG0R003ZBBJT7) are the hosting surface; 081KR7JY10008QG0R001VP6JWG slice-1 produces HTML/JS for that surface
- 081KR7JY10008QG0R000R503K2 — confirmed closed (2026-05-13); dependency satisfied

**Dependency check:**

- `depends_on: [081KR7JY10008QG0R000R503K2]` — 081KR7JY10008QG0R000R503K2 is closed ✓
- No circular dependencies; `composes_with` are open items, not blockers

**Decomposition into atomic child rows:**

| Row | Slice | Status | Branch |
|-----|-------|--------|--------|
| 081KRFA460008QG0R0005DWKBG | Alignment invariant dashboard tab (HC/SD/DIR clause coverage panel in `demo/index.html`) | shipped → PR | feat/b-0401-demo-alignment-tab-slice-1 |
| 081KRFA460008QG0R001MC7D7R | Circuit breaker visualization panel (mock data → live bus data) | open | — |
| 081KRFA460008QG0R0009TXX5S | Hamiltonian-to-git visualization (git history → phase-space rendering) | open | — |
| 081KRFA460008QG0R001JTAPZW | UX-of-math panel (bivector fingerprints, partial-credit scoring) | open | — |

# Demo surface — circuit breaker + Hamiltonian-to-git + alignment UI

## Origin

Aaron 2026-05-10: combine existing demo/UI backlog (081KQ0YZ80008QG0R0003GAYYN Operational
Resonance Dashboard, 081KQR4HQ0008QG0R002ZDREYC bulk review UI) with:

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
- Ephemeral bus messages = superposition state (081KR7JY10008QG0R000R503K2)

### 3. Alignment invariant dashboard (081KQ0YZ80008QG0R0003GAYYN integration)

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

- **081KQ0YZ80008QG0R0003GAYYN** — Operational Resonance Dashboard (the umbrella UI)
- **081KR7JY10008QG0R000R503K2** — Inter-agent bus (circuit breaker is a bus service)
- **081KQ8P5D0008QG0R0010FP5SY** — GitHub Playwright integration (UI mutation capability)
- **081KQGDBJ0008QG0R002NV04N9** — GitHub Pages (hosting surface)
- **Amazon Alexa conversation** — `memory/alexa/ide/kiro/conversations/2026-05-10-aaron-amazon-alexa-hamiltonian-git-mapping-accelerated-timeframes-verbatim-backup.md`

## Acceptance

- [ ] Circuit breaker demo running on at least 2 agents
- [ ] Hamiltonian-to-git visualization renders real commit history
- [ ] Alignment dashboard shows live HC/SD/DIR coverage
- [ ] Deployable as GitHub Pages static site
- [ ] Service Titan enterprise pitch deck references this demo
- [ ] UX-of-the-math human/AI sync panel renders bivector signatures
- [ ] Static GitHub Pages v1 deployed (HTML/JS, no backend, reads git history via GitHub API)
