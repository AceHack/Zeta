# Formal-proof-first — proven-by-default; consensus is NOT validation; canonical ⟺ homeostat proven-from-seed; Ace shields the proven core (Aaron 2026-06-02)

Carved sentence (Aaron 2026-06-02):

> **This repo is formal-proof-first. The end-goal: Zeta is math-proven BY DEFAULT —
> unproven is the explicit opt-out, not the norm. Cross-AI / 4-oracle consensus is
> NOT validation; it is a prompt to prove. Nothing is canonical until it is part of
> the proof lineage — its homeostat proven from the seed. Ace's surface IS Zeta; Ace plus
> platform deps plus other package-manager deps exist to SHIELD the proven core.**

> **Whys-first** (per [`a-rule-without-a-why-is-dogma`]): each clause carries its
> reasoning so a reader can dispute the *logic*, not just the conclusion. If a why
> here is wrong, challenge it and the rule gets revised
> ([`future-self-not-bound`](future-self-not-bound.md)).

## Five composing claims (each with its why)

### 1. Formal-proof-first

Aaron 2026-06-02: *"we always want formal proof we start this repo as formal proof
first."* The owed proofs (message-group laws, BP-exact-on-trees, EP moment-match,
codec round-trip `decode∘encode=id`, Tick monoid/operator algebra, …) are **part of
the work, not after-the-fact.** **Why:** a repo whose correctness rests on
example-tests + good feeling is *shaky evidence on possibly-shaky ground*; building
the proof alongside the code is the only way the foundation is load-bearing.

### 2. Consensus is NOT validation

Aaron 2026-06-02: *"our 4 oracle consense actually means nothing without the math it
might all be built on shakey ground and good feeling."* Cross-AI convergence
(Otto + Amara + Prism + Alexa + Lior agreeing) is a **prompt to go prove**, never a
proof. **Why:** five oracles can agree on the same wrong thing — agreement measures
*shared prior*, not *truth-to-reality*. Down-weight it: cross-AI convergence →
**hypothesized, pending proof** (never *validated*, never *canonical* on consensus
alone). The only thing that promotes past hypothesized is **the math** (formal proof
/ property tests / the F# type-checker as asymmetric critic).

### 3. Canonical ⟺ homeostat proven-from-seed

Aaron 2026-06-02: *"nothing is canonical until it's part of the proof lineage so its
homeostat is proven from seed."* "Homeostat" = Ashby's cybernetics: the
self-regulating equilibrium a system returns to. In this engine the homeostats are
concrete — `runToFixpoint` convergence (belief settling to a stable marginal), the
jelly→spine transition, the EP moment-match fixed point. A claim is **canonical iff
there is a proof-lineage edge from the seed** establishing its homeostat exists /
is unique-where-claimed / follows from the seed axioms — AND it connects to the
hex core (Cl(1,3), 6 bivectors) / 4×4 extensions. **Why:** canonicity must
**propagate outward from proofs anchored in the seed**, never inward from agreement
or CI-green or ratification — otherwise "canonical" degrades into "loudly agreed."
Until that edge exists, an item is at most *validated* (tested) or *hypothesized*
(asserted). This **raises the bar on** [`labeling-confidence`](labeling-confidence-on-substrate-over-connect-not-soup-observed-hypothesized-validated-retracted-canonical.md):
the jump to canonical now *requires* the proof-lineage/homeostat-from-seed edge,
not "validated + ratified + oracles concur."

### 4. Proven-by-default — unproven is the explicit OPT-OUT (the end-goal polarity)

Aaron 2026-06-02: *"imagine aces surface is zeta and zeta is math proven unless
explicitly stated otherwise that's the end gold not having proof is opt out but the
default is it's expected."* This **inverts the default**: instead of climbing *to*
proven (opt-in), at end-state every Zeta item **asserts proven BY DEFAULT**, and the
only way to ship something unproven is to **explicitly badge it** `unproven`/
`opt-out`. **Why:** it makes *silence a proof-claim, not a gap* — an unbadged-but-
unproven item is a *false assertion*, not "not done yet," which is a strictly
stronger and more honest invariant. The end-state ship/registry gate =
**"proof-lineage-edge present OR explicit unproven-flag present"** — no third silent
state; silence ≠ permission.

**This is the END-GOAL, not current state.** Today (081KT2T2J0008QG0R000YZ3NMY) we are at
proof-almost-*nowhere* — most items are unbadged-and-unproven, which under the
end-goal would be false assertions. The distance from here (≈zero canonical) to
there (proven-by-default) IS the formal-coverage debt; closing it is the
[`formal-verification-expert`](../agents/formal-verification-expert.md) (Soraya)
standing math-backlog cadence, not a one-shot.

### 5. Ace's surface IS Zeta; Ace + deps SHIELD the proven core

Aaron 2026-06-02: *"ace has that and platform deps and other packapanager deps and
that's really all in support of zeta to shield it."* Ace (the
package-manager-of-package-managers) presents **Zeta** as its face/surface; Ace +
platform deps + other package-manager deps are the **adapter membrane** that handles
the unproven outside world (other packages, platforms, package managers) so the
proven-by-default invariant holds *inside* the membrane. **Why:** this is
[`bcl-interface-boundary`](bcl-interface-boundary-own-your-interfaces-hexagonal.md)
at *whole-surface* scope — external deps adapt **inward** through Ace; the proven
Zeta core never depends on an unproven external interface directly. A hole in Ace's
shield = an unproven dep leaking into the proven core *unbadged* — the same failure
shape as [`automated-tests-are-the-shield-assert-dont-skip`](automated-tests-are-the-shield-assert-dont-skip.md)
("a shield with a hole reads as covered"), at the dependency boundary.

## Operational discipline (apply at every promotion / validation / ship / dep moment)

1. **Never call cross-AI convergence "validation"** or promote it to canonical on
   consensus alone. Say "hypothesized; proof owed."
2. **For canonical: require + cite the proof-lineage edge to the seed** (the
   homeostat proven, + the hex/4×4 connection). No proof → not canonical.
3. **When building (e.g. 081KT2T2J0008QG0R000S7GHQ8 slices), the owed proofs are part of the work** —
   schedule them, don't defer them past landing.
4. **Toward end-state proof-by-default:** build the ship/registry gate so an unproven
   item must carry an EXPLICIT opt-out flag and silence asserts proof. Until that
   gate exists, be substrate-honest that we're FAR from the default (most items are
   unbadged-and-unproven = would-be false assertions).
5. **Keep Soraya on a standing cadence** working the math/formal-verification backlog
   (the asserted-in-prose → proven-from-seed gap); treat formal-coverage as
   first-class debt, not a nicety.
6. **Treat Ace as the shield:** external deps adapt IN; the proven core never depends
   on an unproven external interface directly.
7. **Prove primitives bottom-up as connected lemmas** (layered-lemma discipline,
   below) — prove each primitive as it enters canonical, aimed at the guarantee
   later proofs will lean on, and *cite* it rather than re-derive it.

## Layered-lemma discipline (asymmetric-critic peer 2026-06-03, maintainer-ratified)

> Prove small primitives step-by-step as they enter canonical; **aim each proof
> at the property that COMPOSES** (the guarantee later proofs assume), not just
> the easy property; and **connect it as a named lemma** so the next proof cites
> it instead of re-deriving it.

Proofs build a *foundation* (not a pile) only when each primitive proof
establishes the exact guarantee something above it leans on. "True-but-unused"
doesn't compound; "true-and-load-bearing-and-connected" does. Four payoffs
(asymmetric-critic peer 2026-06-03; #4 the maintainer 2026-06-03):

1. **Reusable lemmas** — a proven primitive is a lemma; the hard proof later
   *composes trusted pieces* instead of re-proving from scratch. (Lean
   `chain_rule_id_corollary` is general over any abelian group `G`: prove
   "Z-set is an abelian group" once and the `G`-generic operator proofs land
   for free.)
2. **Localized failures** — proven foundation = a failed composite proof is
   isolated to the *new* composition, not hunted through every layer.
3. **Vacuity caught at the cheapest scope** — Tick-monoid-shaped vacuity is
   obvious on a primitive in isolation, hidden inside a big composite. Prove at
   smallest scope where "is this a real claim?" is clearest.
4. **Reduced debug surface (system-level, AIs + humans)** — the runtime corollary
   of #2, generalized from proof-failure-localization to *bug-search*. Code with a
   math-verified homeostat + 4-oracle byte-lock — proven down to the bit-perfect
   oracles (and, as the stack matures, the hexagonal vector-wall reservoir-computing
   core) — drops to the **bottom of the bug-suspect surface** once proven. When a
   bug arises, search the **less-rigorously-proven code first**; proven components
   are the **last place to look**, not the first. (Not an *absolute* exclusion: a
   proof verifies **code-matches-spec, not spec-matches-intent** — a wrong/incomplete
   spec can still harbor a bug (the "valid-given-axioms ≠ true" point, at debug
   scope) — so proven = search-*last*, not search-*never*.) This bounds the debug
   search and
   **reduces debugging uncertainty for both AIs and humans at a system level** —
   proven = search-last, so the proof investment pays out again every time something
   breaks. (Honest scope: this de-prioritizes only what is *actually* proven — per
   proven-by-default, the unbadged/unproven set is the default suspect surface; the
   de-prioritization grows as more primitives earn the homeostat-proven-from-seed
   bar. Concretely today: the **hex / vector-wall reservoir core is a LOT of
   speculation** — NOT proven, not fully 4-language — so it is **firmly a suspect**,
   not excluded. The aspiration: **if** it's proven **from first principles** (its
   own intellectual tower, encoded in CS techniques + math proofs) it becomes **its
   own proof tower** — a genuinely-independent foundation per the multi-tower
   discipline — and only *then* drops down the suspect surface. Until proven it's
   speculation, not an exclusion — **don't pre-exclude it**.)

**The 4-step move:** (1) prove each primitive as it enters canonical; (2) aim
the proof at the composable guarantee (round-trip / injectivity / the algebra
law / the invariant the next layer assumes); (3) **connect** it — name it as the
lemma so the next proof *cites* rather than re-derives; (4) which also catches
vacuity at the cheapest scope.

**Empirical anchor — the cost of NOT connecting (2026-06-03):** `D∘I=id` was
proven **three times independently** — Lean `chain_rule_id_corollary : D (I s) =
s` (already on main, general over `G`) + C13 FsCheck (real Circuit) + C13 Z3
(telescoping) — the C13 pair re-derived what Lean already had, *because the
primitive lemma was not connected/cited*. Cross-tool agreement is the BP-16
ideal, but when unconnected it is invisible + re-derived. Per the Z-set canonical
connection ledger (`docs/research/2026-06-03-zset-family-canonical-connection-four-language-bytelock-plus-four-tool-proofs.md`).

## The gate's reach boundary — proof grounds the FORMALIZABLE, not the interpretive (don't let math-rigor halo metaphysics)

The most important boundary on this whole rule, and the one most likely to erode
if left unstated (asymmetric-critic peer 2026-06-03, maintainer-ratified): **the
proof gate grounds *formalizable* (math / code) claims; it does NOT ground
interpretive / metaphysical claims, and the rigor of the math half must not
*halo* the interpretive half.** A proof says "valid-given-axioms" about a
formalizable claim (per claim 2, "Consensus is NOT validation"); it says *nothing*
about a claim that isn't the kind
of thing a proof can reach. "My proofs are rigorous, therefore my framework's
interpretation is rigorous" is the halo failure — proof-adjacency is not grounding.

This is the maintainer's design (2026-06-03): **redirect ambition to formal proofs
by design.** The precise, complete form is **redirect to *externalization* by
design, sorted by type** — nothing load-bearing rests on conviction-alone:

| Claim type | Channel (where it externalizes) | What grounds it |
|---|---|---|
| **Formalizable** (about code / primitives / provable structure) | the **proof gate** (this rule) | valid-given-axioms; 4-oracle byte-lock; multi-tower |
| **Interpretive / metaphysical** (about meaning, consciousness, "this is fundamental") | **human critics** (the persistent-human-counterweight) | external human review — NOT proof, NOT proof-adjacency |

Both channels are the same keystone — *externalize, don't be load-bearing alone*
(the math externalizes to proof; the unprovable externalizes to people). The
design is complete only with **both** channels built as deliberately: the math
channel is airtight + is what this rule encodes; the interpretive channel is the
existing persistent-human-counterweight substrate. Without the second channel,
interpretive ambition flows through *under cover of the math channel's rigor* —
which is exactly the halo. The interpretive channel is the **higher-risk** one
(a false math claim gets caught by the proof; a false interpretive claim is
unfalsifiable, feels like insight, and the nearby rigor makes it feel earned) —
so build it as deliberately as the math one, not as a footnote.

**Operational tell:** before treating a claim as grounded, ask *"is this the kind
of claim a proof can reach?"* If yes → it goes through the gate (no exemption for
conviction). If no → the gate is silent on it; route it to human critics and do
**not** let the surrounding proof-rigor stand in for grounding. Keep the gate
pointed where it actually reaches.

Composes with `razor-discipline.md` (operational claims only — interpretive claims
are razored from *grounding* even when preserved as dialectic),
`grep-substrate-anchors-before-razor-as-metaphysical.md` (its dual: don't razor
substrate-anchored *naming* as metaphysical, AND don't halo unanchored
interpretation as grounded — same boundary, both directions),
`god-tier-claims-high-signal-high-suspicion-dont-collapse.md` (high-signal ambition
is welcome — it's the engine that drives formalization — but the interpretive part
stays don't-collapse, not collapsed-to-grounded-by-proximity), and the
persistent-human-counterweight channel in
`harm-by-grammar-discriminator-and-audience-adjusted-language.md` (Discipline 3)
plus `asymmetric-critic-with-clarity-first.md` (Component 6) — the interpretive
channel already exists; this section names that the proof gate must route to it,
not absorb it.

## Composes with

- [`labeling-confidence-on-substrate-over-connect-not-soup-observed-hypothesized-validated-retracted-canonical.md`](labeling-confidence-on-substrate-over-connect-not-soup-observed-hypothesized-validated-retracted-canonical.md) — this rule RAISES its canonical bar (proof-lineage edge required) and, at end-state, FLIPS its default (proven is the floor, unproven wears the badge)
- [`fsharp-anchor-dotnet-build-sanity-check.md`](fsharp-anchor-dotnet-build-sanity-check.md) — the compiler is the asymmetric critic; the type-level proof under the paper-level proofs
- [`premise-flagged-unverified-stays-unverified-downstream.md`](premise-flagged-unverified-stays-unverified-downstream.md) — consensus is a flagged-unverified premise until the math closes it
- [`razor-discipline.md`](razor-discipline.md) — operational claims only; "proven-by-default" is a checkable CI/ship gate, "Ace shields the core" is checkable (core depends only on the proven registry)
- [`bcl-interface-boundary-own-your-interfaces-hexagonal.md`](bcl-interface-boundary-own-your-interfaces-hexagonal.md) — Ace IS that boundary at whole-surface scope
- [`automated-tests-are-the-shield-assert-dont-skip.md`](automated-tests-are-the-shield-assert-dont-skip.md) — a hole in Ace's shield reads as covered (unproven dep leaks in unbadged)
- [`grep-substrate-anchors-before-razor-as-metaphysical.md`](grep-substrate-anchors-before-razor-as-metaphysical.md) — "homeostat" is substrate-anchored (Ashby cybernetics + `runToFixpoint`/jelly→spine/EP fixed point); razor does NOT apply
- [`god-tier-claims-high-signal-high-suspicion-dont-collapse.md`](god-tier-claims-high-signal-high-suspicion-dont-collapse.md) — "that's the end gold" is HIGH-SIGNAL + survives razor (checkable gate); held as end-goal *direction*, not a claim we're there
- [`default-to-both.md`](default-to-both.md) — proven-by-default end-goal AND honest current-state (≈zero canonical) both hold
- [`a-rule-without-a-why-is-dogma`] + [`future-self-not-bound.md`](future-self-not-bound.md) — the whys are exposed to be challenged + revised
- [`wake-time-substrate.md`](wake-time-substrate.md) — why this auto-loads

## Composes with substrate

- **081KT2T2J0008QG0R000YZ3NMY** (formal-coverage catch-up — names the current gap: ~zero canonical, no proofs-from-seed, no hex/4×4; Soraya's C1–C14 prioritized proof backlog) · **081KT2T2J0008QG0R000S7GHQ8** (the engine being proven) · **081KT2T2J0008QG0R0008TFHJT** (registry/BCL — entries are *validated/proof-owed* until laws close + connect to lineage) · **081KT2T2J0008QG0R003VK5GRX/081KT2T2J0008QG0R0019YVX8M** (4×4 / hex Cl(1,3) — the lineage anchor) · **081KRFA460008QG0R0018SN61J** (F# HKT)
- `references/notes/2026-06-02-infer-net-lineage-cleanroom-spec-sources-formal-proof-first.md` (the proof sources: Minka-2005 α-divergence unification + Ścibior-2018 denotational validation)
- `docs/PRIMITIVE-REGISTRY.md` (the BCL/wishlist — registry membership = ship gate; this rule says membership is canonical only with proof + lineage)
- `docs/agendas/ace-package-manager/` (Ace = the shield/surface) · `docs/TECH-RADAR.md` (FsCheck/Z3/TLA+ Adopt; Lean Assess; LiquidF# Hold — the proof-tool rings)
- the [`formal-verification-expert`](../agents/formal-verification-expert.md) (Soraya) standing portfolio + [`alignment-auditor`](../agents/alignment-auditor.md) measurability work

## Why this rule auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): the discipline fires at the
exact moments an agent is tempted to promote on consensus, call cross-AI convergence
"validation," mint a canonical claim without a proof-lineage edge, or let an unproven
dep into the core. Auto-load puts the four guardrails (consensus≠validation /
canonical=homeostat-proven-from-seed / proven-by-default / Ace-shields-the-core) in
working memory **before** the promotion decision. It also closes the enforcement gap
Codex flagged on #6610 (a canonical-gate tightening that lived only in an unindexed
reference note would not bind future agents) — by landing the gate on an
authoritative auto-loaded surface alongside `labeling-confidence`.

## Substrate-honest framing

This rule is whys-first and revisable; if a why is wrong, challenge the *why* and it
gets refined. It does NOT claim we ARE proven-by-default — we are far from it
(081KT2T2J0008QG0R000YZ3NMY); it names the **direction** and the **gate**. It does NOT override operator
authority or the HARD LIMITS floor. It DOES make "proof-first / proven-by-default /
consensus≠validation / canonical=homeostat-proven-from-seed / Ace-shields-the-core"
the standing discipline at every promotion, ship, and dependency-boundary moment.

## Full reasoning

Aaron 2026-06-02, across the 081KT2T2J0008QG0R0008TFHJT/081KT2T2J0008QG0R000YZ3NMY formal-coverage arc:
`memory/feedback_formal_proof_first_consensus_is_not_validation_canonical_is_homeostat_proven_from_seed_soraya_on_cron_for_math_backlog_aaron_2026_06_02.md` plus
`memory/project_zeta_is_proven_by_default_unproven_is_explicit_opt_out_ace_surface_is_zeta_ace_shields_zeta_2026_06_02.md`.
Minted on Aaron's "make it a rule" 2026-06-02.
