---
name: Factory is pluggable (git is first plugin); factory-UI deployment model — local-only for library projects, piggy-back on product pipeline for deployed projects
description: 2026-04-20; Aaron: "we need to be plugable but git is our first plugin and we expand when it makes sense and we have use cases that bring value ... for library projects where would the UI run? we could have a local UI for the factory that makes sense but not a deployed one. For project that use the factory that have deployment pipelines like Zeta will then the factory UI can reuse whatever UI deployment pipline Zeta uses and piggy back." Pluggability is the factory architecture. Deployment model: local-only for library projects (no deployed URL); piggy-back on product's UI deployment pipeline for product projects; GitHub Pages is the free default static-hosting substrate when hosting is needed.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Pluggable factory + deployment piggy-back model

## Rule

### Pluggability

The factory is a **pluggable architecture**. Git (+ markdown
artifacts + GitHub) is the **first / bootstrap plugin** — the
default persistence, backlog, index-card store, skill store,
and round-history log. Other plugins (alternative persistence
backends, alternative issue trackers, alternative ES tools,
alternative observability stacks) are welcome when there is a
real use case that brings value.

- **Git is always installed.** It's the bootstrap plugin, not
  a replaceable component. Everything else composes against
  git-native artifacts.
- **Other plugins are opt-in.** Teams that install no plugins
  get the git-native default. Teams that install plugins get
  the alternative, with the git-native path still intact as
  fallback / migration path.
- **Expansion criterion**: *"expand when it makes sense and
  we have use cases that bring value"* — real consumer demand,
  not speculative future-proofing.

### Factory-UI deployment

Not every project that adopts the factory can deploy a
factory-UI to a URL — a **library project** has no deployment
pipeline at all. The deployment model therefore has two
shapes:

- **Library projects (no product-deployment pipeline)** —
  the factory UI is **local-only**. Runs in the developer's
  browser, reads the local git repo, no deployed URL. The
  factory does not create its own deployment infrastructure
  just to host its own UI.
- **Product projects (own deployment pipeline)** — the
  factory UI **piggy-backs** on the product's existing UI
  deployment pipeline. The factory UI "goes out with the
  product UI of the system it's building." For Zeta (which
  is a library, so this is hypothetical for Zeta itself; but
  for any product-project consumer of the factory) the
  factory UI deploys alongside the product's normal
  release flow.
- **When standalone hosting is genuinely needed** — the free
  default is **GitHub Pages** (static hosting, zero dollars,
  commits-trigger-redeploy). Any non-free hosting is a
  plugin-grade decision per the cost-ordering rule
  (`feedback_free_beats_cheap_beats_expensive.md`).

## Aaron's verbatim statement (2026-04-20)

> "it does not have to be but i was thinking even for our
> deployments using the git static pages cause it's free,
> i'm trying to make the operational experince of whatever
> the factory produces cheap and easy and only pull in
> extra things tht really help or explictly are wanted to
> get into an an existing eco system so devs can use this
> factory for it. Like some pepople are gonna wnna plug in
> jira an not have the backlog in git, we need to be
> plugable but git is our first plugin and we expand when
> it makes sense and we have use cases that bring value.
> Also i don't know how we will have a factory UI that is
> actualy deployed like to some url, for library projects
> where would the UI run? we could have a loca UI for the
> factory that makes sense but not a deployed one. For
> project that use the factory that have deployment
> pipelines like Zeta will then the factory UI can reuse
> whatever UI deployment pipline Zeta uses and piggy back,
> so the factory UI goes out with the product UI of the
> system it's building. Not every project will have a UI
> deployment though so we have to think about it. such UI
> must be git-native, not a Miro-style external service."

Key substrings:

- *"we need to be plugable"* — pluggability is the
  architecture.
- *"git is our first plugin"* — git is the default,
  not the only.
- *"expand when it makes sense and we have use cases
  that bring value"* — expansion rule.
- *"some pepople are gonna wnna plug in jira"* —
  concrete pluggable-alternative example.
- *"cheap and easy ... only pull in extra things tht
  really help"* — minimal-install ethos.
- *"for library projects where would the UI run? ...
  local UI for the factory that makes sense but not a
  deployed one"* — deployment model for library
  projects.
- *"for project ... that have deployment pipelines ...
  then the factory UI can reuse whatever UI deployment
  pipline Zeta uses and piggy back"* — piggy-back
  model for product projects.
- *"such UI must be git-native, not a Miro-style
  external service"* — confirms the git-native
  invariant for UI even within the pluggable frame.

## Why:

- **Real consumer reality is pluralistic.** Teams come
  with installed ecosystems — Jira, Linear, Confluence,
  specific ES tooling, specific CI runners. A factory
  that refuses all of that is not adoptable by those
  teams. Pluggability is what makes the factory-reuse
  constraint
  (`project_factory_reuse_beyond_zeta_constraint.md`)
  achievable at industrial scale.
- **Default simplicity is load-bearing.** A new solo
  developer adopting the factory should not have to
  install any plugins, configure any accounts, or pay
  any vendor. Git + GitHub + markdown covers the
  default case completely.
- **No deployment infrastructure for its own sake.**
  Spinning up a dedicated factory-UI deployment
  pipeline (its own domain, its own hosting, its own
  SSL, its own auth) for every project that adopts
  the factory is exactly the "setup tax" the
  git-native invariant
  (`project_git_is_factory_persistence.md`) is
  designed to avoid. Library projects get a local UI;
  product projects reuse their own pipeline.
- **Piggy-back aligns incentives.** If the factory-UI
  ships with the product-UI, it is updated on the same
  cadence, tested on the same gate, deployed by the
  same team. No separate operational surface to
  maintain.
- **Free substrate first.** GitHub Pages for static
  hosting is free; it's the default for cases where a
  standalone deployment is needed. Paid infra is a
  plugin, not a default. See
  `feedback_free_beats_cheap_beats_expensive.md`.

## How to apply:

- **When proposing a factory feature that needs
  storage** (backlog, index cards, ES stickies, round
  history, anything): design the git-native
  implementation first. Then, if pluggability matters
  for this feature (e.g. teams with installed Jira
  want their backlog there), design the plugin
  interface such that the git-native path is the
  fallback and the plugin is opt-in.
- **When proposing a factory-UI feature:** specify
  which deployment mode — local-only (library
  projects) or piggy-back (product projects). Never
  propose a dedicated factory-UI deployment pipeline
  that the factory itself owns.
- **When evaluating an external tool for factory
  integration:** frame it as a **plugin**. State
  whether it replaces a git-native default or augments
  it. State the opt-in mechanism. State the real use
  case. ADR the addition; do not auto-adopt.
- **When the question "where does the factory UI
  live?" arises:** default answer is "locally, in the
  developer's browser, reading the local git repo."
  Escalate to piggy-back only if the adopting project
  has its own UI deployment pipeline and wants the
  factory UI co-deployed.
- **When designing ES-automated-ui-001 and similar UI
  BACKLOG items:** explicitly note "local-first; if a
  deployed variant is ever needed, piggy-back on the
  consumer project's UI pipeline or use GitHub Pages.
  No dedicated factory-UI deployment surface."

## What this invariant does NOT say

- It does NOT mean "only git persistence forever" —
  pluggable alternatives are first-class, just
  opt-in.
- It does NOT mean "the factory must never deploy
  anything" — GitHub Pages for docs rendering, a
  piggy-backed UI for product projects, are fine.
- It does NOT mean "users must know git" — the UX
  (conversational bootstrap) abstracts git from the
  user; the *factory artifacts* are git-native, which
  is different from requiring the user to use git
  manually.
- It does NOT make library-project deployment
  impossible — if a library project wants a hosted
  factory UI, GitHub Pages is available at no cost;
  it's just not the default.

## Related memories

- `project_git_is_factory_persistence.md` — the
  sibling invariant, with the pluggability framing
  refreshed in light of this memory.
- `feedback_free_beats_cheap_beats_expensive.md` —
  the cost-ordering that informs plugin-vs-default
  decisions.
- `project_factory_reuse_beyond_zeta_constraint.md`
  — pluggability is a load-bearing mechanism for
  factory reuse across projects with installed
  ecosystems.
- `project_factory_conversational_bootstrap_two_persona_ux.md`
  — UX layer over the pluggable persistence; the
  conversation abstracts the backend.
- `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
  — plugin-boundary decisions are packaging
  decisions; consult Aaron on big shaping moves.
