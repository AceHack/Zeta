# Everything is events on ONE DBSP Z-set stream — `db` noun-class built

**Aaron, 2026-06-07** (a stream of refinements after #6995, authorizing the build `shadow*`):

> "build the db noun-class in ZetaCli with pluggable backends … file create/delete/update are just events
> over this infinite file after the deps are set up … deps setup are just events on this dbsp zset stream …
> deps pushdown and jit resolution are just events on the zset stream … most declarative commands end up
> being DUs over imperative commands … unless it's clever declarative that does crdt/cas like things … with
> the usb even the os itself is an event on the stream — the usb created then later inserted and account
> either logged into or their keys forwarded are all same dbsp zset stream"

## The unification

**There is ONE DBSP Z-set stream. Everything is an event (`+1` delta) on it. State is the incremental
fold (DBSP IVM) over the stream.** No layer is special: the file contents, the dependency edges, the
push-downs, the JIT resolutions, and — all the way down — the OS, the USB, the login, the key-forward
are *the same kind of thing on the same stream*.

```
        ── one DBSP Z-set stream (events = +1 deltas; state = fold) ──▶
  bootstrap:   OsInstalled · UsbCreated · UsbInserted · AccountLoggedIn · KeysForwarded
  dependency:  DepSetup · PushDown (kernel/OS, outside container) · JitResolve (DI, inside container)
  data/file:   Create · Update · Delete   (over the single "infinite .fs/.ace" file)
```

"After the deps are set up" is not a phase — it's **stream order**: the `DepSetup`/`PushDown`/`JitResolve`
events precede the data events that need them, on the one stream.

## Declarative lowers to a DU over imperative — except clever-declarative (CRDT/CAS)

- **Most declarative commands lower to a DU over imperative commands.** A declarative `ZetaCommand` set
  is *lowered* into the `DbEvent` (a discriminated union) imperative stream — which is exactly what the
  built `Db.materialize` does (declarative set → topo-linearized → `DbEvent` stream → fold).
- **The exception: clever declarative that does CRDT/CAS-like things** needs *no* imperative ordering,
  because it converges by construction (content-address / idempotent merge). In the build, the
  upsert/tombstone `apply` IS that path: `Files` writes are order-independent and idempotent, so the
  *data* events don't actually depend on imperative sequencing — only the *structural* `DepSetup`
  ordering is the imperative part. (Verified: reordering two independent file writes lands the same
  `Files`.)

## What was built (this PR)

`src/Core/Db.fs` — the `db` noun-class, F# reference oracle, **11/11 tests green**, 0-warning build:

- **`Backend`** = `GitNative` (default, #6994) | `MultiFile` (filesystem) | `SingleFile` (DagFs/
  ContentStore) — pluggable persistence (#6995); the fold is **backend-invariant** (test: same stream →
  same `Files` on every backend).
- **`DbEvent`** (the DU on the one stream) — structural: `DepSetup` / `PushDown` / `JitResolve`; data:
  `Create` / `Update` / `Delete`.
- **`DbState`** = the incremental fold's projections (`Files`, `Deps`, `PushedDown`, `Resolved`).
- **`apply` / `fold`** — deterministic, replayable (DST §7); all upserts/tombstones ⇒ apply-N ==
  apply-once (idempotency #6).
- **`materialize`** — lowers a declarative `db`-seam command set into the stream: `ZetaGraph.topoOrder`
  (#6984) derives one valid linearization, emits `DepSetup` then data events, folds. Cyclic deps →
  `Error` (same contract as `topoOrder`).

## Honest scope (peel)

- **What's built:** the *semantics* layer — the event DU, the fold, backend-invariance, the declarative→
  imperative lowering, dep-order-as-stream-order, idempotency/DST properties — as a pure, tested F#
  oracle.
- **What's NOT built:** the actual backend *storage* drivers (git commit writer, filesystem writer,
  DagFs/ContentStore writer) are not wired — `Backend` is a tag the fold is proven invariant under, not
  three live persisters. The bootstrap events (OS/USB/login/key-forward, #7000) are described as the
  same stream shape but are not modeled as concrete variants here (this module is the file+dependency
  layer; that layer extends the same DU). No JIT/optimal-source *resolution policy* is built (the
  "resolve optimal package manager by criteria" work).
- This is the semantics floor + a named, scoped path to the storage/bootstrap layers — not a finished
  git-backed provisioning engine.

## Anchors (Beacon)

- **DBSP** (Budiu et al. 2022) — incremental view maintenance over Z-set deltas (the one-stream fold).
- **Event sourcing / CQRS** (Fowler; Young) — state = fold over an event log.
- **CRDTs** (Shapiro et al. 2011) / **content-addressing** (Merkle; git; BLAKE3) — the "clever
  declarative" convergent-without-ordering path.
- **Nix / NixOS, Argo CD, declarative provisioning** — declarative configs that lower to imperative
  actions (the "declarative is a DU over imperative" prior art); cloud-init / USB OS imaging for the
  bootstrap-as-events layer.
- Internal: #6994 (db git-native / control plane), #6995 (pluggable backends), #6984 (topoOrder), #6967
  (ZetaCli grammar), manifesto §1 scale-free / §7 DST / §8 DV2.0, idempotency #6.
