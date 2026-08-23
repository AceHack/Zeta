# Attention density and legibility are one constraint — foveation, frost, and the child-prediction falsifier

**Date:** 2026-08-23
**Status:** `toy` — a design route, nothing measured. Every claim below is labelled, and the one that
matters (comprehensibility) is given a falsifier rather than asserted.
**Routed to:** the arena / identity-DLA browser work (desktop Otto, Lior).
**Origin:** Aaron 2026-08-23 — *"how do we improve this for more local browser-based
intelligence/attention density, under demonstration that most humans — even low-IQ ones who are young
— will understand?"*

---

## 0. The two halves of the question are one constraint

The request looks like a trade: more intelligence per unit of local compute, **and** comprehensible
to a young child. Those are usually opposed — density buys you compression, and compression is what
makes a system opaque.

They are not opposed here, and the reason is specific rather than rhetorical:

> **Density means spending compute where it matters. Spending compute where it matters *is*
> attention. And attention is the one mechanism a child already owns — because it is how their own
> eyes work.**

So the optimisation and the explanation are **the same object rendered twice**. Everything below
follows from refusing to build them separately.

---

## 1. The belief field IS the display — already true, not yet used

`2026-08-23-otto-arena-bnn-exact-gpu-mapping-*.md` established that **conjugate posterior updating is
vector addition in natural coordinates** (Diaconis–Ylvisaker), so a belief update is an **additive
blend on `rgba32float` texels** with zero shader ALU.

The consequence has not been taken yet: **the posterior already lives in a texture.** Displaying it
is a **blit, not a second render pass.**

- **Density:** you stop maintaining two representations (a model *and* a visualisation), which is
  usually where browser demos spend their budget.
- **Legibility:** the picture is not a rendering *of* the belief — it **is** the belief. There is no
  translation layer to be wrong, and no drift between what is shown and what is used.

**Register: `read`.** The mapping is established in-tree; that it makes display free is a
consequence, not a measurement.

---

## 2. Foveation — the compute win and the spotlight are the same mechanism

Run the perception ladder at **full resolution only where variance is high**, coarse everywhere else.
Uncertainty is already per-texel (it is the `NG4` `λ`/`α` components), so the budget allocator is
reading a value the substrate computes anyway.

- **The compute win** is the ordinary attention win: most of the field is settled most of the time.
- **The legibility win is free and immediate:** a child sees **a bright region that moves**. Nobody
  has to be told what a spotlight is.

**Anchor (Beacon): Yarbus, *Eye Movements and Vision* (1967).** The famous result is that the **same
picture produces different scanpaths depending on the question asked** — attention is
task-conditioned, and it is *visible*. **Honest limit, stated because the anchor must be checked and
not merely cited:** Yarbus's stronger reading — that the task can be *decoded* from the scanpath —
has had replication trouble (Greene, Liu & Wolfe, *Vision Research* 2012). Cite him for
scanpath-varies-with-task, which is what this design uses; do not cite him for decodability, which it
does not need.

---

## 2b. The society already has an attention router — this is the same allocator one scale down

Aaron 2026-08-23: **"we have an attention router for the society level vs the individual."**

Correct, and it changes what §2 is proposing. The society-level router is in-tree —
`src/Bayesian/InformationValue.fs` (Lindley / Friston expected information gain), with
`docs/research/2026-07-04-max-mode-economics-compute-allocation-in-a-bayesian-society.md` and
`docs/research/2026-08-13-society-of-decorrelated-bnns-in-one-gpu-*.md`. So foveation is **not a new
mechanism.** It is the existing allocator applied at a finer granularity:

| scale | the unit compute is allocated to | the signal |
|---|---|---|
| **society** | an agent / a BNN in the factor graph | expected information gain from *that agent's* next observation |
| **individual** | a texel / a tile of the belief field | variance in *that region* of the field |

**Same rule, different granularity** — which is manifesto §9 (recursive) and §10 (self-similar) not as
a slogan but as a **checkable claim about an implementation**:

> If society-level and individual-level attention are genuinely the same allocator, then **one
> implementation should serve both**, differing only in a granularity parameter. If two separate
> allocators are needed, the self-similarity claim is decorative and should be dropped.

That is a real falsifier for a manifesto property, cheap to run, and it has an honest failure mode
worth naming: the society router allocates a **scarce, indivisible** resource (an agent's turn) while
the field allocator allocates a **divisible, massively parallel** one (shader invocations). If that
difference forces genuinely different mathematics rather than a different parameter, **say so** — a
strained unification is worse than two honest allocators.

### And it is the strongest thing available for the demonstration

A child can be shown **both zoom levels at once**: which *agent* is bright, and which *part of that
agent's field* is bright. Same picture, two magnifications, **same behaviour**.

That is self-similarity **demonstrated instead of explained** — and it is the one property of this
system that is genuinely hard to convey in words and trivial to convey in a picture. It also gives
the §6 prediction test a second, harder question for free: *"which agent will move next?"* alongside
*"where will this one look?"*

## 3. Uncertainty renders as frost — reuse the vocabulary the system already has

`GlassHalo` / `RoomBoundary.frost` already means **withheld** here. Reuse it exactly:

| appearance | meaning | who already understands it |
|---|---|---|
| clear | known | everyone |
| frosted | **not known yet** | everyone — it is fog |
| bright + moving | **being attended to now** | everyone — it is a torch |

The value is that the metaphor is **already load-bearing elsewhere in Zeta**, so a child learning the
arena is learning the real system's vocabulary, not a simplified parallel one built for the demo.

---

## 4. The attention mechanism is already built — it is just not drawn

`src/Core/DebouncedOracle.fs` already splits exactly this, and already in the eye's own terms:

- a reading **suppressed** inside `MinDelay` is a **saccade** — the prediction step;
- a reading **accepted** after it is a **fixation** — the update step.

So the arena does not need an attention mechanism added. It needs the one it has **rendered**: draw
the saccade as a fast dim sweep and the fixation as a bright settle, and the agent's attention becomes
watchable without any new state.

**Register: `read`** (the split is in-tree) **+ `proposed`** (the rendering).

---

## 5. Stump Dad mode — the WHY button, and the honest terminal state

This is the pedagogy the request actually names, and it is Aaron's own: *ask WHY until Dad doesn't
know.*

Click the agent at any moment and get one sentence, then click again:

```
why did you go left?        → the fog was thicker there
why did that matter?        → I could not tell if the ball was there
why does that matter?       → I lose when the ball gets past me
why?                        → I don't know
```

**The reachable "I don't know" is the feature, not the failure.** Three reasons, and they are the
same reason at three scales:

1. It is **true** — every chain bottoms out, and a system that always produces one more answer is
   confabulating.
2. It is the **four-register discipline** in a UI: let unknown be unknown.
3. It is what makes the demo **honest to a child**, who will absolutely keep clicking, and who learns
   more from watching a confident system reach its limit than from watching it perform.

**Design constraint that follows:** every WHY answer must be **generated from the state that actually
drove the decision** — the variance field, the attended region — never from a hand-written string
table. A canned explanation is the vacuity class wearing a teaching voice: it looks like an
explanation and cannot be wrong, therefore cannot be right.

---

## 6. The falsifier — you cannot *claim* a child understands

This is the section most explainable-AI work skips, and skipping it is what makes the field's claims
untrustworthy. **Comprehensibility asserted is not comprehensibility measured**, and a demo that
"looks explanatory" and was never put in front of a person is a check that did not run.

**The test, and it is cheap:**

1. Pause the sim at a decision point.
2. Ask the viewer: **"where will it go next?"**
3. Compare prediction accuracy **with** the attention overlay against **without** it (same viewer,
   counterbalanced order; or two groups).

**If the overlay does not raise prediction accuracy, it is decoration.** That is a real falsifier: it
can fail, it is cheap, it needs no instrumentation beyond a click, and it is outcome-based in exactly
the sense Aaron uses the term — the claim is about what the viewer can now *do*, not about what the
display *contains*.

**Extensions worth running, in cost order:** time-to-first-correct-prediction; whether the viewer can
predict a **failure** before it happens (much harder, much more informative); and whether their WHY
questions get **deeper** over a session, which is the Stump-Dad signal directly.

**What the test does NOT license:** predicting the agent's next move is not understanding the
algorithm. Claim only the measured thing.

---

## 7. Density has to be metered, not asserted

Per Aaron 2026-08-23 — *"[this is] what all our meters are designed to measure precisely, and fail
loudly when they have ambiguity"* — the density claim needs a number and a loud failure mode:

> **useful-work fraction** = shader invocations that changed a belief by more than `ε`, over total
> invocations, per frame.

A foveated ladder should **raise** it; if it does not, foveation bought nothing and the honest report
is that it bought nothing. **The loud-failure half:** when the variance field is flat, the allocator
has *no signal* about where to look — and the meter must say **ambiguous**, not silently fall back to
uniform sampling and report a number. A quiet fallback there would report the attentive system and
the blind one identically, which is precisely the failure the meter exists to catch.

---

## 8. Honest limits

- **Foveation misses things outside the fovea.** That is inattentional blindness, it is a real cost,
  and the demo should **show it happening** rather than hide it. A child watching the agent miss a
  ball because it was looking elsewhere learns more about attention in one second than any caption
  delivers — and it is the honest register besides.
- **`toy` status.** Nothing here is measured. §6 is what would move the legibility claim to
  `metered`; §7 is what would move the density claim.
- **"Most humans, even young or low-IQ, will understand" is a strong empirical claim** and this
  document does not establish it. §6 is how you would find out, including finding out that it is
  false.

---

## Pointers

- `docs/research/2026-08-23-otto-arena-bnn-exact-gpu-mapping-belief-update-is-alpha-blending-and-the-rgba-coincidence-that-isnt.md` — the blend-unit mapping §1 rests on.
- `src/Core/DebouncedOracle.fs` — the saccade/fixation split already built (§4).
- `docs/research/2026-07-16-echolocation-debounce-and-the-real-sensor-fusion-proof.md` — where that split gets its `ρ = 1/(1+L)` law. **Caveat that must travel with it:** `1/(3√2)` in that document is a design parameter, **not** a Tsirelson bound (Tsirelson is `S ≤ 2√2 ≈ 2.828`).
- `src/Bayesian/InformationValue.fs` — the society-level attention router §2b says this is one scale of; plus `docs/research/2026-07-04-max-mode-economics-compute-allocation-in-a-bayesian-society.md` and `docs/research/2026-08-13-society-of-decorrelated-bnns-in-one-gpu-*.md`.
- `src/Core/GlassHalo.fs` · `RoomBoundary.frost` — the frost vocabulary reused in §3.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why this document is labelled `toy` and what the promotion costs.
- Beacon anchors: Yarbus 1967 (scanpaths vary with task); Greene, Liu & Wolfe 2012 (the honest limit on that anchor); Diaconis & Ylvisaker 1979 (conjugate priors, via the mapping doc).
