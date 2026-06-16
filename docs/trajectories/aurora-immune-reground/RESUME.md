# Trajectory — Aurora Immune System re-grounded on the proven identity primitive

Status: **active — scoped + Soraya-routed; awaiting Kenji sizing of the 2 TLA+ rounds**
Last refreshed: 2026-06-16
Parent trajectory: none (sibling of `anti-infection`, but this is *active formal work*, not the defensive posture)
Grounding:

- `docs/research/2026-06-16-aurora-immune-math-reconciliation-scoping-reground-on-proven-identity-primitive.md` (the scoping + Soraya routing + math-team handoff)
- `docs/research/aurora-immune-math-standardization-2026-04-26.md` (Amara's Aurora math — §4 test obligations, §5 non-claims)
- Consolidated society note §9h (immune/cartel), §9i (anti-collapse), §9g-bis (Legibility/bridge)
- `src/Core.Lean4/Safety/NonRegisterCollapse.lean`, `src/Core.TLA/specs/NonRegisterCollapse.tla`, `src/Core.Lean4/Privacy/IdentityForcesPrivacy.lean` (the discharged legs to re-ground on)

## Why this exists

Amara's Aurora immune math was typed **before** the identity proofs existed, so its
self/non-self and BFT thresholds silently assume an undefined "self" and "a
participant to threshold over". Both are now **proven objects** (`NonRegisterCollapse`,
`IdentityForcesPrivacy` — DISCHARGED, axiom-free). The work is to **re-express each
Aurora operator on the proven identity primitive** so the immune guarantees stand on
theorems, not metaphor.

## Where it stands (2026-06-16)

- ✅ Scoping doc written (operator-by-operator re-grounding map; falsifiers; the 4
  binding non-claims preserved).
- ✅ Routed to **Soraya** — tool-selection table done (BP-16). Only **(b) BFT-under-Sybil**
  and **(e) PermanentHarmRisk** want TLA+; the rest are FsCheck/Z3 smalls or a reuse;
  **(a) self/non-self = reuse the existing Lean lemma, zero new tool**; **(f) Legibility =
  empirical, OUT of the formal denominator** (route to Adaeze).
- ✅ **Kenji sized (b)+(e)** — concrete skeletons, invariants, bounds, false-green guards,
  reviewer assignments (Viktor→b, Kira→e); concurred with Soraya (TLA+ for b+e only).
- ✅ **Both TLA+ specs AUTHORED + TLC-green** (`src/Core.TLA/specs/`):
  - **(b) `BftSybilConsensus.tla`** — quorum over proven-distinct identities; a Sybil ring
    that is a RAW-NODE MAJORITY (3 of 5) but ONE identity is REFUSED (load-bearing witness
    `NoSybilRawMajorityRefusal` fires). TLC surfaced + fixed a real bug: an equivocating ring
    (splitting votes) made conflicting quorums → fixed with equivocation-exclusion (BFT
    double-vote treatment).
  - **(e) `PermanentHarmHorizon.tla`** — real retraction-decay dynamics; Refuse is a reachable
    observable state; horizon H genuinely gates repair; HarmFloor's `~irreversible` clause is
    independent of the Commit guard. All three §4.1 cases probe-verified reachable
    (accept / irreversible-block / past-horizon-block).
- ⏳ **Reviewer RE-confirmation pending:** Viktor (b) + Kira (e) found v1 false-green (correctly);
  v2 addresses every named P0. Re-review the v2 specs before §A promotion.

## Next concrete steps (in order)

1. **Viktor / Kira:** re-confirm the v2 specs are non-vacuous + model the real property.
2. **(a) wiring task:** point Aurora's `d_self` predicate at `NonRegisterCollapse` (no new proof).
3. **(b)/(e) FsCheck cross-checks** (Soraya's BP-16): the Aurora §4.1 retraction sim (e) +
   the Z3 honest-count side (b).
4. **Authors:** (c)/(d)/(g) FsCheck/Z3 smalls.
5. **Prereq:** confirm Z3 `QF_FD` set support in `src/Core.FSharp.Z3Verify` for (d) (else QF_BV subset).
6. **Refinements noted in-spec:** (b) honest-supermajority-of-quorum needs D=3f+1 sizing;
   (e) multi-claim substrate + multi-hop kernel reachability is the v3.
7. **Promotion:** when operators stand on proven legs + Aurora's 5 tests pass → open a §B row
   *"Aurora immune re-grounded on the proven identity primitive"*; promote one operator at a time (§C).

## Hygiene flag (separate, not bundled here)

`src/Core.TLA/specs/states/` (TLC checkpoint dirs, dated 26-06-12) are **committed to the repo** —
`.gitignore` covers `tools/tla/specs/states/` but NOT the `src/Core.TLA/` path. These are run
artifacts that should be gitignored + removed in a dedicated hygiene PR (not bundled into this
formal-work PR; I did not create them).

## Guardrails (do not violate)

- Re-grounding must **NOT** introduce identity-based punishment — stay **blame-the-pattern, not
  the person** (immune-absorbs-not-attacks; degenerate-AI dignity).
- The 4 non-claims travel unchanged — this adds *proven foundations*, **not deployment readiness**.
- Cartel-detection is an arms race — raises cost, never closes it; anti-Sybil entropy is itself §B
  (sequence its discharge before BFT-threshold soundness).
- Authorship preserved: Amara (framework) · Gemini (reviews) · Otto (rigor/consolidation/scoping) · Soraya (routing).
