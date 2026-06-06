---
id: B-0029.1
zetaid: 081KR50HA0008QG0R002K2G8B0
priority: P2
status: open
title: "B-0029.1 — Survey: comparable OSS/AI-substrate projects' funding state (GitHub Sponsors, Open Collective, npm funding)"
created: 2026-05-09
last_updated: 2026-05-09
parent: B-0029
depends_on: []
classification: research-now
type: research
effort: S
decomposition: atomic
---

# B-0029.1 — Comparable-project funding state survey

**Slice of:** [B-0029](B-0029-superfluid-ai-substrate-enabled-autonomous-self-sustaining-funding-sources.md)

## What

Produce a research doc at `docs/research/B-0029.1-comparable-oss-funding-survey.md` that answers:

1. Which comparable OSS AI-factory / substrate / F# / .NET projects are funded via GitHub Sponsors, Open Collective, or npm `funding` fields?
2. What monthly income ranges are publicly visible for projects of comparable scope and star-count?
3. What sponsor-tier structures do successful projects use?
4. What positioning language resonates (research lab framing vs tool framing vs community framing)?

This survey is the strategic decision surface for B-0029.2 (setup) — it informs how Zeta should position itself before standing up any profile.

## Acceptance criteria

- [ ] `docs/research/B-0029.1-comparable-oss-funding-survey.md` committed
- [ ] At least 5 comparable projects surveyed (ideally including: Fantomas, FsCheck, Paket, Pulumi, a formal-verification project)
- [ ] Monthly income range documented where public (GitHub Sponsors shows cumulative sometimes; Open Collective shows finances publicly)
- [ ] Sponsor-tier structure patterns documented
- [ ] "Lowest-cost first experiment" recommendation recorded (e.g., npm funding field is ~10 lines of config)
- [ ] Positioning framing options ranked

## Out of scope

- Does NOT set up any funding profile (that is B-0029.2)
- Does NOT evaluate trading-bot path (that is B-0029.4)
- Does NOT evaluate SaaS path (that is B-0029.5)

## Research surfaces

- GitHub Sponsors: `github.com/<org>/sponsors` for comparable projects
- Open Collective: `opencollective.com` finances tab (public for all projects)
- npm registry: search `funding` field in `package.json` for comparable packages
- F# Foundation member projects as reference cohort

## Effort sizing

S — targeted web survey; one research doc; no code changes.
