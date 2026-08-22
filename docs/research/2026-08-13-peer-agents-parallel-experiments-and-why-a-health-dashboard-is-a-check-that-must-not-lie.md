# Peer agents, parallel experiments, and why a health dashboard is a check that must not lie

**Ferried** 2026-08-13 from Aaron, on where the automation is heading:

> yes peer agents and multiple experiments at once for the human to review plus good dashboards for
> health are where i'm going

Three parts. The first is already demonstrated, the second changes what the human is *for*, and the
third has a failure mode this session produced a live instance of — which is the part worth writing down
before it is built.

## 1. Peer agents — demonstrated, not aspirational

Today's session is evidence: **peer agents caught more of my errors than the human did.** Soraya refuted
my routing premise and diagnosed a TLC failure as neither of my two hypotheses; Ilyana found my own
proposed `Bound` DU *would not have caught the `1.2`*; Lumen corrected me that Student-t does introduce
a free parameter after I claimed it did not; the BDP harness inverted my burst-loss expectation; the P0
agent declined my filed proposal for a better reason than I had given.

That is the correction loop closing agent-to-agent, and it is the "be *a* −1, not *the* −1" discipline
operating as a mechanism rather than an intention. **Recorded as measured-this-once, not proven** — one
session, and the errors nobody caught are by construction absent from the count.

## 2. Multiple experiments at once — this changes the human's *role*, not their *throughput*

The finding from this session was that human input was overwhelmingly **generative** and **corrective**,
almost never **approval**. Parallel experiments are what make the generative role scale, and the reason
is structural rather than a matter of volume:

| shape | what the human does | scales with |
|---|---|---|
| agent works → human approves | checks work already done | human attention (**does not scale**) |
| agents run N experiments → human picks | **chooses among alternatives** | agent count (**scales**) |

Choosing between N results is *direction*, which is the thing a human is uniquely good at here and which
this session showed is the actual input being supplied. Approving one result is supervision, which is the
thing that caps throughput. **So parallel experiments are not "more work in flight" — they are a
different job for the human**, and the one that does not become the bottleneck.

**The precondition, and it is the same one as everywhere else today:** N experiments are only comparable
if they ran under the same conditions, and "the same conditions" must be **derived, not asserted**. An
experiment that silently differed in setup is not a data point, it is a category error presented as a
comparison.

This is exactly the machinery the Arena thread already built for a different purpose — capability class,
attestation class (ranked/unranked), and substrate content-hash, each **derived from observed access**
rather than declared. **The experiment-comparison surface and the tournament-result surface are the same
problem**, and should not be built twice.

## 3. Dashboards — a health dashboard is a check, and it is the check with the largest blast radius

This is the part to get right before it exists, because this session produced the exact failure live.

**A dashboard is not a view. It is a check that a human trusts *instead of looking*.** Every other check
in this repo fails safe-ish: a test that does not run leaves someone able to notice. A dashboard that
does not run correctly **actively substitutes for noticing**. It is the highest-leverage instance of the
defect class this entire session kept surfacing — *a check that did not run must never look like a check
that passed*.

### The live instance, from this session

I reported **"main green"** on nearly every tick for hours. It was true and useless: my check was

```
gh run list --branch main --limit 8     ← a recent-window scan
```

while **both heartbeat workflows failed on every single run** the entire time. Scheduled runs fell
outside the window, so a *structurally blind* check reported green. The correct shape is

```
per-workflow last conclusion            ← what I switched to
```

A recent-window scan **cannot** see a steadily-failing scheduled job — not "usually misses", *cannot*.
A dashboard built on the convenient query rather than the derived one would have displayed the same
green, to a human who had stopped checking because there was a dashboard.

### What follows for the design

- **Derive what is displayed; never query a convenient proxy.** Same discipline as `build-graph.ts`'s
  `derive` and the Arena's observed-channel labels. If the dashboard's inputs are asserted rather than
  computed from the underlying facts, the dashboard is decoration with authority.
- **The dashboard needs its own falsifier.** Something must fail when the dashboard would show green
  while a thing it claims to cover is red. Untested dashboards are the purest form of this defect, and
  "we would notice" is exactly what a dashboard removes.
- **Coverage must be visible on the dashboard itself.** *"What am I NOT watching?"* is the load-bearing
  question, and it is the one a dashboard structurally hides — the panels present are visible, the panels
  absent are not. `081KZYPHESJ` (612 test files, ~95 run) is precisely this shape one layer down, and the
  fix there is the fix here: **derive the covered set and show the gap**.
- **Prefer per-entity last-state over windowed aggregates.** The window is what made my check blind, and
  windowed aggregates are the default idiom in every dashboard tool.
- **Green must be earned, not defaulted.** A panel with no data should read *unknown*, never *ok* — the
  same one-way discipline as `Unmeasured` in `BusRegime` and `indeterminate` in the erasure meter, both
  of which already refuse to let absence become a pass.

## What exists already

Not starting from zero: `src/Core.TypeScript/backlog/dora-metrics.ts` (DORA folds over work-item events),
`src/Core/SocietalDoraSvg.fs`, `demo/red/red-state.json` + `index.html` (a live dashboard-data lane with
its own telemetry-flush branch), `src/Core.TypeScript/orchestrator-checks/check-orchestrator-state.ts`,
`service/persona-health.ts`, and the LLMTV broadcast surface (`universal/television.md`,
`discovery/llmtv-broadcast.ts`) which is already the "watch a mind work" channel.

The LLMTV connection is worth noting: **a health dashboard and LLMTV are the same surface at different
granularities** — one shows a fleet's state, the other shows a dweller's. Both are one-way observation
channels, and both are gated by the same consent/frost machinery. Building them as one thing is probably
right; building the dashboard *without* the frost discipline would quietly create a surveillance surface
that the LLMTV design deliberately avoided.

## Open

1. **Derive the dashboard's coverage set and display it.** "What am I not watching" is the panel that
   makes the rest trustworthy.
2. **Write the dashboard's falsifier before the dashboard** — a test that goes red when a covered thing
   is failing and the dashboard would show green.
3. **Reuse the Arena's comparability machinery** for parallel-experiment review rather than building a
   second one; they are the same problem.
4. **Decide whether health and LLMTV are one surface.** If yes, the frost/consent discipline applies to
   the dashboard from day one rather than being retrofitted.

---

## Addendum — this scales into controlled experimentation, and the anchor is Kohavi (Aaron, 2026-08-13)

> eventually this scale into tradatially ux experiments like a/b but more choices and crowd sources the
> feedback from many humans who use the sytem. Microsoft does this preety well with their expeirmental
> features

The progression is a real one, and it changes **who measures**:

| stage | variants generated by | choice made by |
|---|---|---|
| today | N agents | **one human, reviewing** |
| next | N agents | **the user population, measured** |

Stage two is **online controlled experimentation**, and "more choices" specifically means it is not A/B —
it is multi-armed, which brings an explore/exploit tradeoff that two-arm A/B does not have (Thompson
sampling and the bandit literature are the relevant family; the cost of exploring a bad arm is paid by
real users, which is what makes it a design decision rather than a statistics one).

### The anchor

Microsoft's experimentation platform is the right reference and it has a named human: **Ron Kohavi**,
who built and ran Microsoft's ExP. The load-bearing works are *Online Controlled Experiments at Large
Scale* (Kohavi et al., KDD 2013) and *Trustworthy Online Controlled Experiments: A Practical Guide to
A/B Testing* (Kohavi, Tang & Xu, 2020). **CITED FROM STANDING KNOWLEDGE, not page-checked.**

The word in that title is the one that matters here: **trustworthy**. Most of that book is not about
statistics — it is about **how experiments lie**, which is the same subject this whole session has been
about.

### Two of its results are things this session already derived independently

**1. Sample Ratio Mismatch is the "derived, not asserted" precondition — with a name and a test.**

The body above says N experiments are comparable only if they ran under the same conditions, and that
sameness must be *derived*. SRM is exactly that check, made concrete: if the observed traffic split
differs significantly from the intended split, **the experiment is invalid regardless of what it shows**
— and the correct response is to discard the result, not to interpret it. It is one of the highest-value
diagnostics in the field precisely because a broken assignment produces confident, plausible, wrong
answers.

That is the same one-way shape as everything else here: SRM **convicts** an experiment, it does not
certify one.

**2. The OEC must be declared before the experiment — which is pre-declaring the capability class.**

Kohavi's Overall Evaluation Criterion has to be fixed *in advance*, or the analyst picks the metric that
flatters the outcome after seeing it. The Arena work reached the identical requirement from the other
direction: **capability class must be pre-declared in ranked matches**, so a participant cannot choose
the category that flatters their score after seeing it.

**Same defect, same fix, two unrelated domains** — which is decent evidence the requirement is
structural rather than a convention of either field. And **Twyman's law** ("any figure that looks
interesting or different is usually wrong") is the harsh-critic discipline stated as an experimentation
rule.

### The new measurement problem crowd-sourcing introduces

Worth naming before it is built, because it is not present in the agent-only version:

- **Preview populations self-select.** Users who opt into experimental features are systematically
  different from the general population — more tolerant, more engaged, more technical. Microsoft's own
  experience is explicit about this. So **preview-feature feedback is directional, not conclusive**, and
  treating it as a population measurement is a category error of exactly the kind this document is about.
- **Novelty and carryover effects** mean the first measurement of a variant is not its steady-state
  measurement. A change can win for two weeks because it is new and lose thereafter.
- **The users become instruments, which makes this a consent surface.** Crowd-sourced feedback is
  telemetry from humans. The same frost/consent discipline that applies to LLMTV and to the health
  dashboard applies here, and for the same reason — an observation channel built without it is a
  surveillance channel that happened to have a good purpose. Given the repo's consent-first spec (§6:
  ongoing, granular, revocable), an experimentation platform should be **opt-in and revocable per
  experiment**, not per-account.

### What this does not change

The agent-side stage is still the near-term one, and it does not need users. **Do not build the
crowd-sourced layer first** — it adds a population, a consent surface, and a statistics problem to a
mechanism whose comparability guarantee is not yet built. The derived-comparability machinery is the
prerequisite for *both* stages, which is another reason it is the piece to get right.

## Open (added)

5. **Implement SRM as the comparability check** rather than inventing one — it is the field's answer to
   the precondition this document names, and it is a small, well-specified test.
6. **Require a declared OEC per experiment**, mirroring the Arena's pre-declared capability class. If the
   two are the same mechanism, build one.
7. Decide the consent shape for crowd-sourced feedback **before** any user-facing experiment — opt-in,
   revocable, per-experiment, under the existing frost discipline.
