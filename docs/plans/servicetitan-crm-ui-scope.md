# ServiceTitan CRM demo with UI — scope & end-result

**Owner:** Aaron (scope), Claude (implementation drafts).
**Status:** Living document — Aaron edits over time, Claude keeps the plan in sync.
**Placed here because:** Aaron's 2026-04-23 request for a common place for scope / end-result where he can edit over time.

---

## What this demo is

**A software-factory demonstration.** The demo shows
ServiceTitan what happens when an AI-agent software factory
builds a CRM-shaped application: how fast it builds, how the
agents collaborate, how quality is enforced, how changes
compose.

**The backend is standard technology.** Postgres (or whatever
ServiceTitan considers boring and battle-tested). The demo
does not pitch a database migration. The database story is
phase-next; the factory story is phase-now.

**The audience is ServiceTitan engineering leadership.** Not
academics. Not DBSP enthusiasts. Not Aurora partners. People
evaluating whether the factory could accelerate their own
engineering org.

**Why the framing matters:** Aaron, 2026-04-23:

> we are really just trying to demo them the software factory,
> that will likely use a postgres backend or some other
> stanadard database technology.  The database still is a
> phase next kind of thing for service titan.

> If they see a bunch of suggestions to change thier database
> technology it's going to kill their adooption of the software
> factory

See `memory/feedback_servicetitan_demo_sells_software_factory_not_zeta_database_2026_04_23.md`
for the load-bearing directive.

**Why this demo matters:** Aaron works on ServiceTitan's CRM
team. Aaron's salary — earned by being useful to ServiceTitan
and advancing their goals — funds the rest of the factory. A
successful factory-adoption demo is the nearest-term external
deliverable that creates real professional value AND could
lead to deeper ServiceTitan partnership. The demo is not
"keeping the lights on"; it is a mutual-benefit artifact
(see `memory/project_aaron_funding_posture_servicetitan_salary_plus_other_sources_2026_04_23.md`).

**Composes with:**

- `memory/feedback_servicetitan_demo_sells_software_factory_not_zeta_database_2026_04_23.md`
  — **load-bearing positioning directive; read first**
- `memory/project_aaron_external_priority_stack_and_live_lock_smell_2026_04_23.md`
  (ServiceTitan+UI is priority #1 on the external stack)
- `memory/project_aaron_servicetitan_crm_team_role_demo_scope_narrowing_2026_04_22.md`
  (why CRM-shape specifically)

---

## Current state (as of 2026-04-23)

- **Algebraic kernel sample landed** as `samples/ServiceTitanCrm/Program.fs`
  (180 lines, single file, console output). **PR #141 open.**
  *Note:* this sample is internal-facing — it demonstrates the
  algebraic layer to factory agents and Zeta library users,
  not to ServiceTitan. The factory-facing demo is a separate
  artifact built on a standard DB backend.
- **Scenario tests landed** as `tests/Tests.FSharp/Operators/CrmScenarios.Tests.fs`,
  5 xUnit tests, all passing. **PR #143 open.**
- **No ServiceTitan-facing UI yet.** The factory-adoption
  demo has not started.

---

## End-result vision (Aaron-editable)

A browser-accessible CRM application that ServiceTitan
engineering leadership can click through in 15 minutes and
walk away thinking *"the factory built all of this in less
time than it would have taken our team to scope it."*

What a visitor should see:

1. **A working CRM app** — contact list / detail, pipeline
   kanban, duplicate-review. Looks professional. Feels like
   software that cost months of engineering. Runs on standard
   Postgres. Indistinguishable from the output of a small
   product team.
2. **Factory build-time narrative** — some form of "here's
   how this got built" story alongside the app. Could be a
   short recorded session showing the agents working, a
   commit-history walkthrough, or a side panel showing which
   agent authored which piece. The format is TBD with Aaron,
   but the *effect* is: "look how fast this moved and how
   quality was enforced."
3. **Quality-discipline evidence** — the demo surfaces the
   factory's built-in quality enforcement as a feature: "this
   code passes N specialist reviews before merge; Aaron
   doesn't babysit commits." Concrete surface: the
   `docs/AGENT-BEST-PRACTICES.md` rules that applied, the
   specialist reviewers that signed off, the formal tests
   that passed.
4. **Composable change demo** — an interactive moment where
   someone can say "now add X" and the factory visibly
   accepts the request and delivers. Even a canned version
   (scripted agents, pre-recorded) demonstrates the shape.

What a visitor does NOT need to see:

- Any mention of DBSP, retraction-native semantics, Z-sets, or
  delta algebra. These are the *internal* implementation
  layer; pitching them here confuses the factory story and
  risks triggering the database-migration alarm bells.
- Zeta-the-database marketing. The database is whatever's
  underneath — Postgres, pragmatic, boring.
- Delta-inspector panels, retraction visualisations, or other
  library-facing surfaces that would look like "we're trying
  to sell you a new database."

---

## Scope boundaries (what's IN, what's OUT)

### IN scope for "demo-complete"

- **Seed data** — ~20 customers, ~30 opportunities across 4
  stages, 2-3 intentional email duplicates. Deterministic,
  reproducible. Stored in Postgres (or similar).
- **CRM views** — customer roster, customer detail, pipeline
  kanban, duplicate-review, per-customer opportunity history.
  Standard CRM layout.
- **Editing UI** — add / edit customer, create opportunity,
  move opportunity stage, delete. Standard CRUD semantics at
  the UI layer.
- **Factory-build-time surface** — at least one visible
  artifact (video, commit walkthrough, sidebar, README
  narrative) that tells the "factory built this" story.
- **Quality-evidence surface** — factory's reviewer output
  visible alongside the code / app, so ServiceTitan sees the
  quality floor.
- **One-command launch** — `dotnet run --project <this>`
  + a docker-compose for Postgres, and the browser opens to
  a working demo.

### OUT of scope for v1

- **Any pitch for changing ServiceTitan's database.** Not
  explicit, not implicit, not in passing. The database is
  whatever they already use or Postgres — done.
- **Retraction-native / Z-set / DBSP language in the demo's
  user-facing surface.** Internal implementation may still
  use Zeta (*the factory chooses its own tools*), but the
  *user-facing demo* surface is standard CRUD.
- **Multi-user / concurrent editing.** Single-user session
  for v1.
- **Mobile UI.** Desktop browser only.
- **Production-grade auth, security, rate-limiting.**
- **Real ServiceTitan schema integration.** Plausible
  simplified shapes; no internal-data-leakage risk.

### TBD — Aaron's call

- **Frontend stack.** Candidates: Blazor (C#/.NET native),
  TypeScript + React (widest web stack). Aaron knows
  ServiceTitan's stack better — which matches best? A
  TypeScript + React demo sends a signal about breadth;
  Blazor sends a signal about .NET-stack fit.
- **Factory-narrative format.** Short Loom video of agents
  working? Commit-history walkthrough? Side-panel during the
  live demo? Bundle of all three? Aaron's call.
- **Backend DB selection.** Postgres is the safe default. SQL
  Server if ServiceTitan runs on .NET-stack. Aaron decides
  based on what ServiceTitan would accept without friction.
- **Sample size.** 20 customers + 30 opps is a starting
  point; larger samples (200+200) show pipeline analytics
  curves better.
- **Deployment target.** Localhost-only for now. If shareable
  with ServiceTitan coworkers, needs a cloud deployment —
  Azure, AWS, Fly.io.

---

## Proposed build sequence

Each step is a concrete, separately-shippable PR. Intent: no
step should take more than a day of focused work.

1. **`samples/ServiceTitanCrmUi/` skeleton** — project scaffold
   in the chosen frontend stack, references a standard DB
   driver (Npgsql for Postgres), compiles, serves a placeholder
   page. Sanity check.
2. **DB schema + seed data** — Postgres schema for customers +
   opportunities + related tables; deterministic seed.
3. **Customer list + detail** — interactive, CRUD against the
   DB. Clean CRM UX.
4. **Pipeline kanban** — drag card between stages, DB update.
5. **Duplicate-review pane** — list pairs with the same email;
   merge / correct actions.
6. **Per-customer opportunity history** — timeline view.
7. **Factory-build-time surface** — README + recorded
   walkthrough + optional side-panel.
8. **Polish + deployment story** — seed data tuning, README,
   one-command launch script, optional cloud deploy.

Aaron's corrections on the order or any step go directly in
this doc.

---

## Internal-only: the algebraic-substrate sample

`samples/ServiceTitanCrm/` (the 180-line console sample that
already landed) is the **internal-facing** algebraic-substrate
demo. It lives on for:

- Factory agents learning Zeta's retraction-native semantics
  in a CRM-shaped scenario.
- Zeta library users (when Zeta ships as a library) seeing a
  CRM-adjacent end-to-end example.
- Future phase-2 conversations with ServiceTitan *after*
  factory adoption, when the database-layer story can be
  pitched without threatening the factory story.

The factory-adoption demo (this doc's scope) is a *different
artifact* built on *standard DB technology*. Both exist. They
do not mix.

---

## Open questions for Aaron (please edit)

1. **Frontend stack** — Blazor / TypeScript+React / other?
2. **Backend DB** — Postgres / SQL Server / what matches
   ServiceTitan friction-free?
3. **Factory-narrative format** — Loom video / commit
   walkthrough / live side-panel / bundle? Who records /
   narrates?
4. **Target audience for the demo** — ServiceTitan engineering
   leadership specifically, or broader? Shapes polish level
   and format.
5. **Timing** — is this a week of work or a month? Scope
   follows.
6. **ServiceTitan-internal sensitivity** — are there schemas /
   naming conventions / flows that would land better / worse
   with ServiceTitan leadership? Or kept deliberately generic?

---

## Aaron's edits / deltas

*(Intentionally left empty for Aaron to append notes, edits,
scope corrections, or additional requirements. Claude keeps
everything above in sync with the latest Aaron-annotated state.)*
