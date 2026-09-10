---
id: 081M21NVSJ2087G0R002J9WVRP
type: task
state: backlog
priority: P2
slug: d10-blockcas-putmany-publishes-the-superblock-once
title: "D10 BlockCas PutMany publishes the superblock once"
created: 2026-09-08T23:32:44.226Z
depends_on: ["081M21M7FVZ087G0R000PNH46E"]
composes_with: []
---

# D10 BlockCas PutMany publishes the superblock once

A freeze item's jumprope objects used to Put (payload + superblock) each.
PutMany appends every new payload then writeCasFromIndex once. Freeze
putLeaves uses it. Recovery stays toy. Not Apple.
