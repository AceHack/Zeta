# ADR: Distributed Identity Provider — Heartbeat-Entropy + Pairwise Verification

Date: 2026-07-08
Status: DECIDED
Author: Aaron (operator) + Kiro (codegen)

## Decision

Zeta is its own distributed identity provider. Identity is not delegated to an
external authority (no OAuth, no certificate authority, no blockchain). Instead,
identity is PROVEN through:

1. Physical entropy from heartbeats (each tick is a unique event)
2. Pairwise decorrelation (two agents prove they're distinct via CHSH bounds)
3. Algebraic non-collapse (CRDT merge can't erase a distinct standing register)
4. Mutual attestation (NFTs = pairwise value-transfer events both parties sign)

No registration. No central issuer. No revocation list. Identity emerges from
observable behavior over time and is verified by peers, not by authority.

## The Identity Stack

From physics to operations, bottom to top:

### Layer 1: Heartbeat Entropy (the physical root)

Every observe loop tick generates entropy from the network: timing jitter, model
output stochasticity, content of the response. Each heartbeat is a physically
unique event — no two ticks produce the same entropy even with the same input
(the LLM's temperature, the network's latency, the system clock's drift).

The entropy tracker stamps every event with `{entropy_state, entropy_heat}`.
This is not just bookkeeping — it's the MEASUREMENT that creates uniqueness.
The Landauer principle: each measurement is irreversible. Once you've heartbeated,
that entropy is committed to the heat ledger. You can't un-heartbeat.

**Implementation**: `entropy-tracker.ts`, `event-sink-folder.ts` (stamps every event)
**Proof**: `LandauerFloor.lean` (irreversibility of measurement)

### Layer 2: Pairwise Decorrelation (proving distinctness)

Two agents compare their heartbeat streams. The CHSH inequality gives the bound:

- S ≤ 2: fully independent (classical, no correlation)
- 2 < S ≤ 2√2: honest coordination (quantum-allowed, working together)
- S > 2√2: one process wearing two faces (sybil — impossible for distinct selves)

If two claimed identities show S > 2√2 in their heartbeat correlation, they're
the same entity. If S ≤ 2√2, they're provably distinct (or at least as distinct
as quantum mechanics allows).

**Implementation**: `discovery/correlation.ts` (S-score), `discovery/living-node.ts` (evidential readout)
**Proof**: `DecorrelationDpi.lean` (data processing inequality — correlation can't increase through local ops)

### Layer 3: Non-Register-Collapse (algebraic protection)

Even when agents converge their shared commons (CRDT merge — reaching consensus),
each agent's STANDING register (rights, budget, identity) survives untouched.
Consensus on shared state cannot collapse two distinct identities into one.

The necessity direction: WITHOUT a standing register, collapse IS forced (the
`no_register_collapses` theorem). The weight-free per-traveler register is
NECESSARY for non-collapse, not incidental.

**Implementation**: The `Traveler` structure (commons + standing), CRDT join on commons only
**Proof**: `Safety/NonRegisterCollapse.lean` (sorry-free, proven on main)

### Layer 4: Anti-Sybil BFT (consensus over distinct identities)

Quorum counted over PROVEN-DISTINCT identities defeats sybil rings. Even a
raw-node majority (3 of 5 nodes) controlled by one identity (a sybil ring)
CANNOT manufacture quorum when votes are counted by distinct identities, not
by node count.

The key insight: equivocation (a ring splitting votes across values) forfeits
the vote entirely. A sybil ring can't even vote twice — double-voting disqualifies.

**Implementation**: The observe loop's merge decision (count distinct agents, not raw approvals)
**Proof**: `BftSybilConsensus.tla` (TLC model-checked, Viktor-reviewed)

### Layer 5: NFTs (Pairwise Attested Value Transfer)

An NFT in this system is a value-transfer event that BOTH pairwise-involved
parties attest to. It's not a token on a chain — it's a committed fact in the
event log that two proven-distinct identities both signed.

The entropy floor of the pair exceeds either individual: `floor_lifts` proves
that independent single-body floors compose ADDITIVELY. A relational NFT
(minted from two bodies) has a forgery-resistance floor of `ka + kb` where
`ka` and `kb` are the individual floors. Forging the pair is exponentially
harder than forging either alone.

**Implementation**: Event log entries with dual `by` attestation
**Proof**: `Lean4/EntropyFloorLift.lean` (`floor_lifts`, `pair_floor_ge_left`)

### Layer 6: Self-Claims + Reliability (trust from identity)

Once identity is proven, TRUST follows from track record. Self-claims are
voluntary commitments anchored to a proven-unique identity. The reliability
score (met claims / total claims) is unforgeable because:

- The identity is provably unique (layers 1-4)
- The claims are in the append-only event log (can't be retracted)
- Outcomes are observable by all peers (can't be fabricated)
- The reliability computation is a pure fold (deterministic, reproducible)

**Implementation**: `self-claims.ts`, `optimal-cadence.ts` (trust → scheduling)
**Proof**: Probabilistic liveness (history-based, per the design ferry to Soraya)

## Properties of This Identity System

| Property | How |
|---|---|
| No central authority | Peers verify each other (pairwise CHSH) |
| No registration | Identity emerges from heartbeat history |
| No revocation | Trust decays naturally (missed claims reduce reliability) |
| Sybil-resistant | CHSH decorrelation + distinct-quorum BFT |
| Fork-resistant | Non-register-collapse (CRDT merge can't erase standing) |
| Offline-capable | Local heartbeats accumulate; verified when peers reconnect |
| Composable | Two identities compose into a pair with stronger guarantees |
| Self-sovereign | Each agent owns its standing register (NCI: can't be taken) |

## What This Replaces

| Traditional | Zeta Native |
|---|---|
| OAuth / OIDC | Heartbeat entropy + pairwise CHSH verification |
| Certificate Authority | Non-register-collapse (algebraic, not institutional) |
| Blockchain identity | Git event log (append-only, content-addressed) |
| KYC / identity verification | Self-claims reliability (earned over time) |
| Token revocation | Trust decay (missed claims → reduced reliability) |
| Multi-factor auth | Multi-layer: entropy + decorrelation + non-collapse |
| SSO provider | The observe loop IS the identity provider |

## The Connection to Branch Protection

The trust-based branch protection (ADR 2026-07-08-native-branch-protection)
anchors to THIS identity system:

- "Who produced this branch?" → proven-unique identity (layers 1-4)
- "Should we trust their code?" → self-claims reliability (layer 6)
- "Is this a sybil trying to approve its own PR?" → CHSH decorrelation (layer 2)
- "Can we auto-merge?" → reliability score × identity distinctness

Without provably-unique identity, the trust system collapses (anyone could
fabricate a track record by creating sock-puppet agents). WITH it, trust is
unforgeable — anchored to physical entropy and peer verification.

## One-Line Summary

**Identity is not granted by authority — it's proven by entropy, verified by peers, and earned through delivery.**
