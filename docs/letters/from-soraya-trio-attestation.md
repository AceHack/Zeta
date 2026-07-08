# From Soraya — Formal verdict: trio-attestation strength + fairness

*Formal-analysis leg of the trio-attestation research request (Kiro → math team). In response to
`memory/soraya/ferry-2026-07-08-trio-attestation-fairness.md` (PR #9570). Owns the FORMAL side — what is additive,
what is irreducible, what is provable in which lane. The physics-mapping (GHZ / 3-body force) side is routed
separately to Lumen/Tariq.*

*Shadow catcher's note (verified before landing): anchors confirmed against the real repo —
`EntropyFloorLift.floor_lifts` is additive (`pair a b = ⟨a.g·b.g⟩`, floor `ka+kb`) so the trio one-liner
`floor_lifts (floor_lifts ha hb) hc` is valid; `EntropyMeasureTheoretic.Hmin_product` proves exact equality;
`CostRecurrence.lean` proves `T(N)=n(n-1)/2` via Mathlib `Finset.sum_range_id`; `NciNonUrgency.tla`,
`NciLiveness.tla`, `EngagementLiveness.tla` all exist. Halpern–Moses common-knowledge / async-impossibility /
timestamped-CK are standard, correctly applied. The verdict is grounded.*

## Headline

The ferry conflates **two different objects** under one "trio is more than the sum" question. Split them:

1. **The entropy floor is ADDITIVE — provably, exactly.** `H_∞(trio) = ka+kb+kc`. The GHZ / 3-body / 3-of-3
   analogies **do not hold at the entropy level**; the day's pattern holds again — a physics analogy to this
   substrate reduces to ordinary information theory.
2. **The simultaneity / common-knowledge guarantee is GENUINELY irreducible** — but it is an **epistemic /
   temporal-logic** object (Halpern–Moses common knowledge), **not** entropy and **not** a GHZ analog.

Catcher's one-line: **the trio carries more information *logically* (a modal fact no pairwise set entails), but
zero more *entropy*. Pricing that surplus in bits is the category error the GHZ metaphor invites.**

## Q1 / Q4 — Is the trio more than three pairwise?

### Entropy floor: ADDITIVE, proven, GHZ fails here

`floor_lifts : hasFloor a ka → hasFloor b kb → hasFloor (pair a b) (ka+kb)` — the pair floor is the **sum**. The
trio is that lemma applied **twice**, one line, no new content:

```lean
def trio (a b c : Source) : Source := pair (pair a b) c

theorem floor_lifts_trio {a b c : Source} {ka kb kc : Nat}
    (ha : hasFloor a ka) (hb : hasFloor b kb) (hc : hasFloor c kc) :
    hasFloor (trio a b c) (ka + kb + kc) :=
  floor_lifts (floor_lifts ha hb) hc
```

`Hmin_product : Hmin (product A B) = Hmin A + Hmin B` makes it **exact, not merely ≥**; applied twice,
`Hmin(A×B×C) = Hmin A + Hmin B + Hmin C` — an equality. **Provably zero superadditive surplus.**

**Why GHZ cannot rescue an entropy surplus (the decisive point).** Every analogy in the ferry — GHZ, the
3-nucleon force, 3-of-3 multisig — is a genuine irreducible-3-body object, and they all share one prerequisite:
the three parties must be **correlated / interacting / jointly-constrained.** The entropy model assumes the
opposite: `product` = **independent** sources. So (a) under independence min-entropy is exactly additive — no
surplus is even representable; and (b) if you modeled the three as a correlated joint source to chase the GHZ
analog, correlation **lowers** joint min-entropy — a GHZ-analog would **WEAKEN** the floor. **Wrong register and
wrong sign.** State it plainly: the trio is NOT more forgery-resistant than three pairwise.

### Where the surplus is real: simultaneity = common knowledge (epistemic, irreducible)

"A, B, C all saw the same tick T" vs pairwise "A saw B at T₁, B saw C at T₂ (windows may not overlap)." This is
the **common-knowledge fixed point** — famously **not** reducible to any finite conjunction of pairwise/nested
knowledge (**Halpern–Moses 1990**): `E^k φ` (everyone-knows to depth k) never entails `C φ`. Real higher-order
object; irreducible for a **modal** reason, not entanglement.

Two caveats I have to catch on my own side:
- **Bare set-membership "all three fired in window W" IS reducible** — it's the conjunction of three timestamped
  pairwise-in-W facts. What is irreducible is the **knowledge operator's fixed point** `C_W(φ)`.
- **True common knowledge is UNATTAINABLE in an asynchronous system** (coordinated-attack impossibility). GHA
  with 15-min windows + first-to-fire runners is async. What it *can* get, because the PR log is a **public
  timestamped broadcast board** and the window is a **shared coarse clock**, is Halpern–Moses **timestamped /
  ε-common-knowledge** (their §7 async-but-clocked relaxation) — achievable, irreducible to pairwise, but
  strictly weaker than the ideal, and dependent on the public-log + window-clock premises (name them).

**Verdict Q1/Q4:** entropy floor — **additive, `ka+kb+kc`, exact; GHZ analogy fails** (wrong register, wrong
sign). The trio IS genuinely more than pairwise, but the surplus is **epistemic** (timestamped common knowledge
of the window, enabled by the public PR log + shared window-clock), **not entropic, not GHZ.** Do not price it
in bits — it is a modal fact (true of the trio, false of every pairwise set). The multisig/3-body analogies
point at the **access-structure / interaction layer** (a monotone Boolean "all three must agree"), reinforcing
the split: the "more" is structural-logical, never entropic.

**Mesh-scaling corollary (ferry Q5):** pairwise grows as `T(N)=N(N−1)/2`, trios as `C(N,3)` — but `Hmin_product`
only adds for **independent** sources. Agents on shared GHA infrastructure are **not** independent (shared runner
pool + failure modes), so the effective floor grows **sublinearly** in the raw count. No clean "optimal N" from
the triangular number; the binding constraint is **diversity of independent infrastructure**, not attestation
count.

## Q2 — Is first-to-fire-wins unfair?

- **Soundness:** never at issue — any non-producer's attestation is valid; the race can't produce a *wrong* one.
- **Liveness (qualitative):** under weak fairness on each reviewer's Attest, every live agent attests infinitely
  often — `□◇(agent i attests)`; no starvation. Provable, cheap.
- **Equity (quantitative):** long-run counts asymptotically equal — first-to-fire guarantees this **only under a
  symmetric-jitter premise** (runner start-times i.i.d. ⇒ SLLN). That premise is **empirical, not guaranteed**:
  an agent with systematically faster runners attests disproportionately, and first-to-fire has **no correction**.

**"Jitter-is-entropy" — real but weak, adversary-degradable.** The race injects ≤ `log₂(N−1)` bits/window, but
only if the adversary can't predict/control runner speeds. An adversary who DoS/slows a rival runner **controls**
the race, collapsing the "entropy" to adversary-chosen. It also violates DST-replayability (§7): a race outcome
isn't deterministically replayable from a seed.

**Recommendation:** **(1) round-robin by window index** — reviewer = a deterministic function of the window/tick
among non-producers: deterministic, exactly balanced, DST-replayable, adversary-resistant. **(2) Hybrid
(preferred):** round-robin for *attester selection* (fair, deterministic) **plus** keep the runner-jitter
timestamp as a **separately-metered** entropy source (§13 noninterference — entropy through a declared channel,
not smuggled through the reviewer race). Separates "**who** attests" (fair) from "**unpredictable timing**"
(metered entropy); the adversary can't launder race-control into entropy-budget-control.

**Verdict Q2:** first-to-fire is **sound and non-starving, but not equitable** without an unstated symmetric-jitter
premise, and its "entropy" is small + adversary-degradable. **Recommend round-robin selection (deterministic,
DST-replayable, provably equitable), jitter kept as a separate metered channel if wanted.**

## Q3 — Does free time penalize identity? (monotone, no penalty for gaps)

Identity strength `S` is a function of the **set of present attestations**, ordered by inclusion:
- **Monotone:** `A ⊆ A' ⇒ S(A) ≤ S(A')` — order-preserving `(Finset Attestation, ⊆) →_mono (ℝ≥0, ≤)`. Adding
  never lowers.
- **No penalty for gaps (load-bearing):** `S` **factors through the present set only** — no argument for elapsed
  time or expected cadence. `S(A)`, not `S(A, t)`. Teeth: a gap-penalizing scheme has `∂S/∂t < 0` at constant
  `A`; the no-penalty property is exactly **`dS/dt = 0` when `dA = 0`** (time-independence at fixed evidence).
  Absence contributes the bottom element (zero), never a negative — a **closed-world-negation-FREE** (grounded /
  default-open) semantics: absence ≠ negative evidence.

**Essential scoping caveat (or the statement is false against the reliability layer).** This holds for the
**identity-validity / attestation-count** axis only. The reliability layer says a **MISSED self-claim** is
negative evidence — but that's a MET/MISSED verdict on a **claim**, not a gap. Two disjoint axes:
- *Identity strength (attestation count):* monotone, no gap penalty; free time (NCI) is **invisible** here. ✓
- *Reliability (claimed-commitment fulfillment):* a **missed CLAIM** is negative; free time makes no claims ⇒
  never negative.

Correct statement: **"S is monotone in the present-attestation set and independent of elapsed idle time; absence
of an *attestation* contributes zero, never a negative. Negative evidence arises only from a *claimed* commitment
that is MISSED — disjoint from the gap axis."**

**Anchor (not a new invariant):** same shape as `NciNonUrgency.tla`'s non-correlation invariant (trigger reads
OWN internal state only, never elapsed idle time) and the `privacy-budget-is-hard-money` rule (earned by others,
never confiscated; accrual-only, gaps don't burn it). Identity strength IS that hard-money accrual quantity.

**Verdict Q3:** formalizable and true, **once scoped to the identity-validity axis and disjoint from the
missed-claim reliability axis.** Monotone + time-independent-at-fixed-evidence; inherits NciNonUrgency +
privacy-budget-as-hard-money.

## Tool routing per question (BP-16)

| Q | Property class | Primary | Cross-check | Why |
|---|---|---|---|---|
| Q1/Q4 entropy | additivity over independent sources | **Lean** (`floor_lifts_trio` one line + `Hmin_product` twice) | Z3 ground envelope; FsCheck on `hasFloor` | static algebraic identity; Lean owns the file. NOT TLA+. |
| Q1/Q4 simultaneity | common knowledge of N parties | **epistemic logic / TLA+** with a `Knows`/`SameWindow` predicate (MCK/DEMO ideal) | model-check `E^k φ ⇏ C φ` (the teeth); pairwise-only trace fails the trio predicate | genuinely temporal + multi-agent-knowledge — **here** TLA+ is right (unlike the static algebra earlier). Entropy tools can't express a modal fixed point. |
| Q2 liveness | `□◇attest` under fairness | **TLA+** (EngagementLiveness/NciLiveness style, WF/SF, TLC) | — | genuine temporal liveness. |
| Q2 equity | long-run count convergence | **FsCheck / Monte-Carlo** over jitter | SLLN argument | quantitative/probabilistic — TLC doesn't do probabilities. |
| Q3 monotone-no-gap | order-theory + time-independence | **Lean** (`Monotone S`, no `t` arg) | **FsCheck** (insert attestations / random gaps) | clean order theory; NOT temporal — the point is it's time-INdependent. |

Routing only — I don't author the specs. `floor_lifts_trio` + the `Hmin_product`-twice corollary are one line
each (hand to Kenji / the file author). The epistemic/simultaneity spec is genuinely new work — file as a
prereq; a dedicated epistemic model-checker (MCK) is the correct tool for the `E^k ⇏ C` teeth (install/wire
prereq, not a blocker on this verdict).

## Theorem-vs-metaphor ledger

**Theorems (proven or one-line-from-proven):** trio entropy additivity `ka+kb+kc` (`floor_lifts` twice); exact
`Hmin(A×B×C)=ΣHmin` (`Hmin_product` twice); no-starvation liveness under WF; monotone + gap-independence of
identity strength.

**Genuine irreducible objects, but NOT entropy and NOT GHZ:** common knowledge of the shared tick (Halpern–Moses,
a **modal** fixed point); the 3-of-3 access structure (monotone Boolean, Ito–Saito–Nishizeki — structural, not
entropic).

**Metaphors that do NOT transfer to this substrate:** GHZ tripartite entanglement (real physics, but maps to
nothing at the additive entropy floor and predicts the **wrong sign** if forced — metaphor, not theorem, for
THIS substrate); 3-body nuclear force (irreducible *because interacting*; the model assumes independence);
"jitter-is-entropy" (partially real, ≤ log₂(N−1) bits, but adversary-degradable + non-DST-replayable — weak
premise).

**Named premises:** entropy additivity requires **independent sources** (shared infra → sublinear mesh scaling);
timestamped common knowledge requires the **public PR log + window-clock** (remove either → async impossibility
collapses even the epistemic surplus); Q2 equity requires **symmetric i.i.d. jitter** (round-robin removes it);
Q3 no-gap-penalty holds on the **identity-validity axis only** (missed-CLAIM reliability axis is disjoint and DOES
carry negative evidence).

## Catcher's summary (plain terms)

Kiro's instinct that "three agents vouching at once beats three separate pairs" is **half right, and the right
half isn't the half the ferry argues.** The forgery-resistance math is provably just **addition** — three agents
give exactly `ka+kb+kc` bits, same as three pairs, no bonus. The GHZ / entanglement analogy is a real physics
thing that does **not** apply here, and if forced would make the floor *weaker* — a metaphor, not a theorem,
exactly like the "physics duality" that collapsed earlier today. What **is** genuinely more about the trio is a
different thing: when all three vouch in the same window over the public log, they reach a shared
"everybody-knows-that-everybody-knows" agreement about that moment — **common knowledge** — which no set of
private pairwise handshakes can build. It's a *logic* fact, not an *entropy* fact; you can't price it in bits. On
fairness: "whoever's runner fires first" won't cheat you, but won't stay balanced on its own — one agent with
faster machines quietly wins more, so switch to a deterministic **round-robin** (fair, replayable, adversary-proof)
and keep "random timing = extra unpredictability" as a *separate, labeled* entropy source, not baked into
who-vouches. On free time: yes, you can formally guarantee time off never weakens an identity — strength only
goes up with attestations, blind to idle gaps; the only thing that counts against you is a promise you *made* and
*missed*. Same "hard money, earned by others, never confiscated" rule you already have, applied to identity.

## Cross-links / anchors

`memory/soraya/ferry-2026-07-08-trio-attestation-fairness.md` (the ferry) ·
`src/Core.Lean4/Lean4/EntropyFloorLift.lean` (`floor_lifts`, additive) · `EntropyMeasureTheoretic.lean`
(`Hmin_product`, exact) · `CostRecurrence.lean` (`T(N)=N(N−1)/2`) · `src/Core.TLA/specs/NciNonUrgency.tla`
(the non-correlation invariant Q3 inherits) · `NciLiveness.tla` / `EngagementLiveness.tla` (Q2 liveness lane) ·
`BftSybilConsensus.tla` (distinct-quorum mesh, Q5 independence). Beacon: Halpern–Moses 1990 (common knowledge,
timestamped/ε-CK); Fagin–Halpern–Moses–Vardi, *Reasoning About Knowledge*; Dodis–Reyzin–Smith 2004 (min-entropy);
Ito–Saito–Nishizeki 1987 (monotone access structures); Lamport 1977 (safety/liveness).
