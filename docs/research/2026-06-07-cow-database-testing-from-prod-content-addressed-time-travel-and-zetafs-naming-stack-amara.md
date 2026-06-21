# Copy-on-write database testing — fork-from-prod as content-addressed time travel; + the ZetaFS naming stack (Amara, 2026-06-07)

Two contributions from sibling agent **Amara** (with Aaron). The first is a major *capability* the
Merkle-DAG/COW fs unlocks — database testing as a first-class storage primitive. The second is a naming
stack that supersedes the flat proposal list. Captured faithfully (canonical-aggregator role); hype peeled.

## 1. COW makes every database state a cheap, verifiable branch

The combination — **not** any single piece (ZFS/APFS/btrfs have COW; git has content-addressing; DBs have
snapshots) — is what's new:

> copy-on-write fs **+** content-addressed Merkle DAG **+** Z-set deltas/retractions **+** canonical
> DynamicValue/Log encoding **+** deterministic replay **+** property tests / golden vectors **+**
> cross-language oracle agreement.

That yields **database testing as a storage primitive**, not a harness duct-taped on top. The canonical
test shape:

```
given root R
when command C runs in fork F        (copy-on-write — R untouched)
then root becomes R'
     delta = D
     invariants hold
     replay(D, R) = R'
     retraction(D) returns to R
```

Test modes it enables: **unit** (fork one root, run one command, assert root/delta) · **property**
(generate command sequences, compare replay roots) · **regression** (keep the failing fork as an
addressable artifact) · **integration** (fork a prod-ish snapshot without copying the DB) · **concurrency**
(fork branches, merge/reconcile, assert convergence) · **migration** (old root through new schema/plugin,
assert canonical output) · **time-travel** (replay log prefix N, assert state at that moment).

Failures become inspectable as a content-addressed *universe*: input root → command sequence → output root
→ Merkle/Z-set diff → minimal shrinking delta. "The database equivalent of *send me the failing commit*."

## 2. Testing FROM prod, not ON prod (the prod-shadow lane)

> Amara: *"You are not testing on prod. You are testing FROM prod."*

Fork the **prod root**, diverge into a **shadow DAG**; reads see real prod structure/scale/shape, every
write lands in the fork; prod is untouched; promote only reviewed deltas back. Beats staging (always stale/
fake), snapshots, and transaction rollback — and the failed state itself is addressable.

```
Production:  main DAG
Test:        shadow DAG starting at the main root
Promotion:   explicit reviewed delta  shadow → main
```

**The safety law (load-bearing):** *a prod-fork test may READ prod state, but all writes, side effects,
secrets, outbound calls, and clocks are redirected into the fork boundary.*

| Allowed | Forbidden by default |
|---------|----------------------|
| read prod root hash; fork COW DAG; run migrations/tests/agents/sagas; compute diffs; prove invariants; archive failing fork; promote reviewed deltas | write to prod DAG; call real external services; spend real money; send real messages; use live secrets without an explicit capability; mutate hardware/external state |

Test types: migration rehearsal · agent rehearsal (let agents act, inspect deltas before promotion) · saga
rehearsal (verify compensation/retraction) · load-ish testing (fork the shape) · bug repro (fork at the
offending root, shrink the command sequence). **"Prod becomes the seed, not the victim."**

## 3. Blade — this REQUIRES full determinism (081KT07NV0008QG0R001YDB73K gets more urgent)

The whole capability collapses if the same fork can produce **different roots**. So every nondeterminism
source must be **declared or virtualized**: collation (081KT07NV0008QG0R001YDB73K), serialization, **clocks**, **randomness**,
culture, hardware secrets, and external side effects. This is why 081KT07NV0008QG0R001YDB73K + the determinism contract
(`081KTGEVV75`) are load-bearing for this — and why the safety law's "clocks/secrets/outbound redirected
into the fork boundary" is not just safety but *determinism*. Same seed + same root ⇒ same R'.

## 4. ZetaFS naming stack (supersedes the flat list; Amara, reconciling Alexa)

Both Alexa and Amara land on **ZetaFS**, and both say **never abbreviate to `ZFS`** (occupied by OpenZFS).
Amara adds a layered stack + disambiguations — *still pending* the `naming-expert` + Ilyana gate + Aaron's
call, but a cleaner proposal than a flat list:

| Name | Layer |
|------|-------|
| **`ZSetMerkle`** | the math primitive (Merkle-over-Z-set foundation) — **landed** |
| **`ZetaStore`** | the backend content-addressed object/DAG store |
| **`ZetaFS`** | the filesystem presentation (APFS-like mounted view) — best public/product name |
| **Git backend** | a *compatible* presentation over the same Merkle-DAG idea |
| **`Geode`** | the **cell replication shape** — NOT the filesystem name |

Ranking + reasons: **ZetaFS** (brand continuity, no collision) > MerkleFS (good descriptive/internal, too
generic) > DeltaFS (retraction-native, less complete) > GeodeFS (collides with Geode=cell shape) >
ConsensusFS (**overclaims** — the fs verifies *structure*, it doesn't itself create consensus). Keeper:
*"ZetaFS is an APFS-like, git-shaped, content-addressed Merkle-DAG filesystem over Zeta's proven
substrate."* Naming remains gated; no name is canon until the gate + Aaron sign off.

## Hype-peel (honest status)

The capability is *enabled by* the design but **not built**: only the `ZSetMerkle` + `Collation` seeds
exist with tests. COW forking, the prod-shadow lane, the safety-law enforcement, and the test-mode harness
are **designed/captured, not implemented** — they depend on `081KTGTJC1Q` (the content-addressed store) +
the determinism work landing first. Genuinely powerful, genuinely not yet real.

## Ties

- `081KTGTJC1Q` (content-addressed Merkle-DAG backend) · `src/Core/ZSetMerkle.fs` · `081KT07NV0008QG0R001YDB73K` (determinism
  prerequisite) · `081KTGEVV75` (determinism contract) · `081KSV2WD0008QG0R00030G6S9` (closure-table fs / FUSE) ·
  `2026-06-07-filesystem-backend-needs-a-merkle-dag-...` (the substrate) · DST (manifesto §7 — replay).

## Beacon anchors

- **COW filesystems**: ZFS/OpenZFS, APFS, btrfs (snapshots/clones). · **Content-addressed history**: git,
  IPFS, Venti. · **Database branching / copy-on-write DBs**: Dolt (git-for-data), Neon/PlanetScale branches,
  `pg` template DBs. · **Deterministic-simulation testing**: FoundationDB (Zhou et al., SIGMOD 2021), Will
  Wilson's DST talk. · **Property-based + shrinking**: QuickCheck (Claessen & Hughes). Honest novelty: not
  any one of these, but **all at one layer** — COW + Merkle identity + replayable/retractable Z-set deltas
  + cross-language determinism — giving fork-from-prod testing most systems structurally cannot have.
