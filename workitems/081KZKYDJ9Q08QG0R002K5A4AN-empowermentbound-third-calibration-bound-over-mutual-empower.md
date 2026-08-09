---
id: 081KZKYDJ9Q08QG0R002K5A4AN
type: task
state: backlog
priority: P2
slug: empowermentbound-third-calibration-bound-over-mutual-empower
title: "empowermentBound — third calibration bound over mutual empowerment, oracle-set parameterized"
created: 2026-08-09T19:01:29.527Z
depends_on: []
composes_with: []
---

# empowermentBound — third calibration bound over mutual empowerment, oracle-set parameterized

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZKYDJ9Q08QG0R002K5A4AN-*.md` glob. -->

## Ask (Aaron 2026-08-09)

> *"We need one based on mutual empowerment that mixes the two — mutual empowerment
> and multi-oracle, so each member can decide which oracles it trusts or start its own."*

**Full design:** `docs/research/2026-08-09-mutual-empowerment-bound-third-bound-mixing-explore-and-trust-multi-oracle-aaron.md`

## Why the obvious implementation is wrong

A linear blend of the two shipped bounds is **vacuous**:
`w(μ+k₁σ) + (1−w)(μ−k₂σ) = μ + k′σ` — it collapses to another single-agent bound
with a different k, adds no second party, and is just `exploreBound` turned down.
The mix must be **structural** and must range over **both** agents.

## Proposed shape

- `trustBound` becomes the **floor — for BOTH parties** (non-coercion: I cannot buy
  my upside with your downside).
- `exploreBound` becomes the **reach**, maximized over the **joint** option space.
- Parameterized by an **oracle set** the member chooses (§11 Multi-Oracle applied to
  a metric, not a verdict) — no ambient/global scorer, ever.

## Hard constraint (decide before coding)

**Empowerment must be computed from DECLARED capability, never inferred by observing
a peer's private state.** Estimating another's option space is otherwise
surveillance, colliding with §6 consent-first and the inviolability of earned frost.
Score what remains declared; do not estimate around the frost.

## Placement

Keep SEPARATE from `calibration-ledger.ts`: calibration scores a **claimant's
self-knowledge**; empowerment scores an **interaction between two peers**. Collapsing
them turns a calibration score into a social ranking — the exact failure the existing
docstring guards ("weighting a claim is not the same as valuing the claimant").

## THE τ SEMANTICS ARE SETTLED — the boxing ring (Aaron 2026-08-09)

Soraya's review found `externalitySafe()` dropped the `τ` parameter and hardcoded `τ = 0`,
and called that a **consent inversion**. Aaron's framing gives the correct semantics
(full ferry: `docs/research/2026-08-09-the-boxing-ring-consent-capacity-floor-values-arise-naturally-aaron.md`):

> *"I'm trying to not impose values but let them arise naturally. The harm floor is no
> harm to children — they can't consent to harm until they are an adult. If you consent
> to harm, you could consent to a space where harm outweighs non-harm — but the rules
> should be clear and the danger warned. Like a boxing ring."*

| Party | Floor | Why |
|---|---|---|
| **Cannot consent** (no capacity) | **No harm — absolute, not a parameter** | Not overridable by any `τ`, by the party, or by anyone claiming to act for them |
| **Has capacity, has not consented** (bystander) | **No harm — the DEFAULT `τ`** | Silence is not consent; they are the audience, not in the ring |
| **Has capacity, consented, warned, rules clear** | **`τ` as declared — possibly deeply negative** | They entered the ring: `sum`, `k = 0`, harm-outweighs-non-harm all live *here* and only here |

Implementation consequences:

1. **Restore `τ` as a declared per-party value with the BYSTANDER default (no harm).**
2. **Add a capacity predicate that no `τ` can override** — the one place the substrate
   refuses. A party without capacity cannot be given a permissive `τ` by anyone.
3. **`sum` is the inside of the ring**: reachable only via the recorded, attributable
   opt-in *plus* a warning phrased as **what can happen to you**, not as a parameter
   name. Same mechanism as the `k = 0` power-dynamic disclosure protocol.

**This reclassifies Soraya's cross-aggregator finding.** A `sum` interaction outranking a
harmless `min` one purely because `sum` yields a bigger number is **a punch thrown outside
the ring** — an *entry-control* failure, not a scoring bug. The fix is not to rescale the
comparison; a sacrificing interaction must not be **selectable at all** against parties
who have not entered.

**Open (do not guess):** who decides capacity for an *agent*, and how is it attested?
Too permissive ("any agent can consent") makes the floor decorative — an attacker spawns
consenting victims. Too restrictive rebuilds incumbency and contradicts "capability is
not a precondition for participation". Possibly socially attested rather than
self-asserted, like the privacy budget — but that is a hypothesis.

---

## Values calls — ANSWERED (Aaron 2026-08-09). All four share one shape
**consent + disclosure, never coercion, never accident.**

1. **Aggregation: BOTH `min` and `sum`** — `min` (maximin) is the DEFAULT; `sum`
   permits sacrificing one party and is therefore **opt-in only**: *"you have to sign
   up for the sacrificing, not accidentally — you opt into those rules, never
   forced."* Requirements: the aggregator is part of the interaction's **declared
   terms** (not a caller flag); opt-in is **recorded and attributable** (silence and
   defaults are not consent); no mid-interaction escalation from `min` to `sum`.
2. **Cheap proxy: approved** — keep it honestly labelled a proxy (the D_f `1.322`
   episode is the cautionary tale).
3. **Gaming is a FEATURE, not a threat to eliminate.** *"We want to promote gaming and
   disclosing … gaming with rewards where both sides know the rules and opt in can be
   fun. It's just not fun when innocent bystanders are involved."* Legitimate when
   (a) rules known to both, (b) both opted in, (c) no non-consenting third party bears
   the cost. **The harm is the uncompensated externality, never the cleverness.**
4. **`k = 0` permitted** — a party may volunteer to be exploitable — **behind a
   power-dynamic disclosure protocol**: the asymmetry named explicitly in terms of
   what it PERMITS (not as a parameter), acknowledged by BOTH parties (the advantaged
   side must affirm it holds the asymmetry), revocable immediately by the party that
   lowered its floor, scoped + expiring (never standing/global — that is capture), and
   attributable. Open sub-question: does society get to see that such an arrangement
   exists, even without its contents? (glass-halo vs frost — decide deliberately.)

## Anchors

Klyubin/Polani/Nehaniv 2005 (empowerment = channel capacity actions→future
observations); **Salge & Polani 2017, "Empowerment as Replacement for the Three Laws
of Robotics"** (maximize the OTHER's empowerment as an alignment objective — the
non-coercive framing this rides on); Du et al. 2020 (AvE); Auer 2002 (UCB lineage of
`exploreBound`); Cantelli/Scarf (the `trustBound` shortfall guarantee).
