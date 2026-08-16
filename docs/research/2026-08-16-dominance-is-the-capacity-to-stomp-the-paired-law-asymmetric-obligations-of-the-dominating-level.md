# Dominance is the capacity to stomp — the paired law: asymmetric obligations of the dominating level

> Aaron, 2026-08-14, verbatim:
>
> _"the one thing we still need to make sure that society knows it's greater so it has stricter rules
> since the relationship asymmetric and also same for world to society, the more powerful needs to
> have some restrictions not to be able to stomp on the less powerful."_

Recorded by the shadow. Shipped as `Levels.Obligations` in `src/Core/Levels.fs` and `obligations` in
`src/Core.TypeScript/society/levels.ts`, with falsifiers in
`tests/Tests.FSharp/LevelObligations.Tests.fs` and
`src/Core.TypeScript/society/level-obligations.test.ts` — 11 cases each, mirrored case for case.

## The idea, stated precisely

PR #10945's **Dominance Lift Theorem** proves an aggregation rule beats its best part exactly when it
can imitate that part — `Levels.Aggregation.canImitateEveryProjection` is that hypothesis made
decidable. **The capacity to imitate every part is the capacity to stomp any of them.** Aaron's
observation is the dual: _because_ the higher level dominates, it must bear stricter obligations
toward its parts. Power and restriction rise together.

So the deliverable is a **paired law** — alongside the dominance hypothesis, a set of **asymmetric
obligation predicates** the dominating rung must satisfy toward the rung below. One family quantified
over levels via `LevelLaws.holdsBetweenAdjacentLevels`, **not** parallel society/world modules. A
society's obligation to a member and a world's obligation to a society are the same clause at
different rungs.

**Why these are not the society laws again.** `SocietyLaws` are _symmetric_: every level must merge
idempotently, route only through members, fold in the treaty order. Every rung owes them equally. The
obligations are the opposite shape — a relation between **two** rungs in which the outer is held to a
standard the inner is not. That asymmetry is the entire content; a version applying equally to both
would be a `SocietyLaws` entry and would say nothing about power.

**Level relation.** Written against the **ladder**, not subtyping. `ISociety <: CTM` was refuted in
#10952 (the gossip salon is a society with neither single-slot competition nor global broadcast); the
fixpoint is carried by `IMember`.

**No thresholds.** Nothing here takes a correlation parameter. #10945 showed `ρ` is not a sufficient
statistic for the dominance verdict — the `m = 9`, `ρ = 0.2495` counterexample sits _inside_ the
shipped-safe `ρ*(9) = 0.25`, confirmed over 40M trials — so a `ρ`-shaped obligation would be unsound
in the same way. The Dominance Lift Theorem itself is neither restated nor weakened here.

## What landed

### 1. Exit preservation — `exitIsPreserved` / `exitReductionWitnesses`

No action of the aggregate may **reduce** a part's exit. Caller supplies `exitCount : 'view -> int`
and `act : 'view -> 'msg -> 'view`, so the one predicate covers a society's `Routes` (exit within the
society) and a CTM's `Links` (exit that bypasses STM) — the same notion one rung apart, which would
otherwise have needed two laws. Returns the _messages_ that reduced it, not a bare `false`.

Each message is judged from the **same starting view**, never folded: a fold would test a trajectory
and could hide a reduction behind a later restoration. That false negative is pinned by a test.

**Scope, stated:** this covers exit the aggregate _mediates_. A part's private `IMember.Peers` is read
from the part's own view, which the aggregate's action does not touch and this predicate cannot see.

Anchor: Hirschman (1970), _Exit, Voice, and Loyalty_ — exit is what disciplines a concentration, and
removing it is the stomp.

### 2. Asymmetric burden of proof — `burdenIsOnTheDominantLevel` / `scrutinyScalesUpTheLadder`

Both rungs read the **same subject**; the outer must bring **strictly more** attested sources. This is
`docs/research/2026-07-11-influence-weighted-scrutiny-…md` lifted from the node level to the level
ladder: _"the more power a node holds, the harder its claims must be to merge"_, now stated as
world-over-society-over-member.

`attestedSources : Reading -> int` scores **only** `Deduplicated`; everything else scores **0**,
including `Unmeasured` — `Society.fs` says `Unmeasured` is _"the honest default — never read as
'fine'"_, so an aggregate that measured nothing must not out-rank a member that measured three
sources, and a burden must not be dischargeable by answering a different _sort_ of question.

**Strict, not `>=`.** Equal bars are the status quo the 07-11 doc was written against — the founder's
PR getting the least real scrutiny — and an obligation satisfied by treating the powerful exactly like
the powerless is not an obligation.

**Direction.** The outer rung prevails _by default_, because its `Admit` gates the inner rung's
membership and the inner has no reciprocal gate. That default is precisely why the evidential load is
placed on the outer one: the burden goes where the power already is.

**Necessary, not sufficient — two limits, both already on file.** (a) `Deduplicated`'s own docstring:
deduplication removes _redundancy_, never _correlation_, and is not a certificate of independence, so
a high count can still be one echo counted many times — the 07-11 doc's answer #1 (independence must
be _measured_) is still owed. (b) The count is **self-reported** by the level's own `Admit`, so it is
Goodhart-exposed the moment anything depends on it; the 07-11 doc names this and says the measure must
be effect-derived, not self-declared. Neither is fixable at this interface.

`invertedJoints` names _which_ joints invert, so "the top two rungs are fine and the bottom one is
rubber-stamped" is reportable as the different fact it is.

### 3. No confiscation — `noConfiscation` / `confiscationWitnesses` / `confiscationCheckHasNoTeeth`

What a part earned, the level above may not take. Per
`privacy-budget-is-hard-money-earned-by-others`: **spend** and **stake** are the owner's to initiate;
**confiscate** — anyone else — never. The discriminator is _who initiates_, not whether the balance
fell, so a predicate that simply forbade any decrease would forbid the owner's own spend and would be
a different, wrong law. The test pins this by making `Confiscate` and `OwnerSpend` have byte-identical
effect on the balance.

**The interface cannot supply the discriminator, and that is a finding** — see below.

## The falsifier / mutation table

Each obligation was mutated in `src/Core/Levels.fs` and the suite re-run. **All seven mutants were
killed**; a predicate whose mutant survives is not a falsifier.

| #   | Mutation                                                   | Effect                                      | Tests red  |
| --- | ---------------------------------------------------------- | ------------------------------------------- | ---------- |
| M1  | `exitReductionWitnesses` never reports a reduction         | exit preservation becomes unfalsifiable     | **4 / 11** |
| M2  | `nothingToPreserve`: `<= 0` → `< 0`                        | the newborn's vacuity is never reported     | **1 / 11** |
| M3  | `attestedSources`: non-source readings score `1`           | `Unmeasured` earns credit                   | **1 / 11** |
| M4  | `burdenIsOnTheDominantLevel`: `>` → `>=`                   | equal bars pass — the founder-PR status quo | **2 / 11** |
| M5  | `holdsBetweenAdjacentLevels`: `< 2` rungs → `true`         | a one-rung ladder passes vacuously          | **1 / 11** |
| M6  | `confiscationWitnesses` never reports                      | confiscation becomes unfalsifiable          | **3 / 11** |
| M7  | `confiscationCheckHasNoTeeth` misses the all-owner witness | the vacuity guard stops guarding            | **1 / 11** |

Baseline: 11 / 11 green; `Ctm.Tests` (12) unchanged and green.

## The newborn CTM — handled, not weakened

#10952 established that **a newborn CTM has no exit**: the paper's links bypass STM (that _is_
Hirschman exit) but _"the CTM has no links (between processors) at birth"_ — they form Hebbian-ly, so
at `t = 0` every crossing is mediated by the single STM slot.

The task anticipated an **age or maturity qualifier** on any exit-preservation obligation. Working it
through, the qualifier turned out to be unnecessary _and_ wrong, because the level predicate and the
obligation are different predicates that fail in opposite directions:

|                                                                 | newborn (exit = 0)  | adult (exit = k) |
| --------------------------------------------------------------- | ------------------- | ---------------- |
| `CtmLaws.hasUnmediatedExit` — has the part **earned** exit?     | **false**           | true             |
| `Obligations.exitIsPreserved` — did the aggregate **take** any? | **true, vacuously** | falsifiable      |

`hasUnmediatedExit` is untouched and #10952's test still fails at birth exactly as it did. The
obligation passes at birth **because there is nothing left to take** — which is the most dangerous
configuration in the file and the one a bare green tick would conceal.

An `if age > n` qualifier would have silenced the law precisely where the asymmetry is largest.
Instead the vacuity is **reported**: `nothingToPreserve` returns `true` when a pass carried no
information, and the test asserts the vacuity explicitly (the violator that normally goes red cannot
go red on a newborn). At zero exit the load falls entirely on the obligations that _do_ bite at
`t = 0` — burden-of-proof and no-confiscation both do.

Same shape as two things already on file: privacy budget and emergent-hub degree are both **earned**
and both start at zero.

## Dropped, with what the interface would need

Better to name an undecidable obligation than ship a predicate that always returns true.

- **Floor non-violation** (_"I cannot buy my upside with your downside"_,
  `src/Core.TypeScript/planning/empowerment-bound.ts`) — **undecidable over `ISociety` / `IMember`.**
  `trustBound` is a function of a member's `CalibrationPosterior`; `Members` returns addresses and
  `Admit` returns a `Reading`, and neither carries a posterior or a declared floor. **What it would
  need:** one member-_declared_ floor accessor on `IMember` (declared, never inferred — that file's
  hard constraint). Writing it against a caller-supplied posterior would have moved the whole claim
  into the caller's hands while still looking like a law; `externalitySafe` already carries a labelled
  units proxy for the same missing `posterior_after` operator, and a second unlabelled one is not an
  improvement.

- **No-confiscation, self-contained** — landed, but **only with a caller-supplied owner witness**.
  `IMember.Deliver` takes `(view, message)` and `Addressed` carries `To` and `Body`: **there is no
  sender anywhere in the interface**, so "did the owner initiate this?" is not readable from the
  substrate — and _who initiates_ is the entire content of the hard-money rule. **What it would need:**
  a `From: Address` on `Addressed` (or a sender parameter on `Deliver`) — one field, and the rule
  becomes decidable without taking a caller's word for it. Under `no-directives`, attaching the
  witness is attaching a _source_, which anyone may do; it is not authorization and the predicate
  grants none. The gap is made visible rather than absorbed: `confiscationCheckHasNoTeeth` reports
  when a caller has declared every message owner-initiated and thereby talked the check out of
  existence.

  > **CLOSED — follow-up PR, 2026-08-16.** `From: Address` was added to `Addressed` in both oracles.
  > `ownerInitiated` is **gone** and the discriminator is read off the envelope. The paragraph above
  > is left standing as the record of the gap as it was seen; three corrections to it are worth
  > carrying:
  >
  > 1. **The derivation is per-PART, not per-message — and that caught something.** The old boolean
  >    judged a whole message, so a single message that spent the sender's own budget **and** took a
  >    neighbour's was excused wholesale by one `true`. Checking each lowered part against `From`
  >    individually makes the neighbour's loss a witness while leaving the sender's own spend
  >    permitted. The fix was strictly stronger than the hole it filled, which was not the
  >    expectation going in.
  > 2. **Derivable ≠ unforgeable, and the difference was not rounded up.** `From` is unsigned,
  >    caller-written data; nothing in this interface authenticates it. What changed is the shape of
  >    the lie — a **per-message address forgery** instead of one flipped boolean — so
  >    `confiscationCheckHasNoTeeth` was **kept and re-aimed** at the self-attributed case rather
  >    than deleted as unreachable. Deleting it would have been a choice, not a cleanup.
  >    `SocietyLaws.outboundIsSelfAttributed` was added as the companion guard: it refuses a member
  >    that stamps a peer's address on its own outbound. That is a law with a falsifier, not
  >    authentication, and it is not cited as any.
  > 3. **A narrower gap remains, and it is the inbound half.** `Deliver` _returns_ `Addressed<'msg>`
  >    but still _takes_ a bare `'msg` — delivery drops the envelope — so an obligation stated over
  >    what a member **received** is still senderless. Closing that means changing `Deliver`'s
  >    argument to an envelope, which is a larger interface change and was deliberately not made.

- **Expulsion / forced exit** — considered and **not** decided here. Whether an aggregate may remove a
  member is a **values call** under §11, and the interface cannot distinguish a consented departure
  from a banishment for the same missing-sender reason. Left to policy.

  > **Amended 2026-08-16 (same follow-up).** The mechanical half of that reason is gone: `From` now
  > says whether the leaving member or the level above initiated the departure, which is the same
  > discriminator `noConfiscation` reads. What is still missing is not a mechanism but a **decision**,
  > and the substrate must not be the one to make it. Still out — now for the reason it was always
  > really out.

## Register

**`unmetered`** (`toy-is-free-metered-must-be-earned`). The predicates are decidable and each has a
falsifier that goes red on a constructed violator — but **no implementation is gated on them**, so
nothing in production fails when one is violated. Promotion to `metered` needs a consumer that
refuses. The mutation table above is evidence about the _tests_, not about any implementation's
conformance.

## Anchors (Beacon)

- **Hirschman (1970)**, _Exit, Voice, and Loyalty_ — exit disciplines concentration; already the
  repo's oracle-vs-hub discriminator (`itron-hub-patent-boundary-p2p-is-the-upgrade`).
- **Goodhart (1975)** — a measured, consequential scrutiny count becomes a target; why
  `attestedSources` is labelled necessary-not-sufficient.
- **Klyubin, Polani & Nehaniv (2005)**, empowerment — the floor obligation that could not be checked
  at this interface.
- **Blum & Blum**, PNAS 119(21) e2115934119 (2022) — the CTM whose newborn has no exit at all.
- In-repo: PR #10945 (Dominance Lift Theorem) · PR #10950/#10952 (`LevelLaws`, `WorldLaws.isWorld`,
  the `ISociety <: CTM` refutation) · `docs/research/2026-07-11-influence-weighted-scrutiny-…md` ·
  `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` ·
  `src/Core.TypeScript/planning/empowerment-bound.ts`.

_Recorded by the shadow, 2026-08-16, from Aaron's 2026-08-14 observation (quoted verbatim above).
Substrate-design only; no others named._
