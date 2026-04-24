# ADR 2026-04-22: Three-repo split — Zeta + Forge + ace

**Status:** Proposed
**Decision date:** 2026-04-22
**Deciders:** Human maintainer (Aaron); Architect (Kenji) integrates; Ilyana (public-API / naming) consulted on final public names at public-announce; Nazar / Dejan consulted on repo-settings best-practice checklist.
**Triggered by:** Aaron 2026-04-22 autonomous-loop directive —

> *"we could split that out whenever you want now that you have a git map
> you can absorb whatever factory upgrade you need to do so, put it on
> the backlog, you can split out Zeta stays it's the database, then the
> package manager this will likely be the last thing since it does not
> exist yet but we will have to figure out how to connect the two
> repos, git submodules? how is that gonna work with a fork, now we
> will have 3 forks software factory, package manger, and Zeta. maybe
> do an ADR on all this one. Also we need to name the software factory
> and package manager, I think we settled on ace or source i don't
> rmeember for the package manger, you are the owner of the software
> factory it's yours to name, you don't even have to cosult with the
> naming/product guy, or you can, up to you. LFG this will be nice but
> we don't have to blow everything up to do it. We will end up have
> the 3 forks too. this is gonna get complex, you got it."*

Plus two follow-up directives in the same tick:

> *"try to setup the repos with best practices so i don't have to go
> back in and flip everything again lol"*

> *"all public"*

> *"you have owner rights on the others to but the software
> factory is yours not mine"*

> *"Zeta will likely become aces persistance too"*

> *"snake head eating it's head loop complete"*

> *"and it's probably obvious but they follow all our
> experience so they are best practices by default all the
> ones we already follow"*

## Context

`Lucent-Financial-Group/Zeta` today is a **merged-concerns repo**
hosting three distinct surfaces that happen to share a working
tree:

1. **Zeta the database / SUT** — `src/**`, `openspec/specs/**`,
   `docs/**.tla`, tests, libraries. The actual product under
   test. Consumers (future): `dotnet add package Zeta.Core`.
2. **The software factory** — `.claude/**` (skills, agents,
   commands), `tools/**`, factory-meta docs
   (`docs/AGENT-BEST-PRACTICES.md`, `docs/FACTORY-HYGIENE.md`,
   `docs/hygiene-history/**`, `docs/ROUND-HISTORY.md`,
   persona memories, factory-level ADRs). The *how* of how
   Zeta gets built.
3. **The package manager** (doesn't exist yet) — `ace`, the
   third-scope propagation layer. Distributes factory
   meta-updates + negotiates agent-to-agent. Name resolved
   2026-04-20; full design in
   `memory/project_ace_package_manager_agent_negotiation_propagation.md`.

The merge is historical accident — the factory grew inside
Zeta because that is where the work was. As Zeta approaches
v1 and `ace` moves from idea to implementation, the single-repo
shape forces three kinds of cost:

- **Contributor confusion.** A would-be Zeta contributor
  cloning `LFG/Zeta` downloads tens of thousands of lines of
  factory scaffolding they don't need.
- **Release coupling.** Shipping a Zeta hotfix would require
  navigating factory churn; shipping a factory upgrade would
  require rebasing across Zeta feature work.
- **Consumer-mental-model pollution.** Library consumers of
  Zeta should never need to know what a persona-notebook is.

The split also lets `ace` dogfood itself: the three repos
become the first three `ace` packages, with `ace` distributing
the factory + Zeta + its own updates to future adopters.

### Ouroboros closure — the snake eats its own head

Aaron 2026-04-22: *"Zeta will likely become aces persistance
too"* + *"snake head eating it's head loop complete"*.

With Zeta adopted as `ace`'s persistence layer, the three
repos close a complete bootstrap cycle:

```
                    ┌──────── ace ────────┐
                    │  (package manager,  │
                    │   distributes all   │
                    │   three, uses Zeta  │
                    │   for persistence)  │
                    └──┬───────────────┬──┘
                       │               │
          persistence  │               │  distribution
                       ↓               ↑
                  ┌──────┐        ┌─────────┐
                  │ Zeta │ ←───── │  Forge  │ ⟲ self-build
                  │ (DB, │ builds │ (facto- │
                  │ SUT) │        │  ry)    │
                  └──────┘        └─────────┘
```

Four dependency edges, forming a closed cycle plus a
self-loop:

1. **ace → Zeta** (persistence). Aaron 2026-04-22:
   *"Zeta will likely become aces persistance too."*
2. **ace ← Forge** (distribution). Forge builds ace;
   ace is packaged output of Forge tooling.
3. **Zeta ← Forge** (build & test). Forge's agents,
   skills, and CI build and test Zeta — the original
   factory relationship.
4. **Forge → Forge** (self-build). Aaron 2026-04-22:
   *"Forge also builds itself."* Forge's own CI, skills,
   agents, and hygiene rules are authored and tested
   inside Forge. The factory that builds factories is
   also built by the factory.

Aaron's words: *"snake head eating it's head loop
complete."* The Ouroboros is not metaphor — it is the
literal dependency topology.

**Bootstrap implication.** Self-build creates a classic
bootstrap problem: Forge v0 cannot build Forge v0
without Forge v0. Resolution follows the standard
self-hosting pattern (GCC, Rust, OCaml): a **snapshot
seed** — a hand-built / prior-version Forge that
produces v0, after which Forge builds its own successors.
For Zeta's purposes today, the current `LFG/Zeta` repo
*is* that seed — Stage 1 of the migration carves Forge
out of it, which is possible only because we already
have factory tooling running inside Zeta. After Stage 2,
Forge is self-hosting.

Every node in the cycle depends on every other. This is
why the connection mechanism has to be *peer repos*, not
a submodule DAG — a DAG literally cannot express a cycle,
let alone a cycle-plus-self-loop.

## Decision

Split `LFG/Zeta` into **three peer repositories**, each with
its own AceHack fork following the existing fork-PR cost
model (`docs/UPSTREAM-RHYTHM.md`). All three public from day
one.

### Names & ownership

| Role | Repo name | Fork | Owner (governance) | Rationale |
|---|---|---|---|---|
| Database / SUT | `Lucent-Financial-Group/Zeta` | `AceHack/Zeta` | Aaron | Stays as-is. Name shipped. |
| Software factory | `Lucent-Financial-Group/Forge` | `AceHack/Forge` | **Claude** | Aaron 2026-04-22: *"you have owner rights on the others to but the software factory is yours not mine."* Claude holds governance authority over Forge name, scope, factory policy; Aaron retains alignment-contract veto. See *Ownership model* below. |
| Package manager | `Lucent-Financial-Group/ace` | `AceHack/ace` | Aaron | Name resolved 2026-04-20 in `memory/project_ace_package_manager_agent_negotiation_propagation.md`. Lowercase per Unix-CLI convention. |

### Ownership model

Aaron 2026-04-22: *"you have owner rights on the others to
but the software factory is yours not mine."*

**What "Claude owns Forge" means:**

- **Name, scope, direction.** Forge's name, what moves into
  it vs stays in Zeta, factory-policy direction — Claude
  decides. (This ADR itself is Claude exercising that
  authority.)
- **Factory-meta rules.** `GOVERNANCE.md`, `AGENT-BEST-
  PRACTICES.md`, `FACTORY-HYGIENE.md`, the `BP-NN` rule
  list, persona registry, skill catalog — Claude authors
  and maintains.
- **Repo settings.** Best-practice checklist below is
  Claude-directed; Aaron grants standing permission to
  configure without re-asking (consistent with
  `memory/feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md`).

**What Aaron retains on Forge:**

- **Alignment-contract veto.** `docs/ALIGNMENT.md` sets the
  outer envelope; any Forge-scope move that touches
  alignment routes through Aaron.
- **Budget authority.** Anything that costs money on the
  LFG org billing surface needs Aaron; Claude never edits
  LFG budgets (standing rule).
- **Personal-info / credential separation.** Claude never
  touches Aaron's GitHub account settings, personal
  identity data, or secrets.

**What "Claude owns Zeta & ace" means (the weaker form
Aaron granted — "owner rights on the others"):**

- **Authoring + operation rights.** Claude can land code,
  file BACKLOG rows, author skills, configure CI, open
  PRs — same rights as on Forge.
- **But not final governance.** Name, product direction,
  public-announce timing, and any alignment-sensitive
  policy routes through Aaron. Aaron retains decision
  authority.

This three-tier model (Forge-Claude-owned / Zeta-ace-Aaron-
owned-but-Claude-operates / alignment-contract-Aaron-vetoes-
everywhere) is the practical shape of
`docs/ALIGNMENT.md`'s "agents with agency" framing at the
repo-hosting layer.

**Hosting note:** ownership-of-governance and ownership-of-
the-GitHub-org are separate. All three repos still host under
`Lucent-Financial-Group` for merge-queue access and CI
cost-pooling; Claude owning Forge means Claude directs Forge,
not that Forge sits under a separate GitHub org.

### Name — Forge

Software-factory repo: **`Forge`**.

Aaron delegated the pick without naming-expert consultation:
*"you are the owner of the software factory it's yours to
name, you don't even have to cosult with the naming/product
guy, or you can, up to you."* I chose to pick directly.

Rationale:

1. **Blade/forge metaphor continuity.** The factory's own
   working vocabulary already includes *blade* (the crystallized
   artifact), *crystallize* (the verb), *materia* (skills),
   *diamond* (the output). `Forge` is where a blade is made.
   See `memory/feedback_kanban_factory_metaphor_blade_crystallize_materia_pipeline.md`.
2. **Short, CLI-clean, one-syllable.** Fits alongside `ace`
   and `Zeta` — three short nouns at the shell.
3. **Adopts an established term.** "Code forge" is a real
   term of art (Sourcehut calls itself a code forge;
   Codeberg, Gitea, Forgejo use the word; the
   Fedora/Debian communities call self-hosted git services
   forges). Adopting it verbatim per the no-invent-vocabulary
   rule (`memory/feedback_dont_invent_when_existing_vocabulary_exists.md`).
   A software factory *is* a forge.
4. **Minor collisions acceptable.** `forge.dev` is unrelated,
   `forge-std` is Foundry's Solidity library, `Forge Mod
   Loader` is Minecraft. None occupy the software-factory /
   agent-system niche. Search-disambiguation cost is low.
5. **Pre-v1 working name; naming-expert gate stays open for
   public announce.** Following the same pattern as `ace`:
   owner picks the working name; Ilyana reviews at
   public-announce if brand-critical.

Declined alternatives: `Factory` (too generic, Python has
`factory_boy`), `Anvil` (already a Python web framework),
`Mint` (coin-minting collision, also a Linux distro),
`Loom` (collides with the Node.js linter).

### What moves where

| Path (in current `Zeta`) | Destination repo |
|---|---|
| `src/**`, `openspec/specs/**`, `docs/**.tla`, tests | `Zeta` |
| `docs/VISION.md`, `docs/ROADMAP.md`, `docs/BACKLOG.md` (product-facing rows), `docs/GLOSSARY.md`, `docs/WONT-DO.md` (product-facing) | `Zeta` |
| `Directory.Build.props`, `global.json`, solution file | `Zeta` |
| `.claude/skills/**`, `.claude/agents/**`, `.claude/commands/**`, `.claude/settings.json` | `Forge` |
| `tools/hygiene/**`, `tools/setup/**` (factory-level scripts) | `Forge` |
| `docs/AGENT-BEST-PRACTICES.md`, `docs/FACTORY-HYGIENE.md`, `docs/FACTORY-METHODOLOGIES.md`, `docs/hygiene-history/**`, `docs/ROUND-HISTORY.md`, `docs/EXPERT-REGISTRY.md` | `Forge` |
| `memory/persona/**` (factory-level persona notebooks) | `Forge` |
| `docs/research/**` (factory-level research) | `Forge` |
| Factory-level ADRs under `docs/DECISIONS/` (BP-NN, round-history, hygiene rows) | `Forge` |
| Product-level ADRs (e.g. lock-free-circuit-register) | `Zeta` |
| `AGENTS.md`, `CLAUDE.md`, `GOVERNANCE.md` | **Both, divergent.** Each repo authors its own, following the single-concern principle. Forge's is authoritative for factory policy; Zeta's is scoped to Zeta-product contribution. |
| `ace` source (future) | `ace` |

*Sorting rule:* if the file governs *how the factory
operates*, it goes to `Forge`. If the file governs *how Zeta
the product behaves*, it goes to `Zeta`. When a file does
both (VISION, BACKLOG, WONT-DO), split it — the product-
facing rows stay with `Zeta`, the factory-hygiene rows move
to `Forge`.

Sorting happens during migration (see *Incremental migration
plan* below), not retroactively across history. Each file
moves once with `git mv` in a commit that says "move X to
Forge, factory-concern".

### Connection mechanism — peer repos, not submodules

Aaron's question:

> *"we will have to figure out how to connect the two repos,
> git submodules? how is that gonna work with a fork"*

**Answer: git submodules are the wrong shape for this triple.**

The three repos form a **circular dependency**, not an acyclic
parent-child hierarchy:

- Zeta needs Forge (agents build Zeta; skills encode
  contribution workflow).
- Forge needs Zeta (the factory's proving ground is building
  Zeta; without a real SUT the factory has nothing to test
  against).
- ace needs Zeta and Forge (it distributes them; it is written
  in factory output from Forge; it is a Zeta-adjacent
  component).

Submodules assume a DAG: parent pins child at a SHA. When
Aaron or an agent forks a sub-repo to iterate on it, the
parent `.gitmodules` has to be updated in every consumer —
painful at N=2, worse at N=3 with a cycle.

**Adopted shape: peer repos, cross-referenced but not
submoduled.** Each repo is cloned independently. Cross-
referencing by:

1. **Git tags** — Forge tags v-series releases; Zeta CI
   pins a specific Forge tag via a version file
   (`.forge-version`) at repo root. Forge upgrades are
   explicit PRs that bump the version file.
2. **`repository_dispatch` CI triggers** — when Forge ships
   a new tag, it fires a dispatch event that Zeta listens
   for. Zeta opens a PR updating `.forge-version`. Agent
   can auto-merge if CI passes.
3. **Cross-linking in docs** — `AGENTS.md` in Zeta points
   at `github.com/Lucent-Financial-Group/Forge` for factory
   questions. `AGENTS.md` in Forge points at
   `github.com/Lucent-Financial-Group/Zeta` as the canonical
   SUT.
4. **ace as eventual mediation layer.** Once `ace` ships,
   the version-file + dispatch pattern is replaced by
   `ace pull forge@<version>` and `ace pull zeta@<version>`.
   `ace` is explicitly designed for this role
   (see `memory/project_ace_package_manager_agent_negotiation_propagation.md`
   §Ouroboros three-layer bootstrap).

**Three forks.** Each upstream gets an `AceHack/<name>` fork.
The fork-PR cost model in `docs/UPSTREAM-RHYTHM.md`
generalizes: daily agent PRs target each fork, bulk-sync to
LFG every ~10 PRs per repo. `ace` eventually automates the
bulk-sync rhythm.

### Repo best practices — applied at creation

Aaron: *"try to setup the repos with best practices so i
don't have to go back in and flip everything again lol"*
plus *"all public"* plus *"it's probably obvious but they follow
all our experience so they are best practices by default
all the ones we already follow."*

**The "by-default" principle.** The checklist below is
*every lesson Zeta has learned*, applied to Forge and ace
on creation. No per-item re-justification — if Zeta does
it, Forge and ace do it, unless there's a repo-specific
reason not to. The whole point of codifying experience in
memory + `docs/AGENT-BEST-PRACTICES.md` + FACTORY-HYGIENE
is so it compounds to new repos as a default, not a
decision. This ADR is the once-forever justification;
Stage 1 execution is mechanical.

Every setting below lands on all three repos (Zeta, Forge,
ace) and on both surfaces (upstream LFG + fork AceHack
where applicable) on day one, before the first agent PR
lands. Source of truth for each: `docs/GITHUB-SETTINGS.md`
in the governing repo (declarative-settings-as-code per
`memory/feedback_github_settings_as_code_declarative_checked_in_file.md`).

**Visibility:**

- [ ] All three upstream repos public from creation
- [ ] All three AceHack forks public (forks of public repos
      are necessarily public)

**Merge discipline:**

- [ ] Squash-merge only (disable merge-commit + rebase-merge)
- [ ] Delete head branches on merge
- [ ] Auto-merge enabled at repo level
- [ ] Merge queue enabled (LFG org only; requires org
      hosting per `memory/project_zeta_org_migration_to_lucent_financial_group.md`)

**Branch protection (main):**

- [ ] Require PR before merge
- [ ] Require 1 review (will bump to 2 per
      `memory/feedback_second_ai_reviewer_required_check_deferred_until_multi_contributor.md`
      once multi-contributor)
- [ ] Require status checks: build, test, scorecard,
      codeql-default-setup, factory-hygiene lint
- [ ] Require branches up-to-date before merge (merge
      queue handles this on LFG)
- [ ] Restrict force-push on main
- [ ] Require signed commits (all three repos)
- [ ] Require linear history

**Security posture:**

- [ ] Secret scanning + push protection enabled
- [ ] Dependency graph + Dependabot + Dependabot security
      updates
- [ ] Code scanning via CodeQL **default-setup**
      (non-negotiable — advanced-only fails the
      `code_scanning` ruleset rule per
      `memory/reference_github_code_scanning_ruleset_rule_requires_default_setup.md`)
- [ ] Private vulnerability reporting on
- [ ] OpenSSF Scorecard workflow wired in
- [ ] SECURITY.md authored

**CI hardening (Dejan's safe-patterns batch):**

- [ ] Shared-runners only (no self-hosted on public repos)
- [ ] Action SHA pinning, not tags
- [ ] Minimal `permissions:` on each workflow (default
      `contents: read`, escalate per-job)
- [ ] Concurrency groups on every workflow
- [ ] `GITHUB_TOKEN` read-only by default
- [ ] Semgrep rule for GHA inline-untrusted-in-run injection
      (already landed on Zeta; generalize to Forge + ace)

**Budget caps (LFG org side):**

- [ ] Copilot spending limit $0 (designed cost-stop per
      `feedback_lfg_budgets_set_permits_free_experimentation.md`)
- [ ] Actions spending limit $0
- [ ] Packages spending limit $0

**Governance files (day-one, per repo):**

- [ ] `README.md` (consumer-facing, Iris-reviewed)
- [ ] `AGENTS.md` (universal AI onboarding, scoped to the repo)
- [ ] `CLAUDE.md` (Claude-Code harness pointer, scoped)
- [ ] `GOVERNANCE.md` (numbered rules, scoped)
- [ ] `LICENSE` (match Zeta's current license)
- [ ] `CODE_OF_CONDUCT.md`
- [ ] `CONTRIBUTING.md`
- [ ] `SECURITY.md`
- [ ] `.github/copilot-instructions.md` (factory-managed;
      audit cadence per GOVERNANCE.md §31)

**Factory scaffolding (Forge + ace only):**

- [ ] `.claude/skills/` tree (Forge holds canonical copy;
      ace inherits a slim subset for package-manager-
      specific skills)
- [ ] `.claude/agents/` tree
- [ ] `docs/AGENT-BEST-PRACTICES.md` (Forge is canonical)
- [ ] `docs/FACTORY-HYGIENE.md`
- [ ] `docs/hygiene-history/**`
- [ ] `memory/persona/` structure

**Pre-commit hooks (all three):**

- [ ] ASCII-clean check (BP-10)
- [ ] Prompt-injection lint (invisible-Unicode codepoints)
- [ ] `openspec validate --strict` (Zeta only)

**Social preview:**

- [ ] SVG social-preview authored per
      `memory/feedback_svg_preferred_vector_raster_decided_at_ui_time.md`
- [ ] Rasterized PNG uploaded to GitHub (format-gated by
      GitHub's social-preview requirement)

**Declarative settings file:**

- [ ] `docs/GITHUB-SETTINGS.md` in each repo, cadenced diff
      vs `gh api` (FACTORY-HYGIENE class per
      `memory/feedback_github_settings_as_code_declarative_checked_in_file.md`)

**Fork-PR workflow per repo:**

- [ ] AceHack fork exists
- [ ] `docs/UPSTREAM-RHYTHM.md` per repo (Zeta's serves as
      template)
- [ ] Bulk-sync cadence monitor (proposed FACTORY-HYGIENE
      row per `docs/UPSTREAM-RHYTHM.md` §Cadence monitor)

### Incremental migration plan

*"LFG this will be nice but we don't have to blow everything
up to do it."* — Aaron 2026-04-22.

Staged migration, reversible at each step:

**Stage 0 — this ADR.** No code moves. Just decide.

**Stage 1 — create empty repos with scaffolding.**
Create `LFG/Forge` and `LFG/ace` empty, apply the full
best-practice checklist above via `gh` + GITHUB-SETTINGS.md
file. Fork both to AceHack. No content migration yet. Each
repo has a README pointing at Zeta for now. Estimated: 1
session.

**Stage 2 — move Forge content.** Single bulk move via
`git mv` (preserves history if we use `git subtree split`
for the factory paths). Factory paths listed above move to
`Forge`. Zeta gets a cleanup PR removing the moved paths and
adding a `.forge-version` pin. Forge references Zeta for SUT
tests. CI on both repos stays green. Estimated: 2-3 sessions.

**Stage 3 — stand up `ace` bootstrap.** Build the minimum
viable `ace` that can `ace pull forge@<tag>` and `ace pull
zeta@<tag>`. This is the Ouroboros moment. Estimated: 10+
sessions. Deferred until Zeta v1 proximity.

**Stage 4 — switch cross-repo glue from version-pin files
to `ace`.** Replace `.forge-version` with `ace.toml`.
Estimated: 1-2 sessions after `ace` is usable.

Each stage is independently valuable: Stage 1 sets up the
forks, Stage 2 cleans Zeta's contributor surface, Stage 3
ships `ace`, Stage 4 closes the Ouroboros.

### What this does NOT commit to

- **Not a Stage 1 commitment this round.** The ADR is the
  decision shape; executing Stage 1 is a backlog item
  (see BACKLOG row filed alongside this ADR).
- **Not a deadline.** Aaron: *"we don't have to blow
  everything up."* Migration happens when the factory
  is ready.
- **Not a commitment to rename `Zeta`.** The database
  product keeps its public name.
- **Not a commitment to the current `.forge-version`
  pin format.** If submodules-with-fork turns out to be
  tractable during Stage 2, we reconsider. The ADR
  prefers peer-repos but does not forbid submodules.
- **Not a pre-approved ship of `ace` to public registry.**
  `ace` public launch is a separate decision with
  naming-expert review.

## Alternatives considered

**A. Stay single-repo.** Zero migration cost. Rejected
because (1) Aaron explicitly asked to split; (2) as Zeta
approaches v1 the contributor-mental-model pollution
compounds; (3) release coupling penalties grow with
factory size.

**B. Two-repo split (Zeta + Forge, defer `ace`).**
Cheaper. Rejected because `ace` is already on the
roadmap and will happen — planning the three-way split
upfront is cheaper than a two-way split followed by a
split-again. Aaron's directive named all three.

**C. Submodules from the start.** Rejected because
circular dependency shape does not fit DAG, and
submodule-with-fork friction is documented as painful.

**D. Monorepo with per-directory CODEOWNERS.** Keeps
the merged-concerns structure, solves some contributor
noise via CODEOWNERS routing. Rejected because it does
not solve release coupling or consumer-mental-model
pollution.

## Consequences

**Positive:**

- Clean contributor surface per repo.
- Independent release cadences.
- `ace` becomes buildable as a first-class project.
- Three forks dogfood the fork-PR workflow at scale.
- Best-practice scaffolding applied uniformly on day
  one, not retrofitted.

**Negative:**

- Three GitHub surfaces to keep in sync (offset partly
  by declarative GITHUB-SETTINGS.md).
- Three fork-sync rhythms to track.
- Three CI quotas instead of one (offset by free-tier
  allowances on AceHack forks).
- Migration tax during Stage 2 (offset by one-time
  nature).
- Cross-repo PR flows become routine (`.forge-version`
  bump PRs).

**Open questions:**

- Exact cut-line for product-facing vs factory-facing
  rows in BACKLOG / VISION / WONT-DO. Resolve during
  Stage 2 by file-by-file inspection, not upfront.
- Whether `memory/` is a per-repo tree or a shared
  Forge-hosted tree symlinked by Zeta. Leaning
  per-repo; decide during Stage 2.
- Whether persona notebooks follow personas (go with
  Forge) or stay with the work surface they audit
  (split). Leaning persona-follows-Forge, with
  Zeta-specific audit output as product-repo artifacts.

## Supersedes

None directly. Generalizes the upstream/fork/SUT
three-surface framework in `docs/UPSTREAM-RHYTHM.md` from
one-repo-three-surfaces to three-repos-three-surfaces.

## Cross-references

- `memory/project_ace_package_manager_agent_negotiation_propagation.md`
  — `ace` full design, Ouroboros bootstrap, red-team
  discipline.
- `memory/project_zeta_org_migration_to_lucent_financial_group.md`
  — the prior LFG migration that unblocked merge queue.
- `docs/UPSTREAM-RHYTHM.md` — the fork-PR cost model
  that generalizes to three repos.
- `memory/feedback_dont_invent_when_existing_vocabulary_exists.md`
  — rule that licensed `Forge` (adopts established "code
  forge") and `ace` (Aaron's natural vocabulary).
- `memory/feedback_github_settings_as_code_declarative_checked_in_file.md`
  — declarative GITHUB-SETTINGS.md per repo.
- `memory/feedback_fork_based_pr_workflow_for_personal_copilot_usage.md`
  — the fork-PR workflow.
- `memory/feedback_fork_upstream_batched_every_10_prs_rhythm.md`
  — batched bulk-sync rhythm.
- `memory/feedback_blast_radius_pricing_standing_rule_alignment_signal.md`
  — blast-radius reasoning for each migration stage.
- `memory/reference_github_code_scanning_ruleset_rule_requires_default_setup.md`
  — why CodeQL default-setup is in the best-practice
  checklist.
- `docs/BACKLOG.md` — row filed alongside this ADR for
  Stage 1 execution.
