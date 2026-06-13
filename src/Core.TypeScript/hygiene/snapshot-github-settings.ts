#!/usr/bin/env bun
// snapshot-github-settings.ts — produce a normalized JSON snapshot of the
// repo's GitHub settings. Output is deterministic + diffable. Used by
// check-github-settings-drift.ts and for manual "update expected" flows.
//
// TypeScript+Bun port of snapshot-github-settings.sh, per Rule 0
// (no more .sh files except install-graph; TS IS cross-platform DST).
//
// Usage:
//   bun tools/hygiene/snapshot-github-settings.ts [--repo OWNER/NAME] > snapshot.json
//
// Defaults: $GH_REPO env var, then `gh repo view --json nameWithOwner`.
//
// What this captures: every setting that is NOT tracked in a checked-in
// file inside the repo. Workflow YAML, CODEOWNERS, Dependabot config,
// pre-commit hooks are all *already* declarative in-tree — no need to
// snapshot them. This script covers the click-ops surfaces:
//   - repo-level toggles (merge methods, security-and-analysis, ...)
//   - rulesets + their rule contents
//   - classic branch protection on default branch
//   - Actions permissions + Actions variables (names + values, NOT secrets)
//   - environments (names + protection rule types)
//   - GitHub Pages config
//   - CodeQL default-setup state
//
// Exit 0 on a successful snapshot. Exit 2 on CLI-argument errors or
// fatal API failures.

interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

const insufficientTokenScope = { _skipped: "insufficient-token-scope" } as const;

const adminLimitedRepoNullFields = [
  "allow_auto_merge",
  "allow_merge_commit",
  "allow_rebase_merge",
  "allow_squash_merge",
  "allow_update_branch",
  "delete_branch_on_merge",
  "merge_commit_message",
  "merge_commit_title",
  "security_and_analysis",
  "squash_merge_commit_message",
  "squash_merge_commit_title",
  "use_squash_pr_title_as_default",
] as const;

type OptionalScopeResult =
  | { readonly kind: "ok"; readonly stdout: string }
  | { readonly kind: "not-found" }
  | { readonly kind: "insufficient-token-scope" };

async function runCmd(cmd: readonly string[]): Promise<SpawnResult> {
  const proc = Bun.spawn({
    cmd: [...cmd],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

async function ghApi(path: string, jqFilter?: string): Promise<string> {
  const args = ["gh", "api", path];
  if (jqFilter !== undefined) {
    args.push("--jq", jqFilter);
  }
  const r = await runCmd(args);
  if (r.exitCode !== 0) {
    throw new Error(`gh api ${path} failed (exit ${r.exitCode}): ${r.stderr.trim()}`);
  }
  return r.stdout.trim();
}

async function ghApiOptional(path: string, jqFilter?: string): Promise<string | null> {
  const args = ["gh", "api", path];
  if (jqFilter !== undefined) {
    args.push("--jq", jqFilter);
  }
  const r = await runCmd(args);
  if (r.exitCode !== 0) {
    return null;
  }
  return r.stdout.trim();
}

export function isInsufficientTokenScope403(stderr: string): boolean {
  if (!stderr.includes("HTTP 403")) {
    return false;
  }

  const lower = stderr.toLowerCase();
  if (lower.includes("secondary rate limit") || lower.includes("abuse detection") || lower.includes("rate limit")) {
    return false;
  }

  return (
    lower.includes("resource not accessible by integration") ||
    lower.includes("resource not accessible by personal access token") ||
    lower.includes("not accessible by integration") ||
    lower.includes("must have admin rights") ||
    lower.includes("requires admin") ||
    lower.includes("insufficient oauth scope") ||
    lower.includes("missing the required scope") ||
    lower.includes("requires one of the following oauth scopes")
  );
}

// Like ghApiOptional but only silences HTTP 403 token-scope errors; all other
// failures are fatal so they don't get silently swallowed by the sentinel path.
async function ghApiSkip403(path: string, jqFilter?: string): Promise<string | null> {
  const args = ["gh", "api", path];
  if (jqFilter !== undefined) {
    args.push("--jq", jqFilter);
  }
  const r = await runCmd(args);
  if (r.exitCode !== 0) {
    if (isInsufficientTokenScope403(r.stderr)) {
      return null;
    }
    throw new Error(`gh api ${path} failed (exit ${r.exitCode}): ${r.stderr.trim()}`);
  }
  return r.stdout.trim();
}

async function ghApiOptionalScopeAware(path: string, jqFilter?: string): Promise<OptionalScopeResult> {
  const args = ["gh", "api", path];
  if (jqFilter !== undefined) {
    args.push("--jq", jqFilter);
  }
  const r = await runCmd(args);
  if (r.exitCode === 0) {
    return { kind: "ok", stdout: r.stdout.trim() };
  }
  if (isInsufficientTokenScope403(r.stderr)) {
    return { kind: "insufficient-token-scope" };
  }
  if (r.stderr.includes("HTTP 404")) {
    return { kind: "not-found" };
  }
  throw new Error(`gh api ${path} failed (exit ${r.exitCode}): ${r.stderr.trim()}`);
}

export function parseJsonSafe(raw: string | null, fallback: unknown = null): unknown {
  if (raw === null || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export interface Args {
  readonly repo: string;
}

export type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "error"; readonly message: string };

async function resolveRepoViaGh(): Promise<string> {
  const r = await runCmd(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  if (r.exitCode === 0 && r.stdout.trim().length > 0) {
    return r.stdout.trim();
  }
  return "";
}

export async function parseArgs(
  argv: readonly string[],
  resolveDefault: () => Promise<string> = resolveRepoViaGh,
): Promise<ParseResult> {
  let repo = "";
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--repo") {
      const value = argv[i + 1];
      if (value === undefined) {
        return { kind: "error", message: "error: --repo requires OWNER/NAME argument" };
      }
      repo = value;
      i += 2;
    } else {
      // Accept positional as repo too
      repo = arg ?? "";
      i += 1;
    }
  }

  if (repo.length === 0) {
    repo = process.env.GH_REPO ?? "";
  }

  if (repo.length === 0) {
    repo = await resolveDefault();
  }

  if (repo.length === 0) {
    return { kind: "error", message: "error: cannot determine repo; pass --repo OWNER/NAME or set GH_REPO" };
  }

  return { kind: "args", args: { repo } };
}

function markAdminLimitedNulls(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const obj = { ...(raw as Record<string, unknown>) };
  for (const key of adminLimitedRepoNullFields) {
    if (obj[key] === null) {
      obj[key] = insufficientTokenScope;
    }
  }
  return obj;
}

function parseOptionalScopeResult(result: OptionalScopeResult): unknown {
  if (result.kind === "ok") {
    return parseJsonSafe(result.stdout);
  }
  if (result.kind === "insufficient-token-scope") {
    return insufficientTokenScope;
  }
  return null;
}

export async function snapshot(repo: string): Promise<string> {
  // Repo metadata
  const repoJson = markAdminLimitedNulls(
    parseJsonSafe(
      await ghApi(`/repos/${repo}`, `{
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
    }`)
    )
  );

  const defaultBranch = await ghApi(`/repos/${repo}`, ".default_branch");

  // Topics
  const topicsRaw = await ghApi(`/repos/${repo}/topics`, ".names | sort");
  const topics = parseJsonSafe(topicsRaw, []);

  // Automated security fixes (optional endpoint)
  const autoSecFixResult = await ghApiOptionalScopeAware(`/repos/${repo}/automated-security-fixes`, "{enabled, paused}");
  const automatedSecurityFixes = parseOptionalScopeResult(autoSecFixResult);

  // Private vulnerability reporting (optional endpoint)
  const privVulnRaw = await ghApiOptional(`/repos/${repo}/private-vulnerability-reporting`, "{enabled}");
  const privateVulnReporting = parseJsonSafe(privVulnRaw);

  // Interaction limits
  const interactionLimitsRaw = await ghApiOptional(`/repos/${repo}/interaction-limits`);
  let interactionLimits: unknown = null;
  if (interactionLimitsRaw !== null) {
    const parsed = parseJsonSafe(interactionLimitsRaw);
    if (parsed !== null && typeof parsed === "object" && Object.keys(parsed as object).length > 0) {
      const obj = parsed as Record<string, unknown>;
      interactionLimits = { limit: obj.limit, origin: obj.origin, expires_at: obj.expires_at };
    }
  }

  // Autolinks
  const autolinksRaw = await ghApiOptional(
    `/repos/${repo}/autolinks`,
    "[.[] | {key_prefix, url_template, is_alphanumeric}] | sort_by(.key_prefix)"
  );
  const autolinks = parseJsonSafe(autolinksRaw, []);

  // Vulnerability alerts: 204 = enabled, 404 = disabled
  const vulnAlertsResult = await runCmd(["gh", "api", `/repos/${repo}/vulnerability-alerts`]);
  let vulnerabilityAlertsEnabled: boolean | typeof insufficientTokenScope;
  if (vulnAlertsResult.exitCode === 0) {
    vulnerabilityAlertsEnabled = true;
  } else if (isInsufficientTokenScope403(vulnAlertsResult.stderr)) {
    vulnerabilityAlertsEnabled = insufficientTokenScope;
  } else if (vulnAlertsResult.stderr.includes("HTTP 404")) {
    vulnerabilityAlertsEnabled = false;
  } else {
    throw new Error(
      `gh api /repos/${repo}/vulnerability-alerts failed (exit ${vulnAlertsResult.exitCode}): ${vulnAlertsResult.stderr.trim()}`
    );
  }

  // Rulesets
  const rulesetIdsRaw = await ghApiOptional(`/repos/${repo}/rulesets`, "[.[].id] | sort | .[]");
  const rulesetDetails: unknown[] = [];
  if (rulesetIdsRaw !== null && rulesetIdsRaw.length > 0) {
    const ids = rulesetIdsRaw.split("\n").filter(s => s.trim().length > 0);
    for (const rid of ids) {
      const oneRaw = await ghApi(
        `/repos/${repo}/rulesets/${rid}`,
        "{id, name, target, enforcement, conditions, rules: [.rules[] | {type, parameters}]}"
      );
      const one = parseJsonSafe(oneRaw);
      if (one !== null) {
        rulesetDetails.push(one);
      }
    }
  }

  // Branch protection on default branch (optional — may not exist)
  const protectionResult = await ghApiOptionalScopeAware(
    `/repos/${repo}/branches/${defaultBranch}/protection`,
    `{
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
    }`
  );
  const protection = parseOptionalScopeResult(protectionResult);

  // Actions permissions — requires admin token; falls back to a sentinel when the
  // GITHUB_TOKEN in CI lacks that scope (HTTP 403).
  const actionsPermsRaw = await ghApiOptional(`/repos/${repo}/actions/permissions`, "{enabled, allowed_actions}");
  const actionsPerms = actionsPermsRaw === null ? insufficientTokenScope : parseJsonSafe(actionsPermsRaw);

  // Actions variables — requires admin token; falls back to a sentinel when the
  // GITHUB_TOKEN in CI lacks that scope (HTTP 403).
  const actionsVarsRaw = await ghApiOptional(
    `/repos/${repo}/actions/variables`,
    "[.variables[]? | {name, value}] | sort_by(.name)"
  );
  const actionsVars = actionsVarsRaw === null ? insufficientTokenScope : parseJsonSafe(actionsVarsRaw, []);

  // Workflows
  const workflowsRaw = await ghApi(
    `/repos/${repo}/actions/workflows`,
    "[.workflows[] | {name, state, path}] | sort_by(.name, .path)"
  );
  const workflows = parseJsonSafe(workflowsRaw, []);

  // Environments
  const envsRaw = await ghApi(
    `/repos/${repo}/environments`,
    "[.environments[]? | {name, protection_rule_types: [.protection_rules[]?.type] | sort}] | sort_by(.name)"
  );
  const envs = parseJsonSafe(envsRaw, []);

  // Pages (optional)
  const pagesRaw = await ghApiOptional(`/repos/${repo}/pages`, "{source, build_type, https_enforced, public}");
  const pages = parseJsonSafe(pagesRaw);

  // CodeQL default setup — requires admin token; falls back to a sentinel when the
  // GITHUB_TOKEN in CI lacks that scope (HTTP 403). Other errors remain fatal so
  // transient API failures are not silently hidden from the drift check.
  const codeqlRaw = await ghApiSkip403(
    `/repos/${repo}/code-scanning/default-setup`,
    "{state, languages: (.languages | sort), query_suite}"
  );
  const codeql = codeqlRaw === null ? insufficientTokenScope : parseJsonSafe(codeqlRaw);

  // Counts — these admin-level endpoints fall back to a sentinel when the
  // GITHUB_TOKEN in CI lacks that scope (HTTP 403). Other errors remain fatal
  // so transient API failures are not silently hidden from the drift check.
  const webhooksCountRaw = await ghApiSkip403(`/repos/${repo}/hooks`, "length");
  const deployKeysCountRaw = await ghApiSkip403(`/repos/${repo}/keys`, "length");
  const actionsSecretsCountRaw = await ghApiSkip403(`/repos/${repo}/actions/secrets`, ".secrets | length");
  const dependabotSecretsCountRaw = await ghApiOptional(`/repos/${repo}/dependabot/secrets`, ".secrets | length");

  const webhooksCount = webhooksCountRaw === null ? insufficientTokenScope : (parseInt(webhooksCountRaw, 10) || 0);
  const deployKeysCount = deployKeysCountRaw === null ? insufficientTokenScope : (parseInt(deployKeysCountRaw, 10) || 0);
  const actionsSecretsCount = actionsSecretsCountRaw === null ? insufficientTokenScope : (parseInt(actionsSecretsCountRaw, 10) || 0);
  const dependabotSecretsCount = parseInt(dependabotSecretsCountRaw ?? "0", 10) || 0;

  const result = {
    repo: repoJson,
    topics,
    rulesets: rulesetDetails,
    default_branch_protection: protection,
    actions_permissions: actionsPerms,
    actions_variables: actionsVars,
    workflows,
    environments: envs,
    pages,
    codeql_default_setup: codeql,
    security: {
      vulnerability_alerts_enabled: vulnerabilityAlertsEnabled,
      automated_security_fixes: automatedSecurityFixes,
      private_vulnerability_reporting: privateVulnReporting,
    },
    interaction_limits: interactionLimits,
    autolinks,
    counts: {
      webhooks: webhooksCount,
      deploy_keys: deployKeysCount,
      actions_secrets: actionsSecretsCount,
      dependabot_secrets: dependabotSecretsCount,
    },
  };

  return JSON.stringify(result, null, 2);
}

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = await parseArgs(argv);
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }

  try {
    const output = await snapshot(parsed.args.repo);
    process.stdout.write(output + "\n");
    return 0;
  } catch (err: unknown) {
    process.stderr.write(`error: snapshot failed: ${err instanceof Error ? err.message : String(err)}\n`);
    return 2;
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(2);
    },
  );
}
