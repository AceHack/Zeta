---
id: 081M21M7FVZ087G0R000PNH46E
type: task
state: backlog
priority: P2
slug: d10-blockcas-put-writes-next-slot-from-memory
title: "D10 BlockCas Put writes next slot from memory"
created: 2026-09-08T23:04:10.367Z
depends_on: ["081M21J21NE087G0R002X2K0QN"]
composes_with: []
---

# D10 BlockCas Put writes next slot from memory

BlockCas.Put copied the index and parseCas'd both superblock slots on
every object. It now writes the next slot from the in-memory index.
A 1-byte follow-up Put reads at most the payload LBA. Recovery stays
toy. Not Apple.
