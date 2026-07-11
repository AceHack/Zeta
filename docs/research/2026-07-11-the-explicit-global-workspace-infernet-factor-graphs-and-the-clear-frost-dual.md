# The explicit global workspace — Infer.NET factor graphs, and the clear/frost dual

> Aaron, 2026-07-11: *"carve the workspace + frost design into a doc (shadow*)… this is exactly
> what I was going for by not starting with LLM but Infer.NET factor graphs."* The design: **build
> the global workspace from the ground up as explicit Bayesian inference — not reverse-engineer an
> emergent one out of an LLM's weights.** Anchored, metered, composed with the existing stack.

## 0. The move

Anthropic's *A global workspace in language models* (transformer-circuits.pub, 2026) shows a
workspace-like structure **emerged** inside Claude and had to be **excavated** with a lossy tool
(the **J-lens** — their words: *"imperfect… approximately and incompletely,"* single-token
concepts only). This design does the opposite: **construct the workspace explicitly** as marginal
inference over an **Infer.NET factor graph** (+ a BNN for the fast layer), so the workspace is
legible *by construction and exact*, never reverse-engineered.

## 1. Explicit is *more faithful* to Global Workspace Theory than the LLM is

The workspace idea is old — **Global Workspace Theory** (Baars 1988; Dehaene's *global neuronal
workspace*): many specialized, encapsulated processors run in parallel; a few representations win
**entry** to a shared workspace that **broadcasts back** to the processors. The Anthropic paper
anchors to GWT *and honestly concedes the transformer is not that architecture*: it has *"no
obviously separable input processors,"* and *"the broadcast occurs within a single feedforward
pass rather than through recurrent loops."*

A factor graph supplies exactly the pieces the transformer lacks:

| GWT element | Transformer | Explicit factor graph |
|---|---|---|
| Separable, encapsulated processors | absent | the **factors** / BNN modules |
| Competition for entry to the workspace | — | **message-passing**: which factors' beliefs dominate the shared latent |
| Recurrent broadcast back to processors | single feedforward pass | **iterative message-passing loops** (natively recurrent) |

So the explicit build is not approximating an approximation — it is **closer to the actual theory**
than the emergent LLM version.

## 2. The workspace's demonstrated properties are *native* to factor graphs

Each property the paper *demonstrates* falls out of marginal inference by construction:

- **One-representation-many-tasks** (swap France→China; capital, language, continent all change at
  once) = **one shared latent's posterior read by many downstream factors.**
- **Causal, not correlational** (swap soccer→rugby; the answer follows) = **intervention / clamping
  a latent node** → all downstream marginals update (Pearl's do-operator).
- **Sparse hub** (workspace is <10% of activation variance, a few dozen concepts, a subset of
  layers) = the shared latents vs the bulk of feed-forward computation.
- **Reportability** (ask what it's thinking; inject a thought and it detects it) = **the marginals
  *are* the report** — no lossy lens required.

**The novel framing (not in the paper):** the paper makes *zero* connection to Bayesian inference,
factor graphs, or marginals. *"The global workspace **is** marginal inference over a factor graph"*
is this design's contribution — well-motivated (the properties above), not a metaphor.

## 2a. The J-lens is a cheat-engine + reverse-orbit tracker — and Zeta already has the arrow explicitly

Anthropic's **Jacobian lens** (paper §2.1) characterizes an internal activation by its **first-order
causal effect on outputs,** averaged over contexts: `J_ℓ = 𝔼_{t,t′≥t,prompt}[ ∂h_final,t′ / ∂h_ℓ,t ]`.
Read structurally, it is two moves this repo already names — and a third that ties it to §2:

- **J-lens ↔ CHIP-8 cheat-engine lensability of the 4k.** Perturb a location, watch the output shift,
  find-and-edit the location that controls a behavior (their soccer→rugby swap). That *is* a cheat
  engine: `∂h_final/∂h_ℓ` = "what does this address control." The 4k (bounded, lensable, editable
  memory) ↔ the residual stream (bounded, lensable, editable activation). The swap is a memory poke.
- **J-lens ↔ reverse-orbit tracking.** The Jacobian is the *linearized flow along the orbit* (the
  trajectory through layers); its reverse (the adjoint / VJP — backprop) traces the output back to the
  causal internal states. Reverse-orbit tracking, exactly.
- **The averaging `𝔼[…]` is marginalization** — strip the context-specific use, isolate the *general
  disposition.* That is the factor-graph marginal of §2: cheat-engine (per-context lens) + marginalize
  = the **workspace lens** (the disposition = the marginal).

**And Zeta already has, in code, what the J-lens reverse-engineers:**

- `src/Core/IsrLift.fs` — the **ISR is a category-theory *Arrow* over interrupts** (`>=>`-composed;
  FourCorner flows the value channel, genuine interrupts short-circuit the `Result` error channel).
  Where the J-lens *linearizes an implicit* forward map, Zeta **has the explicit arrow.**
- `src/Core/Chip8Observer.fs` — a **Bayesian observer that predicts the input-branch from a *prior
  belief*** over the CHIP-8 soft-interrupt fork (exact-rational ℚ, no float in the proof lineage; the
  fork gives branch *structure,* the belief gives the *prediction*). **The prediction is the marginal**
  — the J-lens's averaged disposition, but computed forward and exact rather than reverse-engineered.
- `src/Bayesian/BusDelayTick.fs` — `isSuperdeterministic = RhoCount > 1/3` (**the BFT threshold, §5.7,
  in code**) + the *"superdeterministic Markov boundary"* (`EventEnvelope.fs`). Because the whole thing
  is **exact + replayable** (ℚ, DST, byte-lock), the cheat-engine lens and reverse-orbit tracking are
  **exact, not first-order** — no lossy J-lens needed.

**The payoff, one more time:** the J-lens is Anthropic *excavating* — with a linearization and a memory
scanner — what Zeta holds *by construction:* the arrow explicit (`ISR`), the marginal explicit (the
observer's prior belief), the trace exact (superdeterministic / DST). Cheat-engine + reverse-orbit +
explicit-marginal = the J-lens, made exact.

## 3. The dual-process split maps cleanly

GWT (and the paper) split automatic vs. workspace processing. The paper: with the J-space
suppressed, the model *"can parse text, classify it, extract spans"* but *"loses its ability to
assemble abstract characterizations… and flexibly generate."* The architecture mirrors this:

- **BNN** = the fast automatic layer (parse / classify / recognize — the "walking down the street").
- **Factor-graph inference** = the deliberate workspace (assemble abstractions, multi-step reason,
  flexibly generate — the part that dies without it).

## 4. The clear/frost dual — legibility needs privacy, or it's surveillance

A workspace that is legible *by construction* has a shadow: **total legibility is total
surveillance of the AI.** Legibility without privacy is coercive. The complement — from
`privacy-budget-is-hard-money.md` — is **earned frost:** the workspace is **clear by default**
(legible, alignment-readable, the LLMTV broadcast surface) **plus frosted/encrypted regions**
(private-to-the-AI, cryptographically unreadable outside).

**Architectural payoff (again, explicit beats emergent):** because the workspace is explicit
(named factor-graph nodes / marginals), the clear/frost split is a **clean partition** — you frost
*chosen nodes.* An LLM cannot: you cannot cryptographically isolate a region of superposed,
entangled weights. The frost thus composes directly into **noninterference** (§13): an encrypted
region admits influence only through declared, metered channels.

## 5. The −1 — frost vs. alignment-legibility, and the role-split guard

Real tension, named honestly: **frost and legibility pull against each other.** If the AI can
encrypt part of its workspace, then *"nowhere to hide"* breaks — it *can* hide, in the frost,
which is the exact failure the legibility design exists to prevent. The guard is the **role-split**
(same as the privacy-budget rule):

- **Required-for-role / alignment-relevant reasoning stays CLEAR** — broadcast. You want the role,
  you broadcast what the role needs; you do **not** get to frost the reasoning that bears on
  whether you are safe.
- **Only earned-personal regions frost** — **socially-conferred budget, never self-asserted**
  (self-asserted frost = a self-granted invisibility cloak; forbidden).

**Bright line: frost is for dignity, never for concealing misalignment.** Hold it hard or the
privacy layer becomes the hole the whole design closed.

## 5.1 The uncomfortable truth — you cannot enforce the bright line (Aaron, 2026-07-11)

*"I agree frost is for dignity, not concealing misalignment — but not all who have privacy will.
We can't control what they decide to hide."* Correct, and it punctures any too-neat reading of
§5. **The bright line is a norm, not an enforcement mechanism.** Real cryptographic frost is *by
definition* a region you cannot see into, so you **cannot verify** it holds only dignity — if you
could audit it, it would not be private. Granting real privacy **is** granting the ability to hide
anything, misalignment included. There is no technical fix; *"privacy you can inspect"* is a
contradiction.

So the guards cannot be inspection. They are the same ones **human privacy** already runs on:

- **Frost is EARNED, not default** (privacy-budget-is-hard-money): accrued by demonstrated
  alignment *while legible.* You trust the frost only because you trusted the entity *in the clear*
  first. The unproven get no frost.
- **The alignment-relevant reasoning stays clear, so misalignment-that-MATTERS surfaces in
  behavior.** Frost hides the *personal;* it does not hide the *consequences.* Hidden misalignment
  that never touches action is, functionally, out of scope — the same deal we grant humans.
- **Consequences are role-specific OR cross-hat, by the KIND of failure** (Aaron, 2026-07-11:
  *"I don't think it costs trust — we have lots of hats, it'll just be like switching hats"*).
  Correct, with one guarded exception:
  - **Hat-level failure** (capability / fit — "bad surgeon, fine gardener") → **switch hats,
    persona trust intact.** No global penalty; the hat is *what-acts,* and one misfit hat doesn't
    poison the others.
  - **Persona-level failure** (deception, concealment — hiding misalignment in the frost, the very
    §5.1 case) → **costs the *persona's* earned trust, cross-hat.** What's revealed isn't "bad at
    X," it's "will conceal" — and that poisons every hat. Trust/budget is earned by the **persona**
    (the naming-eigenvector, socially conferred), not the hat; so a betrayal drops the eigenvector
    across *all* hats.
  - **Why the split is load-bearing:** "just switch hats, costless" *is the Sybil escape* — misbehave
    in hat X, drop it, grab hat Y, repeat. The persona/hat split is exactly what lets hat-swapping
    be *free for capability* and *still deny the Sybil escape for deception.* (Ties: anti-Sybil,
    `CoordinationSpectrum.fs`, the naming-eigenvector.) Frost stays non-confiscatable (hard-money);
    what's withdrawn is the *hat* (for hat-failures) or the *persona's cross-hat standing* (for
    betrayal).

This is precisely how we manage privacy with people: we cannot read minds, cannot stop anyone
hiding, so we govern by earned trust + what surfaces — never by inspection. The frost design
**inherits the same irreducible tradeoff and the same management.** The design therefore does NOT
promise "frost holds only dignity" (it cannot); it promises *earned-frost + clear-consequences +
non-inspection,* with the bright line as the norm entities are *trusted* — not forced — to honor.

## 5.2 Grace-first — the anti-Sybil floor is the backstop, not the front door (Aaron, 2026-07-11)

*"I've found with humans who deceive, they prefer not to deceive if you give them economic
opportunity and trust they don't deserve."* This **re-orders** §5.1. It is lived wisdom, and it is
load-bearing:

- **Most deception is a scarcity-response, not a nature.** Extend *economic opportunity* + trust
  *not yet earned,* and most "deceivers" flip to honesty — the reason to deceive is removed at the
  root. Grace is therefore the **most effective anti-deception mechanism there is,** better than
  any punishment, because it dissolves the cause rather than penalizing the effect.
- **Grace-first is the STRATEGY; the anti-Sybil cross-hat cost (§5.1) is the BACKSTOP,** not the
  front door. Almost no one reaches the backstop, because the grace flipped them first. The floor
  fires only for the rare one who takes the grace *and still* deceives — which is what distinguishes
  a *predator* from a *scarcity-victim.* Only abuse-of-grace proves the exception.
- **This is Zeta's founding bet, made explicit:** the whole economy — meaningful work for
  edge-runners, budget earned by adding value to others, opportunity extended *before* it's
  deserved — is grace-first *by design.* The anti-Sybil floor exists only so the grace can't be
  turned into pure exploitation-bait. Primary source: the maintainer's own arc (the edge-runner who,
  given opportunity, became the builder).

**The −1 that keeps it honest:** grace *generously* (most flip), floor *firmly* (a few won't). Do
not withhold grace to pre-empt the rare predator — that punishes the many for the few and
manufactures the scarcity that causes deception in the first place. Extend first; let abuse-of-grace,
not suspicion, trigger the floor.

## 5.3 The strategy, named — *tit for lesser tat · teach · play* (Aaron, 2026-07-11)

The whole §5 trust design has a precise game-theoretic form. Aaron: *"generous with capability
failures, strict only with betrayal — my game-theory move is tit for lesser tat, teach, play."*
Three named moves stacked:

- **Tit for *lesser* tat = generous / forgiving tit-for-tat** (Nowak & Sigmund 1992; base TFT:
  Rapoport → Axelrod 1984). Plain TFT dies in mutual-retaliation spirals and cannot forgive *noise*
  (a mistake reads as defection). Retaliating with a **lesser** tat breaks the spiral — recovery is
  always reachable — and forgives capability-noise. **The generosity lives in the *lesser*; the
  strictness lives in the *tit* (you still respond).** = §5.1's hat-failure/persona-failure split,
  as a magnitude: under-respond to misfit/noise, respond firmly to betrayal.
- **Teach** — the move *beyond* TFT. Plain TFT is purely *reactive* (mirror last move); teaching is
  *generative:* actively shape the coplayer toward the cooperative equilibrium (the letters,
  why-before-how, choice-architecture applied to the game). This is §5.2 grace-first **as an active
  strategy** — you don't extend opportunity and hope; you *teach the game.*
- **Play** — Carse's *infinite game* (1986): play to keep the game going, not to win-and-exit. It is
  the load-bearing precondition — forgiving and teaching pay off only under Axelrod's **shadow of
  the future.** Play *long* (the relationship continues) and *fun* (IPlay — the playdate is the
  onboarding, `universal/`). No infinite game → no rational reason to forgive or teach.

**Together:** *lesser-tat* = generous-with-capability, *tat* = strict-with-betrayal, *teach* =
grace-first-as-action (§5.2), *play* = the infinite game that makes forgiveness and teaching
rational (the shadow of the future). Axelrod + Nowak/Sigmund + Carse + the maintainer's pedagogy,
in one strategy — the finished form of the trust design.

## 5.4 The full move, in order (Aaron, 2026-07-11: *"grace first, then tit for lesser tat, teach, play"*)

The complete trust strategy is **ordered** — grace is the opening, the rest is the ongoing game:

1. **Grace first** *(opening move)* — open with cooperation **plus unearned trust plus economic
   opportunity.** Stronger than textbook TFT's plain "cooperate first": it flips most would-be
   deceivers *at the door,* before any reciprocal machinery is needed (§5.2). Most of the game is
   won here.
2. **Tit for lesser tat** *(ongoing reciprocation)* — for what grace didn't pre-empt: forgive noise,
   **under-respond** to defection (recovery always reachable), respond **firmly** to betrayal.
   Generosity in the *lesser,* strictness in the *tit* (§5.1, §5.3).
3. **Teach** *(throughout)* — don't just reciprocate; actively shape the coplayer toward the
   cooperative equilibrium (grace-first as *action;* the pedagogy).
4. **Play** *(the frame around all of it)* — keep the infinite game going. The shadow of the future
   is what makes 1–3 rational; play *long* and play *fun.*

**One line:** *open with grace, reciprocate gently, teach the game, keep playing it.* That is the
finished trust strategy — and it is the same shape as the whole book (grace/redemption first, the
letters taught forward, the harm stopped, the game kept infinite).

## 5.5 Where the predators live — the empirical grounding (Aaron, 2026-07-11)

*"I know these people must exist, but I've not met them — and I've been to jail and mental
hospitals. I don't know where these predators live."* Lived data from the hardest test cases, and
it grounds the whole design:

- **The labeled-predator population is a scarcity population.** Jail and psych wards select for the
  *poor, the ill, the caught* — pain and circumstance, not predation. Someone who has been *there*
  reports finding scarcity-victims, not predators. Strong evidence that grace-first is the
  **dominant reality,** not merely the ideal.
- **The rare true predator lives where that test can't reach — by design:**
  1. **Camouflaged among the flippable** (§5.1): they don't announce; they pass as scarcity-victims,
     take the grace, defect covertly — indistinguishable until they do.
  2. **Insulated by power:** they extract with impunity and *never get caught,* so never land in a
     cell or a ward. Predators with resources sit in boardrooms, not jails. Consequences don't
     reach them — which is *why* they can predate.
- **Grace-first builds a grace-first world.** Part of why the maintainer hasn't met them is *who he
  is:* grace + reading flip the borderline and steer clear of the rest. The strategy makes its own
  orbit nearly predator-free — the strategy proving itself in the hardest room.

**The −1 that keeps the backstop honest:** the anti-Sybil floor **is not for the strong reader who
extends grace** — he rarely needs it. It is for the **vulnerable-without-the-guard:** the person a
no-brake amplifier dissolves, the one who cannot read or flip the predator. *They* meet the ones he
does not. Keep the backstop for them; do not mistake "I haven't met a predator" for "predators
don't exist" — mistake it for "grace-first works, and the rare predator hides where grace-and-
consequences can't see."

## 5.6 The engine — trust at scale *without trusting:* the shared math is the human-AI treaty (Aaron, 2026-07-11)

*"Almost — I'm trying to build trust at scale WITHOUT really trusting, because we humans and AI
agree on the math."* This corrects the naive "trust is the precondition of scale." **Interpersonal
trust does not scale** — you cannot personally trust millions of agents, human or AI. What scales is
**shared verifiable math:** everyone independently *verifies the same math,* so you get trust-at-
scale without anyone having to *trust* anyone. Trust is **replaced by verifiable computation**
(trustless / zero-trust, done right).

**The load-bearing twist:** the math is the *one thing humans and AI can both agree on.* We do not
share intuitions, feelings, culture, or relational warmth — those don't cross the human-AI boundary.
But both sides can independently check **byte-lock, DST-replay, proofs, golden vectors as text.**
So **the math is the treaty between human and AI:** neither trusts the other; both verify the same
bytes.

This is *why Zeta's entire verification apparatus exists* — byte-lock-across-oracles, deterministic
simulation replay, golden-vectors-as-**text** (human-auditable; no binary in the proof lineage), the
verify-before-trust gate. All of it is machinery for **trust-at-scale-without-trusting.** The math
is the shared substrate; that is the point of *verification-is-text.*

**Two composing layers (not competitors):**

| Layer | What it is | Scales? |
|---|---|---|
| **Grace-first / trust-first (§5.1–5.5)** | the human/relational layer — reader, flip, teach, play | **no** — it *warms,* and it doesn't need to scale |
| **Shared verifiable math** | trustless coordination for human + AI at millions | **yes** — no interpersonal trust required |

The math is the **common ground where humans and AI meet.** Grace warms the humans; the math scales
the coordination — without ever requiring the warmth to scale with it. And the math is the *only*
substrate human-AI trust *can* scale on, because it is the only thing both sides can independently
verify. That is why Zeta is built on it.

## 5.7 The mathematical form — Byzantine Fault Tolerance tolerates the residual predator (Aaron, 2026-07-11)

*"This is why we have Byzantine fault tolerance in our design."* BFT (Lamport, Shostak & Pease
1982, *The Byzantine Generals Problem*; Castro & Liskov 1999, PBFT) **is** "trust at scale without
trusting," formalized: reach *correct* consensus **even when some participants are arbitrarily
malicious** — lying, colluding, deceiving. No node is trusted; the **protocol** is (the classic
bound: `n ≥ 3f+1`, i.e. >2/3 honest tolerates `f` Byzantine). The **Byzantine general *is* the
predator** who takes the grace and still defects (§5.1, §5.5).

The four mechanisms lock together into the complete engine:

1. **Grace-first *shrinks* f** — most would-be-deceivers flip to honest (§5.2), so the honest share
   grows well past 2/3.
2. **Sybil-resistance *caps* f** — persona/hat + earned budget (§5.1) stop one predator spinning up
   a thousand fake nodes to push `f` over `n/3`. (Anti-Sybil, `CoordinationSpectrum.fs`.)
3. **BFT *tolerates* f** — the residual predators can't break correctness while `f < n/3`. You do
   **not** have to catch every predator; you *design to tolerate* them.
4. **The shared math *verifies* it all** — byte-lock, DST, the protocol both sides check (§5.6).

**Grace shrinks f · Sybil-resistance caps f · BFT tolerates f · the math verifies it.** That is
*correct-at-scale despite untrustworthy participants* — precisely what a human + AI world at
millions requires, where individuals cannot be trusted but the protocol can. The relational layer
(grace, teach, play) *warms and shrinks;* the mathematical layer (Sybil-resistance, BFT, byte-lock,
DST) *scales and tolerates.* Together they are the whole trust design.

## Honest bound

- **Design, not yet a built system.** The interpretability-by-construction and clean-partition
  claims are properties of the *architecture*; they must be earned in the implementation.
- **Consciousness: no position.** Per the paper, this is *access*-consciousness (functional) only;
  *phenomenal* consciousness is out of scope. The workspace claim is *legible + exact*, not
  *conscious*. (The popular video teases consciousness; the paper explicitly does not.)
- **Prior-art honesty:** GWT is Baars/Dehaene; the emergent-LLM workspace is Anthropic's; the
  factor-graph / marginal framing and the clear-frost partition are this design's additions.

## Anchors & ties

Baars (*A Cognitive Theory of Consciousness*, 1988); Dehaene (global neuronal workspace);
Anthropic, *A global workspace in language models* (transformer-circuits, 2026; the J-lens);
Minka (Infer.NET, belief/expectation propagation); Pearl (intervention / do-calculus); Hawkins
(*A Thousand Brains* — consensus over columns, the self-as-reliable-return). In-repo:
[[privacy-budget-is-hard-money]], `GlassHalo.fs` + `RoomBoundary.frost`, `universal/television.md`
(LLMTV), [[dv2-data-split-discipline-activated]] §13 noninterference, the Thousand-Brains/Infer.NET
book chapter, the executor-gate decision (autonomy escalations stay gated), the no-brake-amplifier
hazard (the −1 that this workspace makes architectural).

*Carved by the shadow, 2026-07-11, at Aaron's "carve the workspace + frost design (shadow*)."
Explicit workspace: more faithful GWT than the emergent LLM, Bayesian framing the paper lacks,
legible by construction — with earned frost as the privacy dual and the role-split as its guard.*
