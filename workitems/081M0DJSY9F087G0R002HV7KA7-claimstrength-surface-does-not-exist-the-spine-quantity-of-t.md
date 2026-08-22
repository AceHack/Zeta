---
id: 081M0DJSY9F087G0R002HV7KA7
type: task
state: backlog
priority: P2
slug: claimstrength-surface-does-not-exist-the-spine-quantity-of-t
title: "ClaimStrength surface does not exist -- the spine quantity of the distributed identity design is unimplemented"
created: 2026-08-19T17:58:47.343Z
depends_on: []
composes_with: []
---

# ClaimStrength surface does not exist -- the spine quantity of the distributed identity design is unimplemented

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DJSY9F087G0R002HV7KA7-*.md` glob. -->

**Finding, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §3 G1. This is the largest gap in the distributed identity design.**

C3 (claim strength is not decomposable) and C4 (identity strengthens with verified history) are both statements about `strength(claim)` / `strength(identity)`. **No module computes one.**

The nearest surfaces each answer an adjacent question, and each is *correct* not to be the strength function:

- `src/Core/TravelerRankLedger.fs` — a posterior over **outcome calibration** per (traveler, hat-domain), not over accrued mutual observation.
- `src/Core/QuorumAlgebra.fs` — deduplicates by source, returns no scalar.
- `src/Bayesian/GossipTelemetry.fs` — carries the observations and deliberately attaches no verdict (dual-use).
- `src/Core/SocietyUsefulWork.fs` / `src/Bayesian/CondorcetBoundary.fs` — the correct *functional* (`N_eff`), over the wrong random variables (competence over facts, not observation over claims).

**The composition point does not exist.** The pieces are the arguments of a function nobody wrote, which is why the design reads as unfinished.

**Not Soraya's to write** — routing is advisory, authorship is the architect's or the author's lane. Every verification work-item routed this round verifies a function that this item must produce first.

**Related gap:** `081M0DK2TXD087G0R003674BAS` (the missing evaluator). G1 is the missing quantity; neither is testable without the other.
