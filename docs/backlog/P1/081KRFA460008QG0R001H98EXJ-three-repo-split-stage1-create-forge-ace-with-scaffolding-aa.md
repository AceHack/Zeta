---
id: 081KRFA460008QG0R001H98EXJ
priority: P1
status: open
title: "Three-repo split Stage 1 — create empty Forge + ace with day-one scaffolding"
type: feature
origin: Aaron 2026-05-13 (autonomous-loop substrate cascade)
created: 2026-05-13
last_updated: 2026-05-14
composes_with:
  - memory/project_three_repo_split_zeta_forge_ace_software_factory_named_forge.md
  - memory/project_repo_split_provisional_names_frontier_factory_and_peers_2026_04_23.md
  - docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md
  - 081KRFA460008QG0R003JQ46J4
---

# Three-repo split Stage 1 — create empty Forge + ace repos with day-one scaffolding

## Aaron's directive

Aaron 2026-05-13: *"let's split repos to make it easy backlog"* +
*"that project repo split stuff alreday exists"* + *"Also there
is backlog for repo split on products too"*.

The three-repo split substrate already exists (memory file plus
ADR plus 4-stage migration plan from 2026-04-22). Stage 0 is done. This
backlog row tracks Stage 1 — make it easy to land.

## What Stage 1 produces

Per `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`:

1. **`Lucent-Financial-Group/Forge`** — empty repo, software factory
   home, Claude/Otto-owned governance
2. **`Lucent-Financial-Group/ace`** — empty repo, package manager
   home, Aaron-owned governance

Both with full best-practice scaffolding applied at creation:

- Squash-merge only, delete head branches, auto-merge on, merge queue on
- Branch protection main: PR required, 1 review, required status checks,
  no force-push, signed commits, linear history
- Secret scanning + push protection, Dependabot + security updates
- CodeQL default-setup (NOT advanced-only — required for `code_scanning`
  ruleset rule)
- OpenSSF Scorecard, SECURITY.md
- CI safe-patterns: shared-runners, SHA-pinned actions, minimal
  permissions, concurrency groups, read-only `GITHUB_TOKEN` default,
  inline-untrusted-in-run Semgrep rule
- Budget caps $0 on LFG org Copilot/Actions/Packages
- Day-one governance files: README, AGENTS.md, CLAUDE.md, GOVERNANCE.md,
  LICENSE, CODE_OF_CONDUCT, CONTRIBUTING, SECURITY,
  `.github/copilot-instructions.md`
- Pre-commit hooks: ASCII-clean (BP-10), prompt-injection lint
- SVG social-preview
- Declarative `docs/GITHUB-SETTINGS.md` per repo
- Per-repo `docs/UPSTREAM-RHYTHM.md`

## Pre-start checklist — COMPLETED 2026-05-13 (081KRFA460008QG0R001H98EXJ.1)

Per `.claude/rules/backlog-item-start-gate.md`:

1. **Prior-art-search** — completed 2026-05-13:
   - `memory/project_three_repo_split_zeta_forge_ace_software_factory_named_forge.md` — read; substrate current, Stage 0 done (ADR exists)
   - `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — read; full checklist present, no drift
   - `memory/project_ace_package_manager_agent_negotiation_propagation.md` — file exists; ace name + Ouroboros design confirmed
   - LFG/AceHack topology (`.claude/rules/lfg-acehack-topology.md`) — LFG is active dev; AceHack is mirror; Forge + ace repos do NOT yet exist at LFG — confirmed via worldview refresh (0 open PRs on main)
   - No existing `tools/scaffold/` directory — clean slate, no prior art to extend
   - Skill router checked: no existing scaffold or repo-creation skill

2. **Dependency-restructure** — 081KRFA460008QG0R003JQ46J4 (product-repo split planning) is sibling row, not a blocker for Stage 1. Reciprocal pointer in 081KRFA460008QG0R003JQ46J4 not yet present; will add in a follow-up pass. Stage 1 is executable independently.

3. **License question resolved** — Apache 2.0 (same as Zeta). Forge and ace are open-source/designed-to-be-forked; honor-system framing does not apply.

4. **Scope decision** — 081KRFA460008QG0R001H98EXJ is too broad to implement in one PR. This PR (081KRFA460008QG0R001H98EXJ.1) implements the smallest safe slice: day-one governance file templates for Forge and ace + a TypeScript dry-run tool (`tools/scaffold/create-repo.ts`) that shows the GitHub API calls needed to complete Stage 1. Actual GitHub repo creation (irreversible external action) is deferred to a follow-up PR with Aaron's review.

## Completed slices — all merged 2026-05-13

All scaffolding code is in `main`. Tests pass: 30/30 (bun test tools/scaffold/create-repo.test.ts).

| Slice | PR | Description |
|-------|-----|-------------|
| 081KRFA460008QG0R001H98EXJ.1 | #2994 | Forge + ace day-one governance templates + dry-run `create-repo.ts` tool |
| 081KRFA460008QG0R001H98EXJ.2 | #2996 | `workflow_dispatch` gate for Stage 1 repo creation (safe apply entrypoint) |
| 081KRFA460008QG0R001H98EXJ.3 | #3003 | `UPSTREAM-RHYTHM.md` templates for Forge + ace scaffold dirs |
| 081KRFA460008QG0R001H98EXJ.4 | #3019 | OpenSSF Scorecard workflow to Forge + ace scaffold dirs |
| 081KRFA460008QG0R001H98EXJ.5 | #3025 | Dry-run test suite for `create-repo.ts` (18 tests) |
| 081KRFA460008QG0R001H98EXJ.6 | #3026 | `.semgrep.yml` GHA injection rule to forge+ace scaffold templates |
| 081KRFA460008QG0R001H98EXJ.7 | #3027 | `.github/dependabot.yml` to forge+ace scaffold templates |
| 081KRFA460008QG0R001H98EXJ.8 | #3028 | BP-10 invisible-Unicode + mutable-tag rules to forge+ace scaffold templates |

**Dry-run verified 2026-05-14** — both repos produce 12 planned operations (create, merge-settings,
push-scaffold, branch-protection, signed-commits, secret-scanning, dependabot-alerts,
dependabot-security-updates, private-vuln-reporting, codeql-default-setup, fork-to-acehack,
manual-next-steps). No errors.

## Next step — `--apply` execution (requires Aaron sign-off)

The tool is ready. Repo creation is irreversible so `--apply` needs an explicit decision.

**Use the GitHub Actions workflow** (`.github/workflows/scaffold-stage1-create-repos.yml`),
which provides actor allowlisting (AceHack only), a `CONFIRM` gate, `SCAFFOLD_STAGE1_PAT`
secret handling, and concurrency protection:

1. Ensure `SCAFFOLD_STAGE1_PAT` secret is set in LFG org/repo Settings → Secrets
   (PAT with `repo`, `read:org`, `workflow` scopes for an org owner/admin account)
2. Navigate to **Actions → scaffold-stage1-create-repos → Run workflow**
3. Choose `repo: both` (or `forge`/`ace` individually), type `CONFIRM` in the confirm field
4. The workflow runs a dry-run preview first, then creates the repos

The dry-run can also be verified locally (no external effects):

```bash
bun tools/scaffold/create-repo.ts --repo forge --dry-run
bun tools/scaffold/create-repo.ts --repo ace  --dry-run
```

After `--apply` completes, the checklist of manual steps from step 07 applies:

1. Upload SVG social-preview PNG via GitHub UI (requires rasterized PNG)
2. Enable merge queue via GitHub UI (Settings → Merge queue — no REST API)
3. Wire Semgrep gate step into CI (`.semgrep.yml` already in scaffold; CI job wired in Stage 2)
4. Add required status checks after CI workflows land (branch protection created with empty contexts to avoid deadlock)
5. Verify $0 budget caps at org level: github.com/organizations/Lucent-Financial-Group/settings/billing
6. Confirm CodeQL default-setup active: Security → Code scanning → Default setup

081KRFA460008QG0R001H98EXJ closes when both repos exist at LFG/Forge + LFG/ace and the ADR is updated with
Stage 1 completion note.

## Composes with

- 081KRFA460008QG0R003JQ46J4 (product-repo split planning) — sibling backlog row
- `.claude/rules/lfg-acehack-topology.md` — LFG = active dev; AceHack
  = mirror; both forks already exist for Zeta
- `memory/feedback_aaron_civsim_forkable_pvp_raids_destiny_style_mutual_privacy_no_strategic_advantage_game_design_2026_05_13.md`
  — civsim forkable design property (PR #2903)
- `memory/feedback_aaron_grants_otto_strategic_encryption_decision_authority_team_decides_what_to_git_crypt_civsim_strategic_substrate_post_decision_audit_2026_05_13.md`
  — Otto's strategic encryption authority composes here (PR #2902)

## Why P1

- Substrate already exists; Stage 1 is execution
- Unblocks Stage 2 (move Forge content) and downstream
- Aaron has explicitly asked for the easy-to-track backlog surface
- Composes with the canonical product framing (PR #2851)

## Definition of done

- Both repos exist at LFG/Forge + LFG/ace
- Best-practice scaffolding checklist 100% applied
- Day-one governance files in place
- Branch protection + budget caps + CodeQL active
- ADR updated with Stage 1 completion note
- This backlog row closed with PR link to Stage-1-execution commits
