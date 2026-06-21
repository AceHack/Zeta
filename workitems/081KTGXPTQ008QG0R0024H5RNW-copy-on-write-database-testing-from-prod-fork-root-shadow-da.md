---
id: 081KTGXPTQ008QG0R0024H5RNW
type: task
state: backlog
priority: P2
slug: copy-on-write-database-testing-from-prod-fork-root-shadow-da
title: "Copy-on-write database testing from prod (fork root, shadow DAG, prove deltas, promote reviewed) over the Merkle-DAG backend"
created: 2026-06-07T11:32:52.064Z
depends_on: []
composes_with: ["081KTGTJC1Q08QG0R002VCB55A"]
---

# Copy-on-write database testing from prod (fork root, shadow DAG, prove deltas, promote reviewed) over the Merkle-DAG backend

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGXPTQ008QG0R0024H5RNW-*.md` glob. -->

## Purpose

Database testing as a first-class STORAGE primitive (Amara + Aaron 2026-06-07), enabled by the Merkle-DAG /
COW backend (081KTGTJC1Q). The combination — COW fs + content-addressed Merkle DAG + Z-set deltas/
retractions + canonical encoding + deterministic replay + property tests + 4-oracle agreement — gives
fork-from-prod testing most systems structurally cannot have. Full rationale + test modes + safety law:
`docs/research/2026-06-07-cow-database-testing-from-prod-content-addressed-time-travel-and-zetafs-naming-stack-amara.md`.

## Canonical test shape

```
given root R; when command C runs in fork F (COW, R untouched)
then root=R'; delta=D; invariants hold; replay(D,R)=R'; retraction(D) returns to R
```

## Test FROM prod (not ON prod) — the prod-shadow lane

Fork the prod root into a shadow DAG; reads see real prod, writes land in the fork, prod untouched; promote
only reviewed deltas. **Safety law:** a prod-fork test may READ prod state, but all writes, side effects,
secrets, outbound calls, and clocks are redirected into the fork boundary. Prod is the seed, not the victim.

## Hard prerequisite — full determinism

Collapses if the same fork yields different roots. Every nondeterminism source must be declared/virtualized:
collation (081KT07NV0008QG0R001YDB73K), serialization, clocks, randomness, culture, hardware secrets, external side effects.
Depends on 081KT07NV0008QG0R001YDB73K + the determinism contract 081KTGEVV75.

## Acceptance

Fork-from-a-root COW over the content-addressed store; a test asserts root/delta/invariants/replay/
retraction on the fork with prod untouched; the safety-law boundary (writes/secrets/clocks/outbound
redirected) is enforced; at least the unit + property + bug-repro test modes demonstrated.

## Anchors

- depends on 081KTGTJC1Q (Merkle-DAG store) + 081KT07NV0008QG0R001YDB73K (determinism) + 081KTGEVV75 (determinism contract) +
  081KSV2WD0008QG0R00030G6S9 (closure-table fs/FUSE) · DST (manifesto §7). Beacon: Dolt/Neon DB-branching, FoundationDB DST,
  QuickCheck shrinking, ZFS/APFS/btrfs COW.
