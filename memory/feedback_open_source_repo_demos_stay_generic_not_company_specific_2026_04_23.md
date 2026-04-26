---
name: Zeta is an open-source repo — demos must stay GENERIC, not company-specific; ServiceTitan references stay out of repo history; demos are "why choose the software factory" artifacts show-able to anyone
description: Aaron's 2026-04-23 directive. The public Zeta repo is open-source and must not read as a ServiceTitan-specific project. Demos are reusable "why-choose-the-factory" pitches any company could adopt. Keep repo history ServiceTitan-free going forward. Company-specific context stays in per-user memory, not in-repo.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Demos stay generic. The repo stays open.

## Verbatim (2026-04-23)

> lets try to reduce the number of class and thing we call servce
> titan or this will be confusing in a Zeta repo.  Just call it
> like UI/factory demo or something, it semething that should be
> about to be demo to more than service titan too, these is
> basically the Why choose the software factory set of demos we
> can show to anyone that will make them want to adaopt the
> software factory.  In general even our demos should try to be
> generics and not spedific to a company so they can be resued.
> Also in general we want to limit the number of times we mention
> ServiceTitan in the repo history, this is not a service titan
> repo, it's an open source repo.  So lets make sure that stays
> obvious.  I split this out so it would not need specifics to
> service titan, i want something very generic any company or
> project could use.

## Rule

**Zeta is an open-source repo, not a ServiceTitan repo.** The
repo's identity is public, research-driven, and company-neutral.
Anything committed to the repo — file names, class names,
commit messages, doc prose, README framing — should read as
generic so *any* company or project could adopt the sample
code / demo / factory.

**Demos are "why choose the software factory" pitches.** The
audience is any company considering an AI-agent-built software
factory for their own engineering org. ServiceTitan happens to
be a near-term target for Aaron personally, but the repo's
demos must work for anyone.

**ServiceTitan context stays in per-user memory, not in-repo.**
The ServiceTitan-specific positioning (Aaron is on their CRM
team, they use C# with zero F#, the demo is about factory
adoption there) stays in
`~/.claude/projects/.../memory/project_aaron_servicetitan_*.md`.
That's visible to the agents during sessions but not part of
what gets committed to the public repo.

**"I split this out so it would not need specifics to service
titan."** Aaron has intentionally kept this repo decoupled from
ServiceTitan-internal work. The split is load-bearing — do
not collapse it by bleeding ServiceTitan names / assumptions /
schemas back into the repo.

## How to apply

### File and directory naming

- No `samples/ServiceTitan*/` directories. Rename to generic:
  `samples/FactoryDemo.Crm/`, `samples/FactoryDemo.Db/`,
  `samples/FactoryDemo.Api/`, `samples/FactoryDemo.Api.CSharp/`
  or similar umbrella scheme.
- No `ServiceTitanCrm`, `ServiceTitanFactoryDemo`,
  `ServiceTitanFactoryApi` in namespace / module / type
  declarations. Generic F# / C# names only.
- No ServiceTitan mentions in README / doc file names.
- Exception: referencing ServiceTitan is fine *as an example*
  ("e.g. a CRM like ServiceTitan's") in passing, at most once
  per document, and only when it genuinely aids the reader.
  Never as the subject.

### Commit-message shape

- New commit messages refer to "factory demo" or "CRM demo"
  or "the software factory" — not "ServiceTitan" or similar
  company names.
- When retro-fixing ST-named content (rename commits), the
  commit message may mention ST once to explain what is
  being renamed, but the outgoing state must be clean.
- Existing commits that mention ServiceTitan are historical —
  do not rewrite history just for terminology. The invariant
  is forward: future commits stay generic.

### Documentation prose

- `docs/plans/servicetitan-crm-ui-scope.md` should rename
  to `docs/plans/factory-demo-scope.md` (or similar).
- Inside the doc, ServiceTitan as the immediate audience can
  be acknowledged in a short framing note ("the nearest-term
  adoption target we have in mind is ServiceTitan, but the
  demo is built generic so any similar company can adopt").
  Otherwise write for "the adopting company" generically.
- READMEs, sample notes, build-sequence docs: remove
  ServiceTitan references unless genuinely load-bearing.

### Memory files

- **Agent memory** (`~/.claude/projects/.../memory/`) can and
  should keep the ServiceTitan-specific directives — that is
  where Aaron's private-context work lives. It's per-user,
  not shared.
- **In-repo `memory/*.md` files** — currently these mirror
  agent memories in a cross-substrate-readable form. This
  rule tightens that: in-repo memory stays company-neutral;
  per-user memory can be ST-specific. When an in-repo memory
  references ServiceTitan today, consider refactoring the
  in-repo version to generic framing with the ST details
  moving to per-user only.

## How to apply when ServiceTitan context IS relevant

Sometimes the reasoning legitimately depends on ServiceTitan
context (they use C#, zero F#, etc.). In those cases:

- Keep the reasoning in *per-user* memory where it is
  naturally private.
- Reference the reasoning in repo-local content only in
  generic form: "the immediate-target audience has a C#
  backend" rather than "ServiceTitan has a C# backend."
- Never let the repo-local content *require* ServiceTitan-
  knowledge to be useful. A reader cloning the repo cold
  should understand the demo on its own terms.

## What this is NOT

- Not a directive to remove every ServiceTitan mention from
  the repo retroactively — git history is history; don't
  rewrite.
- Not a directive to pretend ServiceTitan is not Aaron's
  immediate audience. Aaron is clear they are. The rule is
  about where that fact lives (per-user memory, not repo).
- Not a rule that every demo must be fictional-company. It
  is fine to demo against "a trades-contractor CRM" as a
  generic shape; it is not fine to name the company.
- Not a restriction on the Zeta research mission. The
  alignment-measurability research remains central; this
  rule is about surface-framing, not intellectual scope.
- Not a license to omit concrete details that help readers
  understand. Generic ≠ vague. "A trades-contractor CRM with
  contacts, opportunities, pipeline stages" is generic and
  concrete simultaneously.

## Composes with

- `memory/project_aaron_servicetitan_crm_team_role_demo_scope_narrowing_2026_04_22.md`
  (ST-specific context — stays in per-user memory, that's correct)
- `memory/feedback_servicetitan_demo_sells_software_factory_not_zeta_database_2026_04_23.md`
  (ST-demo framing — should have a generic-framing companion
  for in-repo consumption)
- `memory/project_zeta_f_sharp_reference_c_sharp_and_rust_future_servicetitan_uses_csharp_2026_04_23.md`
  (language-context — the ST-specific rationale stays here;
  the in-repo justification for the C# companion sample
  should cite "matches many audiences' existing stack" not
  "ServiceTitan uses C#")
- `README.md`, `AGENTS.md`, `GOVERNANCE.md` (the repo's
  public identity — should stay generic; currently compliant)
