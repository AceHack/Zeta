# Post-setup script stack — the decision flow before writing tooling

**Before writing a new `tools/**/*.{sh,ps1}` script, walk this
decision flow. Post-setup tooling defaults to bun + TypeScript
per `memory/project_ui_canonical_reference_bun_ts_backend_cutting_edge_asymmetry`
and `memory/project_bun_ts_post_setup_low_confidence_watchlist`.**

This doc is the author-time prevention layer for the hygiene
row *"post-setup script stack audit"* (FACTORY-HYGIENE row #46).
Hitting this rule before the script is written is cheap; fixing
it after the script has landed and accumulated callers is
expensive.

## The three-question decision flow

### Q1 — Is this a pre-setup script?

A pre-setup script is one that runs **before** the factory's
canonical tooling (bun, dotnet, etc.) is installed. It must
work on a bare developer machine or a fresh CI runner with
only the OS-default shell (bash on macOS / Linux, PowerShell
on Windows).

**If yes** — pre-setup lives under `tools/setup/` and MUST be
dual-authored as bash + PowerShell with zero prereqs per
`memory/feedback_preinstall_scripts_forced_shell_meet_developer_where_they_live`.
Do not write in bun / TypeScript / Python / any language that
requires an installer to run. **Stop here — you're done
deciding.**

**If no** — continue to Q2.

### Q2 — Is this a skill-bundled script?

A skill-bundled script lives inside
`.claude/skills/<skill-slug>/scripts/` and ships as part of
the portable skill unit. Its stack is declared in the skill's
`compatibility` frontmatter and travels with the skill when
the skill is copied to another project.

**If yes** — stack choice is owned by the skill author, not by
this doc. The skill's `compatibility` field should name any
runtime dep the script adds (bun, python, node, etc.). Keep in
mind that a heavier dep reduces the skill's portability.
**Stop here — follow the skill-authoring stack discipline.**

**If no** — it lives under `tools/` as a standalone
post-setup tool. Continue to Q3.

### Q3 — Does this belong in bash, or in bun + TypeScript?

Default: **bun + TypeScript**. Reasons:

- **Type-safety on structured data.** Most post-setup tooling
  parses structured formats (YAML frontmatter, JSON manifests,
  markdown tables). A typed parser beats an awk state machine
  for correctness and maintainability.
- **Unit-testable pure functions.** Bun's built-in test runner
  lets a tool's computational core be tested without forking
  processes, which is nearly impossible in bash.
- **Consistency across post-setup tooling.** Matches the
  canonical UI stack declared in
  `memory/project_ui_canonical_reference_bun_ts_backend_cutting_edge_asymmetry`.

**Exceptions — bash is acceptable when:**

*Transitional exceptions* (one bash version, migration pending):

- Bun tooling has not yet been installed in the repo at the
  time of writing — in which case the bash script is **explicit
  scaffolding**, lands with a comment block naming itself as a
  bun+TS migration candidate, and is queued in `docs/BACKLOG.md`.
- The sibling-migration guardrail prevents a one-off bun+TS
  script from being stranded in a sea of bash. If no other
  post-setup tool has migrated yet, bash is the honest default.

*Permanent exceptions* (dual-authoring obligation — see below):

- The script is a trivial `find | xargs | sort` pipeline with
  no parsing or state.
- The script is a thin wrapper over existing CLI tools (git,
  gh, dotnet) with no data transformation.
- **"Stay bash forever (recorded decision)"** — the intentionality-
  enforcement hygiene rule demands *a recorded decision*, not
  *migration*. If the reason "bun + TypeScript would buy nothing
  here" holds up on inspection AND the Windows-twin cost is
  acceptable, that is a valid answer. Per Aaron 2026-04-22:
  *"The intentionality-enforcement reframe doesn't demand
  migration; it demands a recorded decision. A 'this should
  stay bash forever' is a valid answer if the reason holds up."*
  See `memory/feedback_intentionality_doesnt_demand_migration_bash_forever_valid.md`.

**The Windows-twin obligation (2026-04-22 clarification from
Aaron):** any script under a *permanent* bash exception
(`trivial find-xargs pipeline`, `thin wrapper over existing
CLI`, or `stay bash forever`) MUST be dual-authored as a
`.sh` + `.ps1` pair. Zeta supports Windows as a first-class
developer platform; a bash-only script that "stays bash
forever" without a PowerShell twin silently breaks Windows
devs. This obligation applies only to permanent exceptions —
transitional exceptions (`bun+TS migration candidate`,
`bash scaffolding`) ship single-bash because the long-term
plan is one cross-platform bun+TS replacement.

**The cost-benefit consequence.** Once the Windows-twin cost is
visible, "stay bash forever" is usually MORE expensive than
migrating to bun+TS: you maintain two platform-specific
implementations forever vs. one cross-platform TypeScript
script. The fifth exception exists for the rare cases where
bun+TS genuinely cannot do the job (e.g., a script that MUST
run before bun is installed — but then it belongs in Q1 pre-
setup, not Q3 post-setup). Most "looks like a stay-bash
candidate" scripts flip to migration once dual-authoring is
priced in. See
`memory/feedback_stay_bash_forever_implies_powershell_twin_obligation.md`
for the 2026-04-22 reconsideration that made this rule
explicit.

**Exception label requirement.** A bash script under `tools/`
outside `tools/setup/` that falls under an exception MUST carry
a header comment block naming which exception applies and (for
migration candidates) the BACKLOG row queuing its bun+TS
rewrite. For permanent-bash exceptions the header must also
state the Windows-twin plan — either "PowerShell twin lives at
`<path>.ps1`" if one exists, or a BACKLOG row queuing its
authoring. Without a label, the script is a **violation**; a
permanent-bash label without a twin or twin-plan is a
**partial violation** and the hygiene audit flags it.

## Exempt paths (no author-time review needed)

The following paths are exempt from this decision flow:

- `tools/setup/**` — pre-setup by definition (bash + PowerShell).
- `.claude/skills/**/scripts/**` — skill-bundled (governed by
  skill compatibility rules, not this doc).
- `tools/_deprecated/**` — awaiting deletion; no new code.

Everything else under `tools/` is in-scope for the audit.

## The audit surface

Two audit scripts run the hygiene sweep:

- `tools/hygiene/audit-post-setup-script-stack.sh` — lists
  every bash / PowerShell script under `tools/` (excluding
  exempt paths), tags each as *allowlist-acknowledged* or
  *new-violation*, and prints a summary.
- `tools/hygiene/audit-missing-prevention-layers.sh` — the
  meta-hygiene audit that asks, for every row in
  `docs/FACTORY-HYGIENE.md`, whether a prevention layer
  exists or the row is justifiably detection-only.

## Baseline status (2026-04-22 — all-labelled, Windows-twin cost now visible)

First audit-fire at this doc's land surfaced 9 violations.
Per-file intentional-decision classification was applied
immediately in the follow-up tick (commit `952789c`). Later
the same day a brief flip of three scripts to "stay bash
forever" was reverted when Aaron surfaced the Windows-twin
obligation (Q3 section above) — the migration row is the
cheaper long-term path than maintaining two platform-specific
implementations. The audit now reports **exempt 12 / labelled
11 / violations 0** at the current baseline.

**"Thin wrapper over existing CLI" (permanent — Windows-twin
obligation applies):**

| Script | Reason | Windows-twin status |
|---|---|---|
| `tools/profile.sh` | Pure `dotnet tool install/update` + `dotnet-counters`/`trace`/`gcdump`/`dump` routing case statement. Wrapper shape is intrinsic. | **Missing.** The dual-authoring reconsideration queued in `docs/BACKLOG.md` — candidates: (a) write `tools/profile.ps1` twin, or (b) flip label to "bun+TS migration candidate" so one cross-platform script replaces both. Defer until a sibling post-setup bun+TS tool lands (sibling-migration guardrail). |

**"bun+TS migration candidate" (transitional — single-bash,
cross-platform via migration):**

| Script | BACKLOG row |
|---|---|
| `tools/audit-packages.sh` | "Migrate remaining bash audit scripts to bun + TypeScript (post-setup stack)" |
| `tools/lint/no-empty-dirs.sh` | same row |
| `tools/lint/safety-clause-audit.sh` | same row |
| `tools/alignment/audit_commit.sh` | same row (migrate as alignment-quartet group) |
| `tools/alignment/audit_personas.sh` | same row (group) |
| `tools/alignment/audit_skills.sh` | same row (group) |
| `tools/alignment/citations.sh` | same row (group) |
| `tools/skill-catalog/backfill_dv2_frontmatter.sh` | has dedicated row "Rewrite `tools/skill-catalog/backfill_dv2_frontmatter.sh` in bun + TypeScript (post-setup stack)"; cross-referenced from the consolidated row |

**"bash scaffolding" (transitional — self-referential;
hygiene tooling must exist before bun+TS tooling ships):**

| Script | Notes |
|---|---|
| `tools/hygiene/audit-post-setup-script-stack.sh` | Dog-fooding gap. Queued alongside backfill script. |
| `tools/hygiene/audit-missing-prevention-layers.sh` | Same. |

**Sibling-migration guardrail** from Q3 applies: no single
script from the "migration candidate" list migrates alone;
the four alignment audits migrate as one group, and the
migration as a whole waits for at least one
non-migration-candidate post-setup bun+TS tool to land
under `tools/**/*.ts` first.

**Stay-bash-forever status:** zero scripts currently. A brief
mid-day flip on 2026-04-22 assigned three scripts to this
category; all three reverted the same day once the Windows-
twin cost was priced in. The fifth exception remains available
for future use but is expected to be rare — most "looks like
stay-bash" scripts will flip to migration candidates once
dual-authoring is accounted for.

**Not yet visited:** `tools/alloy/`, `tools/invariant-substrates/`,
`tools/lean4/`, `tools/tla/`, `tools/Z3Verify/` subtrees
are currently empty of `*.sh` / `*.ps1` scripts in the
audit's `git ls-files` scan — if future scripts land
there, they enter the same decision flow.

## Why this doc exists

Aaron 2026-04-22 (paraphrased directive-chain): *"is this a pre
setup or post setup script ... if post setup backlog bun/ts"*
followed by *"now add someting that will try to prevent that
and and hygene it if it happens again"*. The first message
captured the stack rule; the second demanded both author-time
prevention AND cadenced hygiene so the factory stops
rediscovering the rule one script at a time.

## Reference patterns

- `memory/project_ui_canonical_reference_bun_ts_backend_cutting_edge_asymmetry`
  — canonical-stack declaration for UI + post-setup tooling.
- `memory/project_bun_ts_post_setup_low_confidence_watchlist`
  — the watchlist this doc promotes into active discipline.
- `memory/feedback_preinstall_scripts_forced_shell_meet_developer_where_they_live`
  — pre-setup discipline (bash + PowerShell zero-prereq).
- `memory/feedback_script_and_artifact_name_honesty_ensure_not_install`
  — companion discipline on script-name honesty.
- `docs/FACTORY-HYGIENE.md` row #46 (post-setup script stack
  audit) + row #47 (missing-prevention-layer meta-audit).
- `docs/BACKLOG.md` — row "Rewrite
  `tools/skill-catalog/backfill_dv2_frontmatter.sh` in
  bun + TypeScript" — the first concrete migration.
