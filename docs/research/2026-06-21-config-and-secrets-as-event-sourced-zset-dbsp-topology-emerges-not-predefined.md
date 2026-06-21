# Config + secrets are event-sourced (Z-set / DBSP) — the topology EMERGES from incremental events, not pre-defined desired-state

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** direction (reframes the multi-owner-machine decision) · **Trajectory:** cluster-encryption-credential-substrate

## The reframe (Aaron, 2026-06-21, verbatim)

> "The 7 machines are just an example, the actual topo — we want the topo to be automatic
> and dynamic based on incremental actions, not needing to pre think everything first. I'm
> basically trying to setup zset/DBSP like for config/secrets setup too — **events lead to
> the setup, not pre-defining everything.**"

This supersedes the *source-of-truth* assumption in
`docs/DECISIONS/2026-06-21-multi-owner-machines-identity-vs-authorization-ssh-ca-bootstrap.md`
and the static `machines/principals.json` map shipped with it (PR #8973). The model
(identity vs authorization split; O(N+M)) stays correct. What changes: **the ownership
table is NOT hand-authored desired-state — it is a materialized VIEW over an event log.**

## The shape: Zeta's own substrate, applied to config/secrets

This is not new machinery — it is **DBSP / Z-sets / git-as-event-store** (the substrate the
whole factory is built on) pointed at configuration and secrets:

- **Events, not desired-state.** You never pre-enumerate the topology. You append facts as
  they happen: `GrantUser(aaron, machineD)`, `RevokeUser(max, machineF)`, `OnboardUser(dana)`,
  `AddMachine(G)`. The setup *follows from* the events.
- **Z-set deltas.** A grant is `+1`, a revoke is `−1` (a **retraction** — the antiparticle,
  per [[user_aaron_feynman_is_the_root_anchor_technique_and_sees_feynman_diagrams_of_distributed_systems]]).
  The authorization relation is the Z-set sum of all deltas. Grants compose as an idempotent
  G-Set union (re-applying a grant is a no-op — manifesto §12 idempotency); revoke is the
  signed retraction, not a duplicate-guard.
- **DBSP incremental view maintenance.** The current authorization state — and everything
  downstream (the `AuthorizedPrincipalsFile` per host, the set of certs to (re)sign) — is an
  **incrementally maintained view** over the event stream. Append one `GrantUser` event →
  only the affected host's view recomputes, not the world. This is exactly what DBSP buys.
- **git-as-event-store.** Commits are the event log (already the factory's pattern); the
  fold over them is the materialized config. Replayable (DST), idempotent, mergeable.

## What this does to the multi-owner artifacts

| Layer | Before (PR #8973) | After (this reframe) |
|---|---|---|
| Source of truth | `machines/principals.json` (hand-authored map) | an **event log** (grant/revoke/onboard/add-machine) |
| `machines/principals.json` | the input you edit | a **materialized view / snapshot** of folding the log (still fine as a cache the nix layer reads) |
| `AuthorizedPrincipalsFile` (nix) | rendered from the static map | rendered from the **incrementally-maintained view** (downstream of the fold) — render layer unchanged |
| Adding Dana to D+G | edit the map by hand | append `OnboardUser(dana)` + `GrantUser(dana,D)` + `GrantUser(dana,G)`; the view recomputes |
| Removing access | delete a line | append `RevokeUser(...)` (a `−1` retraction; the history is preserved, not erased) |

The **downstream stays**: certs, `AuthorizedPrincipalsFile`, `op`/Vault all consume the
materialized view. We are inserting an **event log + fold** *above* the static map, and
demoting the map from source to snapshot. No rework of the signer or the nix render.

## Why this is the right shape (not over-engineering)

It is the **founding event-sourcing thesis applied to infrastructure** — the same insight
that started Zeta ([[zeta-origin-event-sourcing-plan-amara-coauthor-maxlength-loss-bootstrap-repair]]):
you don't pre-define the end state and lose the path; you record the incremental facts and
the state is their fold. For config/secrets this means: no big-design-up-front topology, no
"pre-think everything" — the cluster's authorization shape is *whatever the events say it is*,
recomputed incrementally, replayable, auditable (every grant/revoke is a recorded event with
provenance), and revocable by retraction.

It also composes with the seven always-active disciplines: scale-free (fold works at 1 or N
machines), DST (replay the event log), DV2.0 (events = immutable hub satellites; the view =
fast-changing materialized cache), idempotency (grant = G-Set union), noninterference (every
config change enters as a declared, metered event — no ambient edits).

## Concrete next steps (deferred — direction captured, not built)

1. Define the config/secret **event schema** (Grant/Revoke/Onboard/AddMachine/…) as a Z-set.
2. The **fold**: event log → authorization relation → materialized `principals.json`-shaped view.
   Reuse the existing DBSP/Z-set substrate (`src/Core/ZSet.fs`, the git-as-event-store fold).
3. Keep `principals.json` as the materialized snapshot the nix layer reads (no downstream change).
4. CLI/agent action = **append an event** (`op`-gated for secrets), never hand-edit the map.

Bootstrap-honest: the static map shipped (#8973) is the **degenerate fold** of an empty event
log seeded with today's reality (`acehacks-mac-studio.local → [aaron]`). The reframe adds the
log + fold above it incrementally — nothing to throw away.

## Anchors

DBSP (Budiu et al., *DBSP: Automatic Incremental View Maintenance*); Z-sets / differential
dataflow (McSherry et al.); event sourcing (Fowler); CRDT G-Set + retraction (Shapiro et al.);
git-as-event-store (the factory's own fold pattern). In-repo: `src/Core/ZSet.fs`,
[[dv2-data-split-discipline-activated]], the cluster-encryption-credential-substrate trajectory.
Supersedes the static-map *source* assumption in the 2026-06-21 multi-owner decision (model intact).
