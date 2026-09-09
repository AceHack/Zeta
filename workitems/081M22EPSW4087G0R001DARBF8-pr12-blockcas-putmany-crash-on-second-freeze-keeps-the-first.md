---
id: 081M22EPSW4087G0R001DARBF8
type: task
state: backlog
priority: P2
slug: pr12-blockcas-putmany-crash-on-second-freeze-keeps-the-first
title: "PR12 BlockCas PutMany crash on second freeze keeps the first"
created: 2026-09-09T06:46:55.108Z
depends_on: ["081M21NVSJ2087G0R002J9WVRP"]
composes_with: []
---

# PR12 BlockCas PutMany crash on second freeze keeps the first

After freeze A is published, crash-mid-write during freeze B's PutMany
(payload or superblock) keeps A readable on CloneMedia reopen. B is
not. Recovery stays toy. Not Apple.
