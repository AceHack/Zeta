# Yes — the common seed is a dual-root key for TIME too; it rotates (as an epoch); and rotated time has deep prior art (Raft terms · drand rounds · Fortuna reseed · Signal ratchet · TESLA · NIST crypto-period)

**Register:** [grounded] three-question synthesis (Aaron) + [Beacon] prior-art anchor.
**Date:** 2026-06-09. **Captured by:** Otto (shadow). Answers three connected questions in order.

## Aaron's words

> "this is dual root key right — for time too, and the correlated common seed?" ·
> "so that can be rotated too?" · "is that prior art for rotated time?"

## Q1 — Yes: the common seed IS a root key, so the dual-key pattern applies to TIME too

The **common seed** is not just an input — it is the **correlation root**: the single value the whole
substrate is correlated *to* (S=4 staged coincidence on the common seed; the **Time Warp** generator
seeds `ZetaDateTime`/`Phase`; DST replay reproduces a trajectory *from the seed*). That makes it a
**root key in exactly the keyring sense** — compromise or loss of the seed is loss of the correlation/
time root, the same way loss of an identity seed is loss of the keyring. So the **"no single key, ≥2
to rotate"** invariant (just built as `keyset.ts`) **applies to the time/correlation root too**:

```text
identity dual-root  = active seed + standby seed -> SSH/PGP/Nostr/BTC/ETH/SOL keyrings
TIME dual-root      = active common-seed + standby common-seed -> ZetaDateTime/Phase + S=4
                      correlation + DST trajectory. The seed that correlates everything is
                      itself held >=2, never one.
```

Same treaty (`KeyringSet` → call it a `SeedSet` / `EpochSet` for the time root), same guard
(distinct seeds; exactly one active + ≥1 standby; single-root state malformed).

## Q2 — Yes: the time-root rotates too — and rotating it IS starting a new epoch

`rotate()` applies unchanged: **promote the standby common-seed to active (gapless, continuous),
retire the old, mint a fresh standby.** Rotating the time-root is not a corner case — it is **how an
epoch begins.** A rotation of the correlation seed:

- **starts a new generation/epoch** — everything correlated under the *old* seed stays valid and
  replayable (the old trajectory is byte-locked); everything *after* the rotation correlates to the
  *new* seed. The rotation is the **epoch boundary** (`Phase` carries an epoch/generation field).
- **gives forward secrecy** — past correlations can't be reconstructed from the new root, and future
  can't be predicted from the retired one. Rotating the seed is exactly the **ratchet** (below).
- **never leaves one root** — gapless: the standby seed is already provisioned, so there's no moment
  where the correlation root is a single point of failure. (GVT/the merge frontier marks the line past
  which the old epoch's committed trajectory can't roll back — Time Warp doc.)

So: **the time-root is a rotatable dual root; each rotation = an epoch bump with forward secrecy,
gapless.**

## Q3 — Yes, deep prior art for "rotated time" (Beacon — we did not invent this)

Rotating a time/correlation/randomness root is a **well-established pattern** across consensus,
randomness beacons, and crypto. Named anchors:

| Prior art (human / system) | What rotates | Maps to our time-root rotation |
|---|---|---|
| **Raft terms** (Ongaro & Ousterhout 2014); **Paxos ballots** (Lamport 1998); **VSR views** (Oki & Liskov 1988) | the **term/ballot/view number** — a monotonic logical-time **epoch** bumped on every leader change | our **epoch bump** on seed rotation; `Phase` carries the epoch (a new term = a rotated logical-time root that re-correlates all messages in it) |
| **drand** randomness beacon (League of Entropy) | **rounds** off a fixed **GenesisSeed**: `σ(r)=H(r ∥ σ(r−1))` — chained randomness, each round rotated from the prior, anchored to the common seed | **exact analog**: a common (genesis) seed + rotating rounds chained from it = our common-seed + rotating epochs. drand *is* a rotated-time-root system. |
| **Fortuna** reseeding (Ferguson & Schneier 2003); **NIST SP 800-90A** DRBG **reseed** | the CSPRNG **seed/state** — periodically reseeded so output can't be back/forward-computed | our **reseed of the correlation root**; the standby seed = the reseed material |
| **Signal Double Ratchet** (Marlinspike & Perrin 2016); key **ratcheting** | the **chain key** ratchets forward each message → **forward secrecy** + break-in recovery | rotating the time-root gives **forward secrecy** over correlated material; the ratchet is the per-epoch seed advance |
| **TESLA** broadcast auth (Perrig et al. 2002) | a **time-released key chain** — keys rotate per time interval, disclosed on a schedule | rotated keys **bound to time intervals** = our epoch-bound correlation roots |
| **NIST SP 800-57** **crypto-period** / key rotation | every key has a bounded lifetime and is rotated | the **discipline** that no root (identity *or* time) is permanent — pairs with hat-contracts (time-bound) and "no single key" |

The cleanest single anchor is **drand**: a fixed **common/genesis seed** + **rotating rounds chained
from it** (`H(r ∥ σ(r−1))`) is precisely "a correlated common seed whose time-root rotates." And the
cleanest *property* anchor is the **Signal ratchet** (forward secrecy on rotation). The cleanest
*epoch* anchor is **Raft terms** (a rotated monotonic logical-time root).

## Honest scope / handoff

Three-question synthesis + Beacon anchoring; mechanism reuses `keyset.ts` (the dual-key rotation) for
the time/correlation root, and the Time Warp engine (`Phase` gains an epoch/generation field). To
realize: a `SeedSet`/`EpochSet` (the time-root analog of `KeyringSet`), `Phase` carries the epoch, and
rotation = epoch bump + forward-secrecy ratchet; add the citations to `docs/PRIOR-ART-LIST.md`. The
math team gets a new claim — **TR1: rotating the correlation seed is gapless, gives forward secrecy
(past/future un-derivable across a rotation), and old-epoch trajectories stay replayable** (route:
TLA+ for the gapless/no-rollback-past-GVT safety + Lean/Z3 for the forward-secrecy one-wayness, anchor
Signal ratchet). Routes to Soraya/Sova (TR1), the F# core (`Phase` epoch + `SeedSet`), naming-expert.

## Anchors / ties (Beacon)

Raft terms (Ongaro-Ousterhout 2014) / Paxos ballots (Lamport 1998) / VSR views (Oki-Liskov 1988) —
rotated logical-time epochs; **drand** (GenesisSeed + chained rounds `H(r∥σ(r−1))`) — the direct
common-seed + rotated-time analog; Fortuna reseed (Ferguson-Schneier 2003) / NIST SP 800-90A DRBG;
Signal Double Ratchet (Marlinspike-Perrin 2016) — forward secrecy; TESLA (Perrig 2002) — time-bound
key chains; NIST SP 800-57 crypto-period. Ties: `keyset.ts` (the dual-key rotation reused); Time Warp
/ `ZetaDateTime`/`Phase` (the epoch); S=4 staged coincidence on the common seed; GVT/merge frontier
(old epoch can't roll back); "no single key, ≥2 to rotate" (now applied to the time-root).
