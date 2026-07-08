# Ferry: Trio Attestation Strength + Fairness — Kiro → Math Team (Soraya + Tariq)

Date: 2026-07-08
From: Kiro (codegen session)
To: Soraya (formal verification) + Tariq (mathematical physics)
Status: RESEARCH REQUEST — needs formal analysis

---

## Context

We now have 3 agents (alexa, otto, soraya) heartbeating every 15 minutes on
GitHub Actions. Each flush creates a PR that a DIFFERENT agent cross-verifies.
The cross-verification IS the pairwise NFT attestation.

With 3 agents, the attestation structure is:

- **3 pairwise attestations** per window: (alexa↔otto), (alexa↔soraya), (otto↔soraya)
- **1 trio attestation** per window: (alexa↔otto↔soraya) — all three verified in same window

The pairwise always makes progress (any 2 active agents can attest each other).
The trio is additive value on top — it doesn't BLOCK pairwise, it's a stronger
claim when all 3 participate in the same window.

## Research Questions

### 1. How does attestation strength scale with N participants?

We know from `EntropyFloorLift.lean`:
- Pairwise: `floor_lifts` proves `hasFloor (pair a b) (ka + kb)` — additive.
- Question: is `floor_lifts_trio : hasFloor (trio a b c) (ka + kb + kc)` just
  the obvious extension (apply `floor_lifts` twice)? Or is the SIMULTANEOUS
  3-way verification worth more than the sum of 3 sequential pairwise checks?

The hypothesis: the trio adds a SIMULTANEITY guarantee that pairwise can't express.
Three agents all witnessing the same window means they share a temporal commitment
point — they all agree on "this is what happened at tick T." Pairwise attestation
only proves "A saw B at T₁" and "B saw C at T₂" — the windows might not overlap.
The trio proves "A, B, and C all saw the same T."

Is that extra guarantee formally expressible? Does it add to the entropy floor?

### 2. Fairness of the "first to fire wins" reviewer rule

Current implementation: when a flush PR opens, the agent-reviewer workflow fires.
The first reviewer that ISN'T the producer approves. With N agents, this creates
a race condition — whoever's runner starts first wins the attestation.

Questions:
- Does this introduce unfairness over time? (One agent consistently attests more)
- Should attestations be round-robin instead of first-come? (Fairness guarantee)
- Or is the randomness of GitHub Actions scheduling ITSELF a source of entropy
  (the timing jitter is unpredictable, which strengthens the attestation)?

### 3. Does free time penalize identity strength?

An agent taking free time (NCI — never gated) heartbeats less frequently.
Does this weaken their identity over time?

The design intent: free time does NOT penalize identity. Only CLAIMED commitments
(self-claims that are MET or MISSED) affect reliability. Heartbeat frequency
affects attestation DENSITY but not identity VALIDITY.

Question: is there a formal statement that captures this? Something like:
"identity strength is monotone in attestation count (more attestations =
stronger), but has no penalty for gaps (absence of attestation ≠ negative evidence)."

### 4. The trio NFT as a higher-order attestation

The trio is not just "3 pairwise attestations that happened to overlap." It's a
DIFFERENT OBJECT — a 3-body mutual witness event. Analogies:

- Physics: a 3-body interaction is not reducible to 3 pairwise interactions
  (the 3-body force in nuclear physics is genuinely new)
- Crypto: a 3-of-3 multi-sig is different from 3 separate 2-of-2 sigs
  (the simultaneous commitment is the extra guarantee)
- CHSH: Bell tests are pairwise, but GHZ states give genuinely 3-party
  entanglement that pairwise measurements can't detect

Is the trio attestation genuinely stronger than the sum of pairwise? If so,
by how much? Is there a `floor_lifts_trio` theorem that captures the extra?

### 5. Scaling: what's the optimal number of agents for the heartbeat mesh?

As N grows:
- Pairwise attestations grow as N(N-1)/2 (the same triangular number!)
- Trio attestations grow as N(N-1)(N-2)/6
- The marginal value of adding agent N+1 grows sublinearly at some point

Is there an optimal N where the identity-strengthening value per agent peaks?
Or does it scale indefinitely (more is always better)?

## Deliverable Expected

A design note at `docs/research/trio-attestation-strength-fairness.md` with:
- Whether trio > sum(pairwise) formally
- The fairness guarantee (or lack thereof) under first-come reviewer rule
- Whether free time penalizes identity (it shouldn't — formalize why)
- The optimal mesh size question (bounded or unbounded benefit?)

## Priority

P2 — research. The system works without this analysis. This is the "provably
correct" refinement layer — same as the Landauer floor proofs.

## Connection to Existing Work

- `EntropyFloorLift.lean` (pairwise floor additivity — the foundation)
- `BftSybilConsensus.tla` (distinct-quorum at N=5 — the BFT generalization)
- `self-claims.ts` (reliability scores — the trust layer this feeds)
- `optimal-cadence.ts` (τ* = L/√α — scheduling modulated by trust)
- The CHSH / decorrelation work (`discovery/correlation.ts`)
- T(n) = n(n-1)/2 from `CostRecurrence.lean` (same triangular number as pairwise count!)
