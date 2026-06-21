---
id: 081KSXN940008QG0R002528JS9
priority: P2
status: open
title: Contribute-back DORA metrics + small-first trust-building external-contribution strategy (not-take-only good-citizen, made measurable)
tier: good-citizen-substrate
ask: Aaron 2026-05-31
created: 2026-05-31
last_updated: 2026-05-31
type: feature
depends_on:
  - 081KQ0YZ80008QG0R001V1PMC0
  - 081KQTPYE0008QG0R0004H9ZB8
composes_with:
  - docs/VISION.md
  - .claude/rules/honor-those-that-came-before.md
  - .claude/rules/bcl-interface-boundary-own-your-interfaces-hexagonal.md
  - .claude/rules/attention-as-currency-descriptive-not-proposal-fsharp-uom-memory-as-economy-bias-neutral-contribution-graph.md
  - docs/backlog/P3/081KSXN940008QG0R001V8NBDV-creator-compensation-via-provenance-contribution-graph-weighted-split-not-drm-aaron-2026-05-31.md
  - docs/UPSTREAM-RHYTHM.md
  - docs/FACTORY-RESUME.md
tags: [good-citizen-substrate, contribute-back, not-take-only, dora-metrics, upstream-contribution, small-first-trust-building, prior-art-visible, anti-extractive, foot-in-the-door, external-contribution]
---

# 081KSXN940008QG0R002528JS9 — Contribute-back DORA metrics + small-first trust-building external-contribution strategy

## The ask (operator 2026-05-31)

> *"PM is right — we should have DORA metrics about contributing back. We need
> to pick some simple things, get friendly with other teams / projects and
> contribute back small things so they get comfortable with larger things. We
> already contributed back to the mise dotnet plugin. Look at my AceHack github
> history — I contribute back a lot; there's a record under my resume."*

This makes the **falsifiable good-citizen test** concrete. Both the architect and
the PM reviewing the VISION "arena, not the throne" proposal (PR #6260) landed on
the same gap: the anti-extractive posture ("harvest ~45 DBs honestly, upstream
relentlessly; prior art stays visible; we are NOT a take-only force") is asserted
but **not measured**. PM's verdict: *"validated only if real upstream
contributions actually land in the projects we learned from."* This row turns that
into DORA-style metrics + a contribution strategy.

## Why this matters (challengeable — push back on the whys)

- **Why measure it at all?** Because "good citizen" is exactly the kind of claim
  that decays into vibe without a metric (per the no-dogma discipline + PM
  review). If we harvest ideas from other projects (081KSV2WD0008QG0R00051XS0N 4-language work; the DB
  endgame) and never give back, we are the extractive force we say we're not.
  *Newcomer pushback surface:* is a DORA-style metric the right shape for
  contribution (which is relationship-driven + lumpy), or does metricizing it
  produce gaming (trivial PRs to hit a number)? → mitigated by the small-first
  *trust* framing below, but flag if the metric incentivizes noise.
- **Why small-first?** Foot-in-the-door: a maintainer who's merged your one-line
  fix is far more likely to engage on a larger architectural contribution. Trust
  is built in small increments, not requested up front. *Newcomer pushback:* does
  small-first risk being seen as drive-by/noise by maintainers who value
  substantive contributions? → pick small things that are *genuinely useful to
  them*, not busywork.
- **Why now?** We are actively harvesting (the DB endgame, the analyzer ecosystem
  we already depend on — Meziantou/Sonar/G-Research/Ionide). The contribution debt
  accrues now; start paying it down now, while relationships are cheap to start.

## Existing contribution evidence (grounding — not starting from zero)

Per `docs/FACTORY-RESUME.md` ("Upstream relationships I maintain") +
existing rows, Zeta/Aaron already contribute back:

- **mise dotnet plugin** — already contributed back (operator 2026-05-31).
- **`.NET` analyzer ecosystem maintainers** — Meziantou, Sonar, G-Research,
  Ionide (relationships maintained; we depend on these analyzers in-tree —
  e.g. Meziantou MA0048/MA0006 fire on our C# every build).
- **Feldera DBSP** reference implementation, **Apache Arrow**, **FASTER**
  research notes — documented prior art + maintained relationships.
- **081KQTPYE0008QG0R0004H9ZB8** — F# UoM + BigInteger upstream contribution.
- **081KQ0YZ80008QG0R001V1PMC0** — contribute Bayesian-inference / belief-propagation primitives
  upstream to mainstream languages.
- Aaron's AceHack GitHub history (operator-pointed; verify-and-catalog as Acceptance step).

The point (operator): Zeta did exactly the harvesting Ani named — and gives back.
This row makes "gives back" *visible and measured*, not just claimed.

## Candidate DORA-style metrics (pick simple ones — challenge + prune)

Stated as candidates so the product team can pick/cut/replace (not settled):

1. **Not-take-only ratio** — of the external projects we harvested ideas from,
   the fraction that have received ≥1 landed contribution back. (The headline
   anti-extractive metric. Target trajectory, not a fixed number day-one.)
2. **External PRs merged / period** — count of contributions landed in
   non-Zeta repos per month/quarter (DORA-deployment-frequency analog, external).
3. **Time-to-first-contribution per harvested dependency** — when we start
   depending on / harvesting from a project, how long until we land our first
   give-back (DORA-lead-time analog).
4. **Relationship breadth** — number of external projects with ≥1 landed
   contribution (the "get friendly with teams" breadth metric).

These compose with the attention-as-currency **contribution graph** rule + 081KSXN940008QG0R001V8NBDV
(provenance contribution graph) — the same graph that attributes *inbound* value
can measure *outbound* contribution.

## Small-first trust-building strategy (the "pick simple things" step)

- Start with **small, genuinely-useful** contributions to projects we already
  touch (analyzer ecosystem, mise, the DBs we study) — docs fixes, small bug
  fixes, test additions — that a maintainer can merge quickly.
- Build the relationship; graduate to larger architectural contributions once
  there's trust (the foot-in-the-door progression the operator named).
- Keep **prior art visible** (`references/prior-art/` openly in the tree; we do
  not pretend we didn't look at other code) — visibility is itself a good-citizen
  signal that makes maintainers comfortable.

## Acceptance

- [ ] Pick the initial small set of DORA-contribute-back metrics (from the
      candidates above; product-team agreement on which, with challengeable whys).
- [ ] Catalog existing contributions (mise dotnet plugin + AceHack history +
      analyzer-ecosystem + Feldera/Arrow/FASTER + 081KQTPYE0008QG0R0004H9ZB8/081KQ0YZ80008QG0R001V1PMC0) into a single
      visible record — the baseline the metrics measure from.
- [ ] Pick the first ~2-3 small, genuinely-useful external contributions to make
      (get-friendly targets).
- [ ] Wire the chosen metrics somewhere visible (compose with the contribution
      graph / DORA surface, not a parallel system).
- [ ] Decide cadence + who owns the contribute-back rhythm (composes with
      `docs/UPSTREAM-RHYTHM.md`, which today governs only the *internal*
      fork↔upstream cadence — this row adds the *external* contribute-back axis).

## Substrate-inventory pass (per verify-existing-substrate-before-authoring)

Searched `docs/backlog/`, `docs/`, `.claude/rules/`: existing contribution
substrate is **specific contributions** (081KQ0YZ80008QG0R001V1PMC0, 081KQTPYE0008QG0R0004H9ZB8) + the **inbound**
contribution graph (081KSXN940008QG0R001V8NBDV, attention-as-currency rule) + the **internal**
fork↔upstream cadence (`docs/UPSTREAM-RHYTHM.md`). No existing row covers
**external contribute-back as a measured DORA-style discipline + small-first
trust strategy**. This row composes with all of them; it does not duplicate.

## NOT this row

- Not the inbound creator-compensation graph (that's 081KSXN940008QG0R001V8NBDV).
- Not the internal fork↔upstream PR cadence (that's `docs/UPSTREAM-RHYTHM.md`).
- Not a doctrine edit to VISION (the good-citizen VISION proposal is PR #6260,
  pending product-team agreement; this row is the *measurable* companion).
