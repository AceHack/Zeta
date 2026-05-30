/**
 * L0 — GitHub external-port config/secret plumbing. Resolves a LIVE ChangeControlPort
 * from environment (token + owner + repo, optional api base + base branch) so the
 * worker's change-control lane can project real PRs for `external` review stages.
 *
 * Safe by default: with NO GitHub env, this returns null and the org runs internal-only
 * (the deployed default). With a partial config (e.g. token but no repo) it throws, so
 * a misconfiguration fails fast rather than silently degrading to internal-only.
 *
 * The token is read from env (mounted from a k8s Secret in the cluster) and never logged.
 */

import { createGitHubHttpClient, createGitHubPrPort, type ChangeControlPort } from "../../../packages/application/src/index.ts";

export const GitHubPortEnvName = {
  Token: "GITHUB_TOKEN",
  Owner: "GITHUB_OWNER",
  Repo: "GITHUB_REPO",
  ApiBaseUrl: "GITHUB_API_BASE_URL", // optional — e.g. GitHub Enterprise
  BaseBranch: "GITHUB_BASE_BRANCH", // optional — default main
} as const;

export type GitHubPortEnvironment = Record<string, string | undefined>;

export class GitHubPortConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubPortConfigError";
  }
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * @returns a live GitHub ChangeControlPort when fully configured; null when no GitHub
 * env is present (internal-only). Throws on a partial config.
 */
export function resolveGitHubExternalPort(
  env: GitHubPortEnvironment,
  deps: { nowMs: () => number; fetchImpl?: typeof fetch },
): ChangeControlPort | null {
  const token = nonEmpty(env[GitHubPortEnvName.Token]);
  const owner = nonEmpty(env[GitHubPortEnvName.Owner]);
  const repo = nonEmpty(env[GitHubPortEnvName.Repo]);

  const anyPresent = token !== undefined || owner !== undefined || repo !== undefined;
  const allPresent = token !== undefined && owner !== undefined && repo !== undefined;
  if (!anyPresent) return null; // internal-only (the safe default)
  if (!allPresent) {
    throw new GitHubPortConfigError(
      `partial GitHub config: ${GitHubPortEnvName.Token}, ${GitHubPortEnvName.Owner}, and ${GitHubPortEnvName.Repo} are all required to enable the live GitHub port`,
    );
  }

  const apiBaseUrl = nonEmpty(env[GitHubPortEnvName.ApiBaseUrl]);
  const baseBranch = nonEmpty(env[GitHubPortEnvName.BaseBranch]);
  const client = createGitHubHttpClient({
    token,
    owner,
    repo,
    ...(apiBaseUrl !== undefined ? { baseUrl: apiBaseUrl } : {}),
    ...(baseBranch !== undefined ? { baseBranch } : {}),
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  });
  return createGitHubPrPort({ client, nowMs: deps.nowMs });
}
