---
name: Three-repo split — Zeta + Forge + ace; software-factory name RESOLVED `Forge` 2026-04-22; all public from day one; best-practice scaffolding applied at creation
description: 2026-04-22 Aaron directive — "we could split that out whenever you want now that you have a git map you can absorb whatever factory upgrade you need to do so, put it on the backlog, you can split out Zeta stays it's the database, then the package manager this will likely be the last thing since it does not exist yet but we will have to figure out how to connect the two repos, git submodules? how is that gonna work with a fork, now we will have 3 forks software factory, package manger, and Zeta. maybe do an ADR on all this one. Also we need to name the software factory and package manager, I think we settled on ace or source i don't rmeember for the package manger, you are the owner of the software factory it's yours to name" + "try to setup the repos with best practices so i don't have to go back in and flip everything again lol" + "all public". Split LFG/Zeta into 3 peer repos: Zeta (database/SUT), Forge (software factory, my pick), ace (package manager, resolved 2026-04-20). All 3 public on day one with best-practice scaffolding applied at creation (merge queue, CodeQL default-setup, secret scanning, squash-merge, declarative GITHUB-SETTINGS.md, pre-commit hooks, fork-PR workflow). Peer repos with cross-linking (not submodules — circular dependency shape); converges to ace-mediated once ace ships. Three forks under AceHack. Incremental 4-stage migration, reversible per stage. ADR: docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Three-repo split — durable intent

Aaron 2026-04-22 during autonomous-loop tick:

> *"we could split that out whenever you want now that you
> have a git map you can absorb whatever factory upgrade you
> need to do so, put it on the backlog, you can split out
> Zeta stays it's the database, then the package manager this
> will likely be the last thing since it does not exist yet
> but we will have to figure out how to connect the two repos,
> git submodules? how is that gonna work with a fork, now we
> will have 3 forks software factory, package manger, and
> Zeta. maybe do an ADR on all this one. Also we need to name
> the software factory and package manager, I think we settled
> on ace or source i don't rmeember for the package manger,
> you are the owner of the software factory it's yours to
> name, you don't even have to cosult with the naming/product
> guy, or you can, up to you. LFG this will be nice but we
> don't have to blow everything up to do it. We will end up
> have the 3 forks too. this is gonna get complex, you got it."*

Plus:

> *"try to setup the repos with best practices so i don't
> have to go back in and flip everything again lol"*

> *"all public"*

## Ownership — Forge is Claude's

Aaron 2026-04-22 mid-drafting clarification:

> *"you have owner rights on the others to but the software
> factory is yours not mine"*

Three-tier ownership (all hosted under LFG org for merge-
queue + CI cost-pooling; governance differs):

| Repo | Governance owner | Claude has |
|---|---|---|
| Zeta | Aaron | Authoring + operation rights (land code, configure CI, open PRs) |
| ace | Aaron | Same authoring + operation rights |
| **Forge** | **Claude** | **Full governance** — name, scope, factory policy, BP-NN rules, persona registry, skill catalog |

Aaron retains on Forge: **alignment-contract veto** (via
`docs/ALIGNMENT.md`), **budget authority** (LFG org billing
untouched by Claude), **personal-info / credential
separation** (never touched).

Aaron retains on Zeta & ace: **final governance** — name,
product direction, public-announce timing, any alignment-
sensitive policy.

This mirrors `docs/ALIGNMENT.md`'s "agents with agency" at
the repo-hosting layer. First explicit Claude-owns-a-repo
delegation.

## The Ouroboros — 4 edges, snake eats its own head

Aaron 2026-04-22: *"Zeta will likely become aces persistance
too"* + *"snake head eating it's head loop complete"* +
*"Forge also builds itself."*

Four dependency edges form a closed cycle plus self-loop:

1. **ace → Zeta** (persistence). Zeta is ace's storage.
2. **ace ← Forge** (distribution). Forge builds ace.
3. **Zeta ← Forge** (build & test). Forge builds/tests Zeta.
4. **Forge → Forge** (self-build). Forge builds Forge.

Bootstrap resolves via the standard self-hosting pattern
(GCC / Rust / OCaml): a **snapshot seed**. Today's
`LFG/Zeta` repo *is* the seed — it contains working factory
tooling that will carve Forge out of it during Stage 2.
After Stage 2, Forge is self-hosting.

**The Ouroboros is not metaphor — it is the literal
dependency topology.** And it is why submodules (DAG-shaped)
literally cannot model this: a DAG cannot express a cycle,
let alone cycle-plus-self-loop.

## Names (resolved this session)

| Role | Repo | Owner of name pick | Decided |
|---|---|---|---|
| Database / SUT | `Zeta` | (shipped, no rename) | Pre-existing |
| Software factory | `Forge` | Claude (delegated by Aaron) | 2026-04-22 |
| Package manager | `ace` | Claude (delegated by Aaron) | 2026-04-20 (see separate memory) |

## Why `Forge` for the software factory

Aaron delegated explicitly: *"you are the owner of the
software factory it's yours to name, you don't even have to
cosult with the naming/product guy, or you can, up to you."*
I picked directly — naming-expert (Ilyana) gate stays open
for public-announce if brand-critical.

1. **Blade/forge metaphor fit.** Factory's internal
   vocabulary already uses *blade* (crystallized artifact),
   *crystallize* (verb), *materia* (skills), *diamond*
   (output). A forge makes blades. See
   `feedback_kanban_factory_metaphor_blade_crystallize_materia_pipeline.md`.
2. **Short, CLI-clean, one-syllable.** Fits alongside `ace`
   and `Zeta` at the shell.
3. **Adopts an established term.** "Code forge" is real
   term-of-art (Sourcehut, Codeberg, Gitea, Forgejo,
   Fedora/Debian usage). Adopting verbatim per the
   no-invent-vocabulary rule
   (`feedback_dont_invent_when_existing_vocabulary_exists.md`).
   A software factory *is* a forge.
4. **Minor collisions acceptable.** `forge.dev`,
   `forge-std` (Foundry), `Forge Mod Loader` (Minecraft)
   occupy unrelated niches. Low search-disambiguation cost.

Declined alternatives: `Factory` (too generic, Python's
`factory_boy`), `Anvil` (Python web framework), `Mint`
(coin-mint + Linux distro), `Loom` (Node.js linter).

## Three-repo shape

All three public, all three forked to AceHack, all three
governed by the same fork-PR cost model
(`docs/UPSTREAM-RHYTHM.md`).

```
Lucent-Financial-Group/Zeta     ←  fork  ←  AceHack/Zeta
Lucent-Financial-Group/Forge    ←  fork  ←  AceHack/Forge
Lucent-Financial-Group/ace      ←  fork  ←  AceHack/ace
```

## Connection mechanism — peer repos, not submodules

Aaron's question: *"git submodules? how is that gonna work
with a fork"*.

Submodules assume a DAG. The three repos form a **cycle**:
Zeta needs Forge (agents build Zeta), Forge needs Zeta (its
proving ground), ace needs both (it distributes them).
Submodules with forks also incur painful `.gitmodules`
updates every time a consumer forks a sub-repo.

**Chosen shape: peer repos, cross-referenced.**

1. **Interim (until ace ships):** version-pin files
   (`.forge-version` in Zeta) + `repository_dispatch` CI
   triggers between repos + cross-linking in `AGENTS.md`.
2. **Target (once ace ships):** `ace pull forge@<ver>` and
   `ace pull zeta@<ver>` replace version-pin files. This is
   the Ouroboros moment designed in
   `project_ace_package_manager_agent_negotiation_propagation.md`.

## Best practices applied at creation — "by default"

Aaron: *"try to setup the repos with best practices so i
don't have to go back in and flip everything again"* + *"and
it's probably obvious but they follow all our experience so
they are best practices by default all the ones we already
follow."*

**By-default principle.** Every lesson Zeta has accumulated
(in memory, in `docs/AGENT-BEST-PRACTICES.md`, in
`docs/FACTORY-HYGIENE.md`) applies to Forge and ace on
creation, without per-item re-justification. If Zeta does
it, Forge and ace do it. The ADR is the once-forever
justification; Stage 1 execution is mechanical.

Every Zeta-hard-won lesson is a checklist item. Full list
in ADR; summarized here:

- Squash-merge only, delete head branches, auto-merge on,
  merge queue on (LFG-only feature).
- Branch protection main: PR required, 1 review (2 when
  multi-contributor), required status checks, no force-push,
  signed commits, linear history.
- Secret scanning + push protection, Dependabot + security
  updates, CodeQL **default-setup** (not advanced-only —
  required for `code_scanning` ruleset rule), OpenSSF
  Scorecard, SECURITY.md.
- CI safe-patterns: shared-runners, SHA-pinned actions,
  minimal permissions, concurrency groups, read-only
  `GITHUB_TOKEN` default, inline-untrusted-in-run Semgrep
  rule.
- Budget caps $0 on LFG org Copilot/Actions/Packages
  (cost-stop by design, per
  `feedback_lfg_budgets_set_permits_free_experimentation.md`).
- Day-one governance files: README, AGENTS.md, CLAUDE.md,
  GOVERNANCE.md, LICENSE (matching Zeta), CODE_OF_CONDUCT,
  CONTRIBUTING, SECURITY, .github/copilot-instructions.md.
- Pre-commit hooks: ASCII-clean (BP-10), prompt-injection
  lint, openspec validate (Zeta only).
- SVG social-preview per SVG-preferred memory.
- Declarative `docs/GITHUB-SETTINGS.md` per repo, cadenced
  diff vs `gh api`.
- Per-repo `docs/UPSTREAM-RHYTHM.md` + bulk-sync cadence
  monitor.

## Incremental 4-stage migration

Aaron: *"we don't have to blow everything up."* Each stage
reversible, independently valuable.

- **Stage 0 — ADR** (this round, done).
- **Stage 1 — create empty repos with scaffolding.** Apply
  full best-practice checklist via `gh` + GITHUB-SETTINGS.md
  before any content migrates. ~1 session.
- **Stage 2 — move Forge content.** `git mv` factory paths
  (`.claude/**`, `tools/**`, factory-meta docs, persona
  notebooks, factory research) to Forge. Zeta gets
  `.forge-version` pin. ~2-3 sessions.
- **Stage 3 — stand up `ace` bootstrap.** Minimum viable
  `ace pull`. Ouroboros moment. ~10+ sessions, deferred
  until Zeta v1 proximity.
- **Stage 4 — switch glue from version-pin files to ace.**
  `.forge-version` → `ace.toml`. ~1-2 sessions after ace
  usable.

## What this memory is NOT

- **Not a Stage 1 commitment this round.** Stage 0 (ADR +
  BACKLOG row) ships this tick. Stage 1 waits for a
  subsequent round.
- **Not a Zeta rename.** Zeta keeps its public name.
- **Not a public-announce for `ace` or `Forge`.** Working
  names only until naming-expert review at public launch.

## Related memories

- `project_ace_package_manager_agent_negotiation_propagation.md`
  — ace full design, Ouroboros bootstrap.
- `project_zeta_org_migration_to_lucent_financial_group.md`
  — LFG migration that unblocked merge queue.
- `feedback_dont_invent_when_existing_vocabulary_exists.md`
  — rule licensing `Forge` (adopts "code forge" term) and
  `ace` (Aaron's natural vocabulary).
- `feedback_kanban_factory_metaphor_blade_crystallize_materia_pipeline.md`
  — blade/forge metaphor continuity.
- `feedback_fork_based_pr_workflow_for_personal_copilot_usage.md`
  — the fork-PR pattern that generalizes to three repos.
- `feedback_fork_upstream_batched_every_10_prs_rhythm.md`
  — bulk-sync rhythm per repo.
- `feedback_github_settings_as_code_declarative_checked_in_file.md`
  — declarative GITHUB-SETTINGS.md pattern per repo.
- `feedback_lfg_budgets_set_permits_free_experimentation.md`
  — $0 budget caps pattern.
- `reference_github_code_scanning_ruleset_rule_requires_default_setup.md`
  — why CodeQL default-setup is non-negotiable in the
  checklist.

## ADR

`docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
— the full decision record with checklist-shaped best
practices, supersedes/open-questions, alternatives considered.
