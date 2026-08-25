---
id: 081M0WZTGEX087G0R000VRRANV
type: task
state: backlog
priority: P2
slug: categorical-softmessage-for-the-factor-graph-bounded-influen
title: "Categorical SoftMessage for the factor graph: bounded influence plus distinctness-priced correlation"
created: 2026-08-25T17:34:53.917Z
depends_on: []
composes_with: []
---

# Categorical SoftMessage for the factor graph: bounded influence plus distinctness-priced correlation

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WZTGEX087G0R000VRRANV-*.md` glob. -->

## Why

`FactorGraph.Factor<'M>` is generic over its message family, but `Zeta.Bayesian`'s
only family is `Gaussian` (continuous) while `SoftValue` is categorical. There is
no call path between them. A layer graph whose layers hold different KINDS of
belief needs a categorical message.

`SoftValue` itself cannot be it: it is normalized by construction, and a message
must be unnormalized or the group law it is joining does not hold.

## What shipped

`src/Core.TypeScript/bayesian/soft-message.ts` — integer log-weights in millinats,
so the group laws hold exactly, it byte-locks, and the influence bound is exact
arithmetic rather than an approximation.

Three properties, each with a break-red:

- **No veto.** In log-space `product` is addition, so a −∞ log-weight silences a
  candidate permanently. Bounded influence (Huber 1964; Hampel 1974) clamps every
  message to ±`MAX_INFLUENCE`. The same clamp closes the EP cavity blow-up.
- **No cloning into a majority.** A per-message bound is worthless when messages
  are free (Douceur 2002). Correlated voices are priced by Kish effective sample
  size (`nEff = n/(1+(n−1)ρ)`, Kish 1965 ch. 5) — deliberately NOT
  `unionEquivalentAgentCount`, which answers a different question.
- **The discount is measured, not asserted.** `productByDistinctSource` consumes
  `AntiSybil.DistinctnessReadout.SourceOf`, an unforgeable external trace, rather
  than estimating correlation from message content — which would penalise honest
  consensus and so produce the ρ→1 collapse by trying to prevent it.

## Open

- **F# conformance to `IMessage<'M>`** (`src/Bayesian/Message.fs:55`). Authored in
  TypeScript because the container had no `dotnet`; an unfalsified primitive in the
  inference kernel is the failure this repo refuses, so it was written where it
  could be falsified.
- **End-to-end**: real drift streams → `AntiSybil.antiSybil` → this combine. What
  is proven today is that the TS side consumes a readout correctly. Needs dotnet.

## Honest limit

Bounded influence is a RATIO, not an immunity. 50 clones at ρ=1 carry one clone's
worth, so the honest side needs three voices instead of fifty-one. A majority can
still bury a minority; what it cannot do is bury it with one voice, irreversibly,
or cheaply. There is a test named for that.
