---
name: Greenfield until deployed; deployment is the backcompat target; non-greenfield learning mode allows breaks at DORA cost; full backcompat lock-in after learning mode ends
description: Aaron 2026-04-23 framing. Three phases. (1) Greenfield — breaking changes fine; no backcompat requirements; the current state. (2) Non-greenfield learning mode — deployment exists; breaks still acceptable as we learn; each break hits DORA metrics visibly to outside observers. (3) Full non-greenfield — breaks require exercise-or-impossible coordination between deployment + producers + consumers + UI; project becomes much harder. The deployment itself defines the backcompat targets. Keep all three phases in mind as work progresses.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Three phases: greenfield → learning mode → full backcompat

## Verbatim (2026-04-23)

> until we have a real deployed infrastructure for this
> project with 0 down time requirement, we are greenfields
> breaks changes don't need to be handled a carefully we
> have not backward compabiliy requirments, a deployment
> becomes our backward compability target and help define
> those targets once we have one and then we are no longer
> greenfield we have to support backwards compabiity and
> have to be carful not to do breaking changes in a way
> that would require exxecice or impossible instant
> corrodination between our deployment and producers and
> consumers and the ui and all that, it becomes a lot
> harder project after no greefield. Also in the beginning
> we will be in a non-greenfield learning mode where
> breaking changes are still acceptable as we learning even
> tough we have deployed infrastruct, we will be allowed to
> break it but that messes up DORA metrics everytime we do
> it for proof of update to the outside world for
> verification. Just keep all these things in mind as you
> progress.

## The three phases

### Phase 1 — Greenfield (current state)

- **No deployed infrastructure** with zero-downtime
  requirement.
- **No backcompat obligations.**
- **Breaking changes are fine** — rename, restructure,
  repurpose, refactor at will.
- **No producer / consumer / UI coordination needed** —
  there are no external producers / consumers / UIs yet.
- Current work benefits from this — the 5 Overlay A
  migrations, the soulfile reframe, the AutoDream policy,
  the tech-inventory doc, all land without backcompat
  constraints.

### Phase 2 — Non-greenfield learning mode

- **Deployment exists** but we're still learning.
- **Breaking changes still acceptable** as learning-phase
  adjustments.
- **Each break hits DORA metrics** visibly (change failure
  rate spike, MTTR spike, deployment frequency variance).
  These hits are observable to outside-world verification
  audiences per Aaron's *"proof of update"* framing.
- **Trade-off is explicit**: learn-fast costs DORA score;
  defer-learn preserves DORA score but may miss the
  discipline improvements.

### Phase 3 — Full non-greenfield

- **Breaking changes require coordination** between:
  - The deployment itself
  - External producers
  - External consumers
  - The UI
  - (and any other deployed-dependent surface)
- **"Exercise or impossible"** instant coordination —
  breaks demand orchestrated migrations across distinct
  parties that may not be under our control.
- **Project becomes much harder** — Aaron's explicit
  framing. Breaking-change cost goes from "free" to
  "expensive-or-infeasible."
- **The deployment defines the backcompat target** —
  what's deployed IS the contract.

## Transition criteria

Phase 1 → Phase 2: first real deployed infrastructure with
zero-downtime requirement goes live. Aaron's framing:
*"a deployment becomes our backward compability target."*

Phase 2 → Phase 3: learning mode ends. No explicit
trigger named; likely "we stop feeling we're learning"
or an external party (ServiceTitan? LFG public adopter?)
depends on the deployment in a way that makes further
breaks materially costly.

### Demos do NOT count (Aaron 2026-04-23 clarification)

> Demos do not need to worry about backwards compability
> even with a deployed databse, they are demos not our
> real infrastructure and would not trigger a
> non-greenfield transistion in this project.

**The factory's demo deployments are Phase-1-forever.**
ServiceTitan demo, FactoryDemo, CrmKernel, sample apps
with Postgres backends — all stay under greenfield
permission even when they have deployed infrastructure.

Reason: demos exist to demonstrate the factory; they are
not the factory's real deployed infrastructure. Breaking
a demo costs at most the demo's audience-of-the-moment;
real-infra breakage costs deployed-consumer coordination
across parties not under the factory's control.

**Distinguishing demo from real infra:**

- **Demo**: content-bearing surface intended to teach /
  sell / illustrate; audience consumes it as example,
  not as dependency. Sample apps under `samples/`,
  FactoryDemo, ServiceTitan-facing demos.
- **Real infra**: third parties have built dependencies
  against it; breaking it imposes coordination / migration
  cost on them. TBD when this lands for Zeta.

Corollary — **"Zeta the database" as a published library**
is closer to real infra than demos once adopted by
consumers. The Zeta-as-database migration-feature
thinking-out-loud memory
(`project_zeta_first_class_migrations_sql_linq_extension_post_greenfield_db_idea_2026_04_23.md`)
becomes load-bearing when Zeta-as-database has external
consumers, not when demos use Zeta.

## How to apply

### Current (Phase 1) posture

- **Break freely when it improves the factory.** Renames,
  restructures, ADR-gated retirements, directory moves
  all land without deprecation-cycle overhead.
- **Do not pre-engineer backcompat surfaces** for clients
  that don't exist yet. No deprecation aliases, no
  versioned API shims, no schema-migration runners.
- **Keep signal-preservation discipline** — breaking
  changes leave supersede markers / retired-rule notes /
  git-log paper trail. Not "no-trace destruction" — just
  "no-backcompat-contract obligation."
- **Record anticipated backcompat targets** as they
  crystallise — `docs/DECISIONS/` ADRs that flag "this
  will become a backcompat target when we ship" give
  Phase 2 a clean handoff.

### Phase-transition preparation

- **Before first deployment**: assemble the "Phase 2
  contracts" — every public API, wire format, schema,
  UI surface enumerated + declared as backcompat-bearing
  from deployment day.
- **Document the deployment's shape** — what does zero-
  downtime mean for each surface? What does a "break"
  look like operationally?
- **Pre-register the DORA-tracking substrate** — the
  learning-mode breaks need to be measurably visible to
  outside observers. If DORA tracking isn't wired yet,
  the "proof of update" framing fails.

### Phase 2 posture (when we get there)

- **Breaking changes get an ADR** with:
  - What breaks
  - Why this is learning-mode-justified
  - DORA cost estimate (change failure rate impact,
    MTTR impact)
  - Deployment + migration plan
- **DORA metrics stay visible** to outside-world
  verification audiences.
- **Name the exit criterion** for each break — when does
  this stop being learning mode and start being expensive?

### Phase 3 posture (when we get there)

- **Breaking changes require coordination plan** covering
  deployment + producers + consumers + UI.
- **Prefer additive evolution** — new capabilities added,
  old stay for backcompat window.
- **Deprecation-then-removal** cycles with explicit
  sunset dates.
- **Contract tests** prevent accidental breaks.

## Composes with

### DORA metrics posture

The factory's factory-demo / why-the-factory-is-different
content cites DORA four-key as the primary quality proxy.
This memory names the cost side: breaking changes in
learning mode are PAID for in DORA metrics. The factory's
claim to DORA-at-or-better-than-human is preserved only if
breaking-change frequency is bounded.

### Reproducible-stability thesis

Per `docs/research/reproducible-stability-thesis-2026-04-22.md`
(round 44): stability IS the goal. Greenfield lets us
iterate toward stability; deployment locks stability in.
Breaking changes after deployment undo the lock-in unless
coordinated.

### External-contribution-ready branch-protection
(2026-04-23 delegation)

External contributors need predictable contracts. A
project that breaks frequently is hostile to external
contributors. Phase 3's backcompat lock-in is what makes
external-contribution-ready meaningful in the long run.

### Aaron's Itron SW+FW+HW-escrow background

Aaron's Itron-era work involved HW + SW escrow with
explicit cross-party contracts. He knows the cost of
deployed-infrastructure breakage first-hand. This framing
isn't abstract; it's the rule he applies to his own work.

## What this is NOT

- **Not a mandate to rush breaking changes now** — "break
  freely" ≠ "break for fun." Greenfield permission is for
  changes that improve the factory; capricious breaks are
  still noise.
- **Not a promise of deployment soon** — Aaron named the
  phases but didn't schedule Phase 1→2. ServiceTitan demo
  may be the first deployment; may not. Await his call.
- **Not a license to skip signal-preservation** —
  breaking changes still leave git-log + supersede markers
  + ADR trails. Greenfield ≠ no-paper-trail.
- **Not a license to ignore existing consumer
  commitments** — if a third party is already using
  something (as with Aaron's existing ferry/drop pattern),
  that micro-consumer has some claim even in greenfield.
  Scope: no *external* backcompat requirements means no
  backward-compat APIs for clients who don't exist; it
  doesn't mean coordination-free action within the
  factory.
- **Not a claim that DORA hits are free** — the cost is
  just deferred / narrower in greenfield (no outside
  observer yet). Once there's one, each hit is measurable.

## Composes with

- `docs/research/reproducible-stability-thesis-2026-04-22.md`
  (stability is the goal; greenfield → learning →
  full-backcompat is the path to it)
- `docs/plans/why-the-factory-is-different.md` (DORA
  metrics as primary quality proxy; this memory names
  the cost side of DORA)
- `feedback_branch_protection_settings_are_agent_call_external_contribution_ready_2026_04_23.md`
  (external-contribution-ready composes with Phase 3
  backcompat lock-in)
- `user_aaron_itron_pki_supply_chain_secure_boot_background.md`
  (Itron HW+SW+FW escrow experience calibrates the
  deployed-infrastructure cost of breaking changes)
- `project_multiple_projects_under_construction_and_lfg_soulfile_inheritance_2026_04_23.md`
  (each project-under-construction has its own phase
  trajectory; some may reach Phase 2/3 earlier than
  others)
