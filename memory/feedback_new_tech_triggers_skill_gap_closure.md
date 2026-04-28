---
name: Matrix mode — factory absorbs whatever skill-GROUP it needs to run better; tech pull-in is one trigger, not the only one
description: 2026-04-20; Aaron explicit durable policy. "Matrix mode" = the factory absorbs new skills (as skill-groups: expert + teacher + auditor + capability) whenever they'd make the factory run better. Tech adoption (MCPs, plugins, libraries, runtimes, toolchains) is a *trigger* but not the only one — any gap that would make the factory run better is a valid trigger. Validate on every skill-tune-up round that no needed skill-group is missing. One skill is usually not enough; groups are first-class.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# New tech adoption triggers skill-gap-closure check

## Rule

**Pulling new technology into the factory is not "done" until
the factory has a matching skill-GROUP** — not a single
skill. Each tech gets a family/cluster of roles: the
**expert** (canonical use, anti-patterns, living BP list),
the **teacher** (explains the tech to new contributors /
agents), the **auditor** (reviews uses of the tech in PRs
and flags drift), plus any **capability skills** the expert
invokes. One atomic skill is usually not enough; tech is a
surface, and surfaces need multiple roles.

Every tech-onboarding event fires four obligations, in order:

1. **Scout for existing coverage.** Grep `.claude/skills/`
   and `.claude/agents/` for any mention of the tech, its
   aliases, and its category. Partial-coverage skill-groups
   get updated; zero-coverage tech gets a new group.
2. **Design the group.** Decide which of the role slots
   (expert / teacher / auditor / capability) the tech
   actually needs. Simple tech may only need an expert +
   auditor; complex tech may need all four plus a
   capability-skill fan-out. Consult Aaron on big shaping
   decisions (per
   `feedback_factory_reuse_packaging_decisions_consult_aaron.md`).
3. **Close the gap.** Route through `skill-creator`
   (GOVERNANCE.md §4) to author the group members. Each
   inherits the canonical-use + living-BP-list obligations
   from
   `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`.
4. **Validate factory-wide coverage.** On the same cadence
   as `skill-tune-up`, enumerate every tech the factory
   *actually uses* (imports, MCP registrations, CI tooling,
   proof tools, runtimes) and cross-reference against the
   skill directory. Any uncovered tech is a gap logged to
   `docs/BACKLOG.md` with a recommended skill-group
   author action.

## Aaron's verbatim statements (2026-04-20)

**Primary statement:**

> "oh i wonder why i never saw that before, you are welcome
> to use playwritght i did install the mcp and maybe plugin?
> anyways if you are gonna use playwrite which everyone says
> AIs are pretty darn good at, make sure we make all the
> approprate skill group updates to our factory for our new
> technolgy we don't want to be missing skill for
> technologies we use, we should validate we are not missing
> any and we close the skill gap whenever we pull in new
> tech"

**Refinement — it's a GROUP, not a single skill:**

> "the factory gets a group of skills the skills have the
> whole expert teacher and all that groups"

**Correction captured:** my first-pass framing treated each
tech as needing a single expert-skill. Aaron corrected: the
factory gets a *group* — expert + teacher + auditor + any
capability skills — per tech. One atomic expert-skill is a
useful seed but usually not enough. The group is the
first-class unit.

## Why:

- **Tech without a skill is tech without a custodian.** The
  factory design primitive is expert-skills-as-custodians —
  every tech area has an expert-skill that knows canonical
  use, anti-patterns, and a living BP list. An uncustodianed
  tech degrades: agents misuse it, anti-patterns accumulate,
  and by the time we notice the cost is already baked in.
- **Skill-gap-closure is cheaper at adoption time.** Writing
  the skill while the adoption is fresh (why we picked it,
  what we specifically need from it, what the alternatives
  were) is far cheaper than reconstructing that context
  months later when the skill-gap-finder spots the gap.
- **Validation catches invisible debt.** The cadence check
  ("do we have skills for every tech we use?") is the
  defence against silent over-adoption. Without it, the
  skill directory lags the tech directory and the factory
  is doing unsupervised work on unfamiliar surfaces.
- **Aligns with the three-file taxonomy
  (AGENTS/CLAUDE/MEMORY).** New tech pull-in is usually
  an AGENTS.md or DECISIONS/ event — authoritative,
  human-or-architect-blessed. The matching skill lives
  under `.claude/skills/` and is agent-authored through
  `skill-creator`. Both sides of the handshake are
  durable.
- **Zeta context: factory-reuse means portable skills.**
  Per `project_factory_reuse_beyond_zeta_constraint.md`,
  skills default to generic; a skill for Playwright should
  be usable in any project, not just Zeta. Gap-closure
  authored with `project: zeta` without reason pays
  reusability cost with no offset.
- **Cost of not doing it — observed today.** Playwright
  MCP was installed but had no skill; I was aware of
  Playwright abstractly but had no captured
  canonical-use or anti-pattern guidance; Aaron
  noticed the gap from the UI, not from any factory
  cadence check. That's a gap detected by luck, not by
  the factory. The policy is the cadence-check fix.

## How to apply:

- **On new MCP / plugin / tech pull-in:**
  1. Before or alongside the tech add, Grep
     `.claude/skills/*/SKILL.md` for any mention of the
     tech name, its aliases, and its category (e.g.
     "playwright", "browser", "e2e", "browser automation").
  2. If a covering skill exists: open it, check whether
     the new tech-specific use case fits; if not, route
     an update via `skill-creator`.
  3. If no covering skill: author via `skill-creator`
     workflow — draft → `prompt-protector` review →
     dry-run evals → commit.
  4. The new skill must declare generic-by-default
     (no `project: zeta` unless justified) and include
     the canonical-use + living-BP-list sections per
     `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`.
- **Cadenced audit (on every `skill-tune-up` invocation):**
  - Enumerate tech-in-use from these sources:
    - `.claude/settings.json` MCP registrations
    - repo `*.fsproj` / `*.csproj` `<PackageReference>`
      entries (excluding internal Zeta projects)
    - `tools/setup/` install-script dependencies
    - `.github/workflows/*.yml` action-uses + runtime
      requirements
    - proof-tool references in `docs/research/proof-tool-coverage.md`
  - For each, Grep `.claude/skills/*/SKILL.md` for
    coverage.
  - Log uncovered tech to `docs/BACKLOG.md` with
    recommended skill-author action + effort label.
- **What counts as coverage:**
  - A dedicated expert-skill (strongest) — e.g.,
    `.claude/skills/playwright/SKILL.md`.
  - A meaningful section in a broader skill — e.g.,
    an `e2e-testing` skill with a Playwright subsection.
  - Coverage by a generic skill (`skill-creator`,
    `skill-tune-up`) **does not** count — those are
    meta-skills, not tech-custodians.
- **What counts as a pull-in event:**
  - New MCP registration in `.claude/settings.json`.
  - New `<PackageReference>` to an external package.
  - New plugin install noted in `docs/ROUND-HISTORY.md`
    or `docs/TECH-RADAR.md`.
  - New proof tool or language-runtime upgrade in
    `tools/setup/` or an ADR under
    `docs/DECISIONS/`.
- **Exceptions:**
  - Transitive dependencies that the agent never touches
    directly (e.g. a transitive crypto-primitive) do
    not require a skill — only the direct touch-surface
    does.
  - Experimental / ephemeral tools under a stub-try
    ADR may defer the skill authoring by one round
    with an explicit `docs/BACKLOG.md` row; beyond
    that, the tech either gets a skill or gets
    rolled back.

## Sibling memories

- `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`
  — every expert-skill MUST name anti-patterns +
  keep a living BP artifact. This policy is the
  zeroth step (does the expert-skill even exist?)
  before that policy kicks in.
- `feedback_latest_version_on_new_tech_adoption_no_legacy_start.md`
  — on new tech, verify latest version, don't start
  on legacy. Adjacent step in the adoption checklist.
- `feedback_crank_to_11_on_new_tech_compile_time_bug_finding.md`
  — every ADR gets a "Crank-to-11 audit" for lint /
  static / compile-time coverage. This policy adds
  the skill-coverage audit alongside.
- `feedback_skill_edits_justification_log_and_tune_up_cadence.md`
  — skill-tune-up runs every round; the tech-coverage
  audit slots into the same cadence.
- `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  — this is a default-ON rule with named exceptions
  (transitive-only + stub-try one-round deferral).
- `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
  — consult on the big-shaping decisions: whether
  to split a tech-group skill vs. author separately.

## Immediate application

- **Playwright skill-group** — freshly pulled in (MCP +
  possibly plugin). No covering skills in
  `.claude/skills/` or `.claude/agents/`. Candidate group
  membership:
  - **`playwright-expert`** — canonical use, anti-patterns
    (flaky selector patterns, sleep-based waits, unbounded
    parallelism), living BP list, version-pinning
    guidance.
  - **`playwright-teacher`** — one-page entry point for
    contributors / agents new to Playwright; explains
    when to reach for it (UI E2E, scraping, screenshot
    diffs) vs. not (unit-level logic, headless curl
    scripts).
  - **`playwright-auditor`** — reviews Playwright usage
    in PRs; flags retries-as-reliability antipattern,
    hardcoded waits, brittle CSS selectors.
  - **Capability skills** (optional, emerge on demand):
    `playwright-selector-hygiene`,
    `playwright-trace-diff`.
  Route via `skill-creator` per GOVERNANCE.md §4.
  Logged to `docs/BACKLOG.md` as P1 for Round 44.
- **Factory-wide audit** — enumerate tech-in-use and
  diff against `.claude/skills/` + `.claude/agents/`.
  For each tech with no group, recommend a group
  scope. Logged as a Round 44 P1 speculative-work
  item per
  `feedback_never_idle_speculative_work_over_waiting.md`.

## Status as of 2026-04-20

- Policy confirmed durable.
- First application: Playwright skill-gap identified;
  factory-wide audit queued.
- Expected outcome: on every new-tech pull-in going
  forward, a skill-author or skill-update action is
  part of the adoption PR (or immediately-following
  round), not a deferrable tail.
