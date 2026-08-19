---
id: 081M0DMH30Y087G0R001C2B1PT
type: task
state: backlog
priority: P2
slug: plot-the-two-scarce-axes-against-each-other-decorrelation-rh
title: "Plot the two scarce axes against each other: decorrelation (rho, Lyapunov, effectiveN) vs reconcilability (byte-lock, collation, anchor audit) and name the operating point"
created: 2026-08-19T18:28:54.430Z
depends_on: []
composes_with: []
---

# Plot the two scarce axes against each other: decorrelation (rho, Lyapunov, effectiveN) vs reconcilability (byte-lock, collation, anchor audit) and name the operating point

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DMH30Y087G0R001C2B1PT-*.md` glob. -->

**Finding, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §3 G13. Empirical, not a proof obligation.**

Aaron 2026-08-19: *"we are based on S=4 superdeterministic seed correlation ... trying to decorrelate over time while keeping the communications intact and not running into the tower of babel."*

The objective is **decorrelate as far as possible subject to staying reconcilable**. That is a constrained optimisation with two scarce budgets, and **both axes are already instrumented while nobody has plotted them together.**

**Axis 1 -- decorrelation.** `src/Core/AntiSybil.fs` `correlation` (cross-stream agreement beyond chance); `src/Core/Orbit.fs` `largestLyapunov` (divergence rate); `src/Bayesian/CondorcetBoundary.fs` `effectiveN` (N_eff = N/(1+(N-1)rho), metered, RHO-STAR-1).

**Axis 2 -- reconcilability.** The four-oracle byte-lock (golden vectors, hex-in-JSON); `src/Core/Collation.fs` + `src/Core.TypeScript/collation/` (one canonical ordinal collation, so divergence is detectable rather than silent); the `glossary-anchor-keeper` audit (external-definition drift, anchor breakage); the citation lints.

**Deliverable:** one plot, one meter per axis, and the fleet's current operating point named -- plus where it *should* sit.

**This composes with existing named open work.** `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` already names "measuring rho for the live fleet" as open empirical work (row 15's A-method note), with the same instruments. **One measurement round could close both.**

**Why it matters:** until this exists, "decorrelate but do not babel" is a direction with no dial, and the two failure modes are opposite and both fatal -- too little decorrelation and N agents price as one (plurality is fake); too much and no shared conclusion is reachable at all.

