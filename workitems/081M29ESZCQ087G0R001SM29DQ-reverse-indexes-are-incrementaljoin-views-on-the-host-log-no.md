---
id: 081M29ESZCQ087G0R001SM29DQ
type: task
state: backlog
priority: P1
slug: reverse-indexes-are-incrementaljoin-views-on-the-host-log-no
title: "Reverse indexes are IncrementalJoin views on the host log, not git blobs"
created: 2026-09-12T00:03:20.087Z
depends_on: ["081M26HWSZ6087G0R00373BN0Q", "081M245GDBN087G0R000QWR0M4"]
composes_with: []
---

# Reverse indexes are IncrementalJoin views on the host log, not git blobs

Aaron 2026-09-11: reverse indexes as materialized views; git-native jsonl is a
toy and costs tens of MB on main. Store is GroupCommitDiskDeltaLog.
CitedByIndex = entities ⋈ cites. SearchIndex = query ⋈ postings.
Cite-before-entity still lands (fairness). Cadence must not flush shards
onto main (#16919). Not Apple. Not FUSE.
