---
name: Aaron's 2026-04-23 external priority stack + internal/external ownership split + live-lock smell check on master cadence
description: Aaron's directive naming the current external-priority order (ServiceTitan+UI, Aurora, multi-algebra DB, cutting-edge persistence), the internal/external work ownership rule (Aaron owns external, agent owns internal/speculative), and the live-lock smell — cadenced audit of recent master commits for overwhelming-speculation as a factory-health signal.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# External priority stack + ownership split + live-lock smell

## Verbatim (2026-04-23)

> the service titan and having some sort of ui is still one of
> the higher prorities but also making changes to integrat
> auroa idea is up there too, and the multi algebra
> enhancements to our database, and the cutting edge
> persistance.  we should do a review of our database and come
> up with backlog items where we are lacking it's not cutting
> edge, we need more research etc....  speculative work is fine
> still too that is commpletely directly by you and your
> prooriteis, these are all external poriorites, you control
> the internal proroites of the software factory.  we just want
> to drive twards internal objects and exsternal objects and
> not overload with speculation, speclative changes a good and
> expected but they are just not the only know, if they are
> someting is wrong with our software factor, we should on some
> cadence look at like the last few things that went into
> master and make sure its not overwhelemginly speculative.
> thats a smell that our software factor is live locked.

## External priority stack (Aaron-set, ordered)

The order in the message is the priority order:

1. **ServiceTitan + some sort of UI.** The sample Program.fs
   demo (#141) is the algebraic kernel. The next step is an
   actual UI surface — web frontend, desktop, TUI, something
   interactable. Aaron works on the ServiceTitan CRM team, so
   CRM-shaped UI is the concrete target (contact list + detail
   + pipeline kanban + duplicate-review UX).
2. **Aurora integration.** Aurora Network = firefly-sync DAO
   protocol for scale-free networks; x402 economic agency +
   ERC-8004 reputation + this sync substrate = self-healing
   agent DAO. BACKLOG row exists; Aaron wants movement, not
   just memory.
3. **Multi-algebra enhancements to the database.** Semiring-
   parameterized Zeta (`project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`).
   Was speculative research; now on the external priority list.
4. **Cutting-edge persistence.** Paired with #3 as a database-
   capability axis. See the cutting-edge-gap BACKLOG directive
   below.

## Database review directive (explicit)

> we should do a review of our database and come up with
> backlog items where we are lacking it's not cutting edge, we
> need more research etc....

Apply: survey Zeta's current database surface against
cutting-edge database research (SIGMOD / VLDB / CIDR 2023-2026).
For each surface where Zeta is *not* cutting edge, file a
BACKLOG row with the gap, a candidate research anchor, and
an effort estimate. Not a one-shot — this becomes a periodic
cadence (suggested: once per minor round, or on request).

## Ownership split (new, load-bearing)

- **External priorities: Aaron owns.** The four-item list
  above is Aaron's. Agent does not unilaterally reorder them
  or replace them with internal priorities.
- **Internal priorities: agent owns.** Software-factory
  improvements (skill tune-ups, hygiene audits, cadence
  additions, memory landings, BACKLOG grooming, speculative
  research, persona-notebook work) are the agent's to
  prioritise and sequence.
- **Speculative work is welcome, not default.** *"speculative
  changes are good and expected but they are just not the
  only [thing]."* Speculation is a healthy fraction, not the
  whole output.

## The live-lock smell (new, periodic)

Aaron's diagnostic:

> on some cadence look at the last few things that went into
> master and make sure its not overwhelemginly speculative.
> thats a smell that our software factor is live locked.

**Mechanism:** A factory producing only process / research /
meta-factory / tick-history / BACKLOG-row work — without
external-observable product progress (src/ changes, sample
improvements, test landings, UI progress) — is *live-locked*:
every worker is busy, every tick fires, nothing external
moves.

**Detection (proposed, subject to Aaron's refinement):**
Classify each of the last N commits on `origin/main` into:

- **External** — changes under `src/`, `tests/`, `samples/`,
  `bench/`, or that ship a user-visible artifact.
- **Internal-factory** — skill tune-ups, persona notebooks,
  `docs/ROUND-HISTORY.md`, tick-history appends, CLAUDE.md /
  AGENTS.md / GOVERNANCE.md edits, hygiene scripts.
- **Speculative / research** — `docs/research/`, `docs/DECISIONS/`,
  BACKLOG rows, memory files *if* landed as explicit research
  or decision artifacts.

If `speculative / (external + internal-factory + speculative)
> ~0.6` over a rolling window (suggested: last 25 commits or
last round, whichever is shorter), that is the live-lock
smell firing.

**Response when the smell fires:** Pause speculative work.
Pick one external-priority item (from the four-stack above),
ship a narrow-scoped concrete increment — not research,
actual product motion. Then re-measure.

**This directive composes with, does not replace:**

- `memory/feedback_never_idle_speculative_work_over_waiting.md`
  — never-idle still holds; speculative is a valid non-idle
  mode. But live-lock smell now caps the *fraction*.
- `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`
  — outcome measurement still binds; live-lock ratio is a
  process-health metric, not a product-outcome metric.
- `memory/feedback_deletions_over_insertions_complexity_reduction_cyclomatic_proxy.md`
  — deletion wins can count toward external-observable if
  they measurably reduce complexity.

## How to apply

- **Every round-close (or before opening a significant new
  speculative arc):** run the live-lock audit on the last 25
  master commits. If ratio > 0.6, pause speculative and
  deliver one external-priority increment before resuming.
- **When picking next work autonomously:** weight external-
  priority items higher than internal/speculative when the
  recent-master ratio is already above 0.5. Do not let the
  "no-idle" rule get used as a justification to stack more
  speculation.
- **When Aaron asks for progress:** report against the
  external-priority stack in order. Internal/speculative work
  is supplementary context, not the headline.
- **When filing BACKLOG rows under the database-review
  directive:** cite a specific cutting-edge research anchor
  (paper + venue + year) per row. Not vague "we should".

## What this is NOT

- Not a directive to stop speculative work entirely.
- Not a claim the factory has been mis-spending time across
  its whole history — Aaron's framing is *when* the smell
  fires, not *that* it is always firing.
- Not a license to deprioritise the alignment-research arc
  (which is the project's research contribution; Aaron's
  "external" here means external-to-the-factory product
  surface, not external-to-Zeta's research mission).
- Not a license to reclassify work to dodge the smell.
  Honest classification is the whole mechanism; tweaking
  categories to pass the threshold is Goodhart's Law.
- Not a directive to count lines-of-code. The count is
  per-commit category, not size.

## Composes with

- `memory/project_aurora_network_dao_firefly_sync_dawnbringers.md`
  (Aurora item #2 in the stack)
- `memory/project_aurora_pitch_michael_best_x402_erc8004.md`
  (Aurora three-pillar framing)
- `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`
  (multi-algebra item #3)
- `memory/project_aaron_servicetitan_crm_team_role_demo_scope_narrowing_2026_04_22.md`
  (ServiceTitan scope context for item #1)
- `docs/BACKLOG.md` Aurora + semiring + ServiceTitan rows
