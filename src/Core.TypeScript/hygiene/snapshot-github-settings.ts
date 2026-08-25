#!/usr/bin/env bun
// snapshot-github-settings.ts — produce a normalized JSON snapshot of the
// repo's GitHub settings. Output is deterministic + diffable. Used by
// check-github-settings-drift.ts and for manual "update expected" flows.
//
// TypeScript+Bun port of snapshot-github-settings.sh, per Rule 0
// (no more .sh files except install-graph; TS IS cross-platform DST).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/snapshot-github-settings.ts [--repo OWNER/NAME] > snapshot.json
//
// Defaults: $GH_REPO env var, then `gh repo view --json nameWithOwner`.
//
// What this captures: every setting that is NOT tracked in a checked-in
// file inside the repo. Workflow YAML, CODEOWNERS, Dependabot config,
// pre-commit hooks are all *already* declarative in-tree — no need to
// snapshot them. This script covers the click-ops surfaces:
//   - repo-level toggles (merge methods, security-and-analysis, ...)
//   - rulesets + their rule contents + THEIR BYPASS ACTORS
//   - classic branch protection on default branch
//   - Actions permissions + Actions variables (names + values, NOT secrets)
//   - environments (names + protection rule types)
//   - GitHub Pages config
//   - CodeQL default-setup state
//
// TWO DEFECTS THIS FILE USED TO HAVE, both of the same class — a record that
// looks complete and is not:
//
//   1. `bypass_actors` WAS NOT CAPTURED AT ALL. It is the single most
//      safety-relevant field on a ruleset: it names who may merge past the
//      rule. A drift detector blind to it cannot see the change that matters
//      most — and on 2026-08-13T21:50:54Z this repository acquired
//      `{RepositoryRole 5 (admin), bypass_mode: pull_request}` on ruleset
//      16134995 "CI Gate" with nothing in-tree recording it. Captured now.
//
//   2. LIST ENDPOINTS WERE READ UNPAGINATED. `/actions/workflows` returned
//      the first 30 of 90 workflows and the snapshot recorded those 30 as if
//      they were all of them. Two thirds of the workflow inventory — every
//      one of which could be `disabled_manually` — was outside the detector's
//      field of view, and the truncation was silent: the file looked whole.
//      All list reads now go through `ghApiPaginatedItems`, which uses
//      `--paginate --slurp` and projects in TypeScript (gh refuses `--slurp`
//      together with `--jq`, so the projection cannot stay in jq).
//
// Fields the running credential cannot read are recorded IN BAND as
// `{"_skipped":"insufficient-token-scope"}` rather than omitted, and
// `unreadablePaths()` enumerates them for the caller. Omission would make a
// weak-token snapshot indistinguishable from a complete one.
//
// Exit 0 on a successful snapshot. Exit 2 on CLI-argument errors or
// fatal API failures.

interface SpawnResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export const INSUFFICIENT_TOKEN_SCOPE = "insufficient-token-scope" as const;

const insufficientTokenScope = { _skipped: INSUFFICIENT_TOKEN_SCOPE } as const;

/**
 * Which REST endpoint produced each snapshot field.
 *
 * This exists so that "field X was not readable" can be reported with the
 * reason rather than as a bare name: a reader who is told
 * `codeql_default_setup <- GET /repos/{repo}/code-scanning/default-setup`
 * can look up the permission that endpoint wants. Without it the drift
 * check can say a field is missing but not what would fix it, and
 * "unreadable" quietly becomes a permanent state nobody can act on.
 *
 * Keys are snapshot paths (dot-joined), values are endpoint templates with
 * `{repo}` left unexpanded so the map stays a constant.
 */
export const FIELD_SOURCE_ENDPOINT: Readonly<Record<string, string>> = {
  repo: "GET /repos/{repo}",
  "repo.allow_auto_merge": "GET /repos/{repo} (admin-only field)",
  "repo.allow_merge_commit": "GET /repos/{repo} (admin-only field)",
  "repo.allow_rebase_merge": "GET /repos/{repo} (admin-only field)",
  "repo.allow_squash_merge": "GET /repos/{repo} (admin-only field)",
  "repo.allow_update_branch": "GET /repos/{repo} (admin-only field)",
  "repo.delete_branch_on_merge": "GET /repos/{repo} (admin-only field)",
  "repo.merge_commit_message": "GET /repos/{repo} (admin-only field)",
  "repo.merge_commit_title": "GET /repos/{repo} (admin-only field)",
  "repo.security_and_analysis": "GET /repos/{repo} (admin-only field)",
  "repo.squash_merge_commit_message": "GET /repos/{repo} (admin-only field)",
  "repo.squash_merge_commit_title": "GET /repos/{repo} (admin-only field)",
  "repo.use_squash_pr_title_as_default": "GET /repos/{repo} (admin-only field)",
  topics: "GET /repos/{repo}/topics",
  security: "GET /repos/{repo}/{vulnerability-alerts,automated-security-fixes,private-vulnerability-reporting}",
  counts: "GET /repos/{repo}/{hooks,keys,actions/secrets,dependabot/secrets}",
  rulesets: "GET /repos/{repo}/rulesets + /rulesets/{id}",
  default_branch_protection: "GET /repos/{repo}/branches/{branch}/protection",
  actions_permissions: "GET /repos/{repo}/actions/permissions",
  actions_variables: "GET /repos/{repo}/actions/variables",
  workflows: "GET /repos/{repo}/actions/workflows",
  environments: "GET /repos/{repo}/environments",
  pages: "GET /repos/{repo}/pages",
  codeql_default_setup: "GET /repos/{repo}/code-scanning/default-setup",
  "security.vulnerability_alerts_enabled": "GET /repos/{repo}/vulnerability-alerts",
  "security.automated_security_fixes": "GET /repos/{repo}/automated-security-fixes",
  "security.private_vulnerability_reporting": "GET /repos/{repo}/private-vulnerability-reporting",
  autolinks: "GET /repos/{repo}/autolinks",
  interaction_limits: "GET /repos/{repo}/interaction-limits",
  "counts.webhooks": "GET /repos/{repo}/hooks",
  "counts.deploy_keys": "GET /repos/{repo}/keys",
  "counts.actions_secrets": "GET /repos/{repo}/actions/secrets",
  "counts.dependabot_secrets": "GET /repos/{repo}/dependabot/secrets",
};

/**
 * The credential class that reads the admin-only endpoints above.
 *
 * Stated as prose rather than as a check because nothing in this process can
 * verify a token's grants without spending them. It is here so the drift
 * report can name a remedy instead of only naming a gap.
 */
export const ADMIN_READ_CREDENTIAL_NOTE =
  "GITHUB_TOKEN has no `administration` scope at all — it is not a weaker admin token, it is a " +
  "non-admin one (see the permissions comment in .github/workflows/github-settings-drift.yml). " +
  "Reading the admin-only endpoints needs a separate fine-grained PAT on this repository with " +
  "Repository permissions: Administration: read (rulesets, branch protection, deploy keys, " +
  "merge settings, security_and_analysis, Actions permissions), Secrets: read, Variables: read, " +
  "Webhooks: read, Dependabot secrets: read. Wire it as repository secret DRIFT_DETECTOR_PAT " +
  "(081KQ8P5D0008QG0R000JHD7AB). Configuring it is the operator's call, not this tool's.";

/**
 * The endpoint that produced a snapshot path, for an unreadable-field report.
 *
 * Array indices are stripped before lookup so `rulesets[1].bypass_actors`
 * resolves to the rulesets endpoint rather than falling through to
 * "(endpoint unmapped)" — and that path is not a corner case, it is where the
 * single most safety-relevant field lives.
 */
export function endpointForPath(path: string, repo: string): string {
  const noIndex = path.replace(/\[\d+\]/g, "");
  const candidates = [path, noIndex, noIndex.split(".")[0] ?? ""];
  for (const c of candidates) {
    const hit = FIELD_SOURCE_ENDPOINT[c];
    if (hit !== undefined) return hit.replace("{repo}", repo);
  }
  return "(endpoint unmapped)";
}

/** Codepoint-ordinal comparator. Never `localeCompare`: a snapshot that sorts
 *  differently per machine is not a snapshot, it is noise. */
export function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isSkippedSentinel(v: unknown): boolean {
  return (
    v !== null &&
    typeof v === "object" &&
    "_skipped" in (v as Record<string, unknown>) &&
    (v as Record<string, unknown>)._skipped === INSUFFICIENT_TOKEN_SCOPE
  );
}

/**
 * Every path in `obj` whose value is the unreadable sentinel.
 *
 * Pure, so the drift check can reuse it and so it is testable without a
 * network.
 *
 * DESCENDS INTO ARRAYS (`rulesets[1].bypass_actors`), which is not
 * incidental: the one field a non-admin credential silently cannot read
 * lives inside an array element, so a walk over objects alone would report
 * zero unreadable fields on exactly the run where the most important one was
 * missed.
 */
export function unreadablePaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [];
  const out: string[] = [];
  if (Array.isArray(obj)) {
    obj.forEach((el, i) => {
      const path = `${prefix}[${i}]`;
      if (isSkippedSentinel(el)) out.push(path);
      else out.push(...unreadablePaths(el, path));
    });
    return out;
  }
  for (const key of Object.keys(obj as Record<string, unknown>).sort(ordinal)) {
    const path = prefix.length > 0 ? `${prefix}.${key}` : key;
    const val = (obj as Record<string, unknown>)[key];
    if (isSkippedSentinel(val)) out.push(path);
    else out.push(...unreadablePaths(val, path));
  }
  return out;
}

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

/**
 * Read a LIST endpoint across ALL of its pages.
 *
 * `gh api --paginate --slurp` returns an array whose elements are the raw
 * page bodies; gh refuses `--slurp` together with `--jq`, so the projection
 * happens in TypeScript below rather than in a jq filter. That refusal is
 * the reason the old code read one page: it used `--jq`, and `--jq` without
 * `--paginate` silently stops at the API default of 30 items.
 *
 * `pick` extracts the items from one page body: GitHub returns bare arrays
 * for some list endpoints (`/rulesets`, `/hooks`) and `{total_count, xs}`
 * envelopes for others (`/actions/workflows`, `/environments`).
 *
 * Returns `null` — never a short list — on an insufficient-token-scope 403,
 * so the caller records the sentinel instead of an under-count. A truncated
 * list that reads as complete is the defect this function exists to remove;
 * re-introducing it on the error path would defeat the point.
 */
async function ghApiPaginatedItems(
  path: string,
  pick: (page: unknown) => readonly unknown[],
): Promise<unknown[] | null> {
  const r = await runCmd(["gh", "api", "--paginate", "--slurp", path]);
  if (r.exitCode !== 0) {
    if (isInsufficientTokenScope403(r.stderr)) return null;
    if (r.stderr.includes("HTTP 404")) return null;
    throw new Error(`gh api --paginate ${path} failed (exit ${r.exitCode}): ${r.stderr.trim()}`);
  }
  const pages = parseJsonSafe(r.stdout.trim(), []);
  if (!Array.isArray(pages)) return [];
  const items: unknown[] = [];
  for (const page of pages) items.push(...pick(page));
  return items;
}

/** Items of a page body that is either a bare array or an envelope `{key: []}`. */
function pageItems(key: string): (page: unknown) => readonly unknown[] {
  return (page: unknown): readonly unknown[] => {
    if (Array.isArray(page)) return page;
    if (page !== null && typeof page === "object") {
      const inner = (page as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner;
    }
    return [];
  };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Canonical projection of one ruleset's bypass actors, or `null` when the
 * credential was not allowed to see them.
 *
 * ABSENT IS NOT EMPTY, and conflating them is the whole bug this file is
 * about. `GET /repos/{o}/{r}/rulesets/{id}` OMITS the `bypass_actors` key
 * entirely for a reader without admin rights — it does not 403, and it does
 * not return `[]`. Verified unauthenticated against this repo's ruleset
 * 16134995 on 2026-08-25: the response carries
 * `[_links, conditions, created_at, enforcement, id, name, node_id, rules,
 * source, source_type, target, updated_at]` and no `bypass_actors`, while the
 * same call with an admin credential returns one admin PR-bypass actor.
 *
 * So a coercion of missing-to-`[]` would make a credential that CANNOT SEE
 * the bypass list report "nobody may bypass this ruleset" — absence reading
 * as the safe value, which is exactly the failure this whole change exists to
 * remove. It was written that way here first, and the CI run of PR #15369
 * caught it: under `GITHUB_TOKEN` the check reported the admin bypass as
 * having been REMOVED, and the cheapest way to make that green would have
 * been to record `[]` and erase the finding.
 *
 * `null` therefore means unreadable and is lifted to the
 * `insufficient-token-scope` sentinel by the caller; `[]` keeps its real
 * meaning of "read successfully, nobody bypasses".
 *
 * Sorted ordinally on the whole triple so the snapshot is byte-stable: the
 * API does not promise an order, and an unstable order would make every run
 * report drift, which is how a detector gets muted.
 */
export function normalizeBypassActors(raw: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((a) => {
      const o = asRecord(a);
      return {
        actor_id: typeof o.actor_id === "number" ? o.actor_id : null,
        actor_type: str(o.actor_type),
        bypass_mode: str(o.bypass_mode),
      };
    })
    .sort((x, y) =>
      ordinal(
        `${x.actor_type}\u0000${String(x.actor_id)}\u0000${x.bypass_mode}`,
        `${y.actor_type}\u0000${String(y.actor_id)}\u0000${y.bypass_mode}`,
      ),
    );
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
  const autolinkItems = await ghApiPaginatedItems(`/repos/${repo}/autolinks`, pageItems("autolinks"));
  const autolinks =
    autolinkItems === null
      ? insufficientTokenScope
      : autolinkItems
          .map((a) => ({
            is_alphanumeric: asRecord(a).is_alphanumeric ?? null,
            key_prefix: str(asRecord(a).key_prefix),
            url_template: str(asRecord(a).url_template),
          }))
          .sort((a, b) => ordinal(a.key_prefix, b.key_prefix));

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

  // Rulesets. Paginated: the list endpoint defaults to 30 and a repository
  // that crosses that line would silently stop recording its later rulesets.
  //
  // `bypass_actors` is projected on every ruleset. It is the field that says
  // WHO MAY MERGE PAST THE RULE, and it was absent from this snapshot until
  // 2026-08-25 — so for the 12 days after an admin bypass was added to "CI
  // Gate" the committed record showed a gate with no exceptions. An empty
  // array is a real, load-bearing value here ("nobody bypasses"), so it is
  // always emitted rather than omitted when empty.
  const rulesetListItems = await ghApiPaginatedItems(`/repos/${repo}/rulesets`, pageItems("rulesets"));
  const rulesetDetails: unknown[] = [];
  if (rulesetListItems !== null) {
    const ids = rulesetListItems
      .map((r) => asRecord(r).id)
      .filter((id): id is number => typeof id === "number")
      .sort((a, b) => a - b);
    for (const rid of ids) {
      const oneRaw = await ghApi(
        `/repos/${repo}/rulesets/${rid}`,
        // `bypass_actors` on a key the API omitted projects to `null` here, NOT
        // to `[]` — which is what lets `normalizeBypassActors` tell "not
        // allowed to see it" from "nobody bypasses".
        "{id, name, target, enforcement, bypass_actors, conditions, rules: [.rules[] | {type, parameters}]}"
      );
      const one = parseJsonSafe(oneRaw);
      if (one !== null) {
        const o = asRecord(one);
        const actors = normalizeBypassActors(o.bypass_actors);
        rulesetDetails.push({ ...o, bypass_actors: actors ?? insufficientTokenScope });
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
  const actionsVarItems = await ghApiPaginatedItems(`/repos/${repo}/actions/variables`, pageItems("variables"));
  const actionsVars =
    actionsVarItems === null
      ? insufficientTokenScope
      : actionsVarItems
          .map((v) => ({ name: str(asRecord(v).name), value: asRecord(v).value ?? null }))
          .sort((a, b) => ordinal(a.name, b.name));

  // Workflows. PAGINATED — this endpoint returns 30 per page and this repo has
  // 90, so the previous single-page read recorded exactly one third of the
  // inventory and the file gave no sign of it. Every workflow carries a
  // `state`, and `disabled_manually` on a workflow outside page 1 was
  // undetectable: a check that stops running, with a record that cannot
  // notice. Same class as a required check that never ran reading as green.
  const workflowItems = await ghApiPaginatedItems(`/repos/${repo}/actions/workflows`, pageItems("workflows"));
  const workflows =
    workflowItems === null
      ? insufficientTokenScope
      : workflowItems
          .map((w) => ({ name: str(asRecord(w).name), path: str(asRecord(w).path), state: str(asRecord(w).state) }))
          .sort((a, b) => ordinal(a.name, b.name) || ordinal(a.path, b.path));

  // Environments (paginated).
  const envItems = await ghApiPaginatedItems(`/repos/${repo}/environments`, pageItems("environments"));
  const envs =
    envItems === null
      ? insufficientTokenScope
      : envItems
          .map((e) => {
            const rules = asRecord(e).protection_rules;
            const types = Array.isArray(rules) ? rules.map((r) => str(asRecord(r).type)).sort(ordinal) : [];
            return { name: str(asRecord(e).name), protection_rule_types: types };
          })
          .sort((a, b) => ordinal(a.name, b.name));

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
  //
  // These are COUNTS, not names. A count cannot distinguish a secret being
  // rotated from a secret being replaced by an attacker's, so the invariant
  // this row carries is only "no secret was added or removed". Recorded as
  // the limit it is rather than left to be read as coverage it does not have.
  //
  // `.secrets | length` on an unpaginated read counted at most 30; the
  // envelope's own `total_count` is exact in one call, so counts use it.
  const webhookItems = await ghApiPaginatedItems(`/repos/${repo}/hooks`, pageItems("hooks"));
  const deployKeyItems = await ghApiPaginatedItems(`/repos/${repo}/keys`, pageItems("keys"));
  const actionsSecretsCountRaw = await ghApiSkip403(`/repos/${repo}/actions/secrets`, ".total_count");
  const dependabotSecretsCountRaw = await ghApiOptional(`/repos/${repo}/dependabot/secrets`, ".total_count");

  const webhooksCount = webhookItems === null ? insufficientTokenScope : webhookItems.length;
  const deployKeysCount = deployKeyItems === null ? insufficientTokenScope : deployKeyItems.length;
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

    // Say out loud what this run could NOT read. A snapshot written by a weak
    // token is a partial record; committing one without saying so is how
    // "recorded and unchecked" degrades into "absent and unchecked" with a
    // green check on top.
    const unreadable = unreadablePaths(parseJsonSafe(output, {}));
    if (unreadable.length > 0) {
      process.stderr.write(
        `snapshot-github-settings: ${unreadable.length} field(s) NOT readable with this credential ` +
          `(recorded in band as {"_skipped":"${INSUFFICIENT_TOKEN_SCOPE}"}):\n`,
      );
      for (const path of unreadable) {
        process.stderr.write(`  ${path}  <-  ${endpointForPath(path, parsed.args.repo)}\n`);
      }
      process.stderr.write(`${ADMIN_READ_CREDENTIAL_NOTE}\n`);
    }
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
