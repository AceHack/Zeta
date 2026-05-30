/**
 * GEN3 — generic work-provider config/secret plumbing. Resolves a LIVE provider from env
 * (WORK_PROVIDER selects github|gitlab|jira|linear; per-provider token + ids follow), then
 * adapts a code_review provider to the kernel's ChangeControlPort so the change-control lane
 * projects real PRs/MRs for `external` stages.
 *
 * Safe by default: no WORK_PROVIDER (and no legacy GITHUB_* fallback) → null → internal-only
 * (the deployed default). A selected provider missing a required field throws (fail fast, never
 * silently degrade). The token is read from env (mounted from a k8s Secret) and never logged.
 *
 * Back-compat: WORK_PROVIDER unset but legacy GITHUB_TOKEN/OWNER/REPO present → treated as github
 * (the L0 path), so existing deployments keep working without a config change.
 */

import { WorkProviderKind, WorkProviderFamily } from "../../../packages/domain/src/index.ts";
import {
  resolveWorkProvider,
  asChangeControlPort,
  type ChangeControlPort,
  type WorkProviderConfig,
  type WorkProviderPort,
} from "../../../packages/application/src/index.ts";

export const WorkProviderEnvName = {
  Provider: "WORK_PROVIDER", // github | gitlab | jira | linear
  // github
  GitHubToken: "GITHUB_TOKEN",
  GitHubOwner: "GITHUB_OWNER",
  GitHubRepo: "GITHUB_REPO",
  GitHubApiBaseUrl: "GITHUB_API_BASE_URL",
  GitHubBaseBranch: "GITHUB_BASE_BRANCH",
  // gitlab
  GitLabToken: "GITLAB_TOKEN",
  GitLabProjectId: "GITLAB_PROJECT_ID",
  GitLabApiBaseUrl: "GITLAB_API_BASE_URL",
  GitLabBaseBranch: "GITLAB_BASE_BRANCH",
  // jira
  JiraToken: "JIRA_TOKEN",
  JiraBaseUrl: "JIRA_BASE_URL",
  JiraProjectKey: "JIRA_PROJECT_KEY",
  // linear
  LinearToken: "LINEAR_TOKEN",
  LinearTeamId: "LINEAR_TEAM_ID",
  LinearApiBaseUrl: "LINEAR_API_BASE_URL",
} as const;

export type WorkProviderEnvironment = Record<string, string | undefined>;

export class WorkProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkProviderConfigError";
  }
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

/** require a field for a selected provider; collect the env name in the error if missing. */
function required(env: WorkProviderEnvironment, name: string, provider: string): string {
  const v = nonEmpty(env[name]);
  if (v === undefined) throw new WorkProviderConfigError(`work-provider '${provider}' requires ${name}`);
  return v;
}

/** Build the discriminated WorkProviderConfig from env for the selected provider. */
function configFromEnv(env: WorkProviderEnvironment, provider: string): WorkProviderConfig {
  switch (provider) {
    case WorkProviderKind.GitHub: {
      const baseUrl = nonEmpty(env[WorkProviderEnvName.GitHubApiBaseUrl]);
      const baseBranch = nonEmpty(env[WorkProviderEnvName.GitHubBaseBranch]);
      return {
        kind: WorkProviderKind.GitHub,
        token: required(env, WorkProviderEnvName.GitHubToken, provider),
        owner: required(env, WorkProviderEnvName.GitHubOwner, provider),
        repo: required(env, WorkProviderEnvName.GitHubRepo, provider),
        ...(baseUrl !== undefined ? { baseUrl } : {}),
        ...(baseBranch !== undefined ? { baseBranch } : {}),
      };
    }
    case WorkProviderKind.GitLab: {
      const baseUrl = nonEmpty(env[WorkProviderEnvName.GitLabApiBaseUrl]);
      const baseBranch = nonEmpty(env[WorkProviderEnvName.GitLabBaseBranch]);
      return {
        kind: WorkProviderKind.GitLab,
        token: required(env, WorkProviderEnvName.GitLabToken, provider),
        projectId: required(env, WorkProviderEnvName.GitLabProjectId, provider),
        ...(baseUrl !== undefined ? { baseUrl } : {}),
        ...(baseBranch !== undefined ? { baseBranch } : {}),
      };
    }
    case WorkProviderKind.Jira:
      return {
        kind: WorkProviderKind.Jira,
        token: required(env, WorkProviderEnvName.JiraToken, provider),
        baseUrl: required(env, WorkProviderEnvName.JiraBaseUrl, provider),
        projectKey: required(env, WorkProviderEnvName.JiraProjectKey, provider),
      };
    case WorkProviderKind.Linear: {
      const baseUrl = nonEmpty(env[WorkProviderEnvName.LinearApiBaseUrl]);
      return {
        kind: WorkProviderKind.Linear,
        token: required(env, WorkProviderEnvName.LinearToken, provider),
        teamId: required(env, WorkProviderEnvName.LinearTeamId, provider),
        ...(baseUrl !== undefined ? { baseUrl } : {}),
      };
    }
    default:
      throw new WorkProviderConfigError(`unknown ${WorkProviderEnvName.Provider} '${provider}' (expected github|gitlab|jira|linear)`);
  }
}

/**
 * @returns the live WorkProviderPort when WORK_PROVIDER is set + configured; null when no
 * provider is configured. Throws on an unknown provider or a partial config.
 */
export function resolveWorkProviderFromEnv(
  env: WorkProviderEnvironment,
  deps: { nowMs: () => number; fetchImpl?: typeof fetch },
): WorkProviderPort | null {
  // WORK_PROVIDER selects; back-compat — no WORK_PROVIDER but legacy GITHUB_* present → github (L0 path)
  const provider =
    nonEmpty(env[WorkProviderEnvName.Provider]) ??
    (nonEmpty(env[WorkProviderEnvName.GitHubToken]) !== undefined ? WorkProviderKind.GitHub : undefined);
  if (provider === undefined) return null; // internal-only (the safe default)
  const config = configFromEnv(env, provider);
  return resolveWorkProvider(config, { nowMs: deps.nowMs, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) });
}

export type ResolvedExternalReview = {
  /** a ChangeControlPort when a code_review provider is configured; null otherwise */
  port: ChangeControlPort | null;
  /** human-readable mode for the boot log: "internal-only" | "external:github" | "work-item:jira (change-control internal-only)" | ... */
  mode: string;
};

/**
 * Resolve the change-control external port from env. A code_review provider (github/gitlab) becomes
 * the live ChangeControlPort. A work_item provider (jira/linear) is NOT a PR port — the change-control
 * lane stays internal-only and the mode log says so (work-item sync is a separate seam).
 */
export function resolveChangeControlExternalPort(
  env: WorkProviderEnvironment,
  deps: { nowMs: () => number; fetchImpl?: typeof fetch },
): ResolvedExternalReview {
  const provider = resolveWorkProviderFromEnv(env, deps);
  if (provider === null) return { port: null, mode: "internal-only" };
  if (provider.family === WorkProviderFamily.CodeReview) {
    return { port: asChangeControlPort(provider), mode: `external:${provider.kind}` };
  }
  return { port: null, mode: `work-item:${provider.kind} (change-control internal-only)` };
}
