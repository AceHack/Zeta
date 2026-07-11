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
