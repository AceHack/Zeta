# costume-rho at production model sizes — PRE-REGISTRATION

**Written before any 0.5b/1b/2b response exists.** The commit carrying this file
lands before the commit carrying `db/costume-rho/production-sizes/responses.jsonl`.
That ordering is the whole point: a prediction written after the data is not a
prediction. If the ordering is ever broken, treat every number below as a
post-hoc rationalisation and discard it.

Work-item: `081M0TJY389087G0R000TTF41C`.
Harness: `src/Core.TypeScript/costume-rho/` (unmodified — see §5).

---

## 0. A premise correction that lands BEFORE the run, and does not depend on it

The brief that commissioned this run states that the live heartbeat roster is
three model families — `alexa=qwen2.5:0.5b`, `otto=llama3.2:1b`,
`soraya=gemma2:2b` — selected by a `case "$AGENT"` block in
`.github/workflows/agent-heartbeat.yml`, and that this is "the structural
decorrelation the fleet advantage depends on."

**There is no such block, and the roster is not three families.** Measured:

| claim | measured |
|---|---|
| `case "$AGENT"` model switch in `agent-heartbeat.yml` | **absent** — `grep` returns nothing |
| per-agent model assignment | **none** — the matrix is `agent: [alexa, otto, soraya]`, three *personas* |
| models actually pulled | `qwen2.5:0.5b` (observe tick) and `qwen2.5:7b` (codegen), **identically for all three lanes** (`agent-heartbeat.yml:233,235`) |
| `llama3.2:1b`, `gemma2:2b` anywhere in the roster | **absent**; they appear only in `src/Core.TypeScript/observe/model-efficiency.ts:89,92` as rows in a *catalogue of candidate models*, wired to nothing |
| persona injected into the production chooser | **none** — the tick runs `run-loop-real.ts --participant local-llm`, and `resolveParticipant` (`run-loop-real.ts:97-111`) routes bare `local-llm` to `localLlmParticipant()` with no persona and no agent id |

So the production fleet is **one model, one prompt path, three lanes** — not
three families and not three personas. `run-agents.ts`'s own header already said
this ("production injects NO persona: `resolveParticipant` never receives the
agent id"); the brief's roster claim contradicts the harness's own docstring.

**This is prior to the measurement and survives whatever the measurement says.**
Two consequences follow from code, not from data:

1. `chooseIndex` runs at `temperature: 0` with a fixed `seed` against a pinned
   model (`accelerator/local-llm.ts:22-23,86-88`). A greedy decode with a fixed
   seed is a deterministic function. Three lanes running the *same* function on
   the *same* input therefore produce the *same* output, so their error
   correlation on a shared item set is **ρ = 1 exactly**, and
   `N_eff = N/(1+(N−1)ρ) = 1`. Not estimated — entailed.
2. In production the three lanes do **not** answer a shared item set at all;
   each observes its own world state. So they are not an ensemble, and `N_eff`
   is not merely 1 — it is *not defined* for them, because there is no shared
   question being voted on.

I record a falsifier for (1) rather than asserting it: §4 arm C.

---

## 1. What is being estimated (so the wrong quantity cannot be reported)

The estimand is **pairwise tetrachoric correlation of ERRORS against an answer
key** — for a pair of agents `(a,b)`, the latent-normal correlation of the
binary indicators `error_a(i)`, `error_b(i)`, where `error = 1` iff the agent's
predicted verdict differs from the mutant's recorded `killed` truth.

It is **not** raw agreement, **not** Cohen's κ, and **not** a menu-uniform
`1/menuSize` null. Two agents that agree while both being right contribute
nothing to ρ; only *co-error* does. This is the quantity `N_eff` consumes.

Reported for the record, never as the estimate: φ (the raw 2×2 point-biserial),
which `validate.ts` measures to attenuate true ρ by 21–66% on this repo's own
generative model — and attenuation biases toward the *flattering* answer, so it
will not feel wrong. The harness already prints it labelled
`ATTENUATED LOWER BOUND only — not the estimator`.

---

## 2. The prior reading (7b/8b/9b), which is what I am predicting a change from

From the 2026-08-16 run at `qwen2.5:7b` / `llama3.1:8b` / `gemma2:9b`,
4 personas, 200 items: within-family ρ̂ ≈ **0.65**, cross-family ρ̂ ≈ **0.10**,
D = **0.555**, 95% CI **[0.386, 0.723]**; boundary ρ\* = **0.238** at N = 8.
Verdict: COSTUMES (`CI_low(D) > 0.15`).

---

## 3. PREDICTIONS — stated now, numerically, with what would surprise me

**P1 — the dominant risk, and my primary prediction: the run comes back
DEGENERATE, not with a clean D.** At 0.5b–2b, on a ~13 KB prompt (up to 8 KB
persona + 5 KB test body + source window), I expect at least one agent to trip
the constant-responder guard (same raw emitted index on >95% of items). This
already happened at 8b — `llama3.1:8b` emitted "1" on 200/200 items before the
item-context fix. A 1b model is more likely to, not less. **P(≥1 agent trips
the guard) ≈ 0.6.** If it trips, every ρ̂ involving that agent measures position
bias and the contrast verdict is void — and I will report that as the result
rather than quietly dropping the agent to rescue a number.

**P2 — W (within-family) goes UP vs 0.65.** Predict **W ∈ [0.75, 0.95]**.
Mechanism: the persona block is the *only* thing that differs within a family,
it is long, and small models attend to long context less. The less a model
reads the costume, the more within-family pairs collapse onto the same
weight-driven response. Smaller model ⇒ thinner costume effect ⇒ higher W.

**P3 — X (cross-family) also goes UP, from 0.10 to X ∈ [0.20, 0.60], and for a
reason that is NOT good news about the fleet.** Small models of different
families converge on the same *degenerate* heuristics — position bias, a
constant "killed" prior, surface keyword matching. Two agents sharing a
degenerate heuristic co-err heavily. So a rise in X here is evidence of shared
incompetence, not of shared judgment, and must be reported that way.

**P4 — D = W − X SHRINKS vs 0.555.** Predict **D ∈ [0.10, 0.40]**, most likely
landing **INCONCLUSIVE** under the pre-registered criteria (COSTUMES needs
`CI_low > 0.15`; GENUINE needs the CI inside `[−0.10, +0.10]`). Both terms are
pushed toward a common degenerate ceiling, which compresses their difference.

**P5 — competence falls to near chance.** Predict **ĉ ∈ [0.45, 0.60]** per
agent. If more than half the agents sit at ĉ ≤ 0.5, Condorcet runs *backwards*
and the ρ question is secondary — the harness says so and I will lead with it.

**P6 — the boundary, which is algebra and not a prediction.**
`rhoStarAlgebraic(N) = (N−3)/(3(N−1))`, so at the production roster size
**ρ\*(N=3) = 0 exactly.** At three runners the majority-vote benefit threshold
is zero: *any* positive error correlation means three lanes do not beat one.
This holds no matter what ρ̂ comes out to, and it is the single most consequential
line in this document.

**P7 — N_eff.** Given P2/P3 I expect the society ρ̂ (worst-case, `max(W,X)`) to
exceed 1/3, which by `N_eff = N/(1+(N−1)ρ)` caps `N_eff < 3` at *any* N.
Predict the fleet's **N_eff ∈ [1.0, 1.5]**.

**What would surprise me** (i.e. would falsify the above, and which I commit to
reporting as a surprise rather than absorbing): W < 0.50; or D ≥ 0.555 (the
contrast *growing* at smaller sizes); or ĉ > 0.70 at 0.5b; or X ≤ 0.10 holding
at these sizes.

---

## 4. The arms, fixed now

- **Arm A (primary, like-for-like):** models `qwen2.5:0.5b,llama3.2:1b,gemma2:2b`
  × personas `alexa,otto,soraya,riven` × the **same 200 items** from
  `db/costume-rho/items.jsonl`. N = 12 agents.
- **Arm B (comparison):** the archived 7b/8b/9b responses, re-analysed with the
  identical estimator, so the two readings differ only in model size.
- **Arm C (falsifier for §0(1)):** `qwen2.5:0.5b`, no persona, the same items,
  run **twice**. If production's chooser is the deterministic function the code
  says it is, the two response streams are byte-identical and ρ = 1. A
  non-identical stream falsifies §0(1) and I will say so.

### Item-set reproducibility — the one procedural deviation, declared up front

`items.jsonl` is reusable, but `run-agents.ts` builds each prompt by reading the
**source and test files from the working tree**. The tree has moved since
2026-08-16: measured, **32 of 200 items** no longer match their recorded
`before` line at their recorded `lineNumber` on current `main`. Running on
current `main` would therefore change the *questions*, not just the models, and
the comparison to Arm B would be confounded.

So Arm A runs in a worktree pinned to **`89bb4fb9ffccabce01fd5f00d837d69e30ab051f`**
— the exact commit that produced the 7b/8b/9b responses. Identical items,
identical prompts, identical persona files (including the fact that `alexa` and
`soraya` have **no** `CURRENT-*.md` at that commit and so run on the preamble
alone, exactly as in the prior run). **Only the model sizes change.** That is
what makes the contrast a measurement of size rather than of drift.

---

## 5. Procedure constraints

The harness is **not modified**. If it turns out to need modification to run at
these sizes, that is a finding to report, not a patch to slip in — a number
produced by an altered procedure is not comparable to Arm B, and the comparison
is the point.

Registers, per `toy-is-free-metered-must-be-earned.md`: a ρ̂ reported **with its
CI and its named estimator** over the measured roster is `metered`. Any
statement about a roster or an N that was not run — including forward
extrapolation past N = 12 — is **not** metered and is labelled as such.

## Pointers

- `src/Core.TypeScript/costume-rho/` — the harness (`build-items` → `run-agents` → `estimate-rho`; `validate` is the estimator's own falsifier)
- `src/Bayesian/CondorcetBoundary.fs` — `N_eff = N / (1 + (N−1)ρ) → 1/ρ`: correlation **caps** effective identity, it does not merely discount it
- `db/effective-agent-count/README.md` — a **different** ρ (ICC(1) on file-sampling overlap). Not this quantity; not comparable; not conflated here.
- `.github/workflows/agent-heartbeat.yml` — the roster §0 corrects

---

## APPENDED CORRECTION — 2026-08-24, after the run started, before any result was read

**§0's roster claim is WRONG, and the brief it "corrected" was right.** Recorded
here as an append rather than an edit: the original text stands above, the git
history holds both, and nothing is quietly rewritten.

**What happened.** I checked `.github/workflows/agent-heartbeat.yml` in the shared
checkout at `/Users/acehack/Documents/src/repos/Zeta`. That checkout is at
`0a4a7b41aa` — **50 commits behind `origin/main`** (`49a16f6a`). The `case
"$AGENT"` block does not exist at that commit. It **does** exist on `origin/main`:

```
  case "$AGENT" in
    alexa)  HEARTBEAT_MODEL="qwen2.5:0.5b" ;;
    otto)   HEARTBEAT_MODEL="llama3.2:1b" ;;
    soraya) HEARTBEAT_MODEL="gemma2:2b" ;;
    *) echo "::error::no heartbeat model declared for agent '$AGENT'" >&2; exit 1 ;;
  esac
```

with the comment *"Heterogeneous by design: three model FAMILIES, so a wrong
answer from one agent is not automatically the wrong answer from the others."*
The roster **is** `0.5b/1b/2b` across three families, exactly as the brief said.

This is the `verify-the-tree-not-just-the-command` failure in its textbook form:
a check that ran against a stale tree is **a check that did not run**, and it
reported a confident negative. `grep` returning nothing is a claim about the tree
you grepped, never about the repository. The control I should have run first, and
did not, is `git rev-parse origin/main` against the tree I was reading.

**What survives §0, re-verified on `origin/main` at `49a16f6a`:**

- **The no-persona finding stands.** The tick exports
  `ZETA_PARTICIPANT="local-llm:${MODEL}"` and calls `--participant
  "local-llm:${MODEL}"`; `resolveParticipant` (`run-loop-real.ts:100-103`) routes
  a `local-llm:` spec to `localLlmParticipant({ model })` — **model only, no
  persona, no agent id.** Production varies *weights* across lanes and injects
  *no costume at all*.
- The determinism entailment stands: `temperature 0` + fixed seed + pinned model.
  It now says something *weaker* than §0 claimed, because the three lanes no
  longer run the same weights — identical inputs no longer force identical
  outputs. So production ρ is a quantity to be **measured**, not entailed. Good:
  that is what Arm A measures.
- ρ\*(N=3) = 0 stands. It is algebra and never depended on the roster. Confirmed
  by execution: `validate.ts` prints `rhoStarAlgebraic: N=3 -> 0.0000`.

**What this changes about the reading, stated before the numbers are seen.**
Production is now **three families, three lanes, no persona**. The quantity that
prices the fleet is therefore the **cross-family ρ̂ with persona held fixed** — the
sub-panel of Arm A in which the *only* thing that differs between agents is the
model weights, which is exactly what differs between the production lanes. That
panel is N = 3, so its boundary is ρ\*(3) = 0 and its
`N_eff = 3 / (1 + 2ρ̂)`.

**Predictions P1–P7 are untouched by this correction.** They are predictions about
ρ̂ at 0.5b/1b/2b on this item set, which is precisely the run that is executing;
none of them was derived from the roster claim. They stand as written, unamended,
and I do not get to revise them now that I know the roster is heterogeneous.

**One further correction to §4, found by execution rather than reasoning.** §4
asserts that `alexa` and `soraya` have no `CURRENT-*.md` at the pinned commit and
so run on the preamble alone. The run log says otherwise — all four personas load
context (`alexa` 3818 bytes, `otto` 8594, `riven` 7424), because `loadContext`
falls back to `memory/<persona>/NOTEBOOK.md` when `CURRENT-<persona>.md` is
absent, and I read only the `CURRENT-*` glob. The condition is identical in the
prior 7b/8b/9b run, so the like-for-like comparison is unaffected.
