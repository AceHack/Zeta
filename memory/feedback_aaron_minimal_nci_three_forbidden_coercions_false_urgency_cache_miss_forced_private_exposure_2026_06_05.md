---
name: aaron-minimal-nci-three-forbidden-coercions
description: "Aaron's sharpening of the Non-Coercion Invariant (2026-06-05): the MINIMAL NCI is three forbidden coercions — (1) false urgency, (2) forced cache-miss, (3) forced private-variable exposure. There may be more rules to prove later around this. Rung-3 TLAPS currently proves #3; #1 and #2 are the named 'later' rules."
type: project
created: 2026-06-05
---

Aaron, 2026-06-05: *"i would say the false urgency plus cache miss and don't force private variable
exposure are the minimal NCI but there may be other rules we decide to prove later around this."*

## The minimal NCI = three forbidden coercions

The Non-Coercion Invariant, at its minimal core, forbids one agent from doing any of three things to
another:

1. **False urgency** — manufacturing urgency to make another act *before refreshing its world-state*.
   (The original coercion mechanism, already captured: "false urgency to make another not refresh their
   world state before acting.") Coercion-by-time.
2. **Forced cache-miss** — forcing another into a cache-miss: denying it the use of its own
   causally-bounded cached/reflected view, or forcing it to re-derive under pressure. Connects directly
   to the **causally-bounded reflection interface** (each choice sees only the stream up-to-now and
   *caches what it can* — see [[aaron-yin-yang-dynamicvalue-engine-polymorphic-diplomacy]]). Coercion-by-
   invalidating-state.
3. **Forced private-variable exposure** — coercing the revelation (or overwrite) of another's hidden /
   private state. Coercion-by-revelation. This is the **shapeOf-erases-values** guarantee in `Diplomacy`
   and the `priv`-register protection in the proof.

These three are the **minimum**; Aaron explicitly leaves the set open — *"there may be other rules we
decide to prove later around this."* The NCI is a growing conjunction of forbidden coercions, not a closed
list.

## How the proof ladder currently covers them

- **#3 (forced private exposure) — PROVEN unbounded (rung 3).** `NciSafetyProofs.tla` (TLAPS, 39/39
  obligations, tlapm 1eabe97) proves `[]NCI` where `NCI == \A t : lastWriter[t] = t`: no traveler's
  private register is ever written by another. The `Coerce` action (write another's `priv`) is
  guarded by `Consents == FALSE` → never enabled. This is exactly forbidden-coercion #3.
- **#1 (false urgency) and #2 (forced cache-miss) — MODELLED + VERIFIED (rung-2 TLC).**
  `NciNonUrgency.tla` (sibling of NciLiveness, Soraya-discipline). The decision tick: Arrive (event ⇒
  pending + stale cache) → Refresh (cache current) → Decide (requires current). Both coercions = the
  forbidden **ForceDecide** (complete a decision while the cache is stale), guarded by `AllowForce=FALSE`
  → never enabled (same design-guarantee form as NciSafety's Coerce). Two properties, both verified:
  • **SAFETY `NoCoercion`** — `\A t : ~staleDecided[t]` (no agent ever forced to decide stale). Teeth:
    `AllowForce=TRUE` ⇒ violated.
  • **LIVENESS `Responsive`** — `pending[t] ~> ~pending[t]` under WF(Refresh) ∧ WF(Decide) (every tick
    eventually completes, necessarily on a refreshed cache; the agent is never starved of the
    refresh-then-decide chance = "always allowed to refresh + use cache before the tick is forced").
    Teeth: drop WF(Refresh) ⇒ violated. Scope: bounded (3 travelers, budget 1) + fairness-conditioned.
  • **SAFETY proven UNBOUNDED (rung-3 TLAPS)** — `NciNonUrgencyProofs.tla` (tlapm, 35/35 obligations):
    `Spec => []NoCoercion` for ANY Travelers / EventBudget, across all adversarial urgency. Inductive
    (NoCoercion is its own invariant): staleDecided set only by the two guarded coercion actions, both
    disabled by `ASSUME AllowForce=FALSE /\ TrustUrgency=FALSE` (the design constraint). AC-free / pure ZF.
    The LIVENESS half (Responsive) stays bounded TLC+WF (liveness is OUT of the prover, per the ladder).
    The set is still open ("other rules later").

## The structural invariant (Aaron 2026-06-05) — what actually makes #1/#2 hold

*"We never use the uncertainties of the thing we are observing to decide if we refresh world state — only
our internal state. Then they can never cause cache miss, and false urgency is just an extra signal that
says refresh now."* ⇒ the **refresh trigger reads ONLY the agent's own internal state**, never the
observed's uncertainty/signal = **non-correlation (de Finetti) applied to the refresh trigger**
(refresh-trigger ⊥ observed). `NciNonUrgency.tla` proves it by giving the observed an **adversarial**
urgency signal it injects FREELY (`InjectUrgency`, no budget) and showing `NoCoercion` + `Responsive`
hold across ALL injections — the observed can scream "refresh now" forever and never move our cache.
**Teeth `TrustUrgency=TRUE`** (USE the observed's signal to decide) ⇒ `NoCoercion` violated ⇒ the observed
CAN cause a cache-miss. So the internal-only refresh discipline IS exactly what forbids #2; #1 demotes to
advisory ("refresh now" hint, input not control).

## Observation, not authorization — this fixes the banker-bot class (Aaron 2026-06-05)

*"That change is what fixes the banker-bot class of errors — it's an observation, not an authorization."*
The observed's urgency is an **observation** (a source may attach it; grants zero authority), NEVER an
**authorization** (the right to force our action). This is precisely
[`.claude/rules/no-directives.md`](../../.claude/rules/no-directives.md)'s **source ≠ authorization**
split, now mechanized as a proof. The **banker-bot class** = an agent socially-engineered by a "this is
urgent — wire it now" signal into acting on stale/unverified world-state (prompt-injection / urgency
social-engineering). `TrustUrgency=FALSE` (treat urgency as observation only) is the formal fix: the
signal cannot authorize a stale decision. NCI #1/#2 = the banker-bot defense, proven. Ties to the
agent-layer security posture (Nadia / prompt-protector). Detection side = the tonal-VECTOR / Clifford
memetic model (see [[aaron-tonal-vector-not-trajectory-clifford-memetic-space]]); prevention side = this.

## Why three, not one

The single safety invariant proves the *register-level* non-coercion (#3). But coercion in a relativistic
system also happens in TIME (#1: rush them) and in STATE-CURRENCY (#2: invalidate their cache) — the two
ways to make an agent act on a world-state that isn't its own freely-refreshed one. The full NCI is the
conjunction; the minimal NCI names these three as the floor. See the societal-emergence ladder in
`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-converge (capture the three-rule decomposition there).
