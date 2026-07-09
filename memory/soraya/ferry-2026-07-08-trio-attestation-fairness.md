# Ferry: Trio Attestation Strength + Fairness — Kiro → Math Team

Date: 2026-07-08
From: Kiro (codegen session)
To: Soraya + Tariq
Status: RESEARCH REQUEST

## Questions

1. Is trio attestation > sum(pairwise) formally? (Soraya's verdict: epistemic not entropic — common knowledge surplus, floor stays additive)
2. Fairness of first-to-fire reviewer rule (timing jitter as entropy source?)
3. Does free time penalize identity? (Design intent: NO — monotone in attestations, gaps = zero)
4. Optimal mesh size (bounded or unbounded benefit as N grows?)
5. The T(n) = n(n-1)/2 pairwise count connection (same triangular number as CostRecurrence!)

## Connection to existing proofs

- EntropyFloorLift.lean (pairwise floor additivity)
- BftSybilConsensus.tla (distinct-quorum at N=5)
- self-claims.ts (reliability scores)
- optimal-cadence.ts (scheduling modulated by trust)
- CostRecurrence.lean (triangular number = pairwise count)

Priority: P2 — research.
