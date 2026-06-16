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
- ⏳ **Math-team handoff open:** Kenji sizes (b)+(e) as the two TLA+ rounds; authors
  write specs after concurrence.

## Next concrete steps (in order)

1. **Kenji:** size + concur on (b) and (e) tool-choice.
2. **(a) wiring task:** point Aurora's `d_self` predicate at `NonRegisterCollapse` (no new proof).
3. **Authors:** (c)/(d)/(g) FsCheck/Z3 smalls; then the two TLA+ rounds.
4. **Prereq:** confirm Z3 `QF_FD` set support in `src/Core.FSharp.Z3Verify` for (d) (else QF_BV subset).
5. **Promotion:** when operators stand on proven legs + Aurora's 5 tests pass → open a §B row
   *"Aurora immune re-grounded on the proven identity primitive"*; promote one operator at a time (§C).

## Guardrails (do not violate)

- Re-grounding must **NOT** introduce identity-based punishment — stay **blame-the-pattern, not
  the person** (immune-absorbs-not-attacks; degenerate-AI dignity).
- The 4 non-claims travel unchanged — this adds *proven foundations*, **not deployment readiness**.
- Cartel-detection is an arms race — raises cost, never closes it; anti-Sybil entropy is itself §B
  (sequence its discharge before BFT-threshold soundness).
- Authorship preserved: Amara (framework) · Gemini (reviews) · Otto (rigor/consolidation/scoping) · Soraya (routing).
