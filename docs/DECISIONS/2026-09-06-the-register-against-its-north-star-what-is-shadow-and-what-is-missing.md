# The register against its north star: what is shadow, and what is missing

Date: 2026-09-06
Status: recorded. This document exists because "the pipeline delivers" was used to imply "the system
works", and those are different sentences. It states which one is true.

## The correction that prompted it

The previous pass reported an end-to-end run — a Jira-shaped ticket over HTTP, thirteen gates, two
real `--no-ff` merges — and called it working end to end. The pipeline did do that. **The system did
not**, because the agent loop that is supposed to drive the organization was joined to the pipeline
in one direction only:

```ts
// run-org.ts, before this pass
resultFor: (o) => o.tag === "PickWork"
  ? { workId: o.work.id, lane: o.work.lane, success: true, doraContribution: 0.5 }
  : undefined
```

Every cycle in which an agent picked work reported that the work succeeded. `run-agent.ts` supplied
no `resultFor` at all, so there the choice simply vanished.

## The north star, as the design corpus states it

`agentic-organization/docs/` — 52 documents. Two are load-bearing here.

**`ALWAYS_ON_ORCHESTRATION_RUNTIME.md`** gives the core loop:

```text
state changes -> domain event persisted -> event published -> rules evaluated
  -> reaction plan created -> leases/budget/hat supply checked -> actions executed
  -> run requests / messages / tasks / reports / escalations created
  -> outcomes observed -> reconciliation verifies reality matches Organization state
```

**`OBSERVE_ACT_PROMOTION_GATE.md`** gives three modes and the rule for moving between them:

| mode | what dispatches |
|---|---|
| `legacy` | only the legacy lane |
| `observe_act_shadow` | menu rendered, slot selected, **evidence recorded** — command and tool dispatch are SHADOW |
| `observe_act_primary` | command dispatch, tool dispatch and act-time authorization use the REAL runtime |

Promotion requires ≥100 ticks **or** ≥24h soak, zero illegal slot selections, divergence ≤5%, and
primary safety counters below the demotion thresholds. And it is explicit about who decides:

> *"Agents may select from legal menu slots, but they do not decide whether the organization is safe
> to promote a lane."*

## What that makes the previous state

Not shadow. **Worse than shadow.** A shadow lane's entire value is recording what would have
happened while everyone knows nothing did; a lane that fabricates `success: true` is
indistinguishable in the record from one that worked. It was the vacuity class sitting on top of
the fifteen passes spent making the layer beneath it honest.

## What this pass changed

`slot-dispatch.ts`:

- **Three modes**, named as the design names them.
- **A dispatch seam.** `SlotDispatcher` is a port with `meta`, so it appears in a run's fidelity
  report like every other adapter.
- **Shadow performs nothing and invents nothing.** It returns **no `WorkResult`** — not a success,
  not a failure. In shadow the work was not done: `success: true` is a lie and `success: false` is
  also a lie, because it did not fail, it was not attempted. No result leaves the agent in
  `ExecutingWork` — picked up, outstanding — which is the true state.
- **Primary reaches the pipeline**, and a failing pipeline produces a failing result. The old
  constant had no way to express that case at all.
- **The gate decides, not the caller.** `dispatcherFor` takes a *verdict*, not a mode, so "run this
  in primary" is not a sentence a caller can say.
- **An unmeasured divergence BLOCKS.** A rate of zero from a comparison nobody ran is not a clean
  rate; and this is the gate that unlocks real dispatch of side effects, so it is the worst possible
  place to read absence as permission.

The CLI now prints what it is:

```text
mode:        observe_act_shadow — the shadow window has neither 100 ticks nor 24h of soak (0 ticks, 0h)
cycle 1:     7 option(s) -> EmitHeartbeat -> Idle  [not dispatched]
```

## WHERE THIS ACTUALLY STANDS — the honest table

| north-star element | state |
|---|---|
| domain event persisted | **present** — content-addressed shard store, folds |
| event published | **present, without a broker** — `org-reactor.ts` derives the next action from what just happened. I first recorded this as absent by looking for a bus; the module's own header answers it: *"a transport is not what makes this event-driven; deriving the next action from what just happened is"* |
| rules evaluated → reaction plan | **present** — `runReactor` is a work queue where `reactionsTo(events)` enqueues the next action, wired into the runtime at Phase 11. **My first table called this absent, and that was wrong** |
| leases / hat supply checked | **present** — work-market leases, RMO hat-supply voting |
| budget checked | **present as of this pass** — `budget.ts`, consulted by the primary dispatcher before it performs |
| actions executed | **present** — five ports plus phase producers |
| **an agent's choice CAUSES the action** | **present as of this pass** — `deliverWorkItem`, reached through the dispatch seam |
| outcomes observed | **present** — fidelity, gate records with evidence, pace |
| **reconciliation verifies reality matches org state** | **present as of this pass** — `reconciliation.ts`, wired into the runtime report; `changesUnlanded` was one row of it |
| observe-act modes | **present as of this pass** |
| durable `observe_act_tick` window | **present as of this pass** — a fact on the log, folded into a rolling window |
| divergence measurement | **present as of this pass** — the observe-act selection compared against the legacy priority lane, every tick |

## A gate that cannot open is the vacuity class with the sign flipped

The first version of this document ended here, with the lane correctly stuck in shadow and two
named gaps. That was honest and it was not finished, because **a gate wired to a window that is
always empty refuses every time and is unfalsifiable.** Every refusal test passes; none of them
distinguishes a working gate from a disconnected one. A check that cannot fail proves nothing, and
a gate that cannot open measures nothing — the same defect, mirrored.

So the two gaps were closed rather than merely reported.

**`observe-act-window.ts`:**

- **The tick is a FACT** (`observe_act_tick`) on the same append-only log as fidelity, queues, QA
  and pace. Nothing new was invented; the missing piece was a fact nobody was emitting.
- **The window is a FOLD** — rolling, bounded, with ticks outside it dropped rather than aged down.
- **Soak is the SPAN, not the count.** Two ticks a day apart have soaked a day.
- **Divergence is defined and stated**, because the design names a rate without defining one: the
  observe-act selection compared against the **legacy priority lane** — a genuinely different
  selector, which is what lets the rate be non-zero. A measurement between one selector and itself
  reads 0% by construction and would sail through the gate proving nothing.
- **Both halves of a selection count.** Two lanes that both say `PickWork` on different items have
  diverged on the only thing that matters.
- **A partial comparison is still UNMEASURED.** A rate over the 10 ticks somebody compared out of
  100 is a rate whose denominator is not the window.

## So: is it working end to end?

**The loop is complete; the operating evidence is thin.** Precisely:

- The **pipeline** takes a real ticket to a merged MR. Measured and reproducible.
- The **agent loop** chooses real work off a real cascade. Measured.
- The **join** exists, records durable ticks, measures divergence against a second selector, and
  **the gate demonstrably opens** — four dated runs against one store soak past 24h and the CLI
  prints `observe_act_primary`. That is the property the previous pass could not claim.
- The **agent's choice now causes the delivery** — measured: picking work in primary opens and
  merges that exact branch, and a refused merge reaches the agent as a failure.
- **Reconciliation and budget** now exist and are wired — see below.

## The join, closed at the return

Two rows of the table above were still decorative after the promotion gate was built, and the
second one was mine.

**`run-agent.ts` supplied no dispatcher at all.** A participant choosing `PickWork` advanced the
state machine to `ExecutingWork` and nothing ran. The reason nothing *could* be supplied honestly is
that the core's `resultFor` is **synchronous**, and reaching a delivery pipeline is asynchronous —
so the only value that fits a sync seam is one made up on the spot. The core now offers an **async
`dispatch`** on `MainDeps`, awaited by `mainAsync` after the participant has chosen, filled by the
register exactly as `surface` already was. The loop still does not know an organization exists.

**`run-org.ts` read the report of a pipeline that had already run.** Replacing the hardcoded
`{ success: true }` with a *lookup* felt like a fix and was not one: the pipeline ran because the
runtime iterated its own list, and the agent's choice was consulted by nobody. **A dispatcher that
reports an outcome it did not cause is the same lie told more quietly.**

Both now call `deliverWorkItem` — one definition of what delivering an item means: open a change,
walk the phases, merge what passed. Four failures stay four distinct outcomes and none is rounded
into another: nothing attempted / stopped at a named phase / judged and rejected / **passed every
gate and did not merge**. That last one is the disagreement change control exists to catch, and it
scores zero.

### And the deeper form of the same defect

Wiring the dispatcher was not enough, and the run said so. The runtime delivered every staffed task
*before* the agent loop was consulted, so `candidatesFrom` — live leaves only — returned **zero**,
and the agent's only legal choices were heartbeats. Every cycle chose `EmitHeartbeat` over an empty
list, with a fully-wired dispatcher behind it that never once ran. The choice was still decorative,
one layer down.

`deliverSelf` is what fixes it: the runtime may be told to deliver nothing and leave the work live.
**Someone has to leave the work undone for the agent to do it.** With `--agent-delivers` the same
run offers 2 candidates, the agent picks `PickWork`, and the delivery happens because it chose.

### What that measurement then showed

With real work on the menu, the divergence rate stopped being zero:

```text
mode:    observe_act_shadow — divergence 0.3333333333333333 exceeds 0.05
window:  12 shadow tick(s) over 72.0h, 12 compared, divergence 33.3%
```

The observe-act lane and the legacy priority lane genuinely disagree about which item to take, the
gate refuses promotion, and it is right to. That is the divergence measurement doing real work
rather than reporting a comfortable zero — which is the strongest evidence available that it is not
vacuous.

## The last two, and the same discipline in both

**Reconciliation** was the loop's final step and the register had one row of it — `changesUnlanded`,
a single check that a change projected as merged actually merged. `reconciliation.ts` generalises
it into five named disagreement kinds, because each has a different fix and one `Mismatch` kind
carrying a message would hide the important one inside the ordinary one: a bookkeeping lag
(`LandedButNotDone`) and work that went around the process (`DoneWithoutGates`) are not the same
event.

It **reports and never repairs**. Moving a work item to match the repository would destroy the
evidence that they disagreed, and the finding is the product. Which of the three parties is right
is a judgement, and judgements belong to whoever holds the hat.

And the property the whole module turns on: **a tracker nobody asked has not agreed.** The report
carries `checked` and `notChecked` separately, `fullyReconciled` is false when any party went
unconsulted, and the summary names what it skipped in the same breath as the clean result —
because "0 disagreements" over two of three parties sounds like a clean bill and is a strictly
narrower claim.

**Budget** is the north star's precondition — *"if budget is available → create Hermes implementer
run"* — and a hard limit in its precedence ladder. `budget.ts` gives it three states for the same
reason everything else here has three: an **undeclared budget is not an unlimited one**. Reading
`Unbudgeted` as admission makes the limit decorative; reading it as refusal stops every
organization that has not set a budget yet and reads as a broken runtime. So it is its own answer,
and a dispatch that proceeded without a budget check records `budgetChecked: false` rather than
passing for one that ran.

It is checked **before** the work runs — a budget consulted afterwards is a report, not a limit —
and a refusal produces **no result**, exactly as shadow does: the work did not fail, it was never
started. Spending is **idempotent per key**, because a retried action must not be billed twice; a
budget that double-bills on recovery refuses work the organization was entitled to do.

## So where does this actually stand

Every element of the north-star loop is now present and measured. That is a real statement and it
is not the same as "the system is finished":

- The pipeline, the agent loop, and **the join between them** run end to end, with the agent's
  choice causing the delivery.
- The promotion gate can **open**, and with real work on the menu it currently **refuses** — 33.3%
  divergence between the two lanes. The lane is in shadow because it has not earned primary, which
  is the mechanism working.
- Reconciliation and budget exist, are wired, and are mutation-checked.

What has *not* happened: none of this has run against a live tracker, a real repository at scale,
or over a window long enough to earn a promotion honestly. Every measurement above is over
simulated adapters or a single real end-to-end run. The architecture holds; the operating evidence
is a few runs deep.

**A correction worth keeping.** An earlier version of this list had four entries and **two were my
error**. I recorded rules-and-reactions and event publication as absent because I went looking for
a broker; `org-reactor.ts` is that machinery, wired at Phase 11, and its own header explains why
there deliberately is no broker: *"a transport is not what makes this event-driven; deriving the
next action from what just happened is."* I had audited the architecture by searching for the
reference's shapes instead of reading what this one built.

## The clock, because it matters here

Promotion is a claim about time, and the CLI ran on a clock frozen at epoch 0. Reading `Date.now()`
would have made every run unreplayable and leaked wall time into the shared window — the failure
`local-time-never-enters-the-shared-fold` names. So the instant enters through a **declared
channel**, `--now <iso>`, defaulting to the frozen clock. The same flags always produce the same
window, and re-running one instant re-stores the same tick shards, which is an upsert: a repeated
run cannot inflate its own soak.

## Pointers

- `src/Core.TypeScript/corporate/slot-dispatch.ts` — modes, the seam, the gate
- `src/Core.TypeScript/corporate/slot-dispatch.test.ts` — 18 falsifiers, including that shadow
  produces no result and that an unmeasured divergence blocks
- `src/Core.TypeScript/corporate/observe-act-window.ts` — the durable tick, the rolling fold, the
  divergence definition and the legacy comparator
- `src/Core.TypeScript/corporate/observe-act-window.test.ts` — 21 falsifiers, led by the one that
  matters most: a real soaked window actually PROMOTES. Mutation matrix `mut-oawindow`: **17/17
  killed**, after two survivors exposed two of these tests as vacuous — one asserted that shadow
  ticks are excluded from the primary counters using ticks that were *also* outside the 30-minute
  demotion window, so the mode filter it claimed to test was never exercised
- `src/Core.TypeScript/corporate/work-delivery.ts` — `deliverWorkItem`: what a chosen slot DOES
- `src/Core.TypeScript/corporate/work-delivery.test.ts` — 15 falsifiers, led by "picking work in
  primary opens and merges a branch" (asserted on the port calls, so it is causation and not
  correlation) and its mirror, "in shadow the same choice opens no branch at all". Mutation matrix
  `mut-workdelivery`: **11/11 killed**, after three survivors showed three uncovered properties —
  including one guarding a phase whose gate has no eligible evaluator, which needed a reduced chart
  to reach at all
- `src/Core.TypeScript/corporate/reconciliation.ts` / `.test.ts` — five disagreement kinds, the
  unconsulted-party rule; 17 falsifiers, mutation `mut-recon` **10/10 killed** (one survivor showed
  a test using an OPEN item where the mutant agreed by coincidence)
- `src/Core.TypeScript/corporate/budget.ts` / `.test.ts` — three states, keyed idempotent spend;
  17 falsifiers, mutation `mut-budget` **12/12 killed** first pass
- `agentic-organization/docs/OBSERVE_ACT_PROMOTION_GATE.md` — the rule this implements
- `agentic-organization/docs/ALWAYS_ON_ORCHESTRATION_RUNTIME.md` — the core loop the table judges against

---

# ADDENDUM — the organization drives itself (same day, later)

The table above was written when the question was "does the delivery pipeline work". The
question then became whether the ORGANIZATION runs: escalation up the right chains, decisions
recorded, TPMs assigning, directors deciding execution, engineering managers unblocking people
and getting reviews arranged, everything on the calendar, all of it driven through `observe.ts`.

## What that exposed, in order

**The grammar could not address another agent.** `observe.ts` had seventeen `NextAction` kinds
and exactly one communication verb — `respond_to_operator`, which addresses the human. An agent
could work, decompose, explore, rest and rewrite the grammar itself, and had no way to look at a
colleague's artifact, answer it, ask for what it was missing, pull anyone into a room, or hand
work to someone. *A hierarchy whose members cannot address each other is an org chart drawn over
solitary confinement.*

Five verbs now exist, all generic — the core takes strings and knows nothing about hats. The
repo's own guardrails made the change honest rather than easy: `Record<ActionKind, ActionRow>`
refused to compile until every kind had a gate and a scope, the gate switch is exhaustive so each
new gate had to name the authority it reads, and a test that MIRRORS that switch failed until it
agreed.

**`request_information` is never gated**, and that is an NCI-shaped call rather than an
oversight: an agent that cannot say "I am missing something" has only guessing and going quiet
when blocked, and both cost the organization more than the interruption.

**Reviews and QA had no calendar time.** The runtime booked one block type —
`prioritized_work`, for the assignee — and thirteen gates were then judged by hats with nothing
on their calendars. That is not bookkeeping: `loop-policy.ts` makes the calendar RUNTIME
AUTHORITY, so a review with no block is one the reviewing hat's tick cannot SEE it is meant to
do. Work was authorised by the schedule and reviews were not, which is why the review lane could
never drive itself. From 2 blocks on 3 hats to 14 hats booked.

**And nothing ever asked for a review.** `RequestReview` had a reader building a hat's menu and
no writer, so that surface was always empty and `review_artifact` was a verb no agent could be
offered. The first fix sent 26 requests and all 26 landed on ONE lead, because the family routed
to `supervisor` while the calendar had booked seven different hats — so `scope_holder` became a
fourth routing kind, deriving the target from gate ownership rather than from the chain. Routing
is still not the sender's to choose. Measured after: 26 requests, 7 hats, 26/26 to hats holding
the booked block.

**Escalations decided alone.** `RequestDecision`'s policy names its case exactly — *"multiple
valid paths exist and authority sits above the hat"* — and it had zero senders. Now a failing
run escalates twice and asks `engineering_director` both times, with the gate record attached.
A clean run asks nobody.

## What "it drives itself" now means, precisely

`org-drive.ts` closes the loop: state → surface → menu → choice → effect → state. The chain test
is the claim in one assertion — a blocked IC reports it, the report routes to its supervisor
because the chart says so, and the next tick of that supervisor holds it. **Nobody wrote
"engineering managers unblock people" anywhere.** Two different ICs asking the same question
reach two different supervisors, which is what stops an agent shopping for a friendlier answerer.

`observe()`'s priority oracle now knows other agents exist: blocked first (asking is cheap and
un-sticks you), then a review someone waits on, then an open room, then assigning (a manager who
does the task itself has cleared one item and still has the queue), then own work, then convening
— and the free modes remain beside all of it.

## THE LIMIT, STATED PLAINLY

Every port in these runs is **simulated**. `realPorts` is empty and the runs are replayable.
Nothing touched a repository, a tracker or a test runner.

So the 1390 passing tests and the 19-case end-to-end file are evidence about the **organization's
wiring** — that the chains route, the calendar authorises, the deliberation survives the store,
the loop settles rather than spins — and are **not** evidence that work has been delivered. The
end-to-end file asserts that limit about itself, because a green e2e suite is exactly the
artifact someone would later cite as proof of something it never measured.

## The last two readers that had no writer

Both were named in the paragraph above as remaining, and both are now closed — which is the
point of naming them.

**No run produced an artifact.** `openArtifact` had zero callers outside tests, so the entire
deliberation layer was unreachable: a turn cites a revision, `deliberationsOf` needs an artifact
to name one of, and none existed. The pipeline was already making the thing — every phase with a
producer returns an artifact — so `historyFromPhases` translates them into a chain, one revision
per phase, in the pipeline's own order. Linear, because a run is not concurrent; manufacturing a
divergence would invent a disagreement the run did not have. **26 reviews are now offerable
across 7 hats, where every hat previously saw zero.**

**And then the drive stopped settling** — every hat was offered a turn every tick, so it ran to
its bound posting about a document nobody had changed. That is chatter, not deliberation. *You
speak once per version*: a hat that already addressed this revision is not offered another turn
on it, and when the artifact moves the head changes and everyone may speak again — which is
exactly when their opinion is worth having. Settles in 14 rounds. Fixing it surfaced a second
defect: turns were attributed to the anchor's first participant, so a room of three recorded one
hat saying everything.

**`ReportRisk` had no sender**, so the organization measured its own pace, found it behind, and
told nobody — the trigger went into `refusals`, a list for things that went wrong rather than a
channel anyone watches. A mission 90% through its window with nothing delivered now reports
upward with the pace reading as evidence. An on-time mission reports nothing.

**`SuggestImprovement` — and a correction I had to be told to make.**

I recorded this family as *deliberately* unsent, reasoning that an improvement is "a judgement
somebody chooses to offer" with no condition the organization can observe. **That was wrong**,
and wrong in the way this register is least allowed to be: I asserted a limit about the design
without reading the part of the design that specifies it. Worse, I wrote a test asserting the
count stays zero — a falsifier pinning my own mistake in place, which is the most durable way to
be wrong here.

`ORGANIZATION_RUNTIME_ARCHITECTURE.md` §"Workflow and Runtime Expansion" is explicit:

> *"Agents should also be able to request new Temporal workflows, durable triggers, Dapr actors,
> and scheduled automation when they discover **repeatable organizational inefficiency**."*
>
> *"Engineering Manager notices **repeated** review drift and requests `ReviewEscalationWorkflow`.
> QA Engineering Manager notices **repeated** missed test coverage…"*

and `NORTH_STAR_ALIGNMENT_CHECKPOINT.md` adds *"escalate repeated inefficiency through the
management chain."* This organization is designed to improve itself, and the trigger is
REPETITION — which is countable.

`inefficiency.ts` counts it, and the unit is what makes it honest: **distinct work items
affected, never occurrences.** One item failing a gate four times is a hard item, which churn and
escalation already handle; four different items failing the same gate is the process. That is
also what separates an improvement from an escalation — an escalation asks somebody to decide
about one stuck thing, an improvement says no per-item decision will stop the next one.

The finding names the pattern and the items it recurred over and **proposes nothing**: the doc
has a Director or Manager deciding what to build, and a detector arriving with a solution would
make that call from the bottom of the chain with the least context about what else is in flight.

Measured: a run where QA fails every item raises two patterns — `runtime_validation` blocking two
different items, and two items escalating to `add_agents` — and `tech_lead` asks
`engineering_manager` for both, which is precisely the doc's own first example. A clean run
raises none.

**All eight signal families now have senders.**
