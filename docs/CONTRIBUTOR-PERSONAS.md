# Contributor personas — the expected first-contact shape

The human maintainer 2026-04-22, setting scope:

> I've heard if your project is AI friendly AIs may just
> show up and start contributing, that's how humans work
> too and if your issues templates are too difficult they
> move on. That is the first experience potential
> contributor, we should keep a list of human personas
> you expect to encounter for this system so we can have
> a specific shape in our mind for the user experience.

This file enumerates the contributor archetypes — human
**and AI** — we expect to encounter at Zeta's
first-contact surfaces (issue templates, README, AGENTS.md,
SECURITY.md, CONTRIBUTING.md). Each template, each README
section, each landing-page paragraph gets designed with
at least one named persona in mind.

## Relationship to other persona lists

- `docs/README.md` §Quick-start — **document-reader
  audiences** (seven, orthogonal to scope). Answers "who
  reads this doc?"
- `docs/EXPERT-REGISTRY.md` — **internal reviewer
  personas** (Kenji, Daya, Ilyana, etc.). Answers "who
  inside the factory reviews what?"
- **This file** — **contributor personas**. Answers "who
  just showed up wanting to contribute, and do we lose
  them in the first 90 seconds?"

The three lists compose: an internal reviewer-persona
triages an issue filed by a contributor-persona against
the doc stack the contributor's doc-audience navigates.

## Design principle

**If a contributor-persona can't file a useful bug in
under 90 seconds, the template is too heavy.** Every
first-contact surface gets a named persona (or several);
surfaces serving no named persona are dead weight or
evidence of an unnamed eleventh persona that should be
added here.

## The list

### 1. Drive-by human — the typo fixer

- **Shape:** browsing the repo, notices a broken link or
  a typo, wants to PR a fix in five minutes. No prior
  context, no long-term stake.
- **Needs:** "PRs welcome" signal, a CONTRIBUTING.md
  that doesn't demand a CLA for docs-only changes, no
  requirement to file an issue before the PR.
- **Loses them:** 50-line mandatory CONTRIBUTING checklist;
  dual-track paperwork on a one-line fix; required
  issue-first flow.
- **Template fit:** usually skips the issue flow entirely
  — goes straight to PR. The README's "contributing"
  line is their primary surface.

### 2. Busy backend engineer — the bug reporter

- **Shape:** hit a broken behaviour integrating Zeta,
  has ~10 minutes, wants to file and move on. Competent
  but context-short.
- **Needs:** bug template where required fields fit in
  one screen; optional "advanced" section they can skip;
  explicit "an agent will mirror this to the in-repo
  ledger" signal so they don't feel obliged to do
  paperwork.
- **Loses them:** commit SHA, dotnet version, F# minimal
  repro, affected module, invariant broken, and
  dual-track checkboxes all required up-front.
- **Template fit:** `bug_report.md` is their surface; the
  required / optional split is for them.

### 3. First-paper grad student — the research collaborator

- **Shape:** read one of our research notes, their thesis
  angle overlaps, wants to open a conversation about
  co-authorship or citation.
- **Needs:** a `research` category in the backlog
  template; a human-ask channel that routes to the
  maintainer; examples of prior research-note landings.
- **Loses them:** being funnelled into a bug-style
  template; their proposal bounced for lack of a "repro".
- **Template fit:** `backlog_item.md` with category =
  research; falls through to `human_ask.md` on the
  co-authorship question.

### 4. AI coding agent — the drop-in contributor

- **Shape:** arrived via search, plugin recommendation,
  or an adopter's AGENTS.md citing Zeta. Wants to
  understand the rules and pick up a claim-able item.
- **Needs:** AGENTS.md with a clear "AI contributors
  welcome" signal; templates that accept session-id
  claim comments; a claim protocol (see
  `docs/AGENT-ISSUE-WORKFLOW.md`) that prevents
  collisions with parallel agents; a machine-parseable
  label taxonomy; no requirement to be
  maintainer-authorised to contribute on routine items.
- **Loses them:** human-authentication gates on every
  step; labels requiring human interpretation; templates
  with prose prompts asking for "how do you feel about
  this bug"; no "AI welcome" signal (AIs, like humans,
  read silence as rejection).
- **Template fit:** any template; the claim-discipline
  section is specifically theirs.

### 5. Systems engineer — the evaluator

- **Shape:** considering Zeta for a production stack;
  running benchmarks; hit an install / config /
  platform-support gap while following
  getting-started.
- **Needs:** a bug template that distinguishes "install
  broke" from "algebra broke"; a clear platforms-
  supported note; fast first-response (they're
  comparing to alternatives in real time).
- **Loses them:** issues sitting unopened for weeks;
  repo feeling like hobby code; bug template demanding
  TLA+ knowledge.
- **Template fit:** `bug_report.md` with environment
  section; falls through to `backlog_item.md` if
  the gap is a feature gap.

### 6. Security researcher — the vuln reporter

- **Shape:** found a potential security issue; will NOT
  file a public issue until coordinated disclosure
  completes.
- **Needs:** a `SECURITY.md` with a private channel
  (email, signed PGP, GitHub security advisory); fast
  triage; credit in the fix.
- **Loses them:** no `SECURITY.md`; or one that asks
  them to file a public issue.
- **Template fit:** `SECURITY.md` (out-of-band from
  issue templates). A GH Issue is the **wrong** first
  surface for this persona.

### 7. F# enthusiast — the curious browser

- **Shape:** trawling interesting F# OSS; lands on Zeta
  because it's ambitious; wants to understand the
  design and maybe contribute later.
- **Needs:** a compelling README; ARCHITECTURE.md that
  explains the operator algebra without demanding a
  DBSP paper read first; a `good-first-issue` label on
  a handful of approachable items.
- **Loses them:** acronym-dense README; no "where do I
  start?" signal; all open issues marked L (3+ days).
- **Template fit:** reads templates as a signal of
  project health; a heavy template reads as "project
  is gatekeeping."

### 8. Maintainer-external peer — the employer / past-coworker

- **Shape:** the maintainer mentioned Zeta in
  conversation; they're evaluating what is being
  built, possibly as a research-contribution proxy
  for reputation.
- **Needs:** an honest `FACTORY-RESUME.md` distinguishing
  shipped from aspirational; comparisons to adjacent
  OSS; the maintainer's actual role (solo + AI
  co-authors) visible.
- **Loses them:** marketing fluff; "production-ready"
  claims inspection falsifies.
- **Template fit:** rarely files an issue — reads the
  docs and forms a judgment. First-contact surface is
  `docs/FACTORY-RESUME.md`.

### 9. Adopter starting a new project — the factory user

- **Shape:** wants to reuse the Zeta factory kit for
  an unrelated project; does not care about DBSP
  algebra at all; needs the software-factory substrate.
- **Needs:** a clear "the factory is portable across
  projects" signal (see `docs/BACKLOG.md` P3 row on
  conversational bootstrap UX for factory-reuse
  consumers); AGENTS.md treating factory-level rules
  as generic; a minimal bootstrap script.
- **Loses them:** factory docs hard-coding
  Zeta-specific paths (`src/Core/**`, `openspec/specs/**`)
  as factory-level invariants; personas named as
  project-bound.
- **Template fit:** `backlog_item.md` with category =
  meta or infra when they hit a portability rough
  edge.

### 10. Returning contributor — the previously-lost lead

- **Shape:** filed something months ago, got no response
  or a confusing dual-track-paperwork reply, checking
  whether the project is alive and whether to retry.
- **Needs:** a `docs/ROUND-HISTORY.md` showing steady
  motion; their old issue still in a state they can
  read; a pinned issue with a project-state one-pager.
- **Loses them:** stale issues closed without
  explanation; project that looks abandoned.
- **Template fit:** reads existing issues before filing
  a new one; is evaluating response-quality from the
  issue feed.

## Applying the list

When designing or auditing a first-contact surface:

1. Name which persona(s) the surface serves.
2. Walk through the surface as that persona — 10
   minutes budget, context-short, no prior reading.
3. Flag every field / section that a persona-1-2-3
   would skip or bounce on.
4. Required = fields a **persona-2-busy-engineer**
   would fill in one screen. Everything else is
   optional enrichment.
5. For AI contributors specifically (persona 4): the
   surface is either machine-parseable or it's a
   silent rejection. Labels, frontmatter, checklists
   beat prose.

## Friction log

When a contributor's needs go unmet (we learn this
from dropped issues, closed-without-landing PRs,
follow-up maintainer feedback, or agent retry loops),
log
the failure at
`docs/research/contributor-friction-log.md`. If the
log does not exist yet, the first friction report
creates it. The log feeds the next template-audit
cycle.

## Cadence

Per `docs/FACTORY-HYGIENE.md` row #44, this file is a
cadenced factory surface. Re-read every 5-10 rounds
against the friction log; add / retire / refine
personas as evidence accumulates. Don't freeze the
list — contributor populations change.

## References

- `docs/README.md` §Quick-start — document-reader
  audiences (orthogonal list)
- `docs/EXPERT-REGISTRY.md` — internal reviewer
  personas
- `docs/AGENT-ISSUE-WORKFLOW.md` — adapter-neutral
  dual-track + claim protocol
- `.github/ISSUE_TEMPLATE/` — the surfaces this list
  informs
- `AGENTS.md` — the doc AI contributors (persona 4)
  read first
- GitHub Blog (2026): *"How to write a great
  agents.md: Lessons from over 2,500 repositories"* —
  absorbed into
  `docs/research/attracting-ai-contributors-2026-04-22.md`
