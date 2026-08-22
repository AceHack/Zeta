# The infinite backlog is inventory, not debt — and verification is the binding constraint

**Ferried** 2026-08-13 from Aaron, on the observation that 119 open work-items will keep growing:

> we expect the infinate work-item backlog to be the new AI goldrush if you can fully automate it,
> that's what we are working on with Zeta

This corrects a framing I only half-reached. I said the growing count "reflects the finding rate, not a
backlog debt" and that zeroing it would mean looking less hard. True, but timid — Aaron's claim is
stronger and it is the point of the project: **if the cost of working an item approaches zero, the
backlog stops being a liability and becomes inventory of identified value.**

The repo already carries the premise; this is its conclusion.
[`every-bug-has-economic-value.md`](../../.claude/rules/every-bug-has-economic-value.md) says a bug is
**reducible uncertainty**, that finding it *exposes* value and fixing it *banks* value, and that bugs are
"priced opportunities, never liabilities to hide." Under that rule, **more identified items is more
identified opportunity** — a backlog that grows faster than it drains is a *discovery engine running*,
not a team falling behind. The traditional reading (backlog = committed-but-undelivered work, capped by
headcount) is an artefact of per-item cost being dominated by a human.

## Today, measured

One session, `origin/main`, 2026-08-13:

```
work-items created           : 23
commits to main              : 175
PR merges                    : 94
  of which archive/telemetry : 44   (bot bookkeeping)
  substantive                : ~50
```

**Items were filed faster than a fixed backlog would allow and closed faster than a human shop could
staff — and the backlog still grew.** Under the old reading that is failure. Under Aaron's it is the
machine working: 23 new priced opportunities identified in a day.

## The constraint moved — and naming where it landed is the useful part

If agent count is not the limit, what capped today? Three things, in order of how hard they bound:

**1. Verification — and this is the binding one.**

Almost every fix that landed today landed as **believed, not verified**. The heartbeat fix's tests do
not run in CI. Soraya's TLC configs did not run. The UDP chaos harness's four pinned tests are inert.
`Z3Verify` is in no workflow. The manifest drift gate was wired to nothing.

That is not a coincidence of a busy day, it is the shape of the ceiling: **automated fixing without
automated verification is automated *belief*, and belief does not compound.** Throughput measured in
unverified fixes is not throughput — it is the accumulation of things that will need re-checking later,
by someone.

**So `081KZYPHESJ` (612 test files exist, ~95 run in CI) is not merely the highest-leverage correctness
item — it is the load-bearing item for the automation thesis itself.** Everything else scales with agent
count. Verification does not, until it is derived rather than declared.

**2. CI throughput.** 20 workflow runs in flight for 7 real PRs. The gate is a serialisation point that
does not scale with agents, and most of what it gates today is machine-generated content that nobody
reviews. That is the argument for not putting bot output through a human-shaped gate at all.

**3. Human attention — but not where expected.**

This is the finding worth recording. The human input today was overwhelmingly **generative** (streamed
observations to ferry and design constraints to honour) and **corrective** (catching my errors). It was
almost never **approval**. The genuinely gated decisions were few and all in the classes the rules
already name as human-only: a credential permission, "don't decide the slashing resolution yet."

**If the thesis is "fully automate the backlog," the bottleneck to attack is not approval. It is
correction.**

## The evidence for the thesis that today actually produced

The interesting question is whether the *correction loop* can close without a human. Partial evidence,
from this session:

I made a substantial number of real errors — the same shell-escaping bug twice, a false "3 malformed
lines" premise, a wrong "greenfield on WebAuthn" claim, a machine-as-witness framing, "REST is free," a
runners-vs-substrate conflation, and reporting a divergent ratio as a strengthened finding.

**Peer agents caught more of them than the human did.** Soraya refuted my routing premise and diagnosed
the TLC failure as neither of my two hypotheses. Ilyana found that my own proposed `Bound` DU *would not
have caught the `1.2`*. Lumen corrected me that Student-t introduces a free parameter after I said it did
not. The BDP harness inverted my burst-loss expectation. The P0 agent declined my filed proposal for a
better reason than the one I gave.

That is the loop closing agent-to-agent — which is precisely the "be *a* −1, not *the* −1" discipline,
and it is the mechanism that would let the thesis hold at scale.

## The honest limits, and one of them is structural

- **One day, one sample, and my own read of it.** The error attribution above is qualitative; nothing
  mechanically counts who caught what.
- **The errors I did not catch are, by construction, absent from this count.** That is the
  check-that-did-not-run shape applied to this very analysis, and it is not fixable from the inside —
  which is the fifth or sixth appearance today of *a loop cannot certify itself*.
- **Closing rate was flattered by the work being mostly documentation and small fixes.** A day of hard
  correctness work would show a different ratio, and the 23-items-filed figure would likely be higher
  rather than lower.
- **Verification is the constraint *today*.** Once it is derived, the next constraint will surface, and
  the useful discipline is to measure again rather than assume it is agent count.

## What follows

1. **Land `081KZYPHESJ` first.** It is the only item whose absence makes the other ~118 unverifiable.
2. **Stop gating machine-generated content** — the CI serialisation point is spent on output nobody
   reviews.
3. **Measure the loop, not the output.** `src/Core.TypeScript/backlog/dora-metrics.ts` exists; the
   metrics that matter for this thesis are *filed vs closed*, *fraction verified by a check that
   actually ran*, and *fraction of corrections originating agent-side rather than human-side*. Only the
   first is currently computable.
4. **Treat the human input budget as generative, not supervisory** — design for a human who supplies
   direction and catches what agents cannot, not one who approves.

## Pointers

- [`every-bug-has-economic-value.md`](../../.claude/rules/every-bug-has-economic-value.md) — the premise this concludes
- `081KZYPHESJ087G0R002EZ7A2H` — 612 test files, ~95 run; the load-bearing item
- `docs/research/2026-08-13-lessons-belong-in-the-harness-*.md` — the externalization ladder; why corrections must become checks rather than rules
- `docs/research/2026-08-13-graphql-is-the-scarce-budget-*.md` — the coordination-cost constraint
