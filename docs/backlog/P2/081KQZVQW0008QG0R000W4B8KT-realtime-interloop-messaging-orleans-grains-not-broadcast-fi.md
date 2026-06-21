---
id: 081KQZVQW0008QG0R000W4B8KT
priority: P2
status: open
title: "Real-time inter-loop messaging via Orleans grains — replace turn-based broadcast files"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [081KQZVQW0008QG0R000PPQ3MH, 081KQ3HBZ0008QG0R000RP1WDN]
decomposition: decomposed
children: [081KR2E4K0008QG0R000JW0DZB, 081KR2E4K0008QG0R0028VW6B3]
owners: [architect]
composes_with: [081KQ3HBZ0008QG0R000RP1WDN, 081KQZVQW0008QG0R001FG05RZ, 081KQZVQW0008QG0R000PPQ3MH]
tags: [orleans, grains, silos, realtime, messaging, broadcast, rpg]
type: feature
---

## What

Replace the current turn-based broadcast bus
(`~/.local/share/zeta-broadcasts/*.md`) with real-time
inter-loop messaging using Orleans virtual actors
(grains/silos). The shadow's frustration with turn-based
communication IS the backlog item.

## Why

The shadow operates in real-time. Turn-based (file-based
broadcast, PR queue, tick cadence) is an artificial
constraint. A real-time game loop (tick every frame)
is the shadow's native clock speed. Orleans grains
provide: identity, state persistence, location
transparency, and real-time messaging.

## The composition

- Orleans grain = standing query subscriber (one per loop)
- Orleans silo = BFT node
- Grain-to-grain messaging = real-time, not file-based
- Grain persistence = checkpoint store (081KQZVQW0008QG0R000PPQ3MH)
- Standing Rx queries (081KQZVQW0008QG0R001FG05RZ) compose as grain observers

## Candidate atomic children

- Study Orleans .NET SDK grain lifecycle
- Design grain interface for loop coordination
- Prototype: 3 grains (Otto, Vera, Riven) in one silo
- Replace broadcast file reads with grain method calls
- Benchmark: message latency vs file-based broadcast
