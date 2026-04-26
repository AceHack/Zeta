---
name: Prefer in-repo where possible — Aaron 2026-04-23 directive; generic rules migrate per-user → in-repo on next hygiene pass; factory discretion governs; composes with AutoDream cadenced consolidation
description: Aaron 2026-04-23 *"i prefere everyting possible lives in repo, but I'll leave it to your discretion, you own the factory"*. In-repo memory is the preferred home for factory-shaped rules (cross-substrate-readable, survives repo clone, open-source-visible). Per-user memory (~/.claude/projects/<slug>/memory/) is for maintainer-specific + company-specific content. Factory discretion governs what counts as generic vs specific; when in doubt, migrate and see. The migration pass is a natural fit for AutoDream cadenced hygiene (24h+5 sessions). Triggered by Aaron reviewing a diff where I had collapsed 4 per-user memory pointers into "per-user memory (not in-repo)" in docs/research/multi-repo-refactor-shapes-2026-04-23.md — his preference would have been to keep pointers if the content were in-repo.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Prefer in-repo memory where possible

## Verbatim (2026-04-23)

> i prefere everyting possible lives in repo, but I'll
> leave it to your discretion, you own the factory

## Context of the directive

Aaron was reading the diff for PR #150
(`docs/research/multi-repo-refactor-shapes-2026-04-23.md`)
where I had collapsed four dangling memory references —
rules that live in per-user memory but were cited by a
research doc being prepared for in-repo landing — into
a single parenthetical pointing at
`~/.claude/projects/<slug>/memory/`. The specific rules
affected:

- Factory-reuse packaging decisions require maintainer
  consultation
- Factory must be reusable beyond Zeta
- Open-source repo demos stay generic, not company-specific
- LFG is the demo-facing repo, AceHack is cost-cutting-internal

Two of those four are **generic factory discipline** (reuse
decisions; factory-beyond-Zeta constraint). Two are
**project-specific state** (LFG vs AceHack; open-source
demo posture — though the posture rule itself is generic
even though the motivating project context is specific).

Aaron's observation: if "everything possible" lives in
repo, the pointers in a research doc would resolve
cleanly because the target memory is in the same tree.

## Rule

### Default: in-repo

Factory-shaped rules — disciplines, patterns,
cross-substrate signals, design decisions, cadences —
belong in the in-repo `memory/` tree unless there is a
positive reason they should not.

Positive reasons to keep something in per-user:

1. **Maintainer-specific personal content.** Biographical
   details, calibration notes about individual
   communication style, family references. These are
   about a human, not the factory.
2. **Company-specific state.** Employer name, team,
   internal project names, compensation, NDA-scoped
   content. In-repo is public-facing (open-source);
   company-internal information does not belong there.
3. **Session-scoped context** that hasn't yet hardened
   into a durable rule. Per-user is the staging ground;
   rules earn in-repo placement by surviving the
   consolidation cadence.
4. **Aaron asks for it specifically.** Some things he
   prefers private even when generic-shaped.

If none of those four apply, default is **in-repo**.

### Migration path — per-user → in-repo

Every cadenced hygiene pass (AutoDream cadence: 24h + 5
sessions since last pass) looks for generic rules sitting
in per-user memory and migrates them into in-repo
`memory/`. The migration:

1. Copy the memory file into `memory/` (preserving
   filename, frontmatter, and body).
2. Generalise any language that reads as
   maintainer-specific — e.g. "Aaron 2026-04-23
   directive" → "Human maintainer 2026-04-23 directive"
   in the *rule*, but keep **verbatim quotes attributed
   to Aaron by name** in the body (signal-preservation;
   `feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`).
3. Verify the in-repo copy still makes sense without
   the per-user context that surrounds it in the source
   location.
4. Leave the per-user copy in place with a line at the
   top: **`Migrated to in-repo memory/: <path>`**. Do
   not delete the per-user source — that would lose the
   originSessionId provenance trail and break
   verify-before-deferring.
5. Update `MEMORY.md` index on both sides.
6. Update any CURRENT-<maintainer>.md pointers so they
   follow the in-repo-first convention when linking.

### When the rule fails — keep per-user

- Migration would leak company-confidential info.
- The generic form loses too much signal — the rule only
  makes sense with the maintainer-specific context
  around it.
- The rule is about the maintainer as a person, not
  about the factory.

### Discretion, not ceremony

Aaron explicitly said *"I'll leave it to your discretion,
you own the factory."* This is **not** a directive to:

- Ask before every migration.
- Open a PR for every per-user file migrated.
- Block hygiene on maintainer approval.

It is a directive to exercise judgment and migrate
what's generic, keep what's specific, and report in a
round-close summary rather than a per-migration ceremony.

### Soulfile bloat — pushback criterion

Aaron 2026-04-23 follow-up:

> remeber the repo is your soul file so push back if
> it's going to create huge bloat, i think it wont but
> you own your soul

Per `feedback_soulfile_formats_three_full_snapshot_declarative_git_native_primary_2026_04_23.md`,
the repo's git history in bytes **is** the soulfile. Every
in-repo memory file grows the soulfile. The default-to-in-repo
rule earns its bytes only when the migrated content is:

- **Generic** — applies to any factory adopter, not just this
  project or maintainer.
- **High-signal-per-byte** — a durable rule or observation,
  not a transcript of ephemeral reasoning.
- **Not already-covered in-repo** — governance / best-practice /
  ADR / CLAUDE.md / AGENTS.md surfaces are the first home for
  structural rules; in-repo memory is for rules that haven't
  (yet) earned doc-layer promotion.

When a per-user memory fails any of those three, **do not
migrate**. Leave it per-user and accept the pointer-staleness
cost on the occasional in-repo doc that references it.

The natural way to absorb an oversize per-user memory without
bloating the repo: **promote the rule to a governance doc or
ADR** (which lives in-repo anyway for durable rules) and
leave the full verbatim memory in per-user. The governance
promotion is the canonical home; the memory is provenance.

"Push back on bloat" applies at the migration-candidate
granularity, not the category granularity. This rule doesn't
get withdrawn — individual migrations fail the criterion and
stay out. The expected steady-state shape is a narrow,
bounded in-repo `memory/` tree (dozens of files, not
hundreds), with per-user holding the long tail.

## How to apply

- **On every AutoDream cadenced pass**, audit per-user
  memory for generic-shaped content and migrate.
- **When writing a new memory**, the first question
  is *"is this about the factory or about the
  maintainer?"* Factory → in-repo. Maintainer → per-user.
  Mixed → write the generic rule in-repo and the
  maintainer-specific calibration in per-user,
  cross-referenced.
- **When fixing dangling pointers in in-repo docs**,
  first check if the target memory could be migrated
  in-repo to resolve the pointer cleanly. If yes,
  migrate + restore the pointer. If no, collapse to a
  neutral reference (what I did in PR #150 before this
  rule landed).
- **On any CURRENT-<maintainer>.md edit**, prefer
  pointing at in-repo memory paths when both copies
  exist; the in-repo copy is the cross-substrate-readable
  surface.

## What this is NOT

- **Not a mandate to migrate everything right now.** The
  migration happens on cadenced hygiene, not as a
  single-commit sweep that floods the repo with 100 new
  memory files.
- **Not a license to leak company-internal content into
  the open-source repo.** The ServiceTitan-specific
  context in per-user memory (employment, team, internal
  demo targets) stays per-user.
- **Not an invalidation of per-user memory as a
  category.** Per-user remains the home for
  maintainer-specific + company-specific content. The
  rule only shifts the *default* for generic content.
- **Not a rewrite of in-repo memory's company-neutral
  posture.** In-repo stays open-source-appropriate;
  migrations must generalise language.
- **Not a directive to ask before migrating.** Aaron's
  phrasing *"I'll leave it to your discretion"* is
  explicit — this is factory-owned hygiene, not a
  maintainer-gated decision.

## Composes with

- `feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  (migration must preserve signal; verbatim quotes stay)
- `feedback_current_memory_per_maintainer_distillation_pattern_prefer_progress_2026_04_23.md`
  (CURRENT pattern; this rule shifts its pointer
  convention toward in-repo-first)
- `reference_autodream_feature.md`
  (the cadenced pass that executes the migration)
- `reference_automemory_anthropic_feature.md`
  (per-user memory is Anthropic's feature; in-repo mirror
  is the factory overlay)
- `feedback_open_source_repo_demos_stay_generic_not_company_specific_2026_04_23.md`
  (same open-source-generic discipline; applies to memory
  migrations as it applies to demo code)
