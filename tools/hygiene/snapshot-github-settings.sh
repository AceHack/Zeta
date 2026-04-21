#!/usr/bin/env bash
# snapshot-github-settings.sh — produce a normalized JSON snapshot of the
# repo's GitHub settings. Output is deterministic + diffable. Used by
# check-github-settings-drift.sh and for manual "update expected" flows.
#
# Usage:
#   tools/hygiene/snapshot-github-settings.sh [--repo OWNER/NAME] > snapshot.json
#
# Defaults: $GH_REPO env var, then `gh repo view --json nameWithOwner`.
#
# What this captures: every setting that is NOT tracked in a checked-in
# file inside the repo. Workflow YAML, CODEOWNERS, Dependabot config,
# pre-commit hooks are all *already* declarative in-tree — no need to
# snapshot them. This script covers the click-ops surfaces:
#   - repo-level toggles (merge methods, security-and-analysis, ...)
#   - rulesets + their rule contents
#   - classic branch protection on default branch
#   - Actions permissions + Actions variables (names + values, NOT secrets)
#   - environments (names + protection rule types)
#   - GitHub Pages config
#   - CodeQL default-setup state
#
# Exit 0 on a successful snapshot (even when some optional endpoints
# return null — automated-security-fixes, private-vulnerability-reporting,
# interaction-limits, Pages, and branch protection all tolerate absence
# and coerce to `null` so the emitted JSON stays shape-stable). Exit 2
# on CLI-argument errors; non-zero from any required `gh api` call
# (repo metadata, rulesets, permissions) propagates through
# command-substitution and will make downstream `jq` fail loudly.

set -uo pipefail

repo=""
if [ "${1:-}" = "--repo" ]; then
  if [ $# -lt 2 ]; then
    echo "error: --repo requires OWNER/NAME argument" >&2
    exit 2
  fi
  repo="$2"
elif [ -n "${1:-}" ]; then
  repo="$1"
fi
if [ -z "$repo" ]; then
  repo="${GH_REPO:-$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || true)}"
fi
if [ -z "$repo" ]; then
  echo "error: cannot determine repo; pass --repo OWNER/NAME or set GH_REPO" >&2
  exit 2
fi

default_branch=$(gh api "/repos/$repo" --jq '.default_branch')

repo_json=$(gh api "/repos/$repo" --jq '{
  allow_auto_merge, allow_forking, allow_merge_commit, allow_rebase_merge, allow_squash_merge,
  allow_update_branch, archived, custom_properties, default_branch,
  delete_branch_on_merge, description, disabled,
  has_discussions, has_downloads, has_issues, has_pages, has_projects,
  has_pull_requests, has_wiki, homepage, is_template,
  merge_commit_message, merge_commit_title,
  pull_request_creation_policy,
  squash_merge_commit_message, squash_merge_commit_title,
  use_squash_pr_title_as_default, visibility, web_commit_signoff_required,
  security_and_analysis
}')

topics_json=$(gh api "/repos/$repo/topics" --jq '.names | sort')
automated_security_fixes_json=$(gh api "/repos/$repo/automated-security-fixes" 2>/dev/null --jq '{enabled, paused}' || echo 'null')
private_vuln_reporting_json=$(gh api "/repos/$repo/private-vulnerability-reporting" 2>/dev/null --jq '{enabled}' || echo 'null')
interaction_limits_raw=$(gh api "/repos/$repo/interaction-limits")
if [ "$(jq 'length' <<< "$interaction_limits_raw")" = "0" ]; then
  interaction_limits_json="null"
else
  interaction_limits_json=$(jq '{limit, origin, expires_at}' <<< "$interaction_limits_raw")
fi
autolinks_json=$(gh api "/repos/$repo/autolinks" --jq '[.[] | {key_prefix, url_template, is_alphanumeric}] | sort_by(.key_prefix)')
# /vulnerability-alerts returns 204 No Content when enabled, 404 when disabled
if gh api "/repos/$repo/vulnerability-alerts" >/dev/null 2>&1; then
  vulnerability_alerts_enabled=true
else
  vulnerability_alerts_enabled=false
fi

ruleset_details='[]'
# Sort by id to stabilize output across GitHub-side listing order changes.
ruleset_ids=$(gh api "/repos/$repo/rulesets" --jq '[.[].id] | sort | .[]')
for rid in $ruleset_ids; do
  one=$(gh api "/repos/$repo/rulesets/$rid" --jq '{id, name, target, enforcement, conditions, rules: [.rules[] | {type, parameters}]}')
  ruleset_details=$(jq --argjson one "$one" '. + [$one]' <<< "$ruleset_details")
done

protection_json=$(gh api "/repos/$repo/branches/$default_branch/protection" 2>/dev/null --jq '{
  required_status_checks: (.required_status_checks // null | if . then {strict, contexts: (.contexts | sort)} else null end),
  required_pull_request_reviews: (.required_pull_request_reviews // null | if . then {dismiss_stale_reviews, require_code_owner_reviews, require_last_push_approval, required_approving_review_count} else null end),
  required_signatures: .required_signatures.enabled,
  enforce_admins: .enforce_admins.enabled,
  required_linear_history: .required_linear_history.enabled,
  allow_force_pushes: .allow_force_pushes.enabled,
  allow_deletions: .allow_deletions.enabled,
  required_conversation_resolution: .required_conversation_resolution.enabled,
  lock_branch: .lock_branch.enabled,
  allow_fork_syncing: .allow_fork_syncing.enabled
}' || echo 'null')

actions_perms_json=$(gh api "/repos/$repo/actions/permissions" --jq '{enabled, allowed_actions}')

actions_vars_json=$(gh api "/repos/$repo/actions/variables" --jq '[.variables[]? | {name, value}] | sort_by(.name)')

workflows_json=$(gh api "/repos/$repo/actions/workflows" --jq '[.workflows[] | {name, state, path}] | sort_by(.name)')

envs_json=$(gh api "/repos/$repo/environments" --jq '[.environments[]? | {name, protection_rule_types: [.protection_rules[]?.type] | sort}] | sort_by(.name)')

pages_json=$(gh api "/repos/$repo/pages" 2>/dev/null --jq '{source, build_type, https_enforced, public}' || echo 'null')

codeql_json=$(gh api "/repos/$repo/code-scanning/default-setup" --jq '{state, languages: (.languages | sort), query_suite}')

webhooks_count=$(gh api "/repos/$repo/hooks" --jq 'length')
deploy_keys_count=$(gh api "/repos/$repo/keys" --jq 'length')
actions_secrets_count=$(gh api "/repos/$repo/actions/secrets" --jq '.secrets | length')
dependabot_secrets_count=$(gh api "/repos/$repo/dependabot/secrets" --jq '.secrets | length' 2>/dev/null || echo 0)

jq -n \
  --argjson repo "$repo_json" \
  --argjson topics "$topics_json" \
  --argjson rulesets "$ruleset_details" \
  --argjson protection "$protection_json" \
  --argjson actions_perms "$actions_perms_json" \
  --argjson actions_vars "$actions_vars_json" \
  --argjson workflows "$workflows_json" \
  --argjson envs "$envs_json" \
  --argjson pages "$pages_json" \
  --argjson codeql "$codeql_json" \
  --argjson automated_security_fixes "$automated_security_fixes_json" \
  --argjson private_vuln_reporting "$private_vuln_reporting_json" \
  --argjson interaction_limits "$interaction_limits_json" \
  --argjson autolinks "$autolinks_json" \
  --argjson vulnerability_alerts_enabled "$vulnerability_alerts_enabled" \
  --argjson webhooks_count "$webhooks_count" \
  --argjson deploy_keys_count "$deploy_keys_count" \
  --argjson actions_secrets_count "$actions_secrets_count" \
  --argjson dependabot_secrets_count "$dependabot_secrets_count" \
  '{
    repo: $repo,
    topics: $topics,
    rulesets: $rulesets,
    default_branch_protection: $protection,
    actions_permissions: $actions_perms,
    actions_variables: $actions_vars,
    workflows: $workflows,
    environments: $envs,
    pages: $pages,
    codeql_default_setup: $codeql,
    security: {
      vulnerability_alerts_enabled: $vulnerability_alerts_enabled,
      automated_security_fixes: $automated_security_fixes,
      private_vulnerability_reporting: $private_vuln_reporting
    },
    interaction_limits: $interaction_limits,
    autolinks: $autolinks,
    counts: {
      webhooks: $webhooks_count,
      deploy_keys: $deploy_keys_count,
      actions_secrets: $actions_secrets_count,
      dependabot_secrets: $dependabot_secrets_count
    }
  }'
