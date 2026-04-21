# GitHub repo settings — declared state

This doc is the **declarative source of truth** for every GitHub
repo setting that GitHub does not itself expose as a checked-in
config file. Workflow YAML, CODEOWNERS, Dependabot config, and
pre-commit hooks are already declarative in-tree — not tracked
here. What *is* tracked here: click-ops toggles that live inside
GitHub's UI or require API calls to change.

The machine-readable companion is
[`tools/hygiene/github-settings.expected.json`](../tools/hygiene/github-settings.expected.json).
That JSON file is **authoritative** — if this markdown ever
disagrees with it, the JSON wins and this file gets updated.

Motivation (human maintainer, 2026-04-21):

> "its nice having the expected settings declarative defined"
>
> "i hate things in GitHub where I can't check in the
> declarative settgins so we will save a back[up]"

The same day we transferred `AceHack/Zeta` →
`Lucent-Financial-Group/Zeta` and discovered that GitHub's
org-transfer code path silently flipped `secret_scanning` and
`secret_scanning_push_protection` from `enabled` to `disabled`.
That silent drift is exactly what this system detects.

## How this works

1. **Expected state** is recorded in
   `tools/hygiene/github-settings.expected.json` — normalized
   output of `tools/hygiene/snapshot-github-settings.sh`.
2. **Drift detector** is `tools/hygiene/check-github-settings-drift.sh`.
   It re-runs the snapshot against the live repo and diffs
   against the expected JSON. Exit 0 on match, 1 on drift.
3. **Cadence** is enforced by
   `.github/workflows/github-settings-drift.yml` — weekly cron
   + `workflow_dispatch` for manual runs. Drift blocks the
   weekly run (visible in Actions tab as a failing job);
   resolve by either reverting the unexpected change or
   re-snapshotting and committing the new expected.
4. **On any settings change** (ruleset edit, new required
   check, flipped security toggle, new environment, ...) the
   same-commit obligation is: re-run
   `snapshot-github-settings.sh`, commit the new expected
   JSON alongside whatever configuration caused the drift,
   with a message explaining *why* the setting changed.

See `docs/FACTORY-HYGIENE.md` row #40 for the full cadence /
owner / scope specification.

## What's captured

### Repo-level toggles

- Merge methods: squash on; merge commit and rebase off.
  (`merge_commit_message` + `merge_commit_title` are still
  captured even though merge-commit is off — the defaults
  determine format if we ever flip the toggle on.)
- Auto-merge enabled; update branch button enabled;
  auto-delete branch on merge enabled;
  `use_squash_pr_title_as_default` off (explicit PR-title-or-
  commit-title selection still applies).
- `allow_forking` on — required for the fork-based PR
  workflow (contributors develop on personal forks and submit
  PRs back to this repo; keeps the base repo's cost surface
  thin).
- Squash commit title: PR title (falls back to commit title
  for single-commit PRs); squash commit message: concatenated
  commit messages.
- Web commit signoff not required (public repo, pre-v1).
- Visibility: public. `archived: false`, `disabled: false`,
  `is_template: false`.
- Description: "F# implementation of DBSP for .NET 10".
  Homepage: `https://lucent-financial-group.github.io/Zeta/`.
- Topics: empty (no classification tags yet).
- Features enabled: issues, discussions, projects, wiki,
  downloads, pull-requests, pages.
- `pull_request_creation_policy: all` — anyone with push
  access (collaborators + org members per team perms) can
  open PRs.
- `custom_properties`: empty object — no org-level custom
  repo properties set yet.
- Security-and-analysis: Dependabot security updates enabled;
  secret scanning enabled; secret scanning push-protection
  enabled; non-provider-pattern scanning, AI detection,
  delegated-alert-dismissal, delegated-bypass, and validity
  checks all disabled (higher false-positive / seat-cost
  profile; revisit post-v1).

### Repo security extras

- Vulnerability alerts (Dependabot alerts) enabled.
- Automated security fixes (Dependabot auto-PRs) enabled,
  not paused.
- Private vulnerability reporting enabled — external
  researchers can open confidential advisories via the
  Security tab.
- Interaction limits: none (would be `interaction_limits:
  {limit, origin, expires_at}` when active — used to rate-
  limit comment/issue activity during incident response).
- Autolinks: none — no external issue-tracker linking.
- Topics: empty — no discovery tags.

### Rulesets

Single ruleset named `Default` (id 15256879), enforcement
`active`, target `branch`, condition
`ref_name.include = ["~DEFAULT_BRANCH"]`. Six rules:

1. **Deletion** — block default-branch deletion.
2. **Non-fast-forward** — block non-fast-forward pushes.
3. **Copilot code review** — review draft PRs + review on
   push.
4. **Code quality** — severity all.
5. **Pull request** — squash-only merge method;
   `required_review_thread_resolution: true`;
   `required_approving_review_count: 0` (agent-authored
   repo — human review not required, AI review is via the
   copilot-code-review and code-quality rules above).
6. **Required linear history**.

Note on the **`code_scanning` rule**: we toggled it OFF
2026-04-21 because it binds to CodeQL *default-setup*
configurations and Zeta uses *advanced-setup*
(`.github/workflows/codeql.yml` with `build-mode: manual`
for csharp + per-language SARIF upload). The rule returned
NEUTRAL / "1 configuration not found" and blocked PR #42
despite all advanced-setup sub-jobs passing. Diagnostic:
`gh api /repos/<owner>/<repo>/code-scanning/default-setup
--jq .state` returns `not-configured` on advanced-only
setups; the rule requires this state to be `configured`.
Re-enabling requires either (a) enabling default-setup
alongside advanced — unverified coexistence, duplicate
compute, or (b) discovering whether the rule can bind to
advanced-setup (untested).

### Classic branch protection (on `main`)

Overlaps with the ruleset; kept as defence-in-depth. Six
required status checks (strict mode):

- `build-and-test (ubuntu-22.04)`
- `build-and-test (macos-14)`
- `lint (semgrep)`
- `lint (shellcheck)`
- `lint (actionlint)`
- `lint (markdownlint)`

Other protections: dismiss stale reviews on; required linear
history; required conversation resolution; force pushes and
deletions blocked; enforce_admins off.

### Actions

- Actions enabled; `allowed_actions: all`.
- Variables (2):
  - `COPILOT_AGENT_FIREWALL_ENABLED = "true"`
  - `COPILOT_AGENT_FIREWALL_ALLOW_LIST_ADDITIONS = " "` (space —
    no additions beyond the Copilot firewall defaults).
- Secrets (0): no Actions secrets. Any future secret addition
  must be accompanied by a rationale in this doc.

### Workflows (5 active)

Static (checked-in):

- `.github/workflows/codeql.yml` (CodeQL)
- `.github/workflows/gate.yml` (gate matrix: build, test,
  lint, semgrep)

Dynamic (GitHub-managed):

- Copilot code review
- Dependabot Updates
- Automatic Dependency Submission (NuGet)

### Environments

- `github-pages` environment with one `branch_policy`
  protection rule — deployments only from `main`.

### GitHub Pages

- Build type: `workflow`.
- Source: branch `main`, path `/`.
- HTTPS enforced: yes.
- URL:
  `https://lucent-financial-group.github.io/Zeta/` (transferred
  from `https://acehack.github.io/Zeta/` on 2026-04-21).

### CodeQL default-setup

- State: `not-configured` (intentional — we use advanced
  setup via `.github/workflows/codeql.yml`).

### Webhooks + deploy keys + secrets

- Webhooks: 0.
- Deploy keys: 0.
- Actions secrets: 0.
- Dependabot secrets: 0.

## What's NOT captured

- **Workflow YAML** — already declarative in
  `.github/workflows/`.
- **CODEOWNERS** — already declarative in `.github/CODEOWNERS`
  if/when we add one.
- **Dependabot config** — already declarative in
  `.github/dependabot.yml`.
- **Pre-commit hooks** — already declarative in
  `.pre-commit-config.yaml` if/when we add one.
- **`.github/copilot-instructions.md`** — already declarative;
  audited under FACTORY-HYGIENE row 14.
- **Secret values** — the counts are captured; the values
  would be a security hole. Never write secret values here.
- **Individual user/team permissions on the org** — org-level,
  out of scope for per-repo declaration. If this ever grows,
  consider a sibling `docs/ORG-SETTINGS.md` with the same
  pattern applied to the org.
- **Transient statuses** — `security_and_analysis.*.url`,
  timestamps, etc. The snapshot script strips these.

## How to update

```bash
# After making an intentional settings change in GitHub
# UI or via API, re-snapshot and commit:
tools/hygiene/snapshot-github-settings.sh \
  --repo Lucent-Financial-Group/Zeta \
  > tools/hygiene/github-settings.expected.json
git add tools/hygiene/github-settings.expected.json
# If the human-readable narrative also needs updating,
# edit docs/GITHUB-SETTINGS.md to match.
git commit -m "chore(settings): <what changed + why>"
```

Unintentional drift (detected by the weekly drift workflow or
a manual run) is fixed in the opposite direction: revert the
setting in GitHub, rerun the detector to confirm match, and
record the drift source in the PR body (or an ADR under
`docs/DECISIONS/` if the diagnosis is non-trivial and worth
preserving for future maintainers).

## Related

- `tools/hygiene/snapshot-github-settings.sh` — generates the
  normalized JSON.
- `tools/hygiene/check-github-settings-drift.sh` — the drift
  detector.
- `.github/workflows/github-settings-drift.yml` — cadence
  workflow.
- `docs/FACTORY-HYGIENE.md` row #40 — the hygiene row.
