/**
 * forge-host/github/index.ts — GitHub adapter exports + auto-registration.
 *
 * Importing this module registers the GitHub adapter with the ForgeHost registry.
 */
import { registerAdapter } from "../registry";
import { GitHubAdapter } from "./github-adapter";
export { GitHubAdapter } from "./github-adapter";
export { classifyGhError } from "./classify-error";
export { runGh, runGhJson, runGhGraphQL } from "./gh-cli";
/** Register the GitHub adapter for github.com and self-hosted GitHub instances. */
registerAdapter(/github/, (owner, repo) => new GitHubAdapter(owner, repo));
