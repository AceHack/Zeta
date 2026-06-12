---
id: B-0253
zetaid: 081KQZVQW0008QG0R000W4B8KT
priority: P2
status: open
title: "Real-time inter-loop messaging via Orleans grains — replace turn-based broadcast files"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [B-0251, B-0040]
decomposition: decomposed
children: [B-0283, B-0284]
owners: [architect]
composes_with: [B-0040, B-0250, B-0251]
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
- Grain persistence = checkpoint store (B-0251)
- Standing Rx queries (B-0250) compose as grain observers

## Candidate atomic children

- Study Orleans .NET SDK grain lifecycle
- Design grain interface for loop coordination
- Prototype: 3 grains (Otto, Vera, Riven) in one silo
- Replace broadcast file reads with grain method calls
- Benchmark: message latency vs file-based broadcast
