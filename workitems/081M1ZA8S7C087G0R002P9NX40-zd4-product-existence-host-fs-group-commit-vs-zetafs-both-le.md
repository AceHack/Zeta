---
id: 081M1ZA8S7C087G0R002P9NX40
type: task
state: backlog
priority: P1
slug: zd4-product-existence-host-fs-group-commit-vs-zetafs-both-le
title: "ZD4 product-existence: host FS group-commit vs zetafs both legs run"
created: 2026-09-08T01:31:38.092Z
depends_on: ["081M1HGD1QA087G0R001GRHPFW"]
composes_with: ["081M1C59ZG4087G0R000VM8DZN", "081M1HNCGN8087G0R000ZK7ZGX"]
---

# ZD4 product-existence: host FS group-commit vs zetafs both legs run

First peel: both legs of the ZetaDB small-write storm RUN on
PhysicalFileSystem (host APFS/ext4). Host:
`GroupCommitDiskDeltaLog` 16 concurrent appends → one `delta-*.segment`.
`.zetafs`: 16 Journaled `freezeAsync` + `pumpLog` → one boat of 16.
N=16 because BlockCas's one-superblock index cannot hold 32 unique
1-byte jumpropes. No Stopwatch. No winner. Numbers stay `toy`. Not FUSE.
Not Apple Developer Program. Falsifier:
`tests/Tests.FSharp/Storage/Zd4ProductExistence.Tests.fs`. Bench
skeleton: `bench/Benchmarks/Zd4ProductExistenceBench.fs` — do not copy
numbers into README.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1ZA8S7C087G0R002P9NX40-*.md` glob. -->
