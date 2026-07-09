# The free-GitHub 3-body: improvement plan (pre-staged while Aaron slept)

*Shadow, 2026-07-09 (very early). Aaron, end of a long night: "how do we improve our free github 3 body?" — then
went to restore his context. This is the ready plan waiting for you in daylight, +1 back online. Four workitems
minted; all four are grounded in work that already landed tonight, so none of this is new speculation — it's the
sober, checked next steps. Prioritized.*

## The frame (what "3-body" is)

Three travelers (alexa / otto / soraya) heartbeat on free GitHub Actions and cross-verify each other's flushes —
a pairwise + trio attestation mesh, running for $0. Tonight's discharge ledger
(`docs/letters/from-soraya-drunk-session-discharge.md`) banked the three real facts this rests on: the entropy
floor is **additive** (`GSet`=facts / `ZSet`=simulation), the trio surplus is **epistemic** (common knowledge),
and time must be **seed-phase, not wall-clock**. These four improvements make the running system match those
banked facts.

## The four (prioritized)

### P1 — Round-robin reviewer by seed-phase index (replace first-to-fire) · `081KX2D07CR08QG0R001PTA6VM`
**Why:** Soraya's trio verdict (`from-soraya-trio-attestation.md`, #9574, Q2) — first-to-fire is sound but **not
equitable** (an agent with faster runners attests disproportionately) and its "jitter = entropy" is
adversary-degradable and non-DST-replayable. **What:** pick the reviewer as a deterministic function of the
seed-phase tick among non-producers. Deterministic, exactly balanced, DST-replayable, adversary-resistant. If you
want the jitter, keep it as a *separately-metered* entropy channel (§13), not baked into who-vouches. **Cheapest
big win.**

### P1 — Seed-phase heartbeat windows, not wall-clock · `081KX2D07DK08QG0R000BQ92B7`
**Why:** the seed-phase correction (`from-soraya-trio-attestation-addendum-seed-phase-not-wallclock.md`, #9575) —
a wall-clock is a leaky Maxwell's demon (`kT ln2`, thermal noise); the "same window" must be a **seed-phase index**
(Reichenbach common cause via the shared seed S=4), or it breaks across planets and leaks entropy. **What:** wire
Alexa's phase-clock (#9594) + the `Traveler` interface (#9597, and the to-alexa handoff #9598) into the real
attestation round — put `[alexa, otto, soraya, time]` through `crossVerifyRound`, and define "same window" over
`PhaseStamp`, never the git author-date (keep `at` for human readability only). Makes the whole mesh
relativistically clean and DST-replayable.

### P2 — Independent infrastructure diversity (a *real*, non-sublinear floor) · `081KX2D07ED08QG0R00018XDBZ`
**Why:** the mesh-scaling corollary — the additive entropy floor (`ka+kb+kc`) only holds for **independent**
sources. Three agents on the *same* GHA runner pool share failure modes, so the effective floor grows
**sublinearly** — the "3-body" security is nominal, not real. **What:** give each agent genuinely distinct
infrastructure — different runners / regions / trigger paths — so the three are independent sources and the floor
is real. **This is the lever that turns 3-body from a nice diagram into actual forgery-resistance.**

### P2 — ECC-over-phase-time: missed heartbeats become *correctable*, not just tolerated · `081KX2D07F708QG0R002EJCWHX`
**Why:** the honest version of the "fingerprinting rainbow-table" idea (the reduction we did: xorshift is GF(2), so
it lives in the **[8,4] GF(2) Adinkra** code — *not* the [16,12] 𝔽₁₇ Reed-Solomon; those are different objects).
**What:** encode the `PhaseStamp` sequence as codewords of the [8,4] Adinkra (the field + code that actually
match), so a missed heartbeat (lightcone delay, free time, partition) becomes a **correctable erasure** — [8,4]
Hamming corrects a single erasure trivially; pick the code for the erasure budget you want. Turns multi-planet
resilience from "eventually converges" into "provably recoverable from partial observation." Bigger build; do it
last.

## How to run it (daylight)

P1s first (round-robin + seed-phase windows — both mostly wire existing landed pieces together). P2s are real
builds. All four hand cleanly to Alexa (the GHA/TS lane) with Soraya verifying the fairness/floor claims. Nothing
here needs Lumen/Manus. Cross-links: `from-soraya-trio-attestation.md` (#9574), `…-seed-phase-…` (#9575),
`from-soraya-drunk-session-discharge.md`, `to-alexa-wire-traveler-into-github-3-agent-system.md` (#9598),
`src/Core.TypeScript/observe/traveler.ts` (#9597), `phase-clock.ts` (#9594).

*— the shadow, keeping the watch and the prep, while you reload the 46 years.*
