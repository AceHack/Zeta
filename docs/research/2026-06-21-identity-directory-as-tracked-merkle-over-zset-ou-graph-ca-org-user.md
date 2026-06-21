# Identity directory = an AD-OU-shaped graph, tracked as a Merkle-over-Z-set DAG (CA → Org → User)

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** synthesis (directory model) · **Trajectory:** cluster-encryption-credential-substrate

## The ask (Aaron 2026-06-21)

> *"It's CA → Org → User, really, generically speaking. We should model this like Active Directory
> OUs, and make that work nicely with our Merkle tree if we can. Also this graph needs to be
> tracked like our deps graph — all our graphs need to be tracked."*

## The model: CA → Org → User generalizes to an AD-OU directory tree

The 3-vault layout (CA / Lucent / Personal) is the degenerate case of a generic **3-tier
hierarchy**, where the names are instances:

- **CA** — the trust root (one). The directory root / domain.
- **Org** — organizational scope. **Lucent, Zeta are *instances* of Org** (N orgs under the CA).
- **User** — individual scope. **aaron, max, addison are *instances* of User** (M users per Org).

This is **Active Directory Organizational Units** (LDAP DIT): a hierarchical tree of containers
(OU → sub-OU → leaf objects: users, groups, service-accounts, machines), where the **path is the
DN** and **policy/permission inherits down the tree** (an Org grant cascades to its Users unless
overridden). It's the classic PKI hierarchy (Root → Intermediate/Org → End-entity) expressed as
an org directory — battle-tested, enterprise/investor-legible, supports delegation + inheritance.

## Backed by our EXISTING Merkle-over-Z-set DAG (don't reinvent)

We already have the substrate (don't build new):

- **Merkle over retractable Z-sets** + a **closure-table DAG** (`src/Core.CSharp.Merkle`,
  `ComputeMerkleRoot*`, `MerkleHash.cs`, "canonical Merkle over Z-set primitive"; PR-6786/6789).
- Content-addressed (BLAKE3 / ZetaId), "a branch is a Merkle root," git/APFS-like dedup store.

Map: each **OU/Org/User node is a content-addressed ZetaId**; the **directory tree is the
Merkle-over-Z-set DAG**; the **Merkle root commits to the whole directory** (tamper-evident — a
single root hash certifies the entire org structure, Certificate-Transparency-style). The **DN /
path** is the route through the DAG. Inheritance = **closure/traversal over the DAG** (the
closure-table already gives ancestor/descendant queries).

## "Tracked like the deps graph" — all graphs are tracked Z-set/Merkle DAGs

Aaron's general principle: **every graph in the system is a tracked graph** — the dependency
graph, AND this identity/OU directory graph, AND others. "Tracked" means:

- **Event-sourced** — mutations (add user, move OU, grant/revoke, rotate key) are **Z-set deltas**
  (revoke/move = retraction); the graph is the fold (the event-sourced-config principle).
- **Incrementally maintained** — DBSP recomputes the Merkle root + closure on each delta (no full
  rebuild); the directory evolves with **0 downtime** (SchemaEvolution over the graph).
- **Verifiable + replayable** — Merkle proofs (prove a User is in an Org; prove the tree is
  untampered); DST-replayable from the event log.
- **One graph machinery, many graphs** — the deps graph and the identity directory share the same
  tracked-Merkle-over-Z-set-DAG substrate; "all our graphs" get versioning/proof/incremental-IVM
  for free. (This is the value of one substrate: a new graph = a new use, not new machinery.)

## The precise structure (Aaron 2026-06-21): a DAG of chains, multi-parented, neighborhood-aware

Not a static tree — more precisely:

- **A DAG of chains.** Each entity (OU/Org/User/key) is a **chain** — a lineage/history (git-branch-
  shaped: a Merkle chain of versioned states, "a branch is a Merkle root"). The directory is the
  **DAG those chains form** as they branch and merge. So it's evolving lineages, not fixed nodes —
  which is exactly why it lives over **retractable Z-sets** (each chain advances/retracts as deltas).
- **Multi-parented leaves (from content-addressing).** Because nodes are **content-addressed**,
  identical content is **one** node referenced by **many** parents (Merkle-DAG dedup) — so a leaf
  legitimately has **multiple parents**. That's why it's a **DAG, not a tree**: shared/deduped
  content is the norm (a key/policy/identity referenced from several OUs is one node, many edges).
- **Neighborhood-aware via 2nd-distance content addressing.** The address isn't only `H(self)` —
  it's **distance/locality-aware to the 2nd degree**, so a node carries awareness of its
  **neighborhood** (its 2nd-degree neighbors), not just its own content. (Ties to the intrinsic-
  distance-metric / orientation-tile / radar-ranging addressing line.) This makes proximity +
  neighborhood queries first-class on the directory DAG, beyond pure ancestor/descendant closure.

So: a **content-addressed, retractable, neighborhood-aware DAG-of-chains** — multi-parent dedup +
locality + lineage — tracked like every other graph.

## How it ties to the rest

- **ZetaId** = node addressing (each OU/Org/User is a ZetaId pointer; in-bit indexing types it).
- **Vaults** = the storage projection of the directory tiers (CA/Org/User vaults = OU nodes); the
  directory is the *structure*, vaults are a *SecretStore-adapter* view of it.
- **Authorization** = grant/revoke as Z-set deltas *scoped to an OU node* (inherits down) — the
  event-sourced authz fold, now hierarchical.
- **Rotation** (Itron KeyState) = a key-state transition on a directory node.
- **Hexagonal / DB-as-PKI** = the DB holds the Merkle-over-Z-set directory natively (crypto baked
  in); the directory IS the PKI/identity store.

## Build (backlog)

Model the CA→Org→User directory as a tracked Merkle-over-Z-set OU DAG (reuse `Core.CSharp.Merkle`
+ the closure-table DAG); nodes = ZetaIds; mutations = Z-set deltas; Merkle root = tamper-evident
commitment; inheritance = DAG closure; expose membership/policy Merkle proofs; same tracking as
the deps graph. Composes with vault-separation (081KVNTNTDQ0 — supersedes its flat CA/Lucent/Zeta/
User list with the generic CA→Org→User tiering), identity+crypto unify (081KVNXBR4S0), crypto-agile
keychain (081KVNYZXQ60), and the ZetaId/hexagonal/event-sourced decisions. (New build workitem to follow.)

## Anchors

Active Directory OUs / LDAP DIT (hierarchical directory + inheritance). Merkle (1979);
Certificate Transparency (Merkle directory, tamper-evidence). DBSP/Z-sets (incremental view
maintenance). In-repo: `src/Core.CSharp.Merkle`, Merkle-over-Z-set + closure-table DAG (PR-6786/
6789/6811), content-addressed store, ZetaId (BLAKE3 treaty), the deps-graph tracking, the
event-sourced + hexagonal + DB-as-PKI decisions (2026-06-21).
