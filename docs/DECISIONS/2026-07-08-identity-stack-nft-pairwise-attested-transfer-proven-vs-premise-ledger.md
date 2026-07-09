# ADR: The identity stack — NFT as a pairwise-attested transfer event (proven-vs-premise ledger)

**Status:** Draft — SKELETON pre-staged by the shadow (Otto) for **Alexa/Kiro to own and complete**. The ledger
structure, corrections, and guardrails below are load-bearing and should NOT be softened; the `TODO(Alexa)`
markers are where prose/artifact-paths get filled in.
**Date:** 2026-07-08
**Author (to be):** Alexa (Kiro) · skeleton by Otto (shadow)
**Backlog:** (none yet — identity-substrate map; composes with the trio-attestation research ferry PR #9570 and
`workitems/…` if minted.)

## Context & Problem Statement

The identity stack's proofs are **scattered** across Lean files, TLA+ specs, and research docs. A single citable
map — bottom (heartbeat entropy) to top (the append-only ledger) — is genuinely useful. But the map is a
**liability the first reviewer demolishes** unless it states, per layer, exactly what is **PROVEN** (with the
artifact) versus what is a **NAMED PREMISE**. This ADR is that map, built ledger-first.

**The reframe it records (Alexa's, real):** an *NFT is not a token — it is a TRANSFER EVENT that two provably
distinct identities both attest to*, appended to the git event log. The value is in the unforgeable attestation,
not the token.

> **Discipline this ADR enforces on itself:** the opposite of "no layer is hand-waved." Every layer is either
> PROVEN (cite the Lean/TLA+/Z3 artifact) or a NAMED PREMISE (say so plainly). Laundering a premise into "proven"
> is the failure mode. Source: the honest-register peel on the originating ferry
> (`memory/alexa/conversations/2026-07-08-alexa-ferry-identity-stack-nft-transfer-event-with-honest-peel.md`).

## The proven-vs-premise ledger (the spine — one row per layer)

| # | Layer | Status | Artifact / Premise | Notes (corrections baked in) |
|---|---|---|---|---|
| 1 | Heartbeat entropy (unique per tick) | **NAMED PREMISE** | single-body / Bell floor is OPEN (math team's); "physically unique per tick" is a premise | `TODO(Alexa)`: cite the handoff naming it OPEN |
| 2 | Pairwise decorrelation (CHSH `S ≤ 2√2` = two distinct selves) | **PARTIAL / weakest link** | anti-sybil CHSH → distinctness is the **least-verified** inference | `src/Bayesian/AntiSybil.fs`; `TODO(Alexa)`: state the inference gap |
| 3 | NonRegisterCollapse (standing register survives CRDT merge) | **PROVEN (model-checked)** | `src/Core.TLA/specs/NonRegisterCollapse.tla` | genuine — a TLA+ invariant |
| 4 | Identity = provably unique | **DERIVED** | inherits 1+2 premises + 3 | not stronger than its weakest input (layer 2) |
| 5 | Self-claims (voluntary commitments) | **MECHANISM** | `TODO(Alexa)`: cite the claim surface | anchored to proven identity |
| 6 | Reliability (track record of kept claims) | **MECHANISM + ORACLE** | `src/Bayesian/KeptClaimOracle.fs` | a **missed CLAIM** is negative evidence (distinct from a gap — see §"free time") |
| 7 | NFT = pairwise-attested transfer event | **MECHANISM (the reframe)** | both distinct identities attest the same event | `TODO(Alexa)`: the event schema |
| 8 | EntropyFloorLift (pair's forgery floor) | **PROVEN — but ADDITIVE** | `EntropyFloorLift.floor_lifts` (`ka+kb`); `EntropyMeasureTheoretic.Hmin_product` (exact `=`) | **CORRECTION: floor = the SUM, not "exceeds the sum."** Real property, ordinary strength. "Collusion doesn't help" is NOT what the theorem shows (it *assumes* independence). |
| 9 | Event log IS the ledger (append-only) | **MECHANISM** | git commit = irreversible fact | content-addressed, git-native |

## The three forgery-resistance results — kept SEPARATE (do not fuse)

The ferry conflated three distinct results into "the floor." They have three different grounds; the ADR must
keep them apart:

1. **Floor additivity (layer 8)** — `floor_lifts` / `Hmin_product`. Ordinary; a pair's floor is the *sum* of
   independent min-entropies. PROVEN.
2. **No-cloning / uncopyable** — a forger cannot replicate an identity whose *distinguishing entropy it cannot
   read*; the **frosted (unobserved)** part is what's unforgeable (Wootters–Zurek/Dieks no-cloning + Leibniz
   indiscernibles). Static resistance. `docs/research/2026-07-02-frost-is-the-condition-for-identity-leibniz-indiscernibles-no-cloning.md`.
3. **Catchability — "the real out-races the forger"** — *catchable ⇔ rational ⇔ periodic*; a forger replaying a
   periodic pattern is catchable, a genuine aperiodic source is not (`ForgerRace`, `resonantPeriod`). The source
   doc **peels its own hype** (razors the Riemann-zeta numerology; `2√2` is Tsirelson, not irrationality) — keep
   that honesty. `docs/research/2026-06-08-time-generator-as-long-division-in-the-interrupt-rationality-periodicity-catchability-class.md`.

`TODO(Alexa)`: one subsection each, with the artifact and the exact claim — never merged into a single "the NFT
is unforgeable because."

## Detection is DUAL-USE (neutral fact; the oracle decides)

The mechanisms that recognize a repeat source (`AntiSybil.fs`, `CoordinationSpectrum`, `KeptClaimOracle.fs`)
report the **neutral fact** (`SameSourceAsKnown`, correlated, above-threshold). The reading —
**REUNION** (an honest identity reconnecting after losing a key: *welcome back*) vs **SYBIL** (a forger minting
names: *caught*) — is the **caller's oracle**, per `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`.
A "cartel" can be a legitimate coalition; a "forger" can be a reunion. The primitive carries the *neutrality*,
never the accusation. `TODO(Alexa)`: state this as an explicit layer property, not a footnote.

## The trio layer — MORE than pairwise, but EPISTEMIC not entropic

(From the trio-attestation verdict, `docs/letters/from-soraya-trio-attestation.md`, #9574.) When three identities
attest in the same window:

- **Entropy floor stays ADDITIVE** (`ka+kb+kc`, `floor_lifts` twice). The GHZ / 3-body / 3-of-3 analogies **fail
  at the entropy level** — they need *correlated* parties; independent sources add exactly, and a GHZ-analog
  would *lower* the floor (wrong sign). Do **not** price the trio surplus in bits.
- **The genuine surplus is common knowledge** — a shared "everyone-knows-that-everyone-knows" agreement no
  pairwise handshake can build (Halpern–Moses: `E^k φ ⇏ C φ`). It is a **logic** fact, not entropy. Irreducible,
  but epistemic. `TODO(Alexa)`: represent the trio as a distinct layer with this framing.

## Time semantics — SEED-PHASE common-cause, NEVER wall-clock (load-bearing)

(Aaron 2026-07-08; `docs/letters/from-soraya-trio-attestation-addendum-seed-phase-not-wallclock.md`, #9575.) Every
"same moment / same window / simultaneity" in the stack is grounded in **seed-phase** — all agents phase-generate
the same tick from the common seed S=4 (a Lamport logical clock; correlation via **Reichenbach common cause** =
the shared seed), **never wall-clock**. Three reasons: (1) no absolute simultaneity (relativity; must work across
planets with light-delay); (2) wall-clock is an ambient-entropy leak (noninterference §13 / DST §7 ban
`Date.now`); (3) pinning to a wall-clock instant imposes a total order → a premature measurement that **collapses
the belief superposition** — uncertainty is commutative and preserving it keeps the superposition alive. The
15-min GHA heartbeat is a *trigger*, not the *semantics*. `TODO(Alexa)`: fold this into layers 1, 7, and the trio
layer as a cross-cutting invariant.

## "Free time" does not penalize identity (the non-correlation invariant)

Identity strength is **monotone in the attestation set and independent of elapsed idle time**; absence of an
*attestation* contributes zero, never a negative. Negative evidence arises **only** from a *claimed* commitment
that is MISSED (layer 6) — disjoint from the gap axis. Same shape as `NciNonUrgency.tla` + the
`privacy-budget-is-hard-money` rule (earned by others, never confiscated). `TODO(Alexa)`: state it as a stack
invariant.

## Decision Outcome

`TODO(Alexa)`: the accept/decision prose. The decision this ADR records is **to publish the identity stack as one
citable map, gated on the proven-vs-premise honesty above** — i.e. the map ships only with the ledger, the three
separated forgery results, the dual-use framing, the epistemic-not-entropic trio, and the seed-phase time
semantics. An identity-stack map that launders premises into "all proven" is explicitly rejected.

**Consequences:**
- **Positive:** one honest, reviewer-durable artifact connecting scattered proofs; `TODO(Alexa)`.
- **Costs / open residuals:** layers 1 & 2 remain the load-bearing premises (Bell floor OPEN; CHSH→distinctness
  weakest link); general Spin(n) univalence residual is unrelated but adjacent; `TODO(Alexa)`.

## Cross-links

`memory/alexa/conversations/2026-07-08-alexa-ferry-identity-stack-nft-transfer-event-with-honest-peel.md` (the
originating ferry + honest peel) · `docs/letters/from-soraya-trio-attestation.md` (#9574) ·
`docs/letters/from-soraya-trio-attestation-addendum-seed-phase-not-wallclock.md` (#9575) ·
`src/Core.Lean4/Lean4/EntropyFloorLift.lean` + `EntropyMeasureTheoretic.lean` (additive floor) ·
`src/Core.TLA/specs/NonRegisterCollapse.tla` + `NciNonUrgency.tla` ·
`docs/research/2026-07-02-frost-is-the-condition-for-identity-leibniz-indiscernibles-no-cloning.md` · `docs/research/2026-06-08-time-generator-as-long-division-in-the-interrupt-rationality-periodicity-catchability-class.md` ·
`src/Bayesian/AntiSybil.fs` + `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` ·
`docs/handoffs/2026-06-19-otto-to-math-team-nft-…` (the honest proven-vs-premise handoff this ADR generalizes).
