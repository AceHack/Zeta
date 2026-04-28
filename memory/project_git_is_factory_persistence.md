---
name: Git is the factory's DEFAULT persistence and first plugin — pluggable architecture; alternatives (Jira, etc.) acceptable when a real use case demands them, never as default
description: 2026-04-20; Aaron explicit design principle. Git is the DEFAULT persistence and the factory's first/bootstrap plugin — BACKLOG is a text file, artifacts are markdown, index cards are files in the repo, no external dependencies needed for a simple project. BUT the factory is PLUGGABLE — some users will want Jira-backed backlogs, other ES tools, etc. Expansion rule: pull in extras only when "it makes sense and we have use cases that bring value." Do NOT propose external systems as defaults; do propose them as *plugins* behind real use cases with explicit user opt-in.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Git is the factory's default persistence + first plugin — pluggable by design

## Rule

The Zeta software factory's **default persistence layer is
git**, and git is the factory's **first / bootstrap plugin**.
Every factory artifact — BACKLOG rows, round history, ADRs,
research reports, notebooks, glossary, skills, personas,
specs — lives as text files in the repository by default.
External systems (Jira, Confluence, Miro, Linear, Notion,
dedicated workshop tools) are **not adopted as defaults**.

**But the factory is pluggable.** Some teams will want their
backlog in Jira; some will want an ES tool; some will want a
wiki. The factory's architecture must accommodate alternative
persistence backends when there is a real use case that brings
value.

When proposing any factory feature, UI, tooling, or workflow,
**the default answer is "can this be a text file in git?"**
External systems are acceptable additions **as plugins** when:

1. The git-native form has been considered.
2. A real use case exists (a real user, real team, real need —
   not hypothetical future-proofing).
3. The plugin is **opt-in**, not adopted as the default.
4. The factory still runs cheaply and self-contained on a
   dirt-simple project that installs no plugins.
5. The human maintainer has signed off on the expanded
   plugin surface as an ADR-worthy decision.

## Aaron's verbatim statements (2026-04-20)

### First statement — git-is-persistence

> "there may be exsting event storing tech we can adopt but
> only if it's really worth it, proabaly not since our
> artifats will be all git based the index cards and
> everyting, git is our persistance for the sotfware
> factory, this was an intentional design decison. It's
> very easy to just setup and run with no external
> dependencies or multiple sysstems for the human and AI to
> look through, that's why we are not using jira and just a
> text baseed backlog in git, everyting is self contained
> for this experiment, that is a great user experience and
> trying to keep things simple like that so the software
> factory can be used for any kind of project from the real
> simple to the super complex."

### Second statement — pluggability refinement

> "it does not have to be but i was thinking even for our
> deployments using the git static pages cause it's free,
> i'm trying to make the operational experince of whatever
> the factory produces cheap and easy and only pull in
> extra things tht really help or explictly are wanted to
> get into an an existing eco system so devs can use this
> factory for it. Like some pepople are gonna wnna plug in
> jira an not have the backlog in git, we need to be
> plugable but git is our first plugin and we expand when
> it makes sense and we have use cases that bring value."

Key substrings from both:

- *"git is our persistance for the sotfware factory"* —
  git is the default, the bootstrap, the always-present
  plugin.
- *"we need to be plugable but git is our first plugin"* —
  pluggability is the architecture; git is plugin number one.
- *"expand when it makes sense and we have use cases that
  bring value"* — expansion rule, burden-of-proof on the
  external plugin.
- *"some pepople are gonna wnna plug in jira"* — Jira is
  the canonical *pluggable alternative*, not the canonical
  *rejected alternative* (as the first statement alone
  suggested). Adjust the invariant accordingly.
- *"cheap and easy and only pull in extra things tht
  really help"* — operational-experience cost is the
  primary design driver.

## Why:

- **Zero setup tax by default** — a new project adopting
  the factory clones a repo and starts working. No account
  creation, no subscription, no sync-between-systems. This
  is what makes the factory usable for simple projects.
- **One place for the human and the agent to look** —
  every artifact has a file path. Agents grep. Humans
  grep. The same command works for both. This is
  load-bearing for AX cold-start and DX onboarding.
- **Vendor lock-in aversion** — external systems evolve on
  their own schedules, go end-of-life, change APIs, change
  pricing. Git as a substrate is a 20+-year commons with
  open implementations; it is effectively immortal for
  this decade. Pluggability preserves the escape hatch.
- **Audit-log by default** — every change to the default
  persistence is a commit. No separate audit-system for
  "who changed what." Retraction-native in the Zeta sense.
- **Provenance and review in the same substrate** — PR
  review, PR comments, ADRs, ROUND-HISTORY. The factory
  is self-documenting because the default substrate forces
  it.
- **Pluggability serves adoption** — "some people gonna
  wnna plug in jira" is real. If the factory refuses
  non-git persistence entirely, teams with existing
  ecosystems can't adopt it. Pluggability is what makes
  the factory-reuse constraint
  (`project_factory_reuse_beyond_zeta_constraint.md`)
  achievable at scale.
- **Consistent with existing factory invariants:**
  - `project_zero_human_code_all_content_agent_authored.md`
    — everything in the repo is agent-authored.
  - `project_factory_reuse_beyond_zeta_constraint.md` —
    factory is reusable; pluggability is one mechanism
    that makes reuse feasible for teams with installed
    ecosystems.
  - `feedback_newest_first_ordering.md` — git-native
    markdown files, newest-first.
  - `user_rbac_taxonomy_chain.md` — RBAC is GitOps.
  - `feedback_simple_security_until_proven_otherwise.md`
    — same "don't add complexity until forced" shape,
    at the persistence layer.

## How to apply:

- **When proposing any new factory feature:** lead with
  the git-native form. *"This could be a markdown file
  under `docs/<topic>/<name>.md`"* beats *"this could
  be a Notion page."* Git-native is the default
  recommendation, always.
- **When a consumer team asks for a non-git backend**
  (e.g. "we want Jira integration"): treat it as a
  **plugin** proposal. Scope the plugin, define its
  boundary, make it opt-in (not default), preserve the
  git-native path for teams that don't install the
  plugin. ADR the surface.
- **When Event Storming is adopted:** index cards,
  domain events, commands, aggregates, bounded contexts
  are markdown / text files by default; any visualization
  layer is generated *from* the git-native source.
  Pluggable alternative: an ES tool that reads the
  git-native markdown is fine; a tool that stores
  stickies in its own database is not the default, but
  can be a plugin.
- **When automated-ES UI is considered
  (`ES-automated-ui-001`):** default implementation is a
  git-native renderer (browser view over markdown
  stickies). External boards (Miro, EventModeler with
  proprietary storage) are plugin alternatives at best,
  not default.
- **When deployment of a factory UI is discussed:**
  (a) for library projects with no deployment pipeline,
  the UI is **local-only** — run in browser from disk,
  no deployed URL; (b) for product projects with their
  own deployment pipeline, the factory UI piggy-backs
  on that pipeline (goes out with the product's UI).
  GitHub Pages / static hosting is the cheap, free,
  default substrate where hosting is needed. See the
  sibling memory
  `project_factory_is_pluggable_deployment_piggybacks.md`.
- **When any external tool is seriously considered:**
  - State why git-native alone doesn't cover the use
    case (a real use case, not a theoretical one).
  - State the setup cost added to an adopting project.
  - State whether it's a plugin (opt-in) or a proposed
    default (requires strong justification).
  - Cite the human maintainer's sign-off.
  - Note the exit path — if the vendor disappears, how
    do consumers recover?
- **Exceptions that exist today** (not a complete list;
  audit candidates): GitHub itself (host for the git
  substrate — the substrate is the invariant, the host
  is not), CI runners (required to run the gate),
  Claude / Anthropic itself (the agent substrate — an
  unavoidable dependency for the experiment). Each of
  these is justified and visible; any new external
  must justify the same.

## What this invariant does NOT say

- It does NOT mean "never use external services." CI,
  hosting, the agent substrate itself are obviously
  external.
- It does NOT mean "refuse all non-git persistence." The
  factory is pluggable — teams with existing ecosystems
  (Jira, Linear, Confluence, etc.) are first-class
  consumers, served via plugins behind opt-in flags.
- It does NOT mean "never render UI." A UI that reads
  git and renders nicely (e.g. a generated HTML static
  site, a browser-rendered board over markdown source)
  is fine — the *persistence* is git; the render is
  a derivative.
- It does NOT forbid experimenting with external tools
  in a research round. Research is research; adopting
  as factory default is a different bar than adopting
  as a plugin.

## Related memories

- `project_factory_is_pluggable_deployment_piggybacks.md`
  — the sibling memory on pluggability-as-architecture
  and the deployment piggy-back model for factory UI.
- `project_factory_reuse_beyond_zeta_constraint.md` —
  the load-bearing factory-vs-Zeta separation. Pluggable
  persistence + git-as-default is one mechanism that
  makes factory-reuse feasible across any project size
  and any installed ecosystem.
- `project_zero_human_code_all_content_agent_authored.md`
  — sibling invariant: what's in the repo is agent-
  authored. This memory says: what's in the repo *is*
  the factory, by default.
- `feedback_simple_security_until_proven_otherwise.md`
  — same pattern applied to security.
- `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
  — changes to the persistence layer touch the
  packaging story; consult Aaron.
- `project_factory_conversational_bootstrap_two_persona_ux.md`
  — the UX for factory onboarding; the conversation is
  the input, git (by default) is the output.

## Implication for Event Storming adoption (Round 44)

The `docs/research/event-storming-evaluation.md` research
noted automated-ES as a "one hell of a UI" opportunity.
This invariant adds the constraint: **the default UI is a
render over git-native stickies, not a Miro-style external
board**. The sticky-note metaphor maps onto:

- Domain event = a markdown row in a bounded-context's
  event log file (e.g. `docs/contexts/<ctx>/events.md`).
- Command = a row in the commands file.
- Aggregate = a named file that owns its invariants.
- Bounded context = a directory under `docs/contexts/`.

An automated UI (browser-rendered sticky timeline)
reads these files and displays the board. When chat
emits a new event, the factory writes the markdown row,
git-commits it, and the UI re-renders. Default
persistence remains git; the board is a *view*.

This is also the answer to "should we adopt EventModeler
or similar?" — as a plugin alternative, only if the tool
reads git-native source and the team has a real use case
for it. Tools that require proprietary storage are not
the default; they can be plugins with their own ADR and
opt-in adoption path, not auto-adopted.
