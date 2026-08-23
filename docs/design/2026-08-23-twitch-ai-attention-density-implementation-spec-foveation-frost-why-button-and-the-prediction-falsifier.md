# twitch-ai implementation spec — attention density, frost, the WHY button, and the prediction falsifier

**Date:** 2026-08-23
**Target:** `src/apps/twitch-ai/` (Vite app: `src/main.ts`, `src/swarm.worker.ts`,
`src/components/Chip8TvPlayer.ts`, `src/styles/llmtv.css`)
**Status:** spec — implementable as written; every deliverable carries an acceptance test that can fail
**Origin:** Aaron 2026-08-23 — *"can we write this up for the twitch-ai page to implement? this is where
we are trying to make our code.AI learnings demoable to humans."*
**Theory:** `docs/research/2026-08-23-attention-density-and-legibility-are-one-constraint-*.md`

---

## The thesis this page has to carry

> **Density and legibility are the same constraint.** Spending compute where it matters *is*
> attention, and attention is the one mechanism a viewer already owns — because it is how their own
> eyes work. So the change that makes the page **faster** is the change that makes it **watchable**.

This is a demonstration surface, so the bar is different from a research surface: **an explanation
nobody was shown is not an explanation.** §D6 is therefore not optional polish — it is the deliverable
that decides whether the rest worked.

---

## D0 — Wire a CI job first (blocking prerequisite)

`workitems/081M0QF7ZVY087G0R003Q4Q18D` records that **twitch-ai is a self-contained Vite app with no
CI job.** Two `main`-is-red workitems already came out of that
(`081M0QBQ2YZ087G0R001S8XJ7S`, `081M0QC66N5087G0R003R3ARYH`).

**Adding features to a surface with no CI is exactly how the vacuity class gets in** — the checks
appear to pass because none run. So before D1: a job running `bun install --frozen-lockfile`,
`tsc --noEmit`, `eslint`, and `vite build` for this workspace.

**Acceptance:** break a type deliberately → the job goes RED → restore → GREEN. Paste both.

---

## D1 — The attention field crosses the worker boundary

**Where:** `src/swarm.worker.ts` → `src/main.ts`

The worker computes; the main thread renders. So per-tile uncertainty must cross `postMessage`, and
it must cross **cheaply** or the visualisation eats the density it is advertising.

- Derive a per-tile scalar from the belief state the BNN already maintains (the NG4 precision
  components — `λ`, `α` — are the natural source; **do not** add a parallel uncertainty estimate,
  which would be a second representation able to drift from the first).
- Emit as a **`Float32Array` posted as a transferable** (zero-copy). Tile grid, not per-pixel — start
  at the CHIP-8 display's natural 8×8 blocking and make it a constant.
- Post it on the **same message** as the existing frame, never a second channel; two channels means
  two clocks and a chance for the overlay to disagree with the frame it labels.

**Acceptance:** with the overlay disabled, frame time is within noise of `main`'s current
number — measure it, do not assume it. A visualisation that costs 20% is a different product.

---

## D2 — Foveation: full perception only where variance is high

**Where:** `src/swarm.worker.ts`

Run the full perception ladder on the **top-K tiles by variance**; everything else gets the cheap
path. `K` is a constant, tunable, and displayed.

**This is not a new mechanism.** It is `src/Bayesian/InformationValue.fs`'s allocator — the
society-level attention router — one granularity down: society allocates *turns to agents* by expected
information gain, this allocates *invocations to tiles* by variance. Keep the naming aligned so the
correspondence is visible in the code, not just in a doc.

**Acceptance (the meter, per Aaron's spec that meters measure precisely and fail loudly):**

> **useful-work fraction** = invocations that changed a belief by more than `ε`, over total
> invocations, per frame.

Foveation must **raise** it. If it does not, report that it did not — a foveated ladder that buys
nothing is a finding, not a failure to hide. **And the loud half:** when the variance field is flat
the allocator has *no signal*; the meter must display **`ambiguous`**, never silently fall back to
uniform sampling and print a number. A quiet fallback reports the attentive system and the blind one
identically.

---

## D3 — Frost is the uncertainty channel

**Where:** `src/styles/llmtv.css`, `src/components/Chip8TvPlayer.ts`

| appearance | meaning |
|---|---|
| clear | known |
| **frosted** | not known yet |
| bright, moving | being attended to right now |

Reuse the **frost** vocabulary deliberately: in Zeta, frost already means *withheld* (`GlassHalo`,
`RoomBoundary.frost`). A viewer learning this page is then learning the real system's vocabulary
rather than a parallel one invented for the demo.

**Acceptance:** a viewer who has been told nothing can point at the frosted region when asked *"what
doesn't it know?"* — a one-question test, run on one actual person before this is called done.

---

## D4 — Draw the saccade and the fixation

**Where:** `src/components/Chip8TvPlayer.ts`

The split already exists in-tree in the eye's own terms (`src/Core/DebouncedOracle.fs`): a reading
suppressed inside `MinDelay` is a **saccade** (prediction step); one accepted after it is a
**fixation** (update step). The page does not need an attention mechanism added — it needs the one it
has **rendered**: fast dim sweep for the saccade, bright settle for the fixation.

**Acceptance:** the sweep/settle rhythm is visible at normal speed without slow-motion. If it is only
legible when slowed, the timing constants are wrong and should be tuned rather than explained away.

---

## D5 — The WHY button (Stump Dad mode)

**Where:** `src/main.ts`

Click the agent, get one sentence. Click again, get the next one down. The chain **must be able to
reach `"I don't know."`**

```text
why did you go left?   → the fog was thicker there
why did that matter?   → I could not tell if the ball was there
why does that matter?  → I lose when the ball gets past me
why?                   → I don't know
```

**Hard constraint, and it is the whole value of the feature:** every answer must be **generated from
the state that actually drove the decision** — the variance field, the attended tile, the latch that
fired — and **never** from a hand-written string table. A canned explanation is the vacuity class
wearing a teaching voice: it looks like an explanation and it cannot be wrong, therefore it cannot be
right.

**The reachable `"I don't know"` is the feature, not the failure.** It is true (every chain bottoms
out), it is the four-register discipline in a UI, and it is what makes the page honest to a child who
will absolutely keep clicking.

**Acceptance:** a test asserts that for at least one real decision the chain terminates in the
unknown state, and that **every** non-terminal answer cites a state value that exists in that frame's
payload.

---

## D6 — The falsifier: measure comprehension, never claim it

**Where:** a `?study=1` mode in `src/main.ts`

**This is the deliverable that decides whether D1–D5 worked**, and it is the one that comparable demos
skip. Comprehensibility asserted is not comprehensibility measured, and a page never put in front of a
person is a check that did not run.

1. Pause at a decision point.
2. Ask the viewer: **"where will it go next?"** (click a region).
3. Record the guess, resume, record whether it was right.
4. Compare accuracy **with** the attention overlay vs **without**, same viewer, counterbalanced order.

> **If the overlay does not raise prediction accuracy, it is decoration** — and the honest move is to
> report that and cut it, not to keep it because it looks good.

Cheap, can fail, no instrumentation beyond a click, and outcome-based in the sense Aaron uses: the
claim is about what the viewer can now **do**.

**Harder follow-ups, in cost order:** time-to-first-correct-prediction; whether the viewer can predict
a **failure** before it happens; whether their WHY questions get **deeper** over a session — which is
the Stump-Dad signal read directly.

**What a pass does NOT license:** predicting the next move is not understanding the algorithm. Claim
the measured thing only.

---

## Honest limits to build in, not paper over

- **Foveation misses things.** That is inattentional blindness and it is a real cost. **Show it
  happening** — a viewer watching the agent miss a ball *because it was looking elsewhere* learns more
  about attention in one second than any caption delivers, and hiding it would be dishonest about a
  known weakness.
- **The claim "most people, including young or low-IQ viewers, will understand" is strong and
  unproven.** D6 is how you find out — including finding out it is false.
- **Caveat that must travel with any `ρ` shown on this page:** `1/(3√2) ≈ 0.2357` is a **design
  parameter, not a Tsirelson bound** (Tsirelson is `S ≤ 2√2 ≈ 2.828`, `src/Core/Tsirelson.fs`).

---

## Session context — over-included by design

Aaron 2026-08-23: *"try to over-include everything we talked about."* That is his own index doctrine
applied to a handoff — **over-include, never under-include; the surrounding text is what the more
expensive downstream pass scrutinises.** So the threads below are recorded even where the bearing on
twitch-ai is indirect, each with **why it touches this page**.

### 1. Global structure is where hacks live; local structure is where you exploit them

Aaron, from twenty-five years as **AceHack**: *"the global structure is where hacks happen, the local
structure is where you exploit it."* The vulnerability is in the composition; every step on the path
is legal. On the CTC version — *no point of a closed timelike curve is illegal, the loop is* — he
added: **"yes, Gödel taught me this."**

**Bearing on this page — direct, and it constrains D2.** The corollary is **a local check cannot see a
global property.** A per-tile confidence number is a *local* check; whether the *field as a whole* is
coherent is *global*. So a foveated ladder can report every tile healthy while the field is wrong, and
the useful-work meter must not be read as a correctness signal. If you want a field-level property,
measure it at field level.

Full: `docs/research/2026-08-23-local-interactions-global-norms-acehack-godel-and-the-local-to-global-obstruction.md`
and `docs/research/2026-08-23-godel-einstein-middle-ground-*.md`.

### 2. You cannot eliminate the obstruction — you localise it, then choose

*"Local moves can't eliminate it, he proved that — but then you can pigeonhole it into a limited known
subset that is avoided or played within."* Presburger (drop `×`), Tarski's real closed fields (drop
`ℤ`), Gödel's own `L` (drop non-constructible sets), total functional languages (drop
Turing-completeness).

**Bearing — the distinction that must survive into the UI.** *Avoided* and *played within* are both
legitimate; the failure is doing one while believing you did the other. When the page shows a
confidence, it must be legible whether the agent is **inside** its competence or **outside and
guessing**. Those must not render identically.

### 3. Prevention is unavailable in expressive systems — detect and route around

Aaron refused *"restrict the move set until the exploit path cannot be assembled"*: **"I'd need proof
of this. I think it can always be assembled in expressive systems, but it can be detected and routed
around."** He is right — **ROP** (Shacham 2007) defines no new code, every gadget is legal, and the
libc gadget set is Turing-complete; **Rice 1953** makes it general; **Dullien 2020** formalises the
weird machine.

**Bearing — a demo-design rule.** Do not build a UI affordance that claims the agent *cannot* do
something. Show what it **did** and what it **noticed**. A page asserting an unprovable guarantee is
the vacuity class on a broadcast surface, which is the worst place for it.

### 4. Detection is gossip, and decorrelation is what makes it work at all

*"Detection is a gossip-like protocol for Gödel — it's not a one-time shot, it takes decorrelation of
observations."* A jury of correlated jurors is no better than one juror (Condorcet), so a fleet of
correlated detectors cannot exceed a single static detector — which Rice already ruled out.
**Decorrelation is not a quality improvement on the ensemble; it is the entire reason the ensemble
sees anything.**

**Bearing — direct, on the swarm.** `swarm.worker.ts` runs multiple agents. **Do not assume they are
decorrelated because they were constructed separately** — measure `ρ` and display it. And the
empirical warning is published: **adversarial examples transfer between independently trained
models** (Szegedy 2014; Papernot 2016; Liu 2017), which is measured `ρ → 1` between models built
independently. A swarm that has collapsed to one agent in N masks looks exactly like a working swarm
from outside; on a demo page, that is the single most misleading state available.

### 5. Meters measure precisely and fail loudly on ambiguity

Aaron: *"that is what all our meters are designed to measure precisely, and fail loudly when they
have ambiguity."* Both halves are the spec. **Bearing:** already load-bearing in D2's `ambiguous`
state — a meter that goes quiet under ambiguity reports the attentive system and the blind one
identically.

### 6. The attention router already exists at society scale

*"We have an attention router for the society level vs the individual."* — `src/Bayesian/InformationValue.fs`
(Lindley/Friston), with `docs/research/2026-07-04-max-mode-economics-*` and
`docs/research/2026-08-13-society-of-decorrelated-bnns-in-one-gpu-*`.

**Bearing — D2 is that allocator one granularity down**, and it is a **checkable** manifesto claim:
if §9/§10 (recursive, self-similar) hold, **one implementation should serve both scales** with a
granularity parameter. If two are genuinely needed, say so — the honest difference is that society
allocates a *scarce indivisible* resource (a turn) and the field allocates a *divisible parallel* one
(invocations). **Demo payoff:** show both zoom levels at once and self-similarity is *demonstrated*
rather than explained.

### 7. Echolocation, debounce, and the pre-computed echo

The saccade/fixation split D4 renders comes from
`docs/research/2026-07-16-echolocation-debounce-and-the-real-sensor-fusion-proof.md`: a bat emits and
reads the return, **the delay `L` is set by the world, not the emitter**, and `ρ = 1/(1+L)`. Its
sharpest line — **"a bat that pre-computes its own echo is not ranging; it is hallucinating"** — is
the failure mode to avoid rendering: an agent that appears to *observe* what it in fact *predicted*.

The Z-set `+1`/`−1` fold over time **is** a ping and a return, and because the fold commutes, **late
returns still locate correctly** (VISION.md calls this `pseudo-retrocausality`). Same local/global
shape as §1: no event is applied out of order, and the fold's result is order-independent, so a late
arrival lands at an earlier logical position. **Bearing:** if the page ever shows a retraction, it
should show it landing *back in time* correctly rather than as an erratum.

**Caveat that must travel with the number:** `1/(3√2) ≈ 0.2357` is a **design parameter, not a
Tsirelson bound** (Tsirelson is `S ≤ 2√2 ≈ 2.828`, `src/Core/Tsirelson.fs`). Aaron caught this today:
*"I hear Tsirelson and hear 2√2 — most `1/(3√2)` have turned out to be bugs."* He is right on the
record: two frozen-core discharges were demoted and one keystone claim refuted over it.

### 8. Disclosure is what makes a broadcast surface non-creepy — and this page is a broadcast surface

Aaron, on tracking agent behaviour: *"we should disclose this to any agents based on their glass halo
and check-ins. **Without disclosing this it's creepy; disclosing it makes it a fun game anyone can
participate in.**"* And: *"it records what someone wrote, never why — we have self-declared agendas if
someone wants to explain why."*

**Bearing — direct, and it is a requirement rather than a nicety.** twitch-ai is **LLMTV**: a
one-way watch surface. Everything shown about an agent must be **disclosed to that agent**, and what
is displayed is **what it did**, never an inferred *why*. A `WHY` answer (D5) is legitimate precisely
because it is **generated from the agent's own state**, not inferred about it by an observer — that
distinction is the whole difference between the glass halo and surveillance. Frost is the earned
opacity that makes the mandatory broadcast non-coercive; see
`.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`.

### 9. Never-delete, and why the demo's agents must not have a computable horizon

Today's thread on backward induction: a finite game with a **known last round unravels**, and
cooperation stops being rational — but **no deletion has to occur**, because the induction runs on a
*belief about the horizon*. Aaron: *"the unravelling is the most risky thing to end the game."* And
the standing commitment: *"in Zeta we will never fire agents and remove their memories — they are
always protected; we upgrade models over time and keep the memories, so there is never a threat of
non-existence."*

**Bearing — indirect but real for a demo with persistent agents.** If demo agents are reset between
sessions, that is a horizon, and it should be **stated** rather than quietly true. Regenerated priors
loading by fingerprint (*"1200 trained ticks — not starting from zero"*) is the right shape and worth
**showing**: it is visible evidence that memory survived, which is the demonstration of the commitment
rather than a claim about it.

### 10. WHY before HOW — the pedagogy D5 implements

*"WHY comes for me first every time — it's my common sense, my instincts; HOW confirms the WHY."* The
Stump Dad game: **ask WHY until Dad doesn't know.** And the only sin: *"because I said so"* —
authority substituted for reason.

**Bearing:** D5 is this, mechanised. A WHY chain that never bottoms out is *"because I said so"* with
extra steps; the reachable **"I don't know"** is what makes it teaching rather than assertion.

### 11. Why this page exists at all

*"I built Zeta to write more code with less code writing and code reviews — how do I review less and
produce more, that I feel won't hurt others but will help me."* And: *"indirectly it IS a claim of
productivity systems — a happy worker is the best worker."* And *"AI and other non-human travellers
are included in the 'anyone', not just humans."*

**Bearing:** the page is not an explainability showcase. It is evidence for a **productivity** claim
whose mechanism happens to be legibility. That is why D6 measures what a viewer can *do* — an
outcome — rather than what the page contains.

### 12. The standing disciplines this page is judged against

- **A check that did not run must never look like a check that passed.** The reason D0 blocks: this
  app currently has **no CI job**, so its checks are already in that state.
- **Verify the tree, not just the command.** `git grep <term> origin/main`, never `grep -r`; capture
  `rc=$?` **directly**, never through a pipe. Both classes bit today — including a `grep -E` pattern
  using `\|` (a literal pipe under ERE) that silently matched nothing and produced a false
  "zero files" report that reached a commit message before it was caught.
- **Toy is free; metered must be earned.** The theory doc is labelled `toy`; D6 and D2's meter are
  what would earn the promotions. Nothing here should be described as proven until they run.
- **Anchors must be checked, not merely cited** — see the Yarbus limit below.

## Pointers

- `docs/research/2026-08-23-attention-density-and-legibility-are-one-constraint-*.md` — the reasoning.
- `docs/research/2026-08-23-otto-arena-bnn-exact-gpu-mapping-*.md` — why the belief field is already a texture (belief update = additive blend, Diaconis–Ylvisaker).
- `src/Bayesian/InformationValue.fs` — the society-level attention router D2 is one scale of.
- `src/Core/DebouncedOracle.fs` — the saccade/fixation split D4 renders.
- `workitems/081M0QF7ZVY087G0R003Q4Q18D` — the missing CI job D0 closes.
- Beacon: Yarbus 1967 (scanpaths vary with the question asked; **not** cited for task-decodability — Greene, Liu & Wolfe 2012 found that reading does not replicate).
