# GitHub repo settings — declared state

This doc is the **declarative source of truth** for every GitHub
repo setting that GitHub does not itself expose as a checked-in
config file. Workflow YAML, CODEOWNERS, Dependabot config, and
pre-commit hooks are already declarative in-tree — not tracked
here. What *is* tracked here: click-ops toggles that live inside
GitHub's UI or require API calls to change.

The machine-readable companion is
[`src/Core.TypeScript/hygiene/github-settings.expected.json`](../src/Core.TypeScript/hygiene/github-settings.expected.json).
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
   `src/Core.TypeScript/hygiene/github-settings.expected.json` — normalized
   output of `src/Core.TypeScript/hygiene/snapshot-github-settings.ts`.
2. **Drift detector** is `src/Core.TypeScript/hygiene/check-github-settings-drift.ts`.
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
   `snapshot-github-settings.ts`, commit the new expected
   JSON alongside whatever configuration caused the drift,
   with a message explaining *why* the setting changed.

See `docs/FACTORY-HYGIENE.md` row #40 for the full cadence /
owner / scope specification.

## Reconciliation of 2026-08-25 — timeline first

The record below (`github-settings.expected.json`) was last
fully refreshed in PR #8073. Between then and 2026-08-25 the
live settings moved and the record did not, and the drift
workflow that would have said so is `continue-on-error: true`,
so it said it into a log nobody read. Three of the
differences were in the **permissive** direction: the record
understated what protects `main`.

Timeline of the live changes, from the ruleset version-history
API (`GET /repos/{repo}/rulesets/{id}/history`). All times UTC;
every edit was made by user id 578953 except where noted.

| when (UTC) | ruleset | change |
|---|---|---|
| 2026-05-08T11:14:55Z | 16134995 CI Gate | active, 7 required contexts, no bypass actors |
| 2026-05-10T09:25:02Z | 16189060 Branch Safety | active: `deletion` + `non_fast_forward` + `required_linear_history` |
| 2026-05-27T14:15:45Z | 16934633 Heartbeat | active: `deletion` + `non_fast_forward` |
| 2026-06-01T09:54:41Z | 16134995 CI Gate | drops `build-and-test (ubuntu-24.04-arm)` |
| 2026-06-01T09:56:49Z | 16134995 CI Gate | drops `build-and-test (macos-26)` -> the 5 contexts the record still listed |
| 2026-06-04T17:28:52Z | 16134995 CI Gate | **enforcement -> `disabled`** (this is the last state the record was right about) |
| 2026-07-21T22:40:44Z | 19490341 Copilot review | created, active (user id 10137) |
| 2026-08-01T16:15:04Z | 16934633 Heartbeat | **`non_fast_forward` REMOVED** |
| 2026-08-01T16:17:01Z | 16189060 Branch Safety | **`required_linear_history` REMOVED** |
| 2026-08-01T16:17:01Z | 19490341 Copilot review | enforcement -> `disabled` |
| 2026-08-13T15:57:29Z | 16134995 CI Gate | **enforcement -> `active`**, required contexts replaced by the single `gate (required)` |
| 2026-08-13T21:50:54Z | 16134995 CI Gate | **`bypass_actors` gains `{RepositoryRole 5, bypass_mode: pull_request}`** |
| 2026-08-25T13:21:25Z | 16934633 Heartbeat | `conditions` edit, reconciled in-tree by PR #15359 |

So the record has been wrong about whether the CI gate is on
for **11 days**, and has never at any point been able to say
whether anyone could bypass it, because the snapshot did not
capture `bypass_actors` at all.

## Adjudication — is LIVE right, or is the RECORD right

Reconciling a record to a bad live state is laundering, so
each difference gets a verdict rather than a re-snapshot.
Recording a value here is **not** endorsement of it: this
file is a raw vault — a single version of the facts. Intent
lives in `docs/operations/rulesets/` (the reconciler's
desired state) and in `docs/BUGS.md` for the contested rows.

| # | field | recorded was | live is | verdict |
|---|---|---|---|---|
| 1 | `repo.has_downloads` | `true` | `false` | **live is right.** The legacy downloads API is deprecated and unused here; off is the narrower setting. Record it. |
| 2 | `rulesets[16134995].enforcement` | `disabled` | `active` | **live is right, and the record was wrong in the permissive direction.** `CLAUDE.md` §Ship and the heartbeat-lane design both depend on this gate being on. Record it. |
| 3 | `rulesets[16134995]` required contexts | 5 named jobs | `gate (required)` | **live is right.** `gate.yml` aggregates the legs into one required check; the 5 named contexts no longer exist under those names. A record naming contexts that cannot report is worse than no record. |
| 4 | `rulesets[16134995].bypass_actors` | *not captured* | `RepositoryRole 5 (admin), pull_request` | **CONTESTED — recorded as fact, not endorsed.** Repository admins can merge a PR to `main` without `gate (required)` passing. Verified empirically, not read off a table: `GET /rulesets/16134995` returns `current_user_can_bypass: "pull_requests_only"` for an account whose `permissions.admin` is `true`, and `"never"` for ruleset 16189060 which has no bypass actors. Filed P0-security in `docs/BUGS.md`. |
| 5 | `rulesets[16189060]` Branch Safety | had `required_linear_history` | removed 2026-08-01 | **CONTESTED — recorded as fact, not endorsed.** Effective coverage is unchanged *today* because classic branch protection on `main` still carries `required_linear_history: true` (verified live). But the ruleset is the durable surface and classic protection is the legacy one, so the repo is now relying on the weaker of its two guards. Filed P1 in `docs/BUGS.md`. |
| 6 | `rulesets[16934633]` Heartbeat | had `non_fast_forward` | removed 2026-08-01 | **live matches the committed desired state**, so the record follows it — but note the order of events honestly: the removal happened 2026-08-01 and the desired-state file that contains only `deletion` landed 2026-08-25 in PR #15349. The file ratified an existing live state rather than causing it. Force-push to `heartbeat/*` is currently permitted. Raised for the operator, not filed as a bug: the heartbeat lanes are machine-written and re-derivable. |
| 7 | ruleset 19490341 "Code Quality Copilot review" | **absent from the record entirely** | present, `enforcement: disabled` | **live is right.** A whole ruleset existed for a month with nothing in-tree naming it. This is the same invisibility as #4 at a coarser grain. Recorded. |
| 8 | `workflows` | 30 entries | 90 exist | **NEITHER — this was a tool defect.** `/actions/workflows` pages at 30 and the snapshot read one page with `--jq`, which suppresses `--paginate`. Two thirds of the inventory, every one of which can be `disabled_manually`, was outside the detector's field of view. Fixed; all 90 recorded. |
| 9 | `pages.build_type` | `legacy` | `workflow` | **live is right.** Pages deploys from a workflow now. Record it. |
| 10 | `codeql_default_setup.languages` | 7 languages | +`c-cpp` | **live is right** and it is a tightening. Record it. |
| 11 | `counts.actions_secrets` | `10` | `15` | **live is right.** Stated limit: this row is a COUNT, not a name list, so it can only witness "no secret was added or removed" — it cannot distinguish a rotation from a substitution. |

### Fields this record still cannot see

`bypass_actors` is captured as of this PR. Two limits remain
and are recorded rather than closed:

- **Under `GITHUB_TOKEN` the check verifies about 21 fewer
  fields than the record contains** — branch protection,
  Actions permissions, CodeQL default setup,
  `security_and_analysis`, and the merge-settings group are
  *recorded in-tree and not checked*. The drift tool now
  prints that set by name on every run with the endpoint each
  field came from. The fix is a credential
  (`DRIFT_DETECTOR_PAT`), and configuring it is the
  operator's call.
- **The refused shortcut**, written down so nobody reaches
  for it: re-snapshotting with the CI token would replace
  those ~21 recorded values with `_skipped` sentinels, the
  checker drops sentinels from both sides, and the run goes
  green. That converts *recorded and unchecked* into *absent
  and unchecked* while manufacturing the appearance of
  success. `snapshot-github-settings.test.ts` now fails if
  any sentinel appears in the committed record, so this
  cannot land by accident.

> **Sections below this line are PROSE and several are stale.**
> They describe a single ruleset with six rules, five named
> required status checks, zero Actions secrets, and five
> workflows. Live as of 2026-08-25: five rulesets, one required
> check named `gate (required)`, 15 Actions secrets, 90
> workflows, and `enforce_admins: true`. The JSON is
> authoritative, as the top of this file already says; the
> prose has not been rewritten here because doing it in the
> same change as the record reconciliation would make both
> harder to review. Tracked as work-item
> `081M0WSF2X2087G0R003F18DDJ`.

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

Overlaps with the ruleset; kept as defence-in-depth. Five
required status checks (strict mode):

- `build-and-test (ubuntu-22.04)`
- `lint (semgrep)`
- `lint (shellcheck)`
- `lint (actionlint)`
- `lint (markdownlint)`

Note on `build-and-test (macos-14)`: intentionally NOT in the
required-checks list on the canonical repo. The `gate.yml`
workflow computes its matrix from `github.repository` at plan
time, so the macos-14 leg only exists on contributor forks, not
on the canonical repo. Cost rationale: macOS runner minutes run
≈10× Linux minutes; keeping the canonical-repo gate Linux-only
while forks retain the full Linux+macOS parity matrix buys
cross-platform coverage on the contributor side without billing
it against the canonical-repo cost surface. Reason: maintainer
2026-04-21 "Mac is very very expensive to run" + "we should
leave [the canonical repo's] build as linux only if that's
possible where a contributor fork also builds mac".

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
bun src/Core.TypeScript/hygiene/snapshot-github-settings.ts \
  --repo Lucent-Financial-Group/Zeta \
  > src/Core.TypeScript/hygiene/github-settings.expected.json
git add src/Core.TypeScript/hygiene/github-settings.expected.json
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

## Architectural target — three-ruleset split (081KQGDBJ0008QG0R0028YTDQ2 Phase 1 audit)

Per the human maintainer 2026-05-01 — *"the settings that are there
are accidental complexity not intentional, we want best practices and
to prefer the git native settings over the legacy github ui/cli only
settings, these are nasty thats why they are legacy"* + *"splitting
rulesets so you could have all always on but multiple smaller rulesets."*

### Migration matrix — branch protection field → ruleset rule

Audit performed 2026-05-01 against live state of `Lucent-Financial-Group/Zeta`.

| Branch protection field | Current state | Ruleset rule equivalent | Migration plan |
|---|---|---|---|
| `allow_deletions` | `false` | `deletion` rule | Already in `Default` ruleset → keep on ruleset, can remove from branch protection |
| `allow_force_pushes` | `false` | `non_fast_forward` rule | Already in `Default` ruleset → keep on ruleset, can remove from branch protection |
| `allow_fork_syncing` | `false` | (no equivalent) | **Branch-protection-only legacy** — keep in branch protection |
| `block_creations` | `false` | (no direct equivalent) | Off anyway; can remove |
| `enforce_admins` | `false` | (rulesets default-enforce against admins unless bypass-actors set) | Rulesets handle admins differently; verify policy intent |
| `lock_branch` | `false` | (no equivalent) | Off anyway; can remove |
| `required_conversation_resolution` | `true` | `required_review_thread_resolution` rule (verify exact name in REST API) | **MIGRATE** — add rule to Review-process ruleset |
| `required_linear_history` | `true` | `required_linear_history` rule | Already in `Default` ruleset → keep on ruleset, can remove from branch protection |
| `required_pull_request_reviews` | configured | `pull_request` rule (broader scope) | Already in `Default` ruleset (more comprehensive) → keep on ruleset, can remove from branch protection |
| `required_signatures` | `false` | `required_signatures` rule | Off anyway; can remove |
| `required_status_checks` | configured (7 contexts, `strict: false`) | `required_status_checks` rule | **MIGRATE** — primary work; add to CI-gate ruleset |

### Three-ruleset target shape

After migration, the single `Default` ruleset splits into three concern-aligned smaller rulesets, all `enforcement: active`, all conditioned on `~DEFAULT_BRANCH`.

#### Ruleset 1 — "Branch integrity"

Concern: physical-git-history protection. Lowest-level invariants
that should never be temporarily disabled.

Rules:

- `deletion`
- `non_fast_forward`
- `required_linear_history`

#### Ruleset 2 — "Review process"

Concern: human and AI review gating before merge. Occasionally
adjusted (emergency-fix lanes; auto-review tuning).

Rules:

- `pull_request` (review thread resolution + allowed merge methods + required reviewers + dismiss-stale-reviews)
- `copilot_code_review` (auto-review on draft + push)
- `required_review_thread_resolution` (migrated from branch protection's `required_conversation_resolution`)

#### Ruleset 3 — "CI gate"

Concern: required status checks must pass before merge. Evolves
most frequently (every new workflow / lint / check).

Rules:

- `required_status_checks` migrated from branch protection. Contexts: the 7 currently in branch protection (`build-and-test (macos-26)` / `build-and-test (ubuntu-24.04)` / `build-and-test (ubuntu-24.04-arm)` / `lint (actionlint)` / `lint (markdownlint)` / `lint (semgrep)` / `lint (shellcheck)`) plus the memory-* lints + backlog-index-integrity + tick-history-order
- `strict: false` (parallel-PR-friendly; preserved per session-cluster experience)

### Branch protection — minimized post-migration

After migration, branch protection should retain only fields with no
ruleset equivalent:

- `allow_fork_syncing: false` (legacy-only)

All other branch-protection settings become redundant and should be
removed (their ruleset equivalents take over enforcement).

### Why git-native preferred over legacy UI/CLI-only

Aaron 2026-05-01: *"these are nasty thats why they are legacy."*

- **Rulesets** can be exported via REST API as JSON, edited, and
  applied via REST API — declarative-as-code shape (even if not in
  a `.github/ruleset.yml` file natively, the JSON in
  `src/Core.TypeScript/hygiene/github-settings.expected.json` IS the source of
  truth)
- **Branch protection** has the same REST API surface but predates
  rulesets and lacks granularity (single big object; can't be split
  by concern)
- **GitHub UI checkboxes** introduce click-ops drift that
  `github-settings-drift.yml` only catches retroactively; the
  reconciliation script direction (Phase 2 of 081KQGDBJ0008QG0R0028YTDQ2) makes drift
  structurally impossible by reversing the flow (always edit the
  expected.json first, then apply via script)

### Reconciliation script (Phase 2 mechanization)

Envisioned (not yet implemented):
`tools/hygiene/apply-github-settings.ts` — reads
`src/Core.TypeScript/hygiene/github-settings.expected.json` and applies via `gh
api PUT/POST/DELETE` to the host. Idempotent. Run with `--dry-run`
to preview, then without to apply. Composes with the existing
`snapshot-github-settings.ts` (read-only) and
`check-github-settings-drift.ts` (diff-only) — `apply` is the third
verb that closes the loop.

After Phase 2 ships, every settings change flows through:

1. Edit `src/Core.TypeScript/hygiene/github-settings.expected.json`
2. Run `apply-github-settings.ts` (verifies + applies)
3. Drift workflow stays green by construction

Click-ops drift becomes structurally impossible — any host change
that wasn't applied via the script gets caught by the drift workflow
on next run.

## Related

- `src/Core.TypeScript/hygiene/snapshot-github-settings.ts` — generates the
  normalized JSON.
- `src/Core.TypeScript/hygiene/check-github-settings-drift.ts` — the drift
  detector.
- `.github/workflows/github-settings-drift.yml` — cadence
  workflow.
- `docs/FACTORY-HYGIENE.md` row #40 — the hygiene row.
- `docs/backlog/P1/081KQGDBJ0008QG0R0028YTDQ2-github-settings-ruleset-split-git-native-preferred-aaron-202.md`
  — the multi-phase refactor row this audit serves.
