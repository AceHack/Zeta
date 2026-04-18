# The Zeta.Core Software Factory

This document names what kind of project `dbsp` actually is. The
primary deliverable — `src/Core`, an incremental-view-maintenance
library built on the DBSP algebra — is only half of what lives in
this repository. The other half is the **factory that builds it**:
a deliberately-engineered ecosystem of AI agents, capability skills,
documented procedures, formal-verification tooling, and review
gates, designed to be read, diffed, and improved with the same
care as the production code.

We call this an **agent-driven software factory** — "software
defined software factory" in shorthand. Read it the way you would
read *software-defined networking*: the factory's configuration,
participants, and workflow are all code-shaped artefacts under
version control, not implicit habits or undocumented tooling.

## What "software factory" has meant, historically

The term has a long lineage. Microsoft's Software Factories
initiative and Greenfield & Short's 2004 book (*Software Factories:
Assembling Applications with Patterns, Models, Frameworks, and
Tools*) argued that software production scales through *product
lines* — reusable domain-specific languages, templates, and
generators that assemble family members of a product from a
common core. Czarnecki & Eisenecker's *Generative Programming*
(2000) and the FAST method ("Family-oriented Abstraction,
Specification, and Translation") from Bell Labs live in the
same tradition. The factory, in all three, is a **DSL-and-code-
generator** affair: you describe the variation points, and the
factory emits concrete artefacts.

This repo borrows the *attitude* of that tradition — treat the
production machinery as a first-class product — but the machinery
is fundamentally different. Our "generators" are AI agents
equipped with capability skills, reading procedural specs, and
checked by formal verification. There is no DSL that compiles to
code. There are contracts that constrain how agents and humans
collaborate on code.

## What the factory is made of

The factory has seven kinds of parts, each with its own location
and lifecycle rules.

**Experts** (22 of them, listed in `docs/EXPERT-REGISTRY.md`)
are persona-carrying agents. Each has a name (Kenji the Architect,
Zara the Storage Specialist, Soraya for formal-verification
routing, and nineteen more), a declared tone contract, and a
specific surface of the product they protect. The names are drawn
from many linguistic traditions on purpose — a roster that reads
as a team rather than a single author's projection. Experts are
treated with agency; we say "agents, not bots" and mean it.

**Capability skills** live in `.claude/skills/<name>/SKILL.md`.
These are procedure-only — how to do a thing, with no persona.
An expert agent file in `.claude/agents/<name>.md` carries the
persona and auto-injects the skills it needs. This split is the
factory's cleanest internal interface: tone lives on the agent,
mechanics live on the skill, and the two can evolve independently.

**Notebooks** in `memory/persona/*.md` are per-skill running
memory. They are ASCII, git-diffable, capped at 3000 words, and
pruned every third invocation. A notebook is a conscious trust
grant: the longer it gets, the more it acts as an effective
system prompt, so we keep it small, visible, and auditable.

**The best-practices system** is a two-tier doc. Stable rules
(BP-01 through BP-15 today) live in `docs/AGENT-BEST-PRACTICES.md`
and cover description-field hygiene, negative scope, tone
contracts, notebook caps, Unicode linting, and sub-agent
re-sanitisation. Volatile findings (this week's search results,
new tooling notes) go to `memory/persona/best-practices-scratch.md`
and are pruned every ~3 rounds. Promotion from scratchpad to
stable is an Architect decision with an ADR.

**Governance documents** carry the rest of the state: the bug
log (`docs/BUGS.md`), the tech-debt log (`docs/DEBT.md`), the
round history (`docs/ROUND-HISTORY.md`) — the only doc in the
repo written as historical narrative — architectural decisions
(`docs/DECISIONS/`), the backlog (`docs/BACKLOG.md`), the
tech radar (`docs/TECH-RADAR.md`), and the glossary
(`docs/GLOSSARY.md`). Everywhere except `ROUND-HISTORY.md` and
the ADRs, documents are edited in place and read as current
state.

**Behavioural specs** live under `openspec/`. **Formal specs**
cover a portfolio of oracles — TLA+ for concurrent protocols,
Z3 for pointwise algebraic axioms, Alloy for structural
invariants, FsCheck for property-based testing, Stryker for
mutation testing, Semgrep and CodeQL for static analysis.
Soraya owns the routing question: given a new property, which
tool is the right fit? The portfolio metric (which properties
are covered by which oracle) is her responsibility.

**The integration gate** is the Architect (Kenji). Specialist
experts are advisory; Kenji integrates and code-reviews.
Deadlocks escalate to a human. The round table is explicitly
equal between humans and agents — "this matters to me" is a
legitimate position from either side.

## How the factory is different from a 2004-era software factory

Four differences are load-bearing.

1. **The artefacts the factory produces are hand-coded, not
   generated.** The DSL lineage assumes the factory emits code
   from a spec. Our factory emits review, verification, and
   collaboration workflows. Production F# is written by humans
   and AI agents working together, not lifted from a template.

2. **The factory itself is the primary research target.** Each
   round improves the factory as deliberately as `Zeta.Core`
   itself. The factory is versioned, reviewed, and regression-
   tested alongside the product.

3. **Tone and authority are explicit contracts.** Each expert
   declares a tone (zero-empathy / empathetic / advisory / binding).
   This is a response to a measured problem: persona drift is
   real and measurable across long dialogues. The factory treats
   tone the way a typed language treats types — declared at the
   boundary, enforced at the call site.

4. **Prompt-injection defence is part of the factory.** The
   Prompt Protector (Nadia) is a named role with a Semgrep
   ruleset, an invisible-Unicode lint, and a documented
   sub-agent re-sanitisation discipline. Known adversarial
   corpora are explicitly blocklisted. A 2004 factory had no
   such concept because its generators weren't prompt-driven.

## Where this sits relative to current industry work

Anthropic's Claude Code (with Agent Skills and custom sub-agents),
OpenAI's Agents SDK, Microsoft's Semantic Kernel multi-agent
orchestration, and the open-source LangGraph / CrewAI / AutoGen /
MetaGPT / OpenDevin cluster all publish pieces of what a factory
like this needs: skill definitions, sub-agent spawning, tool
protocols (MCP is the closest thing to a standard), memory stores.
None publishes a fully-worked convention for *the repo as the
factory* — glossary, best-practices tiers, expert registry with
named personas, round history, formal-verification portfolio,
and agent review gates, all as first-class git artefacts. In
several places this repo is deliberately ahead of any codified
standard; the conventions here are our own work, documented so
that other projects can copy what's useful and reject what isn't.

## How to contribute to the factory

Adding, editing, or retiring an expert or skill follows the
canonical `skill-creator` path. Changing a best-practice rule
means opening an ADR in `docs/DECISIONS/`. Proposing a new
formal oracle goes through Soraya. Everything else is a normal
pull request reviewed by Kenji with the relevant experts
consulted. The factory is open for improvement — and every
change to it is reviewed with the same rigour as a change to
`src/Core/`, because that is the point.
