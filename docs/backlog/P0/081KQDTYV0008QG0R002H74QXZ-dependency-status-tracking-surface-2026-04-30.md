---
id: 081KQDTYV0008QG0R002H74QXZ
priority: P0
status: closed
closed: 2026-05-07
closed_by: "docs/dependency-status.md landed + CLAUDE.md pointer (2 refs) + AGENTS.md pointer (1 ref) — all 3 acceptance criteria met"
title: Dependency status tracking surface — outages and issues affecting us (Aaron 2026-04-30, urgent)
tier: design + implementation
effort: M
ask: Aaron 2026-04-30 (autonomous-loop channel input — verbatim "we need somewhere that list the status of our dependinces and issues that could affect us" + 6 source URLs + urgency clarification "github can erase stuff from master when we use the merge queue sometimes")
created: 2026-04-30
last_updated: 2026-05-07
depends_on: []
composes_with: [081KQ8P5D0008QG0R003BFZPRC, 081KQB8J40008QG0R000A61G4T]
tags: [dependency-status, outages, github-incidents, supply-chain, observability, factory-resilience, urgent]
---

# Dependency status tracking surface — outages and issues affecting us

> **First-class factory surface** (Aaron 2026-04-30):
> *"looking at github status should be first class for us we
> live on git and github for now until we get a 2nd host in
> the future."* This is not a "design something later" row —
> it's the visibility layer the factory's hot path runs
> through. Until a second git host exists, GitHub status IS
> factory status, and the surface should reflect that
> operational reality.

Aaron sent input on 2026-04-30 via the autonomous-loop maintainer
channel asking the factory to land a surface that lists the
status of the dependencies the factory relies on and any issues
in those dependencies that could affect us. The framing came
with 6 source URLs covering a GitHub-availability incident class
(merge queue bug + general availability degradation), a
follow-up urgency clarification (*"github can erase stuff from
master when we use the merge queue sometimes"*), and a
first-class-priority elevation (*"looking at github status
should be first class for us we live on git and github for
now until we get a 2nd host in the future"*). The first-class
framing composes with the existing 3-tier multi-remote design
work (Amara packet 3 2026-04-29, task #341): the
status-tracking surface IS the tier-0 visibility layer that
the multi-remote design assumes is in place.

This is a **P0** row (escalated from P1 on Aaron's urgency
clarification) because:

1. **Live evidence found while filing this row.** The GitHub
   status API at write-time shows an ACTIVE incident:
   *"Incomplete pull request results in repositories"* —
   started 2026-04-30T03:49:37Z, status `investigating`,
   component `Pull Requests` flagged `degraded_performance`,
   ongoing for 7+ hours. The factory has PR #911 in flight
   during this incident; our 0-unresolved-threads count and
   our auto-merge readiness signals could both be based on
   incomplete API results. **Auto-merge on PR #911 was
   disabled at 2026-04-30T~11:14Z while filing this row, as
   the conservative response to live degradation evidence.**
2. **The dead-air polling loop earlier this session may have
   been exacerbated by this incident.** It ran ~2.5 hours
   (08:19Z merge → 10:50Z catch); the incident has been
   active since 03:49Z. Without a dependency-status surface,
   future-Otto can't disambiguate own-discipline-failure
   from external-dependency-degradation when both compose.
   Both happened simultaneously this session.
3. **The factory's hot path runs through GitHub.** Any GitHub
   degradation IS a factory degradation, with no current
   visibility surface naming it as such.

## Repo merge-mechanism verification (2026-04-30)

Aaron's urgency clarification mentioned "the merge queue."
Verified at write-time via `gh api`:

- **`merge_queue: None`** in `branches/main/protection` — we
  do NOT use GitHub's merge-queue feature. The Trunk.io
  post about merge-queue-builds-on-wrong-commit is a
  different bug class than what currently affects us
  directly.
- **Auto-merge with squash** (`auto_merge: true`,
  `squash: true`, `merge_commit: false`, `rebase: false`)
  is what we use.
- **`allow_update_branch: true`** is the relevant safety
  here — auto-merge auto-rebases stale branches before
  merging, reducing (but not eliminating) the
  stale-base-merge risk.
- **Required status checks**: lint (semgrep, shellcheck,
  actionlint, markdownlint) + build-and-test (macos-26,
  ubuntu-24.04, ubuntu-24.04-arm). 7 required contexts.

So: the *specific* merge-queue bug Aaron worried about
doesn't apply to our setup directly. The *broader* concern
(GitHub backend bugs producing wrong-state results, of
which the live PR-degradation incident is a current
example) absolutely does. The status-tracking surface is
P0 against the broader concern, not the specific
merge-queue concern.

## Aaron's verbatim input (channel preservation per Otto-363)

> we need somewhere that list the status of our dependinces
> and issues that could affect us
> https://github.com/orgs/community/discussions/193645
> https://www.githubstatus.com/
> https://news.ycombinator.com/item?id=47881672
> https://github.blog/news-insights/company-news/an-update-on-github-availability/
> https://www.youtube.com/watch?v=b13m-iuu4XU&t=288s
> https://trunk.io/blog/what-happens-if-a-merge-queue-builds-on-the-wrong-commit
> this can affect us

The "this can affect us" closing is Aaron-as-second-person
framing the relevance: not abstract dependency-management, but
*specifically* the merge-queue / GitHub-availability class of
issue that hits the factory's PR-driven workflow directly.

## Why this matters

- **The factory's hot path runs through GitHub.** Auto-merge,
  the every-minute autonomous-loop cron, the Scorecard rolling
  window, CodeQL analyses, the AceHack→LFG forward-sync flow,
  Copilot/Codex PR reviews — all are GitHub-mediated. A GitHub
  outage is a factory outage; a GitHub merge-queue bug is a
  potential commit-corruption surface (per the Trunk.io post,
  merge queues can build on wrong commits under specific
  edge-case conditions).
- **Silent dependency degradation is the worst kind.** When
  GitHub Actions runners are slow but functional, a polling
  loop watching CI looks indistinguishable from a real wait.
  Without a surface naming "GitHub Actions runner queue is
  currently degraded," future-Otto can't disambiguate
  honest-wait from external-incident.
- **Quantum-resistant crypto and supply-chain discipline both
  assume we know what's running.** The
  `feedback_all_cryptography_quantum_resistant_even_one_gap_is_attack_vector_2026_04_23.md`
  rule and the absorb-and-contribute community-dependency
  discipline both presume the factory knows its dependency
  surface — but currently we only know what's in
  `Directory.Packages.props` / `package.json` /
  `tools/setup/*.sh`, not what's *currently failing or
  flagged* in those dependencies.
- **The 6 source URLs Aaron sent are a worked example of the
  class.** Each describes either a current GitHub incident,
  the GitHub availability surface, an HN discussion of the
  fallout, or a Trunk.io technical post on merge-queue
  edge cases. The factory needs a place where a future tick
  sees "GitHub merge-queue had a bug yesterday — check if
  your auto-merge fired on the right commit."

## Scope (design + implementation row)

This row produces, in order:

1. **Design pass** — what shape does this surface take?
   Candidate shapes (each has tradeoffs):
   - **Static markdown file** at
     `docs/dependency-status.md`: cheap, version-controlled,
     manually-updated. Good for "known-watched dependencies"
     list; bad for "current incident state."
   - **Cron-driven scraper** that polls
     `https://www.githubstatus.com/api/v2/summary.json`
     (and equivalent for other dependencies) and writes a
     `docs/dependency-status/current.json`. Self-updating,
     surface-able to agents and humans. Adds a workflow
     and a script.
   - **Issue-tracker integration** — open a tracking issue
     in the LFG repo per dependency we monitor; status
     updates flow to the issue. Discoverable via
     `gh issue list` filters. Adds GitHub-issue dependency.
   - **Hybrid** — static markdown for the watched-list +
     cron scraper for current state + per-incident issues
     for active investigation. Most coverage; most surface
     to maintain.
2. **Watched-dependencies enumeration** — what do we depend
   on operationally? Initial set: GitHub (Actions, Copilot
   review, Codex review, hosting, merge-queue, Scorecard);
   Anthropic (Claude Code harness, model availability);
   OpenAI (Codex, ChatGPT for Aaron's substrate channel);
   Google (Gemini for substrate channel); npm registry; bun
   registry; mise; rustup; .NET runtime; PostgreSQL (if
   used); Linear (if used). Cross-reference with
   `tools/setup/*.sh` install paths.
3. **Status-source enumeration** — where does each
   dependency publish status? GitHub:
   `https://www.githubstatus.com/api/v2/`. Anthropic:
   `https://status.anthropic.com/`. OpenAI:
   `https://status.openai.com/`. Google: per-product
   pages. The status-source-list itself is data the
   surface must capture.
4. **Implementation** — start with the chosen shape;
   expand if the static markdown turns out to be enough,
   stay there.

## Adjacent merge-risk classes in scope

Aaron's named concern was the merge-queue-builds-on-wrong-commit
class (which we don't trigger directly because we don't use
merge-queue). The broader class — *GitHub backend producing
wrong-state results that auto-merge can fire against* — IS in
scope. Specific failure modes the surface should help future-Otto
notice:

- **Auto-merge against stale base.** Our auto-merge with
  `allow_update_branch: true` setting auto-rebases stale
  branches before merging — but if the rebase itself fires
  during a degraded-API window, the result might not be what
  the diff preview showed.
- **`allow_update_branch` auto-rebase producing unexpected
  merge content.** When auto-merge updates a stale branch,
  the resulting tree is whatever the rebase produces. If the
  rebase happens during incomplete-API-state, the branch state
  observed by reviewers can differ from the state actually
  merged.
- **Force-push race with auto-merge firing.** If a force-push
  and auto-merge fire near-simultaneously, the merged commit
  may be whichever the GitHub backend resolved first — not
  necessarily the head observed during review.
- **Incomplete API results during merge decision.** This round's
  active incident ("Incomplete pull request results in
  repositories") is exactly this class. A 0-unresolved-threads
  count from a degraded API can satisfy auto-merge's
  required_conversation_resolution gate while threads exist
  unseen.

The status-tracking surface flags these conditions; it does not
mitigate them. Mitigation rules (e.g., "when GitHub Pull Requests
component is degraded, do not arm auto-merge") belong in
follow-up rows.

## Sharpening points (Claude.ai 2026-04-30 review)

Three operational details to settle in the design pass:

1. **Polling cadence cost-vs-freshness tradeoff.** Polling every
   minute would be noisy and might hit GitHub's rate limits;
   polling every hour might miss short incidents that fall
   wholly within the gap. Reasonable shape: poll on
   freshness-pass triggers (before mutating actions like merge,
   force-push, auto-merge arming), poll opportunistically when
   ticks are otherwise idle, treat any non-operational status as
   a freshness gap that propagates to dependent decisions.
2. **Distinguish factory-relevant components from unrelated
   incidents.** A GitHub Pages outage doesn't affect the
   factory's PR pipeline; a Pull Requests degradation does.
   Without that distinction, every minor unrelated incident
   becomes noise and the surface trains future-Otto to ignore
   it. Initial factory-relevant component allowlist for GitHub:
   Pull Requests, Actions, API Requests, Webhooks. Other
   dependencies (Anthropic, OpenAI, Google) get their own
   allowlist when their status sources are wired in.
3. **Historical record for retrospective correlation.** Log
   incidents to a durable file (e.g.,
   `docs/dependency-status/incident-log.jsonl`) so future-Otto
   can correlate "session-time anomalies" against
   "session-time incidents." Without this, the diagnostic
   question Deepseek's framing introduced ("if I do nothing,
   will the signal change on its own?") can't be answered
   retrospectively — the substrate gains nothing from past
   incidents.

## Out of scope for this row

- Building a full incident-management system. The factory
  needs *visibility*, not Pagerduty.
- Real-time alerting / paging / on-call rotation. If
  dependencies fail, the factory pauses, files an incident
  note, and waits for restoration. No auto-paging.
- Per-dependency mitigation plans. Those go in separate
  rows when concrete (e.g., "if GitHub merge-queue is
  flagged, switch from auto-merge to manual-merge for the
  duration").
- Replacing or vendoring degraded dependencies preemptively.
  Vendoring discussions belong in 081KQ8P5D0008QG0R003BFZPRC (TS+Bun migration)
  for the dependencies that ARE in-scope for vendoring.

## When this is "done"

Done = a surface exists that any future-Otto (or human
contributor) can query in under 30 seconds to answer:

1. *What does the factory depend on?* (watched list)
2. *Are any of those dependencies currently flagged or
   degraded?* (current state)
3. *Is there a known issue affecting our merge / CI /
   review pipeline right now?* (active incidents)

The surface must be discoverable from CLAUDE.md and AGENTS.md
(at minimum a pointer line) so cold-start sessions find it.

## Composes with

- **081KQ8P5D0008QG0R003BFZPRC** (TS+Bun migration) — dependency reduction is
  itself a dependency-status mitigation strategy. The fewer
  external runtimes, the smaller the status-tracking
  surface.
- **081KQB8J40008QG0R000A61G4T** (Forbidden Pattern Quarantine) — a category of
  issue worth tracking is "patterns we have used that
  external sources later flagged." Composes naturally if
  both surfaces share a vocabulary.
- `memory/feedback_all_cryptography_quantum_resistant_even_one_gap_is_attack_vector_2026_04_23.md`
  — quantum-resistant crypto policy presumes we know the
  current state of our crypto primitives. Same shape:
  presume-known-state requires a state-knowing-surface.
- `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`
  — the absorb-and-contribute discipline presumes we know
  what we depend on; this row makes the dependency list
  legible.
- `memory/feedback_amara_poll_gate_not_ending_holding_is_not_status_2026_04_30.md`
  (landing in PR #911 alongside this row) — the
  poll-the-gate rule says "watch the gate, not the
  ending." Knowing whether the gate (CI, merge queue,
  reviewer presence) itself is dependency-degraded is part
  of the gate-state. A degraded GitHub Actions queue makes
  "in-progress" mean something different than usual.
- `docs/AUTONOMOUS-LOOP.md` — autonomous-loop runs on
  GitHub-mediated state. Loop-tick-history rows could
  cross-reference the dependency-status surface when
  external incidents shape the tick.

## Source links (verbatim from Aaron's channel, 2026-04-30)

- [GitHub Community discussion 193645](https://github.com/orgs/community/discussions/193645)
- [GitHub Status page](https://www.githubstatus.com/)
- [Hacker News discussion 47881672](https://news.ycombinator.com/item?id=47881672)
- [GitHub Blog — An update on GitHub availability](https://github.blog/news-insights/company-news/an-update-on-github-availability/)
- [YouTube video b13m-iuu4XU (segment at 4:48)](https://www.youtube.com/watch?v=b13m-iuu4XU&t=288s)
- [Trunk.io — What happens if a merge queue builds on the wrong commit](https://trunk.io/blog/what-happens-if-a-merge-queue-builds-on-the-wrong-commit)

The Trunk.io post on merge-queue-builds-on-wrong-commit is
the most operationally-load-bearing of the six — it
describes a class of bug that, if present in our path,
would silently produce wrong commits while our auto-merge
plus CI gates report green. The "wrong commit" failure
mode is exactly the silent-failure shape the factory has
rules against. Worth a careful read on first absorb pass.
