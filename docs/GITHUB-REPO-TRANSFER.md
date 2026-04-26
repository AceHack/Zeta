# GitHub Repo Transfer — Data Layer

This doc is the **data layer** for GitHub repository
transfers: the known-gotcha catalogue, the "what survives /
what doesn't" inventory, adapter-neutrality notes, and the
worked-example summaries that back the routine.

The executable routine (the **behaviour layer**) lives at
[`.claude/skills/github-repo-transfer/SKILL.md`](../.claude/skills/github-repo-transfer/SKILL.md).
Peer to [`docs/GITHUB-SETTINGS.md`](GITHUB-SETTINGS.md)
(declarative scorecard), [`docs/AGENT-GITHUB-SURFACES.md`](AGENT-GITHUB-SURFACES.md)
(ten-surface playbook), and
[`docs/hygiene-history/repo-transfer-history.md`](hygiene-history/repo-transfer-history.md)
(fire-history event log).

Why split? The human maintainer on 2026-04-22:
*"seperating thing by data and behiaver is a tried and true way
and you mentied it for the skills earler, works in code too lol"*.
The skill encodes *how* to transfer; this doc encodes *what*
we know about transfers — the gotchas, the inventory, the
worked examples. They change at different rates and should
be versioned at different cadences.

## What survives a transfer

GitHub's native transfer (`POST /repos/<owner>/<name>/transfer`)
preserves all of the following across the cutover:

- **Stars, watches, forks** — counts and relationships.
- **Issues, PRs, releases** — with all history, labels,
  assignments, linked commits.
- **Commit history and branches** — git objects are
  unchanged; SHAs match byte-for-byte.
- **Tags and releases** — including release artifacts
  attached to releases.
- **Wiki content** (if wiki was enabled) — pages survive;
  the `.wiki.git` clone URL changes to reflect the new
  owner.
- **Discussions** — all threads, categories, answered
  state.
- **Most repo-level settings** — default branch, merge
  methods, auto-merge, allow-forking, description,
  homepage, topics, features enabled, web-commit-signoff
  setting, `pull_request_creation_policy`, visibility.
- **Branch protection rules** — survive with the same
  configuration and same required-check names.
- **Rulesets** — survive (ruleset IDs preserved).
- **Workflows and Actions** — `.github/workflows/**` are
  in-tree so they're trivially preserved; any CI state
  (variables, secrets) survives by name.
- **Deploy keys** — survive.
- **Webhooks** — survive, but verify they still route
  where expected (external services may key on owner in
  their side of the hook).
- **URL redirects** — old `https://github.com/<old>/<name>/...`
  URLs auto-redirect to the new owner/name for web
  traffic and API reads. Redirect is long-lived but not
  a contract; migrate at leisure.

## What silently breaks or changes

A transfer surfaces these changes *without* sending a
notification. Every entry here is something the
declarative-scorecard diff (`tools/hygiene/check-github-settings-drift.sh`
after `tools/hygiene/snapshot-github-settings.sh`) should
catch. Until GitHub documents the transfer code path
comprehensively, treat this list as empirical.

### S1 — `secret_scanning` silently flips `enabled` → `disabled`

**Observed.** 2026-04-21 `AceHack/Zeta` → `Lucent-Financial-Group/Zeta`.

**Cause.** GitHub's org-transfer code path runs a re-apply
of org-level security policies over the transferred repo.
If the target org's default posture doesn't include
secret-scanning-enabled, the setting resets to the org
default — even if the source repo had it explicitly on.

**Detection.** Scorecard diff shows
`security_and_analysis.secret_scanning.status` changing
`enabled` → `disabled`.

**Fix.**
```bash
gh api --method PATCH /repos/<new>/<name> \
  -f security_and_analysis='{"secret_scanning":{"status":"enabled"}}'
```
Confirm with re-snapshot.

### S2 — `secret_scanning_push_protection` silently flips `enabled` → `disabled`

**Observed.** Same transfer as S1; both flipped together.

**Cause.** Same org-default re-apply pattern as S1.

**Detection.** Scorecard diff shows
`security_and_analysis.secret_scanning_push_protection.status`
changing `enabled` → `disabled`.

**Fix.**
```bash
gh api --method PATCH /repos/<new>/<name> \
  -f security_and_analysis='{"secret_scanning_push_protection":{"status":"enabled"}}'
```

### S3 — GitHub Pages URL changes host

**Observed.** 2026-04-21 transfer. Pages URL went from
`https://acehack.github.io/Zeta/` to
`https://lucent-financial-group.github.io/Zeta/`.

**Cause.** Pages URLs encode owner in the subdomain;
transfer necessarily changes them.

**Detection.** `homepage` field in scorecard changes;
`gh api /repos/<new>/<name>/pages --jq .html_url` returns
the new URL.

**Fix.** Update `homepage` field, README badges, any
doc that hardcodes the old URL. Old URL auto-redirects
but new URL is the stable contract.

### S4 — Repo web URL and clone URLs change

**Observed.** Every transfer.

**Cause.** Structural — URLs encode owner/name.

**Detection.** Scorecard shows `html_url`, `clone_url`,
`ssh_url`, `git_url`, `svn_url` all changed.

**Fix.** Update local git remotes:
```bash
git remote set-url origin https://github.com/<new>/<name>.git
```
Old URLs redirect for web; the API follows transfer
redirects for reads. Pushes to old URLs *may* break
depending on auth flow.

### S5 — `code_scanning` ruleset rule NEUTRAL with "1 configuration not found"

**Observed.** Post-2026-04-21 transfer surfaced this on
PR #42, though the root cause was not a transfer artefact —
the rule binds to CodeQL **default-setup** config, and the
repo uses **advanced-setup** (via `.github/workflows/codeql.yml`).
The rule's pre-transfer behaviour on `AceHack/Zeta` was the
same; the transfer just made us notice.

**Detection.** Ruleset rule NEUTRALs, blocks merge even
when all advanced-setup SARIF jobs pass.

**Diagnostic.**
```bash
gh api /repos/<new>/<name>/code-scanning/default-setup \
  --jq .state
# "not-configured" → rule will always NEUTRAL on this repo
# "configured"     → rule will evaluate against default-setup
```

**Three fixes, pick one.**

1. Turn off the `code_scanning` ruleset rule (chosen
   2026-04-21 — advanced-setup SARIF uploads still gate
   merges via required status checks, so security
   coverage is preserved).
2. Enable default-setup *alongside* advanced (unverified
   coexistence; potential duplicate compute).
3. Migrate to default-setup only (loses per-path gate
   precision that advanced-setup provides).

**Previously captured in.**
`memory/reference_github_code_scanning_ruleset_rule_requires_default_setup.md`.

### S6 — Merge queue capability gate (user → org transfer unlock)

**Observed.** Diagnosed 2026-04-21 while troubleshooting
"why won't merge queue enable on `AceHack/Zeta`".
`POST /repos/AceHack/Zeta/rulesets` returned 422 with
`{"errors":["Invalid rule 'merge_queue': "]}`. Platform
gate: merge queue is available only for
organization-owned repositories on any plan tier.

**Detection.** Check the *owner* type, not the plan:
```bash
gh api /users/<owner> --jq .type
# "User" → merge queue unavailable
# "Organization" → merge queue available
```

**Implication.** A user-to-org transfer **unlocks**
merge queue as a capability. If that was part of the
transfer rationale, plan to enable it **after** the
`merge_group:` workflow triggers are already on `main`
(they're no-ops while merge queue is off; ready when it
flips on).

**Previously captured in.**
`memory/feedback_merge_queue_structural_fix_for_parallel_pr_rebase_cost.md`
Rev 2026-04-21.

### S7 — Branch-protection / ruleset overlap audit

**Observed.** Not a transfer-specific break, but transfers
surface the overlap. Classic branch protection rules and
rulesets can both apply to `main` with overlapping but
non-identical required-check lists.

**Detection.** Post-transfer, enumerate both:
```bash
gh api /repos/<new>/<name>/branches/main/protection \
  --jq '.required_status_checks.contexts'
gh api /repos/<new>/<name>/rulesets \
  --jq '.[] | {id, rules}'
```
Required-check names should agree. A check required by
one surface but not the other is a silent gap (the
looser surface is the effective policy).

**Fix.** Reconcile — either drop the looser surface or
bring the two required-check lists into agreement.

## Adapter neutrality — what maps to what

Zeta is on GitHub; the skill and this data layer are
written for GitHub. Adopters on other platforms map the
transfer primitive:

| Platform | Transfer endpoint | Notes on gotchas |
|---|---|---|
| GitHub | `POST /repos/<old>/<name>/transfer` | This document. |
| GitLab | `POST /projects/:id/transfer` | Preserves more than GitHub by default. CI variables scoped to groups may need re-linking; group-level policy re-apply is GitLab's analogue of the org re-apply step. |
| Gitea | `POST /repos/{owner}/{repo}/transfer` | Gotchas largely undocumented; first transfer on any Gitea instance is research. |
| Bitbucket | Workspace transfer (UI-historically; API coverage varies) | Ownership transfer conflates with workspace-move semantics. |

The routine shape (pre-scorecard → execute → post-diff →
heal) is adapter-agnostic. Only the specific API calls and
the list of silent drifts vary.

## Worked examples

### 2026-04-21 — `AceHack/Zeta` → `Lucent-Financial-Group/Zeta`

**Context.** User-owned repo moved to org the human maintainer
had already set up as the long-term home for LFG-related
work. Two drivers:

1. Contributor-facing fit (org repo matches the
   onboarding story for external contributors).
2. Platform-gated features (merge queue is org-only;
   see S6).

**Authorization.** `HB-001` in `docs/HUMAN-BACKLOG.md`
(now resolved). The human maintainer's three-message direction:
*"we can move tih to https://github.com/Lucent-Financial-Group at some point it's my org for LFG"* +
*"we need to move it to lucent for contributor at some point anyways, we want to keep all the settings we have now"* +
*"i think we are going to have to go without merge queue parallelism for now."*

**Execution.** `gh api --method POST /repos/AceHack/Zeta/transfer -f new_owner=Lucent-Financial-Group`.
Instant propagation (admin both sides — no
email-acceptance step required).

**Silent drifts caught.** S1 and S2 (secret-scanning +
secret-scanning-push-protection, both flipped
`enabled` → `disabled`). Healed same session via
`PATCH /repos/.../security_and_analysis`.

**Cross-cutting heal.**

- Local git remote updated same session.
- README badges + doc URLs fixed in commit `d96fe95`
  ("cleanup: update 4 outdated AceHack/Zeta URLs").
- Pages URL (S3) auto-redirected; new URL documented
  in `docs/GITHUB-SETTINGS.md`.
- CodeQL ruleset (S5) rule turned off; tradeoff
  documented.
- Merge queue (S6) unlock *noted*, not enabled same
  session — parked as a separate decision.

**Artifacts from this transfer** (the output of the
"map it out, absorb the experience" request):

- This document (gotcha catalogue seeded with S1-S7).
- `.claude/skills/github-repo-transfer/SKILL.md`
  (the routine).
- `docs/hygiene-history/repo-transfer-history.md`
  (fire-history, seeded with this event as the first
  row).
- `docs/GITHUB-SETTINGS.md` + `tools/hygiene/github-settings.expected.json`
  (the declarative scorecard the routine consumes).
- `tools/hygiene/snapshot-github-settings.sh` +
  `tools/hygiene/check-github-settings-drift.sh`
  (the scorecard tooling).
- `memory/project_zeta_org_migration_to_lucent_financial_group.md`
  (the memory).

**Lessons.** Every lesson from this transfer is encoded
in one of the artefacts above. The point of the
data/behaviour split is that a future agent reading
this doc + the skill + the fire-history **has the same
information** a session-transcript reader would have —
the retrospective is in the durable layer, not in
volatile chat.

## Cross-references

- [`.claude/skills/github-repo-transfer/SKILL.md`](../.claude/skills/github-repo-transfer/SKILL.md)
  — the behaviour layer (routine).
- [`docs/GITHUB-SETTINGS.md`](GITHUB-SETTINGS.md) — the
  declarative scorecard.
- [`docs/AGENT-GITHUB-SURFACES.md`](AGENT-GITHUB-SURFACES.md)
  — the ten-surface playbook informing the
  adjacent-surface scorecard and cross-cutting heal.
- [`docs/hygiene-history/repo-transfer-history.md`](hygiene-history/repo-transfer-history.md)
  — fire-history event log.
- `tools/hygiene/snapshot-github-settings.sh`,
  `tools/hygiene/check-github-settings-drift.sh` —
  scorecard tooling.
- `memory/project_zeta_org_migration_to_lucent_financial_group.md`
  — the worked-example memory.
- `memory/feedback_github_settings_as_code_declarative_checked_in_file.md`
  — the settings-as-code pattern.
- `memory/feedback_merge_queue_structural_fix_for_parallel_pr_rebase_cost.md`
  — S6 origin.
- `memory/reference_github_code_scanning_ruleset_rule_requires_default_setup.md`
  — S5 origin.
- `memory/feedback_blast_radius_pricing_standing_rule_alignment_signal.md`
  — pre-flight discipline.
- `memory/project_local_agent_offline_capable_factory_cartographer_maps_as_skills.md`
  — why this lives as a doc, not a session transcript.
