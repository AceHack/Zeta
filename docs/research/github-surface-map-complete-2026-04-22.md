# Complete GitHub surface map — user / repo / org / enterprise / platform

**Purpose.** Extend the existing ten-surface repo-level playbook
(`docs/AGENT-GITHUB-SURFACES.md`, pending land via speculative
batch 4) up one scope (org), sideways (enterprise), and across
(platform / cross-cutting). Aaron 2026-04-22:

> "you mapped out the user surface under AceHack earlier and
> wrote down the github surface map, use lucent and figure out
> all the apis you missed for orgs/teams/enterprise and map all
> those out too — the entire github surface then you can backlog
> it if you want"

The original ten-surface doc is AceHack-scoped (personal user
account + one repo). Post-transfer, Zeta lives under
`Lucent-Financial-Group` (an **org**, GitHub Team plan). Every
new scope brings new surfaces the factory may need to own,
audit, or at least monitor. This doc enumerates all of them so
no class is discovered by surprise.

## The scope ladder

```
User (personal account — AceHack)
  │
  ├─ Repo  (per-repo surfaces — 10-surface playbook, Aaron-defined)
  │
Org (Lucent-Financial-Group — Team plan)
  │
  ├─ Team  (sub-surface of org)
  │
Enterprise  (GHEC / GHEC-EMU — not yet; future scope)
  │
Platform / cross-cutting  (Copilot, Codespaces, Packages, Marketplace,
                            Sponsors, Pages, GHAS, Models, …)
  │
GitHub Apps / OAuth  (integrations)
```

Each level **contains** the level below: org settings propagate
defaults to repos, enterprise propagates to orgs. That
containment is the load-bearing reason the surface map must
span all scopes — a setting at the wrong scope is silent drift
(secret-scanning at repo level can't be enforced from above
without an org-level default).

## Where the original 10-surface doc sits

| # | Surface (original doc) | Scope | Status post-transfer |
|---|---|---|---|
| 1 | Pull Requests | Repo | Unchanged — `LFG/Zeta` |
| 2 | Issues | Repo | Unchanged — `LFG/Zeta` |
| 3 | Wiki | Repo | URL updated — `LFG/Zeta/wiki` |
| 4 | Discussions | Repo | URL updated — `LFG/Zeta/discussions` |
| 5 | Repo Settings (general) | Repo | Declarative, `docs/GITHUB-SETTINGS.md` |
| 6 | Copilot coding-agent | Repo (sub of 5) | `.github/copilot-instructions.md` |
| 7 | Agents tab | Repo | Tracked in the copilot-instructions surface |
| 8 | Security (repo) | Repo | Alerts/CodeQL/Dependabot at repo level |
| 9 | Pulse / Insights | Repo | Consume-only DORA signals |
| 10 | Pages | Repo | `lucent-financial-group.github.io/Zeta/` |

The map below adds everything *one scope up or sideways* from
these ten.

## Surface A — org (Lucent-Financial-Group)

### A.1 org profile + plan

- `GET /orgs/{org}` — org metadata (description, blog, billing_email, plan).
- `PATCH /orgs/{org}` — update org profile + permission defaults
  (the big lever).

**LFG snapshot 2026-04-22** (from `gh api /orgs/Lucent-Financial-Group`):

| field | value | flag? |
|---|---|---|
| `plan.name` | `team` | (Not Enterprise — GHAS features gated) |
| `plan.filled_seats / seats` | `2 / 2` | at-capacity |
| `two_factor_requirement_enabled` | `false` | **YES — financial-adjacent org; consider on** |
| `default_repository_permission` | `write` | high for open membership; acceptable at 2 seats |
| `members_can_create_repositories` | `true` | ADR-worthy at any real member count |
| `members_can_invite_outside_collaborators` | `true` | audit later |
| `members_can_delete_repositories` | `true` | high-blast-radius default |
| `members_can_change_repo_visibility` | `true` | public/private flip without admin |
| `members_can_fork_private_repositories` | `false` | **safer default — keep** |
| `web_commit_signoff_required` | `false` | pre-v1 OK |
| `deploy_keys_enabled_for_repositories` | `false` | SSH-key auth off by default |
| `advanced_security_enabled_for_new_repositories` | `false` | Team plan excludes GHAS (private-repo only) |
| `dependabot_alerts_enabled_for_new_repositories` | `false` | public repos get alerts regardless |
| `secret_scanning_enabled_for_new_repositories` | `false` | public repos get it free; private = paid |

Every one of these is a per-repo toggle too; org defaults
cascade. The `GITHUB-SETTINGS.md` pattern should extend with a
sibling `docs/ORG-SETTINGS.md` once multi-repo is real.

### A.2 org members + ownership

- `GET /orgs/{org}/members` — public+private members.
- `GET /orgs/{org}/public_members` — just public.
- `GET /orgs/{org}/memberships/{username}` — role: admin/member.
- `PUT /orgs/{org}/memberships/{username}` — invite + set role.
- `DELETE /orgs/{org}/memberships/{username}` — remove.
- `GET /orgs/{org}/invitations` — pending.
- `GET /orgs/{org}/invitations/{invitation_id}/teams` — invitation scope.
- `GET /orgs/{org}/failed_invitations` — audit of bounced invites.
- `GET /orgs/{org}/organization_roles` — custom org-admin roles.
- `GET /orgs/{org}/organization_roles/users` — who holds them.

**LFG snapshot:** 1 public member (AceHack). Aaron owner.
Ownership-assignment is a cadenced audit the moment a 2nd owner
ever joins.

### A.3 teams

- `GET /orgs/{org}/teams` — list teams.
- `POST /orgs/{org}/teams` — create.
- `GET /orgs/{org}/teams/{team_slug}` — team details.
- `PATCH /orgs/{org}/teams/{team_slug}` — update.
- `DELETE /orgs/{org}/teams/{team_slug}` — delete.
- `GET /orgs/{org}/teams/{team_slug}/members` — team members.
- `PUT /orgs/{org}/teams/{team_slug}/memberships/{username}` —
  add (with role=member|maintainer).
- `GET /orgs/{org}/teams/{team_slug}/repos` — team repo access.
- `PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}` — grant.
- `GET /orgs/{org}/teams/{team_slug}/teams` — sub-teams (nested
  hierarchy).
- `GET /orgs/{org}/teams/{team_slug}/external-groups` — IdP sync
  (enterprise SSO only).
- `GET /orgs/{org}/teams/{team_slug}/invitations` — pending invites.

**LFG snapshot:** 0 teams today. The moment LFG has ≥3 humans,
CODEOWNERS + team-gated reviews + team-scoped secrets become
worth the structure. Until then, flat membership is simpler.

### A.4 org webhooks

- `GET /orgs/{org}/hooks` — list.
- `POST /orgs/{org}/hooks` — create.
- `PATCH /orgs/{org}/hooks/{hook_id}` — update.
- `DELETE /orgs/{org}/hooks/{hook_id}` — delete.
- `POST /orgs/{org}/hooks/{hook_id}/pings` — test-fire.
- `GET /orgs/{org}/hooks/{hook_id}/deliveries` — delivery log.
- `GET /orgs/{org}/hooks/{hook_id}/deliveries/{id}/attempts` —
  retry audit.

**LFG today:** 0 (behind `admin:org_hook` scope, couldn't read,
but likely 0 since org is new). Every webhook is a data-egress
contract; org-level webhooks are more dangerous than repo-level
because they fan out across every repo. Include in the
`docs/GITHUB-SETTINGS.md` pattern as `docs/ORG-SETTINGS.md` →
org-hooks block.

### A.5 org Actions (secrets / variables / permissions / runners)

- `GET /orgs/{org}/actions/permissions` — org-wide allowed actions.
- `PUT /orgs/{org}/actions/permissions` — set.
- `GET /orgs/{org}/actions/permissions/repositories` — per-repo
  overrides.
- `GET /orgs/{org}/actions/permissions/workflow` — default
  workflow permissions.
- `GET /orgs/{org}/actions/secrets` — list org Actions secrets.
- `PUT /orgs/{org}/actions/secrets/{secret_name}` — create/update.
- `GET /orgs/{org}/actions/secrets/{secret_name}/repositories` —
  which repos can read the secret.
- `GET /orgs/{org}/actions/variables` — org Actions variables.
- `GET /orgs/{org}/actions/runners` — self-hosted runners
  (org-scoped).
- `GET /orgs/{org}/actions/runner-groups` — runner-group mgmt
  (paid-plan-only for most tiers).
- `GET /orgs/{org}/actions/cache/usage` — org-wide cache
  usage (billing signal).
- `GET /orgs/{org}/actions/cache/usage-by-repository` — per-repo.
- `GET /orgs/{org}/hosted-runners` — GitHub-hosted larger
  runners (paid; GHEC Team has some).

**LFG snapshot:** 0 org-level Actions secrets / runners.
Repo-level only. When Zeta needs a shared credential (NuGet
publish token, Homebrew tap deploy key) this is the scope to
use.

### A.6 org Dependabot

- `GET /orgs/{org}/dependabot/secrets` — Dependabot secrets
  (private-dep fetch credentials).
- `GET /orgs/{org}/dependabot/alerts` — org-wide alert rollup
  (GHAS; not on Team).
- `PUT /orgs/{org}/dependabot/secrets/{name}` — create/update.

### A.7 org Codespaces

- `GET /orgs/{org}/codespaces` — list codespaces org-wide
  (visibility + cost tracking).
- `GET /orgs/{org}/codespaces/secrets` — Codespaces secrets.
- `GET /orgs/{org}/codespaces/billing` — per-user billing.
- `GET /orgs/{org}/codespaces/access` — who can use org-billed.
- `PUT /orgs/{org}/codespaces/access/selected_users` — grant.

**Note:** Codespaces cost-tracking is a real lever — for a
small org, a runaway idle codespace is nontrivial.

### A.8 org packages

- `GET /orgs/{org}/packages?package_type={type}` — list
  (npm|maven|rubygems|nuget|container|docker).
- `GET /orgs/{org}/packages/{type}/{name}` — details.
- `GET /orgs/{org}/packages/{type}/{name}/versions` — versions.
- `DELETE /orgs/{org}/packages/{type}/{name}` — delete package.

Zeta doesn't publish packages yet. When `Zeta.Core` /
`Zeta.Core.CSharp` / `Zeta.Bayesian` go to NuGet.org, we'll
probably bypass GitHub Packages entirely — but GHCR containers
(if we ever ship benchmark images) would live here.

### A.9 org rulesets (org-level, cascades to repos)

- `GET /orgs/{org}/rulesets` — list.
- `POST /orgs/{org}/rulesets` — create.
- `GET /orgs/{org}/rulesets/{ruleset_id}` — details.
- `PATCH /orgs/{org}/rulesets/{ruleset_id}` — update.
- `DELETE /orgs/{org}/rulesets/{ruleset_id}` — delete.
- `GET /orgs/{org}/rulesets/rule-suites` — evaluation history.
- `GET /orgs/{org}/rulesets/rule-suites/{rule_suite_id}` — one
  evaluation.

Current single-repo deployment uses repo-level ruleset
`Default` (id 15256879). Once LFG has ≥3 repos, org-level
rulesets targeting `~ALL` repos would enforce the "no
force-push to default, required linear history, squash-only"
baseline globally — cheap win, defer until the 3-repo trigger.

### A.10 org custom properties + issue fields

- `GET /orgs/{org}/properties/schema` — custom-property schema
  (labels you can attach to repos for classification).
- `PUT /orgs/{org}/properties/schema` — redefine schema.
- `PATCH /orgs/{org}/properties/values` — set values on repos.
- `GET /orgs/{org}/properties/values?repository_query={query}` —
  query repos by property.
- `GET /orgs/{org}/issue-types` — org-level issue-type registry
  (beta).
- `GET /orgs/{org}/issue-fields` — org-level issue fields (beta).

**LFG snapshot:** empty schema. Candidate properties when
multi-repo: `tier` (infra/app/research), `scan-policy`
(full/minimal/none), `retire-target` (date), `maintainer`.

### A.11 org custom repo roles (GHEC only)

- `GET /orgs/{org}/custom-repository-roles` — NOT AVAILABLE on
  Team plan (confirmed 404 "Feature not available").

Defer unless LFG upgrades to Enterprise. Standard roles
(admin/maintain/write/triage/read) cover the current need.

### A.12 org security-managers + advisories

- `GET /orgs/{org}/security-managers` — teams with security-
  manager role (read all, manage code-scanning, secret-scanning,
  Dependabot alerts across the org).
- `PUT /orgs/{org}/security-managers/teams/{team_slug}` — grant.

**LFG snapshot:** 0. Wire this up the moment there's a 2nd
security-minded member. Cheap escalation lane.

- `GET /orgs/{org}/security-advisories` — repository-security-
  advisories visible to the org.
- `GET /orgs/{org}/secret-scanning/alerts` — GHAS (not on Team).
- `GET /orgs/{org}/code-scanning/alerts` — GHAS (not on Team).
- `GET /orgs/{org}/dependabot/alerts` — GHAS (not on Team).

Team plan caveat: most security roll-ups are GHAS-gated. Zeta's
security story stays per-repo until GHAS is worth the bill.

### A.13 org interaction limits

- `GET /orgs/{org}/interaction-limits` — current limit (empty =
  unlimited).
- `PUT /orgs/{org}/interaction-limits` — set.
- `DELETE /orgs/{org}/interaction-limits` — lift.

Incident-response tool: throttle drive-by comments/issues/PRs
during a coordinated spam wave. Standing rule: **do not set
preemptively** — zero interaction limits is the default; only
set in response to an incident, and always with an
`expires_at`.

### A.14 org blocks + outside collaborators

- `GET /orgs/{org}/blocks` — blocked users (org-level).
- `PUT /orgs/{org}/blocks/{username}` — block.
- `DELETE /orgs/{org}/blocks/{username}` — unblock.
- `GET /orgs/{org}/outside_collaborators` — non-member
  collaborators on any org repo.
- `DELETE /orgs/{org}/outside_collaborators/{username}` —
  remove.

**LFG snapshot:** both empty. Normal state for a new org.

### A.15 org PAT + OAuth policy

- `GET /orgs/{org}/personal-access-tokens` — fine-grained PATs
  scoped to this org.
- `GET /orgs/{org}/personal-access-token-requests` — pending
  user requests.
- `POST /orgs/{org}/personal-access-token-requests/{id}` —
  approve/deny.
- `POST /orgs/{org}/personal-access-tokens/{id}` — revoke.

OAuth-app policy is **org-admin UI only** (not exposed in REST
beyond `restricted_to`). Treat as a surface-to-audit by hand,
not script.

### A.16 org API Insights + audit log

- `GET /orgs/{org}/audit-log` — audit-log entries (GHE/GHEC; on
  Team it's UI-only).
- `GET /orgs/{org}/settings/billing/actions` — Actions billing.
- `GET /orgs/{org}/settings/billing/packages` — Packages billing.
- `GET /orgs/{org}/settings/billing/shared-storage` — shared
  storage billing.
- `GET /orgs/{org}/settings/network-configurations` — GHE Cloud
  private networking (not applicable here).

**Team-plan limit:** audit log is UI-only under
`/organizations/{org}/settings/audit-log`; no REST on Team.
Workaround: GraphQL `auditLog` query returns a subset.

### A.17 org migrations

- `GET /orgs/{org}/migrations` — GitHub-to-GitHub migration
  archives (legacy backup).
- `POST /orgs/{org}/migrations` — trigger.
- `GET /orgs/{org}/migrations/{id}/archive` — download.

Used for inter-org transfers (we did one: AceHack/Zeta →
LFG/Zeta). Not a cadenced surface — triggered per-event.

### A.18 org Copilot

- `GET /orgs/{org}/copilot/billing` — seat utilization.
- `GET /orgs/{org}/copilot/billing/seats` — seat list.
- `POST /orgs/{org}/copilot/billing/selected_teams` — grant.
- `DELETE /orgs/{org}/copilot/billing/selected_teams` — revoke.
- `GET /orgs/{org}/copilot/metrics` — per-language usage,
  acceptance rate (Copilot Metrics API).
- `GET /orgs/{org}/copilot/usage` — (legacy, deprecated).

**LFG context:** Aaron 2026-04-21 "we don't have github copilot
over here unless i pay and the models cost money over here too,
but this is this only way we are going to get contributors".
Copilot billing is active on LFG; monitor seats vs cost.

### A.19 org announcement banner

- `GET /orgs/{org}/announcement` — current banner (expires/text).
- `PATCH /orgs/{org}/announcement` — set.
- `DELETE /orgs/{org}/announcement` — clear.

Incident / migration / scheduled-maintenance UX. Use during
planned disruptions.

### A.20 org artifact attestations (beta)

- `GET /orgs/{org}/attestations/{subject_digest}` — lookup
  attestations by artifact digest. Cross-repo; enables the
  org-level Sigstore/SLSA story.

Zeta's supply-chain story today is repo-level
(`.github/workflows/scorecard.yml` + repo-level attestations).
Org-level rollup becomes worthwhile once there are multiple
repos publishing artifacts.

### A.21 org network configs (GHEC Cloud only)

Skipped — Team plan doesn't have it.

## Surface B — teams (sub-surface of A.3)

See A.3. One worth noting separately:

### B.1 team discussions (deprecated 2023-10 but surface still live)

- `GET /orgs/{org}/teams/{team_slug}/discussions` — team forum
  (internal to team; deprecated, moving to Discussions).

Don't build on this — migrate any new team-internal forum use
to org-visible Discussions with a team-scoped category.

## Surface C — enterprise (GHEC / GHEC-EMU)

**LFG snapshot:** Team plan, **not** Enterprise. All enterprise
endpoints below return 404. Listing anyway because upgrade to
GHEC is on the "LFG org cost reality" radar and the surface
count should not surprise us.

### C.1 enterprise admin

- `GET /enterprises/{enterprise}` — enterprise metadata.
- `GET /enterprises/{enterprise}/organizations` — orgs inside.
- `GET /enterprises/{enterprise}/teams` — enterprise teams (new).
- `GET /enterprises/{enterprise}/users` — all users across orgs.
- `GET /enterprises/{enterprise}/consumed-licenses` — seat usage.
- `GET /enterprises/{enterprise}/settings/billing/*` —
  enterprise billing (Actions / Packages / Shared-Storage).
- `GET /enterprises/{enterprise}/audit-log` — cross-org audit.
- `GET /enterprises/{enterprise}/network-configurations` —
  private networking.
- `GET /enterprises/{enterprise}/announcement` — enterprise banner.

### C.2 enterprise policies

- Actions permissions, allowed-actions, workflow-permissions
  (enterprise-scoped; cascades to orgs).
- Secret-scanning, code-scanning, Dependabot enabling at
  enterprise scope.
- Custom repo roles at enterprise scope.
- Org-creation policy.
- OAuth-app / GitHub-App policy.

### C.3 enterprise runners

- `GET /enterprises/{enterprise}/actions/runner-groups` —
  enterprise-wide runner groups; cascades to orgs.
- `GET /enterprises/{enterprise}/actions/runners` — all
  runners.

### C.4 enterprise SSO / SCIM / IdP

- `GET /scim/v2/enterprises/{enterprise}/Users` — SCIM users.
- `GET /scim/v2/enterprises/{enterprise}/Groups` — SCIM groups.
- `PUT /scim/v2/enterprises/{enterprise}/Users/{id}` — deprovision.

Important because SCIM is the **only** way to enforce
"de-provision on IdP off-board" → GitHub access revoked. Not in
scope for LFG today.

### C.5 enterprise migrations

- `POST /enterprises/{enterprise}/migrations` — GHE-to-GHE
  migrations.

Not applicable.

## Surface D — platform / cross-cutting

Ownership scattered across `https://github.com/*` product
surfaces that don't live under any single org/repo.

### D.1 Copilot (platform)

- `GET /user/copilot/metrics` — per-user Copilot metrics (after
  enablement).
- `GET /rate_limit` — per-token rate limits (Copilot-aware; the
  `core.resources.copilot_chat` bucket exists on GHEC).
- `POST /copilot/inference` — (Models API, see D.6 below).

### D.2 Codespaces (platform)

- `GET /user/codespaces` — user-level codespaces.
- `POST /user/codespaces` — create.
- `DELETE /user/codespaces/{codespace_name}` — stop+delete.
- `GET /user/codespaces/secrets` — user-level secrets.
- `GET /repos/{owner}/{repo}/codespaces` — per-repo.
- `GET /repos/{owner}/{repo}/codespaces/devcontainers` — list
  devcontainers the repo exposes.
- `GET /repos/{owner}/{repo}/codespaces/machines` — allowed
  VM sizes.

### D.3 Packages (platform)

Two SDKs:

- **Registry-native** (npm/maven/nuget/rubygems): uses the
  native tool's auth; REST exposes only metadata + deletion.
- **GHCR** (`ghcr.io`): Docker + OCI-compatible; same REST
  metadata.

Package-level permissions are a dimension inside the org:

- `GET /users/{username}/packages?package_type={type}` —
  user-scope.
- `GET /orgs/{org}/packages?package_type={type}` — org-scope.
- `GET /{scope}/{owner}/packages/{type}/{name}/versions` —
  versions.
- Package-level permissions: `internal | private | public`.

### D.4 Marketplace (platform)

- `GET /marketplace_listing/plans` — plans for a listing.
- `GET /marketplace_listing/accounts/{id}` — subscription.
- `GET /user/marketplace_purchases` — current subs.

Zeta isn't a Marketplace seller or (currently) paid buyer; this
surface becomes relevant if we adopt a paid app or list our own.

### D.5 Sponsors (platform)

- `GET /users/{username}/sponsorships` — who's sponsoring.
- `GET /graphql` `sponsorshipsAsMaintainer` — more detailed.

Relevant for Zeta if we ever open a Sponsors profile under
Aaron's account.

### D.6 GitHub Models (platform, 2024+ beta)

- `GET /models/catalog` — list available models.
- `POST /inference` — run inference (GPT-4.1, Claude, Llama, …
  all via GitHub's proxy; billed via GitHub).
- `GET /models/embeddings` — embeddings (used for the
  `github-models-factory-integration.md` spike).

Aaron's interest per
`docs/research/github-models-factory-integration.md`. Probably
the most strategically relevant cross-cutting surface for
AI-native factories.

### D.7 GitHub Advanced Security (GHAS; platform-gated)

- `GET /repos/{owner}/{repo}/code-scanning/alerts` — covered
  repo-level above.
- GHAS features on **public repos** are free; on **private** they
  require GHAS license. LFG is Team plan → no GHAS on LFG's 5
  private repos. Zeta is public → GHAS-free-tier applies.

### D.8 GitHub Apps (platform)

- `GET /apps/{app_slug}` — public-app metadata.
- `GET /app` (authed as app) — own-app metadata.
- `GET /app/installations` — installations.
- `GET /repos/{owner}/{repo}/installation` — app-installation
  on a repo.
- Webhook: one endpoint per app.

Factory-relevance: if we ever author a first-party Zeta GitHub
App (e.g. to post claim-diff PR comments), we own a new surface.
Today we use the gh CLI's user auth + Copilot's native
integration.

### D.9 OAuth applications (platform)

- `GET /user/applications/{client_id}/tokens/{access_token}` —
  token introspection (app-owned).
- `GET /applications/{client_id}/tokens` — revoke.

Audit-surface only; not a factory-owned surface unless we ship
our own OAuth app.

### D.10 traffic + insights (platform, per-repo)

Covered by repo-scope surface 9 (Pulse / Insights), but the
endpoint family also includes:

- `GET /repos/{owner}/{repo}/traffic/views` — view stats.
- `GET /repos/{owner}/{repo}/traffic/clones` — clone stats.
- `GET /repos/{owner}/{repo}/traffic/popular/paths` — top paths.
- `GET /repos/{owner}/{repo}/traffic/popular/referrers` — top
  referrers.

These are **14-day rolling** and only accessible to repo
admins. If we want Zeta-adoption metrics over time, we snapshot
weekly.

## Surface E — user / account (personal scope)

Aaron's personal AceHack account still has a surface under
Zeta's factory umbrella:

- `GET /user` — profile.
- `GET /user/emails` — email addresses.
- `GET /user/keys` — SSH keys.
- `GET /user/gpg_keys` — GPG keys.
- `GET /user/ssh_signing_keys` — SSH signing keys (git commit
  signing).
- `GET /user/social_accounts` — linked social accounts.
- `GET /user/blocks` — user-level blocks.
- `GET /user/starred` — stars.
- `GET /user/subscriptions` — watches.
- `GET /user/orgs` — org memberships (includes LFG).
- `GET /user/teams` — team memberships across orgs.
- `GET /users/{username}/followers` — followers.
- `GET /users/{username}/following` — following.
- `POST /user/migrations` — user-level repo-migration archive.

Factory-relevance: **GPG / SSH signing key rotation** is the
surface Aaron touches if we ever require signed commits. Every
other user-scope endpoint is "audit-once, not cadenced".

## Surface F — misc platform (non-scoped)

- `GET /rate_limit` — current rate limits per token bucket.
- `GET /meta` — GitHub's IP allowlist + API URL catalogue (used
  for the GitHub-settings drift detector and for tightening any
  firewall allow-list).
- `GET /octocat` — (noise).
- `POST /markdown` — render GitHub-flavoured markdown.
- `GET /licenses/{license}` — SPDX license body.
- `GET /gitignore/templates` — `.gitignore` templates.
- `GET /feeds` — activity feeds (Atom).
- `GET /search/{code,issues,users,repositories,topics,labels,commits}` —
  search API (all scope-capable).
- `GET /notifications` — authed-user notifications.

The one that matters operationally is `/meta` — the drift
detector already reads `meta.actions_outbound_ips` to pin any
firewall-allow-list when Copilot-agent firewall is enabled.

## What LFG has turned OFF by default (risk summary)

Pulled from `gh api /orgs/Lucent-Financial-Group`:

1. **`two_factor_requirement_enabled = false`** — 2FA not
   required. For financial-adjacent org, flip this on before
   adding a 3rd member.
2. **`advanced_security_enabled_for_new_repositories = false`**
   — Team plan doesn't include GHAS; acceptable.
3. **`dependabot_*_enabled_for_new_repositories = false`** —
   public repos get alerts regardless; per-repo opt-in for
   private.
4. **`secret_scanning_enabled_for_new_repositories = false`** —
   public repos get it free; private-repo secret scanning is
   GHAS-only.

Classify the 2FA-off finding as **P1 action needed** before
onboarding any second owner. Every other off-state is a
plan-boundary fact, not a risk.

## Where this plugs back into the existing 10-surface doc

Once batch 4 lands `docs/AGENT-GITHUB-SURFACES.md` on main:

| This-doc surface | Integration point |
|---|---|
| A — org | New section §11 in `AGENT-GITHUB-SURFACES.md` or split into `docs/AGENT-GITHUB-ORG-SURFACES.md` sibling |
| B — teams | Sub-section of §11 org |
| C — enterprise | Deferred-scope section §12 |
| D — platform | Cross-cut section §13 (Copilot, Codespaces, Packages, Models, GHAS, Apps, OAuth) |
| E — user | §14 for the handful of personal-scope audits |
| F — misc platform | §15 (rate_limit, meta, markdown) |

The declarative-settings pattern pairs:

- repo-level → `docs/GITHUB-SETTINGS.md` +
  `tools/hygiene/github-settings.expected.json` (landed).
- **org-level → `docs/ORG-SETTINGS.md` +
  `tools/hygiene/org-settings.expected.json`** (this doc is the
  design; backlog row below is the landing).

## Ownership / cadence / skill matrix

Per-surface advisory. Low-coordination-cost until somebody acts
on it.

| Surface | Priority | Skill candidate | Cadence | Blocker |
|---|---|---|---|---|
| A.1 org profile | P1 | `github-org-settings-drift` | weekly (mirror settings drift workflow) | P0 for pre-3rd-member 2FA flip |
| A.2 members | P2 | part of A.1 skill | on-event (invite/remove) | — |
| A.3 teams | P3 | — | defer until 3+ humans | — |
| A.4 org webhooks | P2 | part of A.1 skill | weekly | — |
| A.5 org Actions | P2 | part of A.1 skill | weekly | — |
| A.6 Dependabot | P3 | GHAS-gated on private; skip on Team | — | GHAS cost |
| A.7 Codespaces | P3 | billing-cost monitor | monthly | — |
| A.8 packages | P3 | — | defer until publish | NuGet pub plan |
| A.9 org rulesets | P2 | extend `github-settings-drift` | weekly | — |
| A.10 custom props | P3 | — | defer until multi-repo | — |
| A.11 custom roles | skip | Team plan blocked | — | GHEC upgrade |
| A.12 security managers | P2 | part of A.1 | on-event | — |
| A.13 interaction limits | P3 | on-incident only | per-event | — |
| A.14 blocks/outside colabs | P3 | part of A.1 | monthly | — |
| A.15 PAT/OAuth policy | P2 | part of A.1 | weekly | — |
| A.16 audit log | P2 | GraphQL + Team-plan workaround | weekly sample | REST blocked on Team |
| A.17 migrations | — | on-event only | — | — |
| A.18 Copilot | P1 | seat-billing monitor | weekly | Aaron paying; cost-aware |
| A.19 announcement | — | on-incident | — | — |
| A.20 attestations | P3 | when multi-repo publishes | — | — |
| D.1-D.10 platform | mixed | per-surface | mostly on-touch | — |
| E user | P3 | once-annual audit | annual | — |
| F misc | P1 (for /meta) | already consumed by drift | ✓ | — |

## Backlog candidates

Four distinct BACKLOG rows:

1. **P1 — org-settings-as-code** (sibling to `docs/GITHUB-SETTINGS.md`):
   `docs/ORG-SETTINGS.md` + `tools/hygiene/org-settings.expected.json`
   + `tools/hygiene/snapshot-org-settings.sh` + weekly drift
   workflow. Landing effort M.

2. **P1 — org 2FA requirement audit** before adding a 3rd LFG
   member. One-line action: `gh api -X PATCH /orgs/Lucent-Financial-Group
   -f two_factor_requirement_enabled=true`. Block: Aaron
   sign-off. Landing effort S.

3. **P2 — integrate this map into `AGENT-GITHUB-SURFACES.md`**
   once batch 4 lands. Either extend the doc or split into
   `AGENT-GITHUB-ORG-SURFACES.md` sibling. Effort S.

4. **P3 — Copilot seat-cost monitor** (A.18): monthly check
   on `/orgs/LFG/copilot/billing`; alert if seats×rate trend
   diverges from value-delivered. Effort S + ongoing.

## Verify-before-deferring — pointers

All four BACKLOG candidates above need deferral-target
verification before they can land as rows:

- `docs/BACKLOG.md` exists ✓.
- `docs/GITHUB-SETTINGS.md` exists ✓ (the repo-level pattern).
- `tools/hygiene/snapshot-github-settings.sh` exists ✓ (the
  pattern to clone for org variant).
- `docs/AGENT-GITHUB-SURFACES.md` does **not** exist on main
  yet (lands via batch 4). The batch-4 PR message must point
  at this research doc so the integration is tracked.

## What this doc does NOT do

- **Does not land `docs/ORG-SETTINGS.md`.** That is the BACKLOG
  row P1 above. This doc is the design; the landing is its own
  PR.
- **Does not snapshot current org settings as a machine-readable
  expected file.** The values captured above are narrative; the
  JSON-normalized expected is the BACKLOG-row P1 landing.
- **Does not flip any org-level setting.** Every observation
  above is read-only. The 2FA-off finding is filed as an
  observation; Aaron acts on it via the P1 backlog row.
- **Does not claim enterprise scope.** LFG is Team plan; the
  enterprise surface is enumerated only because upgrade is on
  the radar and we want the surface count not to surprise us.
- **Does not duplicate `docs/AGENT-GITHUB-SURFACES.md`.** That
  doc owns the repo-level playbook in-depth. This doc adds
  everything one-or-more scopes away.

## References

- `docs/AGENT-GITHUB-SURFACES.md` — the ten-surface repo-level
  playbook (lands via batch 4).
- `docs/GITHUB-SETTINGS.md` — the declarative-settings pattern,
  repo-scope.
- `tools/hygiene/snapshot-github-settings.sh` — snapshot
  pattern to clone for org-scope.
- `docs/research/github-models-factory-integration.md` — D.6
  GitHub Models deep dive.
- `memory/project_zeta_org_migration_to_lucent_financial_group.md`
  — the org-migration context.
- `memory/project_lfg_org_cost_reality_copilot_models_paid_contributor_tradeoff.md`
  — the LFG cost-surface reality.
- GitHub REST API top-level:
  `https://docs.github.com/en/rest` — the source-of-truth for
  endpoint categories used to build the per-scope tables above.
